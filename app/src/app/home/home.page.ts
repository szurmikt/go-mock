import { Component, OnDestroy, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ViewWillEnter, ViewDidEnter, ViewWillLeave } from '@ionic/angular';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { ApiEnvironmentService } from '../services/api-environment';
import { AuthService } from '../services/auth';
import { ReservationService, pillStatus, pillLabel } from '../services/reservation';
import { OptionsService } from '../services/options.service';
import { PropertySettingsService } from '../services/property-settings.service';
import { MixpanelService } from '../services/mixpanel';
import { TipsService } from '../services/tips.service';
import { FilterService, GroupedResult } from '../services/home-filter.service';
import { HomeFilter } from '../models/home-filter.interface';
import { PropertyInterface } from '../models/property.interface';
import { ReservationInterface } from '../models/reservation.interface';
import { TipCard } from '../models/tip-card.interface';
import { FilterDayGroup } from '../utils/home-filter-grouping';
import { LocalizedDatePipe } from '../pipes/localized-date.pipe';
import { TranslatePipe } from '../pipes/translate.pipe';
import { FeedbackSheetComponent } from '../components/feedback-sheet/feedback-sheet.component';
import { TipDetailSheetComponent } from '../components/tip-detail-sheet/tip-detail-sheet.component';
import { TipCardComponent } from '../components/tip-card/tip-card.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    LocalizedDatePipe,
    TranslatePipe,
    FeedbackSheetComponent,
    TipDetailSheetComponent,
    TipCardComponent,
  ],
})
export class HomePage implements ViewWillEnter, ViewDidEnter, ViewWillLeave, OnDestroy {
  @ViewChild('ionContentEl') ionContentEl?: IonContent;
  @ViewChild('stickySentinel') stickySentinel?: ElementRef<HTMLElement>;
  @ViewChild('chipStripWrap') chipStripWrap?: ElementRef<HTMLElement>;
  @ViewChild('chipStripEl') chipStripEl?: ElementRef<HTMLElement>;

  private hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  switchOpen = signal(false);
  propertyQuery = signal('');

  readonly filteredProperties = computed(() => {
    const q = this.propertyQuery().trim().toLowerCase();
    // auth.properties() is already eligibility-filtered at the source — the API
    // excludes ineligible PIDs from /properties entirely.
    const all = this.auth.properties();
    if (!q) return all;
    return all.filter(p =>
      (p.property_name ?? '').toLowerCase().includes(q) ||
      (p.property_company_name ?? '').toLowerCase().includes(q) ||
      String(p.property_id).includes(q),
    );
  });

  closeSwitch() {
    this.switchOpen.set(false);
    this.propertyQuery.set('');
  }

  setPropertyQuery(v: string) {
    this.propertyQuery.set(v);
  }

  clearPropertyQuery() {
    this.propertyQuery.set('');
  }

  // ---- Filter chips ----

  private filterSvc = inject(FilterService);

  readonly chipList = computed(() => this.filterSvc.filters(this.auth.userId()));
  readonly selectedFilterId = computed(() => this.filterSvc.selectedFilterId(this.auth.userId()));

  readonly grouped = computed<GroupedResult>(() =>
    this.filterSvc.buildGroupedList(this.auth.userId(), this.res.reservations()),
  );

  readonly isEmpty = computed(() =>
    this.grouped().days.every(g => g.rows.length === 0 && g.completed.length === 0),
  );

  chipCountLabel(f: HomeFilter): string {
    const counts = this.filterSvc.countsFor(f, this.res.reservations());
    return counts.pending !== undefined ? `${counts.pending}/${counts.total}` : `${counts.total}`;
  }

  async selectChip(f: HomeFilter): Promise<void> {
    if (f.id === this.selectedFilterId()) return;
    await this.filterSvc.selectFilter(this.auth.userId(), f.id);
  }

  goManageFilters(): void {
    this.router.navigate(['/manage-filters']);
  }

  /**
   * Scrolls the selected chip into view within the strip — but ONLY from ionViewDidEnter()
   * (page load / cold-start restore), never in reaction to a chip tap. An earlier version
   * of this used a signal effect reacting to chipList()/selectedFilterId() changes, which
   * also fired on every real tap — moving the strip the instant the user touched it, which
   * read as the control itself misbehaving (a tapped chip must never relocate). The two
   * cases have opposite correct behavior: a restored selection that's off-screen after a
   * restart SHOULD be scrolled into view (even if that only reveals it partially); a chip
   * the user just tapped should NEVER cause the strip to move, whether or not it was fully
   * visible already. So this is a plain method, called once per page entry, not reactive.
   */
  private scrollSelectedChipIntoView(): void {
    const strip = this.chipStripEl?.nativeElement;
    if (!strip) return;
    const activeBtn = strip.querySelector<HTMLElement>('.filter-chip.active');
    if (!activeBtn) return;
    const stripRect = strip.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    // Manual scrollLeft math only — deliberately not Element.scrollIntoView(), which also
    // scrolls vertical ancestors as needed and could jump the whole page just to reveal a
    // horizontally-clipped chip.
    const margin = 8;
    if (btnRect.left < stripRect.left) {
      strip.scrollLeft -= stripRect.left - btnRect.left + margin;
    } else if (btnRect.right > stripRect.right) {
      strip.scrollLeft += btnRect.right - stripRect.right + margin;
    }
  }

  // Sticky chip strip: an IntersectionObserver on a 1px sentinel placed immediately above
  // the strip — when the sentinel scrolls out of the real scroll viewport, the strip has
  // reached the top and is "stuck". Standard sticky-detection technique; position: sticky
  // alone gives no boolean for "is this currently stuck".
  chipsStuck = signal(false);
  private chipsObserver?: IntersectionObserver;
  private chipStripResizeObserver?: ResizeObserver;

  /**
   * Root must be the REAL scroll element, not .app-scroll (which is deliberately not the
   * scroll container on this page — see home.page.scss) and not the viewport (the app can
   * run inside a desktop-constrained, clipped ion-app box). IonContent.getScrollElement()
   * is Ionic's own public accessor for this, so it stays correct regardless of Ionic's
   * internal shadow-DOM implementation.
   */
  private async setupChipsStickyObserver(): Promise<void> {
    const sentinel = this.stickySentinel?.nativeElement;
    if (!sentinel || !this.ionContentEl) return;
    const root = await this.ionContentEl.getScrollElement();

    // The strip sticks at `env(safe-area-inset-top)`, not at the root's literal top edge —
    // without correcting for that, the sentinel leaving the root at scroll offset 0 would
    // toggle `stuck` ~insetPx too late (the strip would visibly stick before the signal
    // flips). Measured via a throwaway probe rather than reading env() from a real element's
    // computed style elsewhere, since nothing else in this template already carries it.
    const probe = document.createElement('div');
    probe.style.cssText = 'position: fixed; top: 0; padding-top: env(safe-area-inset-top, 0px); visibility: hidden; pointer-events: none;';
    document.body.appendChild(probe);
    const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();

    this.chipsObserver?.disconnect();
    this.chipsObserver = new IntersectionObserver(
      ([entry]) => this.chipsStuck.set(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: `-${inset}px 0px 0px 0px` },
    );
    this.chipsObserver.observe(sentinel);
  }

  /** Measures the chip strip's real rendered height (varies with locale/font-size/content)
   *  and writes it to --chip-strip-h on the host element, so .day-group-header's `top`
   *  (which reads that custom property) always sticks exactly below the strip rather than
   *  under it, regardless of the strip's actual size. */
  private setupChipStripHeightObserver(): void {
    const el = this.chipStripWrap?.nativeElement;
    if (!el) return;
    this.chipStripResizeObserver?.disconnect();
    // Deliberately reads el.offsetHeight (border-box — includes the wrap's own top/bottom
    // padding) rather than the ResizeObserver entry's contentRect (content-box only, which
    // would under-report by the padding and stick the day header slightly under the strip's
    // visible padding, not directly below it). offsetHeight is simpler and has none of
    // borderBoxSize's cross-browser shape inconsistencies (notably on older Safari/WKWebView).
    this.chipStripResizeObserver = new ResizeObserver(() => {
      this.hostEl.nativeElement.style.setProperty('--chip-strip-h', `${el.offsetHeight}px`);
    });
    this.chipStripResizeObserver.observe(el);
  }

  groupKey(g: FilterDayGroup): string {
    return g.day ?? 'single';
  }

  /**
   * Section header labels for a single-day filter's pending/completed split — always
   * visible, no collapse (an earlier collapsible "Checked in (n)" toggle was replaced by
   * this). Returns null — render one flat list, no headers at all — whenever there's no
   * real split to communicate:
   *  - a multi-day filter (g.day !== null) — per explicit decision, Next 7/14 Days always
   *    stays a plain per-day list with no arrived/not-arrived sub-split, just the day
   *    headers.
   *  - either side is currently empty. This is deliberate, not just a shortcut: a split only
   *    means something once BOTH sides are non-empty. A property with no online check-in can
   *    never have anyone in tomorrow's "Checked-in" group — it's always empty — so showing a
   *    "No check-in yet" header above what's really just "everyone" would be pure noise. The
   *    same one rule also covers the first arrival of the day (nobody's checked in yet) and
   *    the last (everyone already has), with no separate online-check-in check needed — it
   *    falls out of "only label a split that actually exists."
   *  - in_house, which has no completed concept at all — `g.completed` is always empty, so
   *    this is already covered by the rule above without a separate guests==='in_house' check.
   *  - `yesterday` — an explicit decision, not something that falls out of the rules above:
   *    a past day gets no split at all, regardless of whether both sides happen to be
   *    non-empty (e.g. one straggler still "confirmed" among a mostly-arrived yesterday).
   */
  sectionLabels(g: FilterDayGroup): { pending: string; completed: string } | null {
    if (g.day !== null || g.pendingCount === 0 || g.completed.length === 0) return null;
    const filter = this.grouped().filter;
    // A past day never gets a split, by explicit decision — unlike today/tomorrow, nothing
    // useful is communicated by separating "arrived"/"departed" from the rest once the day
    // itself is already over; just list everyone together.
    if (filter?.day === 'yesterday') return null;
    if (filter?.guests === 'arrivals') {
      // "Arrived"/"Not yet arrived" only make sense once the day has actually happened
      // (today or a past day) — nobody physically arrives before tomorrow, so a non-empty
      // completed group there can only mean an online check-in ahead of arrival.
      return filter.day === 'tomorrow'
        ? { pending: 'home.sectionNoCheckInYet', completed: 'home.sectionCheckedIn' }
        : { pending: 'home.sectionNotYetArrived', completed: 'home.sectionArrived' };
    }
    if (filter?.guests === 'departures') {
      return { pending: 'home.sectionStillOnboard', completed: 'home.sectionDeparted' };
    }
    return null;
  }

  // Independent of the selected filter — a reservation open in PMS may not even arrive
  // today, and the point is to surface it regardless of which chip is active.
  readonly openInPms = computed(() => this.res.reservations().filter(r => r.open_in_pms));

  // Help & tips carousel. Deliberately a plain signal, NOT a computed() off TipsService's
  // live seen/dismissed state: opening a card's detail sheet marks it seen immediately (per
  // the handoff), and if this list were reactive it would shrink/reshuffle under the user
  // while that sheet is still open on top of it. Instead it's snapshotted once per real visit
  // to Home (refreshTipCards(), called from ionViewWillEnter below) — the next actual return
  // to Home is what picks up the new state, never a background reshuffle mid-interaction.
  tipCardsSnapshot = signal<TipCard[]>([]);
  activeTipIndex = signal(0);
  private shownTipIds = new Set<string>();
  private tips = inject(TipsService);

  private refreshTipCards(): void {
    this.tipCardsSnapshot.set(this.tips.homeCards(this.auth.userId()));
    this.activeTipIndex.set(0);
    if (this.tipCardsSnapshot().length > 0) this.trackTipShownIfNew(0);
  }

  /** Ties "shown" to the carousel card actually scrolled into view (activeTipIndex), not
   *  merely present in tipCardsSnapshot — in a one-card-at-a-time carousel, cards 2 and 3
   *  aren't visible until scrolled to, so firing on array membership alone would overcount. */
  private trackTipShownIfNew(index: number): void {
    const card = this.tipCardsSnapshot()[index];
    if (!card || this.shownTipIds.has(card.id)) return;
    this.shownTipIds.add(card.id);
    this.mixpanel.trackTipCardShown({ card_id: card.id, category: card.category, surface: 'home' });
  }

  onTipCarouselScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el.clientWidth) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    // +1 slide count for the trailing "See all tips" slide, which isn't a real TipCard —
    // trackTipShownIfNew already no-ops for it (tipCardsSnapshot()[idx] is undefined there),
    // this just lets the dot indicator follow it too.
    const slideCount = this.tipCardsSnapshot().length + 1;
    if (idx === this.activeTipIndex() || idx < 0 || idx >= slideCount) return;
    this.activeTipIndex.set(idx);
    this.trackTipShownIfNew(idx);
  }

  async dismissTip(card: TipCard): Promise<void> {
    await this.tips.dismiss(this.auth.userId(), card.id, card.updatedAt);
    this.mixpanel.trackTipCardDismissed({ card_id: card.id, category: card.category });
    // The one case where the visible list SHOULD update immediately — the user just
    // performed this action themselves and expects instant feedback (unlike marking a card
    // seen on open, which deliberately does not touch this snapshot — see above).
    this.tipCardsSnapshot.update(cards => cards.filter(c => c.id !== card.id));
  }

  goHelpTips(): void {
    this.router.navigate(['/help-tips']);
  }

  // Foreground polling while Home is the active view (Part B, Phase 0 of the
  // open-in-PMS investigation — see the plan doc): no push/websocket exists yet,
  // so this is the fastest way to surface a PMS-side change without backend work.
  // Paused whenever the app backgrounds so it doesn't burn battery/data in a pocket.
  private static readonly POLL_MS = 10_000;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private appStateHandle: Promise<PluginListenerHandle> | null = null;

  private options = inject(OptionsService);
  apiEnv = inject(ApiEnvironmentService);
  private mixpanel = inject(MixpanelService);

  constructor(
    public auth: AuthService,
    public res: ReservationService,
    public propertySettings: PropertySettingsService,
    private router: Router,
  ) {}

  // See PropertySettingsService.onlineCheckIn's doc comment — drives whether the
  // "Onboard" pill reads "Onboard" or "Checked in" for this account.
  readonly onlineCheckIn = computed(() => this.propertySettings.onlineCheckIn());

  // Load on every view entry (not ngOnInit) so re-entering a cached home view —
  // e.g. after logout → login → Select Property — always refreshes. The 60s
  // staleness gate in fetchReservations dedupes redundant calls.
  ionViewWillEnter() {
    this.res.fetchReservations();
    this.refreshTipCards();
    this.filterSvc.ensureSeeded(this.auth.userId());
  }

  ionViewDidEnter() {
    this.startPolling();
    this.appStateHandle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) this.startPolling();
      else this.stopPolling();
    });
    this.setupChipsStickyObserver();
    this.setupChipStripHeightObserver();
    // Load-only trigger for scrolling a restored-but-off-screen selection into view — see
    // scrollSelectedChipIntoView()'s doc comment for why this must never also run on a chip
    // tap. By ionViewDidEnter the page is guaranteed fully entered/laid out (same reasoning
    // as the two observer setups above), so the measurement here is never taken mid-transition.
    this.scrollSelectedChipIntoView();
  }

  ionViewWillLeave() {
    this.stopPolling();
    this.appStateHandle?.then(h => h.remove());
    this.appStateHandle = null;
    this.chipsObserver?.disconnect();
    this.chipStripResizeObserver?.disconnect();
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.res.fetchReservations(true), HomePage.POLL_MS);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  ngOnDestroy() {
    this.timeouts.forEach(clearTimeout);
    this.stopPolling();
    this.appStateHandle?.then(h => h.remove());
    this.chipsObserver?.disconnect();
    this.chipStripResizeObserver?.disconnect();
  }

  async selectProperty(p: PropertyInterface) {
    const fromId = this.auth.selectedProperty()?.property_id;
    if (fromId !== p.property_id) {
      this.options.clear();
      this.res.clear();
      this.mixpanel.trackPropertySwitched({
        property_id: p.property_id,
        property_name: p.property_name ?? undefined,
        from_property_id: fromId,
      });
    }
    const eligibility = await this.auth.selectProperty(p);
    this.closeSwitch();
    if (eligibility === 'ineligible') {
      await this.router.navigate(['/go-unavailable'], { replaceUrl: true });
      return;
    }
    if (eligibility === 'unverified') {
      await this.router.navigate(['/service-unavailable'], { replaceUrl: true });
      return;
    }
    await Promise.all([
      this.res.fetchReservations(),
      this.options.countries().length === 0 ? this.options.load().catch(() => {}) : Promise.resolve(),
    ]);
  }

  async handleRefresh(event: CustomEvent) {
    await this.res.fetchReservations(true);
    (event.target as HTMLIonRefresherElement).complete();
  }

  goSettings() {
    this.router.navigate(['/settings']);
  }

  goSearch() {
    this.router.navigate(['/search']);
  }

  goReservation(r: ReservationInterface) {
    this.router.navigate(['/reservation', r.reservation_code]);
  }

  pillStatus = pillStatus;
  pillLabel = pillLabel;

  bookerName(r: ReservationInterface): string {
    return `${r.booker.first_name} ${r.booker.last_name}`.trim();
  }
}

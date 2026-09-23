import { Component, OnDestroy, inject, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { ViewWillEnter, ViewDidEnter, ViewWillLeave } from '@ionic/angular';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { ApiEnvironmentService } from '../services/api-environment';
import { AuthService } from '../services/auth';
import { ReservationService, pillStatus, pillLabel } from '../services/reservation';
import { OptionsService } from '../services/options.service';
import { MixpanelService } from '../services/mixpanel';
import { TipsService } from '../services/tips.service';
import { PropertyInterface } from '../models/property.interface';
import { ReservationInterface } from '../models/reservation.interface';
import { TipCard } from '../models/tip-card.interface';
import { LocalizedDatePipe } from '../pipes/localized-date.pipe';
import { TranslatePipe } from '../pipes/translate.pipe';
import { FeedbackSheetComponent } from '../components/feedback-sheet/feedback-sheet.component';
import { TipDetailSheetComponent } from '../components/tip-detail-sheet/tip-detail-sheet.component';
import { TipCardComponent } from '../components/tip-card/tip-card.component';
// THROWAWAY MOCK — single-property morning-briefing widget. Remove with pages/briefing.
import { BRIEFING_PROPERTY_ID } from '../pages/briefing/briefing.const';

type Tab = 'Yesterday' | 'Today' | 'Tomorrow';

function localDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
export class HomePage implements ViewWillEnter, ViewDidEnter, ViewWillLeave, AfterViewInit, OnDestroy {
  @ViewChildren('segBtn') segBtns!: QueryList<ElementRef<HTMLButtonElement>>;

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  readonly tabs: Tab[] = ['Yesterday', 'Today', 'Tomorrow'];
  tab = signal<Tab>('Today');
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

  // THROWAWAY MOCK — single-property morning-briefing widget. Remove with pages/briefing.
  // Disabled outright (including for its one gated property, briefing.const.ts's
  // BRIEFING_PROPERTY_ID) per explicit request — the widget/route/const are left
  // in place, just never shown.
  readonly showBriefing = computed(() => false);
  readonly firstName = computed(() => this.auth.name().trim().split(/\s+/)[0] || 'there');
  goBriefing() { this.router.navigate(['/briefing']); }

  thumb = signal({ left: 3, width: 0 });

  readonly dateMap: Record<Tab, string> = {
    Yesterday: localDateStr(-1),
    Today: localDateStr(0),
    Tomorrow: localDateStr(1),
  };

  readonly arrivals = computed(() => {
    const date = this.dateMap[this.tab()];
    return this.res.reservations().filter(r => r.arrival_date === date);
  });

  readonly guestCount = computed(() =>
    this.arrivals().reduce((s, r) => s + r.number_of_guests, 0),
  );

  // Independent of the Yesterday/Today/Tomorrow tab — a reservation open in PMS
  // may not even arrive today, and the point is to surface it regardless of tab.
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
    await this.tips.dismiss(this.auth.userId(), card.id);
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
    private router: Router,
  ) {}

  // Load on every view entry (not ngOnInit) so re-entering a cached home view —
  // e.g. after logout → login → Select Property — always refreshes. The 60s
  // staleness gate in fetchReservations dedupes redundant calls.
  ionViewWillEnter() {
    this.res.fetchReservations();
    this.refreshTipCards();
  }

  ionViewDidEnter() {
    this.startPolling();
    this.appStateHandle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) this.startPolling();
      else this.stopPolling();
    });
  }

  ionViewWillLeave() {
    this.stopPolling();
    this.appStateHandle?.then(h => h.remove());
    this.appStateHandle = null;
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

  ngAfterViewInit() {
    this.t(() => this.updateThumb(), 50);
  }

  ngOnDestroy() {
    this.timeouts.forEach(clearTimeout);
    this.stopPolling();
    this.appStateHandle?.then(h => h.remove());
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.mixpanel.trackHomeSegmentChanged(t.toLowerCase());
    this.t(() => this.updateThumb(), 0);
  }

  private updateThumb() {
    const btns = this.segBtns?.toArray();
    if (!btns?.length) return;
    const idx = this.tabs.indexOf(this.tab());
    const el = btns[idx]?.nativeElement;
    if (el) this.thumb.set({ left: el.offsetLeft, width: el.offsetWidth });
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

  isDimmed(r: ReservationInterface): boolean {
    const status = pillStatus(r.status);
    if (status === 'cancelled' || status === 'noshow') return true;
    return this.tab() !== 'Today' && status === 'option';
  }
}

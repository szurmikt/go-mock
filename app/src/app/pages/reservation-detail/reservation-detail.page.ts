import { Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { ReservationService, pillStatus, pillLabel, STATUS_STEPS, StatusStep } from '../../services/reservation';
import { OptionsService } from '../../services/options.service';
import { PropertySettingsService } from '../../services/property-settings.service';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth';
import { ReservationInterface } from '../../models/reservation.interface';
import { GuestInterface } from '../../models/guest.interface';
import { LocalizedDatePipe } from '../../pipes/localized-date.pipe';
import { LocalizedTimePipe } from '../../pipes/localized-time.pipe';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { parseApiInstant } from '../../utils/date';
import { getCommentsLastSeen, markCommentsSeen } from '../../utils/comments-seen.util';

@Component({
  selector: 'app-reservation-detail',
  templateUrl: './reservation-detail.page.html',
  styleUrls: ['./reservation-detail.page.scss'],
  standalone: true,
  imports: [IonContent, IonRefresher, IonRefresherContent, FormsModule, TitleCasePipe, LocalizedDatePipe, LocalizedTimePipe, TranslatePipe],
})
export class ReservationDetailPage implements OnInit, ViewWillEnter {
  reservation = signal<ReservationInterface | null>(null);
  guests = signal<GuestInterface[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  pillStatus = pillStatus;
  pillLabel = pillLabel;
  statusSteps = STATUS_STEPS;

  // FAB action-sheet
  menuOpen = signal(false);

  // Reservation Status timeline sheet
  statusSheetOpen = signal(false);
  statusUpdating = signal(false);
  statusUpdateError = signal<string | null>(null);

  // Onboard → Check-out guard
  checkoutConfirmOpen = signal(false);

  // Comments sheet
  commentsSheetOpen = signal(false);
  commentDraft = signal('');
  postingComment = signal(false);
  commentError = signal<string | null>(null);

  // Snapshotted once per data load (initial fetch / pull-to-refresh), against the
  // per-user/per-reservation/per-device "last seen" watermark in localStorage —
  // NOT recomputed when the sheet opens/closes, so a comment stays flagged "new"
  // for the rest of this page visit even after being viewed (matches "next time
  // the reservation is opened" — the row/dots clear on the *next* load, once
  // openCommentsSheet()/sendComment() have advanced the watermark).
  newCommentIds = signal<Set<number>>(new Set());
  readonly newCommentCount = computed(() => this.newCommentIds().size);

  @ViewChild('commentsList') commentsListRef?: ElementRef<HTMLDivElement>;

  // -1 when the current status isn't one of the 4 flow steps (e.g. cancelled/noshow) —
  // Change Status is hidden entirely in that case (both the FAB item and the pill tap).
  readonly statusIndex = computed(() => {
    const r = this.reservation();
    if (!r) return -1;
    return STATUS_STEPS.findIndex(s => s.key === r.status);
  });

  readonly inStatusFlow = computed(() => this.statusIndex() >= 0);

  readonly nextStep = computed<StatusStep | null>(() => {
    const i = this.statusIndex();
    return i >= 0 && i < STATUS_STEPS.length - 1 ? STATUS_STEPS[i + 1] : null;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private res: ReservationService,
    private options: OptionsService,
    private lang: LanguageService,
    private auth: AuthService,
    public propertySettings: PropertySettingsService,
  ) {}

  private reservationCode!: string;

  ngOnInit() {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
  }

  // Refresh on every entry (including back-navigation, where ngOnInit does not re-run).
  // Seed from cache for an instant paint and only show the spinner when there's nothing
  // to show yet; otherwise the refresh is silent (fetchDetail is always uncached, guests
  // are SWR-gated).
  async ionViewWillEnter() {
    const code = this.reservationCode;
    if (!code) return;

    if (!this.reservation()) {
      const cached = this.res.reservations().find(r => r.reservation_code === code);
      if (cached) this.reservation.set(cached);
    }
    if (this.guests().length === 0) {
      const peeked = this.res.peekGuests(code);
      if (peeked) this.guests.set(peeked);
    }

    const firstLoad = !this.reservation() || this.guests().length === 0;
    if (firstLoad) {
      this.loading.set(true);
      this.error.set(null);
    }
    try {
      const [detail, guests] = await Promise.all([
        this.res.fetchDetail(code),
        this.res.fetchGuests(code),
      ]);
      this.reservation.set(detail);
      this.guests.set(guests);
      this.recomputeNewComments(detail);
    } catch (e: any) {
      if (firstLoad) this.error.set(e.message ?? this.lang.t('errors.failedLoadReservation'));
    } finally {
      this.loading.set(false);
    }
  }

  // Pull-to-refresh: force a fresh detail + guests fetch (bypassing the 60s window) for
  // this reservation. fetchGuests(force) overwrites the shared guest cache, so the Guest
  // Details screen also shows the refreshed data afterwards.
  async handleRefresh(event: CustomEvent) {
    try {
      const [detail, guests] = await Promise.all([
        this.res.fetchDetail(this.reservationCode),
        this.res.fetchGuests(this.reservationCode, true),
      ]);
      this.reservation.set(detail);
      this.guests.set(guests);
      this.recomputeNewComments(detail);
    } catch { /* keep existing data */ }
    (event.target as HTMLIonRefresherElement).complete();
  }

  // First-ever view (no stored watermark) flags every existing comment as new —
  // deliberate, per product decision, rather than special-casing a quiet first load.
  private recomputeNewComments(r: ReservationInterface) {
    const lastSeen = getCommentsLastSeen(this.auth.userId(), r.reservation_code);
    const ids = new Set(
      r.comments
        .filter(c => lastSeen == null || parseApiInstant(c.created_datetime) > lastSeen)
        .map(c => c.comment_id),
    );
    this.newCommentIds.set(ids);
  }

  back() {
    window.history.back();
  }

  guestName(g: GuestInterface): string {
    return `${g.first_name} ${g.last_name}`.trim();
  }

  composition(r: ReservationInterface): string {
    const { adults, children, infants } = r.guest_count;
    const total = adults + children + infants;
    return `${total} (${adults}/${children}/${infants})`;
  }

  isFirstGuest(g: GuestInterface): boolean {
    const guests = this.guests();
    return guests.length > 0 && guests[0].reservation_guest_id === g.reservation_guest_id;
  }

  citizenshipName(code: string | null | undefined): string {
    if (!code) return '';
    const match = this.options.countries().find(c => c.country_code === code);
    return match?.name ?? code;
  }

  goGuest(g: GuestInterface) {
    this.router.navigate(['/guest', this.reservationCode, g.reservation_guest_id]);
  }

  startScan(g: GuestInterface) {
    this.router.navigate(['/guest', this.reservationCode, g.reservation_guest_id], {
      queryParams: { autoScan: '1' },
    });
  }

  // Two entry points, one sheet: the FAB's "Change Status" action item and the
  // status pill in the detail-block header both call this.
  openStatusSheet() {
    if (!this.inStatusFlow()) return;
    this.menuOpen.set(false);
    this.statusUpdateError.set(null);
    this.statusSheetOpen.set(true);
  }

  closeStatusSheet() {
    if (this.statusUpdating()) return;
    this.statusSheetOpen.set(false);
  }

  stepTimestamp(step: StatusStep): string {
    return this.reservation()?.[step.tsField] ?? '';
  }

  // Every step-to-step advance proceeds immediately except one: check-out only
  // ever directly follows onboard, and checking a guest out right after
  // onboarding them is unusual enough (most likely a mis-tap) to warrant a guard.
  advanceStatus() {
    const next = this.nextStep();
    if (!next || this.statusUpdating()) return;
    if (this.reservation()?.status === 'onboard' && next.key === 'checkedout') {
      this.checkoutConfirmOpen.set(true);
      return;
    }
    this.doAdvance(next);
  }

  confirmCheckout() {
    this.checkoutConfirmOpen.set(false);
    const next = this.nextStep();
    if (next) this.doAdvance(next);
  }

  private async doAdvance(next: StatusStep) {
    this.statusUpdating.set(true);
    this.statusUpdateError.set(null);
    try {
      const updated = await this.res.changeStatus(this.reservationCode, next.key);
      this.reservation.set(updated);
    } catch (e: any) {
      this.statusUpdateError.set(e?.message ?? this.lang.t('errors.failedChangeStatus'));
    } finally {
      this.statusUpdating.set(false);
    }
  }

  openCommentsSheet() {
    this.menuOpen.set(false);
    this.commentError.set(null);
    this.commentsSheetOpen.set(true);
    // Advances the stored watermark for the *next* load — newCommentIds (this
    // viewing's dots/count) is left untouched so they stay visible while the
    // sheet is open, per the timing decision above.
    markCommentsSeen(this.auth.userId(), this.reservationCode);
    setTimeout(() => this.scrollCommentsToBottom(), 0);
  }

  closeCommentsSheet() {
    this.commentsSheetOpen.set(false);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  async sendComment() {
    const text = this.commentDraft().trim();
    if (!text || this.postingComment()) return;
    this.postingComment.set(true);
    this.commentError.set(null);
    try {
      const updated = await this.res.postComment(this.reservationCode, text, this.auth.name());
      this.reservation.set(updated);
      // Re-advance the watermark past this new comment's own timestamp — it was
      // set to "now" when the sheet opened, which is earlier than a comment
      // posted just afterwards, so without this the poster's own comment would
      // show as unread to themselves next time.
      markCommentsSeen(this.auth.userId(), this.reservationCode);
      this.commentDraft.set('');
      setTimeout(() => this.scrollCommentsToBottom(), 0);
    } catch (e: any) {
      this.commentError.set(e?.message ?? this.lang.t('errors.failedPostComment'));
    } finally {
      this.postingComment.set(false);
    }
  }

  private scrollCommentsToBottom() {
    const el = this.commentsListRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}

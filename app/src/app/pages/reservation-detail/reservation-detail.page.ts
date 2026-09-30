import { Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { ReservationService, pillStatus, pillLabel, STATUS_STEPS, StatusStep, blankTimestampsAfter } from '../../services/reservation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { OptionsService } from '../../services/options.service';
import { PropertySettingsService } from '../../services/property-settings.service';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth';
import { ReservationInterface, ReservationNoteInterface } from '../../models/reservation.interface';
import { GuestInterface } from '../../models/guest.interface';
import { LocalizedDatePipe } from '../../pipes/localized-date.pipe';
import { LocalizedTimePipe } from '../../pipes/localized-time.pipe';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { parseApiInstant, todayInTimeZone } from '../../utils/date';
import { getNotesLastSeen, markNotesSeen } from '../../utils/notes-seen.util';

type NoteType = 'reservation' | 'room';

interface NoteDatePill {
  date: string;
  label: string;
  selected: boolean;
}

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

  // Whether this account uses online check-in (property-settings.service.ts). Drives both
  // the pill text below and statusSteps' filtering/relabeling.
  readonly onlineCheckIn = computed(() => this.propertySettings.onlineCheckIn());

  // The status-change options actually offered. With online check-in: all 4 STATUS_STEPS,
  // as-is. Without it: the real `checkedin` stage is dropped (Reserved/Onboard/Checked-out
  // only), and the remaining "Onboard" row is relabeled to "Check-in"
  // (reservationDetail.statusCheckedIn, the same key the real check-in step uses when it's
  // present) — that account never had a separate check-in stage, so arriving and being
  // onboarded IS what "checking in" means to its staff. Every index-based calculation below
  // (statusIndex, nextStep, hold/revert/connector math) is deliberately computed against
  // THIS list, not the raw STATUS_STEPS constant, so a row's template index `i` always lines
  // up with the row it's actually rendering. The raw `key`/`tsField` driving every
  // lookup/API call are untouched either way; only the displayed labelKey changes.
  readonly statusSteps = computed<StatusStep[]>(() => {
    if (this.onlineCheckIn()) return STATUS_STEPS;
    return STATUS_STEPS
      .filter(s => s.key !== 'checkedin')
      .map(s => (s.key === 'onboard' ? { ...s, labelKey: 'reservationDetail.statusCheckedIn' } : s));
  });

  // FAB action-sheet
  menuOpen = signal(false);

  // Reservation Status timeline sheet
  statusSheetOpen = signal(false);
  statusUpdating = signal(false);
  statusUpdateError = signal<string | null>(null);
  // Inline "how does this work" disclosure — toggled by the small info button pinned
  // to the sheet's bottom-right corner. Reset on close so it never carries over open
  // to the next time the sheet is opened.
  helpOpen = signal(false);

  // Onboard → Check-out guard
  checkoutConfirmOpen = signal(false);

  // Long-press-to-revert on an earlier ("done") timeline step. The hold-progress fill
  // bar is only ever rendered while holdingIndex() matches a row's index — @if creates
  // it fresh on pointerdown and destroys it on release/cancel, which is what gives an
  // early release a full reset rather than a paused-partway bar (no separate "holding"
  // class needed). HOLD_MS must stay in sync with the .hold-progress-fill animation
  // duration in SCSS.
  readonly HOLD_MS = 700;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  holdingIndex = signal<number | null>(null);

  // Confirm guard for reverting AWAY FROM Check-out (undoing a completed stay) — the one
  // highest-stakes revert, mirroring the existing Onboard→Check-out forward guard above.
  // Every other revert (from Check-in or Onboard) fires immediately on hold-completion.
  revertConfirmOpen = signal(false);
  revertConfirmTarget = signal<StatusStep | null>(null);
  // Which row's icon shows the spinner while a revert's changeStatus() call is in
  // flight — the existing spinner condition below only ever covered the "next" row.
  revertingIndex = signal<number | null>(null);

  // Notes sheet
  notesSheetOpen = signal(false);
  noteDraft = signal('');
  postingNote = signal(false);
  noteError = signal<string | null>(null);

  // Which kind of note the composer is currently building — Reservation or Room.
  // Scoped only to the note being typed (per the approved "1b" design) — the list
  // of existing notes above is never filtered by this.
  noteType = signal<NoteType>('reservation');
  // Only meaningful (and only sent) when noteType() === 'reservation'.
  housekeeperVisible = signal(false);
  // Only meaningful (and only sent) when noteType() === 'room' — one pill per
  // calendar date of the stay (arrival_date..departure_date inclusive), none
  // selected by default (staff pick the specific date(s) the note applies to).
  // Rebuilt every time the sheet opens.
  noteDates = signal<NoteDatePill[]>([]);
  readonly canSendNote = computed(() => {
    if (!this.noteDraft().trim() || this.postingNote()) return false;
    if (this.noteType() === 'room') return this.noteDates().some(d => d.selected);
    return true;
  });

  readonly noteTypes: { key: NoteType; labelKey: string }[] = [
    { key: 'reservation', labelKey: 'reservationDetail.reservationTypeSeg' },
    { key: 'room', labelKey: 'reservationDetail.roomTypeSeg' },
  ];

  // Snapshotted once per data load (initial fetch / pull-to-refresh), against the
  // per-user/per-reservation/per-device "last seen" watermark in localStorage —
  // NOT recomputed when the sheet opens/closes, so a note stays flagged "new"
  // for the rest of this page visit even after being viewed (matches "next time
  // the reservation is opened" — the row/dots clear on the *next* load, once
  // openNotesSheet()/sendNote() have advanced the watermark).
  newNoteIds = signal<Set<number>>(new Set());
  readonly newNoteCount = computed(() => this.newNoteIds().size);
  readonly totalNoteCount = computed(() => this.reservation()?.notes.length ?? 0);

  // Swipe-to-delete on a note row. `openNoteId` is the note currently snapped open
  // (delete button revealed) — at most one at a time. `dragNoteId`/`dragOffsetPx`
  // track a gesture in progress; the row bound to `dragNoteId` renders at
  // `dragOffsetPx` live, everything else renders at 0 or -SWIPE_REVEAL_PX depending
  // on whether it's `openNoteId`. `dragAxis` is decided on the first few pixels of
  // movement so a vertical scroll inside the notes list is never hijacked.
  private readonly SWIPE_REVEAL_PX = 76;
  private readonly SWIPE_OPEN_THRESHOLD_PX = 38;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragAxis: 'horizontal' | 'vertical' | null = null;
  dragNoteId = signal<number | null>(null);
  dragOffsetPx = signal(0);
  openNoteId = signal<number | null>(null);
  deletingNoteId = signal<number | null>(null);

  @ViewChild('notesList') notesListRef?: ElementRef<HTMLDivElement>;

  // -1 when the current status isn't one of the 4 flow steps (e.g. cancelled/noshow) —
  // Change Status is hidden entirely in that case (both the FAB item and the pill tap).
  readonly statusIndex = computed(() => {
    const r = this.reservation();
    if (!r) return -1;
    return this.statusSteps().findIndex(s => s.key === r.status);
  });

  readonly inStatusFlow = computed(() => this.statusIndex() >= 0);

  readonly nextStep = computed<StatusStep | null>(() => {
    const steps = this.statusSteps();
    const i = this.statusIndex();
    return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
  });

  // A guest can't board or leave a property before they've arrived — the API already
  // rejects an onboard/checkedout transition while arrival_date is still in the
  // future, this just avoids the round trip. arrival_date is a plain calendar-date
  // string ("YYYY-MM-DD", no timezone of its own), so it's compared against "today"
  // in the property's own timezone, not the device's — same reasoning as
  // buildNoteDatePills' date handling below. Check-in itself is deliberately not
  // gated here — an early/pre-arrival check-in is allowed.
  readonly arrivalIsFuture = computed(() => {
    const r = this.reservation();
    if (!r) return false;
    return r.arrival_date > todayInTimeZone(this.propertySettings.timeZone());
  });

  readonly nextStepBlockedByArrival = computed(() => {
    const next = this.nextStep();
    return !!next && (next.key === 'onboard' || next.key === 'checkedout') && this.arrivalIsFuture();
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
      this.recomputeNewNotes(detail);
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
      this.recomputeNewNotes(detail);
    } catch { /* keep existing data */ }
    (event.target as HTMLIonRefresherElement).complete();
  }

  // First-ever view (no stored watermark) flags every existing note as new —
  // deliberate, per product decision, rather than special-casing a quiet first load.
  private recomputeNewNotes(r: ReservationInterface) {
    const lastSeen = getNotesLastSeen(this.auth.userId(), r.reservation_code);
    const ids = new Set(
      r.notes
        .filter(c => lastSeen == null || parseApiInstant(c.created_datetime) > lastSeen)
        .map(c => c.comment_id),
    );
    this.newNoteIds.set(ids);
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
    this.helpOpen.set(false);
  }

  toggleHelp() {
    this.helpOpen.update(v => !v);
  }

  stepTimestamp(step: StatusStep): string {
    return this.reservation()?.[step.tsField] ?? '';
  }

  // The one row that shows the spinner + "Updating status…" while a change is in
  // flight — the row being advanced-to (forward) or the row being reverted-to
  // (revert). Only ever one row at a time: during a revert, statusIndex() (and so
  // "the next row") still reflects the OLD status until the API call resolves, so
  // without explicitly branching on revertingIndex() both the revert target AND the
  // stale "next" row would show the spinner together.
  isUpdatingRow(i: number): boolean {
    if (!this.statusUpdating()) return false;
    const rev = this.revertingIndex();
    return rev !== null ? i === rev : i === this.statusIndex() + 1;
  }

  // Hides (visibility, not display) a row's own timestamp while its label is
  // temporarily showing something else (the hold's "Reset to X" preview, or the
  // in-flight "Updating status…") — showing a stale timestamp next to either read
  // as confusing/contradictory. Visibility-only so the row keeps its normal height
  // and the sheet doesn't visibly resize/jump as this toggles on and off.
  isTimestampHidden(i: number): boolean {
    return this.holdingIndex() === i || this.revertingIndex() === i;
  }

  // Row label while it's being held — replaces the plain step name with the actual
  // consequence ("Reset to Reserved"), since a progress bar alone didn't tell anyone
  // what letting go would do.
  holdLabel(step: StatusStep): string {
    return this.lang.t('reservationDetail.revertHoldLabel', { status: this.lang.t(step.labelKey) });
  }

  // True for every connector strictly between the held row and the current status —
  // these "drain" from blue to grey during the hold, visualizing the span of history
  // about to be undone. The held row's own connector is included; the current row's
  // is not (nothing below the current status is ever affected).
  isRewinding(i: number): boolean {
    const h = this.holdingIndex();
    return h !== null && i >= h && i < this.statusIndex();
  }

  // Connectors drain in sequence from the bottom (closest to the current status) up
  // to the top (closest to the held target), each getting an equal share of HOLD_MS —
  // so the whole span finishes draining exactly when the hold completes, reading as a
  // single wave traveling backward through the reservation's history.
  connectorDrainDuration(i: number): number {
    const h = this.holdingIndex();
    if (h === null) return this.HOLD_MS;
    const count = this.statusIndex() - h;
    return count > 0 ? this.HOLD_MS / count : this.HOLD_MS;
  }

  connectorDrainDelay(i: number): number {
    const h = this.holdingIndex();
    if (h === null) return 0;
    const count = this.statusIndex() - h;
    if (count <= 0) return 0;
    const distanceFromBottom = this.statusIndex() - 1 - i;
    return distanceFromBottom * (this.HOLD_MS / count);
  }

  // Every step-to-step advance proceeds immediately except one: check-out only
  // ever directly follows onboard, and checking a guest out right after
  // onboarding them is unusual enough (most likely a mis-tap) to warrant a guard.
  advanceStatus() {
    const next = this.nextStep();
    if (!next || this.statusUpdating()) return;
    if (this.nextStepBlockedByArrival()) {
      this.statusUpdateError.set(this.lang.t('reservationDetail.arrivalInFutureError'));
      return;
    }
    if (this.reservation()?.status === 'onboard' && next.key === 'checkedout') {
      this.checkoutConfirmOpen.set(true);
      return;
    }
    this.doChangeStatus(next);
  }

  confirmCheckout() {
    this.checkoutConfirmOpen.set(false);
    const next = this.nextStep();
    if (next) this.doChangeStatus(next);
  }

  // Long-press an earlier ("done") step to revert to it. Guarded to done rows only —
  // the current row (i === statusIndex()) and the tappable next row are both excluded
  // since reverting to either makes no sense (current: no-op; next: that's advanceStatus's job).
  startHold(step: StatusStep, i: number) {
    if (this.statusUpdating() || i >= this.statusIndex()) return;
    this.cancelHold();
    this.holdingIndex.set(i);
    this.holdTimer = setTimeout(() => this.completeHold(step), this.HOLD_MS);
  }

  cancelHold() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.holdingIndex.set(null);
  }

  private async completeHold(step: StatusStep) {
    this.holdTimer = null;
    this.holdingIndex.set(null);
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Native-only; no-op on web/ionic serve.
    }
    if (this.reservation()?.status === 'checkedout') {
      this.revertConfirmTarget.set(step);
      this.revertConfirmOpen.set(true);
      return;
    }
    this.doChangeStatus(step, true);
  }

  cancelRevertConfirm() {
    this.revertConfirmOpen.set(false);
    this.revertConfirmTarget.set(null);
  }

  confirmRevert() {
    const target = this.revertConfirmTarget();
    this.revertConfirmOpen.set(false);
    this.revertConfirmTarget.set(null);
    if (target) this.doChangeStatus(target, true);
  }

  private async doChangeStatus(target: StatusStep, isRevert = false) {
    this.statusUpdating.set(true);
    this.statusUpdateError.set(null);
    // Two different indices on purpose: revertingIndex must match the row index `i` the
    // template is actually iterating over (statusSteps(), possibly narrowed), while
    // blankTimestampsAfter blanks timestamps on the full canonical STATUS_STEPS flow
    // regardless of which steps this property's account shows.
    const displayIndex = this.statusSteps().findIndex(s => s.key === target.key);
    if (isRevert) this.revertingIndex.set(displayIndex);
    try {
      let updated = await this.res.changeStatus(this.reservationCode, target.key);
      if (isRevert) {
        const fullIndex = STATUS_STEPS.findIndex(s => s.key === target.key);
        updated = blankTimestampsAfter(updated, fullIndex);
      }
      this.reservation.set(updated);
    } catch (e: any) {
      this.statusUpdateError.set(e?.message ?? this.lang.t('errors.failedChangeStatus'));
    } finally {
      this.statusUpdating.set(false);
      this.revertingIndex.set(null);
    }
  }

  openNotesSheet() {
    this.menuOpen.set(false);
    this.noteError.set(null);
    this.notesSheetOpen.set(true);
    // Reset the composer to its default state every time the sheet opens —
    // a note left mid-composition from a previous visit shouldn't resurface.
    this.noteType.set('reservation');
    this.housekeeperVisible.set(false);
    this.openNoteId.set(null);
    this.dragNoteId.set(null);
    const r = this.reservation();
    this.noteDates.set(r ? this.buildNoteDatePills(r) : []);
    // Advances the stored watermark for the *next* load — newNoteIds (this
    // viewing's dots/count) is left untouched so they stay visible while the
    // sheet is open, per the timing decision above.
    markNotesSeen(this.auth.userId(), this.reservationCode);
    setTimeout(() => this.scrollNotesToBottom(), 0);
  }

  closeNotesSheet() {
    this.notesSheetOpen.set(false);
    // Dots/count stay visible while the sheet is open (so a viewer can see what
    // was new during this look), but clear immediately on close — waiting for
    // the next full page load to clear the "N New Notes" row read as a bug
    // once seen live, not the intended behavior.
    this.newNoteIds.set(new Set());
    this.openNoteId.set(null);
    this.dragNoteId.set(null);
  }

  setNoteType(t: NoteType) {
    this.noteType.set(t);
  }

  toggleHousekeeper() {
    this.housekeeperVisible.update(v => !v);
  }

  toggleNoteDate(date: string) {
    this.noteDates.update(dates => dates.map(d => (d.date === date ? { ...d, selected: !d.selected } : d)));
  }

  // One pill per calendar date of the stay, arrival_date..departure_date inclusive,
  // none selected by default. Built from the plain "YYYY-MM-DD" calendar strings via
  // Date.UTC (never a local-timezone Date) so the range can't drift by a day for
  // anyone west of UTC — same convention as ReservationService's own date parsing.
  private buildNoteDatePills(r: ReservationInterface): NoteDatePill[] {
    const [ay, am, ad] = r.arrival_date.split('-').map(Number);
    const [dy, dm, dd] = r.departure_date.split('-').map(Number);
    if (!ay || !dy) return [];
    const start = Date.UTC(ay, am - 1, ad);
    const end = Date.UTC(dy, dm - 1, dd);
    if (end < start) return [];
    const pills: NoteDatePill[] = [];
    for (let t = start; t <= end; t += 86_400_000) {
      const d = new Date(t);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
      pills.push({ date, label, selected: false });
    }
    return pills;
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

  async sendNote() {
    const current = this.reservation();
    if (!current || !this.canSendNote()) return;
    const type = this.noteType();
    this.postingNote.set(true);
    this.noteError.set(null);
    try {
      const updated = await this.res.postNote(
        current,
        {
          type,
          comment: this.noteDraft().trim(),
          showForHousekeeper: type === 'reservation' ? this.housekeeperVisible() : undefined,
          commentDates: type === 'room' ? this.noteDates().filter(d => d.selected).map(d => d.date) : undefined,
        },
        this.auth.name(),
      );
      this.reservation.set(updated);
      // Re-advance the watermark past this new note's own timestamp — it was
      // set to "now" when the sheet opened, which is earlier than a note
      // posted just afterwards, so without this the poster's own note would
      // show as unread to themselves next time.
      markNotesSeen(this.auth.userId(), this.reservationCode);
      this.noteDraft.set('');
      setTimeout(() => this.scrollNotesToBottom(), 0);
    } catch (e: any) {
      this.noteError.set(e?.message ?? this.lang.t('errors.failedPostNote'));
    } finally {
      this.postingNote.set(false);
    }
  }

  private scrollNotesToBottom() {
    const el = this.notesListRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Live transform for a note row: mid-gesture it follows the finger, otherwise it's
  // either snapped open (delete button revealed) or closed.
  noteRowTransform(note: ReservationNoteInterface): string {
    if (this.dragNoteId() === note.comment_id) {
      return `translateX(${this.dragOffsetPx()}px)`;
    }
    return `translateX(${this.openNoteId() === note.comment_id ? -this.SWIPE_REVEAL_PX : 0}px)`;
  }

  onNoteTouchStart(e: TouchEvent, note: ReservationNoteInterface) {
    if (this.deletingNoteId() !== null) return;
    const t = e.touches[0];
    this.dragStartX = t.clientX;
    this.dragStartY = t.clientY;
    this.dragAxis = null;
    this.dragNoteId.set(note.comment_id);
    // Start from wherever the row already sits (open or closed) so re-swiping an
    // already-open row to close it tracks the finger continuously.
    this.dragOffsetPx.set(this.openNoteId() === note.comment_id ? -this.SWIPE_REVEAL_PX : 0);
  }

  onNoteTouchMove(e: TouchEvent) {
    const id = this.dragNoteId();
    if (id === null) return;
    const t = e.touches[0];
    const dx = t.clientX - this.dragStartX;
    const dy = t.clientY - this.dragStartY;
    if (this.dragAxis === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      this.dragAxis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (this.dragAxis === 'vertical') {
        // A vertical drag is a list scroll, not a swipe — stop tracking and let the
        // browser handle it natively (no preventDefault was ever called).
        this.dragNoteId.set(null);
        return;
      }
    }
    if (this.dragAxis !== 'horizontal') return;
    e.preventDefault();
    const base = this.openNoteId() === id ? -this.SWIPE_REVEAL_PX : 0;
    const offset = Math.min(0, Math.max(-this.SWIPE_REVEAL_PX - 16, base + dx));
    this.dragOffsetPx.set(offset);
  }

  onNoteTouchEnd(_e: TouchEvent, note: ReservationNoteInterface) {
    if (this.dragNoteId() !== note.comment_id) return;
    const offset = this.dragOffsetPx();
    this.dragNoteId.set(null);
    if (offset <= -this.SWIPE_OPEN_THRESHOLD_PX) {
      this.openNoteId.set(note.comment_id);
    } else if (this.openNoteId() === note.comment_id) {
      this.openNoteId.set(null);
    }
  }

  // Tapping a row (open or not) dismisses whichever row is currently swiped open —
  // this only fires on a genuine tap (a drag that moved the row never produces a
  // click), so it never fights the gesture handlers above.
  closeSwipe() {
    if (this.openNoteId() !== null) this.openNoteId.set(null);
  }

  async deleteNote(note: ReservationNoteInterface) {
    const current = this.reservation();
    if (!current || this.deletingNoteId() !== null) return;
    this.deletingNoteId.set(note.comment_id);
    this.noteError.set(null);
    try {
      const updated = await this.res.deleteNote(current, note);
      this.reservation.set(updated);
      if (this.openNoteId() === note.comment_id) this.openNoteId.set(null);
    } catch (e: any) {
      this.noteError.set(e?.message ?? this.lang.t('errors.failedDeleteNote'));
    } finally {
      this.deletingNoteId.set(null);
    }
  }
}

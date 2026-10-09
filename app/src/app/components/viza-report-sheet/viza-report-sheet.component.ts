import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { GuestInterface } from '../../models/guest.interface';
import { OptionsService } from '../../services/options.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LocalizedDatePipe } from '../../pipes/localized-date.pipe';
import {
  VIZA_FIELD_LABEL_KEYS,
  VizaRequiredField,
  isVizaLocked,
  isVizaNotScanned,
  isVizaSendable,
  missingVizaFields,
  vizaValuesFromGuest,
} from '../../utils/viza';

export interface VizaCard {
  guest: GuestInterface;
  /** scanned/modified — can be ticked and sent. */
  sendable: boolean;
  /** sendable, or not scanned yet (manual entry) — shows the Edit button. */
  editable: boolean;
  missing: VizaRequiredField[];
  /** Any mandatory field filled in — lets a not-yet-scanned card show data entered manually. */
  hasData: boolean;
}

/**
 * Report-to-VIZA bottom sheet: one compact, read-only card per guest; staff tick the cards
 * to send and report them with one button. Selection, sending state and the send error are
 * owned by the parent (ReservationDetailPage) so they survive the edit-screen round trip —
 * this component only owns the inline "Missing: …" message of a blocked card.
 *
 * Rendered by the parent inside an `@if`, outside ion-content (position:fixed must reach
 * the viewport), like CountryPickerSheetComponent.
 */
@Component({
  selector: 'app-viza-report-sheet',
  standalone: true,
  imports: [TranslatePipe, LocalizedDatePipe],
  templateUrl: './viza-report-sheet.component.html',
})
export class VizaReportSheetComponent {
  @Input({ required: true }) set guests(v: GuestInterface[]) { this._guests.set(v ?? []); }
  /** reservation_guest_ids currently ticked. */
  @Input({ required: true }) selected: ReadonlySet<string> = new Set();
  @Input() sending = false;
  @Input() sendError: string | null = null;

  /** A complete, sendable card's checkbox was tapped — the parent flips it. */
  @Output() toggled = new EventEmitter<GuestInterface>();
  /** An incomplete card's checkbox was tapped — it stays unchecked. */
  @Output() blocked = new EventEmitter<{ guest: GuestInterface; missing: VizaRequiredField[] }>();
  @Output() edit = new EventEmitter<{ guest: GuestInterface; missing: VizaRequiredField[] }>();
  @Output() send = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private options = inject(OptionsService);
  private lang = inject(LanguageService);

  private _guests = signal<GuestInterface[]>([]);
  /** The card whose inline "Missing: …" message is showing. */
  blockedId = signal<string | null>(null);

  readonly cards = computed<VizaCard[]>(() =>
    this._guests().map(guest => ({
      guest,
      hasData: Object.values(vizaValuesFromGuest(guest)).some(v => !!(v ?? '').toString().trim()),
      sendable: isVizaSendable(guest.viza_status),
      editable: isVizaSendable(guest.viza_status) || isVizaNotScanned(guest.viza_status),
      missing: missingVizaFields(vizaValuesFromGuest(guest)),
    })),
  );
  /** Anything still left to report or fill in — otherwise the "all reported" message shows. */
  readonly hasUnreported = computed(() => this.cards().some(c => c.editable));

  isLocked = (g: GuestInterface) => isVizaLocked(g.viza_status);

  onCheckbox(card: VizaCard) {
    if (!card.sendable || this.sending) return;
    if (card.missing.length > 0) {
      this.blockedId.set(card.guest.reservation_guest_id);
      this.blocked.emit({ guest: card.guest, missing: card.missing });
      return;
    }
    this.blockedId.set(null);
    this.toggled.emit(card.guest);
  }

  onEdit(card: VizaCard) {
    if (this.sending) return;
    this.edit.emit({ guest: card.guest, missing: card.missing });
  }

  close() {
    if (this.sending) return;
    this.closed.emit();
  }

  missingMessage(missing: VizaRequiredField[]): string {
    const fields = missing.map(f => this.lang.t(VIZA_FIELD_LABEL_KEYS[f]).toLowerCase()).join(', ');
    return this.lang.t('viza.missingEditFirst', { fields });
  }

  sendLabel(): string {
    const n = this.selected.size;
    return n === 1 ? this.lang.t('viza.sendButtonOne') : this.lang.t('viza.sendButton', { n });
  }

  guestName(g: GuestInterface): string {
    return `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() || '—';
  }

  countryName(code: string | null | undefined): string {
    if (!code) return '';
    return this.options.countries().find(c => c.country_code === code)?.name ?? code;
  }

  genderLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.options.genders().find(g => g.value === value)?.label ?? value;
  }

  documentTypeLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.options.documentTypes().find(d => d.value === value)?.label ?? value;
  }
}

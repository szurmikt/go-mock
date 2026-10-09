import { Component, OnDestroy, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import * as Sentry from '@sentry/angular';
import { IonContent } from '@ionic/angular/standalone';
import { ReservationService } from '../../services/reservation';
import { GuestInterface } from '../../models/guest.interface';
import { OptionsService } from '../../services/options.service';
import { PropertySettingsService } from '../../services/property-settings.service';
import { DocuscanService } from 'src/app/services/docuscan';
import { ExternalResultService } from '../../idscanly/services/external-result.service';
import { MixpanelService } from '../../services/mixpanel';
import { AuthService } from '../../services/auth';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { toInputDate } from '../../utils/date';
import { BusyGuardService } from '../../services/busy-guard';
import { CountryUsageService } from '../../services/country-usage.service';
import { CountryPickerSheetComponent } from '../../components/country-picker-sheet/country-picker-sheet.component';
import { VIZA_FIELD_LABEL_KEYS, VIZA_REQUIRED_FIELDS, VizaRequiredField, missingVizaFields } from '../../utils/viza';

type CountryField = 'citizenship' | 'country_code';

/** Busy-guard key: an unsaved edit must not be discarded by a live-update reload. */
const EDIT_BUSY_KEY = 'guest-edit-dirty';

@Component({
  selector: 'app-guest-edit',
  templateUrl: './guest-edit.page.html',
  styleUrls: ['./guest-edit.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, TranslatePipe, CountryPickerSheetComponent],
})
export class GuestEditPage implements OnInit, OnDestroy {
  private docuscanService = inject(DocuscanService);
  private externalResult = inject(ExternalResultService);
  private busyGuard = inject(BusyGuardService);
  private propertySettings = inject(PropertySettingsService);
  countryUsage = inject(CountryUsageService);

  // Only shown when the current property's scan_fields (GET /properties/settings) actually
  // lists this field — it's TR-specific and most properties never have it configured.
  showTurkishIdField = computed(() =>
    this.propertySettings.scanFields().some(f => f.name === 'turkish_republic_identity_number'),
  );

  guest = signal<GuestInterface | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  saveError = signal<string | null>(null);
  /** Which country field's picker sheet is open (null = closed). */
  countryPicker = signal<CountryField | null>(null);

  /**
   * VIZA mode (`?mode=viza`, opened from the Report-to-VIZA sheet): only the VIZA fields
   * are shown and the mandatory ones block saving. Same form, same save path — the full
   * guest is still loaded and re-sent, so the hidden fields are preserved untouched.
   */
  vizaMode = signal(false);
  /** Mandatory fields to highlight while empty — from `?missing=`, then all of them after a blocked save. */
  private vizaHighlight = signal<ReadonlySet<VizaRequiredField>>(new Set());
  private vizaSaved = false;

  // form model — flat, two-way bound
  form = {
    first_name: '',
    last_name: '',
    maiden_name: '',
    mother_name: '',
    birth_date: '',
    birth_place: '',
    citizenship: '',
    gender: '',
    phone_number: '',
    email: '',
    zip: '',
    city: '',
    country_code: '',
    address_line: '',
    document_type: '',
    document_number: '',
    turkish_republic_identity_number: '',
  };

  private reservationCode!: string;
  private guestId!: string;

  // Analytics: whether this edit was prefilled from a scan, and a snapshot of the
  // (possibly scan-prefilled) form so save() can count how many fields changed.
  private fromScan = false;
  private formSnapshot: Record<string, string> = {};

  // IDScanly feedback loop: set only when this edit was prefilled by an IDScanly scan, so
  // save() can post the corrected values back to that scan's session. A plain manual edit
  // leaves these untouched, and the feedback call then no-ops.
  private idscanlySessionId: string | undefined;
  private scanWasIdentityDoc = true;

  /** Whether this form currently holds the busy guard (see markDirty). */
  private dirty = false;

  constructor(
    private route: ActivatedRoute,
    private res: ReservationService,
    public options: OptionsService,
    private mixpanel: MixpanelService,
    private auth: AuthService,
    private lang: LanguageService,
  ) {}

  async ngOnInit() {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('mode') === 'viza') {
      this.vizaMode.set(true);
      const missing = (qp.get('missing') ?? '')
        .split(',')
        .filter((f): f is VizaRequiredField => (VIZA_REQUIRED_FIELDS as readonly string[]).includes(f));
      this.vizaHighlight.set(new Set(missing));
    }

    try {
      // Force a fresh fetch so the edit form always starts from the latest server copy
      // (bypasses the 60s SWR window) — guards against editing/overwriting a stale guest.
      const guests = await this.res.fetchGuests(this.reservationCode, true);
      const found = guests.find(
        (g: GuestInterface) => g.reservation_guest_id === this.guestId,
      );
      if (!found) {
        this.error.set(this.lang.t('errors.guestNotFound'));
        return;
      }
      this.guest.set(found);
      this.form = {
        first_name: found.first_name ?? '',
        last_name: found.last_name ?? '',
        maiden_name: found.maiden_name ?? '',
        mother_name: found.mother_name ?? '',
        birth_date: found.birth_date ?? '',
        birth_place: found.birth_place ?? '',
        citizenship: found.citizenship ?? '',
        gender: found.gender ?? '',
        phone_number: found.phone_number ?? '',
        email: found.email ?? '',
        zip: found.address?.zip ?? '',
        city: found.address?.city ?? '',
        country_code: found.address?.country_code ?? '',
        address_line: found.address?.address_line ?? '',
        document_type: found.document?.document_type ?? '',
        document_number: found.document?.document_number ?? '',
        turkish_republic_identity_number:
          found.document?.turkish_republic_identity_number ?? '',
      };
      // VIZA mode edits the guest record as stored — never prefill from a (possibly
      // unrelated, earlier) scan result still held in memory.
      const last = this.vizaMode() ? null : this.docuscanService.lastScanResult;
      // TEMPORARY diagnostics (2026-09-08) for a reported "Edit kicks the user to Home"
      // bug that only reproduces when the scan carried address data, with nothing captured
      // in Sentry so far — remove once root-caused. Unconditional (not gated on
      // extendedLogging) so the next repro is guaranteed to leave a trace.
      Sentry.addBreadcrumb({
        category: 'guest_edit',
        message: 'ngOnInit: scan prefill check',
        level: 'info',
        data: {
          hasLastScanResult: last != null,
          hasScannedData: last?.scannedData != null,
          isIdentityDocument: last?.documentData?.is_identity_document,
        },
      });
      if (last != null && last.scannedData != null) {
        this.fromScan = true;
        const isIdentityDoc = last.documentData?.is_identity_document !== false;
        this.idscanlySessionId = last.sessionId;
        this.scanWasIdentityDoc = isIdentityDoc;
        const scanned = this.docuscanService.scannedDataToGuestScannedData(
          last.scannedData!,
        );
        Sentry.addBreadcrumb({
          category: 'guest_edit',
          message: 'ngOnInit: scannedDataToGuestScannedData done',
          level: 'info',
          data: { hasAddress: scanned.address != null, isIdentityDoc },
        });
        // Only an identity scan marks the guest as scanned. For an address card we leave
        // found.scanned_data at its fetched value (real ID record or null), so save()'s
        // `...g` spread sends the POST /guest scanned_data section unchanged.
        if (isIdentityDoc) {
          found.scanned_data = scanned;
        }
        const sd = isIdentityDoc ? found.scanned_data : scanned;
        if (sd) {
          this.form.first_name = sd.first_name ?? this.form.first_name;
          this.form.last_name = sd.last_name ?? this.form.last_name;
          this.form.maiden_name = sd.maiden_name ?? this.form.maiden_name;
          this.form.mother_name = sd.mother_name ?? this.form.mother_name;
          // Normalize to strict YYYY-MM-DD: <input type="date"> silently rejects
          // any other shape, leaving the field blank.
          this.form.birth_date =
            toInputDate(sd.birth_date) || this.form.birth_date;
          this.form.birth_place = sd.birth_place ?? this.form.birth_place;
          this.form.citizenship = sd.citizenship ?? this.form.citizenship;
          this.form.gender = (sd.gender ?? this.form.gender).toLowerCase();
          this.form.document_type = (
            sd.document?.document_type ?? this.form.document_type
          ).toLowerCase();
          this.form.document_number =
            sd.document?.document_number ?? this.form.document_number;
          this.form.turkish_republic_identity_number =
            sd.document?.turkish_republic_identity_number ??
            this.form.turkish_republic_identity_number;
          // Prefill the address fields too, when the scan carried any — nested under
          // scanned_data.address by scannedDataToGuestScannedData. Populated for an address
          // card (lakcímkártya, which captures address only) and optionally for an identity
          // document that happens to embed one; absent otherwise, so this keeps the existing
          // values then.
          const addr = sd.address;
          if (addr) {
            this.form.zip = addr.zip ?? this.form.zip;
            this.form.city = addr.city ?? this.form.city;
            this.form.country_code = addr.country_code ?? this.form.country_code;
            this.form.address_line = addr.address_line ?? this.form.address_line;
          }
          Sentry.addBreadcrumb({
            category: 'guest_edit',
            message: 'ngOnInit: form prefilled from scan',
            level: 'info',
            data: { hadAddr: !!addr },
          });
        }
      }
      // Snapshot the (possibly scan-prefilled) form so save() can count changes.
      this.formSnapshot = { ...this.form };
      Sentry.addBreadcrumb({
        category: 'guest_edit',
        message: 'ngOnInit: completed successfully',
        level: 'info',
      });
    } catch (e: any) {
      // Previously local-only (no Sentry visibility at all) — this is a real gap on its
      // own, independent of the bug above: any exception here was silently invisible.
      Sentry.captureException(e, {
        tags: { context: 'guest_edit_ngOnInit' },
        extra: { reservationCode: this.reservationCode, guestId: this.guestId },
      });
      this.error.set(e.message ?? this.lang.t('errors.failedLoadGuest'));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Bound to every field's (ngModelChange). Claims the busy guard on the first real edit so a
   * live-update reload can't discard unsaved changes. Idempotent — after the first call this is
   * a boolean check.
   */
  markDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.busyGuard.acquire(EDIT_BUSY_KEY);
  }

  openCountryPicker(field: CountryField): void {
    this.countryPicker.set(field);
  }

  pickCountry(field: CountryField, code: string): void {
    if (this.form[field] !== code) {
      this.form[field] = code;
      this.markDirty();
    }
    this.countryPicker.set(null);
  }

  /** Display name for a stored country code; falls back to the raw code if it isn't in the options list. */
  countryName(code: string): string {
    if (!code) return '';
    return this.options.countries().find(c => c.country_code === code)?.name ?? code;
  }

  private clearDirty(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.busyGuard.release(EDIT_BUSY_KEY);
  }

  /** Template: highlight a mandatory VIZA field while it is still empty. */
  vizaFieldError(field: VizaRequiredField): boolean {
    return this.vizaMode() && this.vizaHighlight().has(field) && missingVizaFields(this.form).includes(field);
  }

  private changedFieldNames(): string[] {
    return Object.keys(this.form).filter(
      k => (this.form as Record<string, string>)[k] !== (this.formSnapshot[k] ?? ''),
    );
  }

  async save() {
    const g = this.guest();
    if (!g) return;
    if (this.vizaMode()) {
      const missing = missingVizaFields(this.form);
      if (missing.length > 0) {
        this.vizaHighlight.set(new Set(VIZA_REQUIRED_FIELDS));
        const fields = missing.map(f => this.lang.t(VIZA_FIELD_LABEL_KEYS[f]).toLowerCase()).join(', ');
        this.saveError.set(this.lang.t('viza.requiredMissing', { fields }));
        return;
      }
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const updated: GuestInterface = {
        ...g,
        first_name: this.form.first_name,
        last_name: this.form.last_name,
        maiden_name: this.form.maiden_name,
        mother_name: this.form.mother_name,
        birth_date: this.form.birth_date,
        birth_place: this.form.birth_place,
        citizenship: this.form.citizenship,
        gender: this.form.gender,
        phone_number: this.form.phone_number,
        email: this.form.email,
        address: {
          country_code: this.form.country_code,
          zip: this.form.zip,
          city: this.form.city,
          address_line: this.form.address_line,
        },
        document: {
          document_type: this.form.document_type,
          document_number: this.form.document_number,
          date_of_issue_of_the_document:
            g.document?.date_of_issue_of_the_document ?? '',
          turkish_republic_identity_number:
            this.form.turkish_republic_identity_number || null,
        },
      };
      await this.res.updateGuest(this.reservationCode, updated);
      // Popularity counts for the country pickers' top-10 section — compared against the
      // fetched server copy, so a scan-prefilled country that gets saved counts as a change.
      this.countryUsage.record('citizenship', g.citizenship, this.form.citizenship);
      this.countryUsage.record('country_code', g.address?.country_code, this.form.country_code);
      const changedFields = this.changedFieldNames();
      const fieldsChanged = changedFields.length;
      if (this.vizaMode()) {
        this.vizaSaved = true;
        this.mixpanel.trackVizaEditSaved({
          reservation_code: this.reservationCode,
          property_id: this.auth.selectedProperty()?.property_id,
          changed_fields: changedFields,
          changed_count: fieldsChanged,
          now_complete: missingVizaFields(this.form).length === 0,
          success: true,
        });
      }
      this.mixpanel.trackGuestUpdated({
        reservation_code: this.reservationCode,
        property_id: this.auth.selectedProperty()?.property_id,
        from_scan: this.fromScan,
        fields_changed: fieldsChanged,
      });
      // Feedback loop: hand IDScanly the corrected values the user actually saved, so they
      // can measure OCR accuracy. Fire-and-forget — never blocks or fails the save.
      this.externalResult.submitInBackground(
        this.idscanlySessionId,
        updated,
        this.reservationCode,
        this.scanWasIdentityDoc,
      );
      // Saved — nothing left to protect from a reload.
      this.clearDirty();
      // Pop the edit entry to return to the EXISTING guest-detail history entry.
      // navigate('..', { replaceUrl }) turned gd→edit into gd→gd, so the first
      // back-press on guest-detail appeared to do nothing. Guest-detail re-fetches
      // in ionViewWillEnter, so the saved data shows regardless.
      this.back();
    } catch (e: any) {
      this.saveError.set(e.message ?? this.lang.t('errors.failedSave'));
      if (this.vizaMode()) {
        this.mixpanel.trackVizaEditSaved({
          reservation_code: this.reservationCode,
          property_id: this.auth.selectedProperty()?.property_id,
          changed_fields: this.changedFieldNames(),
          changed_count: this.changedFieldNames().length,
          now_complete: missingVizaFields(this.form).length === 0,
          success: false,
        });
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Covers abandoning a dirty edit (back-navigation without saving) — never leak the guard. */
  ngOnDestroy(): void {
    if (this.vizaMode() && !this.vizaSaved && this.guest()) {
      this.mixpanel.trackVizaEditAbandoned({
        reservation_code: this.reservationCode,
        property_id: this.auth.selectedProperty()?.property_id,
        had_changes: this.changedFieldNames().length > 0,
      });
    }
    this.clearDirty();
  }

  back() {
    window.history.back();
  }

  isScannedSource(field: 'first_name' | 'last_name' | 'maiden_name' | 'mother_name'): boolean {
    const scanned = this.guest()?.scanned_data?.[field];
    if (!scanned) return false;
    return this.form[field] === scanned;
  }
}

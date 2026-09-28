import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { ViewWillEnter } from '@ionic/angular';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { ReservationService } from '../../services/reservation';
import { OptionsService } from '../../services/options.service';
import { DocuscanService } from '../../services/docuscan';
import { MixpanelService } from '../../services/mixpanel';
import { PropertyConfigService } from '../../services/property-config.service';
import { PropertySettingsService } from '../../services/property-settings.service';
import { CaptureSessionService } from '../../idscanly/services/capture-session.service';
import { ExternalResultService } from '../../idscanly/services/external-result.service';
import { DocumentTypeId, resolveScanEntryType } from '../../idscanly/models/document-type';
import { CapturePreferenceService } from '../../idscanly/services/capture-preference.service';
import { GuestInterface, ScanResultInterface } from '../../models/guest.interface';
import { LocalizedDatePipe } from '../../pipes/localized-date.pipe';
import { DashIfEmptyPipe } from '../../pipes/dash-if-empty.pipe';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import * as Sentry from '@sentry/angular';

type ScanSheetMode = 'loading' | 'result';

const MOCK_SCAN_RESULT: ScanResultInterface = {
  documentData: {
    document_type: 'passport',
    scan_type: 'ocr',
    date_of_issue: '2018-03-15',
    message: '',
  },
  scannedData: {
    first_name:      { value: 'János',       formatted_value: 'János',       modified: false },
    last_name:       { value: 'Kovács',      formatted_value: 'Kovács',      modified: false },
    birth_date:      { value: '1985-06-22',  formatted_value: '1985-06-22',  modified: false },
    birth_place:     { value: 'Budapest',    formatted_value: 'Budapest',    modified: false },
    gender:          { value: 'Male',        formatted_value: 'Male',        modified: false },
    citizenship:     { value: 'HUN',         formatted_value: 'HUN',         modified: false },
    age:             { value: 39,            formatted_value: '39',          modified: false },
    mother_name:     { value: 'Szabó Mária', formatted_value: 'Szabó Mária', modified: false },
    document_number: { value: 'AB1234567',   formatted_value: 'AB1234567',   modified: false },
    // Address-card (lakcímkártya) fields — present here so the result sheet's
    // address section is previewable in-browser (?previewScanSheet=result).
    address_country_code: { value: 'HUN',              formatted_value: 'HUN',              modified: false },
    address_zip:          { value: '6100',             formatted_value: '6100',             modified: false },
    address_city:         { value: 'Kiskunfélegyháza', formatted_value: 'Kiskunfélegyháza', modified: false },
    address_line:         { value: 'Kiskun utca 13',   formatted_value: 'Kiskun utca 13',   modified: false },
  },
};

@Component({
  selector: 'app-guest-detail',
  templateUrl: './guest-detail.page.html',
  styleUrls: ['./guest-detail.page.scss'],
  standalone: true,
  imports: [IonContent, IonSpinner, TitleCasePipe, LocalizedDatePipe, DashIfEmptyPipe, TranslatePipe],
})
export class GuestDetailPage implements OnInit, OnDestroy, ViewWillEnter {
  guest = signal<GuestInterface | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  menuOpen = signal(false);

  scanSheetOpen = signal(false);
  scanSheetMode = signal<ScanSheetMode>('loading');
  scanSaving = signal(false);
  scanSaveError = signal<string | null>(null);
  private _previewScanResult = signal<ScanResultInterface | null>(null);
  private _idscanlyResult = signal<ScanResultInterface | null>(null);

  readonly scanSheetTitle = computed(() => {
    if (this.scanSheetMode() === 'result') return this.lang.t('guestDetail.scanResult');
    return this.lang.t('guestDetail.scanDocument');
  });

  readonly scanResult = computed(() => this._idscanlyResult() ?? this._previewScanResult());

  // Only shown when the current property's scan_fields (GET /properties/settings) actually
  // lists this field — it's TR-specific and most properties never have it configured.
  readonly showTurkishIdField = computed(() =>
    this.propertySettings.scanFields().some(f => f.name === 'turkish_republic_identity_number'),
  );

  private reservationCode!: string;
  private guestId!: string;

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private res: ReservationService,
    private options: OptionsService,
    private docuscan: DocuscanService,
    private mixpanel: MixpanelService,
    private lang: LanguageService,
    public propertyConfig: PropertyConfigService,
    private propertySettings: PropertySettingsService,
    private captureSession: CaptureSessionService,
    private externalResult: ExternalResultService,
    private capturePreference: CapturePreferenceService,
  ) {}

  ngOnInit() {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;

    const preview = this.route.snapshot.queryParamMap.get('previewScanSheet');
    if (preview === 'result') {
      this._previewScanResult.set(MOCK_SCAN_RESULT);
      this.scanSheetMode.set('result');
      this.scanSheetOpen.set(true);
    }

    // Shortcut from the reservation-detail guest card: jump straight into the
    // scan flow's document-type selection instead of requiring a FAB tap.
    if (this.route.snapshot.queryParamMap.get('autoScan') === '1') {
      this.openScanDocument('guest_card');
    }
  }

  ionViewWillEnter() {
    // Consume an IDScanly result left by the review page before re-entering this view.
    const idResult = this.captureSession.scanResult();
    if (idResult) {
      this._idscanlyResult.set(idResult);
      this.captureSession.clearScanResult();
      this.scanSaveError.set(null);
      this.scanSheetMode.set('result');
      this.scanSheetOpen.set(true);
    }
    this.loadGuest();
  }

  private async loadGuest() {
    // Stale-while-revalidate: paint the cached guest instantly, then refresh silently.
    // Only show the spinner (which blanks the screen) when there's nothing to show yet.
    const peeked = this.res.peekGuests(this.reservationCode)
      ?.find(g => g.reservation_guest_id === this.guestId);
    if (peeked) this.guest.set(peeked);

    const firstLoad = !this.guest();
    if (firstLoad) {
      this.loading.set(true);
      this.error.set(null);
    }
    try {
      const guests = await this.res.fetchGuests(this.reservationCode);
      const found = guests.find(g => g.reservation_guest_id === this.guestId);
      this.guest.set(found ?? null);
      if (!found) this.error.set(this.lang.t('errors.guestNotFound'));
    } catch (e: any) {
      if (firstLoad) this.error.set(e.message ?? this.lang.t('errors.failedLoadGuest'));
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    window.history.back();
  }

  ngOnDestroy() {
    this.timeouts.forEach(clearTimeout);
  }

  goEdit() {
    this.menuOpen.set(false);
    this.t(() => this.router.navigate(['/guest', this.reservationCode, this.guestId, 'edit']), 300);
  }

  cancelScanSheet() {
    if (this.scanSaving()) return;
    this.scanSheetOpen.set(false);
    this.scanSheetMode.set('loading');
    this.scanSaveError.set(null);
    this._previewScanResult.set(null);
    this._idscanlyResult.set(null);
  }

  /**
   * Opens the scan document flow — resolves straight to the camera via the remembered
   * Card/Passport bucket, with no intermediate document-type picker screen.
   */
  openScanDocument(source: 'guest_card' | 'fab_menu' = 'fab_menu') {
    this.menuOpen.set(false);
    const allowed = this.propertyConfig.scanDocTypes() as DocumentTypeId[];
    const type = resolveScanEntryType(this.capturePreference.bucket(), allowed);
    this.captureSession.start(type);
    this.captureSession.context.set({ reservationCode: this.reservationCode, guestId: this.guestId });
    this.mixpanel.trackScanStarted({
      vendor: 'idscanly',
      document_type: type.id,
      source,
    });
    void this.router.navigate(['/idscanly/scan']);
  }

  scanFullName(): string {
    const data = this.scanResult()?.scannedData;
    const first = (data?.['first_name']?.['value'] ?? '') as string;
    const last = (data?.['last_name']?.['value'] ?? '') as string;
    return `${first} ${last}`.trim();
  }

  processScanResult(action: 'edit' | 'save'): void {
    const result = this.scanResult();
    const isPreview = this._previewScanResult() !== null;

    if (isPreview) {
      this.scanSheetOpen.set(false);
      this.scanSheetMode.set('loading');
      this._previewScanResult.set(null);
      if (action === 'edit') {
        this.t(
          () => this.router.navigate(['/guest', this.reservationCode, this.guestId, 'edit']),
          300,
        );
      }
      return;
    }

    this.docuscan.lastScanResult = result;

    if (action === 'edit') {
      // TEMPORARY diagnostics (2026-09-08) — see matching comment in guest-edit.page.ts.
      const hasAddress = !!(
        result?.scannedData?.['address_line']?.['value'] ||
        result?.scannedData?.['address_country_code']?.['value']
      );
      Sentry.addBreadcrumb({
        category: 'guest_edit',
        message: 'processScanResult(edit): navigating',
        level: 'info',
        data: {
          isIdentityDocument: result?.documentData?.is_identity_document,
          hasAddress,
        },
      });
      this.mixpanel.trackScanResultEdited({
        document_type: result?.documentData?.document_type ?? undefined,
      });
      this.scanSheetOpen.set(false);
      this.scanSheetMode.set('loading');
      this._idscanlyResult.set(null);
      this.t(() => {
        this.router
          .navigate(['/guest', this.reservationCode, this.guestId, 'edit'])
          .then(ok => {
            Sentry.addBreadcrumb({
              category: 'guest_edit',
              message: 'processScanResult(edit): navigate() resolved',
              level: ok ? 'info' : 'warning',
              data: { ok, hasAddress },
            });
            if (!ok) {
              Sentry.captureMessage('guest-edit navigation returned false', {
                level: 'warning',
                tags: { context: 'guest_edit_navigate' },
                extra: { hasAddress },
              });
            }
          })
          .catch(err => {
            Sentry.captureException(err, {
              tags: { context: 'guest_edit_navigate' },
              extra: { hasAddress },
            });
          });
      }, 300);
      return;
    }

    const guest = this.guest();
    if (!guest) return;

    const isIdentityDoc = result?.documentData?.is_identity_document !== false;

    if (result?.scannedData) {
      if (isIdentityDoc) {
        guest.scanned_data = this.docuscan.scannedDataToGuestScannedData(result.scannedData);
        this.docuscan.fillGuestDataFromScannedData(guest);
      } else {
        // Address card: reuse the per-field address merge, then restore the original
        // scanned_data — an address card is not a scanned ID document, so the POST /guest
        // scanned_data section must stay exactly as the guest already had it.
        const original = guest.scanned_data;
        guest.scanned_data = this.docuscan.scannedDataToGuestScannedData(result.scannedData);
        this.docuscan.fillGuestDataFromScannedData(guest); // touches only guest.address
        guest.scanned_data = original;
      }
    }
    this.guest.set(guest);

    // Without the catch, a rejected save left the sheet open forever with no feedback
    // (and the API's rejection surfaced nowhere) — the error must land in the sheet.
    this.scanSaving.set(true);
    this.scanSaveError.set(null);
    this.res.updateGuest(this.reservationCode, guest)
      .then(() => {
        this.mixpanel.trackScanResultSaved({
          document_type: result?.documentData?.document_type ?? undefined,
        });
        // Feedback loop: hand IDScanly the values the user actually accepted, so they can
        // measure OCR accuracy. Fire-and-forget — never blocks or fails the save.
        this.externalResult.submitInBackground(
          result?.sessionId,
          guest,
          this.reservationCode,
          isIdentityDoc,
        );
        this.docuscan.lastScanResult = null;
        this._idscanlyResult.set(null);
        this.scanSheetOpen.set(false);
        this.scanSheetMode.set('loading');
        this.loadGuest();
      })
      .catch((e: any) => {
        this.scanSaveError.set(e?.message ?? this.lang.t('errors.failedSave'));
      })
      .finally(() => this.scanSaving.set(false));
  }

  guestName(g: GuestInterface): string {
    return `${g.first_name} ${g.last_name}`.trim();
  }

  countryName(code: string | null | undefined): string {
    if (!code) return '';
    const match = this.options.countries().find(c => c.country_code === code);
    return match?.name ?? code;
  }

  citizenshipName(code: string | null | undefined): string {
    return this.countryName(code);
  }

  docTypeName(type: string): string {
    const map: Record<string, string> = {
      passport: 'Passport',
      idcard: 'ID Card',
      id_card: 'ID Card',
      identity_card: 'ID Card',
      identitycard: 'ID Card',
      drivinglicence: 'Driving Licence',
      driving_licence: 'Driving Licence',
      driving_license: 'Driving Licence',
      residencepermit: 'Residence Permit',
      residence_permit: 'Residence Permit',
      addresscard: 'Address Card',
      address_card: 'Address Card',
    };
    return map[type?.toLowerCase()] ?? type ?? '—';
  }
}

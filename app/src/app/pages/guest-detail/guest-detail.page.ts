import { Component, OnInit, OnDestroy, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { ViewWillEnter } from '@ionic/angular';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { ReservationService } from '../../services/reservation';
import { DocumentReaderService, ReaderStatus } from '../../regula/services/document-reader.service';
import { OptionsService } from '../../services/options.service';
import { DocuscanService } from '../../regula/services/docuscan';
import { MixpanelService } from '../../services/mixpanel';
import { PropertyConfigService } from '../../services/property-config.service';
import { CaptureSessionService } from '../../idscanly/services/capture-session.service';
import { DOCUMENT_TYPES, DocumentTypeConfig } from '../../idscanly/models/document-type';
import { GuestInterface, ScanResultInterface } from '../../models/guest.interface';
import { LocalizedDatePipe } from '../../pipes/localized-date.pipe';
import { DashIfEmptyPipe } from '../../pipes/dash-if-empty.pipe';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

type ScanPreviewMode = 'starting' | 'loading' | 'result' | 'timeout' | 'cancelled' | 'interrupted';
type ScanSheetMode = 'loading' | 'result' | 'failed';

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
  failedStatus = signal<ReaderStatus | null>(null);
  docTypeSheetOpen = signal(false);
  private awaitingScanResult = signal(false);
  private previewMessageMode = signal<ScanPreviewMode | null>(null);
  private _previewScanResult = signal<ScanResultInterface | null>(null);
  private _previewFailed = signal(false);
  private _idscanlyResult = signal<ScanResultInterface | null>(null);

  readonly scanSheetMessage = computed(() => {
    const override = this.previewMessageMode();
    if (override === 'loading') return this.lang.t('guestDetail.scanLoadingDb');
    if (override === 'starting') return this.lang.t('guestDetail.scanStarting');
    return this.documentReader.readerStatus() === ReaderStatus.INIT
      ? this.lang.t('guestDetail.scanLoadingDb')
      : this.lang.t('guestDetail.scanStarting');
  });

  readonly scanSheetTitle = computed(() => {
    const mode = this.scanSheetMode();
    if (mode === 'result') return this.lang.t('guestDetail.scanResult');
    if (mode === 'failed') {
      switch (this.failedStatus()) {
        case ReaderStatus.TIMEOUT:     return this.lang.t('guestDetail.scanTimedOut');
        case ReaderStatus.CANCELLED:   return this.lang.t('guestDetail.scanCancelled');
        case ReaderStatus.INTERRUPTED: return this.lang.t('guestDetail.scanInterrupted');
        default:                       return this.lang.t('guestDetail.scanFailed');
      }
    }
    return this.lang.t('guestDetail.scanDocument');
  });

  readonly scanResult = computed(
    () => this._idscanlyResult() ?? this._previewScanResult() ?? this.documentReader.scanResult(),
  );

  readonly availableDocTypes = computed(() => {
    const allowed = this.propertyConfig.scanDocTypes();
    if (!allowed.length) return DOCUMENT_TYPES;
    return DOCUMENT_TYPES.filter(t => allowed.includes(t.id));
  });

  private reservationCode!: string;
  private guestId!: string;

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private res: ReservationService,
    private documentReader: DocumentReaderService,
    private options: OptionsService,
    private docuscan: DocuscanService,
    private mixpanel: MixpanelService,
    private lang: LanguageService,
    public propertyConfig: PropertyConfigService,
    private captureSession: CaptureSessionService,
  ) {
    effect(() => {
      if (!this.awaitingScanResult()) return;
      const status = this.documentReader.readerStatus();

      // Only show the result sheet when this scan actually produced data. Guards against
      // an empty/stale FINISHED surfacing a previous document's preview.
      if (
        status === ReaderStatus.FINISHED &&
        this.documentReader.scanResult()?.scannedData != null
      ) {
        this.awaitingScanResult.set(false);
        this.scanSheetMode.set('result');
        return;
      }

      const failed =
        status === ReaderStatus.TIMEOUT ||
        status === ReaderStatus.CANCELLED ||
        status === ReaderStatus.INTERRUPTED;
      if (!failed) return;

      this.awaitingScanResult.set(false);
      this.failedStatus.set(status);
      this.scanSheetMode.set('failed');
    });
  }

  ngOnInit() {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;

    const preview = this.route.snapshot.queryParamMap.get('previewScanSheet');
    if (preview === 'starting' || preview === 'loading') {
      this.previewMessageMode.set(preview);
      this.scanSheetMode.set('loading');
      this.scanSheetOpen.set(true);
    } else if (preview === 'result') {
      this._previewScanResult.set(MOCK_SCAN_RESULT);
      this.scanSheetMode.set('result');
      this.scanSheetOpen.set(true);
    } else if (preview === 'timeout' || preview === 'cancelled' || preview === 'interrupted') {
      const statusMap: Record<string, ReaderStatus> = {
        timeout:     ReaderStatus.TIMEOUT,
        cancelled:   ReaderStatus.CANCELLED,
        interrupted: ReaderStatus.INTERRUPTED,
      };
      this.failedStatus.set(statusMap[preview]);
      this._previewFailed.set(true);
      this.scanSheetMode.set('failed');
      this.scanSheetOpen.set(true);
    }
  }

  ionViewWillEnter() {
    // Consume an IDScanly result left by the review page before re-entering this view.
    const idResult = this.captureSession.scanResult();
    if (idResult) {
      this._idscanlyResult.set(idResult);
      this.captureSession.clearScanResult();
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

  async goScan() {
    this.menuOpen.set(false);
    // Guarantee a 100% clean start: wipe any prior scan's pages/result data and the
    // leftover edit-prefill payload BEFORE arming the result watcher, so a stale
    // session can't surface the previous document's data on this new scan.
    this.documentReader.resetScanSession();
    this.docuscan.lastScanResult = null;
    this.scanSheetMode.set('loading');
    this._previewScanResult.set(null);
    this._previewFailed.set(false);
    this.failedStatus.set(null);
    this.scanSheetOpen.set(true);
    try {
      await this.documentReader.init();
      this.awaitingScanResult.set(true);
      this.documentReader.scan();
    } catch (e) {
      console.error('GuestDetailPage goScan init failed', e);
      this.scanSheetOpen.set(false);
      this.awaitingScanResult.set(false);
      this.router.navigate(['/guest', this.reservationCode, this.guestId, 'scan']);
    }
  }

  scanAgain() {
    if (this._previewFailed()) {
      this.cancelScanSheet();
      return;
    }
    this.goScan();
  }

  cancelScanSheet() {
    if (this.awaitingScanResult()) return;
    this.scanSheetOpen.set(false);
    this.scanSheetMode.set('loading');
    this._previewScanResult.set(null);
    this._previewFailed.set(false);
    this.failedStatus.set(null);
    this._idscanlyResult.set(null);
  }

  /** Open the scan document flow — routes to IDScanly doc-type picker or starts Regula. */
  openScanDocument() {
    if (this.propertyConfig.scanVendor() === 'idscanly') {
      this.menuOpen.set(false);
      this.docTypeSheetOpen.set(true);
    } else {
      this.goScan();
    }
  }

  startIdscanly(type: DocumentTypeConfig) {
    this.docTypeSheetOpen.set(false);
    this.captureSession.start(type);
    this.captureSession.context.set({ reservationCode: this.reservationCode, guestId: this.guestId });
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
      this.mixpanel.trackScanResultEdited({
        document_type: result?.documentData?.document_type ?? undefined,
      });
      this.scanSheetOpen.set(false);
      this.scanSheetMode.set('loading');
      this._idscanlyResult.set(null);
      this.t(
        () => this.router.navigate(['/guest', this.reservationCode, this.guestId, 'edit']),
        300,
      );
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

    this.res.updateGuest(this.reservationCode, guest).then(() => {
      this.mixpanel.trackScanResultSaved({
        document_type: result?.documentData?.document_type ?? undefined,
      });
      this.docuscan.lastScanResult = null;
      this._idscanlyResult.set(null);
      this.scanSheetOpen.set(false);
      this.scanSheetMode.set('loading');
      this.loadGuest();
    });
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
      drivinglicence: 'Driving Licence',
      driving_licence: 'Driving Licence',
      residencepermit: 'Residence Permit',
      residence_permit: 'Residence Permit',
    };
    return map[type?.toLowerCase()] ?? type ?? '—';
  }
}

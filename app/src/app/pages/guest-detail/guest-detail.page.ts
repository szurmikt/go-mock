import { Component, OnInit, OnDestroy, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { ViewWillEnter } from '@ionic/angular';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { ReservationService } from '../../services/reservation';
import { DocumentReaderService, ReaderStatus } from '../../services/document-reader.service';
import { OptionsService } from '../../services/options.service';
import { DocuscanService } from '../../services/docuscan';
import { GuestInterface, ScanResultInterface } from '../../models/guest.interface';
import { LocalizedDatePipe } from '../../pipes/localized-date.pipe';
import { DashIfEmptyPipe } from '../../pipes/dash-if-empty.pipe';

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
  imports: [IonContent, IonSpinner, TitleCasePipe, LocalizedDatePipe, DashIfEmptyPipe],
})
export class GuestDetailPage implements OnInit, OnDestroy, ViewWillEnter {
  guest = signal<GuestInterface | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  menuOpen = signal(false);

  scanSheetOpen = signal(false);
  scanSheetMode = signal<ScanSheetMode>('loading');
  failedStatus = signal<ReaderStatus | null>(null);
  private awaitingScanResult = signal(false);
  private previewMessageMode = signal<ScanPreviewMode | null>(null);
  private _previewScanResult = signal<ScanResultInterface | null>(null);
  private _previewFailed = signal(false);

  readonly scanSheetMessage = computed(() => {
    const override = this.previewMessageMode();
    if (override === 'loading') return 'Loading scan database…';
    if (override === 'starting') return 'Starting ID scan…';
    return this.documentReader.readerStatus() === ReaderStatus.INIT
      ? 'Loading scan database…'
      : 'Starting ID scan…';
  });

  readonly scanSheetTitle = computed(() => {
    const mode = this.scanSheetMode();
    if (mode === 'result') return 'Scan result';
    if (mode === 'failed') {
      switch (this.failedStatus()) {
        case ReaderStatus.TIMEOUT:     return 'Scan Timed out';
        case ReaderStatus.CANCELLED:   return 'Scan Cancelled';
        case ReaderStatus.INTERRUPTED: return 'Scan Interrupted';
        default:                       return 'Scan Failed';
      }
    }
    return 'Scan Document';
  });

  readonly scanResult = computed(
    () => this._previewScanResult() ?? this.documentReader.scanResult(),
  );

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
    this.loadGuest();
  }

  private async loadGuest() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const guests = await this.res.fetchGuests(this.reservationCode);
      const found = guests.find(g => g.reservation_guest_id === this.guestId);
      this.guest.set(found ?? null);
      if (!found) this.error.set('Guest not found');
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load guest');
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
      this.scanSheetOpen.set(false);
      this.scanSheetMode.set('loading');
      this.t(
        () => this.router.navigate(['/guest', this.reservationCode, this.guestId, 'edit']),
        300,
      );
      return;
    }

    const guest = this.guest();
    if (!guest) return;

    if (result?.scannedData) {
      guest.scanned_data = this.docuscan.scannedDataToGuestScannedData(result.scannedData);
    }
    this.docuscan.fillGuestDataFromScannedData(guest);
    this.guest.set(guest);

    this.res.updateGuest(this.reservationCode, guest).then(() => {
      this.docuscan.lastScanResult = null;
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

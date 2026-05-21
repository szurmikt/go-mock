import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  signal,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonContent, IonButton, IonSpinner } from '@ionic/angular/standalone';
import {
  DocumentReaderService,
  ReaderStatus,
} from '../../services/document-reader.service';
import {
  GuestInterface,
  ScannedDataInterface,
  ScanResultInterface,
} from '../../models/guest.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DashIfEmptyPipe } from '../../pipes/dash-if-empty.pipe';
import { DefaultValuePipe } from '../../pipes/default-value.pipe';
import { LocalizedDatePipe } from '../../pipes/localized-date.pipe';
import { DocuscanService } from 'src/app/services/docuscan';
import { DocumentData } from 'src/app/models/statistics-interface';
import { ReservationService } from 'src/app/services/reservation';

type Phase = 'camera' | 'scanning' | 'result';

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
  },
};

@Component({
  selector: 'app-id-scan',
  templateUrl: './id-scan.page.html',
  styleUrls: ['./id-scan.page.scss'],
  standalone: true,
  imports: [
    IonSpinner,
    IonButton,
    IonContent,
    TranslatePipe,
    DashIfEmptyPipe,
    DefaultValuePipe,
    LocalizedDatePipe,
  ],
  providers: [TranslatePipe, DashIfEmptyPipe, DefaultValuePipe],
})
export class IdScanPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private documentReader = inject(DocumentReaderService);
  private docuscanService = inject(DocuscanService);
  private reservationService = inject(ReservationService);

  phase = signal<Phase>('camera');
  result = signal<ScannedDataInterface | null>(null);
  guest = signal<GuestInterface | null>(null);

  private readonly _previewStatus = signal<ReaderStatus | null>(null);
  private readonly _previewResult = signal<ScanResultInterface | null>(null);

  readonly isNative = Capacitor.isNativePlatform();
  readonly readerStatus = computed(() => this._previewStatus() ?? this.documentReader.readerStatus());
  readonly ReaderStatus = ReaderStatus;

  readonly scanResult = computed(() => this._previewResult() ?? this.documentReader.scanResult());

  readonly initializing = computed(
    () =>
      this.readerStatus() === ReaderStatus.INIT ||
      this.readerStatus() === ReaderStatus.PROCESSING,
  );

  readonly shutterDisabled = computed(
    () => !this.isNative || this.phase() === 'scanning' || this.initializing(),
  );

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) {
    this.timeouts.push(setTimeout(fn, ms));
  }

  private reservationCode!: string;
  private guestId!: string;

  options: any;

  constructor() {}

  async ngOnInit(): Promise<void> {
    const preview = this.route.snapshot.queryParamMap.get('preview');
    if (preview) {
      this.activatePreview(preview);
      return;
    }

    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;
    console.log(
      'IdScanPage ngOnInit this.reservationCode',
      this.reservationCode,
    );
    console.log('IdScanPage ngOnInit this.guestId', this.guestId);

    const guests = await this.reservationService.fetchGuests(
      this.reservationCode,
    );
    const found = guests.find((g) => g.reservation_guest_id === this.guestId);
    this.guest.set(found ?? null);

    // When navigated here from the guest-detail bottom sheet (init + scan
    // already ran there), the reader status already reflects the post-scan
    // result. Skip our own init/scan so the existing template just renders
    // the result/timeout UI.
    if (this.route.snapshot.queryParamMap.get('fromScan') === 'true') {
      return;
    }

    await this.documentReader.init().catch((e) => {
      console.error('Error initializing document reader', e);
      alert('Error initializing document reader: ' + String(e));
    });
    this.scan();
  }

  private activatePreview(mode: string): void {
    if (mode === 'loading') {
      this._previewStatus.set(ReaderStatus.INIT);
    } else if (mode === 'timeout') {
      this._previewStatus.set(ReaderStatus.TIMEOUT);
    } else if (mode === 'result') {
      this._previewStatus.set(ReaderStatus.FINISHED);
      this._previewResult.set(MOCK_SCAN_RESULT);
    }
  }

  ngOnDestroy(): void {
    this.timeouts.forEach(clearTimeout);
  }

  async IonViewWillEnter(): Promise<void> {
    console.log('IonViewWillEnter');
  }

  scan(): void {
    this.documentReader.scan();
  }

  back(): void {
    window.history.back();
  }

  processDocument(action: string) {
    const _scanResult: ScanResultInterface = this.scanResult();
    this.docuscanService.lastScanResult = _scanResult;
    console.log(
      'this.docuscanService.lastScanResult',
      this.docuscanService.lastScanResult,
    );
    if (action == 'save') {
      const guest = this.guest();
      console.log('processDocument guest', guest);
      if (_scanResult.scannedData) {
        guest!.scanned_data =
          this.docuscanService.scannedDataToGuestScannedData(
            _scanResult.scannedData,
          );
      }
      console.log('processDocument guest scanned', guest);

      this.docuscanService.fillGuestDataFromScannedData(guest!);
      console.log('processDocument guest filled', guest);

      this.guest.set(guest!);

      // this.guest.scanned_data = this.scannedDataSignal();
      // this.guest = this.docuscanService.fillGuestDataFromScannedData(
      //   this.guest,
      // );
      // this.docuscanService.lastScannedData = null;
      // this.docuscanService.lastDocumentData = null;

      this.reservationService
        .updateGuest(this.reservationCode!, this.guest()!)
        .then(() => {
          console.log('GuestPage openScanModal guest updated successfully');
          this.docuscanService.lastScanResult = null;
          this.back();
        });
    } else {
      this.t(
        () =>
          this.router.navigate(
            ['/guest', this.reservationCode, this.guestId, 'edit'],
            { replaceUrl: true },
          ),
        300,
      );
    }
  }

  resultField(key: keyof ScannedDataInterface): string {
    const r = this.result();
    if (!r) return '';
    const val = r[key];
    return val != null && val !== '' ? String(val) : '';
  }

  docTypeName(type: string | undefined): string {
    if (!type) return '';
    const map: Record<string, string> = {
      passport: 'Passport',
      id: 'ID Card',
      idcard: 'ID Card',
      id_card: 'ID Card',
      driving_license: 'Driving Licence',
      drivinglicence: 'Driving Licence',
      driving_licence: 'Driving Licence',
      residencepermit: 'Residence Permit',
      residence_permit: 'Residence Permit',
    };
    return map[type.toLowerCase()] ?? type;
  }

  fullName(): string {
    const r = this.result();
    if (!r) return '';
    return (
      `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.full_name || ''
    );
  }

  docType(): string {
    const r = this.result();
    return this.docTypeName(r?.document?.document_type);
  }
}

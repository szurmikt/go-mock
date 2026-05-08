import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { IonContent } from '@ionic/angular/standalone';
import { DocumentReaderService, ReaderStatus } from '../../services/document-reader';
import { ScannedDataInterface } from '../../models/guest.interface';

type Phase = 'camera' | 'scanning' | 'result';

@Component({
  selector: 'app-id-scan',
  templateUrl: './id-scan.page.html',
  styleUrls: ['./id-scan.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class IdScanPage implements OnInit, OnDestroy {
  phase = signal<Phase>('camera');
  result = signal<ScannedDataInterface | null>(null);

  readonly isNative = Capacitor.isNativePlatform();
  readonly readerStatus = this.documentReader.status;
  readonly ReaderStatus = ReaderStatus;

  readonly initializing = computed(() =>
    this.documentReader.status() === ReaderStatus.INIT ||
    this.documentReader.status() === ReaderStatus.PROCESSING,
  );

  readonly shutterDisabled = computed(() =>
    !this.isNative || this.phase() === 'scanning' || this.initializing(),
  );

  private reservationCode!: string;
  private guestId!: string;

  constructor(
    private route: ActivatedRoute,
    private documentReader: DocumentReaderService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;
  }

  private timeouts: ReturnType<typeof setTimeout>[] = [];

  ngOnDestroy(): void {
    this.timeouts.forEach(clearTimeout);
  }

  async scan(): Promise<void> {
    this.phase.set('scanning');
    const started = await this.documentReader.scan();
    if (!started) {
      this.phase.set('camera');
    }
  }

  back(): void {
    window.history.back();
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
    return `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.full_name || '';
  }

  docType(): string {
    const r = this.result();
    return this.docTypeName(r?.document?.document_type);
  }
}

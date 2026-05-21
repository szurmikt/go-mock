import { Component, OnInit, OnDestroy, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { ReservationService } from '../../services/reservation';
import { DocumentReaderService, ReaderStatus } from '../../services/document-reader.service';
import { GuestInterface } from '../../models/guest.interface';

type ScanPreviewMode = 'starting' | 'loading';

@Component({
  selector: 'app-guest-detail',
  templateUrl: './guest-detail.page.html',
  styleUrls: ['./guest-detail.page.scss'],
  standalone: true,
  imports: [IonContent, IonSpinner],
})
export class GuestDetailPage implements OnInit, OnDestroy, ViewWillEnter {
  guest = signal<GuestInterface | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  menuOpen = signal(false);

  scanSheetOpen = signal(false);
  private awaitingScanResult = signal(false);
  private previewMessageMode = signal<ScanPreviewMode | null>(null);

  readonly scanSheetMessage = computed(() => {
    const override = this.previewMessageMode();
    if (override === 'loading') return 'Loading scan database…';
    if (override === 'starting') return 'Starting ID scan…';
    return this.documentReader.readerStatus() === ReaderStatus.INIT
      ? 'Loading scan database…'
      : 'Starting ID scan…';
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
  ) {
    effect(() => {
      if (!this.awaitingScanResult()) return;
      const status = this.documentReader.readerStatus();
      const done =
        status === ReaderStatus.FINISHED ||
        status === ReaderStatus.TIMEOUT ||
        status === ReaderStatus.CANCELLED ||
        status === ReaderStatus.INTERRUPTED;
      if (!done) return;
      this.awaitingScanResult.set(false);
      this.scanSheetOpen.set(false);
      this.router.navigate(
        ['/guest', this.reservationCode, this.guestId, 'scan'],
        { queryParams: { fromScan: 'true' } },
      );
    });
  }

  ngOnInit() {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;

    const preview = this.route.snapshot.queryParamMap.get('previewScanSheet');
    if (preview === 'starting' || preview === 'loading') {
      this.previewMessageMode.set(preview);
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

  cancelScanSheet() {
    if (this.awaitingScanResult()) return;
    this.scanSheetOpen.set(false);
  }

  guestName(g: GuestInterface): string {
    return `${g.first_name} ${g.last_name}`.trim();
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

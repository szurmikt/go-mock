import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { IonContent } from '@ionic/angular/standalone';
import { ReservationService } from '../../services/reservation';
import { GuestInterface } from '../../models/guest.interface';

@Component({
  selector: 'app-guest-detail',
  templateUrl: './guest-detail.page.html',
  styleUrls: ['./guest-detail.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class GuestDetailPage implements OnInit, OnDestroy, ViewWillEnter {
  guest = signal<GuestInterface | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  menuOpen = signal(false);

  private reservationCode!: string;
  private guestId!: string;

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private res: ReservationService,
  ) {}

  ngOnInit() {
    this.reservationCode = this.route.snapshot.paramMap.get('code')!;
    this.guestId = this.route.snapshot.paramMap.get('guestId')!;
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

  goScan() {
    this.menuOpen.set(false);
    this.t(() => this.router.navigate(['/guest', this.reservationCode, this.guestId, 'scan']), 300);
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

import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { ReservationService, pillStatus, pillLabel } from '../../services/reservation';
import { ReservationInterface } from '../../models/reservation.interface';
import { GuestInterface } from '../../models/guest.interface';

@Component({
  selector: 'app-reservation-detail',
  templateUrl: './reservation-detail.page.html',
  styleUrls: ['./reservation-detail.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class ReservationDetailPage implements OnInit, ViewWillEnter {
  reservation = signal<ReservationInterface | null>(null);
  guests = signal<GuestInterface[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  pillStatus = pillStatus;
  pillLabel = pillLabel;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private res: ReservationService,
  ) {}

  private reservationCode!: string;

  async ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code')!;
    this.reservationCode = code;;

    // Try to use cached reservation from the list first, then fetch detail
    const cached = this.res.reservations().find(r => r.reservation_code === code);
    if (cached) this.reservation.set(cached);

    try {
      const [detail, guests] = await Promise.all([
        this.res.fetchDetail(code),
        this.res.fetchGuests(code),
      ]);
      this.reservation.set(detail);
      this.guests.set(guests);
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load reservation');
    } finally {
      this.loading.set(false);
    }
  }

  async ionViewWillEnter() {
    if (!this.reservationCode) return;
    // Re-fetch guests — cache is cleared after any guest edit so this gets fresh data.
    try {
      this.guests.set(await this.res.fetchGuests(this.reservationCode));
    } catch { /* keep existing list */ }
    // Sync booker name from service signal (updated optimistically by updateGuest).
    const synced = this.res.reservations().find(r => r.reservation_code === this.reservationCode);
    if (synced) {
      this.reservation.update(prev => prev ? { ...prev, booker: synced.booker } : prev);
    }
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

  formattedDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  isFirstGuest(g: GuestInterface): boolean {
    const guests = this.guests();
    return guests.length > 0 && guests[0].reservation_guest_id === g.reservation_guest_id;
  }

  goGuest(g: GuestInterface) {
    this.router.navigate(['/guest', this.reservationCode, g.reservation_guest_id]);
  }
}

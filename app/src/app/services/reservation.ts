import { inject, Injectable, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { ApiResponse } from '../models/auth.interfaces';
import { ReservationInterface } from '../models/reservation.interface';
import { GuestInterface } from '../models/guest.interface';

function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function pillStatus(apiStatus: string): string {
  switch (apiStatus) {
    case 'checkin':    return 'check-in';
    case 'checkedin':  return 'checked-in';
    case 'checkout':   return 'check-out';
    case 'checkedout': return 'checked-out';
    case 'onboard':    return 'onboard';
    case 'confirmed':  return 'confirmed';
    default:           return 'open';
  }
}

export function pillLabel(apiStatus: string): string {
  switch (apiStatus) {
    case 'checkin':    return 'Check in';
    case 'checkedin':  return 'Checked in';
    case 'checkout':   return 'Check out';
    case 'checkedout': return 'Checked out';
    case 'onboard':    return 'Onboard';
    case 'confirmed':  return 'Confirmed';
    default:           return 'Open';
  }
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private api = inject(ApiService);

  private static readonly STALE_MS = 60_000;
  private _fetchedAt: number | null = null;
  private _guestCache = new Map<string, GuestInterface[]>();

  private _reservations = signal<ReservationInterface[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  readonly reservations = this._reservations.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly forDate = (dateStr: string) =>
    computed(() => this._reservations().filter(r => r.arrival_date === dateStr));

  clear(): void {
    this._reservations.set([]);
    this._fetchedAt = null;
    this._guestCache.clear();
  }

  async fetchReservations(force = false): Promise<void> {
    if (!force && this._fetchedAt !== null && Date.now() - this._fetchedAt < ReservationService.STALE_MS) {
      return;
    }
    this._loading.set(true);
    this._error.set(null);
    try {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);

      const resp = await firstValueFrom(
        this.api.get<ApiResponse<{ reservations: any[] }>>('reservations', {
          start_date: dateStr(start),
          end_date: dateStr(end),
        }),
      );

      if (!resp.success) {
        this._error.set('Failed to load reservations');
        return;
      }

      this._reservations.set(resp.data.reservations.map(r => this.convert(r)));
      this._fetchedAt = Date.now();
    } catch {
      this._error.set('Network error');
    } finally {
      this._loading.set(false);
    }
  }

  async fetchDetail(reservationCode: string): Promise<ReservationInterface> {
    const resp = await firstValueFrom(
      this.api.get<ApiResponse<any[]>>('reservations/details', { reservation_code: reservationCode }),
    );
    if (!resp.success || !resp.data[0]) throw new Error('Reservation not found');
    return this.convert(resp.data[0]);
  }

  async updateGuest(reservationCode: string, guest: GuestInterface): Promise<void> {
    const payload = { reservation_code: reservationCode, guest: nullifyEmpty(guest) };
    const resp = await firstValueFrom(
      this.api.post<ApiResponse<unknown>>('guests', payload),
    );
    if (!resp.success) throw new Error('Failed to save guest');
    this._guestCache.delete(reservationCode);
    this._reservations.update(list =>
      list.map(r => {
        if (r.reservation_code !== reservationCode) return r;
        if (r.booker.booker_id !== guest.guest_id) return r;
        return {
          ...r,
          booker: { ...r.booker, first_name: guest.first_name, last_name: guest.last_name, email: guest.email },
        };
      }),
    );
  }

  async fetchGuests(reservationCode: string): Promise<GuestInterface[]> {
    const cached = this._guestCache.get(reservationCode);
    if (cached) return cached;

    const resp = await firstValueFrom(
      this.api.get<ApiResponse<{ guests: any[] }>>('guests', { reservation_code: reservationCode }),
    );
    if (!resp.success) throw new Error('Failed to load guests');
    const guests = (resp.data.guests ?? []).map(g => this.convertGuest(g));
    this._guestCache.set(reservationCode, guests);
    return guests;
  }

  private convertGuest(g: any): GuestInterface {
    return {
      reservation_guest_id: g.reservation_guest_id ?? '',
      guest_id: g.guest_id ?? '',
      first_name: g.first_name ?? '',
      last_name: g.last_name ?? '',
      mother_name: g.mother_name ?? '',
      maiden_name: g.maiden_name ?? '',
      birth_date: g.birth_date ?? '',
      birth_place: g.birth_place ?? '',
      guest_age: g.guest_age ?? '',
      gender: g.gender ?? '',
      city_tax_liable: g.city_tax_liable ?? '',
      citizenship: g.citizenship ?? '',
      email: g.email ?? '',
      phone_number: g.phone_number ?? '',
      address: g.address ?? { country_code: null, zip: null, city: null, address_line: null },
      document: g.document ?? null,
      scanned_data: g.scanned_data ?? null,
      locked: g.locked ?? false,
    };
  }

  private convert(r: any): ReservationInterface {
    const arrival = new Date(r.arrival_date);
    const departure = new Date(r.departure_date);
    const nights = Math.round(
      (Date.UTC(departure.getFullYear(), departure.getMonth(), departure.getDate()) -
       Date.UTC(arrival.getFullYear(), arrival.getMonth(), arrival.getDate())) /
      86_400_000,
    );
    return {
      id: r.id,
      reservation_code: r.reservation_code,
      partner: r.partner ? { partner_id: r.partner.partner_id, partner_name: r.partner.partner_name } : undefined,
      booker: {
        booker_id: r.booker.booker_id,
        first_name: r.booker.first_name,
        last_name: r.booker.last_name,
        email: r.booker.email,
      },
      arrival_date: dateStr(arrival),
      departure_date: dateStr(departure),
      checked_in_time: r.checked_in_time ?? '',
      checked_out_time: r.checked_out_time ?? '',
      status: r.status ?? '',
      room_type_id: r.room_type_id ?? '',
      room_type_name: r.room_type_name ?? '',
      room_id: r.room_id ?? '',
      room_name: r.room_name ?? '',
      guest_count: {
        adults: r.guest_count?.adults ?? 0,
        children: r.guest_count?.children ?? 0,
        infants: r.guest_count?.infants ?? 0,
      },
      number_of_guests: r.number_of_guests ?? 0,
      nights,
    };
  }
}

// Converts empty strings to null recursively so the API receives proper nulls
// instead of "" for optional enum/nullable fields (avoids 500 on save).
function nullifyEmpty(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj === '' ? null : obj;
  if (typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) result[k] = nullifyEmpty(v);
  return result;
}

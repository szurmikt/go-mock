import { inject, Injectable, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import * as Sentry from '@sentry/angular';
import { ApiService } from './api';
import { LanguageService } from './language.service';
import { PropertyConfigService } from './property-config.service';
import { ApiResponse } from '../models/auth.interfaces';
import { ReservationInterface } from '../models/reservation.interface';
import { GuestInterface } from '../models/guest.interface';

function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parses a "YYYY-MM-DD" calendar-date string into its integer components without
// ever constructing a `Date` from it — `new Date("YYYY-MM-DD")` parses as UTC
// midnight, and reading that back with local getters silently shifts the date by
// a day for anyone west of UTC. Calendar dates (arrival/departure) have no
// timezone of their own; this keeps them as pure numbers end to end.
function parseCalendarDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function pillStatus(apiStatus: string): string {
  switch (apiStatus) {
    case 'checkin':    return 'check-in';
    case 'checkedin':  return 'checked-in';
    case 'checkout':   return 'check-out';
    case 'checkedout': return 'checked-out';
    case 'onboard':    return 'onboard';
    case 'confirmed':  return 'confirmed';
    case 'cancelled':  return 'cancelled';
    case 'noshow':     return 'noshow';
    default:           return 'option';
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
    case 'cancelled':  return 'Cancelled';
    case 'noshow':     return 'No show';
    default:           return 'Option';
  }
}

// The four settable reservation-status stages, in flow order. Keys match both
// what `POST /reservations/status` accepts and what `pillStatus`/`pillLabel`
// above already switch on — no new status vocabulary. `tsField` names the
// `ReservationInterface` field holding that step's timestamp (once reached).
export interface StatusStep {
  key: string;
  labelKey: string;
  tsField: 'created_datetime' | 'checked_in_time' | 'onboard_time' | 'checked_out_time';
}

export const STATUS_STEPS: StatusStep[] = [
  { key: 'confirmed',  labelKey: 'reservationDetail.statusReserved',   tsField: 'created_datetime' },
  { key: 'checkedin',  labelKey: 'reservationDetail.statusCheckedIn',  tsField: 'checked_in_time' },
  { key: 'onboard',    labelKey: 'reservationDetail.statusOnboard',    tsField: 'onboard_time' },
  { key: 'checkedout', labelKey: 'reservationDetail.statusCheckedOut', tsField: 'checked_out_time' },
];

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private api = inject(ApiService);
  private lang = inject(LanguageService);
  private propertyConfig = inject(PropertyConfigService);

  private static readonly STALE_MS = 60_000;
  private static readonly GUEST_STALE_MS = 60_000;
  private _fetchedAt: number | null = null;
  private _inFlight: Promise<void> | null = null;
  private _guestCache = new Map<string, GuestInterface[]>();
  private _guestFetchedAt = new Map<string, number>();
  private _inFlightGuests = new Map<string, Promise<GuestInterface[]>>();

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
    this._guestFetchedAt.clear();
  }

  // Stale-while-revalidate: serves the in-memory list instantly and only re-fetches
  // when stale (>STALE_MS) or forced. The re-fetch is SILENT when a list is already
  // shown — `loading` is toggled only on the genuine empty first load — so re-entering
  // a populated screen never flashes the spinner that replaces the list.
  async fetchReservations(force = false): Promise<void> {
    if (!force && this._fetchedAt !== null && Date.now() - this._fetchedAt < ReservationService.STALE_MS) {
      return;
    }
    if (this._inFlight) return this._inFlight;

    const showSpinner = this._reservations().length === 0;
    this._inFlight = (async () => {
      if (showSpinner) {
        this._loading.set(true);
        this._error.set(null);
      }
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
          if (showSpinner) this._error.set(this.lang.t('errors.failedLoadReservations'));
          return;
        }

        this._reservations.set(resp.data.reservations.map(r => this.convert(r)));
        this._fetchedAt = Date.now();
      } catch (err) {
        if (showSpinner) this._error.set(this.lang.t('errors.networkError'));
        // A Log, not an Issue — an occasional dropped connection is expected and not
        // actionable on its own. Tagged by kind so a real pattern (e.g. a burst of
        // refresh_rejected from the interceptor) is distinguishable from one-off network
        // blips, which previously showed the exact same generic "Network error" with no
        // trace left anywhere to diagnose it from.
        Sentry.logger.warn('reservations fetch failed', {
          kind:
            (err as { kind?: string })?.kind ??
            (err instanceof HttpErrorResponse ? `http_${err.status}` : 'network_error'),
        });
      } finally {
        if (showSpinner) this._loading.set(false);
        this._inFlight = null;
      }
    })();
    return this._inFlight;
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
    let resp: ApiResponse<unknown>;
    try {
      resp = await firstValueFrom(
        this.api.post<ApiResponse<unknown>>('guests', payload),
      );
    } catch (e) {
      this.reportGuestSaveFailure(reservationCode, guest, payload, null, e);
      throw e;
    }
    if (!resp.success) {
      this.reportGuestSaveFailure(reservationCode, guest, payload, resp.errors, null);
      const err = new Error('Failed to save guest') as Error & { apiErrors?: unknown };
      err.apiErrors = resp.errors;
      throw err;
    }
    this._guestCache.delete(reservationCode);
    this._guestFetchedAt.delete(reservationCode);
    this._reservations.update(list =>
      list.map(r => {
        if (r.reservation_code !== reservationCode) return r;
        if (String(r.booker.booker_id) !== String(guest.guest_id)) return r;
        return {
          ...r,
          booker: { ...r.booker, first_name: guest.first_name, last_name: guest.last_name, email: guest.email },
        };
      }),
    );
  }

  /**
   * A failed guest save used to throw a bare generic Error — the API's `errors` payload
   * (the only thing that says WHY validation rejected the save) was discarded and nothing
   * reached Sentry. Capture the rejection with its API errors so scan-save failures are
   * diagnosable. The full request payload carries guest PII, so it goes to Sentry Logs
   * only for properties with `extended_logging` (same gate as logIdscanlyResponse).
   */
  private reportGuestSaveFailure(
    reservationCode: string,
    guest: GuestInterface,
    payload: unknown,
    apiErrors: unknown,
    exception: unknown,
  ): void {
    try {
      const errorsJson = safeJson(apiErrors).slice(0, 4000);
      const scanMarker = (guest.scanned_data as any)?.doc_reader_scanned_document_id;
      const captureContext = {
        tags: {
          context: 'guest_save',
          failure_kind: exception != null ? 'http_error' : 'api_rejected',
          // 'idscanly' marks an IDScanly-scanned save; a real document id marks a prior scan.
          scan_marker: scanMarker != null ? String(scanMarker) : 'none',
        },
        contexts: {
          guest_save: {
            reservation_code: reservationCode,
            guest_id: guest.guest_id,
            has_scanned_data: guest.scanned_data != null,
            document_type: guest.document?.document_type ?? null,
            api_errors: errorsJson,
          },
        },
      };
      if (exception != null) {
        Sentry.captureException(exception, captureContext);
      } else {
        Sentry.captureMessage('guest save rejected by API', { level: 'error', ...captureContext });
      }
      if (this.propertyConfig.extendedLogging()) {
        const json = safeJson(payload);
        Sentry.logger.error('guest save failed', {
          reservation_code: reservationCode,
          api_errors: errorsJson,
          payload_json: json.length > 16000 ? `${json.slice(0, 16000)}…[truncated ${json.length} chars]` : json,
        });
        console.error('[guest_save] failed', { apiErrors, exception, payload });
      }
    } catch {
      // Reporting must never mask or replace the original failure.
    }
  }

  /**
   * Changes a reservation's status via POST /reservations/status, then re-fetches
   * the reservation (fetchDetail is always-uncached) to verify the API actually
   * applied it before reporting success to the caller — a single attempt each way,
   * matching this app's existing single-attempt mutation convention (no retries).
   */
  async changeStatus(reservationCode: string, status: string): Promise<ReservationInterface> {
    const payload = { reservation_code: reservationCode, status };
    let resp: ApiResponse<unknown>;
    try {
      resp = await firstValueFrom(
        this.api.post<ApiResponse<unknown>>('reservations/status', payload),
      );
    } catch (e) {
      this.reportStatusChangeFailure(reservationCode, status, null, e);
      throw e;
    }
    if (!resp.success) {
      this.reportStatusChangeFailure(reservationCode, status, resp.errors, null);
      const err = new Error('Failed to change status') as Error & { apiErrors?: unknown };
      err.apiErrors = resp.errors;
      throw err;
    }

    const updated = await this.fetchDetail(reservationCode);
    if (updated.status !== status) {
      this.reportStatusChangeFailure(reservationCode, status, { unverified: updated.status }, null);
      throw new Error(this.lang.t('errors.failedChangeStatus'));
    }

    this._reservations.update(list =>
      list.map(r => (r.reservation_code === reservationCode ? updated : r)),
    );
    return updated;
  }

  private reportStatusChangeFailure(
    reservationCode: string,
    requestedStatus: string,
    apiErrors: unknown,
    exception: unknown,
  ): void {
    try {
      const captureContext = {
        tags: {
          context: 'status_change',
          failure_kind: exception != null ? 'http_error' : 'api_rejected',
        },
        contexts: {
          status_change: {
            reservation_code: reservationCode,
            requested_status: requestedStatus,
            api_errors: safeJson(apiErrors).slice(0, 4000),
          },
        },
      };
      if (exception != null) {
        Sentry.captureException(exception, captureContext);
      } else {
        Sentry.captureMessage('reservation status change rejected or unverified', {
          level: 'error',
          ...captureContext,
        });
      }
    } catch {
      // Reporting must never mask or replace the original failure.
    }
  }

  // Synchronous cache peek so screens can paint instantly before an SWR refresh lands.
  peekGuests(reservationCode: string): GuestInterface[] | null {
    return this._guestCache.get(reservationCode) ?? null;
  }

  // Stale-while-revalidate per reservation: serves the cache while it's within
  // GUEST_STALE_MS, otherwise (or when forced) fetches fresh. The per-code in-flight
  // lock collapses the reservation→guest drill-down into a single request.
  async fetchGuests(reservationCode: string, force = false): Promise<GuestInterface[]> {
    const cached = this._guestCache.get(reservationCode);
    const fetchedAt = this._guestFetchedAt.get(reservationCode);
    const fresh = fetchedAt != null && Date.now() - fetchedAt < ReservationService.GUEST_STALE_MS;
    if (cached && fresh && !force) return cached;

    const inFlight = this._inFlightGuests.get(reservationCode);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const resp = await firstValueFrom(
        this.api.get<ApiResponse<{ guests: any[] }>>('guests', { reservation_code: reservationCode }),
      );
      if (!resp.success) throw new Error('Failed to load guests');
      const guests = (resp.data.guests ?? []).map(g => this.convertGuest(g));
      this._guestCache.set(reservationCode, guests);
      this._guestFetchedAt.set(reservationCode, Date.now());
      return guests;
    })();
    this._inFlightGuests.set(reservationCode, promise);
    try {
      return await promise;
    } finally {
      this._inFlightGuests.delete(reservationCode);
    }
  }

  private convertGuest(g: any): GuestInterface {
    return {
      // Coerce IDs to string: the API used to return encrypted string tokens, but
      // after the encryption removal it returns plain numbers. Route params are
      // always strings, so without this the strict `===` lookup in GuestDetailPage
      // fails ("Guest not found"). String() normalizes both sides.
      reservation_guest_id: g.reservation_guest_id != null ? String(g.reservation_guest_id) : '',
      guest_id: g.guest_id != null ? String(g.guest_id) : '',
      first_name: g.first_name ?? '',
      last_name: g.last_name ?? '',
      mother_name: g.mother_name ?? '',
      maiden_name: g.maiden_name ?? '',
      birth_date: g.birth_date ?? '',
      birth_place: g.birth_place ?? '',
      guest_age: g.guest_age ?? '',
      gender: (g.gender ?? '').toLowerCase(),
      city_tax_liable: g.city_tax_liable === true || g.city_tax_liable === 'true' || g.city_tax_liable === 1 || g.city_tax_liable === '1',
      citizenship: g.citizenship ?? '',
      email: g.email ?? '',
      phone_number: g.phone_number ?? '',
      address: g.address ?? { country_code: null, zip: null, city: null, address_line: null },
      document: g.document ?? null,
      scanned_data: this.hasScanRecord(g.scanned_data) ? g.scanned_data : null,
      locked: g.locked ?? false,
    };
  }

  // A guest counts as "scanned" only when the API returns a scan record id. The API
  // can return an empty/all-null scanned_data placeholder for never-scanned guests,
  // which is truthy — so a bare `?? null` would wrongly light up the scan icon.
  private hasScanRecord(sd: any): boolean {
    return sd != null && typeof sd === 'object' && !!sd.doc_reader_scanned_document_id;
  }

  private convert(r: any): ReservationInterface {
    const arrival = parseCalendarDate(r.arrival_date);
    const departure = parseCalendarDate(r.departure_date);
    const nights = Math.round(
      (Date.UTC(departure.y, departure.m - 1, departure.d) -
       Date.UTC(arrival.y, arrival.m - 1, arrival.d)) /
      86_400_000,
    );
    return {
      id: r.id,
      reservation_code: r.reservation_code,
      partner: r.partner ? { partner_id: r.partner.partner_id, partner_name: r.partner.partner_name } : undefined,
      booker: {
        booker_id: r.booker?.booker_id != null ? String(r.booker.booker_id) : '',
        first_name: r.booker.first_name,
        last_name: r.booker.last_name,
        email: r.booker.email,
      },
      arrival_date: r.arrival_date ?? '',
      departure_date: r.departure_date ?? '',
      created_datetime: r.created_datetime ?? '',
      checked_in_time: r.checked_in_time ?? '',
      onboard_time: r.onboard_time ?? '',
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
      open_in_pms: r.open_in_pms === true,
    };
  }
}

// Best-effort JSON for Sentry diagnostics — must never throw.
function safeJson(x: unknown): string {
  try {
    return JSON.stringify(x) ?? String(x);
  } catch {
    return String(x);
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

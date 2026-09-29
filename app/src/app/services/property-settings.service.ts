import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';

export interface ScanFieldConfig {
  field_name: string;
  name: string;
  label?: string;
  required: boolean;
  type: string;
}

interface PropertySettingsApiResponse {
  success: boolean;
  data: {
    property_time_zone?: string | null;
    scan_fields?: ScanFieldConfig[];
    reservation_statuses?: string[];
  };
}

/**
 * Holds the currently selected property's IANA timezone (e.g. "Europe/Budapest"), read from
 * GET /properties/settings — scoped implicitly to whichever property the Property-Id header
 * currently names (see api.interceptor.ts), not passed as a parameter here.
 *
 * Distinct from PropertyConfigService (property-config.service.ts), which queries an unrelated
 * Supabase `property_config` table (scan_doc_types/extended_logging/live_update_channel) — this
 * service talks to the real SabeeApp API instead.
 */
@Injectable({ providedIn: 'root' })
export class PropertySettingsService {
  readonly timeZone = signal<string | null>(null);

  /**
   * Per-property config of which guest fields are expected to be collected via document scan.
   * Every `name` seen here so far maps to an existing GuestInterface/form field except
   * `turkish_republic_identity_number` (added 2026-09-28 — see guest.interface.ts and
   * idscanly-docuscan.service.ts). If the backend ever adds another name with no corresponding
   * field anywhere in the app, it will be silently unused again — grep this codebase for
   * `turkish_republic_identity_number` for the set of files that needed touching last time, as
   * a starting point for adding support for a new one. Deliberately never used to drive
   * required-field validation — scanned fields must never block Save.
   */
  readonly scanFields = signal<ScanFieldConfig[]>([]);

  /**
   * Which of the 4 STATUS_STEPS keys (reservation.ts) this property's account actually uses,
   * straight from the API. Two shapes seen in practice: the full
   * `[confirmed, checkedin, onboard, checkedout]`, or `[confirmed, onboard, checkedout]` with
   * `checkedin` dropped — the latter for an account that doesn't use online check-in, where a
   * guest goes straight from Confirmed to Onboard with no separate check-in step. `null` means
   * the API hasn't sent the field (older backend) — treated as "no restriction, show all 4
   * steps" so this fails open rather than hiding a step nobody asked to hide.
   */
  readonly reservationStatuses = signal<string[] | null>(null);

  constructor(private api: ApiService) {}

  async load(): Promise<void> {
    const r = await firstValueFrom(this.api.get<PropertySettingsApiResponse>('properties/settings'));
    this.timeZone.set(r.data.property_time_zone ?? null);
    this.scanFields.set(r.data.scan_fields ?? []);
    this.reservationStatuses.set(r.data.reservation_statuses ?? null);
  }

  clear(): void {
    this.timeZone.set(null);
    this.scanFields.set([]);
    this.reservationStatuses.set(null);
  }
}

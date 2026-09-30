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
    online_checkin?: boolean;
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
   * Whether this property's account uses online check-in — an account without it never has
   * a separate check-in stage: arriving and being onboarded IS "checking in" as far as its
   * staff are concerned. Drives, in reservation.ts and its consumers: which STATUS_STEPS are
   * offered for a status change (all 4 when true; Reserved/Onboard/Checked-out only when
   * false — the real `checkedin` stage is hidden), and whether the raw `onboard` status is
   * displayed as "Onboard" or relabeled to "Checked-in".
   *
   * Per the API contract, `false` and "field not present" mean the same thing — there is no
   * separate "not yet known" state, so this defaults to `false` (not `true`) until `load()`
   * resolves, matching what an absent field means once it does resolve.
   */
  readonly onlineCheckIn = signal<boolean>(false);

  constructor(private api: ApiService) {}

  async load(): Promise<void> {
    const r = await firstValueFrom(this.api.get<PropertySettingsApiResponse>('properties/settings'));
    this.timeZone.set(r.data.property_time_zone ?? null);
    this.scanFields.set(r.data.scan_fields ?? []);
    this.onlineCheckIn.set(r.data.online_checkin === true);
  }

  clear(): void {
    this.timeZone.set(null);
    this.scanFields.set([]);
    this.onlineCheckIn.set(false);
  }
}

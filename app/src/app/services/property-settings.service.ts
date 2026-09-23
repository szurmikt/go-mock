import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';

interface PropertySettingsApiResponse {
  success: boolean;
  data: {
    property_time_zone?: string | null;
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

  constructor(private api: ApiService) {}

  async load(): Promise<void> {
    const r = await firstValueFrom(this.api.get<PropertySettingsApiResponse>('properties/settings'));
    this.timeZone.set(r.data.property_time_zone ?? null);
  }

  clear(): void {
    this.timeZone.set(null);
  }
}

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiEnvironmentService } from './api-environment';

@Injectable({ providedIn: 'root' })
export class PropertyGatingService {
  constructor(private apiEnv: ApiEnvironmentService) {}

  /**
   * Fail-closed: returns null (not an empty Set) when the allowlist can't be
   * resolved, so callers can tell "verified, nothing enabled" apart from
   * "couldn't verify" and block login rather than silently letting everyone through.
   * property_config.property_id is text, so results are parsed back to number
   * to match PropertyInterface.property_id.
   */
  async resolveEnabledPropertyIds(propertyIds: number[]): Promise<Set<number> | null> {
    if (!propertyIds.length) return new Set();

    try {
      const ids = propertyIds.join(',');
      // property_id can collide between the live and test SabeeApp systems — scope
      // the allowlist to the API environment currently in use.
      const url =
        `${environment.supabaseUrl}/rest/v1/property_config` +
        `?property_id=in.(${ids})&environment=eq.${this.apiEnv.mode()}` +
        `&go_enabled=eq.true&select=property_id`;

      const res = await fetch(url, {
        headers: {
          apikey: environment.supabaseAnonKey,
          Authorization: `Bearer ${environment.supabaseAnonKey}`,
        },
      });

      if (!res.ok) return null;

      const rows: { property_id: string }[] = await res.json();
      return new Set(rows.map(r => Number(r.property_id)));
    } catch {
      return null;
    }
  }
}

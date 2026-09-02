import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiEnvironmentService } from './api-environment';

// Matches the scan_doc_type enum in Supabase property_config table
type DbDocType = 'id_card' | 'passport' | 'driving_license' | 'address_card';

// Maps DB enum values to IDScanly DocumentTypeId strings
const DOC_TYPE_MAP: Record<DbDocType, string> = {
  id_card: 'id-card',
  passport: 'passport',
  driving_license: 'driving-licence',
  address_card: 'address-card',
};

/**
 * App-side default when property_config has no usable restriction (unreachable Supabase, no
 * row, or a row with scan_doc_types missing/empty) — all four types allowed. Supabase is now an
 * OVERRIDE on top of this default, not the sole source of truth: an empty/missing value must
 * never resolve to "nothing allowed", since that's how a scan-doc-type picker with no allowed
 * types is silently emptied out.
 */
const DEFAULT_SCAN_DOC_TYPES = Object.values(DOC_TYPE_MAP);

/**
 * Channels that exist in Capawesome Cloud. Anything else is treated as unset.
 * dev = internal testing, early = early adopters, prod = everyone else (renamed 2026-08-31 from
 * dev/beta/production — see the CLAUDE.md changelog entry for the full list of touched files).
 */
const VALID_LIVE_UPDATE_CHANNELS = ['prod', 'early', 'dev'];
const DEFAULT_LIVE_UPDATE_CHANNEL = 'prod';

@Injectable({ providedIn: 'root' })
export class PropertyConfigService {
  scanDocTypes = signal<string[]>(DEFAULT_SCAN_DOC_TYPES);
  /** Per-property opt-in to send full scan responses to Sentry — see review.page.ts submit(). */
  extendedLogging = signal<boolean>(false);
  /**
   * Live-update channel for this property. Always a valid channel — an unknown, null, or missing
   * value resolves to 'prod', so a bad row can never push a hotel onto early/dev.
   */
  liveUpdateChannel = signal<string>(DEFAULT_LIVE_UPDATE_CHANNEL);

  constructor(private apiEnv: ApiEnvironmentService) {}

  async load(propertyId: number): Promise<void> {
    try {
      // property_id can collide between the live and test SabeeApp systems — scope
      // every property_config lookup to the API environment currently in use.
      const url =
        `${environment.supabaseUrl}/rest/v1/property_config` +
        `?property_id=eq.${propertyId}&environment=eq.${this.apiEnv.mode()}` +
        `&select=scan_doc_types,extended_logging,live_update_channel&limit=1`;

      const res = await fetch(url, {
        headers: {
          apikey: environment.supabaseAnonKey,
          Authorization: `Bearer ${environment.supabaseAnonKey}`,
        },
      });

      if (!res.ok) {
        this.clear();
        return;
      }

      const rows: {
        scan_doc_types: DbDocType[];
        extended_logging?: boolean;
        live_update_channel?: string | null;
      }[] = await res.json();

      if (!rows.length) {
        this.clear();
        return;
      }

      const row = rows[0];
      // A present row with scan_doc_types missing/empty falls back to the default (all types) —
      // only a real, non-empty restriction overrides. A genuinely-intended empty restriction
      // isn't a supported state (there's no UI for "no scanning allowed at all" today).
      const mappedDocTypes = (row.scan_doc_types ?? []).map(t => DOC_TYPE_MAP[t]).filter(Boolean);
      this.scanDocTypes.set(mappedDocTypes.length ? mappedDocTypes : DEFAULT_SCAN_DOC_TYPES);
      this.extendedLogging.set(!!row.extended_logging);
      // Trimmed before comparison: this table has had a value with a trailing newline before
      // (scan_vendor: "idscanly\n"), which a strict comparison would silently reject.
      const channel = (row.live_update_channel ?? '').trim();
      this.liveUpdateChannel.set(
        VALID_LIVE_UPDATE_CHANNELS.includes(channel) ? channel : DEFAULT_LIVE_UPDATE_CHANNEL,
      );
      // console.warn (not .log) so Sentry's consoleLoggingIntegration (levels: ['warn','error'])
      // actually forwards it — confirms in Sentry, independent of any actual scan, that the flag was
      // read as true for this property, so "is extended logging even active right now" is answerable
      // without guessing from scan attempts alone.
      if (row.extended_logging) {
        console.warn(`Logging Enabled for ${propertyId}`);
      }
    } catch {
      this.clear();
    }
  }

  clear(): void {
    this.scanDocTypes.set(DEFAULT_SCAN_DOC_TYPES);
    this.extendedLogging.set(false);
    this.liveUpdateChannel.set(DEFAULT_LIVE_UPDATE_CHANNEL);
  }
}

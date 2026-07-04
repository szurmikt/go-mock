import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export type ScanVendor = 'regula' | 'idscanly';

// Matches the scan_doc_type enum in Supabase property_settings table
type DbDocType = 'id_card' | 'passport' | 'driving_license' | 'address_card';

// Maps DB enum values to IDScanly DocumentTypeId strings
const DOC_TYPE_MAP: Record<DbDocType, string> = {
  id_card: 'id-card',
  passport: 'passport',
  driving_license: 'driving-licence',
  address_card: 'address-card',
};

@Injectable({ providedIn: 'root' })
export class PropertyConfigService {
  scanVendor = signal<ScanVendor | null>(null);
  scanDocTypes = signal<string[]>([]);

  async load(propertyId: number): Promise<void> {
    try {
      const url =
        `${environment.supabaseUrl}/rest/v1/property_settings` +
        `?property_id=eq.${propertyId}&select=scan_vendor,scan_doc_types&limit=1`;

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

      const rows: { scan_vendor: string; scan_doc_types: DbDocType[] }[] = await res.json();

      if (!rows.length) {
        this.clear();
        return;
      }

      const row = rows[0];
      const vendor = row.scan_vendor as ScanVendor;
      this.scanVendor.set(vendor === 'regula' || vendor === 'idscanly' ? vendor : null);
      this.scanDocTypes.set(
        (row.scan_doc_types ?? []).map(t => DOC_TYPE_MAP[t]).filter(Boolean),
      );
    } catch {
      this.clear();
    }
  }

  clear(): void {
    this.scanVendor.set(null);
    this.scanDocTypes.set([]);
  }
}

import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { ApiService } from '../../services/api';
import { ApiResponse } from '../../models/auth.interfaces';
import { StorageService } from '../../services/storage';
import {
  GuestInterface,
  ScannedDataInterface,
  ScannedGuestDataInterface,
  ScanResultInterface,
} from '../../models/guest.interface';

const STORAGE_KEY = 'fieldsToScan';

export interface ScanField {
  name: string;
  regula_id: number;
  lc_id: number;
}

@Injectable({ providedIn: 'root' })
export class DocuscanService {
  private api = inject(ApiService);
  private storage = inject(StorageService);

  private fieldsToScan: ScanField[] = [];

  private _lastScanResult: ScanResultInterface | null = null;

  async load(): Promise<void> {
    if (this.fieldsToScan.length > 0) return;

    const stored = await this.storage.get<any[]>(STORAGE_KEY);
    if (stored && stored.length > 0) {
      this.fieldsToScan = stored;
      return;
    }

    this.fieldsToScan = await this.fetchScanFields();
    await this.storage.set(STORAGE_KEY, this.fieldsToScan);
  }

  get(): ScanField[] {
    return this.fieldsToScan;
  }

  async refresh(): Promise<void> {
    this.fieldsToScan = [];
    await this.storage.remove(STORAGE_KEY);
    await this.load();
  }

  private async fetchScanFields(): Promise<ScanField[]> {
    const resp = await firstValueFrom(
      this.api.get<ApiResponse<{ scan_fields: any[] }>>('properties/settings'),
    );
    if (!resp.success) throw new Error('Failed to load scan fields');
    return resp.data.scan_fields;
  }

  scannedDataToGuestScannedData(
    scannedGuestData: ScannedGuestDataInterface,
  ): ScannedDataInterface {
    const result: any = { document: {} };
    const docKeys = new Set([
      'document_type',
      'document_number',
      'date_of_issue_of_the_document',
    ]);
    // Address-card fields (captured under address_* keys by the scan loop) are
    // nested into a single `address` object and kept out of the flat top level.
    const addressKeyMap: Record<string, string> = {
      address_country_code: 'country_code',
      address_zip: 'zip',
      address_city: 'city',
      address_line: 'address_line',
    };

    for (const key of Object.keys(scannedGuestData)) {
      const val = scannedGuestData[key]?.value ?? null;
      if (docKeys.has(key)) {
        result.document[key] = val;
      } else if (addressKeyMap[key]) {
        result.address = result.address ?? {};
        result.address[addressKeyMap[key]] = val;
      } else {
        result[key] = val;
      }
    }

    return result as ScannedDataInterface;
  }

  public fillGuestDataFromScannedData(guest: GuestInterface) {
    for (let key in guest.scanned_data) {
      if (
        key == 'doc_reader_scanned_document_id' ||
        key == 'reservation_guest_id' ||
        key == 'guest_id'
      ) {
        continue;
      }
      // Merge per-field: a scan only overwrites a sub-field it actually read, so
      // an address card (no document number) won't wipe the guest's document,
      // and an identity doc (no address) won't wipe the guest's address.
      if (key == 'document') {
        const d = (guest.scanned_data as any)[key] ?? {};
        const existing = guest.document ?? {
          document_type: '',
          document_number: '',
          date_of_issue_of_the_document: '',
        };
        guest.document = {
          document_type: d.document_type ?? existing.document_type,
          document_number: d.document_number ?? existing.document_number,
          date_of_issue_of_the_document:
            d.date_of_issue_of_the_document ??
            existing.date_of_issue_of_the_document,
        };
        continue;
      }
      if (key == 'address') {
        const a = (guest.scanned_data as any)[key] ?? {};
        const existing = guest.address ?? {
          country_code: null,
          zip: null,
          city: null,
          address_line: null,
        };
        guest.address = {
          country_code: a.country_code ?? existing.country_code,
          zip: a.zip ?? existing.zip,
          city: a.city ?? existing.city,
          address_line: a.address_line ?? existing.address_line,
        };
        continue;
      }
      // Flat identity fields: skip null/empty so an unread field keeps its value.
      const val = (guest.scanned_data as any)[key];
      if (val === null || val === undefined || val === '') {
        continue;
      }
      (guest as any)[key] = val;
    }
    return guest;
  }

  public get lastScanResult(): ScanResultInterface | null {
    return this._lastScanResult;
  }

  public set lastScanResult(data: ScanResultInterface | null) {
    console.log('lastScanResult setter data', data);

    this._lastScanResult = data;
  }

  /** Clears in-memory scanned guest data. Called on logout / property switch. */
  clear(): void {
    this._lastScanResult = null;
  }

  sendStatistics(
    _guestId: string,
    _documentId: string,
    _status: string,
    _documentData: any,
  ): Observable<any> {
    return this.api.put('guests/scan_statistics', {
      reservation_guest_id: _guestId,
      doc_reader_scanned_document_id: _documentId,
      status: _status,
      scan_type: _documentData.scan_type,
      message: _documentData.message,
      date_of_issue: _documentData.date_of_issue,
      type: _documentData.document_type,
    });
  }
}

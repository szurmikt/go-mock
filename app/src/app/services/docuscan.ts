import { Injectable } from '@angular/core';
import {
  GuestInterface,
  ScannedDataInterface,
  ScannedGuestDataInterface,
  ScanResultInterface,
} from '../models/guest.interface';

@Injectable({ providedIn: 'root' })
export class DocuscanService {
  private _lastScanResult: ScanResultInterface | null = null;

  scannedDataToGuestScannedData(
    scannedGuestData: ScannedGuestDataInterface,
  ): ScannedDataInterface {
    const result: any = { document: {} };
    const docKeys = new Set([
      'document_type',
      'document_number',
      'date_of_issue_of_the_document',
      'turkish_republic_identity_number',
    ]);
    // Address fields (captured under address_* keys — from an address-card scan, or from
    // an identity document that happens to embed one) are nested into a single `address`
    // object and kept out of the flat top level.
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
          turkish_republic_identity_number: null,
        };
        guest.document = {
          document_type: d.document_type ?? existing.document_type,
          document_number: d.document_number ?? existing.document_number,
          date_of_issue_of_the_document:
            d.date_of_issue_of_the_document ??
            existing.date_of_issue_of_the_document,
          turkish_republic_identity_number:
            d.turkish_republic_identity_number ??
            existing.turkish_republic_identity_number ??
            null,
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
    this._lastScanResult = data;
  }

  /** Clears in-memory scanned guest data. Called on logout / property switch. */
  clear(): void {
    this._lastScanResult = null;
  }
}

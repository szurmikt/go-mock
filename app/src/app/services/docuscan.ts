import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { ApiService } from './api';
import { ApiResponse } from '../models/auth.interfaces';
import { StorageService } from './storage';
import {
  GuestInterface,
  ScannedDataInterface,
  ScannedGuestDataInterface,
  ScanResultInterface,
} from '../models/guest.interface';

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

    for (const key of Object.keys(scannedGuestData)) {
      const val = scannedGuestData[key]?.value ?? null;
      if (docKeys.has(key)) {
        result.document[key] = val;
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
      if (key == 'document') {
        guest.document = {
          document_type: (guest.scanned_data as any)[key].document_type,
          document_number: (guest.scanned_data as any)[key].document_number,
          date_of_issue_of_the_document: (guest.scanned_data as any)[key]
            .date_of_issue_of_the_document,
        };
        continue;
      }
      (guest as any)[key] = (guest.scanned_data as any)[key];
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

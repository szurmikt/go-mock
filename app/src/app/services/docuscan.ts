import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { ApiResponse } from '../models/auth.interfaces';
import { StorageService } from './storage';
import { ScannedDataInterface, ScannedGuestDataInterface } from '../models/guest.interface';

const STORAGE_KEY = 'fieldsToScan';

@Injectable({ providedIn: 'root' })
export class DocuscanService {
  private api = inject(ApiService);
  private storage = inject(StorageService);

  private fieldsToScan: any[] = [];

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

  get(): any[] {
    return this.fieldsToScan;
  }

  async refresh(): Promise<void> {
    this.fieldsToScan = [];
    await this.storage.remove(STORAGE_KEY);
    await this.load();
  }

  private async fetchScanFields(): Promise<any[]> {
    const resp = await firstValueFrom(
      this.api.get<ApiResponse<{ scan_fields: any[] }>>('properties/settings'),
    );
    if (!resp.success) throw new Error('Failed to load scan fields');
    return resp.data.scan_fields;
  }

  scannedGuestDataToScannedData(scannedGuestData: ScannedGuestDataInterface): ScannedDataInterface {
    const result: any = { document: {} };
    const docKeys = new Set(['document_type', 'document_number', 'date_of_issue_of_the_document']);

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

  sendStatistics(_guestId: string, _documentId: string, _status: string, _documentData: any): void {
    // wired in a later phase
  }
}

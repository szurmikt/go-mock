import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../services/api';
import {
  GuestInterface,
  GuestPostInterface,
  ScannedDataInterface,
  ScannedGuestDataInterface,
  ScanResultInterface,
} from '../../models/guest.interface';
import { StorageService } from '../../services/storage';
import { DocumentData } from '../../models/statistics-interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DocuscanService {
  storage = inject(StorageService);
  api = inject(ApiService);

  fieldsToScan: any[] = [];

  private _lastScanResult: ScanResultInterface | null = null;

  // _lastScannedData: ScannedDataInterface | null = {
  //   doc_reader_scanned_document_id: '',
  //   first_name: '',
  //   last_name: '',
  //   full_name: '',
  //   mother_name: '',
  //   maiden_name: '',
  //   birth_date: '',
  //   birth_place: '',
  //   gender: '',
  //   citizenship: '',
  //   age: 0,
  //   document: {
  //     document_type: '',
  //     document_number: '',
  //     date_of_issue_of_the_document: '',
  //   },
  // };

  // _lastDocumentData: DocumentData | null = {
  //   document_type: '',
  //   scan_type: '',
  //   date_of_issue: '',
  //   message: '',
  // };

  STORAGE_KEY = 'fieldsToScan';

  constructor() {}

  async load(): Promise<void> {
    if (this.fieldsToScan.length > 0) return;

    const stored = await this.storage.get<any[]>(this.STORAGE_KEY);
    if (stored) {
      this.fieldsToScan = stored;
      return;
    }

    this.fieldsToScan = await this.fetchScanFields();

    await this.storage.set('fieldsToScan', this.fieldsToScan);
  }

  /** Synchronous access */
  get() {
    return this.fieldsToScan;
  }

  /** Optional helper */
  isLoaded(): boolean {
    return !!this.fieldsToScan;
  }

  /** Optional force refresh */
  async refresh(): Promise<void> {
    this.fieldsToScan = [];
    await this.load();
  }

  fetchScanFields(): Promise<any> {
    console.log(
      'fetchScanFields caller:',
      new Error().stack?.split('\n')[2]?.trim().split(' ')[1],
    );
    const obs = this.api.get('properties/settings');
    return new Promise((resolve, reject) => {
      obs.subscribe((res: any) => {
        if (res.success) {
          resolve(res.data.scan_fields);
        } else {
          reject(res.errors[0]);
        }
      });
    });
  }

  postFieldInit(
    scannedGuestData: ScannedGuestDataInterface,
    guest: GuestInterface,
  ) {
    scannedGuestData['guest_id'] = {
      value: guest.guest_id,
      formatted_value: guest.guest_id,
      modified: false,
      error: false,
    };
    scannedGuestData['reservation_guest_id'] = {
      value: guest.reservation_guest_id,
      formatted_value: guest.reservation_guest_id,
      modified: false,
      error: false,
    };
    scannedGuestData['doc_reader_scanned_document_id'] = {
      value:
        guest.scanned_data == null
          ? null
          : guest.scanned_data.doc_reader_scanned_document_id,
      formatted_value:
        guest.scanned_data == null
          ? null
          : guest.scanned_data.doc_reader_scanned_document_id,
      modified: false,
      error: false,
    };
    return scannedGuestData;
  }

  public get lastScanResult(): ScanResultInterface | null {
    return this._lastScanResult;
  }

  public set lastScanResult(data: ScanResultInterface | null) {
    this._lastScanResult = data;
  }
  // public get lastScannedData(): ScannedDataInterface | null {
  //   return this._lastScannedData;
  // }

  // public set lastScannedData(data: ScannedDataInterface | null) {
  //   console.log('lastScannedData setter data', data);

  //   this._lastScannedData = data;
  // }

  // public get lastDocumentData(): DocumentData | null {
  //   return this._lastDocumentData;
  // }

  // public set lastDocumentData(data: DocumentData | null) {
  //   this._lastDocumentData = data;
  // }

  public scannedDataToGuestScannedData(
    scannedGuestData: ScannedGuestDataInterface,
  ) {
    let scannedData: ScannedDataInterface = {} as any;
    for (let key in scannedGuestData) {
      if (
        key === 'document_type' ||
        key === 'document_number' ||
        key === 'date_of_issue_of_the_document'
      ) {
        if (!scannedData.document) {
          scannedData.document = {
            document_type: '',
            document_number: '',
            date_of_issue_of_the_document: '',
          };
        }
        (scannedData.document as any)[key] = scannedGuestData[key].value;
      } else {
        (scannedData as any)[key] = scannedGuestData[key].value;
      }
    }
    return scannedData;
  }

  public fillGuestDataFromScannedData(guest: GuestInterface) {
    let scannedData: ScannedDataInterface = {} as any;
    for (let key in guest.scanned_data) {
      // console.log('key:', key, 'value:', (guest.scanned_data as any)[key]);
      if (key == 'doc_reader_scanned_document_id') {
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

  public sendStatistics(
    guest_id: string,
    document_id: string,
    status: any,
    documentData: DocumentData,
  ): Observable<any> {
    return this.api.put('guests/scan_statistics', {
      reservation_guest_id: guest_id,
      doc_reader_scanned_document_id: document_id,
      status: status,
      scan_type: documentData.scan_type,
      message: documentData.message,
      date_of_issue: documentData.date_of_issue,
      type: documentData.document_type,
    });
  }
}

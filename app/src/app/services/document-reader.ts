import { inject, Injectable, signal } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
import { DocuscanService } from './docuscan';
import { ScannedDataInterface } from '../models/guest.interface';

interface NativeDocumentReaderPlugin {
  initialize(): Promise<void>;
  scan(): Promise<{ cancelled: boolean; fields?: Record<string, string> }>;
}

const NativeDocumentReader = registerPlugin<NativeDocumentReaderPlugin>('DocumentReader');

export enum ReaderStatus {
  INIT = 0,
  READY = 1,
  PROCESSING = 2,
  FINISHED = 3,
  TIMEOUT = 4,
  CANCELLED = 5,
  INTERRUPTED = 6,
  ERROR = 7,
}

@Injectable({ providedIn: 'root' })
export class DocumentReaderService {
  private docuscan = inject(DocuscanService);
  private _status = signal<ReaderStatus>(ReaderStatus.INIT);
  private _scanResult = signal<ScannedDataInterface | null>(null);
  readonly status = this._status.asReadonly();
  readonly scanResult = this._scanResult.asReadonly();

  async init(): Promise<void> {
    try {
      await NativeDocumentReader.initialize();
      this._status.set(ReaderStatus.READY);
    } catch (e) {
      this._status.set(ReaderStatus.ERROR);
      throw e;
    }
  }

  async scan(): Promise<boolean> {
    this._status.set(ReaderStatus.PROCESSING);
    try {
      const result = await NativeDocumentReader.scan();
      if (result.cancelled) {
        this._status.set(ReaderStatus.CANCELLED);
        return false;
      }
      const scanFields = this.docuscan.get();
      const rawFields: Record<string, any> = {};
      for (const sf of scanFields) {
        const val = result.fields?.[String(sf.regula_id)];
        if (val) rawFields[sf.name] = { value: val, formatted_value: val, modified: false };
      }
      const mapped = this.docuscan.scannedGuestDataToScannedData(rawFields);
      this._scanResult.set(mapped);
      this._status.set(ReaderStatus.FINISHED);
      return true;
    } catch (e) {
      this._status.set(ReaderStatus.ERROR);
      throw e;
    }
  }
}

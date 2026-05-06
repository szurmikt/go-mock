import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  DocumentReader,
  DocReaderAction,
  InitConfig,
  ResultType,
  ScannerConfig,
  Scenario,
  Results,
  DocReaderException,
} from '@regulaforensics/document-reader';
import { DocuscanService } from './docuscan';
import { ScannedGuestDataInterface } from '../models/guest.interface';

export interface DocumentData {
  document_type: string;
  scan_type: string;
  date_of_issue: string;
  message: string;
}

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

const REGULA_DATABASE_ID = 'Full';

// Document type ID arrays from old app config
const ID_CARDS = [12, 16, 20, 28, 75, 76, 77, 83, 97, 98, 106, 121, 159, 160, 161, 162, 177, 212, 213, 216, 224, 225];
const PASSPORTS = [11, 13, 14, 17, 26, 27, 172, 179, 198, 199, 200, 201, 202, 203, 204, 218];
const DRIVING_LICENCES = [
  36, 37, 38, 39, 40, 41, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 80, 81, 82, 84,
  85, 86, 87, 88, 89, 105, 107, 108, 109, 110, 112, 113, 114, 115, 116, 117,
  118, 119, 120, 126, 127, 132, 134, 135, 136, 138, 139, 140, 148, 149, 156,
  157, 158, 163, 164, 165, 169, 170, 171, 176, 187, 234, 235,
];

@Injectable({ providedIn: 'root' })
export class DocumentReaderService {
  private docuscan = inject(DocuscanService);

  private reader = DocumentReader.instance;

  private _status = signal<ReaderStatus>(ReaderStatus.INIT);
  private _scanResult = signal<{ documentData: DocumentData; scannedData: ScannedGuestDataInterface } | null>(null);

  readonly status = this._status.asReadonly();
  readonly scanResult = this._scanResult.asReadonly();

  private scannedGuestData: ScannedGuestDataInterface = {};
  private documentData: DocumentData = { document_type: '', scan_type: '', date_of_issue: '', message: '' };

  constructor() {
    if (!Capacitor.isNativePlatform()) return;
    this.reader.processParams.multipageProcessing = true;
    this.reader.processParams.dateFormat = 'yyyy-mm-dd';
    this.reader.functionality.showTorchButton = true;
  }

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this._status.set(ReaderStatus.ERROR);
      return;
    }
    const ok = await this.initialize();
    if (!ok) return;
    this._status.set(ReaderStatus.READY);
  }

  async scan(): Promise<boolean> {
    if (!(await this.reader.isReady())) return false;
    this._scanResult.set(null);
    this.reader.startScanner(
      ScannerConfig.withScenario(Scenario.FULL_PROCESS),
      this.handleCompletion.bind(this),
    );
    return true;
  }

  private handleCompletion(
    action: DocReaderAction,
    results: Results | null,
    error: DocReaderException | null,
  ): void {
    if (error) {
      console.error('DocumentReader error', error);
      this._status.set(ReaderStatus.ERROR);
      return;
    }

    if (action === DocReaderAction.TIMEOUT) {
      this._status.set(ReaderStatus.TIMEOUT);
    } else if (action === DocReaderAction.CANCEL) {
      this._status.set(ReaderStatus.CANCELLED);
    } else if (DocReaderAction.interrupted(action)) {
      this._status.set(ReaderStatus.INTERRUPTED);
    } else if (DocReaderAction.stopped(action)) {
      this.processResults(results);
    }
  }

  private async processResults(results: Results | null): Promise<void> {
    this._status.set(ReaderStatus.PROCESSING);

    if (!results) {
      this._status.set(ReaderStatus.ERROR);
      return;
    }

    const fieldsToScan = this.docuscan.get();
    const issuingAuthority = await results.textFieldValueByType(1);

    this.documentData = {
      document_type: results.documentType?.[0]?.name ?? '',
      date_of_issue: (await results.textFieldValueByType(4)) ?? '',
      scan_type: 'ocr',
      message: '',
    };

    const initVal = { value: null, formatted_value: null, modified: false, error: false };
    this.scannedGuestData = {};
    for (const f of fieldsToScan) {
      this.scannedGuestData[f.name] = { ...initVal };
    }

    for (const field of fieldsToScan) {
      let fieldValue: string | null = null;

      if (field.regula_id === 0 && results.documentType && results.documentType.length > 0) {
        const docTypeId = results.documentType[0].type ?? 0;
        if (DRIVING_LICENCES.includes(docTypeId)) fieldValue = 'driving_license';
        else if (PASSPORTS.includes(docTypeId)) fieldValue = 'passport';
        else if (ID_CARDS.includes(docTypeId)) fieldValue = 'id';
      } else {
        let val = await results.textFieldValueByTypeLcid(field.regula_id, field.lc_id);
        if (!val) val = await results.textFieldValueByType(field.regula_id);

        // MaidenName fallback (regula_id 126 → 432)
        if (field.regula_id === 126 && !val) {
          val = await results.textFieldValueByTypeLcid(432, field.lc_id);
          if (!val) val = await results.textFieldValueByType(432);
        }

        fieldValue = val || null;

        // Skip Turkish ID number for non-Turkish documents
        if (field.name === 'turkish_republic_identity_number' && issuingAuthority !== 'TUR' && issuingAuthority !== 'KKT') {
          fieldValue = null;
        }

        // Clean MRZ artifacts and title-case for localised fields
        if (fieldValue && field.lc_id !== 0) {
          fieldValue = fieldValue
            .replace(/\^/g, '')
            .replace(/>>/g, ' ')
            .replace(/<</g, ' ')
            .replace(/>/g, ' ')
            .replace(/</g, ' ')
            .replace(/\n/g, '')
            .replace(/,/g, ', ')
            .toLowerCase()
            .replace(/(^\w|\s\w|\(\w)/g, (m: string) => m.toUpperCase());
          fieldValue = fieldValue.charAt(0).toUpperCase() + fieldValue.slice(1);
        }
      }

      // Gender mapping
      if (field.regula_id === 12) {
        fieldValue = fieldValue === 'M' ? 'Male' : fieldValue === 'F' ? 'Female' : null;
      }

      this.scannedGuestData[field.name] = { value: fieldValue, formatted_value: fieldValue, modified: false, error: false };
    }

    this.fixNameFields();

    this._status.set(ReaderStatus.FINISHED);
    this._scanResult.set({ documentData: this.documentData, scannedData: this.scannedGuestData });
  }

  private fixNameFields(): void {
    const firstName: string = this.scannedGuestData['first_name']?.value;
    const lastName: string = this.scannedGuestData['last_name']?.value;
    const fullName: string = this.scannedGuestData['full_name']?.value;

    if (!fullName) return;

    let resolvedFirst = firstName;
    let resolvedLast = lastName;

    if (!firstName && !lastName) {
      const parts = fullName.split(' ');
      if (parts.length > 2) {
        resolvedFirst = parts.slice(0, 2).join(' ');
        resolvedLast = parts.slice(2).join(' ');
      } else {
        resolvedFirst = parts[1] ?? '';
        resolvedLast = parts[0] ?? '';
      }
    } else if (firstName) {
      resolvedFirst = fullName.slice(-firstName.length).trim();
      resolvedLast = fullName.slice(0, fullName.length - firstName.length).trim();
    }

    const resolved = `${resolvedFirst} ${resolvedLast}`.trim();

    const wrap = (v: string | null) => ({ value: v, formatted_value: v, modified: false, error: false });
    this.scannedGuestData['first_name'] = wrap(resolvedFirst ?? null);
    this.scannedGuestData['last_name'] = wrap(resolvedLast ?? null);
    this.scannedGuestData['full_name'] = wrap(resolved);
  }

  private async initialize(): Promise<boolean> {
    const isReady = await this.reader.isReady();

    if (!isReady) {
      const [, dbErr] = await this.reader.prepareDatabase(REGULA_DATABASE_ID, console.log);
      if (dbErr) { console.error('prepareDatabase error', dbErr); this._status.set(ReaderStatus.ERROR); return false; }

      this._status.set(ReaderStatus.INIT);

      const license = await this.readLicense();
      const config = new InitConfig(license);
      config.delayedNNLoad = true;

      const [, initErr] = await this.reader.initialize(config);
      if (initErr) { console.error('initialize error', initErr); this._status.set(ReaderStatus.ERROR); return false; }
    }

    await this.initializeFields();
    return true;
  }

  private async initializeFields(): Promise<void> {
    if (this.docuscan.get().length === 0) {
      await this.docuscan.load();
    }
    const initVal = { value: null, formatted_value: null, modified: false, error: false };
    for (const f of this.docuscan.get()) {
      this.scannedGuestData[f.name] = { ...initVal };
    }
  }

  private async readLicense(): Promise<string> {
    const res = await fetch('assets/regula.license');
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const fr = DocumentReaderService.getFileReader();
      fr.onload = () => {
        let result = fr.result as string;
        result = result.substring(result.indexOf(',') + 1);
        resolve(result);
      };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  // Zone-patched FileReader workaround (same as old app)
  private static getFileReader(): FileReader {
    const fr = new FileReader();
    return (fr as any).__zone_symbol__originalInstance ?? fr;
  }
}

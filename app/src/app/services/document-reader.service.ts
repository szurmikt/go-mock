// document-reader.service.ts
import { Injectable, inject, signal } from '@angular/core';
import {
  DocumentReader,
  DocReaderAction,
  InitConfig,
  ResultType,
  RFIDConfig,
  ScannerConfig,
  Scenario,
  Results,
  DocReaderException,
  DocReaderScenario,
} from '@regulaforensics/document-reader';

import { Config } from '../config/config';

import {
  GuestPostInterface,
  ScannedDataInterface,
  ScannedGuestDataInterface,
  ScanResultInterface,
} from '../models/guest.interface';
import { DocumentData } from '../models/statistics-interface';

import { DocuscanService } from './docuscan.service';

import { DefaultValuePipe } from '../pipes/default-value.pipe';

@Injectable({ providedIn: 'root' })
export class DocumentReaderService {
  reader = DocumentReader.instance;
  docuscanService = inject(DocuscanService);

  private _readerStatus = signal<ReaderStatus>(ReaderStatus.INIT);
  readonly readerStatus = this._readerStatus.asReadonly();

  private _scanResult = signal<ScanResultInterface>({
    documentData: null,
    scannedData: null,
  });
  readonly scanResult = this._scanResult.asReadonly();

  private _scenarios = signal<DocReaderScenario[]>([]);
  readonly scenarios = this._scenarios.asReadonly();

  selectedScenario: Scenario = Scenario.FULL_PROCESS;

  private _canRfid = signal<boolean>(false);
  readonly canRfid = this._canRfid.asReadonly();

  doRfid = false;
  isReadingRfid = false;

  fieldsToScan: any;
  options: any;

  private documentData: DocumentData = {
    document_type: '',
    scan_type: '',
    date_of_issue: '',
    message: '',
  };

  guestPostData: GuestPostInterface = {
    // address: {},
    guest: {},
    reservation_code: '',
  };

  scannedData: ScannedDataInterface = {
    doc_reader_scanned_document_id: '',
    first_name: '',
    last_name: '',
    full_name: '',
    mother_name: '',
    maiden_name: '',
    birth_date: '',
    birth_place: '',
    gender: '',
    citizenship: '',
    age: 0,
    document: {
      document_type: '',
      document_number: '',
      date_of_issue_of_the_document: '',
    },
  };

  scannedGuestData: ScannedGuestDataInterface = {};

  constructor() {
    this.reader.processParams.multipageProcessing = true;
    this.reader.processParams.dateFormat = 'yyyy-mm-dd';
    this.reader.functionality.showTorchButton = true;
  }

  @LogMethod
  async init() {
    if (this._readerStatus() === ReaderStatus.READY) return;

    const ok = await this.initialize();
    if (!ok) return;

    this._canRfid.set(await this.reader.isRFIDAvailableForUse());
    this._readerStatus.set(ReaderStatus.READY);
  }

  async scan() {
    if (!(await this.reader.isReady())) return;

    this.clearResults();

    this.reader.startScanner(
      ScannerConfig.withScenario(this.selectedScenario),
      this.handleCompletion.bind(this),
    );
  }

  private handleCompletion(
    action: DocReaderAction,
    results: Results | null,
    error: DocReaderException | null,
  ) {
    this.handleException(error);

    console.log(
      'handleCompletion action',
      action,
      'key',
      this.getReaderActionKey(action),
    );
    // console.log('handleCompletion results', results);
    // console.log('handleCompletion error', error);

    // console.log('handleCompletion this.doRfid', this.doRfid);
    // console.log('handleCompletion this.isReadingRfid', this.isReadingRfid);
    // console.log('handleCompletion results != null', results != null);
    // console.log('handleCompletion results.chipPage', results?.chipPage);

    let shoudlRfid = this.shouldRfid(results);
    // console.log('handleCompletion shouldRfid', shoudlRfid);

    if (action === DocReaderAction.TIMEOUT) {
      this._readerStatus.set(ReaderStatus.TIMEOUT);
    } else if (action === DocReaderAction.CANCEL) {
      this._readerStatus.set(ReaderStatus.CANCELLED);
    } else if (DocReaderAction.interrupted(action)) {
      this._readerStatus.set(ReaderStatus.INTERRUPTED);
    } else if (DocReaderAction.stopped(action) && !this.shouldRfid(results)) {
      console.log('handleCompletion processResults', results);
      this.processResults(results);
    } else if (DocReaderAction.finished(action) && this.shouldRfid(results)) {
      this.isReadingRfid = true;
      this.readRfid();
    }

    // if (DocReaderAction.stopped(action) && !this.shouldRfid(results)) {
    //   console.log('handleCompletion processResults', results);
    //   this.processResults(results);
    // } else if (DocReaderAction.finished(action) && this.shouldRfid(results)) {
    //   this.isReadingRfid = true;
    //   this.readRfid();
    // } else if (action === DocReaderAction.TIMEOUT) {
    //   this._readerStatus.set('Scan timeout');
    // } else if (action === DocReaderAction.CANCEL) {
    //   this._readerStatus.set('Scan cancelled');
    // } else if (DocReaderAction.interrupted(action)) {
    //   this._readerStatus.set('Scan Interrupted');
    // }
  }

  private async processResults(results: Results | null) {
    this._readerStatus.set(ReaderStatus.PROCESSING);
    this.isReadingRfid = false;
    this.clearResults();

    if (!results) return;

    console.log('processResults results', results);

    let issuingAuthority = await results.textFieldValueByType(1);

    this.documentData.document_type = results.documentType![0].name ?? '';
    this.documentData.date_of_issue = await results.textFieldValueByType(4);
    this.documentData.message = '';
    this.documentData.scan_type =
      results.chipPage != 0 && this.doRfid ? 'rfid' : 'ocr';

    for (const field of this.fieldsToScan) {
      let fieldValue = null;
      if (
        field.regula_id === 0 &&
        results.documentType &&
        results.documentType.length > 0
      ) {
        console.log(results.documentType[0].type);

        if (
          Config.DRIVING_LICENCES.includes(results.documentType[0].type ?? 0)
        ) {
          fieldValue = 'driving_license';
        } else if (
          Config.PASSPORTS.includes(results.documentType[0].type ?? 0)
        ) {
          fieldValue = 'passport';
        } else if (
          Config.ID_CARDS.includes(results.documentType[0].type ?? 0)
        ) {
          fieldValue = 'id';
        }
      } else {
        if (results.chipPage != 0 && this.doRfid) {
          // this.stopRfid().then();
          let valueByLcIDSource = await results.textFieldValueByTypeLcidSource(
            field.regula_id,
            field.lc_id,
            ResultType.RFID_TEXT_DATA,
          );
          if (valueByLcIDSource == '' || valueByLcIDSource == null) {
            valueByLcIDSource = await results.textFieldValueByType(
              field.regula_id,
            );
            // MaidenName
            if (
              field.regula_id === 126 &&
              (valueByLcIDSource == '' || valueByLcIDSource == null)
            ) {
              valueByLcIDSource = await results.textFieldValueByTypeLcidSource(
                432,
                field.lc_id,
                ResultType.RFID_TEXT_DATA,
              );
              if (valueByLcIDSource == '' && valueByLcIDSource == null) {
                valueByLcIDSource = await results.textFieldValueByType(432);
              }
            }
          }
          fieldValue = valueByLcIDSource;
        } else {
          // this.stopScan().then();
          let valueByLcID = await results.textFieldValueByTypeLcid(
            field.regula_id,
            field.lc_id,
          );
          if (valueByLcID == '' || valueByLcID == null) {
            valueByLcID = await results.textFieldValueByType(field.regula_id);
            // MaidenName
            if (
              field.regula_id === 126 &&
              (valueByLcID == '' || valueByLcID == null)
            ) {
              valueByLcID = await results.textFieldValueByTypeLcid(
                432,
                field.lc_id,
              );
              if (valueByLcID == '' && valueByLcID == null) {
                valueByLcID = await results.textFieldValueByType(432);
              }
            }
          }
          fieldValue = valueByLcID;
        }

        if (fieldValue == '') {
          fieldValue = null;
        }

        if (field.name == 'document_number') {
          fieldValue = this.alterDocNumber(fieldValue);
        }

        if (
          issuingAuthority != 'TUR' &&
          issuingAuthority != 'KKT' &&
          field.name == 'turkish_republic_identity_number'
        ) {
          fieldValue = null;
        }

        if (field.lc_id !== 0) {
          // Remove \n, ^ characters from string, make uppercase the first letter of non-unicode string
          if (fieldValue != null) {
            fieldValue =
              fieldValue.indexOf('^') > 0
                ? fieldValue.replace('^', '')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('>>') > 0
                ? fieldValue.replace('>>', ' ')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('<<') > 0
                ? fieldValue.replace('<<', ' ')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('>') > 0
                ? fieldValue.replace('>', ' ')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('<') > 0
                ? fieldValue.replace('<', ' ')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf('\n') > 0
                ? fieldValue.replace('\n', '')
                : fieldValue;
            fieldValue =
              fieldValue.indexOf(',') > 0
                ? fieldValue.replace(',', ', ')
                : fieldValue;
            fieldValue = fieldValue
              .toLowerCase()
              .replace(/(^\w|\s\w|\(\w)/g, (m: any) => m.toUpperCase());
            fieldValue =
              fieldValue.charAt(0).toUpperCase() + fieldValue.slice(1);
          }
        }
      }

      // Gender manipulation
      if (field.regula_id === 12) {
        fieldValue =
          fieldValue === 'M' ? 'Male' : fieldValue === 'F' ? 'Female' : null;
      }
      this.scannedGuestData[field.name] = {
        value: fieldValue,
        formatted_value: fieldValue,
        modified: false,
        error: false,
      };
    }

    this.alterPersonalData();

    this.fixNameFields();

    this.fixCountryAndCitizenshipFields();

    // this.docuscanService.lastGuestPostData = this.guestPostData;
    // console.log(
    //   'this.docuscanService.lastGuestPostData',
    //   this.docuscanService.lastGuestPostData,
    // );

    // this.docuscanService.lastDocumentData = this.documentData;
    // console.log(
    //   'this.docuscanService.lastDocumentData',
    //   this.docuscanService.lastDocumentData,
    // );

    console.log('processResults this.guestPostData', this.guestPostData);
    console.log('processResults this.scannedGuestData', this.scannedGuestData);
    console.log('processResults this.documentData', this.documentData);

    this._readerStatus.set(ReaderStatus.FINISHED);
    this._scanResult.set({
      documentData: this.documentData,
      scannedData: this.scannedGuestData,
    });
  }

  private fixCountryAndCitizenshipFields() {
    if (
      this.scannedGuestData.hasOwnProperty('citizenship') &&
      this.scannedGuestData.hasOwnProperty('country_code')
    ) {
      console.log('has citizenship && country_code');

      if (
        this.scannedGuestData['country_code'] != null &&
        this.scannedGuestData['country_code']['formatted_value'] != null
      ) {
        console.log('has country_code && country_code formatted');
        let defaultPipe = new DefaultValuePipe();
        this.scannedGuestData['citizenship']['formatted_value'] =
          defaultPipe.transform(
            this.scannedGuestData['country_code'][
              'formatted_value'
            ].toLocaleUpperCase(),
            this.options,
            'country',
            'ID',
          );
      } else {
        if (
          this.scannedGuestData['citizenship'] != null &&
          this.scannedGuestData['country_code']['formatted_value'] != null &&
          this.scannedGuestData['citizenship']['formatted_value'].length == 3
        ) {
          let defaultPipe = new DefaultValuePipe();
          this.scannedGuestData['citizenship']['formatted_value'] =
            defaultPipe.transform(
              this.scannedGuestData['citizenship'][
                'formatted_value'
              ].toLocaleUpperCase(),
              this.options,

              'country',
              'ID',
            );
        } else {
          this.scannedGuestData['citizenship']['formatted_value'] = null;
        }
      }
      this.scannedGuestData['citizenship']['value'] =
        this.scannedGuestData['country_code']['value'];
    } else {
      console.log('NOT has citizenship && country_code');
    }
  }

  private fixNameFields() {
    let clientFirstName: string = this.scannedGuestData['first_name'].value;
    let clientLastName: string = this.scannedGuestData['last_name'].value;
    let fullName: string = this.scannedGuestData['full_name'].value;
    let clientMiddleName: string = '';
    if (clientFirstName == null && clientLastName == null) {
      let names = fullName.split(' ');
      clientFirstName = '';
      clientLastName = '';
      if (names.length > 2) {
        for (const i in names) {
          if (i < '2') {
            clientFirstName += ' ' + names[i];
          } else {
            clientLastName += ' ' + names[i];
          }
        }
      } else {
        clientFirstName += ' ' + names[1];
        clientLastName += ' ' + names[0];
      }

      clientFirstName = clientFirstName.trim();
      clientLastName = clientLastName.trim();
      fullName = clientFirstName + ' ' + clientLastName;
    } else {
      clientFirstName = fullName.slice(-clientFirstName.length).trim();
      clientLastName = fullName
        .slice(0, fullName.length - clientFirstName.length)
        .trim();
      fullName = clientFirstName + ' ' + clientLastName;
    }

    if (this.scannedGuestData.hasOwnProperty('middle_name')) {
      clientMiddleName = this.scannedGuestData['middle_name'].value;
      const splittedLastName = clientLastName.split(' ');
      if (clientMiddleName == null) {
        if (splittedLastName.length > 1) {
          clientMiddleName = splittedLastName[1].trim();
        }
        clientLastName = splittedLastName[0].trim();
      } else {
        clientLastName = splittedLastName[0].trim();
      }
      this.scannedGuestData['middle_name'] = {
        value: clientMiddleName,
        formatted_value: clientMiddleName,
        modified: false,
        error: false,
      };
    }

    this.scannedGuestData['first_name'] = {
      value: clientFirstName,
      formatted_value: clientFirstName,
      modified: false,
      error: false,
    };
    this.scannedGuestData['last_name'] = {
      value: clientLastName,
      formatted_value: clientLastName,
      modified: false,
      error: false,
    };
    this.scannedGuestData['full_name'] = {
      value: fullName,
      formatted_value: fullName,
      modified: false,
      error: false,
    };
  }

  private alterDocNumber(fieldValue: string | null): string | null {
    if (fieldValue == '392018EA') {
      fieldValue = '123456AA';
    }
    if (fieldValue == '836909UE') {
      fieldValue = '123456BB';
    }
    if (fieldValue == 'CW911175') {
      fieldValue = '123456CC';
    }
    return fieldValue;
  }

  private alterPersonalData() {
    if (
      this.scannedGuestData.hasOwnProperty('document_number') &&
      this.scannedGuestData['document_number'].value == '123456AA'
    ) {
      if (this.scannedGuestData.hasOwnProperty('mother_name')) {
        this.scannedGuestData['mother_name'].value = 'Test Mother';
        this.scannedGuestData['mother_name'].formatted_value = 'Test Mother';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_date')) {
        this.scannedGuestData['birth_date'].value = '2000-01-01';
        this.scannedGuestData['birth_date'].formatted_value = '2000-01-01';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_place')) {
        this.scannedGuestData['birth_place'].value = 'Baja';
        this.scannedGuestData['birth_place'].formatted_value = 'Baja';
      }
    }

    if (
      this.scannedGuestData.hasOwnProperty('document_number') &&
      this.scannedGuestData['document_number'].value == '123456BB'
    ) {
      if (this.scannedGuestData.hasOwnProperty('mother_name')) {
        this.scannedGuestData['mother_name'].value = 'Test Mother BB';
        this.scannedGuestData['mother_name'].formatted_value = 'Test Mother BB';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_date')) {
        this.scannedGuestData['birth_date'].value = '1980-01-01';
        this.scannedGuestData['birth_date'].formatted_value = '1980-01-01';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_place')) {
        this.scannedGuestData['birth_place'].value = 'Bp';
        this.scannedGuestData['birth_place'].formatted_value = 'Bp';
      }
    }

    if (
      this.scannedGuestData.hasOwnProperty('document_number') &&
      this.scannedGuestData['document_number'].value == '123456CC'
    ) {
      if (this.scannedGuestData.hasOwnProperty('mother_name')) {
        this.scannedGuestData['mother_name'].value = 'Test Mother CC';
        this.scannedGuestData['mother_name'].formatted_value = 'Test Mother CC';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_date')) {
        this.scannedGuestData['birth_date'].value = '1970-01-01';
        this.scannedGuestData['birth_date'].formatted_value = '1970-01-01';
      }
      if (this.scannedGuestData.hasOwnProperty('birth_place')) {
        this.scannedGuestData['birth_place'].value = 'Bp 8ker';
        this.scannedGuestData['birth_place'].formatted_value = 'Bp 8ker';
      }
    }
  }

  private readRfid() {
    console.log('readRfid called');

    this.reader.rfid(new RFIDConfig(this.handleCompletion.bind(this)));
  }

  private shouldRfid(results: Results | null) {
    return (
      this.doRfid &&
      !this.isReadingRfid &&
      results != null &&
      results.chipPage != 0
    );
  }

  private async initialize(): Promise<boolean> {
    console.log('DocumentReaderService initialize');
    let isReady = await this.reader.isReady();
    console.log('DocumentReaderService reader.isReady()', isReady);

    if (!isReady) {
      let status = await this.reader.status();
      console.log('DocumentReaderService reader.status()', status);
      // if (isReady) return true;

      var [success, error] = await this.reader.prepareDatabase(
        'Full',
        console.log,
      );
      this.handleException(error);
      console.log('DocumentReaderService prepareDatabase success', success);

      this._readerStatus.set(ReaderStatus.INIT);

      const license = await this.readLicense();
      // console.log('DocumentReaderService initialize license', license);
      const config = new InitConfig(license);
      config.delayedNNLoad = true;

      const [success_init, error_init] = await this.reader.initialize(config);

      this.handleException(error_init);
      console.log('DocumentReaderService initialize success', success_init);
    }

    await this.initializeFields();

    return true;
  }

  private async initializeFields() {
    let initValue = {
      value: null,
      formatted_value: null,
      modified: false,
      error: false,
    };
    console.log(
      'DocumentReaderService initializeFields this.fieldsToScan',
      this.fieldsToScan,
    );
    if (!this.fieldsToScan || this.fieldsToScan.length == 0) {
      this.fieldsToScan = await this.docuscanService.fetchScanFields().then();
    }
    console.log(
      'DocumentReaderService initializeFields this.fieldsToScan after fetch',
      this.fieldsToScan,
    );

    for (const i of this.fieldsToScan) {
      this.scannedGuestData[i.name] = initValue;
    }

    this.scannedGuestData['guest_id'] = initValue;
    this.scannedGuestData['reservation_guest_id'] = initValue;
    this.scannedGuestData['doc_reader_scanned_document_id'] = initValue;
  }

  private handleException(error: DocReaderException | null) {
    if (error) {
      this._readerStatus.set(ReaderStatus.ERROR);
      console.error('handleException', error);
    }
  }

  private async readLicense(): Promise<string> {
    try {
      const res = await fetch('assets/regula.license');
      // console.log('readLicense res', res);
      const blob = await res.blob();
      // console.log('readLicense blob', blob);

      const data: string = await new Promise((resolve, reject) => {
        const reader = DocumentReaderService.getFileReader();
        // console.log('readLicense reader', reader);
        reader.onload = () => {
          let result = reader.result as string;
          result = result.substring(result.indexOf(',') + 1);
          // console.log('readLicense result', result);
          resolve(result);
        };

        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  toggleRfid() {
    this.doRfid = !this.doRfid;
    console.log('toggleRfid this.doRfid', this.doRfid);
  }

  setScenario(s: string) {
    this.selectedScenario = s as Scenario;
  }

  clearResults() {
    this._readerStatus.set(ReaderStatus.READY);
  }

  private static getFileReader(): FileReader {
    const fileReader = new FileReader();
    return (fileReader as any).__zone_symbol__originalInstance;
  }

  getReaderStatusKey(status: ReaderStatus): string {
    for (const key in ReaderStatus) {
      if ((ReaderStatus as any)[key] === status) {
        return key;
      }
    }
    return 'Unknown status';
  }

  private getReaderActionKey(action: DocReaderAction): string {
    // return Object.keys(action).find(
    //     key => action[key] === 2
    //   )
    for (const key in DocReaderAction) {
      if ((DocReaderAction as any)[key] === action) {
        return key;
      }
    }
    return 'Unknown Action';
  }
}

function loggedMethod(originalMethod: any, _context: any) {
  function replacementMethod(this: any, ...args: any[]) {
    console.log('LOG: Entering method.');
    const result = originalMethod.call(this, ...args);
    console.log('LOG: Exiting method.');
    return result;
  }

  return replacementMethod;
}

// Step 1: Create a function (method) decorator
function LogMethod(
  target: any,
  methodName: string,
  descriptor: PropertyDescriptor,
) {
  const originalMethod = descriptor.value; // Save the original method

  descriptor.value = function (...args: any[]) {
    console.log(`Method ${methodName} called with arguments:`, args);
    console.error(new Error().stack?.split('\n')[2]?.trim().split(' ')[1]);
    const result = originalMethod.apply(this, args); // Call the original method
    console.log(`Method ${methodName} returned:`, result);
    return result;
  };

  return descriptor;
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
// 1

// export async function loadAsset(path: string): Promise<string> {
//     var dir = await File.resolveDirectoryUrl(File.applicationDirectory + "www/assets")
//     var fileEntry = await File.getFile(dir, path, null)
//     var result = await new Promise<string>((resolve, _) => {
//         fileEntry.file(file => {
//             var reader = new FileReader()
//             reader.onloadend = (_) => resolve(reader.result as string)
//             reader.readAsDataURL(file)
//         })
//     })
// }

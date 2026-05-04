/** angular */
import { inject, Injectable } from '@angular/core';

/** ionic */
import { File, FileEntry } from '@awesome-cordova-plugins/file/ngx';

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

/** regula */
import {
  DocumentReader,
  DocumentReaderCompletion,
  Enum,
  ScannerConfig,
  ScenarioIdentifier,
  DocumentReaderResults,
} from '@regulaforensics/ionic-native-document-reader/ngx';

/** rxjs */
import { Observable } from 'rxjs';

/** config */
import { Config } from '../config/config';

/** services */
import { SharedService } from './shared.service';
import { GuestPostInterface } from '../models/guest.interface';
import { HttpClient } from '@angular/common/http';
import { DocuscanService } from './docuscan.service';

@Injectable({
  providedIn: 'root',
})
export class RegulaService {
  docuscanService = inject(DocuscanService);

  fieldsToScan: any;

  _isRegulaDBLoaded = false;
  _isRegulaSDKInitialized = false;

  guestPostData: GuestPostInterface = {
    // address: {},
    guest: {},
    reservation_code: '',
  };

  constructor(
    private http: HttpClient,
    private file: File,
    private documentReader: DocumentReader,
    private shared: SharedService,
  ) {
    // this.fieldsToScan = this.docuscanService.getScanFields();
    // console.log(
    //   'RegulaService constructor this.fieldsToScan',
    //   this.fieldsToScan,
    // );
  }

  private static getFileReader(): FileReader {
    const fileReader = new FileReader();
    return (fileReader as any).__zone_symbol__originalInstance;
  }

  /**
   * Handles the completion event from the document reader.
   * Extracts, formats, and populates guest data based on the scan results.
   *
   * @param completion The completion object from the document reader scan.
   * @param isRfid Indicates if the data comes from an RFID scan.
   * @returns A promise that resolves with the populated guest data object or rejects on failure.
   */
  async _handleCompletion(
    completion: DocumentReaderCompletion,
    isRfid: boolean,
  ): Promise<any> {
    await this.initializeFields();
    return new Promise<any>(async (_resolve, reject) => {
      if (
        (completion.action === Enum.DocReaderAction.COMPLETE ||
          completion.action === Enum.DocReaderAction.TIMEOUT) &&
        completion.results?.textResult != undefined &&
        completion.results?.textResult.fields != undefined &&
        completion.results.textResult.fields.length > 1 &&
        completion.results.documentType != undefined &&
        completion.results.documentType.length >= 1
      ) {
        let issuingAuthority = await this.documentReader.textFieldValueByType(
          completion.results,
          1,
        );
        console.log(
          'RegualService _handleCompletion this.issuingAuthority',
          issuingAuthority,
        );
        console.log(
          'RegualService _handleCompletion this.fieldsToScan',
          this.fieldsToScan,
        );

        for (const field of this.fieldsToScan) {
          let fieldValue = null;
          if (field.regula_id === 0) {
            if (
              Config.DRIVING_LICENCES.includes(
                completion.results.documentType[0].dType ?? 0,
              )
            ) {
              fieldValue = 'driving_license';
            } else if (
              Config.PASSPORTS.includes(
                completion.results.documentType[0].dType ?? 0,
              )
            ) {
              fieldValue = 'passport';
            } else if (
              Config.ID_CARDS.includes(
                completion.results.documentType[0].dType ?? 0,
              )
            ) {
              fieldValue = 'id';
            }
          } else {
            if (completion.results.chipPage != 0 && isRfid) {
              this.stopRfid().then();
              let valueByLcIDSource =
                await this.documentReader.textFieldValueByTypeLcidSource(
                  completion.results,
                  field.regula_id,
                  field.lc_id,
                  Enum.eRPRM_ResultType.RFID_RESULT_TYPE_RFID_TEXT_DATA,
                );
              if (valueByLcIDSource == '' || valueByLcIDSource == null) {
                valueByLcIDSource =
                  await this.documentReader.textFieldValueByType(
                    completion.results,
                    field.regula_id,
                  );
                // MaidenName
                if (
                  field.regula_id === 126 &&
                  (valueByLcIDSource == '' || valueByLcIDSource == null)
                ) {
                  valueByLcIDSource =
                    await this.documentReader.textFieldValueByTypeLcidSource(
                      completion.results,
                      432,
                      field.lc_id,
                      Enum.eRPRM_ResultType.RFID_RESULT_TYPE_RFID_TEXT_DATA,
                    );
                  if (valueByLcIDSource == '' && valueByLcIDSource == null) {
                    valueByLcIDSource =
                      await this.documentReader.textFieldValueByType(
                        completion.results,
                        432,
                      );
                  }
                }
              }
              fieldValue = valueByLcIDSource;
            } else {
              this.stopScan().then();
              let valueByLcID =
                await this.documentReader.textFieldValueByTypeLcid(
                  completion.results,
                  field.regula_id,
                  field.lc_id,
                );
              if (valueByLcID == '' || valueByLcID == null) {
                valueByLcID = await this.documentReader.textFieldValueByType(
                  completion.results,
                  field.regula_id,
                );
                // MaidenName
                if (
                  field.regula_id === 126 &&
                  (valueByLcID == '' || valueByLcID == null)
                ) {
                  valueByLcID =
                    await this.documentReader.textFieldValueByTypeLcid(
                      completion.results,
                      432,
                      field.lc_id,
                    );
                  if (valueByLcID == '' && valueByLcID == null) {
                    valueByLcID =
                      await this.documentReader.textFieldValueByType(
                        completion.results,
                        432,
                      );
                  }
                }
              }
              fieldValue = valueByLcID;
            }

            if (fieldValue == '') {
              fieldValue = null;
            }

            if (field.name == 'document_number' && fieldValue == '392018EA') {
              fieldValue = '123456AA';
            }
            if (field.name == 'document_number' && fieldValue == '836909UE') {
              fieldValue = '123456BB';
            }
            if (field.name == 'document_number' && fieldValue == 'CW911175') {
              fieldValue = '123456CC';
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
              fieldValue === 'M'
                ? 'Male'
                : fieldValue === 'F'
                  ? 'Female'
                  : null;
          }
          this.guestPostData.guest[field.name] = {
            value: fieldValue,
            formatted_value: fieldValue,
            modified: false,
            error: false,
          };
        }
        if (
          this.guestPostData.guest.hasOwnProperty('document_number') &&
          this.guestPostData.guest['document_number'].value == '123456AA'
        ) {
          if (this.guestPostData.guest.hasOwnProperty('mother_name')) {
            this.guestPostData.guest['mother_name'].value = 'Test Mother';
            this.guestPostData.guest['mother_name'].formatted_value =
              'Test Mother';
          }
          if (this.guestPostData.guest.hasOwnProperty('birth_date')) {
            this.guestPostData.guest['birth_date'].value = '2000-01-01';
            this.guestPostData.guest['birth_date'].formatted_value =
              '2000-01-01';
          }
          if (this.guestPostData.guest.hasOwnProperty('birth_place')) {
            this.guestPostData.guest['birth_place'].value = 'Baja';
            this.guestPostData.guest['birth_place'].formatted_value = 'Baja';
          }
        }
        if (
          this.guestPostData.guest.hasOwnProperty('document_number') &&
          this.guestPostData.guest['document_number'].value == '123456BB'
        ) {
          if (this.guestPostData.guest.hasOwnProperty('mother_name')) {
            this.guestPostData.guest['mother_name'].value = 'Test Mother BB';
            this.guestPostData.guest['mother_name'].formatted_value =
              'Test Mother BB';
          }
          if (this.guestPostData.guest.hasOwnProperty('birth_date')) {
            this.guestPostData.guest['birth_date'].value = '1980-01-01';
            this.guestPostData.guest['birth_date'].formatted_value =
              '1980-01-01';
          }
          if (this.guestPostData.guest.hasOwnProperty('birth_place')) {
            this.guestPostData.guest['birth_place'].value = 'Bp';
            this.guestPostData.guest['birth_place'].formatted_value = 'Bp';
          }
        }
        if (
          this.guestPostData.guest.hasOwnProperty('document_number') &&
          this.guestPostData.guest['document_number'].value == '123456CC'
        ) {
          if (this.guestPostData.guest.hasOwnProperty('mother_name')) {
            this.guestPostData.guest['mother_name'].value = 'Test Mother CC';
            this.guestPostData.guest['mother_name'].formatted_value =
              'Test Mother CC';
          }
          if (this.guestPostData.guest.hasOwnProperty('birth_date')) {
            this.guestPostData.guest['birth_date'].value = '1970-01-01';
            this.guestPostData.guest['birth_date'].formatted_value =
              '1970-01-01';
          }
          if (this.guestPostData.guest.hasOwnProperty('birth_place')) {
            this.guestPostData.guest['birth_place'].value = 'Bp 8ker';
            this.guestPostData.guest['birth_place'].formatted_value = 'Bp 8ker';
          }
        }
        console.log(
          'RegualService _handleCompletion this.guestPostData.guest',
          this.guestPostData.guest,
        );

        let clientFirstName: string =
          this.guestPostData.guest['first_name'].value;
        let clientLastName: string =
          this.guestPostData.guest['last_name'].value;
        let fullName: string = this.guestPostData.guest['full_name'].value;
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

        if (this.guestPostData.guest.hasOwnProperty('middle_name')) {
          clientMiddleName = this.guestPostData.guest['middle_name'].value;
          const splittedLastName = clientLastName.split(' ');
          if (clientMiddleName == null) {
            if (splittedLastName.length > 1) {
              clientMiddleName = splittedLastName[1].trim();
            }
            clientLastName = splittedLastName[0].trim();
          } else {
            clientLastName = splittedLastName[0].trim();
          }
          this.guestPostData.guest['middle_name'] = {
            value: clientMiddleName,
            formatted_value: clientMiddleName,
            modified: false,
            error: false,
          };
        }

        this.guestPostData.guest['first_name'] = {
          value: clientFirstName,
          formatted_value: clientFirstName,
          modified: false,
          error: false,
        };
        this.guestPostData.guest['last_name'] = {
          value: clientLastName,
          formatted_value: clientLastName,
          modified: false,
          error: false,
        };
        this.guestPostData.guest['full_name'] = {
          value: fullName,
          formatted_value: fullName,
          modified: false,
          error: false,
        };
        _resolve(this.guestPostData.guest);
      } else {
        reject();
      }
    });
  }

  initRegulaDB(): Observable<any> {
    return this.documentReader.prepareDatabase('Full');
  }

  initRegulaSDK(): Promise<any> {
    return new Promise((resolve, reject) => {
      // resolve(true);
      this._readFile('', 'regula.license', (license: any) => {
        this.documentReader
          .initializeReader({ license: license })
          .then((initialized: any) => {
            console.log('initialized', initialized);

            this.documentReader
              .setProcessParams({
                multipageProcessing: true,
                dateFormat: 'yyyy-mm-dd',
              })
              .then();
            this.documentReader
              .setRfidScenario({
                pkdDSCertPriority: false,
                pkdUseExternalCSCA: true,
                baseSMProcedure:
                  Enum.eRFID_AccessControl_ProcedureType.ACPT_PACE,
                profilerType:
                  Enum.eRFID_SDK_ProfilerType.SPT_DOC_9303_EDITION_2006,
                authProcType:
                  Enum.eRFID_AuthenticationProcedureType.aptStandard,
                trustedPKD: false,
                passiveAuth: false,
                skipAA: false,
                readEPassport: true,
                ePassportDataGroups: {
                  DG1: true,
                  DG2: false,
                  DG3: false,
                  DG4: true,
                  DG5: true,
                  DG6: true,
                  DG7: false,
                  DG8: true,
                  DG9: true,
                  DG10: true,
                  DG11: true,
                  DG12: true,
                  DG13: true,
                  DG14: false,
                  DG15: true,
                  DG16: true,
                },
                readEID: false,
                eIDDataGroups: {
                  DG1: true,
                  DG2: true,
                  DG3: false,
                  DG4: true,
                  DG5: true,
                  DG6: true,
                  DG7: true,
                  DG8: true,
                  DG9: true,
                  DG10: true,
                  DG11: true,
                  DG12: true,
                  DG13: true,
                  DG14: false,
                  DG15: true,
                  DG16: true,
                  DG17: true,
                  DG18: true,
                  DG19: true,
                  DG20: true,
                  DG21: true,
                },
                readEDL: false,
                eDLDataGroups: {
                  DG1: true,
                  DG2: true,
                  DG3: false,
                  DG4: true,
                  DG5: true,
                  DG6: true,
                  DG7: true,
                  DG8: true,
                  DG9: true,
                  DG10: true,
                  DG11: true,
                  DG12: true,
                  DG13: true,
                  DG14: false,
                },
              })
              .then();
            this._isRegulaSDKInitialized = initialized;
            resolve(initialized);
          })
          .catch((err: any) => {
            console.error('<debug> initializeReader', err);
            reject(err);
          });
      });
    });
  }

  scan(): Observable<any> {
    let config = new ScannerConfig();
    config.scenario = ScenarioIdentifier.SCENARIO_FULL_PROCESS;
    return this.documentReader.scan(config);
  }

  scanRFID(): Observable<any> {
    return this.documentReader.startRFIDReader(false, false, false);
  }

  async setRFIDScenario(data: DocumentReaderCompletion) {
    let accessKey = await this.documentReader.textFieldValueByType(
      data.results!,
      51,
    );
    if (accessKey != null && accessKey !== '') {
      accessKey = accessKey.replace(/^/g, '').replace(/\n/g, '');
      await this.documentReader.setRfidScenario({
        mrz: accessKey,
        pacePasswordType: 1,
      });
    } else {
      accessKey = await this.documentReader.textFieldValueByType(
        data.results!,
        159,
      );
      if (accessKey != null && accessKey !== '') {
        await this.documentReader.setRfidScenario({
          mrz: accessKey,
          pacePasswordType: 2,
        });
      }
    }
  }

  stopScan() {
    return this.documentReader.stopScanner();
  }

  stopRfid() {
    return this.documentReader.stopRFIDReader();
  }

  removeDB() {
    this.documentReader.removeDatabase().then();
  }

  // getSessionLogFolder() {
  //   console.log('<!> SESSION LOG FOLDER: ', this.documentReader.getSessionLogFolder());
  // }

  private async _readFile(
    dirPath: string,
    fileName: string,
    callback: Function,
    ...items: any[]
  ) {
    let path = this.file.applicationDirectory + 'regula.license';

    fetch('assets/regula.license')
      .then((res) => res.blob())
      .then((blob) => {
        return new Promise<string>((resolve, reject) => {
          const reader = RegulaService.getFileReader();
          // reader.onloadend = () => resolve(reader.result as string);
          reader.onload = (evt) => {
            let data = (evt.target as FileReader).result as string;
            data = data.substring(data.indexOf(',') + 1);
            console.log(data);
            callback(data, items);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .then((dataUrl) => {
        console.log('Data URL:', dataUrl);
      })
      .catch((err) => console.error(err));
    return;
    console.log('_readFile() path', path);
    this.file
      .resolveLocalFilesystemUrl(path)
      .then((fileEntry) => {
        console.log(
          '_readFile() resolveLocalFilesystemUrl fileEntry.nativeURL:',
          fileEntry.nativeURL,
        );
        (fileEntry as FileEntry).file((file) => {
          const reader = RegulaService.getFileReader();
          // reader.readAsDataURL(file);
          reader.onload = (evt) => {
            let data = (evt.target as FileReader).result as string;
            data = data.substring(data.indexOf(',') + 1);
            console.log(data);
            callback(data, items);
          };
          reader.readAsDataURL(file);
        });
      })
      .catch((err) => {
        console.log('resolveLocalFilesystemUrl err:', err);
      });

    path = this.file.applicationDirectory + 'www/assets/regula.license';
    console.log('_readFile() path', path);
    this.file
      .resolveLocalFilesystemUrl(path)
      .then((fileEntry) => {
        console.log(
          '_readFile() resolveLocalFilesystemUrl fileEntry.nativeURL:',
          fileEntry.nativeURL,
        );
        (fileEntry as FileEntry).file((file) => {
          const reader = RegulaService.getFileReader();
          // reader.readAsDataURL(file);
          reader.onload = (evt) => {
            let data = (evt.target as FileReader).result as string;
            data = data.substring(data.indexOf(',') + 1);
            console.log(data);
            callback(data, items);
          };
          reader.readAsDataURL(file);
        });
      })
      .catch((err) => {
        console.log('resolveLocalFilesystemUrl err:', err);
      });

    path = this.file.applicationDirectory + 'assets/regula.license';
    console.log('_readFile() path', path);
    this.file
      .resolveLocalFilesystemUrl(path)
      .then((fileEntry) => {
        console.log(
          '_readFile() resolveLocalFilesystemUrl fileEntry.nativeURL:',
          fileEntry.nativeURL,
        );
        (fileEntry as FileEntry).file((file) => {
          const reader = RegulaService.getFileReader();
          // reader.readAsDataURL(file);
          reader.onload = (evt) => {
            let data = (evt.target as FileReader).result as string;
            data = data.substring(data.indexOf(',') + 1);
            console.log(data);
            callback(data, items);
          };
          reader.readAsDataURL(file);
        });
      })
      .catch((err) => {
        console.log('resolveLocalFilesystemUrl err:', err);
      });
    // this.file
    //   .resolveDirectoryUrl(this.file.applicationDirectory + dirPath)
    //   .then((dir) => {
    //     this.file.getFile(dir, fileName, {}).then((fileEntry: FileEntry) => {
    //       fileEntry.file((file) => {
    //         const reader = RegulaService.getFileReader();
    //         reader.readAsDataURL(file);
    //         reader.onload = (evt) => {
    //           let data = (evt.target as FileReader).result as string;
    //           data = data.substring(data.indexOf(',') + 1);
    //           callback(data, items);
    //         };
    //         reader.readAsDataURL(file);
    //       });
    //     });
    //   })
    //   .catch((err) => {
    //     console.error('<!> _readFile error: ', err);
    //   });
  }

  private async initializeFields() {
    let initValue = {
      value: null,
      formatted_value: null,
      modified: false,
      error: false,
    };
    console.log(
      'RegulaService initializeFields this.fieldsToScan',
      this.fieldsToScan,
    );
    if (!this.fieldsToScan || this.fieldsToScan.length == 0) {
      this.fieldsToScan = await this.docuscanService.fetchScanFields().then();
    }
    console.log(
      'RegulaService initializeFields this.fieldsToScan after fetch',
      this.fieldsToScan,
    );

    for (const i of this.fieldsToScan) {
      this.guestPostData.guest[i.name] = initValue;
    }

    this.guestPostData.guest['guest_id'] = initValue;
    this.guestPostData.guest['reservation_guest_id'] = initValue;
    this.guestPostData.guest['doc_reader_scanned_document_id'] = initValue;
  }

  private async getFieldValue(
    results: DocumentReaderResults,
    regula_id: number,
    lc_id = null,
    type = null,
  ) {
    let value = '';
    if (lc_id != null && type != null) {
      value =
        (await this.documentReader.textFieldValueByTypeLcidSource(
          results,
          regula_id,
          lc_id,
          type,
        )) ?? '';
    } else if (lc_id != null) {
      value =
        (await this.documentReader.textFieldValueByTypeLcid(
          results,
          regula_id,
          lc_id,
        )) ?? '';
    } else {
      value =
        (await this.documentReader.textFieldValueByType(results, regula_id)) ??
        '';
    }
    return value;
  }

  public get isRegulaDBLoaded(): boolean {
    return this._isRegulaDBLoaded;
  }

  public get isRegulaSDKInitialized(): boolean {
    return this._isRegulaSDKInitialized;
  }

  public checkIsRegulaDBLoaded(input: string): boolean {
    let status = JSON.parse(input);
    this._isRegulaDBLoaded = status.hasOwnProperty('success') && status.success;
    return this._isRegulaDBLoaded;
  }
}

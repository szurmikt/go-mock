import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
// import {
//   DocumentReader,
//   DocumentReaderCompletion,
//   Enum,
// } from '@regulaforensics/ionic-native-document-reader/ngx';
import { AlertController, NavParams } from '@ionic/angular';

import {
  IonIcon,
  IonButton,
  IonLabel,
  IonSkeletonText,
  ModalController,
  IonSpinner,
} from '@ionic/angular/standalone';

import { CapacitorNfc } from '@capgo/capacitor-nfc';

import { ModalService } from 'src/app/services/modal.service';
// import { RegulaService } from 'src/app/services/regula.service';
import { GuestPostInterface } from 'src/app/models/guest.interface';
import { GuestInterface } from 'src/app/models/guest.interface';
import { SharedService } from 'src/app/services/shared.service';
import { Events } from 'src/app/services/event.service';
import { AuthService } from 'src/app/services/auth.service';
import { DocumentData } from 'src/app/models/statistics-interface';
import { DefaultValuePipe } from 'src/app/pipes/default-value.pipe';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { DashIfEmptyPipe } from 'src/app/pipes/dash-if-empty.pipe';
import { ReservationInterface } from 'src/app/models/reservation.interface';
import { DocuscanService } from 'src/app/services/docuscan.service';
import { ReservationService } from 'src/app/services/reservation.service';
import { OptionsService } from 'src/app/services/options.service';
import { DocumentReaderService } from 'src/app/services/document-reader.service';
import { BootstrapService } from 'src/app/services/bootstrap.service';

import { HttpClient } from '@angular/common/http';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-modal',
  templateUrl: './scan-modal.component.html',
  styleUrls: ['./scan-modal.component.scss'],
  standalone: true,
  imports: [
    IonSpinner,
    IonButton,
    IonIcon,
    DefaultValuePipe,
    DashIfEmptyPipe,
    TranslatePipe,
    AsyncPipe,
  ],
  providers: [TranslatePipe],
})
export class ScanModalComponent implements OnInit {
  http = inject(HttpClient);
  modalCtrl = inject(ModalController);
  docuscanService = inject(DocuscanService);
  optionsService = inject(OptionsService);
  reservationService = inject(ReservationService);
  translatePipe = inject(TranslatePipe);
  reader = inject(DocumentReaderService);
  bootstrapService = inject(BootstrapService);

  bootstrapSubscription!: Subscription;
  scanResultSubscription!: Subscription;

  loaded: boolean = false;
  newScan: boolean = true;
  scanAllowed: boolean = true;
  // guest: GuestInterface;
  // scannedGuestData: ScannedGuestDataInterface = {};
  guestPostData: WritableSignal<GuestPostInterface> = signal({
    guest: {},
    reservation_code: '',
  });
  // guestPostData: GuestPostInterface = {
  //   // address: {},
  //   guest: {},
  //   reservation_code: '',
  // };
  // documentData: WritableSignal<DocumentData> = signal({
  //   document_type: '',
  //   scan_type: '',
  //   date_of_issue: '',
  //   message: '',
  // });
  private documentData: DocumentData = {
    document_type: '',
    scan_type: '',
    date_of_issue: '',
    message: '',
  };
  guestSignal: WritableSignal<any> = signal({});

  reservationGuestId = signal('123');

  rfidFinished: boolean = false;
  fieldsToScan: any = {};
  useRfid: boolean = false;
  device: any;
  nfcAvailable: boolean = false;
  rfidDisabled: boolean = false;
  reservation: ReservationInterface | undefined;
  providerSettings: any = null;
  private tag_id: any = null;

  scanInterrupted: boolean = false;
  private morePage: boolean = false;
  scanInterruptedText: String = '';
  private _timeOut: ReturnType<typeof setTimeout> | undefined;
  guestData: any;
  options: any;

  initialized = false;

  constructor(
    private modalService: ModalService,
    // private regula: RegulaService,
    private cd: ChangeDetectorRef,
    private navParams: NavParams,
    private shared: SharedService,
    // private guestService: GuestService,
    private events: Events,
    private alertCtrl: AlertController,
    // private statistics: StatisticsService,
    private authService: AuthService,
    // private rfidService: RfidService,
    // private documentReader: DocumentReader, // private docuScan: DocuscanService
  ) {
    console.log('ScanModalComponent constructor');
    this.device = this.authService.getDeviceInfo();
    this.guestSignal.set(this.navParams.get('guest'));
    this.reservation = this.navParams.get('reservation');
    console.log('this.guest', this.guestSignal());
    console.log('this.reservation', this.reservation);

    // let p = Promise.all([
    //   this.docuscanService.get(),
    //   this.optionsService.get(),
    //   this.reader.init(),
    //   CapacitorNfc.getStatus(),
    //   // this.widgetsService.getData(),
    // ])
    //   .then((data) => {
    //     this.loaded = true;
    //     this.fieldsToScan = data[0];
    //     this.options = data[1];
    //     this.nfcAvailable = data[3].status === 'NFC_OK';
    //     this.scanAllowed = !(
    //       this.guest.scanned_data != null && this.guest.locked
    //     );

    //     let promises: Promise<void>[] = [];
    //     if (data[0].length == 0) {
    //       promises.push(this.docuscanService.load());
    //     } else {
    //       this.fieldsToScan = data[0];
    //       console.log(
    //         'Fields to scan loaded in ScanModalComponent constructor',
    //         this.fieldsToScan,
    //       );
    //     }
    //     if (!data[1]) {
    //       promises.push(this.optionsService.load());
    //     } else {
    //       this.options = data[1];
    //       console.log(
    //         'Options loaded in ScanModalComponent constructor',
    //         this.options,
    //       );
    //     }
    //     if (promises.length > 0) {
    //       Promise.all(promises).then(() => {
    //         console.log('All promises resolved');
    //         this.fieldsToScan = this.docuscanService.get();
    //         this.options = this.optionsService.get();
    //         this.initializeFields();
    //       });
    //     } else {
    //       this.initializeFields();
    //     }
    //   })
    //   .catch((e) => {
    //     console.log('e', e);
    //   });

    // this.providerSettings = this.shared._getNavParams('providerSettings');
  }

  ngOnInit() {
    console.log('ScanModalComponent ngOnInit');
    this.scanResultSubscription = this.reader.scanResult$.subscribe(
      (data: any) => {
        if (data.documentData != null && data.guestPostData != null) {
          console.log(
            'ScanModalComponent ngOnInit - scan results:',
            data.documentData,
            data.guestPostData,
          );
          this.newScan = false;
          this.loaded = true;
          this.documentData = data.documentData;
          this.guestSignal.set(data.guestPostData.guest);
          this.guestPostData.set(data.guestPostData);
          this.reservationGuestId.set('asd');
          console.log(
            'ScanModalComponent ngOnInit - scan results:',
            // this.documentData(),
            this.guestSignal(),
          );
        }
      },
    );
    this.bootstrapSubscription = this.bootstrapService.bootstrapBS.subscribe(
      async (initialized) => {
        this.initialized = initialized;
        console.log('this.initialized', this.initialized);
        if (this.initialized) {
          this.fieldsToScan = this.docuscanService.get();
          this.options = this.optionsService.get();
          await this.reader.init();
        }
      },
    );
  }

  ngAfterViewInit() {
    console.log('ScanModalComponent ngAfterViewInit');
  }

  ionViewWillEnter() {
    this.initialized = this.bootstrapService.isInitialized();
    if (!this.initialized) {
      this.bootstrapService.init();
    }
  }

  ionViewDidEnter() {
    console.log('ScanModalComponent ionViewDidEnter');
  }

  ionViewWillLeave() {
    this.newScan = true;
    this.loaded = false;
  }

  close() {
    if (!this.newScan && this.scanAllowed) {
      this.alertCtrl
        .create({
          header: this.translatePipe.transform(
            'scanModalComponent.alertNotSavedTitle',
          ),
          message: this.translatePipe.transform(
            'scanModalComponent.alertNotSavedTitle',
          ),
          buttons: [
            {
              text: this.translatePipe.transform('global.btnNo'),
              role: 'cancel',
            },
            {
              text: this.translatePipe.transform('global.btnYes'),
              handler: () => {
                this.modalService.closeModal().then((_) => {
                  // eslint-disable-next-line max-len
                  console.log(
                    'calling statistics sendStatistics for Discarded',
                  );

                  this.docuscanService
                    .sendStatistics(
                      this.guestSignal()?.reservation_guest_id ?? '',
                      '',
                      'Discarded',
                      this.documentData,
                    )
                    .subscribe(() => {
                      this.resetDocumentData();
                    });
                });
              },
            },
          ],
        })
        .then((alert) => {
          alert.present().then();
        });
    } else if (this.newScan && this.scanAllowed) {
      this.modalService.closeModal().then();
    } else {
      this.modalService.closeModal().then();
    }
  }

  scanDocument(isRfid: boolean = true) {
    console.log('scanDocument isRfid', isRfid);
    // let d: GuestPostInterface = this.guestPostData();
    // console.log('this.guestPostData()', this.guestPostData());
    // d.guest['reservation_guest_id'] = {
    //   value: 'asd',
    //   formatted_value: 'qwe',
    //   modified: false,
    //   error: false,
    //   label: '',
    // };
    // this.guestPostData.set(d);

    // console.log('this.guestPostData()', this.guestPostData());
    // this.guestSignal.set({ reservation_guest_id: 'qwe' });
    // return false;
    this.scanInterrupted = false;
    // this.cd.detectChanges();
    // this.initializeFields();
    if (
      this.guestSignal()?.scanned_data?.doc_reader_scanned_document_id != null
    ) {
      this.alertCtrl
        .create({
          header: this.translatePipe.transform(
            'scanModalComponent.alertScannedTitle',
          ),
          message: this.translatePipe.transform(
            'scanModalComponent.alertScannedContent',
          ),
          buttons: [
            {
              text: this.translatePipe.transform('global.btnNo'),
              role: 'cancel',
            },
            {
              text: this.translatePipe.transform('global.btnYes'),
              handler: () => {
                // eslint-disable-next-line max-len
                console.log('calling statistics sendStatistics for Discarded');
                this.docuscanService
                  .sendStatistics(
                    this.guestSignal()?.reservation_guest_id || '',
                    this.guestSignal()?.scanned_data
                      ?.doc_reader_scanned_document_id || '',
                    'Discarded',
                    this.documentData,
                  )
                  .subscribe(() => {
                    this.resetDocumentData();
                  });

                this._scan(isRfid && !this.rfidDisabled);
              },
            },
          ],
        })
        .then((alert) => {
          alert.present().then();
        });
    } else if (
      this.guestSignal()?.scanned_data?.doc_reader_scanned_document_id ==
        null &&
      !this.newScan
    ) {
      console.log('calling statistics sendStatistics for Discarded');
      this.docuscanService
        .sendStatistics(
          this.guestSignal()?.reservation_guest_id || '',
          '',
          'Discarded',
          this.documentData,
        )
        .subscribe(() => {
          this.resetDocumentData();
        });
      this._scan(isRfid && !this.rfidDisabled);
    } else {
      this._scan(isRfid && !this.rfidDisabled);
    }
  }

  scanAltDocument(dummyData: string) {
    console.log('scanAltDocument dummyData', dummyData);
    let json: any;
    let url = '';
    switch (dummyData) {
      case 'driving_license':
        url = 'assets/scanresult_driving_license.json';
        break;
      case 'id':
        url = 'assets/scanresult_id_current.json';
        break;
      case 'oldid':
        url = 'assets/scanresult_id_old.json';
        break;
    }
    this.http.get(url).subscribe((res) => {
      json = JSON.stringify(res);
      // json.action = Enum.DocReaderAction.COMPLETE;
      console.log('json', json);

      this.scanInterrupted = false;
      // this.cd.detectChanges();
      // this.initializeFields();
      if (
        this.guestSignal()?.scanned_data?.doc_reader_scanned_document_id != null
      ) {
        this.alertCtrl
          .create({
            header: 'This guest has a scanned ID already!',
            message: 'Are you sure want another scanning?',
            buttons: [
              {
                text: 'No',
                role: 'cancel',
              },
              {
                text: 'Yes',
                handler: () => {
                  // eslint-disable-next-line max-len
                  console.log(
                    'calling statistics sendStatistics for Discarded',
                  );
                  // this.statistics
                  //   .sendStatistics(
                  //     this.guest.reservation_client_id,
                  //     this.guest.doc_reader_scanned_document_id,
                  //     'Discarded',
                  //     this.documentData
                  //   )
                  //   .subscribe(() => {
                  //     this.documentData = {
                  //       document_type: '',
                  //       scan_type: '',
                  //       date_of_issue: '',
                  //       message: '',
                  //     };
                  //   });
                  // this.processScanResult(json, false).then();
                },
              },
            ],
          })
          .then((alert) => {
            alert.present().then();
          });
      } else if (
        this.guestSignal()?.scanned_data?.doc_reader_scanned_document_id ==
          null &&
        !this.newScan
      ) {
        console.log('calling statistics sendStatistics for Discarded');
        // this.statistics
        //   .sendStatistics(
        //     this.guest.reservation_client_id,
        //     '',
        //     'Discarded',
        //     this.documentData
        //   )
        //   .subscribe(() => {
        //     this.documentData = {
        //       document_type: '',
        //       scan_type: '',
        //       date_of_issue: '',
        //       message: '',
        //     };
        //   });
        // this._scan(isRfid && !this.rfidDisabled);
        // this.processScanResult(json, false).then();
      } else {
        // this._scan(isRfid && !this.rfidDisabled);
        // this.processScanResult(json, false).then();
      }
    });
  }

  private _scan(isRfid: boolean) {
    this.reader.scan();
    // this.regula.scan().subscribe((scanResult) => {
    //   this.processScanResult(scanResult, isRfid).then();
    // });
  }

  // private async _startRfidScan(data: DocumentReaderCompletion) {
  //   const notification = 'rfidNotificationCompletionEvent';
  //   const paCert = 'paCertificateCompletionEvent';
  //   const taCert = 'taCertificateCompletionEvent';
  //   const taSig = 'taSignatureCompletionEvent';
  //   const chipDetectEvt = 'rfidOnChipDetectedEvent';
  //   await this.regula.setRFIDScenario(data);
  //   await this.regula.stopScan();
  //   this.morePage = false;
  //   this._timeOut = setTimeout(() => {
  //     this.scanCancelled(true);
  //   }, 15000);
  //   this.regula.scanRFID().subscribe({
  //     next: (scanResult) => {
  //       if (
  //         scanResult.substring(0, notification.length) !== notification &&
  //         scanResult.substring(0, paCert.length) !== paCert &&
  //         scanResult.substring(0, taCert.length) !== taCert &&
  //         scanResult.substring(0, taSig.length) !== taSig &&
  //         scanResult.substring(0, chipDetectEvt.length) !== chipDetectEvt
  //       ) {
  //         this.processScanResult(scanResult, true);
  //       }
  //     },
  //     error: () => {
  //       this.alertCtrl
  //         .create({
  //           header: 'Scan failed',
  //           message: 'Failed to scan the document!',
  //           buttons: ['Ok'],
  //         })
  //         .then((alert) => {
  //           alert.present().then();
  //         });
  //     },
  //   });
  // }

  // private async processScanResult(scanResult: string, isRfID: boolean) {
  //   console.log('processScanResult scanResult', scanResult, 'isRfID', isRfID);

  //   this.newScan = true;
  //   this.loaded = false;
  //   this.scanInterrupted = false;
  //   this.cd.detectChanges();
  //   let scannedData = DocumentReaderCompletion.fromJson(JSON.parse(scanResult));
  //   // if (scannedData) {
  //   //   scannedData.action = Enum.DocReaderAction.COMPLETE;
  //   // }
  //   console.log('processScanResult scannedData', scannedData);

  //   if (
  //     scannedData != undefined &&
  //     (scannedData.action == Enum.DocReaderAction.COMPLETE ||
  //       scannedData.action === Enum.DocReaderAction.TIMEOUT)
  //   ) {
  //     if (
  //       scannedData.results != undefined &&
  //       scannedData.results.textResult != undefined &&
  //       scannedData.results.textResult.fields != undefined &&
  //       scannedData.results.textResult.fields.length > 0
  //     ) {
  //       this.morePage = false;
  //       if (!this.rfidDisabled) {
  //         clearTimeout(this._timeOut);
  //       }
  //       this.newScan = false;
  //       this.documentData.document_type =
  //         scannedData.results.documentType![0].name ?? '';
  //       this.documentData.date_of_issue =
  //         await this.documentReader.textFieldValueByType(
  //           scannedData.results,
  //           4,
  //         );
  //       this.documentData.message = '';
  //       this.documentData.scan_type =
  //         scannedData.results.chipPage != 0 && isRfID ? 'rfid' : 'ocr';
  //       // console.log('scannedData', scannedData);
  //       // console.log('this.documentData', this.documentData);

  //       this.handleCompletion(scannedData, isRfID).then();
  //     } else {
  //       console.log('before scanFailed 1');

  //       this.scanFailed();
  //     }
  //   } else if (
  //     scannedData!.action == Enum.DocReaderAction.MORE_PAGES_AVAILABLE
  //   ) {
  //     if (!this.rfidDisabled) {
  //       clearTimeout(this._timeOut);
  //     }
  //     // If the doc type is not scanned - which is mandatory - we should show scan failed error
  //     if (scannedData!.results!.documentType!.length == 0) {
  //       console.log('before scanFailed 2');
  //       this.scanFailed();
  //     } else {
  //       this.morePage = true;
  //       if (
  //         !this.rfidDisabled &&
  //         scannedData!.results!.chipPage != 0 &&
  //         isRfID
  //       ) {
  //         // this._startRfidScan(scannedData!).then();
  //       }
  //     }
  //   } else if (scannedData!.action === Enum.DocReaderAction.ERROR) {
  //     this.morePage = false;
  //     if (!this.rfidDisabled && isRfID) {
  //       clearTimeout(this._timeOut);
  //     }
  //     this.documentData.document_type =
  //       scannedData!.results!.documentType!.length > 0
  //         ? scannedData!.results!.documentType![0].name!
  //         : '';
  //     this.documentData.date_of_issue = '';
  //     console.log('before scanFailed 3');
  //     this.scanFailed();
  //   } else if (scannedData!.action === Enum.DocReaderAction.CANCEL) {
  //     if (!this.rfidDisabled && isRfID) {
  //       clearTimeout(this._timeOut);
  //     }
  //     if (!this.morePage) {
  //       this.scanCancelled(
  //         isRfID &&
  //           scannedData!.results != undefined &&
  //           scannedData!.results.chipPage != 0,
  //       );
  //     }
  //     this.morePage = false;
  //   }
  //   this.cd.detectChanges();
  // }

  // private initializeFields() {
  //   console.log('initializeFields this.fieldsToScan', this.fieldsToScan);
  //   console.log('initializeFields this.options', this.options);
  //   console.log('initializeFields this.nfcAvailable', this.nfcAvailable);

  //   this.rfidFinished = false;

  //   const initValue = {
  //     value: null,
  //     formatted_value: null,
  //     modified: false,
  //     error: false,
  //   };
  //   for (const i of this.fieldsToScan) {
  //     this.guestPostData.guest[i.name] = initValue;
  //   }

  //   this.initialized = true;
  // }

  // private async handleCompletion(
  //   completion: DocumentReaderCompletion,
  //   isRfid: boolean,
  // ) {
  //   await this.regula._handleCompletion(completion, isRfid).then(
  //     (scannedData) => {
  //       console.log('_handleCompletion scannedData', scannedData);
  //       this.guestPostData.guest = scannedData;
  //       console.log('this.guestPostData.guest', this.guestPostData.guest);

  //       this.guestPostData.guest = this.docuscanService.postFieldInit(
  //         this.guestPostData.guest,
  //         this.guest,
  //       );
  //       console.log(
  //         'this.guestPostData.guest after postFieldInit',
  //         this.guestPostData.guest,
  //       );
  //       if (
  //         this.guestPostData.guest.hasOwnProperty('citizenship') &&
  //         this.guestPostData.guest.hasOwnProperty('country_code')
  //       ) {
  //         console.log('has citizenship && country_code');

  //         if (
  //           this.guestPostData.guest['country_code'] != null &&
  //           this.guestPostData.guest['country_code']['formatted_value'] != null
  //         ) {
  //           console.log('has country_code && country_code formatted');
  //           let defaultPipe = new DefaultValuePipe();
  //           this.guestPostData.guest['citizenship']['formatted_value'] =
  //             defaultPipe.transform(
  //               this.guestPostData.guest['country_code'][
  //                 'formatted_value'
  //               ].toLocaleUpperCase(),
  //               this.options,
  //               'country',
  //               'ID',
  //             );
  //         } else {
  //           if (
  //             this.guestPostData.guest['citizenship'] != null &&
  //             this.guestPostData.guest['country_code']['formatted_value'] !=
  //               null &&
  //             this.guestPostData.guest['citizenship']['formatted_value']
  //               .length == 3
  //           ) {
  //             let defaultPipe = new DefaultValuePipe();
  //             this.guestPostData.guest['citizenship']['formatted_value'] =
  //               defaultPipe.transform(
  //                 this.guestPostData.guest['citizenship'][
  //                   'formatted_value'
  //                 ].toLocaleUpperCase(),
  //                 this.options,

  //                 'country',
  //                 'ID',
  //               );
  //           } else {
  //             this.guestPostData.guest['citizenship']['formatted_value'] = null;
  //           }
  //         }
  //         this.guestPostData.guest['citizenship']['value'] =
  //           this.guestPostData.guest['country_code']['value'];
  //       } else {
  //         console.log('NOT has citizenship && country_code');
  //       }

  //       this.loaded = true;
  //       this.scanInterrupted = false;
  //       this.cd.detectChanges();
  //     },
  //     (err) => {
  //       this.loaded = true;
  //       this.newScan = true;
  //       console.log('before scanFailed 4 err', err);
  //       this.scanFailed();
  //     },
  //   );
  // }

  processDocument(action: string) {
    // console.log('saveDocument called this.guestPostData', this.guestPostData);

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

    // this.statistics
    //   .sendStatistics(
    //     this.guest.reservation_client_id,
    //     response.data.doc_reader_scanned_document_id,
    //     'Saved',
    //     this.documentData,
    //   )
    //   .subscribe(() => {
    //     this.documentData = {
    //       document_type: '',
    //       scan_type: '',
    //       date_of_issue: '',l
    //       message: '',
    //     };
    //   });
    // this.events.publish('reload_guests');
    this.modalCtrl.dismiss({
      action: action,
      guest: this.guestPostData,
    });
  }

  private scanFailed() {
    this.scanInterrupted = false;
    this.cd.detectChanges();
    this.alertCtrl
      .create({
        header: 'Scan failed',
        message:
          'Failed to scan the document. Check the light conditions, and try again!',
        buttons: ['Ok'],
      })
      .then((alert) => {
        alert.present().then(() => {
          console.log('calling statistics sendStatistics for Failed');
          this.docuscanService
            .sendStatistics(
              this.guestSignal()?.reservation_guest_id ?? '',
              '',
              'Failed',
              this.documentData,
            )
            .subscribe(() => {
              this.resetDocumentData();
            });
        });
      });
  }

  private scanCancelled(isRfid: boolean) {
    if (!this.rfidDisabled) {
      this.scanInterrupted = true;
      // this.regula.stopRfid().then();
      // this.regula.stopScan().then();
      let descriptionExtension = 'ID scan';
      if (isRfid) {
        descriptionExtension = 'Biometric ID scan';
      }
      this.scanInterruptedText =
        'Seems like you terminated the ' +
        descriptionExtension +
        '. Do you want to continue with the ID scanning process using only your camera?';
      this.cd.detectChanges();
    }
    console.log('calling statistics sendStatistics for Cancelled');
  }

  editGuestData(guest: any, modifyAfterSave: boolean = false) {
    console.log('editGuestData called');

    this.modalCtrl.dismiss({
      action: 'edit',
      data: this.guestPostData(),
    });
  }

  private resetDocumentData() {
    this.documentData = {
      document_type: '',
      scan_type: '',
      date_of_issue: '',
      message: '',
    };
  }
}

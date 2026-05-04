import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { AlertController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonIcon,
  ModalController,
  IonImg,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { ReservationInterface } from 'src/app/models/reservation.interface';
import { ReservationService } from 'src/app/services/reservation.service';
import { NgClass, DatePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import { DocType } from 'src/app/models/doc-type.interface';
import { CustomBackButtonComponent } from 'src/app/components/custom-back-button/custom-back-button.component';
import { ScanModalComponent } from 'src/app/components/scan-modal/scan-modal.component';
import {
  GuestInterface,
  ScannedDataInterface,
} from 'src/app/models/guest.interface';
import { AuthService } from 'src/app/services/auth.service';
import { DocuscanService } from 'src/app/services/docuscan.service';
import { OptionsService } from 'src/app/services/options.service';

import { DashIfEmptyPipe } from '../../pipes/dash-if-empty.pipe';
import { DefaultValuePipe } from '../../pipes/default-value.pipe';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { BootstrapService } from 'src/app/services/bootstrap.service';
// import { DocumentReaderService } from 'src/app/services/document-reader.service';
import { DocumentData } from 'src/app/models/statistics-interface';

@Component({
  selector: 'app-guest',
  templateUrl: './guest.page.html',
  styleUrls: ['./guest.page.scss'],
  standalone: true,
  providers: [TranslatePipe],
  imports: [
    IonSpinner,
    IonButton,
    IonImg,
    IonIcon,
    IonButtons,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    NgClass,
    DatePipe,
    CustomBackButtonComponent,
    DefaultValuePipe,
    DashIfEmptyPipe,
    TranslatePipe,
  ],
})
export class GuestPage implements OnInit, OnDestroy {
  appRef = inject(ApplicationRef);
  bootstrapService = inject(BootstrapService);
  route = inject(ActivatedRoute);
  authService = inject(AuthService);
  reservationService = inject(ReservationService);
  docuscanService = inject(DocuscanService);
  optionsService = inject(OptionsService);
  // reader = inject(DocumentReaderService);
  modalCtrl = inject(ModalController);
  alertCtrl = inject(AlertController);
  router = inject(Router);
  cd = inject(ChangeDetectorRef);
  private translatePipe = inject(TranslatePipe);

  guest: GuestInterface | undefined;
  reservation: ReservationInterface | undefined;

  dataSubscription!: Subscription;

  reservationCode: string | null = '';
  reservationGuestId: string | null = '';

  initialized = false;

  fabOpened = false;

  docTypes: DocType[] = [];

  options: { gender: any; document_type: any; country: any } | null = null;
  documentTypes: { [key: string]: string } = {};
  documentTypeOptions: { value: string; title: string }[] = [];

  guestSubscription!: Subscription;
  bootstrapSubscription!: Subscription;
  scanResultSubscription!: Subscription;

  scanInterrupted: boolean = false;
  loaded: boolean = false;
  newScan: boolean = true;
  scanAllowed: boolean = true;
  rfidDisabled: boolean = false;

  private documentData: DocumentData = {
    document_type: '',
    scan_type: '',
    date_of_issue: '',
    message: '',
  };

  constructor() {
    addIcons({
      call: 'assets/icon/icon-call.svg',
      mail: 'assets/icon/icon-mail.svg',
    });

    this.reservationCode = this.route.snapshot.paramMap.get('reservationCode');
    this.reservationGuestId =
      this.route.snapshot.paramMap.get('reservationGuestId');
    console.log(
      'this.reservationCode',
      this.reservationCode,
      '  this.reservationGuestId:',
      this.reservationGuestId,
    );
  }

  ngOnInit() {
    this.bootstrapSubscription = this.bootstrapService.bootstrapBS.subscribe(
      (initialized) => {
        this.initialized = initialized;
        console.log('this.initialized', this.initialized);
        if (this.initialized) {
          this.loadGuestData();
        }
      },
    );
    this.guestSubscription = this.reservationService.guestBS.subscribe(
      (guest) => {
        this.guest = guest;
        console.log('this.guest', this.guest);
        if (this.guest && this.guest.reservation_guest_id != '') {
          this.appRef.tick();
        }
      },
    );
    // this.scanResultSubscription = this.reader.scanResult$.subscribe(
    //   (data: any) => {
    //     if (data.documentData != null && data.scannedData != null) {
    //       console.log(
    //         'ScanModalComponent ngOnInit - scan results:',
    //         data.documentData,
    //         data.scannedData,
    //       );
    //       this.newScan = false;
    //       this.loaded = true;
    //       this.documentData = data.documentData;
    //       // this.guestSignal.set(data.scannedData.guest);
    //       // this.guestPostData.set(data.guestPostData);
    //       // this.reservationGuestId.set('asd');
    //     }
    //   },
    // );
  }

  loadGuestData() {
    // this.reservationService
    //   .fetchReservationByReservationCode(this.reservationCode!)
    //   .then((res) => {
    //     this.reservation = res;
    //     console.log('GuestPage ngOnInit this.reservation #1', this.reservation);
    //   });

    this.reservationService.fetchGuestById(
      this.reservationCode!,
      this.reservationGuestId!,
    );
  }

  ngOnDestroy() {
    if (this.guestSubscription) {
      this.guestSubscription.unsubscribe();
    }
    if (this.bootstrapSubscription) {
      this.bootstrapSubscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    this.initialized = this.bootstrapService.isInitialized();
    if (!this.initialized) {
      this.bootstrapService.init();
    }
  }
  ionViewDidEnter() {
    // this.openScanModal();
  }

  edit() {
    this.fabOpened = false;
    setTimeout(() => {
      let path =
        '/guest/' +
        this.reservationCode +
        '/' +
        this.reservationGuestId +
        '/edit';
      console.log('path', path);

      this.router.navigate([path]);
    }, 300);
  }

  stopProp(e: any) {
    e.stopPropagation();
  }

  toggleFAB() {
    console.log('toggleFAB() this.fabOpened', this.fabOpened);
    this.fabOpened = !this.fabOpened;
    this.appRef.tick();
  }

  docTypeTitle(value: string = '') {
    return this.docTypes.find((e) => e.value == value)?.title ?? '';
  }

  // async startScan() {
  //   this.fabOpened = false;
  //   await this.reader.init();
  //   this.scanDocument(false);
  // }

  // scanDocument(isRfid: boolean = true) {
  //   console.log('scanDocument isRfid', isRfid);
  //   // let d: GuestPostInterface = this.guestPostData();
  //   // console.log('this.guestPostData()', this.guestPostData());
  //   // d.guest['reservation_guest_id'] = {
  //   //   value: 'asd',
  //   //   formatted_value: 'qwe',
  //   //   modified: false,
  //   //   error: false,
  //   //   label: '',
  //   // };
  //   // this.guestPostData.set(d);

  //   // console.log('this.guestPostData()', this.guestPostData());
  //   // this.guestSignal.set({ reservation_guest_id: 'qwe' });
  //   // return false;
  //   this.scanInterrupted = false;
  //   // this.cd.detectChanges();
  //   // this.initializeFields();
  //   if (this.guest?.scanned_data?.doc_reader_scanned_document_id != null) {
  //     console.log(
  //       'scanDocument alertCtrl Scanned doc_reader_scanned_document_id',
  //       this.guest.scanned_data.doc_reader_scanned_document_id,
  //     );

  //     this.alertCtrl
  //       .create({
  //         header: this.translatePipe.transform(
  //           'scanModalComponent.alertScannedTitle',
  //         ),
  //         message: this.translatePipe.transform(
  //           'scanModalComponent.alertScannedContent',
  //         ),
  //         buttons: [
  //           {
  //             text: this.translatePipe.transform('global.btnNo'),
  //             role: 'cancel',
  //           },
  //           {
  //             text: this.translatePipe.transform('global.btnYes'),
  //             handler: () => {
  //               // eslint-disable-next-line max-len
  //               console.log('calling statistics sendStatistics for Discarded');
  //               this.docuscanService
  //                 .sendStatistics(
  //                   this.guest?.reservation_guest_id || '',
  //                   this.guest?.scanned_data?.doc_reader_scanned_document_id ||
  //                     '',
  //                   'Discarded',
  //                   this.documentData,
  //                 )
  //                 .subscribe(() => {
  //                   this.resetDocumentData();
  //                 });

  //               this._scan(isRfid && !this.rfidDisabled);
  //             },
  //           },
  //         ],
  //       })
  //       .then((alert) => {
  //         alert.present().then();
  //       });
  //   } else if (
  //     this.guest?.scanned_data?.doc_reader_scanned_document_id == null &&
  //     !this.newScan
  //   ) {
  //     console.log('calling statistics sendStatistics for Discarded');
  //     this.docuscanService
  //       .sendStatistics(
  //         this.guest?.reservation_guest_id || '',
  //         '',
  //         'Discarded',
  //         this.documentData,
  //       )
  //       .subscribe(() => {
  //         this.resetDocumentData();
  //       });
  //     this._scan(isRfid && !this.rfidDisabled);
  //   } else {
  //     this._scan(isRfid && !this.rfidDisabled);
  //   }
  // }

  // private _scan(isRfid: boolean) {
  //   this.reader.scan();
  // }

  openScanModal() {
    this.fabOpened = false;
    setTimeout(() => {
      this.modalCtrl
        .create({
          component: ScanModalComponent,
          breakpoints: [0, 0.4, 0.85],
          initialBreakpoint: 0,
          cssClass: 'custom-modal-sheet',
          componentProps: {
            guest: this.guest,
            reservationCode: this.reservationCode,
          },
          backdropDismiss: true,
        })
        .then((modal) => {
          modal.onWillDismiss().then((data: any) => {
            console.log('modal.onWillDismiss().then() data', data);
            if (data && data.data.action == 'edit') {
              this.edit();
            }
            // this.loadData();
          });
          modal.present();
        });
    }, 300);
  }
}

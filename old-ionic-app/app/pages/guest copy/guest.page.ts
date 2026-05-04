import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
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
import { GuestInterface } from 'src/app/models/guest.interface';
import { AuthService } from 'src/app/services/auth.service';
import { DocuscanService } from 'src/app/services/docuscan.service';
import { OptionsService } from 'src/app/services/options.service';
import { Diagnostic } from '@awesome-cordova-plugins/diagnostic/ngx';

import { CapacitorNfc } from '@capgo/capacitor-nfc';

import { DashIfEmptyPipe } from '../../pipes/dash-if-empty.pipe';
import { DefaultValuePipe } from '../../pipes/default-value.pipe';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { BootstrapService } from 'src/app/services/bootstrap.service';

@Component({
  selector: 'app-guest',
  templateUrl: './guest.page.html',
  styleUrls: ['./guest.page.scss'],
  standalone: true,
  providers: [Diagnostic],
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
  modalCtrl = inject(ModalController);
  router = inject(Router);
  cd = inject(ChangeDetectorRef);

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
    this.openScanModal();
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

  openScanModal() {
    this.fabOpened = false;
    setTimeout(() => {
      this.modalCtrl
        .create({
          component: ScanModalComponent,
          breakpoints: [0, 0.75, 0.9],
          initialBreakpoint: 0.75,
          cssClass: 'custom-modal-sheet',
          componentProps: {
            guest: this.guest,
            reservation: this.reservation,
          },
          backdropDismiss: true,
        })
        .then((modal) => {
          modal.onWillDismiss().then((data: any) => {
            console.log('modal.onWillDismiss().then() data', data);

            if (data && data.data.action == 'save') {
              console.log(
                'this.docuscanService.lastGuestPostData',
                this.docuscanService.lastGuestPostData,
              );
              console.log(
                'this.docuscanService.lastGuestPostData.guest',
                this.docuscanService.lastGuestPostData?.guest,
              );

              if (this.docuscanService.lastGuestPostData != null) {
                let scanned_data =
                  this.docuscanService.scannedGuestDataInterfaceToGuestScannedDataInterface(
                    this.docuscanService.lastGuestPostData.guest,
                  );
                console.log('scanned_data', scanned_data);

                this.guest!.scanned_data = scanned_data;
                console.log('this.guest', this.guest);
                this.guest = this.docuscanService.fillGuestDataFromScannedData(
                  this.guest!,
                );
                console.log('this.guest', this.guest);
              }

              this.docuscanService.lastGuestPostData = null;
              this.docuscanService.lastDocumentData = null;

              this.reservationService
                .updateGuest(this.reservationCode!, this.guest!)
                .then(() => {
                  console.log(
                    'GuestPage openScanModal guest updated successfully',
                  );
                  this.cd.detectChanges();
                });
            }
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

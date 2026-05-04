import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ApplicationRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonIcon,
  IonRippleEffect,
  ModalController,
  IonImg,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import {
  ReservationInterface,
  FinanceInterface,
  ServiceInterface,
} from 'src/app/models/reservation.interface';
import { GuestInterface } from 'src/app/models/guest.interface';
import { ReservationService } from 'src/app/services/reservation.service';
import { NgClass, KeyValuePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import { GuestCardComponent } from 'src/app/components/guest-card/guest-card.component';
import { CommentsModalComponent } from 'src/app/components/comments-modal/comments-modal.component';
import { FinanceCardComponent } from 'src/app/components/finance-card/finance-card.component';
import { ServiceCardComponent } from 'src/app/components/service-card/service-card.component';
import { ReservationDataSegments } from 'src/app/models/common.interface';
import { CustomBackButtonComponent } from 'src/app/components/custom-back-button/custom-back-button.component';
import { AuthService } from 'src/app/services/auth.service';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { BootstrapService } from 'src/app/services/bootstrap.service';

@Component({
  selector: 'app-reservation',
  templateUrl: './reservation.page.html',
  styleUrls: ['./reservation.page.scss'],
  standalone: true,
  imports: [
    IonSpinner,
    IonSkeletonText,
    IonButton,
    IonImg,
    IonRippleEffect,
    IonIcon,
    IonButtons,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    NgClass,
    GuestCardComponent,
    FinanceCardComponent,
    ServiceCardComponent,
    IonSelect,
    IonSelectOption,
    KeyValuePipe,
    CustomBackButtonComponent,
    TranslatePipe,
  ],
})
export class ReservationPage implements OnInit, OnDestroy {
  openService(_t99: ServiceInterface) {
    throw new Error('Method not implemented.');
  }
  openFinance(_t105: FinanceInterface) {
    throw new Error('Method not implemented.');
  }
  appRef = inject(ApplicationRef);
  private bootstrapService = inject(BootstrapService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  authService = inject(AuthService);
  reservationService = inject(ReservationService);
  modalCtrl = inject(ModalController);

  reservation: ReservationInterface | undefined;

  dataSubscription!: Subscription;

  reservationCode: string | null = '';

  public SegmentsEnum = ReservationDataSegments;

  segment = this.SegmentsEnum.guests;

  fabOpened = false;

  reservationStatusOptions = {};

  reservationSubscription!: Subscription;
  bootstrapSubscription!: Subscription;

  initialized = false;
  loading = true;

  constructor() {
    this.reservationCode = this.route.snapshot.paramMap.get('reservationCode');
    addIcons({
      calendar: 'assets/icon/icon-calendar.svg',
      calendar20: 'assets/icon/icon-calendar-20.svg',
      guests: 'assets/icon/icon-guests.svg',
      briefcase: 'assets/icon/icon-briefcase.svg',
      comment: 'assets/icon/icon-comment.svg',
      door: 'assets/icon/icon-door.svg',
      message: 'assets/icon/icon-message.svg',
      list: 'assets/icon/icon-list.svg',
      mobile: 'assets/icon/icon-mobile.svg',
    });
  }

  ngOnInit() {
    console.log('ReservationPage ngOnInit');
    this.reservation = undefined;
    this.loading = true;

    this.bootstrapSubscription = this.bootstrapService.bootstrapBS.subscribe(
      (initialized) => {
        this.initialized = initialized;
        console.log('this.initialized', this.initialized);
        if (this.initialized) {
          this.loading = true;
          this.reservationService
            .fetchReservationByReservationCode(this.reservationCode!)
            .then((_) => {});
        }
      },
    );
    this.reservationSubscription =
      this.reservationService.reservationBS.subscribe((reservation) => {
        this.reservation = reservation;
        console.log('reservationBS next this.reservation', this.reservation);
        this.loading = false;
        if (this.reservation) {
          this.appRef.tick();
        }
      });
    this.reservationStatusOptions = this.reservationService.getStatusOptions();
  }

  ngOnDestroy() {
    console.log('ReservationPage ngOnDestroy');
    if (this.reservationSubscription) {
      this.reservationSubscription.unsubscribe();
    }
    if (this.bootstrapSubscription) {
      this.bootstrapSubscription.unsubscribe();
    }
    this.reservation = undefined;
  }

  ionViewWillEnter() {
    this.initialized = this.bootstrapService.isInitialized();
    if (!this.initialized) {
      this.bootstrapService.init();
    }
  }

  openComments() {
    this.modalCtrl
      .create({
        component: CommentsModalComponent,
        cssClass: 'modal-small',
        componentProps: {
          reservation: this.reservation,
        },
        backdropDismiss: true,
      })
      .then((modal) => {
        // modal.onWillDismiss().then((data: any) => {
        //   this.loadData();
        // });
        modal.present();
      });
  }

  selectSegment(segment: ReservationDataSegments) {
    this.segment = segment;
  }

  openGuest(guest: GuestInterface) {
    console.log('openGuest reservationCode', this.reservationCode);
    console.log(
      'openGuest guest.reservation_guest_id',
      guest.reservation_guest_id,
    );

    this.router.navigate([
      '/guest',
      this.reservationCode,
      guest.reservation_guest_id,
    ]);
  }

  edit() {}

  toggleFAB() {
    this.fabOpened = !this.fabOpened;
  }

  changeStatus(e: any) {
    console.log('e.detail.value', e.detail.value);

    this.reservation!.status = e.detail.value;
    // this.reservation!.status_title = this.reservationService.getStatus(
    //   e.detail.value
    // );
  }

  stopProp(e: any) {
    e.stopPropagation();
  }
}

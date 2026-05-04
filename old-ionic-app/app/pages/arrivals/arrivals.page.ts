import {
  ApplicationRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonList,
  IonSpinner,
  IonIcon,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { ReservationInterface } from 'src/app/models/reservation.interface';
import { DateSegments } from 'src/app/models/common.interface';
import { addIcons } from 'ionicons';
import { Subscription } from 'rxjs';
import { CustomBackButtonComponent } from 'src/app/components/custom-back-button/custom-back-button.component';
import { ReservationService } from 'src/app/services/reservation.service';
import { ReservationCardComponent } from 'src/app/components/reservation-card/reservation-card.component';
import { AuthService } from 'src/app/services/auth.service';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { BootstrapService } from 'src/app/services/bootstrap.service';

@Component({
  selector: 'app-arrivals',
  templateUrl: './arrivals.page.html',
  styleUrls: ['./arrivals.page.scss'],
  standalone: true,
  imports: [
    IonSkeletonText,
    IonIcon,
    IonSpinner,
    IonList,
    IonButtons,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    ReservationCardComponent,
    NgClass,
    CustomBackButtonComponent,
    TranslatePipe
],
  providers: [TranslatePipe],
})
export class ArrivalsPage implements OnInit, OnDestroy {
  appRef = inject(ApplicationRef);
  bootstrapService = inject(BootstrapService);
  reservationService = inject(ReservationService);
  authService = inject(AuthService);
  router = inject(Router);
  translatePipe = inject(TranslatePipe);

  reservations: ReservationInterface[] = [];
  currentReservations: ReservationInterface[] = [];

  private dataSubscription!: Subscription;
  private bootstrapSubscription!: Subscription;

  public SegmentsEnum = DateSegments;
  segment = this.SegmentsEnum.today;

  loading = true;

  currentArrivalsTitle = this.translatePipe.transform(
    'arrivalsPage.todaysArrivals',
  );

  allGuestCount = 0;
  currentGuestCount = 0;

  allReservationCount = 0;
  currentReservationCount = 0;

  initialized = false;

  constructor() {
    addIcons({
      calendar: 'assets/icon/icon-calendar.svg',
      guests: 'assets/icon/icon-guests.svg',
      briefcase: 'assets/icon/icon-briefcase.svg',
      filters: 'assets/icon/icon-filters.svg',
    });
  }

  ngOnInit() {
    console.log('ArrivalsPage ngOninit');

    this.loading = true;

    this.dataSubscription = this.reservationService.reservationsS.subscribe(
      (response) => {
        this.reservations = [...response];

        console.log('this.reservationService.fetchReservation', response);
        this.allReservationCount = this.reservations.length;
        this.allGuestCount = this.getGuestCount(this.reservations);
        this.filterReservations();
      },
    );
    this.bootstrapSubscription = this.bootstrapService.bootstrapBS.subscribe(
      (initialized) => {
        this.initialized = initialized;
        console.log('this.initialized', this.initialized);

        this.reservationService.fetchReservations().then();
      },
    );
  }

  ngOnDestroy() {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    if (this.bootstrapSubscription) {
      this.bootstrapSubscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    this.initialized = this.bootstrapService.isInitialized();
    if (!this.initialized) {
      this.bootstrapService.init();
    } else {
      console.log('DashBoardPage ionViewWillEnter() loaded');
      this.authService
        .onReady()
        .then(() => this.reservationService.fetchReservations().then());
    }
  }

  getGuestCount(reservations: ReservationInterface[]) {
    return reservations.reduce((acc, item) => {
      // for each item, add it to the current accumulator
      acc += item.number_of_guests;

      // reduce always ends with returning the current accumulator, because each iteration through the reduce function modifies the accumulator, so you return what you just modified and that newest accumulator goes into the next iteration
      return acc;
    }, 0);
  }

  selectSegment(segment: DateSegments) {
    this.loading = true;
    this.segment = segment;
    if (segment == this.SegmentsEnum.yesterday) {
      this.currentArrivalsTitle = this.translatePipe.transform(
        'arrivalsPage.yesterdaysArrivals',
      );
    }
    if (segment == this.SegmentsEnum.today) {
      this.currentArrivalsTitle = this.translatePipe.transform(
        'arrivalsPage.todaysArrivals',
      );
    }
    if (segment == this.SegmentsEnum.tomorrow) {
      this.currentArrivalsTitle = this.translatePipe.transform(
        'arrivalsPage.tomorrowsArrivals',
      );
    }
    this.filterReservations();
  }

  filterReservations() {
    const now = new Date();
    let filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (this.segment == this.SegmentsEnum.yesterday) {
      filterDate.setDate(filterDate.getDate() - 1);
    }
    if (this.segment == this.SegmentsEnum.tomorrow) {
      filterDate.setDate(filterDate.getDate() + 1);
    }

    this.currentReservations = this.reservations.filter(
      (b: ReservationInterface) => {
        let dateArray = b.arrival_date.split('/');
        let arrivalDate = new Date(b.arrival_date);

        let bDate = new Date(
          arrivalDate.getFullYear(),
          arrivalDate.getMonth(),
          arrivalDate.getDate(),
        );

        return bDate.getTime() == filterDate.getTime();
      },
    );
    console.log('this.currentReservations', this.currentReservations);
    this.currentGuestCount = this.getGuestCount(this.currentReservations);
    this.currentReservationCount = this.currentReservations.length;

    this.loading = false;
    this.appRef.tick();
  }

  openReservation(reservation: ReservationInterface) {
    this.router.navigate(['/reservation', reservation.reservation_code]);
  }
}

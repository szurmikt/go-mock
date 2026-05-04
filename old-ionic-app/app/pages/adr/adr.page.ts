import { Component, inject, OnInit } from '@angular/core';
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
} from '@ionic/angular/standalone';
import { ReservationInterface } from 'src/app/models/reservation.interface';
import { DateSegments } from 'src/app/models/common.interface';
import { addIcons } from 'ionicons';
import { Subscription } from 'rxjs';
import { CustomBackButtonComponent } from 'src/app/components/custom-back-button/custom-back-button.component';
import { ReservationService } from 'src/app/services/reservation.service';
import { ReservationCardComponent } from 'src/app/components/reservation-card/reservation-card.component';

@Component({
  selector: 'app-adr',
  templateUrl: './adr.page.html',
  styleUrls: ['./adr.page.scss'],
  standalone: true,
  imports: [
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
  ],
})
export class AdrPage implements OnInit {
  reservationService = inject(ReservationService);
  router = inject(Router);

  reservations: ReservationInterface[] = [];
  currentReservations: ReservationInterface[] = [];
  private dataSubscription!: Subscription;

  public SegmentsEnum = DateSegments;
  segment = this.SegmentsEnum.today;

  fetching = true;

  currentAdrTitle = "Today's Adr";

  allGuestCount = 0;
  currentGuestCount = 0;

  allReservationCount = 0;
  currentReservationCount = 0;

  init = false;

  constructor() {
    addIcons({
      calendar: 'assets/icon/icon-calendar.svg',
      guests: 'assets/icon/icon-guests.svg',
      briefcase: 'assets/icon/icon-briefcase.svg',
      filters: 'assets/icon/icon-filters.svg',
    });
  }

  ngOnInit() {
    console.log('AdrPage ngOninit');

    this.fetching = true;
    this.reservationService.fetchReservations().then();
    this.dataSubscription = this.reservationService.reservationsS.subscribe(
      (response) => {
        this.reservations = [...response];

        console.log('this.reservationService.fetchReservation', response);
        this.allReservationCount = this.reservations.length;
        this.allGuestCount = this.getGuestCount(this.reservations);
        this.filterReservations();
      },
    );
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
    this.fetching = true;
    this.segment = segment;
    if (segment == this.SegmentsEnum.yesterday) {
      this.currentAdrTitle = "Yesterday's Adr";
    }
    if (segment == this.SegmentsEnum.today) {
      this.currentAdrTitle = "Today's Adr";
    }
    if (segment == this.SegmentsEnum.tomorrow) {
      this.currentAdrTitle = "Tomorrow's Adr";
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

    console.log('filterDate', filterDate);
    console.log('this.reservations', this.reservations);

    this.currentReservations = this.reservations.filter(
      (b: ReservationInterface) => {
        let departureDate = new Date(b.departure_date);

        let bDate = new Date(
          departureDate.getFullYear(),
          departureDate.getMonth(),
          departureDate.getDate(),
        );

        return bDate.getTime() == filterDate.getTime();
      },
    );
    console.log('this.currentReservations', this.currentReservations);
    this.currentGuestCount = this.getGuestCount(this.currentReservations);
    this.currentReservationCount = this.currentReservations.length;

    this.fetching = false;
    this.init = true;
  }

  openReservation(reservation: ReservationInterface) {
    this.router.navigate(['/reservation', reservation.reservation_code]);
  }
}

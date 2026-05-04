import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  ModalController,
  IonContent,
  IonButtons,
  IonList,
  IonSpinner,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { caretDown } from 'ionicons/icons';
import { ReservationInterface } from 'src/app/models/reservation.interface';
import { ReservationService } from 'src/app/services/reservation.service';
import { SearchComponent } from 'src/app/components/search/search.component';

import { ReservationCardComponent } from 'src/app/components/reservation-card/reservation-card.component';
import { PropertyListComponent } from 'src/app/components/property-list/property-list.component';
import { AuthService } from 'src/app/services/auth.service';
import { BootstrapService } from 'src/app/services/bootstrap.service';
import { PropertyInterface } from 'src/app/models/property.interface';

@Component({
  selector: 'app-reservations',
  templateUrl: './reservations.page.html',
  styleUrls: ['./reservations.page.scss'],
  imports: [
    IonIcon,
    IonButton,
    IonList,
    IonButtons,
    IonHeader,
    IonToolbar,
    IonContent,
    SearchComponent,
    ReservationCardComponent,
    IonSpinner,
  ],
})
export class ReservationsPage implements OnInit, OnDestroy {
  modalCtrl = inject(ModalController);
  bootstrapService = inject(BootstrapService);
  reservationService = inject(ReservationService);
  authService = inject(AuthService);
  router = inject(Router);

  reservations: ReservationInterface[] = [];

  private dataSubscription!: Subscription;
  private bootstrapSubscription!: Subscription;

  searchText = '';

  fetching = false;

  initialized = false;

  property: PropertyInterface | undefined;

  constructor() {
    addIcons({ caretDown });
    addIcons({
      chevronback: 'assets/icon/icon-chevron-back-outline.svg',
    });
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as {
      searchText: string;
    };
    this.searchText = state?.searchText;
  }

  ngOnInit() {
    this.bootstrapSubscription = this.bootstrapService.bootstrapBS.subscribe(
      (initialized) => {
        this.initialized = initialized;
        console.log(
          'ReservationsPage bootstrapService.bootstrapBS this.initialized',
          this.initialized,
        );
        if (this.initialized) {
          this.property = this.bootstrapService.getProperty();
          this.loadReservations();
        }
      },
    );

    this.dataSubscription = this.reservationService.reservationsS.subscribe(
      (response) => {
        this.reservations = [...[]];
        if (this.searchText && this.searchText != '') {
          let textLowercase = this.searchText.toLowerCase();
          console.log('textLowercase', textLowercase);

          this.reservations = [
            ...response.filter(
              (r: ReservationInterface) =>
                r.reservation_code.toLowerCase().includes(textLowercase) ||
                // r.booker.phone_number.includes(textLowercase) ||
                (r.booker.email ?? '').toLowerCase().includes(textLowercase) ||
                r.booker.first_name.toLowerCase().includes(textLowercase) ||
                r.booker.last_name.toLowerCase().includes(textLowercase),
            ),
          ];
          console.log('this.reservations', this.reservations);
        } else {
          this.reservations = [...response];
        }
        this.fetching = false;
        console.log('this.reservationService.fetchReservation', response);
        let uniq = [...new Set(this.reservations.map((r) => r.status))];
        console.log('uniq', uniq);
      },
    );
  }

  ngOnDestroy() {
    console.log('ReservationsPage ngOnDestroy');
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
    }
  }

  loadReservations() {
    this.fetching = true;
    this.reservations = [...[]];
    this.reservationService.fetchReservations().then();
  }

  changeSearchText = (text: string): void => {
    console.log('changeSearchText called args', text);
    this.searchText = text;
    this.loadReservations();
  };

  openReservation(reservation: ReservationInterface) {
    this.router.navigate(['/reservation', reservation.reservation_code]);
  }

  openProperty() {
    this.modalCtrl
      .create({
        component: PropertyListComponent,
        cssClass: 'modal-small',
        componentProps: {
          list: this.bootstrapService.getProperties(),
          logout: true,
        },
        backdropDismiss: true,
      })
      .then((modal) => {
        modal.onWillDismiss().then((data: any) => {
          this.property = this.bootstrapService.getProperty();
          this.loadReservations();
        });
        modal.present();
      });
  }

  openSettings() {
    this.router.navigate(['settings']).then();
  }
}

import { inject, Injectable } from '@angular/core';

import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { UserService } from './user.service';
import { ReservationInterface } from '../models/reservation.interface';
import { GuestInterface } from '../models/guest.interface';
import { ApiInterface } from '../models/api.interface';
import { formatDate } from '@angular/common';
import { DocType } from '../models/doc-type.interface';

@Injectable({
  providedIn: 'root',
})
export class ReservationService {
  storage = inject(StorageService);
  api = inject(ApiService);
  userService = inject(UserService);

  reservationStatusOptions = {
    confirmed: 'Confirmed',
    checkin: 'Check-in',
    checkedin: 'Checked-in',
    checkout: 'Check-out',
    checkedout: 'Checked-out',
    onboard: 'Onboard',
  };

  guests: GuestInterface[] = [];

  services = [
    {
      service_id: '123456',
      name: 'Breakfast',
      price: 50,
    },
    {
      service_id: '123123',
      name: 'Room cleaning',
      price: 100,
    },
  ];

  finances = [
    {
      finance_id: '123456',
      name: 'Car parking',
      price: 50,
    },
    {
      finance_id: '123123',
      name: 'Luxury room',
      price: 1500,
    },
  ];

  reservations: ReservationInterface[] = [];
  reservation: ReservationInterface | undefined = undefined;

  guest: GuestInterface | undefined = {
    reservation_guest_id: '',
    guest_id: '',
    first_name: '',
    last_name: '',
    birth_date: '',
    birth_place: '',
    guest_age: '',
    email: '',
    gender: '',
    citizenship: '',
    city_tax_liable: '',
    address: {
      country_code: '',
      zip: '',
      city: '',
      address_line: '',
    },
    maiden_name: '',
    mother_name: '',
    phone_number: '',
    document: {
      document_type: '',
      document_number: '',
      date_of_issue_of_the_document: '',
    },
    scanned_data: null,
    locked: false,
  };

  reservationStates = {
    confirmed: 'Confirmed',
    checkin: 'Check-in',
    checkout: 'Check-out',
    onboard: 'Onboard',
  };

  docTypes: DocType[] = [];

  public reservationsBS: BehaviorSubject<ReservationInterface[]> =
    new BehaviorSubject<ReservationInterface[]>(this.reservations);
  public reservationsS: Subject<ReservationInterface[]> = new Subject<
    ReservationInterface[]
  >();

  public reservationBS: BehaviorSubject<ReservationInterface | undefined> =
    new BehaviorSubject<ReservationInterface | undefined>(this.reservation);

  public guestBS: BehaviorSubject<GuestInterface | undefined> =
    new BehaviorSubject<GuestInterface | undefined>(this.guest);

  constructor() {
    this.docTypes.push({ value: 'passport', title: 'Passport' });
    this.docTypes.push({ value: 'idcard', title: 'ID Card' });
    this.docTypes.push({ value: 'stickynote', title: 'Sticky note' });
  }

  getStatusOptions() {
    return this.reservationStatusOptions;
  }

  getStatus(key: string) {
    switch (key) {
      case 'confirmed':
        return this.reservationStatusOptions.confirmed;
      case 'checkin':
        return this.reservationStatusOptions.checkin;
      case 'checkedin':
        return this.reservationStatusOptions.checkedin;
      case 'checkout':
        return this.reservationStatusOptions.checkout;
      case 'checkedout':
        return this.reservationStatusOptions.checkedout;
      case 'onboard':
        return this.reservationStatusOptions.onboard;
    }
    return '-';
  }

  getDocTypes() {
    return this.docTypes;
  }

  getAllReservation() {
    return Promise.resolve(this.reservations);
  }

  getReservationByCode(reservationCode: string): Promise<any> {
    let r = this.reservations.filter(
      (b) => b.reservation_code == reservationCode,
    )[0];
    if (r) return Promise.resolve(r);
    else
      return this.fetchReservations().then(() => {
        let r2 = this.reservations.filter(
          (b) => b.reservation_code == reservationCode,
        )[0];
        return Promise.resolve(r2);
      });
  }

  fetchReservations(
    start_date: string | undefined = undefined,
    end_date: string | undefined = undefined,
  ): Promise<any> {
    const now = new Date();

    if (!start_date) {
      let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - 14);
      start_date = formatDate(start, 'yyyy-MM-dd', 'EN');
    }
    if (!end_date) {
      let end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end.setDate(end.getDate() + 14);
      end_date = formatDate(end, 'yyyy-MM-dd', 'EN');
    }
    console.log('start_date', start_date);
    console.log('end_date', end_date);

    let message = '';
    let observer: Observable<ApiInterface<unknown>> = this.api.get(
      'reservations',
      {
        start_date,
        end_date,
      },
      // 'Property-Id: ' + this.userService.getPropertyId()
    );

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log(message, response);

          if (!response.success) {
            reject(response.errors);
          } else {
            this.reservations = this.convertReservations(
              response.data.reservations,
            );
            resolve(this.reservations);
            this.reservationsBS.next(this.reservations);
            this.reservationsS.next(this.reservations);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  getReservationById(id: string) {
    return this.reservations.filter((b) => b.id == id)[0];
  }

  fetchReservationByReservationCode(reservationCode: string): Promise<any> {
    console.log(
      'fetchReservationByReservationCode reservationCode',
      reservationCode,
    );
    // console.trace(new Error().stack?.split('\n')[2]?.trim().split(' ')[1]);

    let observer: Observable<ApiInterface<unknown>>;
    observer = this.api.get('reservations/details', {
      reservation_code: reservationCode,
    });

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log(
            'this.api.get(/reservations/details/reservation_code=' +
              reservationCode +
              ') response',
            response,
          );

          if (response.success) {
            console.log('response.data', response.data[0]);
            this.reservation = this.convertReservation(response.data[0]);
            resolve(this.reservation);
            this.reservationBS.next(this.reservation);
          } else {
            reject(response.errors);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  getGuestsByCode(reservationCode: string): Promise<any> {
    this.reservation = this.reservations.filter(
      (b) => b.reservation_code == reservationCode,
    )[0];
    if (
      this.reservation &&
      this.reservation.guests &&
      this.reservation.guests.length > 0
    ) {
      this.reservationBS.next(this.reservation);
      return Promise.resolve(this.reservation.guests);
    } else {
      console.log('call fetchGuestsByReservationCode');

      return this.fetchGuestsByReservationCode(reservationCode).then(
        (guests) => {
          this.reservation = this.reservations.filter(
            (b) => b.reservation_code == reservationCode,
          )[0];
          this.reservation.guests = guests;
          this.reservationBS.next(this.reservation);
          return Promise.resolve(guests);
        },
      );
    }
  }

  fetchGuestsByReservationCode(reservationCode: string): Promise<any> {
    console.log(
      'fetchGuestsByReservationCode reservationCode',
      reservationCode,
    );

    let observer: Observable<ApiInterface<unknown>>;
    observer = this.api.get(
      'guests',
      {
        reservation_code: reservationCode,
      },
      // 'Property-Id: ' + this.userService.getPropertyId()
    );

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log(
            'this.api.get(/guests/' + reservationCode + ') response',
            response,
          );

          if (response.success) {
            console.log('response.data.guests', response.data.guests);
            this.guests = this.convertGuests(response.data.guests);
            this.reservation = this.reservations.filter(
              (b) => b.reservation_code == reservationCode,
            )[0];
            this.reservation.guests = [...this.guests];
            resolve(this.guests);
            // this.reservationBS.next(this.guests);
          } else {
            reject(response.errors);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  fetchReservationById(reservationId: string): Promise<any> {
    console.log('reservationId', reservationId);

    let observer: Observable<ApiInterface<unknown>>;
    observer = this.api.get('app', '/reservation/' + reservationId);

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log(
            'this.api.get(/reservation/' + reservationId + ') response',
            response,
          );

          if (response.code) {
            reject(response.code);
          } else {
            this.reservation = this.convertReservation(response);
            resolve(response);
            this.reservationBS.next(this.reservation);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  async fetchGuestById(
    reservationCode: string,
    reservationGuestId: string,
    forceUpdate: boolean = false,
  ): Promise<any> {
    // console.log('reservationCode', reservationCode);
    // console.log('reservationGuestId', reservationGuestId);

    this.guest = await this.getGuestById(
      reservationCode,
      reservationGuestId,
      forceUpdate,
    );
    this.guestBS.next(this.guest);
    return Promise.resolve(this.guest);
    // let observer: Observable<ApiInterface<unknown>>;
    // observer = this.api.get('app', '/reservation/' + guestId);

    // return new Promise((resolve, reject) => {
    //   observer.subscribe({
    //     next: (response: any) => {
    //       console.log(
    //         'this.api.get(/reservation/' + reservationId + ') response',
    //         response
    //       );

    //       if (response.code) {
    //         reject(response.code);
    //       } else {
    //         this.reservation = this.convertReservation(response);
    //         resolve(response);
    //         this.reservationBS.next(this.reservation);
    //       }
    //     },
    //     error: (error) => {
    //       reject(error);
    //     },
    //   });
    // });
  }

  getGuestById(
    reservationCode: string,
    reservationGuestId: string,
    forceUpdate: boolean = false,
  ): Promise<any> {
    // console.log(`this.guests ${this.guests}`);
    // console.log(`this.reservation ${this.reservation}`);
    // console.log(`this.reservation.guests ${this.reservation.guests}`);
    return new Promise((resolve, reject) => {
      if (
        this.reservation &&
        this.reservation.guests &&
        this.reservation.guests.length > 0 &&
        !forceUpdate
      ) {
        resolve(
          this.reservation.guests.filter(
            (g) => g.reservation_guest_id == reservationGuestId,
          )[0],
        );
      } else {
        this.fetchReservationByReservationCode(reservationCode).then(
          (response) => {
            console.log('fetchReservationByReservationCode response', response);

            this.reservation = response;
            if (
              this.reservation &&
              this.reservation.guests &&
              this.reservation.guests.length > 0
            ) {
              resolve(
                this.reservation.guests.filter(
                  (g) => g.reservation_guest_id == reservationGuestId,
                )[0],
              );
            } else {
              console.log(
                'fetchReservationByReservationCode reject response',
                response,
              );
              reject(response);
            }
          },
        );
      }
    });
  }

  updateGuest(reservation_code: string, guest: GuestInterface): Promise<any> {
    const observer = this.api.post(
      'guests',
      { reservation_code, guest },
      {
        'Content-Type': 'application/json',
      },
    );

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log('guest post response', response);

          if (!response.success) {
            reject(response.errors);
            return;
          }
          this.fetchGuestById(
            reservation_code,
            guest.reservation_guest_id,
            true,
          );
          resolve(true);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  convertReservations(response: any) {
    let reservations: ReservationInterface[] = [];

    response.forEach((item: any) => {
      reservations.push(this.convertReservation(item));
    });
    return reservations;
  }
  convertReservation(response: any) {
    let arrival = new Date(response.arrival_date);
    let departure = new Date(response.departure_date);
    let w: ReservationInterface = {
      id: response.id,
      reservation_code: response.reservation_code,
      partner: {
        partner_id: response.partner.partner_id,
        partner_name: response.partner.partner_name,
      },
      booker: {
        booker_id: response.booker.booker_id,
        first_name: response.booker.first_name,
        last_name: response.booker.last_name,
        email: response.booker.email,
      },
      arrival_date: formatDate(response.arrival_date, 'yyyy-MM-dd', 'EN'),
      departure_date: formatDate(response.departure_date, 'yyyy-MM-dd', 'EN'),
      checked_in_time: response.checked_in_time,
      checked_out_time: response.checked_out_time,
      nights: Math.floor(
        (Date.UTC(
          departure.getFullYear(),
          departure.getMonth(),
          departure.getDate(),
        ) -
          Date.UTC(
            arrival.getFullYear(),
            arrival.getMonth(),
            arrival.getDate(),
          )) /
          (1000 * 60 * 60 * 24),
      ),
      status: response.status ?? '-',
      room_type_id: response.room_type_id,
      room_type_name: response.room_type_name,
      room_id: response.room_id,
      room_name: response.room_name,
      guest_count: {
        adults: response.guest_count.adults,
        children: response.guest_count.children,
        infants: response.guest_count.infants,
      },
      number_of_guests: response.number_of_guests,
      guests:
        response.guests && response.guests.length > 0
          ? this.convertGuests(response.guests)
          : [], //response.guests,
      services: this.services,
      finances: this.finances,
    };
    return w;
  }
  convertGuests(data: any) {
    let guests: GuestInterface[] = [];

    data.forEach((item: any) => {
      guests.push(this.convertGuest(item));
    });
    return guests;
  }
  convertGuest(data: any) {
    let guest: GuestInterface = {
      reservation_guest_id: data.reservation_guest_id,
      guest_id: data.guest_id,
      first_name: data.first_name,
      last_name: data.last_name,
      birth_date: data.birth_date,
      birth_place: data.birth_place,
      guest_age: data.guest_age,
      email: data.email,
      gender: data.gender,
      citizenship: data.citizenship,
      city_tax_liable: data.city_tax_liable,
      address: data.address
        ? {
            country_code: data.address.country_code,
            zip: data.address.zip,
            city: data.address.city,
            address_line: data.address.address_line,
          }
        : {
            country_code: null,
            zip: null,
            city: null,
            address_line: null,
          },
      maiden_name: data.maiden_name,
      mother_name: data.mother_name,
      phone_number: data.phone_number,
      document: data.document
        ? {
            document_type: data.document.document_type,
            document_number: data.document.document_number,
            date_of_issue_of_the_document:
              data.document.date_of_issue_of_the_document,
          }
        : {
            document_type: null,
            document_number: null,
            date_of_issue_of_the_document: null,
          },
      scanned_data: data.scanned_data
        ? {
            doc_reader_scanned_document_id:
              data.scanned_data.doc_reader_scanned_document_id,
            first_name: data.scanned_data.first_name,
            last_name: data.scanned_data.last_name,
            full_name: data.scanned_data.full_name,
            birth_date: data.scanned_data.birth_date,
            birth_place: data.scanned_data.birth_place,
            gender: data.scanned_data.gender,
            citizenship: data.scanned_data.citizenship,
            maiden_name: data.scanned_data.maiden_name,
            mother_name: data.scanned_data.mother_name,
            age: data.scanned_data.age,
            document: {
              document_type: data.scanned_data.document.document_type,
              document_number: data.scanned_data.document.document_number,
              date_of_issue_of_the_document:
                data.document.date_of_issue_of_the_document,
            },
          }
        : {
            doc_reader_scanned_document_id: null,
            first_name: null,
            last_name: null,
            full_name: null,
            birth_date: null,
            birth_place: null,
            gender: null,
            citizenship: null,
            maiden_name: null,
            mother_name: null,
            age: null,
            document: {
              document_type: null,
              document_number: null,
              date_of_issue_of_the_document: null,
            },
          },
      locked: data.locked ?? false,
    };
    return guest;
  }

  getStorageKey() {
    let property_id = this.userService.getPropertyId();
    return 'reservation_' + property_id;
  }

  // fetchReservation2(
  //   searchText: String,
  //   intervalMs: number = 10000
  // ): Observable<any> {
  //   let account_id = this.userService.getAccountId();
  //   return new Observable<any>((observer) => {
  //     this.api
  //       .get('app', '/reservation_filtered', { search: searchText })
  //       .subscribe({
  //         next: (response: any) => {
  //           console.log(
  //             'this.api.get(/reservation_filtered?search=' +
  //               searchText +
  //               ') response',
  //             response
  //           );

  //           if (response.code) {
  //             observer.error(response.code);
  //           } else {
  //             this.reservations = this.convertReservations(response);
  //             observer.next(this.reservations);
  //             this.reservationsBS.next(this.reservations);
  //           }
  //           observer.complete();
  //         },
  //         error: (error) => {
  //           observer.error(error);
  //           observer.complete();
  //         },
  //       });
  //   });
  // }
}

import { inject, Injectable } from '@angular/core';

import { IdScanPage } from '../pages/idscan/idscan.page';
import { IdScanWidget } from '../pages/idscan/idscan.widget';
import { ReservationsPage } from '../pages/reservations/reservations.page';
import { ReservationsWidget } from '../pages/reservations/reservations.widget';
import { Widget, WidgetInterface } from '../models/widgets.interface';
import { ArrivalsWidget } from '../pages/arrivals/arrivals.widget';
import {
  BehaviorSubject,
  catchError,
  lastValueFrom,
  Observable,
  of,
} from 'rxjs';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { UserService } from './user.service';
import { DailyperformanceWidget } from '../pages/dailyperformance/dailyperformance.widget';
import { DailyperformancePage } from '../pages/dailyperformance/dailyperformance.page';
import { ArrivalsPage } from '../pages/arrivals/arrivals.page';
import { AddtaskWidget } from '../pages/addtask/addtask.widget';
import { OccupancyWidget } from '../pages/occupancy/occupancy.widget';
import { DeparturesWidget } from '../pages/departures/departures.widget';
import { GuestFeedbackPage } from '../pages/guest-feedback/guest-feedback.page';
import { GuestFeedbackWidget } from '../pages/guest-feedback/guest-feedback.widget';
import { BlockDateWidget } from '../pages/block-date/block-date.widget';
import { RevParWidget } from '../pages/revpar/revpar.widget';
import { RevParPage } from '../pages/revpar/revpar.page';
import { AdrPage } from '../pages/adr/adr.page';
import { AdrWidget } from '../pages/adr/adr.widget';

@Injectable({
  providedIn: 'root',
})
export class WidgetsService {
  storage = inject(StorageService);
  api = inject(ApiService);
  userService = inject(UserService);

  _propertyWidgets: WidgetInterface[] = [];

  widgets: Widget[] = [
    {
      title: 'Reservations',
      path: 'reservations',
      widget: {
        url: 'reservations',
        size: 'full',
        icon: 'assets/icon/icon-calendar.svg',
        iconBg: '#9C7BF8',
        buttonBg: '#E7E7E7',
        widget: ReservationsWidget,
      },
      page: ReservationsPage,
    },
    {
      title: 'Start ID Scan',
      path: 'idscan',
      widget: {
        url: 'idscan',
        size: 'half',
        icon: 'assets/icon/icon-id-scan.svg',
        iconBg: '#F87B7B',
        buttonBg: '#E7E7E7',
        widget: IdScanWidget,
      },
      page: IdScanPage,
    },
    {
      title: 'Occupancy',
      path: 'occupancy',
      widget: { url: 'occupancy', size: 'full', widget: OccupancyWidget },
      page: ArrivalsPage,
    },
    {
      title: 'Arrivals',
      path: 'arrivals',
      widget: { url: 'arrivals', size: 'half', widget: ArrivalsWidget },
      page: ArrivalsPage,
    },
    {
      title: 'Add task',
      path: 'addtask',
      widget: { url: 'addtask', size: 'half', widget: AddtaskWidget },
      page: ArrivalsPage,
    },
    {
      title: 'Block Date',
      path: 'blockdate',
      widget: { url: 'blockdate', size: 'half', widget: BlockDateWidget },
      page: undefined,
    },
    {
      title: 'Departures',
      path: 'departures',
      widget: { url: 'departures', size: 'half', widget: DeparturesWidget },
      page: ArrivalsPage,
    },
    {
      title: 'Adr',
      path: 'adr',
      widget: { url: 'adr', size: 'half', widget: AdrWidget },
      page: AdrPage,
    },
    {
      title: 'RevPar',
      path: 'revpar',
      widget: { url: 'revpar', size: 'half', widget: RevParWidget },
      page: RevParPage,
    },
    // {
    //   title: 'Daily Performance',
    //   path: 'dailyperformance',
    //   widget: {
    //     url: 'dailyperformance',
    //     size: 'full',
    //     widget: DailyperformanceWidget,
    //   },
    //   page: DailyperformancePage,
    // },
    {
      title: 'Guest feedback',
      path: 'guestfeedback',
      widget: {
        url: 'guestfeedback',
        size: 'full',
        widget: GuestFeedbackWidget,
      },
      page: GuestFeedbackPage,
    },
  ];

  public propertyWidgetBS: BehaviorSubject<WidgetInterface[]> =
    new BehaviorSubject<WidgetInterface[]>(this._propertyWidgets);

  constructor() {}

  getAllWidgets() {
    return Promise.resolve(this.widgets);
  }

  getWidgetByKey(key: string) {
    return this.widgets.filter((w) => w.path == key)[0]['widget'];
  }

  getData(): Promise<any> {
    let property_id = this.userService.getPropertyId();
    let user_id = this.userService.getUserId();
    // Try to fetch data from the Promise (local, for example)
    return new Promise<any>(async (resolve, reject) => {
      let key = this.getStorageKey();
      console.log('widgetService getData key', key);

      let localData = await this.storage.getLocalData(key);
      console.log('widgetService getData localData', localData);
      // const localData = this.getDataFromLocalStorage();
      if (localData && localData.length > 0) {
        console.log('widgetService getData resolve local', localData);
        this._propertyWidgets = localData;
        // Resolve the Promise with local data if available
        resolve(localData);
      } else {
        // If local data is not available, fetch from remote server
        console.log('widgetService getData local data not available');
        resolve(
          this.fetchWidgetByProperty(property_id!.toString(), user_id!)
            .then((response) => {
              this._propertyWidgets = this.convertWidgets(response);
              console.log(
                'widgetService    fetchProperties this._propertyWidgets',
                this._propertyWidgets,
              );

              this.storage
                .setLocalData(this.getStorageKey(), this._propertyWidgets)
                .then((_) => {});

              return Promise.resolve(this._propertyWidgets);
            })
            .catch(reject),
        );
      }
    });
  }

  private fetchWidgetByProperty(
    property_id: string,
    user_id: string,
  ): Promise<any> {
    return lastValueFrom(
      this.api.get('widget_by_property', { property_id, user_id }).pipe(
        catchError((error) => {
          console.error('Error fetching remote data:', error);
          return [];
        }),
      ),
    ); // Convert the Observable to a Promise
  }
  // https://x8ki-letl-twmt.n7.xano.io/api:xxtHSl_D/widgets
  getWidgetByProperty(): Observable<any> {
    let property_id = this.userService.getPropertyId();
    return of(
      this.storage
        .getLocalData(this.getStorageKey())
        .then((propertyWidgets) => {
          if (propertyWidgets && propertyWidgets !== '') {
            this._propertyWidgets = JSON.parse(propertyWidgets);
            this.propertyWidgetBS.next(JSON.parse(propertyWidgets));
            return of(propertyWidgets);
          } else {
            return new Observable<any>((observer) => {
              this.api.get('app', '/widgets', { property_id }).subscribe({
                next: (response: any) => {
                  console.log('this.api.get(/widget) response', response);

                  if (response.code) {
                    observer.error(response.code);
                  } else {
                    this._propertyWidgets = this.convertWidgets(response);
                    console.log(
                      'fetchProperties this._propertyWidgets',
                      this._propertyWidgets,
                    );

                    this.storage
                      .setLocalData(this.getStorageKey(), this._propertyWidgets)
                      .then((_) => {});
                    observer.next(this._propertyWidgets);

                    // observer.next(response);
                    // this.userBS.next({
                    //   id: profileResponse.id,
                    //   name: profileResponse.name,
                    // });
                  }
                  observer.complete();
                },
                error: (error) => {
                  observer.error(error);
                  observer.complete();
                },
              });
            });
          }
        }),
    );
  }
  // https://x8ki-letl-twmt.n7.xano.io/api:xxtHSl_D/widgets/{widgets_id}
  // https://x8ki-letl-twmt.n7.xano.io/api:xxtHSl_D/widgets/{widgets_id}
  // https://x8ki-letl-twmt.n7.xano.io/api:xxtHSl_D/widgets/{widgets_id}

  //curl -X 'GET' \
  // 'https://x8ki-letl-twmt.n7.xano.io/api:xxtHSl_D/widgets/NA' \
  // -H 'Content-Type: application/json'

  fetchWidgetById(
    widget_id: String,
    intervalMs: number = 10000,
  ): Observable<any> {
    let property_id = this.userService.getPropertyId();

    console.log(
      'fetchWidgetById this._propertyWidgets',
      this._propertyWidgets,
      'property_id',
      property_id,
    );

    return new Observable<any>((observer) => {
      this.api.get('app', '/widgets/' + widget_id, { widget_id }).subscribe({
        next: (response: any) => {
          console.log(
            'this.api.get(/widgets/' + widget_id + ') response',
            response,
          );

          if (response.code) {
            observer.error(response.code);
          } else {
            let i = this._propertyWidgets.findIndex((aw) => {
              return aw.id == response.id;
            });
            console.log('i', i);
            if (i > -1) {
              this._propertyWidgets[i] = this.convertWidget(response);
            }

            console.log(
              'fetchWidgetById this._propertyWidgets',
              this._propertyWidgets,
            );

            this.storage
              .setLocalData(this.getStorageKey(), this._propertyWidgets)
              .then((_) => {});
            observer.next(response);
          }
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        },
      });
    });
    // return interval(intervalMs).pipe(
    //   startWith(0), // Trigger immediately on subscription
    //   switchMap(() =>
    //     this.api.get('app', '/widgets/' + widget_id, { widget_id }).pipe(
    //       switchMap((response: any) => {
    //         if (response.code) {
    //           return throwError(() => response.code);
    //         } else {
    //           return [response];
    //         }
    //       }),
    //       catchError((error) => throwError(() => error))
    //     )
    //   )
    // );
  }

  convertWidgets(response: any) {
    let widgets: WidgetInterface[] = [];

    response.forEach((accRaw: any) => {
      widgets.push(this.convertWidget(accRaw));
    });
    return widgets;
  }
  convertWidget(response: any) {
    let w: WidgetInterface = {
      id: response.id,
      property_id: response.property_id,
      widget_id: response.widget_id,
      data: response.data,
    };
    return w;
  }

  getStorageKey() {
    let propertyId = this.userService.getPropertyId();
    return 'property_widgets_' + propertyId;
  }
}

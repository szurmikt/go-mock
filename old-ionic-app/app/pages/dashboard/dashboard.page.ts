import { NgClass, NgComponentOutlet, AsyncPipe } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  inject,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonButtons,
  IonButton,
  IonGrid,
  IonCol,
  IonRow,
  ModalController,
  IonIcon,
  IonList,
  IonSpinner,
} from '@ionic/angular/standalone';

import { WidgetsService } from 'src/app/services/widgets.service';
import { Router } from '@angular/router';
import { Widget, WidgetInterface } from 'src/app/models/widgets.interface';
import {
  DashboardTab,
  DashboardView,
  Settings,
  TabType,
} from 'src/app/models/settings.interface';
import { Subscription } from 'rxjs';
import { SettingsService } from 'src/app/services/settings.service';
import { UserService } from 'src/app/services/user.service';
import { UserInterface } from 'src/app/models/user.interface';
import { PropertyInterface } from 'src/app/models/property.interface';
import { AuthService } from 'src/app/services/auth.service';
import { SearchComponent } from 'src/app/components/search/search.component';
import { addIcons } from 'ionicons';
import { caretDown } from 'ionicons/icons';
import { CustomBackButtonComponent } from 'src/app/components/custom-back-button/custom-back-button.component';
import { LanguageSwitcherComponent } from 'src/app/components/language-switcher/language-switcher.component';
import { ReservationInterface } from 'src/app/models/reservation.interface';
import { ReservationService } from 'src/app/services/reservation.service';
import { ReservationCardComponent } from 'src/app/components/reservation-card/reservation-card.component';
import { PropertyListComponent } from 'src/app/components/property-list/property-list.component';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { LanguageService } from 'src/app/services/languages/language.service';
// import { LogLevel } from '@regulaforensics/ionic-native-document-reader/ngx';
import { BootstrapService } from 'src/app/services/bootstrap.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  imports: [
    IonSpinner,
    IonList,
    IonIcon,
    IonRow,
    IonCol,
    IonGrid,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButtons,
    IonButton,
    NgComponentOutlet,
    NgClass,
    SearchComponent,
    ReservationCardComponent,
    TranslatePipe,
    LanguageSwitcherComponent,
    AsyncPipe,
  ],
  providers: [],
})
export class DashboardPage implements OnInit, OnChanges, OnDestroy {
  private bootstrapService = inject(BootstrapService);
  authService = inject(AuthService);
  userService = inject(UserService);
  reservationService = inject(ReservationService);
  modalCtrl = inject(ModalController);
  settingsService = inject(SettingsService);
  widgetsService = inject(WidgetsService);
  languageService = inject(LanguageService);
  router = inject(Router);
  cd = inject(ChangeDetectorRef);
  appRef = inject(ApplicationRef);

  private userBSSubscription!: Subscription;
  private propertyBSSubscription!: Subscription;
  private dataSubscription!: Subscription;
  private bootstrapSubscription!: Subscription;

  settings!: Settings;
  viewSettings!: DashboardView;

  user: UserInterface | undefined;
  property: PropertyInterface | undefined;

  activeViewId = 'view1';

  allWidgets: Widget[] = [];
  activeWidgets: Widget[] = [];
  propertyWidgets: WidgetInterface[] = [];

  loaded: boolean = false;

  initialized: boolean = false;

  searchText = '';
  searchText2 = '';

  searchOverlayOpened = false;

  fetching = false;

  trHash = 0;

  reservations: ReservationInterface[] = [];

  constructor() {
    addIcons({ caretDown });
    addIcons({
      chevronback: 'assets/icon/icon-chevron-back-outline.svg',
    });
  }

  ngOnInit() {
    this.dataSubscription = this.reservationService.reservationsS.subscribe(
      (response) => {
        console.log('response', response);

        if (this.searchText != '') {
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
        this.appRef.tick();
        // console.log('this.reservationService.fetchReservation', response);
      },
    );

    this.userBSSubscription = this.userService.userBS.subscribe(
      (data: UserInterface | undefined) => {
        this.user = data;
        // console.log('DashboardPage userService.userBS data', data);
      },
    );

    this.propertyBSSubscription = this.userService.propertyBS.subscribe(
      (data: PropertyInterface | undefined) => {
        // console.log('DashboardPage propertyService.propertyBS data', data);
        this.property = data;
      },
    );

    this.bootstrapSubscription = this.bootstrapService.bootstrapBS.subscribe(
      (initialized) => {
        this.initialized = initialized;
        console.log('this.initialized', this.initialized);
        this.loadData();
        this.appRef.tick();
        // this.loadGuestData();
      },
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('DashBoardPage ngOnChanges  () loaded', this.loaded);
  }

  ngOnDestroy() {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
    if (this.bootstrapSubscription) {
      this.bootstrapSubscription.unsubscribe();
    }
    if (this.userBSSubscription) {
      this.userBSSubscription.unsubscribe();
    }
    if (this.propertyBSSubscription) {
      this.propertyBSSubscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    this.initialized = this.bootstrapService.isInitialized();
    if (!this.initialized) {
      this.bootstrapService.init();
    } else {
      console.log('DashBoardPage ionViewWillEnter() loaded', this.loaded);
      this.authService.onReady().then(() => this.loadData());
    }
  }

  loadData() {
    console.log('DashBoardPage loadData loaded', this.loaded);

    let p = Promise.all([
      this.settingsService.loadSettings(),
      this.widgetsService.getAllWidgets(),
      // this.widgetsService.getData(),
    ])
      .then((data) => {
        this.loaded = true;
        this.settings = data[0];
        this.allWidgets = data[1];
        // this.propertyWidgets = data[2];

        console.log('DashBoardPage loadData  Promise all data', data);
        this.loadUI();
      })
      .catch((e) => {
        console.log('e', e);
      });
    console.log(p);
  }

  ionViewDidLeave() {
    this.loaded = false;
  }

  loadUI() {
    let widgets: Widget[] = [];
    for (let path of this.settings.widgets) {
      let widget: Widget | undefined = this.allWidgets.find(
        (w) => w.path == path,
      );
      if (widget != undefined) {
        widget.widget.data = this.GetComponentInputs(widget);
        widgets.push(widget);
      }
    }
    // this.viewSettings =
    //   this.settings.views[
    //     this.settingsService.getActiveViewSettingsIndex(this.activeViewId)
    //   ];
    // if (
    //   this.viewSettings != undefined &&
    //   this.viewSettings.widgets != undefined
    // ) {
    //   for (let path of this.viewSettings.widgets) {
    //     let widget: Widget | undefined = this.allWidgets.find(
    //       (w) => w.path == path
    //     );
    //     if (widget != undefined) {
    //       widget.widget.data = this.GetComponentInputs(widget);
    //       widgets.push(widget);
    //     }
    //   }
    // }
    this.activeWidgets = [...widgets];
    this.loaded = true;
  }

  openSettings() {
    this.router.navigate(['settings']).then();
  }

  getTabNameByContent(tab: DashboardTab) {
    if (tab.type == TabType.View) {
      let view: DashboardView | undefined = this.settings.views.find(
        (view) => view.id == tab.view,
      );
      if (view != undefined) return view.title;
    }
    return '-';
  }

  handleClick(tab: DashboardTab) {
    if (tab.type == TabType.View) {
      this.activeViewId = tab.view!;
      this.loadUI();
    }
  }

  GetComponent(w: Widget) {
    console.log('GetComponent w', w);
    return w.widget.widget;
  }

  GetComponentInputs(w: Widget) {
    // let propertyWidget: WidgetInterface | undefined = this.propertyWidgets.find(
    //   (aw: WidgetInterface) => aw.widget_id == w.path
    // );
    // console.log('w', w);
    // console.log('this.propertyWidgets', this.propertyWidgets);
    // console.log('propertyWidget', propertyWidget, propertyWidget?.data);

    return {
      db_id: undefined, //propertyWidget?.id,
      widget_id: w.path,
      data: undefined, //propertyWidget?.data,
      title: w.title,
      url: w.widget.url,
      icon: w.widget.icon,
      iconBg: w.widget.iconBg,
      buttonBg: w.widget.buttonBg,
    };
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
          this.loadData();
        });
        modal.present();
      });
    this.userService.loadProperties().then((list) => {
      console.log('openProperty list', list);
    });
  }

  changeSearchText = (s: string): void => {
    console.log('DashboadPage changeSearchText s: ', s);

    this.searchText2 = '';
    this.searchText = s;
    this.searchOverlayOpened = true;
    this.cd.detectChanges();

    this.fetching = true;
    this.reservations = [...[]];
    this.reservationService.fetchReservations();
  };

  closeSearchOverlay() {
    this.searchOverlayOpened = false;
    this.searchText2 = '';
    this.appRef.tick();
  }

  openReservation(reservation: ReservationInterface) {
    this.router.navigate(['/reservation', reservation.reservation_code]);
  }
}

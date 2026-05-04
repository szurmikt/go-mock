import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  IonContent,
  ItemReorderEventDetail,
  IonItem,
  IonLabel,
  IonList,
  IonReorder,
  IonReorderGroup,
  ModalController,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular/standalone';
import { WidgetsService } from 'src/app/services/widgets.service';
import { Widget, WidgetInterface } from 'src/app/models/widgets.interface';
import {
  DashboardTab,
  DashboardView,
  Settings,
  TabType,
} from 'src/app/models/settings.interface';
import { WidgetSelectComponent } from 'src/app/components/widget-select/widget-select.component';
import { SettingsService } from 'src/app/services/settings.service';
import { Subscription } from 'rxjs';
import { register } from 'swiper/element/bundle';
import { DashboardTabComponent } from 'src/app/components/dashboard-tab/dashboard-tab.component';
import { LanguageSwitcherComponent } from 'src/app/components/language-switcher/language-switcher.component';
import { PlatformService } from 'src/app/services/platform.service';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { LanguageService } from 'src/app/services/languages/language.service';

register();

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    IonCol,
    IonRow,
    IonGrid,
    IonContent,
    CommonModule,
    FormsModule,
    IonItem,
    IonLabel,
    IonList,
    IonReorder,
    IonReorderGroup,
    TranslatePipe,
    LanguageSwitcherComponent,
  ],
  providers: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SettingsPage implements OnInit {
  languageService = inject(LanguageService);
  settingsService = inject(SettingsService);
  widgetsService = inject(WidgetsService);
  platform = inject(PlatformService);
  navCtrl = inject(NavController);
  modalCtrl = inject(ModalController);

  settingsBSSubscription!: Subscription;

  activeWidgets: Widget[] = [];
  allWidgets: Widget[] = [];
  selectableWidgets: Widget[] = [];
  loaded: boolean = false;
  sorting: boolean = false;

  settings!: Settings;

  constructor() {
    addIcons({
      sorting: 'assets/icon/icon-sorting.svg',
      plus: 'assets/icon/icon-plus.svg',
      trash: 'assets/icon/icon-trash.svg',
      close: 'assets/icon/icon-close.svg',
    });
  }

  ngOnInit() {
    this.settingsBSSubscription = this.settingsService.settingsBS.subscribe(
      (data: Settings) => {
        this.settings = data;
        console.log('Dashboard settingsBS this.settings', this.settings);

        this.loadUI();
      },
    );
  }

  ionViewWillEnter() {
    this.loadData();
  }

  loadData() {
    Promise.all([
      this.settingsService.loadSettings(),
      this.widgetsService.getAllWidgets(),
      // this.widgetsService.getData(),
    ]).then((data) => {
      this.loaded = true;
      this.settings = data[0];
      this.allWidgets = data[1];
      // this.accountWidgetsIds = data[2].map((w: WidgetInterface) => w.widget_id);
      // this.accountWidgets = this.allWidgets.filter((w) =>
      //   this.accountWidgetsIds.includes(w.path)
      // );
      this.loadUI();
      console.log('SettingsPage loadData() Promise all data', data);
    });
  }

  ionViewDidLeave() {
    this.loaded = false;
  }

  async loadUI() {
    let widgets: Widget[] = [];
    for (let path of this.settings.widgets) {
      let widget: Widget | undefined = this.allWidgets.find(
        (w) => w.path == path,
      );
      if (widget != undefined) {
        widgets.push(widget);
      }
    }
    // this.viewSettings =
    //   this.settings.views[
    //     this.settingsService.getActiveViewSettingsIndex(this.activeViewId)
    //   ];
    // console.log('viewSettings', this.viewSettings);

    // if (this.viewSettings.widgets != undefined) {
    //   for (let path of this.viewSettings.widgets) {
    //     let widget: Widget | undefined = this.accountWidgets.find(
    //       (w) => w.path == path
    //     );
    //     if (widget != undefined) {
    //       widgets.push(widget);
    //     }
    //   }
    // }
    // this.title = this.viewSettings.title ?? '';
    this.activeWidgets = [...widgets];
    this.generateSelectableWidgets();
  }

  async addWidget() {
    this.generateSelectableWidgets();
    this.modalCtrl
      .create({
        component: WidgetSelectComponent,
        componentProps: { widgets: this.selectableWidgets },
        backdropDismiss: true,
      })
      .then((modal) => {
        modal.onWillDismiss().then((data) => {
          console.log('addWidget onWilldismissed data', data);

          if (
            data != undefined &&
            data.data != undefined &&
            data.data.newWidget != undefined
          ) {
            this.activeWidgets.push(data.data.newWidget);
            console.log(
              'addWidget onWilldismissed this.activeWidgets',
              this.activeWidgets,
            );

            this.saveWidgets();
          }
        });
        modal.present();
      });
  }

  removeWidget(widget: Widget) {
    console.log('removeWidget widget', widget);

    this.activeWidgets.forEach((item, index) => {
      if (item === widget) this.activeWidgets.splice(index, 1);
    });
    this.generateSelectableWidgets();
    this.saveWidgets();
  }

  saveWidgets() {
    this.settingsService.saveWidgets(this.activeWidgets);
  }

  generateSelectableWidgets() {
    this.selectableWidgets = this.allWidgets.filter((el: Widget) => {
      return !this.activeWidgets.includes(el);
    });
    console.log('selectableWidgets', this.selectableWidgets);
  }

  addTab() {
    let newTab: DashboardTab = this.settingsService.addTab();
    this.editTab(newTab);
  }

  async editTab(tab: DashboardTab) {
    this.generateSelectableWidgets();
    this.modalCtrl
      .create({
        component: DashboardTabComponent,
        componentProps: {
          tab: tab,
          views: this.settingsService.getAvailableViews(),
        },
        backdropDismiss: true,
      })
      .then((modal) => {
        modal.onWillDismiss().then((data) => {
          if (
            data != undefined &&
            data.data != undefined &&
            data.data.newTab != undefined
          ) {
            this.settingsService.saveTab(data.data.newTab);
          }
        });
        modal.present();
      });
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

  sortingToggle() {
    this.sorting = !this.sorting;
  }

  handleSorting(event: CustomEvent<ItemReorderEventDetail>) {
    this.activeWidgets = event.detail.complete(this.activeWidgets);
    this.saveWidgets();
  }

  close() {
    this.navCtrl.back();
  }

  isiOS() {
    return this.platform.isiOS;
  }
}

import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavController } from '@ionic/angular';
import {
  IonContent,
  ItemReorderEventDetail,
  IonItem,
  IonLabel,
  IonList,
  IonReorder,
  IonReorderGroup,
  IonImg,
  ModalController,
  IonGrid,
  IonRow,
  IonCol,
  IonInput,
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
import { PlatformService } from 'src/app/services/platform.service';

register();

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    IonInput,
    IonCol,
    IonRow,
    IonGrid,
    IonImg,
    IonContent,
    CommonModule,
    FormsModule,
    IonItem,
    IonLabel,
    IonList,
    IonReorder,
    IonReorderGroup,
  ],
  providers: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SettingsPage implements OnInit {
  settingsBSSubscription!: Subscription;

  activeViewId = 'view1';
  viewSettings!: DashboardView;
  slot = 0;
  title = 'Home';
  activeWidgets: Widget[] = [];
  allWidgets: Widget[] = [];
  accountWidgetsIds: string[] = [];
  accountWidgets: Widget[] = [];
  selectableWidgets: Widget[] = [];
  loaded: boolean = false;
  reorder: boolean = false;

  settings!: Settings;

  constructor(
    private settingsService: SettingsService,
    private widgetsService: WidgetsService,
    private platform: PlatformService,
    private navCtrl: NavController,
    private modalCtrl: ModalController = inject(ModalController)
  ) {}

  ngOnInit() {
    this.settingsBSSubscription = this.settingsService.settingsBS.subscribe(
      (data: Settings) => {
        this.settings = data;
        console.log('Dashboard settingsBS this.settings', this.settings);

        this.loadUI();
      }
    );
  }

  ionViewWillEnter() {
    this.loadData();
  }

  loadData() {
    Promise.all([
      this.settingsService.loadSettings(),
      this.widgetsService.getAllWidgets(),
      this.widgetsService.getData(),
    ]).then((data) => {
      this.loaded = true;
      this.settings = data[0];
      this.allWidgets = data[1];
      this.accountWidgetsIds = data[2].map((w: WidgetInterface) => w.widget_id);
      this.accountWidgets = this.allWidgets.filter((w) =>
        this.accountWidgetsIds.includes(w.path)
      );
      this.loadUI();
      console.log('SettingsPage loadData() Promise all data', data);
    });
  }

  ionViewDidLeave() {
    this.loaded = false;
  }

  async loadUI() {
    let widgets: Widget[] = [];
    this.viewSettings =
      this.settings.views[
        this.settingsService.getActiveViewSettingsIndex(this.activeViewId)
      ];
    console.log('viewSettings', this.viewSettings);

    if (this.viewSettings.widgets != undefined) {
      for (let path of this.viewSettings.widgets) {
        let widget: Widget | undefined = this.accountWidgets.find(
          (w) => w.path == path
        );
        if (widget != undefined) {
          widgets.push(widget);
        }
      }
    }
    this.title = this.viewSettings.title ?? '';
    this.activeWidgets = [...widgets];
    this.generateSelectableWidgets();
  }

  saveView() {
    this.settingsService.saveView({
      activeViewId: this.activeViewId,
      title: this.title,
      slot: this.slot,
      activeWidgets: this.activeWidgets,
    });
  }

  changeView(activeViewId: string) {
    this.activeViewId = activeViewId;
    this.loadUI();
  }

  changeTitle(event: any) {
    if (event) {
      this.title = event.detail.value ?? '';
      this.saveView();
    }
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
              this.activeWidgets
            );

            this.saveView();
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
    this.saveView();
  }

  generateSelectableWidgets() {
    this.selectableWidgets = this.accountWidgets.filter((el: Widget) => {
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
        (view) => view.id == tab.view
      );
      if (view != undefined) return view.title;
    }
    return '-';
  }

  reorderToggle() {
    this.reorder = !this.reorder;
  }

  handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    this.activeWidgets = event.detail.complete(this.activeWidgets);
    this.saveView();
  }

  close() {
    this.navCtrl.back();
  }

  isiOS() {
    return this.platform.isiOS;
  }
}

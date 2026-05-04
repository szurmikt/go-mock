import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { Widget } from '../models/widgets.interface';
import {
  DashboardTab,
  DashboardView,
  Settings,
  TabType,
} from 'src/app/models/settings.interface';
import { BehaviorSubject } from 'rxjs';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  settings: Settings = {
    widgets: [],
    views: [],
    tabs: [],
  };
  defaultSettings: Settings = {
    widgets: [
      'idscan',
      'addtask',
      'occupancy',
      'arrivals',
      'departures',
      'guestfeedback',
    ],
    views: [],
    tabs: [],
  };

  public settingsBS: BehaviorSubject<Settings> = new BehaviorSubject<Settings>(
    this.settings
  );

  constructor(
    private localStorage: StorageService,
    private userService: UserService
  ) {
    let homeView: DashboardView = {
      id: 'view1',
      title: 'Home',
      widgets: [],
    };
    this.settings.views.push(homeView);

    for (let i = 2; i < 6; i++) {
      let view: DashboardView = {
        id: 'view' + i,
        title: 'View #' + i,
        widgets: [],
      };
      this.settings.views.push(view);
    }

    let homeTab: DashboardTab = {
      id: 'tab1',
      icon: 'assets/icon/icon-home.svg',
      view: 'view1',
      weight: 0,
      enabled: true,
      type: TabType.View,
      action: undefined,
    };
    this.settings.tabs.push(homeTab);

    this.settingsBS.next(this.settings);

    this.defaultSettings.views = [...this.settings.views];
    this.defaultSettings.tabs = [...this.settings.tabs];
  }

  saveWidgets(widgets: Widget[]) {
    let newSettings: Settings = structuredClone(this.settings);
    newSettings.widgets = [];
    newSettings.widgets = [...widgets.map((w) => w.path)];
    this.settingsBS.next(newSettings!);
    this.localStorage.setLocalData(this.getStorageKey(), newSettings);
    this.settings = newSettings;
  }

  loadSettings() {
    let key = this.getStorageKey();
    console.log('loadSettings this.getStorageKey()', key);

    return this.localStorage.getLocalData(key).then((settings) => {
      this.settings.widgets = [...this.defaultSettings.widgets];
      this.settings.views = [...this.defaultSettings.views];
      this.settings.tabs = [...this.defaultSettings.tabs];
      if (settings && settings !== '') {
        this.settings = settings;
        console.log('loadSettings settings', settings);
      } else {
        console.log('loadSettings empty settings return default ', settings);
      }
      console.log('loadSettings return this.settings', this.settings);
      this.settingsBS.next(this.settings);
      return this.settings;
    });
  }

  addTab() {
    let newTab: DashboardTab = {
      id: 'tab' + (this.settings.tabs.length + 1),
      icon: 'assets/icon/icon-default.svg',
      view: undefined,
      weight: 1,
      enabled: false,
      type: TabType.View,
      action: undefined,
    };
    this.settings.tabs.push(newTab);

    this.settingsBS.next(this.settings);

    return newTab;
  }

  saveView({
    activeViewId,
    title,
    slot,
    activeWidgets,
  }: {
    activeViewId: string;
    title: string;
    slot: number;
    activeWidgets: Widget[];
  }) {
    let activeWidgetJson = activeWidgets.map((widget: Widget) => {
      return widget.path;
    });
    let newSettings: Settings = structuredClone(this.settings);
    let viewData = {
      id: activeViewId,
      title: title,
      widgets: activeWidgetJson,
      slot: slot,
    };

    newSettings.views[this.getActiveViewSettingsIndex(activeViewId)] = viewData;

    this.settingsBS.next(newSettings!);

    this.localStorage.setLocalData(this.getStorageKey(), newSettings);
    this.settings = newSettings;
  }

  saveTab(newTab: DashboardTab) {
    this.settings.tabs[
      this.settings.tabs.findIndex((tab) => tab.id == newTab.id)
    ] = newTab;
    this.localStorage.setLocalData(this.getStorageKey(), this.settings);
    // .then((_) => this.loadSettings());
    this.settingsBS.next(this.settings);
  }

  getActiveViewSettingsIndex(activeView: string) {
    console.log('getActiveViewSettingsIndex activeView', activeView);
    console.log(
      'getActiveViewSettingsIndex this.settings',
      this.settings.views
    );

    return this.settings.views.findIndex((value) => value.id == activeView);
  }

  getAvailableViews() {
    return this.settings.views.filter((view) => view.widgets.length > 0);
  }

  getStorageKey() {
    let propertyId = this.userService.getPropertyId();
    console.log('settingsService getStorageKey propertyId', propertyId);
    let key = 'widget_settings_' + propertyId;
    console.log('settingsService getStorageKey key', key);
    return key;
  }
}

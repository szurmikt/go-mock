import { Component, inject, Input, OnInit } from '@angular/core';
import {
  DashboardTab,
  DashboardView,
  TabType,
} from 'src/app/models/settings.interface';
import {
  ModalController,
  IonContent,
  IonGrid,
  IonCol,
  IonRow,
  IonImg,
  IonList,
  IonItem,
  IonToggle,
} from '@ionic/angular/standalone';
import { NgClass } from '@angular/common';
import { PlatformService } from 'src/app/services/platform.service';

@Component({
  selector: 'app-dashboard-tab',
  templateUrl: './dashboard-tab.component.html',
  styleUrls: ['./dashboard-tab.component.scss'],
  imports: [
    IonContent,
    IonToggle,
    IonItem,
    IonList,
    IonImg,
    IonRow,
    IonCol,
    IonGrid,
    NgClass
],
})
export class DashboardTabComponent implements OnInit {
  @Input()
  tab!: DashboardTab;

  @Input()
  views: DashboardView[] = [];

  enabled: any;

  icons = [
    'assets/icon/icon-home.svg',
    'assets/icon/icon-default.svg',
    'assets/icon/icon-chart.svg',
    'assets/icon/icon-screen.svg',
    'assets/icon/icon-user.svg',
    'assets/icon/icon-calendar.svg',
  ];

  constructor(
    private modalCtrl: ModalController = inject(ModalController),
    private platform: PlatformService
  ) {}

  ngOnInit() {}

  setIcon(icon: string) {
    this.tab.icon = icon;
  }

  setView(viewId: string) {
    this.tab.view = viewId;
    this.tab.action = undefined;
    this.tab.type = TabType.View;
  }

  setAction(actionId: string) {
    this.tab.action = actionId;
    this.tab.view = undefined;
    this.tab.type = TabType.Action;
  }

  setStatus() {
    this.tab.enabled = !this.tab.enabled;
  }

  dismissModal() {
    this.modalCtrl.dismiss({
      newTab: this.tab,
    });
  }

  isiOS() {
    return this.platform.isiOS;
  }
}

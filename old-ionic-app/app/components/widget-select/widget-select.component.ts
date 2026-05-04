import { NgClass } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import {
  ModalController,
  IonList,
  IonItem,
  IonLabel,
  IonImg,
  IonCol,
  IonRow,
  IonGrid,
  IonContent,
} from '@ionic/angular/standalone';
import { Widget } from 'src/app/models/widgets.interface';
import { PlatformService } from 'src/app/services/platform.service';

@Component({
  selector: 'app-widget-select',
  templateUrl: './widget-select.component.html',
  styleUrls: ['./widget-select.component.scss'],
  imports: [
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonLabel,
    IonItem,
    IonList,
    IonImg,
    NgClass
],
})
export class WidgetSelectComponent {
  @Input() widgets: Widget[] = [];

  constructor(
    private modalCtrl: ModalController = inject(ModalController),
    private platform: PlatformService
  ) {}

  closeModal(widget: Widget) {
    this.modalCtrl.dismiss({
      newWidget: widget,
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }

  isiOS() {
    return this.platform.isiOS;
  }
}

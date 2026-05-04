import { Component, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
} from '@ionic/angular/standalone';
import { CustomBackButtonComponent } from 'src/app/components/custom-back-button/custom-back-button.component';

@Component({
  selector: 'app-occupancy',
  templateUrl: './occupancy.page.html',
  styleUrls: ['./occupancy.page.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    CustomBackButtonComponent,
  ],
})
export class OccupancyPage implements OnInit {
  constructor() {}

  ngOnInit() {}
}

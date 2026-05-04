import { Component, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-dailyperformance',
  templateUrl: './dailyperformance.page.html',
  styleUrls: ['./dailyperformance.page.scss'],
  standalone: true,
  imports: [
    IonButtons,
    IonBackButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
  ],
})
export class DailyperformancePage implements OnInit {
  constructor() {}

  ngOnInit() {}
}

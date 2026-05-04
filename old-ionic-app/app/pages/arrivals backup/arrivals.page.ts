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
  selector: 'app-arrivals',
  templateUrl: './arrivals.page.html',
  styleUrls: ['./arrivals.page.scss'],
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
export class ArrivalsPage implements OnInit {
  constructor() {}

  ngOnInit() {}
}

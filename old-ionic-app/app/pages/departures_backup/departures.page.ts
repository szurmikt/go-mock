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
  selector: 'app-departures',
  templateUrl: './departures.page.html',
  styleUrls: ['./departures.page.scss'],
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
export class DeparturesPage implements OnInit {
  constructor() {}

  ngOnInit() {}
}

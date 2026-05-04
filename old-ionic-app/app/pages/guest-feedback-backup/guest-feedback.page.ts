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
  selector: 'app-guest-feedback',
  templateUrl: './guest-feedback.page.html',
  styleUrls: ['./guest-feedback.page.scss'],
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
export class GuestFeedbackPage implements OnInit {
  constructor() {}

  ngOnInit() {}
}

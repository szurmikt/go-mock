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
  selector: 'app-idscan',
  templateUrl: './idscan.page.html',
  styleUrls: ['./idscan.page.scss'],
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
export class IdScanPage implements OnInit {
  constructor() {}

  ngOnInit() {}
}

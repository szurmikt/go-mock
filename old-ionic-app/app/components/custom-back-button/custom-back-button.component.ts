import { Component, Input } from '@angular/core';
import { IonBackButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
@Component({
  selector: 'custom-back-button',
  templateUrl: './custom-back-button.component.html',
  styleUrls: ['./custom-back-button.component.scss'],
  imports: [IonBackButton],
})
export class CustomBackButtonComponent {
  @Input()
  href: string = '';

  @Input()
  text: string = '';

  constructor() {
    addIcons({
      chevronback: 'assets/icon/icon-chevron-back-outline.svg',
    });
  }
}

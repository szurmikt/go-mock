import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-update-required',
  templateUrl: './update-required.page.html',
  standalone: true,
  imports: [IonContent, TranslatePipe],
})
export class UpdateRequiredPage {}

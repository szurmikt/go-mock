import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-go-unavailable',
  templateUrl: './go-unavailable.page.html',
  standalone: true,
  imports: [IonContent, TranslatePipe],
})
export class GoUnavailablePage {}

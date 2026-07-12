import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-service-unavailable',
  templateUrl: './service-unavailable.page.html',
  standalone: true,
  imports: [IonContent, TranslatePipe],
})
export class ServiceUnavailablePage {
  retry(): void {
    // Full reload re-runs the boot sequence (app.component.ts), which re-resolves
    // the property gate from scratch — simplest way to retry a boot-time failure.
    window.location.reload();
  }
}

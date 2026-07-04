import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { DOCUMENT_TYPES, DocumentTypeConfig } from '../../models/document-type';
import { CaptureSessionService } from '../../services/capture-session.service';

/**
 * Entry point — picks the document type, then hands straight off to the Scan page (the reader).
 */
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonContent],
})
export class HomePage {
  private readonly session = inject(CaptureSessionService);
  private readonly router = inject(Router);

  readonly documentTypes = DOCUMENT_TYPES;

  chooseType(type: DocumentTypeConfig): void {
    this.session.start(type);
    void this.router.navigateByUrl('/capture/scan');
  }
}

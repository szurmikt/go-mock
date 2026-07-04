import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { Side } from '../../models/document-type';
import { CaptureSessionService } from '../../services/capture-session.service';
import { IdRecognitionService } from '../../services/idrecognition.service';
import { IdscanlyDocuscanService } from '../../services/idscanly-docuscan.service';
import { CaptureQuality } from '../../models/capture-quality';

interface ReviewImage {
  side: Side;
  label: string;
  src: string;
  quality: CaptureQuality;
}

@Component({
  selector: 'app-idscanly-review',
  templateUrl: 'review.page.html',
  styleUrls: ['review.page.scss'],
  imports: [IonContent],
})
export class IdscanReviewPage {
  private readonly session = inject(CaptureSessionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly idRecognition = inject(IdRecognitionService);
  private readonly idscanlyDocuscan = inject(IdscanlyDocuscanService);

  readonly documentType = this.session.documentType;

  readonly images = computed<ReviewImage[]>(() => {
    const type = this.documentType();
    if (!type) return [];
    return type.sides
      .map((side) => {
        const capture = this.session.getSide(side);
        return capture
          ? { side, label: side === 'front' ? 'Front side' : 'Back side', src: capture.fullDataUrl, quality: capture.quality }
          : null;
      })
      .filter((image): image is ReviewImage => image !== null);
  });

  readonly isTwoSided = computed(() => (this.documentType()?.sides.length ?? 0) > 1);

  readonly captureSummary = computed(() => {
    const n = this.images().length;
    return `${n} ${n === 1 ? 'side' : 'sides'} captured · check before submitting`;
  });

  readonly allGood = computed(() => this.images().every((i) => i.quality.verdict === 'good'));

  readonly footerNote = computed(() =>
    this.allGood()
      ? 'All clear — ready to submit.'
      : 'One side could be clearer — you can still submit or retake it.',
  );

  readonly submitLabel = computed(() => (this.isTwoSided() ? 'Submit both sides' : 'Submit'));

  readonly lightbox = signal<ReviewImage | null>(null);
  readonly zoomed = signal(false);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  openLightbox(image: ReviewImage): void {
    this.zoomed.set(false);
    this.lightbox.set(image);
  }

  closeLightbox(): void {
    this.lightbox.set(null);
    this.zoomed.set(false);
  }

  toggleZoom(event: Event): void {
    event.stopPropagation();
    this.zoomed.update((z) => !z);
  }

  goBack(): void {
    this.location.back();
  }

  retake(side: Side): void {
    this.session.clearSide(side);
    void this.router.navigateByUrl('/idscanly/scan');
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);

    try {
      const captures = Array.from(this.session.captures().values());
      const docType = this.session.documentType();
      const ctx = this.session.context();

      if (!docType || !ctx) {
        throw new Error('Session context missing — please start over.');
      }

      const response = await this.idRecognition.submit(captures);
      const mapped = this.idscanlyDocuscan.mapToScanResult(response, docType);

      this.session.scanResult.set(mapped);

      // Navigate back to guest-detail, replacing the review+scan entries in the stack so
      // the user can't back-navigate into the completed scan flow.
      await this.router.navigate(
        ['/guest', ctx.reservationCode, ctx.guestId],
        { replaceUrl: true },
      );
    } catch (err) {
      this.submitError.set(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      this.submitting.set(false);
    }
  }
}

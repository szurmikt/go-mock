import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { CaptureQuality } from '../../models/capture-quality';
import { Side } from '../../models/document-type';
import { CaptureSessionService } from '../../services/capture-session.service';

interface ReviewImage {
  side: Side;
  /** "Front side" / "Back side" chip label. */
  label: string;
  src: string;
  quality: CaptureQuality;
}

/**
 * Results screen — lets a human eyeball each capture before submitting, backed by the per-side quality
 * verdict computed at capture time. This verdict is the only quality control on the manual-shutter path
 * (which bypasses every live gate), so the "Recheck"/"Retake" affordances here are the real backstop.
 */
@Component({
  selector: 'app-review',
  templateUrl: 'review.page.html',
  styleUrls: ['review.page.scss'],
  imports: [IonContent],
})
export class ReviewPage {
  private readonly session = inject(CaptureSessionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly documentType = this.session.documentType;

  readonly images = computed<ReviewImage[]>(() => {
    const type = this.documentType();
    if (!type) {
      return [];
    }
    return type.sides
      .map((side) => {
        const capture = this.session.getSide(side);
        return capture
          ? {
              side,
              label: side === 'front' ? 'Front side' : 'Back side',
              src: capture.fullDataUrl,
              quality: capture.quality,
            }
          : null;
      })
      .filter((image): image is ReviewImage => image !== null);
  });

  readonly isTwoSided = computed(() => (this.documentType()?.sides.length ?? 0) > 1);

  /** "N side(s) captured · check before submitting" line under the document title. */
  readonly captureSummary = computed(() => {
    const n = this.images().length;
    return `${n} ${n === 1 ? 'side' : 'sides'} captured · check before submitting`;
  });

  /** Every captured side passed all quality checks. */
  readonly allGood = computed(() => this.images().every((i) => i.quality.verdict === 'good'));

  /** Footer note — flips depending on whether anything needs a recheck. */
  readonly footerNote = computed(() =>
    this.allGood()
      ? 'All clear — ready to submit.'
      : 'One side could be clearer — you can still submit or retake it.',
  );

  readonly submitLabel = computed(() => (this.isTwoSided() ? 'Submit both sides' : 'Submit'));

  /** The image currently shown in the fullscreen zoom lightbox (null = closed). */
  readonly lightbox = signal<ReviewImage | null>(null);
  /** Whether the lightbox image is at its zoomed-in scale (toggled by tapping the image). */
  readonly zoomed = signal(false);

  /** "Submitted" confirmation overlay — shown briefly before the session resets to Home. */
  readonly submitted = signal(false);

  openLightbox(image: ReviewImage): void {
    this.zoomed.set(false);
    this.lightbox.set(image);
  }

  closeLightbox(): void {
    this.lightbox.set(null);
    this.zoomed.set(false);
  }

  toggleZoom(event: Event): void {
    // Don't let the tap bubble to the backdrop (which would close the lightbox).
    event.stopPropagation();
    this.zoomed.update((z) => !z);
  }

  goBack(): void {
    this.location.back();
  }

  /** Retake a single side: drop just that capture and return to scan, which resumes on it. */
  retake(side: Side): void {
    this.session.clearSide(side);
    void this.router.navigateByUrl('/capture/scan');
  }

  /** Flash a confirmation, then hand off to the /idrecognition result screen, which
   *  reads the still-live session captures and resets it once it's done with them. */
  submit(): void {
    if (this.submitted()) {
      return;
    }
    this.submitted.set(true);
    setTimeout(() => {
      void this.router.navigateByUrl('/idrecognition/result');
    }, 1200);
  }
}

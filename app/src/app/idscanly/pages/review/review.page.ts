import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { getDocumentType, Side } from '../../models/document-type';
import { CaptureSessionService, CapturedSide } from '../../services/capture-session.service';
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
export class IdscanReviewPage implements OnInit {
  private readonly session = inject(CaptureSessionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly idRecognition = inject(IdRecognitionService);
  private readonly idscanlyDocuscan = inject(IdscanlyDocuscanService);

  /** Set when the page was opened via ?preview= — see ngOnInit / seedPreview. */
  private readonly preview = signal(false);

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

  ngOnInit(): void {
    // Dev-only: seed mock captures so the Review UI can be exercised in the browser,
    // where the camera + OpenCV scan can't run. Mirrors the app's other ?preview= hooks
    // (guest-detail ?previewScanSheet=, id-scan ?preview=). No production flow reaches this.
    const mode = this.route.snapshot.queryParamMap.get('preview');
    if (mode !== null) this.seedPreview(mode);
  }

  private seedPreview(mode: string): void {
    this.preview.set(true);
    if (mode === 'good' || mode === 'recheck') {
      const type = getDocumentType('driving-licence'); // single-sided
      this.session.start(type);
      this.session.setSide(this.mockCapture('front', mode));
    } else {
      // 'idcard' (and any unknown value): two-sided ID, front good + back recheck.
      const type = getDocumentType('id-card');
      this.session.start(type);
      this.session.setSide(this.mockCapture('front', 'good'));
      this.session.setSide(this.mockCapture('back', 'recheck'));
    }
  }

  private mockCapture(side: Side, verdict: 'good' | 'recheck'): CapturedSide {
    const url = this.placeholderImage(side);
    return {
      side,
      // Required by the type but never read by the Review page (it uses fullDataUrl + quality only).
      fullCanvas: document.createElement('canvas'),
      fullDataUrl: url,
      thumbDataUrl: url,
      quality: this.mockQuality(verdict),
    };
  }

  private mockQuality(verdict: 'good' | 'recheck'): CaptureQuality {
    const good = verdict === 'good';
    return {
      sharp: good,
      wellLit: good,
      glareFree: good,
      verdict,
      summary: good ? 'Sharp, well-lit, glare-free' : 'Could be sharper · glare detected',
      metrics: good
        ? { laplacianVar: 420, meanLuminance: 138, clippedFraction: 0.01 }
        : { laplacianVar: 55, meanLuminance: 96, clippedFraction: 0.14 },
    };
  }

  /** Inline SVG placeholder (ID-1 ratio) — no binary asset needed; renders in <img> + lightbox. */
  private placeholderImage(side: Side): string {
    const label = side === 'front' ? 'FRONT' : 'BACK';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="810" height="510" viewBox="0 0 810 510">` +
      `<rect width="810" height="510" rx="24" fill="#d7dbe0"/>` +
      `<rect x="40" y="40" width="200" height="150" rx="12" fill="#b9bfc7"/>` +
      `<rect x="280" y="60" width="440" height="26" rx="6" fill="#b9bfc7"/>` +
      `<rect x="280" y="110" width="360" height="26" rx="6" fill="#c4c9d0"/>` +
      `<rect x="280" y="160" width="300" height="26" rx="6" fill="#c4c9d0"/>` +
      `<text x="405" y="380" font-family="Nunito, sans-serif" font-size="88" font-weight="800" ` +
      `fill="#8a929c" text-anchor="middle">${label}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

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
    // Preview mode has no real captures/context — don't hit the Edge Function or navigate.
    if (this.preview()) return;
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

import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import * as Sentry from '@sentry/angular';
import { getDocumentType, Side } from '../../models/document-type';
import { CaptureSessionService, CapturedSide } from '../../services/capture-session.service';
import { IdRecognitionService } from '../../services/idrecognition.service';
import { IdscanlyDocuscanService } from '../../services/idscanly-docuscan.service';
import { PropertyConfigService } from '../../../services/property-config.service';
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
  imports: [IonContent, DecimalPipe],
})
export class IdscanReviewPage implements OnInit, OnDestroy {
  private readonly session = inject(CaptureSessionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly idRecognition = inject(IdRecognitionService);
  private readonly idscanlyDocuscan = inject(IdscanlyDocuscanService);
  private readonly propertyConfig = inject(PropertyConfigService);

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

  readonly captureSummary = computed(() => {
    const n = this.images().length;
    return `${n} ${n === 1 ? 'side' : 'sides'} captured · check before submitting`;
  });

  readonly allGood = computed(() => this.images().every((i) => i.quality.verdict === 'good'));

  readonly footerNote = computed(() =>
    this.allGood() ? '' : 'One side could be clearer — you can still submit or retake it.',
  );

  /** Fixed-length slot list for the dot-chase loader — see submit-overlay in the template. */
  readonly dotIndices = Array.from({ length: 10 }, (_, i) => i);

  readonly lightbox = signal<ReviewImage | null>(null);
  readonly zoomed = signal(false);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  /** Once the user has tapped Submit, the pre-submit quality nag stops competing with submitError. */
  readonly submitAttempted = signal(false);

  /** Dev/QA toggle for the per-side metrics readout — mirrors the Scan page's debug overlay. */
  readonly showDebug = signal(false);

  /**
   * `idrecognition` (see IdRecognitionService.submit) is a single opaque fetch — the edge function
   * polls the vendor internally, every 2s, up to 30s, before replying once. There's no real progress
   * fraction to report, so these stages are TIMED, not event-driven: a well-understood, honest way to
   * keep the wait from reading as frozen. The third stage exists because the up-to-30s tail is real
   * (per docs/idrecognition-handoff.md) — without it the UI would sit on "Running recognition…" for the
   * whole tail.
   */
  readonly submitStage = signal<'images' | 'recognition' | 'longwait'>('images');
  private stageTimers: ReturnType<typeof setTimeout>[] = [];

  readonly submitStageMessage = computed(() => {
    switch (this.submitStage()) {
      case 'images':
        return 'Processing images…';
      case 'recognition':
        return 'Running recognition…';
      case 'longwait':
        return 'Still working — almost there…';
    }
  });

  private startStageTimers(): void {
    this.clearStageTimers();
    this.submitStage.set('images');
    this.stageTimers.push(setTimeout(() => this.submitStage.set('recognition'), 2500));
    this.stageTimers.push(setTimeout(() => this.submitStage.set('longwait'), 10000));
  }

  private clearStageTimers(): void {
    this.stageTimers.forEach((t) => clearTimeout(t));
    this.stageTimers = [];
  }

  ngOnDestroy(): void {
    this.clearStageTimers();
  }

  ngOnInit(): void {
    // Dev-only: seed mock captures so the Review UI can be exercised in the browser,
    // where the camera + OpenCV scan can't run. Mirrors the app's other ?preview= hooks
    // (guest-detail ?previewScanSheet=, id-scan ?preview=). No production flow reaches this.
    const mode = this.route.snapshot.queryParamMap.get('preview');
    if (mode !== null) this.seedPreview(mode);
  }

  private seedPreview(mode: string): void {
    this.preview.set(true);
    if (mode === 'good' || mode === 'recheck' || mode === 'partial') {
      const type = getDocumentType('driving-licence'); // single-sided
      this.session.start(type);
      this.session.setSide(this.mockCapture('front', mode));
    } else if (mode === 'submitting') {
      // Demos the submit-progress overlay without hitting the Edge Function — submit() itself
      // early-returns in preview mode, so drive the same signals/timers it would.
      const type = getDocumentType('driving-licence');
      this.session.start(type);
      this.session.setSide(this.mockCapture('front', 'good'));
      this.submitting.set(true);
      this.startStageTimers();
    } else {
      // 'idcard' (and any unknown value): two-sided ID, front good + back recheck.
      const type = getDocumentType('id-card');
      this.session.start(type);
      this.session.setSide(this.mockCapture('front', 'good'));
      this.session.setSide(this.mockCapture('back', 'recheck'));
    }
  }

  private mockCapture(side: Side, verdict: 'good' | 'recheck' | 'partial'): CapturedSide {
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

  /** 'partial' demos the completeness check (see `DocumentDetectionService.analyzeCompleteness`) —
   *  a sharp, well-lit, glare-free capture that's still missing part of the document. */
  private mockQuality(verdict: 'good' | 'recheck' | 'partial'): CaptureQuality {
    const good = verdict === 'good';
    const partial = verdict === 'partial';
    return {
      sharp: good || partial,
      wellLit: good || partial,
      glareFree: good || partial,
      complete: good,
      verdict: good ? 'good' : 'recheck',
      summary: good
        ? 'Sharp, well-lit, glare-free'
        : partial
          ? 'Part of the document may be out of frame'
          : 'Could be sharper · glare detected',
      metrics: good
        ? { laplacianVar: 420, meanLuminance: 138, clippedFraction: 0.01, cornersFound: true, coverageFraction: 0.94, ratio: 1.58, completenessReason: null }
        : partial
          ? { laplacianVar: 380, meanLuminance: 130, clippedFraction: 0.02, cornersFound: true, coverageFraction: 0.52, ratio: 1.1, completenessReason: 'clipped' as const }
          : { laplacianVar: 55, meanLuminance: 96, clippedFraction: 0.14, cornersFound: false, coverageFraction: 0, ratio: 0, completenessReason: 'not-found' as const },
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

  toggleDebug(): void {
    this.showDebug.update((v) => !v);
  }

  /**
   * Full idrecognition response, console + Sentry Logs (mirrors Regula's logScanOutcome/
   * buildScanDiagnostics pairing) — gated on the CURRENT property's `extended_logging` flag
   * (property_config table), never unconditional. The response contains guest PII (name, DOB,
   * document number, mother's maiden name); logging it everywhere for everyone would leak that into
   * Sentry via breadcrumbs on any unrelated error. Opt-in per property keeps it off by default.
   */
  private logIdscanlyResponse(response: unknown): void {
    if (!this.propertyConfig.extendedLogging()) return;

    console.log('[idscanly] idrecognition response:', response);

    const json = JSON.stringify(response);
    const cappedJson = json.length > 16000 ? `${json.slice(0, 16000)}…[truncated ${json.length} chars]` : json;
    const r = response as {
      sessionId?: string;
      status?: string;
      isProcessing?: boolean;
      summary?: { isComplete?: boolean; imageCount?: number; successfulImageCount?: number; failedImageCount?: number };
    };
    Sentry.logger.info('idscanly response', {
      session_id: String(r?.sessionId ?? ''),
      status: String(r?.status ?? ''),
      is_processing: !!r?.isProcessing,
      is_complete: !!r?.summary?.isComplete,
      image_count: Number(r?.summary?.imageCount ?? -1),
      successful_image_count: Number(r?.summary?.successfulImageCount ?? -1),
      failed_image_count: Number(r?.summary?.failedImageCount ?? -1),
      response_json: cappedJson,
    });
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    // Set before the preview early-return so ?preview= can still demo the note disappearing.
    this.submitAttempted.set(true);
    // Preview mode has no real captures/context — don't hit the Edge Function or navigate.
    if (this.preview()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    this.startStageTimers();

    try {
      const captures = Array.from(this.session.captures().values());
      const docType = this.session.documentType();
      const ctx = this.session.context();

      if (!docType || !ctx) {
        throw new Error('Session context missing — please start over.');
      }

      const response = await this.idRecognition.submit(captures);
      this.logIdscanlyResponse(response);
      const mapped = this.idscanlyDocuscan.mapToScanResult(response, docType);
      this.clearStageTimers();

      this.session.scanResult.set(mapped);

      // Navigate back to guest-detail, replacing the review+scan entries in the stack so
      // the user can't back-navigate into the completed scan flow.
      await this.router.navigate(
        ['/guest', ctx.reservationCode, ctx.guestId],
        { replaceUrl: true },
      );
    } catch (err) {
      this.clearStageTimers();
      this.submitError.set(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      this.submitting.set(false);
    }
  }
}

import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import * as Sentry from '@sentry/angular';
import { getDocumentType, Side } from '../../models/document-type';
import { CaptureSessionService, CapturedSide } from '../../services/capture-session.service';
import { IdRecognitionService } from '../../services/idrecognition.service';
import { IdscanlyDocuscanService } from '../../services/idscanly-docuscan.service';
import { DocumentDetectionService } from '../../services/document-detection.service';
import { PropertyConfigService } from '../../../services/property-config.service';
import { AuthService } from '../../../services/auth';
import { AppVersionService } from '../../../services/app-version';
import { MixpanelService } from '../../../services/mixpanel';
import { CaptureQuality } from '../../models/capture-quality';
import { LanguageService } from '../../../services/language.service';
import { TranslatePipe } from '../../../pipes/translate.pipe';

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
  imports: [IonContent, DecimalPipe, TranslatePipe],
})
export class IdscanReviewPage implements OnInit, OnDestroy {
  private readonly session = inject(CaptureSessionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly idRecognition = inject(IdRecognitionService);
  private readonly idscanlyDocuscan = inject(IdscanlyDocuscanService);
  private readonly detection = inject(DocumentDetectionService);
  private readonly propertyConfig = inject(PropertyConfigService);
  private readonly auth = inject(AuthService);
  private readonly appVersion = inject(AppVersionService);
  private readonly mixpanel = inject(MixpanelService);
  private readonly lang = inject(LanguageService);

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
          ? {
              side,
              label: this.lang.t(side === 'front' ? 'idscanly.frontSide' : 'idscanly.backSide'),
              src: capture.fullDataUrl,
              quality: capture.quality,
            }
          : null;
      })
      .filter((image): image is ReviewImage => image !== null);
  });

  readonly missingSides = computed<{ side: Side; label: string }[]>(() => {
    const type = this.documentType();
    if (!type) return [];
    return type.sides
      .filter((s) => !this.session.getSide(s))
      .map((side) => ({
        side,
        label: this.lang.t(side === 'front' ? 'idscanly.frontSide' : 'idscanly.backSide'),
      }));
  });

  readonly captureSummary = computed(() => {
    const n = this.images().length;
    const missing = this.missingSides().length;
    if (missing > 0) {
      return this.lang.t('idscanly.captureSummaryPartial', { captured: n, total: n + missing });
    }
    return n === 1
      ? this.lang.t('idscanly.captureSummarySingle')
      : this.lang.t('idscanly.captureSummaryMultiple', { n });
  });

  readonly lightbox = signal<ReviewImage | null>(null);
  readonly zoomed = signal(false);

  readonly lightboxCaption = computed(() => {
    const image = this.lightbox();
    if (!image) return '';
    return this.lang.t(
      this.zoomed() ? 'idscanly.lightboxCaptionFit' : 'idscanly.lightboxCaptionZoom',
      { label: image.label },
    );
  });

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  /** Dev/QA toggle for the per-side metrics readout — mirrors the Scan page's debug overlay. */
  readonly showDebug = signal(false);

  /** Dev/QA "Show debug" tooling — gated by OTA channel, not a hardcoded property ID; 'dev'
   *  already designates the internal test cohort for live-update rollout. */
  readonly debugToolsEnabled = computed(() => this.propertyConfig.liveUpdateChannel() === 'dev');

  /** Discard-confirmation dialog — opened by the header X, since real captures exist here. */
  readonly confirmDiscardOpen = signal(false);

  /**
   * `idrecognition` (see IdRecognitionService.submit) is a single opaque fetch — the edge function
   * polls the vendor internally, every 2s, up to 30s, before replying once. There's no real progress
   * fraction to report, so the stages are TIMED, not event-driven. 10s is the overlay's tick ring
   * duration (avg recognition ≈ 9.2s; the ring's CSS animation in review.page.scss must match it);
   * 'longwait' exists because the up-to-30s tail is real (per docs/idrecognition-handoff.md) —
   * without it the UI would sit on a full, silent ring for the whole tail.
   */
  readonly submitStage = signal<'processing' | 'longwait'>('processing');
  private stageTimers: ReturnType<typeof setTimeout>[] = [];
  /** Submit is retryable via the same button after a failure — counts attempts for tracking. */
  private submitAttempts = 0;

  readonly submitStageMessage = computed(() =>
    this.lang.t(
      this.submitStage() === 'longwait' ? 'idscanly.submitLongwait' : 'idscanly.submitProcessing',
    ),
  );

  private startStageTimers(): void {
    this.clearStageTimers();
    this.submitStage.set('processing');
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
      source: 'auto',
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

  /** Opens the discard-confirmation dialog — the header X never navigates directly on this
   *  screen, since real captured photos would be thrown away. */
  close(): void {
    this.confirmDiscardOpen.set(true);
  }

  cancelDiscard(): void {
    this.confirmDiscardOpen.set(false);
  }

  /** Terminates the scan: wipes the in-progress capture session and pops the whole IDScanly
   *  flow off history in one shot (see plan notes on replaceUrl). */
  confirmDiscard(): void {
    const type = this.documentType();
    if (type) {
      this.mixpanel.trackScanDiscarded({
        vendor: 'idscanly',
        document_type: type.id,
        stage: 'review',
        sides_captured: this.session.captures().size,
      });
    }
    this.session.reset();
    this.location.back();
  }

  retake(side: Side): void {
    this.session.clearSide(side);
    // replaceUrl: keeps the whole scan flow at one history entry (see scan.page.ts) —
    // each retake round used to push two more entries onto the back stack.
    void this.router.navigateByUrl('/idscanly/scan', { replaceUrl: true });
  }

  toggleDebug(): void {
    this.showDebug.update((v) => !v);
  }

  /**
   * Full idrecognition response, console + Sentry Logs — gated on the CURRENT property's
   * `extended_logging` flag (property_config table), never unconditional. The response
   * contains guest PII (name, DOB,
   * document number, mother's maiden name); logging it everywhere for everyone would leak that into
   * Sentry via breadcrumbs on any unrelated error. Opt-in per property keeps it off by default.
   *
   * Also attaches the same diagnostic data the (now property-gated, see idscanly-debug.const.ts)
   * "Show debug" UI shows — per-side CaptureQuality evaluation and the Scan screen's rolling live-
   * detection log — so a real-world capture/scan issue stays diagnosable remotely via Sentry, not
   * just live on a 6250 device.
   */
  private logIdscanlyResponse(
    response: unknown,
    ctx: { reservationCode: string; guestId: string },
  ): void {
    if (!this.propertyConfig.extendedLogging()) return;

    const propertyId = this.auth.selectedProperty()?.property_id ?? 'unknown';

    const capturesSummary = Array.from(this.session.captures().entries()).map(([side, c]) => ({
      side,
      verdict: c.quality.verdict,
      sharp: c.quality.sharp,
      wellLit: c.quality.wellLit,
      glareFree: c.quality.glareFree,
      complete: c.quality.complete,
      summary: c.quality.summary,
      metrics: c.quality.metrics,
    }));
    // Rolling buffer from DocumentDetectionService — only the most recent ~12 lines (~10s at the
    // current 800ms throttle) survive by the time Submit is reached; earlier-side history may
    // already be evicted. Known limitation, not addressed here.
    const detectionLog = this.detection.logs();

    console.log(
      '[idscanly] idrecognition response:',
      response,
      'captures:',
      capturesSummary,
      'detectionLog:',
      detectionLog,
    );

    const json = JSON.stringify(response);
    const cappedJson = json.length > 16000 ? `${json.slice(0, 16000)}…[truncated ${json.length} chars]` : json;
    const r = response as {
      sessionId?: string;
      status?: string;
      isProcessing?: boolean;
      summary?: { isComplete?: boolean; imageCount?: number; successfulImageCount?: number; failedImageCount?: number };
    };
    Sentry.logger.info(`idscanly response pid=${propertyId} code=${ctx.reservationCode}`, {
      session_id: String(r?.sessionId ?? ''),
      status: String(r?.status ?? ''),
      is_processing: !!r?.isProcessing,
      is_complete: !!r?.summary?.isComplete,
      image_count: Number(r?.summary?.imageCount ?? -1),
      successful_image_count: Number(r?.summary?.successfulImageCount ?? -1),
      failed_image_count: Number(r?.summary?.failedImageCount ?? -1),
      captures_json: JSON.stringify(capturesSummary),
      detection_log_json: JSON.stringify(detectionLog),
      response_json: cappedJson,
      property_id: String(propertyId),
      reservation_code: ctx.reservationCode,
      guest_id: ctx.guestId,
      app_version: this.appVersion.version(),
    });
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    // Preview mode has no real captures/context — don't hit the Edge Function or navigate.
    if (this.preview()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    this.submitAttempts += 1;
    this.startStageTimers();

    const docTypeForTracking = this.session.documentType();

    try {
      const captures = Array.from(this.session.captures().values());
      const docType = this.session.documentType();
      const ctx = this.session.context();

      if (!docType || !ctx) {
        throw new Error(this.lang.t('idscanly.sessionMissing'));
      }

      const response = await this.idRecognition.submit(captures);
      this.logIdscanlyResponse(response, ctx);
      const mapped = this.idscanlyDocuscan.mapToScanResult(response, docType);
      this.clearStageTimers();

      this.session.scanResult.set(mapped);

      // Card bucket always resolves to docType.id === 'id-card' at scan-entry time today (see
      // resolveScanEntryType in document-type.ts) — a stable, bucket-level signal kept separate
      // from document_type in case that field is later updated to reflect IDScanly's post-OCR
      // reclassification (e.g. address-card), which never feeds back into this event.
      const documentForm = docType.id === 'passport' ? 'passport' : 'id';
      const autoCaptureUsed = captures.some((c) => c.source === 'auto');
      // Reuses missingSides — already [] for single-sided types (nothing to skip).
      const secondPageSkipped = this.missingSides().length > 0;
      const flashUsed = this.session.flashUsed;
      const scanDurationSeconds = this.session.elapsedSeconds ?? undefined;

      this.mixpanel.trackScanSucceeded({
        vendor: 'idscanly',
        document_type: docType.id,
        attempts: this.submitAttempts,
        is_complete: response.summary.isComplete,
        is_processing: response.isProcessing,
        image_count: response.summary.imageCount,
        successful_image_count: response.summary.successfulImageCount,
        failed_image_count: response.summary.failedImageCount,
        document_form: documentForm,
        auto_capture_used: autoCaptureUsed,
        '2nd_page_skipped': secondPageSkipped,
        flash_used: flashUsed,
        scan_duration_seconds: scanDurationSeconds,
      });

      // Pop the scan flow's single history entry (scan→review navigations use replaceUrl)
      // to land on the ORIGINAL guest-detail entry — its ionViewWillEnter consumes
      // session.scanResult and opens the result sheet. The previous
      // navigate(..., { replaceUrl }) only replaced the review entry, leaving every
      // scan/review page reachable via the back button after the scan completed.
      this.location.back();
    } catch (err) {
      this.clearStageTimers();
      this.submitError.set(err instanceof Error ? err.message : this.lang.t('errors.generic'));
      this.submitting.set(false);
      this.mixpanel.trackScanFailed({
        vendor: 'idscanly',
        document_type: docTypeForTracking?.id ?? 'unknown',
        reason: (err as { kind?: 'network_error' | 'http_error' | 'empty_response' })?.kind ?? 'error',
        attempt_number: this.submitAttempts,
      });
    }
  }
}

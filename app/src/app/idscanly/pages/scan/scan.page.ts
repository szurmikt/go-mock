import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { CaptureQuality } from '../../models/capture-quality';
import { DocumentTypeConfig, Side } from '../../models/document-type';
import { CaptureSessionService } from '../../services/capture-session.service';
import { CaptureSource, DocumentDetectionService } from '../../services/document-detection.service';
import { DETECTION_TUNING } from '../../capture-tuning';
import { makeThumbnail, toDataUrl } from '../../utils/canvas.util';
import { isManualCaptureNagDue, markManualCaptureNagShown } from '../../utils/manual-capture-nag.util';
import { LanguageService } from '../../../services/language.service';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { AuthService } from '../../../services/auth';
import { MixpanelService } from '../../../services/mixpanel';
import { IDSCANLY_DEBUG_PROPERTY_ID } from '../../idscanly-debug.const';

const ORDINAL_KEYS = ['idscanly.ordinal1', 'idscanly.ordinal2', 'idscanly.ordinal3', 'idscanly.ordinal4'];
const FLIP_PROMPT_MIN_MS = 3000;

@Component({
  selector: 'app-idscanly-scan',
  templateUrl: 'scan.page.html',
  styleUrls: ['scan.page.scss'],
  imports: [IonContent, TranslatePipe],
})
export class IdscanScanPage implements OnDestroy {
  private readonly session = inject(CaptureSessionService);
  private readonly detection = inject(DocumentDetectionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly lang = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly mixpanel = inject(MixpanelService);

  readonly selectedType = signal<DocumentTypeConfig | null>(null);
  readonly currentSideIndex = signal(0);
  readonly errorMessage = signal<string | null>(null);

  readonly status = this.detection.status;
  readonly lightingIssue = this.detection.lightingIssue;
  readonly awaitingExit = this.detection.awaitingExit;
  readonly debug = this.detection.debug;
  readonly logs = this.detection.logs;
  readonly torchSupported = this.detection.torchSupported;
  readonly torchOn = this.detection.torchOn;
  private readonly captures = this.session.captures;

  readonly autoCaptureOn = signal(true);
  readonly pendingManualCapture = signal<{ full: HTMLCanvasElement; quality: CaptureQuality } | null>(null);
  readonly captureFlash = signal(false);
  private readonly flipPromptHold = signal(false);

  readonly showFlipPrompt = computed(() => this.awaitingExit() || this.flipPromptHold());
  readonly showDebug = signal(false);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly debugCanvas = viewChild<ElementRef<HTMLCanvasElement>>('debugCanvas');
  private readonly guide = viewChild<ElementRef<HTMLElement>>('guide');

  readonly currentSide = computed<Side | null>(() => {
    const type = this.selectedType();
    return type ? type.sides[this.currentSideIndex()] : null;
  });

  readonly showSecondPageExtras = computed(() => {
    const type = this.selectedType();
    return !!type && type.sides.length > 1 && this.currentSideIndex() === 1;
  });

  readonly firstPageThumb = computed(() => {
    if (!this.showSecondPageExtras()) return null;
    const type = this.selectedType();
    return type ? (this.session.getSide(type.sides[0])?.thumbDataUrl ?? null) : null;
  });

  readonly pageTitle = computed(() => {
    const type = this.selectedType();
    if (!type) return '';
    const label = this.lang.t(type.label);
    if (type.sides.length <= 1) return label;
    return this.lang.t('idscanly.pageTitleMultiPage', {
      type: label,
      ordinal: this.ordinal(this.currentSideIndex() + 1),
    });
  });

  readonly flipCardLabel = computed(() => {
    const type = this.selectedType();
    return type ? this.lang.t('idscanly.flipCard', { type: this.lang.t(type.label) }) : '';
  });

  readonly message = computed(() => {
    if (this.status() === 'bad-light') {
      return this.lightingIssue() === 'glare'
        ? this.lang.t('idscanly.glareDetected')
        : this.lang.t('idscanly.tooDark');
    }
    if (this.showFlipPrompt()) return this.lang.t('idscanly.turnCard');
    const scanningMessage = this.selectedType()?.scanningMessage;
    return scanningMessage
      ? this.lang.t(scanningMessage)
      : this.lang.t('idscanly.scanningPage', { ordinal: this.ordinal(this.currentSideIndex() + 1) });
  });

  readonly bracketActive = computed(
    () => this.status() === 'aligned' || this.status() === 'captured',
  );

  readonly bracketWarn = computed(() => this.status() === 'bad-light');

  readonly showLoader = computed(
    () => this.selectedType() !== null && this.status() === 'idle' && !this.errorMessage(),
  );

  /** Dev/QA "Show debug" tooling — see idscanly-debug.const.ts. */
  readonly debugToolsEnabled = computed(
    () => String(this.auth.selectedProperty()?.property_id) === IDSCANLY_DEBUG_PROPERTY_ID,
  );

  ionViewWillEnter(): void {
    const type = this.session.documentType();
    if (!type) {
      void this.router.navigate(['/home']);
      return;
    }
    this.errorMessage.set(null);
    this.selectedType.set(type);
    this.autoCaptureOn.set(true);
    const firstMissing = type.sides.findIndex((s) => !this.session.getSide(s));
    this.currentSideIndex.set(firstMissing >= 0 ? firstMissing : 0);
    this.startDetection();
  }

  /** Terminates the scan: releases the camera, wipes the in-progress capture session, and
   *  pops the whole IDScanly flow off history in one shot (see plan notes on replaceUrl). */
  close(): void {
    const type = this.selectedType();
    if (type) {
      this.mixpanel.trackScanDiscarded({
        vendor: 'idscanly',
        document_type: type.id,
        stage: 'capture',
        sides_captured: this.captures().size,
      });
    }
    this.detection.stop();
    this.session.reset();
    this.location.back();
  }

  toggleDebug(): void {
    this.showDebug.update((v) => !v);
  }

  captureManualNow(): void {
    this.detection.captureManual();
  }

  toggleAutoCapture(): void {
    const next = !this.autoCaptureOn();
    this.autoCaptureOn.set(next);
    this.detection.setAutoCapture(next);
  }

  async toggleTorch(): Promise<void> {
    await this.detection.setTorch(!this.torchOn());
  }

  skipSecondPage(): void {
    this.detection.stop();
    void this.router.navigateByUrl('/idscanly/review', { replaceUrl: true });
  }

  retakeFirstPage(): void {
    const type = this.selectedType();
    if (!type) return;
    this.session.clearSide(type.sides[0]);
    this.currentSideIndex.set(0);
    this.detection.arm();
  }

  useTakenPhoto(): void {
    const pending = this.pendingManualCapture();
    if (!pending) return;
    this.pendingManualCapture.set(null);
    this.commitCapture(pending.full, pending.quality, 'manual');
  }

  retakeWithAutoCapture(): void {
    this.pendingManualCapture.set(null);
    this.detection.arm();
  }

  ngOnDestroy(): void {
    this.detection.stop();
  }

  ionViewWillLeave(): void {
    this.detection.stop();
  }

  private ordinal(n: number): string {
    const key = ORDINAL_KEYS[n - 1];
    return key ? this.lang.t(key) : `${n}th`;
  }

  private startDetection(): void {
    const type = this.selectedType();
    const videoEl = this.video()?.nativeElement;
    if (!type || !videoEl) return;
    void this.detection.start({
      video: videoEl,
      targetRatio: type.guideRatio,
      extractWidth: type.extractWidth,
      extractHeight: type.extractHeight,
      tuning: { ...DETECTION_TUNING, ...(type.tuning ?? {}) },
      captureMode: type.captureMode,
      getGuideEl: () => this.guide()?.nativeElement ?? null,
      debugCanvas: this.debugCanvas()?.nativeElement,
      onCapture: (full, quality, source) => this.onCaptured(full, quality, source),
      onError: (error) => {
        this.errorMessage.set(
          typeof error === 'string' ? error : this.lang.t('idscanly.cameraUnavailable'),
        );
        this.mixpanel.trackScanFailed({
          vendor: 'idscanly',
          document_type: this.selectedType()?.id ?? 'unknown',
          reason: 'camera_unavailable',
          attempt_number: 0,
        });
      },
    });
  }

  private onCaptured(full: HTMLCanvasElement, quality: CaptureQuality, source: CaptureSource): void {
    const nagDue = source === 'manual' && this.autoCaptureOn() && isManualCaptureNagDue();
    if (nagDue) {
      markManualCaptureNagShown();
      this.pendingManualCapture.set({ full, quality });
      return;
    }
    this.commitCapture(full, quality, source);
  }

  private commitCapture(full: HTMLCanvasElement, quality: CaptureQuality, source: CaptureSource): void {
    const type = this.selectedType();
    const side = this.currentSide();
    if (!type || !side) return;

    this.captureFlash.set(true);
    setTimeout(() => this.captureFlash.set(false), 500);

    this.session.setSide({
      side,
      fullCanvas: full,
      fullDataUrl: toDataUrl(full),
      thumbDataUrl: makeThumbnail(full),
      quality,
    });

    this.mixpanel.trackScanCaptureCompleted({
      vendor: 'idscanly',
      document_type: type.id,
      side,
      source,
      quality_verdict: quality.verdict,
      sharp: quality.sharp,
      well_lit: quality.wellLit,
      glare_free: quality.glareFree,
      complete: quality.complete,
    });

    const captures = this.captures();
    const nextIndex = type.sides.findIndex((s) => !captures.has(s));
    if (nextIndex >= 0) {
      this.currentSideIndex.set(nextIndex);
      this.detection.arm(true);
      this.flipPromptHold.set(true);
      setTimeout(() => this.flipPromptHold.set(false), FLIP_PROMPT_MIN_MS);
    } else {
      this.detection.stop();
      // replaceUrl: the scan flow must occupy a single history entry — pushing here
      // (and on every retake) left scan/review pages reachable via the back button
      // long after the scan finished.
      void this.router.navigateByUrl('/idscanly/review', { replaceUrl: true });
    }
  }
}

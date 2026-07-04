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

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

/** Minimum time the "turn your card" prompt + animation stay on screen once a side advances. */
const FLIP_PROMPT_MIN_MS = 3000;

@Component({
  selector: 'app-scan',
  templateUrl: 'scan.page.html',
  styleUrls: ['scan.page.scss'],
  imports: [IonContent],
})
export class ScanPage implements OnDestroy {
  private readonly session = inject(CaptureSessionService);
  private readonly detection = inject(DocumentDetectionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly selectedType = signal<DocumentTypeConfig | null>(null);
  readonly currentSideIndex = signal(0);
  readonly errorMessage = signal<string | null>(null);

  // Detection state drives the bracket colour + page message.
  readonly status = this.detection.status;
  readonly lightingIssue = this.detection.lightingIssue;
  // Raw "has the previous document left frame yet" gate — can clear within ~400ms (debounced for
  // capture safety, not for human readability), so the UI reads `showFlipPrompt` below instead.
  readonly awaitingExit = this.detection.awaitingExit;
  readonly debug = this.detection.debug;
  readonly logs = this.detection.logs;
  readonly torchSupported = this.detection.torchSupported;
  readonly torchOn = this.detection.torchOn;
  private readonly captures = this.session.captures;

  /** Mirrors the bottom bar's "AUTO" toggle; on by default, reset on every fresh entry to Scan. */
  readonly autoCaptureOn = signal(true);

  /** Holds a manual capture awaiting the weekly nag dialog's decision; null = no dialog showing. */
  readonly pendingManualCapture = signal<{ full: HTMLCanvasElement; quality: CaptureQuality } | null>(
    null,
  );

  /** Brief, fixed-duration "got it" flash on successful capture — independent of how fast the
   *  detection loop subsequently advances, so it always gets its full on-screen time. */
  readonly captureFlash = signal(false);

  /** Minimum-display latch for the "turn your card" prompt, set the instant a side advances. */
  private readonly flipPromptHold = signal(false);

  /** "Turn your card" message + animation: visible for at least FLIP_PROMPT_MIN_MS regardless of
   *  how fast `awaitingExit` clears, and held open longer still if it hasn't cleared by then. */
  readonly showFlipPrompt = computed(() => this.awaitingExit() || this.flipPromptHold());

  /** Toggle the on-screen detection debug overlay (PiP + metrics) — off by default. */
  readonly showDebug = signal(false);

  private readonly video =
    viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly debugCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('debugCanvas');
  private readonly guide =
    viewChild<ElementRef<HTMLElement>>('guide');

  readonly currentSide = computed<Side | null>(() => {
    const type = this.selectedType();
    return type ? type.sides[this.currentSideIndex()] : null;
  });

  /** "ID card: 1st Page" for multi-page types; just the label for single-page types. */
  readonly pageTitle = computed(() => {
    const type = this.selectedType();
    if (!type) {
      return '';
    }
    if (type.sides.length <= 1) {
      return type.label;
    }
    return `${type.label}: ${this.ordinal(this.currentSideIndex() + 1)} Page`;
  });

  /** Single-line instruction shown directly under the page title. */
  readonly message = computed(() => {
    if (this.status() === 'bad-light') {
      return this.lightingIssue() === 'glare'
        ? 'Glare detected — tilt the card'
        : 'Too dark — move to better light';
    }
    if (this.showFlipPrompt()) {
      return 'Turn your card';
    }
    const scanningMessage = this.selectedType()?.scanningMessage;
    return scanningMessage ?? `Scanning the ${this.ordinal(this.currentSideIndex() + 1)} page`;
  });

  readonly bracketActive = computed(
    () => this.status() === 'aligned' || this.status() === 'captured',
  );

  /** Aligned-but-poorly-lit: brackets go amber (distinct from neutral "no document" and green "ready"). */
  readonly bracketWarn = computed(() => this.status() === 'bad-light');

  /** Camera + OpenCV/jscanify are still starting up — `status` stays 'idle' until `arm()` first runs. */
  readonly showLoader = computed(
    () => this.selectedType() !== null && this.status() === 'idle' && !this.errorMessage(),
  );

  // Ionic lifecycle hook — fires when this page becomes the active route. Type selection now
  // happens on the Home page, so this is where the reader actually starts for side 0.
  ionViewWillEnter(): void {
    const type = this.session.documentType();
    if (!type) {
      void this.router.navigateByUrl('/capture/home');
      return;
    }
    this.errorMessage.set(null);
    this.selectedType.set(type);
    this.autoCaptureOn.set(true);
    // Resume on the first side that still needs capturing — so a single-side "Retake" from Review
    // (which clears just that side) lands directly on it instead of always restarting at the front.
    const firstMissing = type.sides.findIndex((s) => !this.session.getSide(s));
    this.currentSideIndex.set(firstMissing >= 0 ? firstMissing : 0);
    this.startDetection();
  }

  goBack(): void {
    this.detection.stop();
    this.location.back();
  }

  toggleDebug(): void {
    this.showDebug.update((v) => !v);
  }

  /** Bottom-bar manual capture — fires regardless of alignment/dwell/auto-capture state. */
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

  /** "Use taken photo" — commit the manual capture exactly as if no nag had appeared. */
  useTakenPhoto(): void {
    const pending = this.pendingManualCapture();
    if (!pending) {
      return;
    }
    this.pendingManualCapture.set(null);
    this.commitCapture(pending.full, pending.quality);
  }

  /** "Retake with auto capture" — discard the manual shot and resume detection on the same side. */
  retakeWithAutoCapture(): void {
    this.pendingManualCapture.set(null);
    this.detection.arm();
  }

  ngOnDestroy(): void {
    this.detection.stop();
  }

  // Ionic lifecycle hook — fires when navigating away via the router outlet.
  ionViewWillLeave(): void {
    this.detection.stop();
  }

  private ordinal(n: number): string {
    return ORDINALS[n - 1] ?? `${n}th`;
  }

  private startDetection(): void {
    const type = this.selectedType();
    const videoEl = this.video()?.nativeElement;
    if (!type || !videoEl) {
      return;
    }
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
      onError: (error) =>
        this.errorMessage.set(
          typeof error === 'string'
            ? error
            : 'Camera unavailable — check permissions and reload.',
        ),
    });
  }

  /** Routes a finished capture either straight to commit, or — for an early manual tap while
   *  auto-capture is still on — to the weekly nag dialog first. */
  private onCaptured(full: HTMLCanvasElement, quality: CaptureQuality, source: CaptureSource): void {
    const nagDue = source === 'manual' && this.autoCaptureOn() && isManualCaptureNagDue();
    if (nagDue) {
      markManualCaptureNagShown();
      this.pendingManualCapture.set({ full, quality });
      return;
    }
    this.commitCapture(full, quality);
  }

  private commitCapture(full: HTMLCanvasElement, quality: CaptureQuality): void {
    const type = this.selectedType();
    const side = this.currentSide();
    if (!type || !side) {
      return;
    }

    // Fixed-duration flash, deliberately decoupled from `status` — the detection service can (and
    // does) move status on to 'searching'/'aligned' again within this same call stack.
    this.captureFlash.set(true);
    setTimeout(() => this.captureFlash.set(false), 500);

    this.session.setSide({
      side,
      fullCanvas: full,
      fullDataUrl: toDataUrl(full),
      thumbDataUrl: makeThumbnail(full),
      quality,
    });

    // Advance to the next side that still needs capturing (gracefully handles retakes).
    const captures = this.captures();
    const nextIndex = type.sides.findIndex((s) => !captures.has(s));
    if (nextIndex >= 0) {
      this.currentSideIndex.set(nextIndex);
      // Require the just-captured side to leave frame before the next side can auto-capture — otherwise
      // a slow flip re-aligns on the same document and captures it again as the next side.
      this.detection.arm(true);
      this.flipPromptHold.set(true);
      setTimeout(() => this.flipPromptHold.set(false), FLIP_PROMPT_MIN_MS);
    } else {
      this.detection.stop();
      void this.router.navigateByUrl('/capture/review');
    }
  }
}

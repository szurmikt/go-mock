import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { CaptureQuality } from '../../models/capture-quality';
import {
  CaptureBucket,
  DocumentTypeConfig,
  DocumentTypeId,
  Side,
  isCardBucketAllowed,
  isPassportBucketAllowed,
  resolveScanEntryType,
} from '../../models/document-type';
import { CaptureSessionService } from '../../services/capture-session.service';
import { CaptureSource, DocumentDetectionService } from '../../services/document-detection.service';
import { CARD_TUNING_PROFILES, DETECTION_TUNING } from '../../capture-tuning';
import { makeThumbnail, toDataUrl } from '../../utils/canvas.util';
import { isManualCaptureNagDue, markManualCaptureNagShown } from '../../utils/manual-capture-nag.util';
import { LanguageService } from '../../../services/language.service';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { AuthService } from '../../../services/auth';
import { MixpanelService } from '../../../services/mixpanel';
import { PropertyConfigService } from '../../../services/property-config.service';
import { CapturePreferenceService } from '../../services/capture-preference.service';
import { ScanOnboardingService } from '../../services/scan-onboarding.service';
import { IDSCANLY_DEBUG_PROPERTY_ID } from '../../idscanly-debug.const';

const ORDINAL_KEYS = ['idscanly.ordinal1', 'idscanly.ordinal2', 'idscanly.ordinal3', 'idscanly.ordinal4'];
const FLIP_PROMPT_MIN_MS = 3000;

@Component({
  selector: 'app-idscanly-scan',
  templateUrl: 'scan.page.html',
  styleUrls: ['scan.page.scss'],
  imports: [IonContent, TranslatePipe, NgTemplateOutlet],
})
export class IdscanScanPage implements OnDestroy {
  private readonly session = inject(CaptureSessionService);
  private readonly detection = inject(DocumentDetectionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly lang = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly mixpanel = inject(MixpanelService);
  private readonly propertyConfig = inject(PropertyConfigService);
  private readonly capturePreference = inject(CapturePreferenceService);
  private readonly scanOnboarding = inject(ScanOnboardingService);

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

  readonly huntActive = this.detection.huntActive;

  /** Once any side is captured, tapping the toggle opens a confirm dialog instead of switching
   *  immediately — switching restarts the scan and would silently discard what's captured. */
  readonly bucketSwitchEnabled = computed(() => this.captures().size === 0);
  readonly bucketChangeConfirmOpen = signal(false);
  private pendingBucket: CaptureBucket | null = null;

  readonly bucket = computed<CaptureBucket>(() => {
    const type = this.selectedType();
    return type?.id === 'passport' ? 'passport' : 'card';
  });

  readonly bucketLabel = computed(() =>
    this.lang.t(this.bucket() === 'passport' ? 'idscanly.bucketPassport' : 'idscanly.bucketCard'),
  );

  /** Only offer the toggle when the property's scan_doc_types restriction actually allows both
   *  buckets — otherwise there is nothing to switch to. */
  readonly showBucketToggle = computed(() => {
    const allowed = this.propertyConfig.scanDocTypes() as DocumentTypeId[];
    return isCardBucketAllowed(allowed) && isPassportBucketAllowed(allowed);
  });

  /** First-run walkthrough steps, in the order they're shown. 'none' = hidden. See
   *  onboardingApplicableSteps() for which of these a given property actually needs. */
  readonly onboardingStep = signal<'none' | 'docForm' | 'autoCapture' | 'skip'>('none');
  /** Steps relevant to this property's scan_doc_types restriction, in display order. Recomputed
   *  each time (not cached at boot) since scan_doc_types can only be known once the property
   *  config has loaded, same as showBucketToggle above. 'autoCapture' always applies — the
   *  toggle is unconditional, unlike the doc-form toggle and the card-only Skip button. */
  private onboardingApplicableSteps(): Array<'docForm' | 'autoCapture' | 'skip'> {
    const steps: Array<'docForm' | 'autoCapture' | 'skip'> = [];
    if (this.showBucketToggle()) steps.push('docForm');
    steps.push('autoCapture');
    const allowed = this.propertyConfig.scanDocTypes() as DocumentTypeId[];
    if (isCardBucketAllowed(allowed)) steps.push('skip');
    return steps;
  }

  readonly autoCaptureOn = signal(true);
  /** `reason` distinguishes the weekly-throttled UX nag from the unthrottled, always-on lighting
   *  gate — see onCaptured(). */
  readonly pendingManualCapture = signal<{
    full: HTMLCanvasElement;
    quality: CaptureQuality;
    reason: 'nag' | 'lighting';
  } | null>(null);
  readonly nagDialogMessageKey = computed(() =>
    this.pendingManualCapture()?.reason === 'lighting'
      ? 'idscanly.lightingNagMessage'
      : 'idscanly.nagMessage',
  );
  readonly nagDialogRetakeKey = computed(() =>
    this.pendingManualCapture()?.reason === 'lighting'
      ? 'idscanly.lightingNagRetake'
      : 'idscanly.nagRetake',
  );
  readonly captureFlash = signal(false);
  private readonly flipPromptHold = signal(false);

  readonly showFlipPrompt = computed(() => this.awaitingExit() || this.flipPromptHold());
  readonly showDebug = signal(false);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly debugCanvas = viewChild<ElementRef<HTMLCanvasElement>>('debugCanvas');
  private readonly guide = viewChild<ElementRef<HTMLElement>>('guide');
  private readonly bucketToggleAnchor = viewChild<ElementRef<HTMLElement>>('bucketToggleAnchor');
  private readonly autoCaptureAnchor = viewChild<ElementRef<HTMLElement>>('autoCaptureAnchor');
  private readonly skipOnboardingAnchor = viewChild<ElementRef<HTMLElement>>('skipOnboardingAnchor');

  /** Real on-screen position of the current onboarding step's target (the Document form track,
   *  the auto-capture toggle, or the ghost Skip button), measured via getBoundingClientRect()
   *  rather than guessed at from the static layout — so the callout lands right next to it
   *  regardless of screen size. Horizontal position matters here, not just vertical: the
   *  auto-capture toggle is one of a *centered* pair of buttons, not flush against a screen
   *  edge, so a fixed per-step left/right offset (an earlier version of this) pointed at the
   *  wrong place — see onboardingCardLeft(). null until the target has actually rendered and
   *  been measured. */
  readonly onboardingAnchorRect = signal<{ top: number; left: number; width: number; height: number } | null>(
    null,
  );
  readonly onboardingViewportWidth = signal(window.innerWidth);
  readonly onboardingViewportHeight = signal(window.innerHeight);

  /** Bottom-step callout card width — see onboardingCardLeft(). */
  private static readonly ONBOARDING_CARD_WIDTH = 240;

  /** Where to place a bottom-anchored callout card so it's horizontally centered on the real
   *  anchor (the toggle/button it's explaining), clamped so it never runs off either edge of
   *  the viewport. When the anchor sits close enough to an edge that the clamp actually kicks in
   *  (e.g. the Skip button, near the right edge), the card can no longer fully follow it — see
   *  onboardingArrowLeft() for how the arrow stays correct anyway. */
  onboardingCardLeft(anchor: { left: number; width: number }): number {
    const vw = this.onboardingViewportWidth();
    const width = IdscanScanPage.ONBOARDING_CARD_WIDTH;
    const center = anchor.left + anchor.width / 2;
    return Math.min(Math.max(16, center - width / 2), vw - 16 - width);
  }

  /** Horizontal position of the arrow *within* the card (not the viewport) — px from the card's
   *  own left edge. Deliberately NOT always centered: when onboardingCardLeft()'s clamp prevents
   *  the card from fully following the anchor to an edge (the Skip button case — a 240px card
   *  centered on a button 56px from the right edge would run off-screen), the card stops moving
   *  but the arrow keeps tracking the anchor's true center, sliding toward whichever edge of the
   *  card is closest to it. Clamped within the card's own bounds (24px margin) so it never pokes
   *  out past the rounded corners. */
  onboardingArrowLeft(anchor: { left: number; width: number }): string {
    const cardWidth = IdscanScanPage.ONBOARDING_CARD_WIDTH;
    const cardLeft = this.onboardingCardLeft(anchor);
    const trueCenter = anchor.left + anchor.width / 2;
    const margin = 24;
    const x = Math.min(Math.max(trueCenter - cardLeft, margin), cardWidth - margin);
    return `${x}px`;
  }

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
    // Card always captures via the id-card config now, so type.label would always literally
    // read 'idscanly.docTypeIdCard' — confidently mislabeling every driving-licence/address-card
    // scan as "ID card". bucketLabel is the generic, never-wrong alternative.
    const label = this.bucketLabel();
    if (type.sides.length <= 1) return label;
    return this.lang.t('idscanly.pageTitleMultiPage', {
      type: label,
      ordinal: this.ordinal(this.currentSideIndex() + 1),
    });
  });

  readonly flipCardLabel = computed(() => {
    const type = this.selectedType();
    return type ? this.lang.t('idscanly.flipCard', { type: this.bucketLabel() }) : '';
  });

  readonly message = computed(() => {
    if (this.status() === 'bad-light') {
      return this.lightingIssue() === 'glare'
        ? this.lang.t('idscanly.glareDetected')
        : this.lang.t('idscanly.tooDark');
    }
    if (this.showFlipPrompt()) return this.lang.t('idscanly.turnCard');
    // Lowest priority — real actionable states (bad-light, the flip-prompt) still win. Reuses
    // the same .scan-message element so there's a visible "still working" signal during the
    // adaptive tuning hunt rather than a frozen-looking guide box.
    if (this.huntActive() && this.status() === 'searching') {
      return this.lang.t('idscanly.stillSearching');
    }
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
    // The camera must not run while the walkthrough is up — auto-capture firing mid-tour was
    // silently advancing currentSideIndex (front → back), which desyncs the tour's Skip step
    // from reality: the real Skip button replaces the ghost one it was pointing at, that ghost's
    // anchor ref disappears, and the callout for that step renders nothing at all — leaving just
    // the dark scrim on screen with no visible way to dismiss it. Deferring the camera start
    // until the tour actually finishes removes the whole failure class at the source; the
    // onboarding-close button below is the belt-and-suspenders backstop for any other case.
    if (!this.maybeShowOnboarding()) {
      this.beginDetection();
    }
  }

  /** Guards against starting the camera twice — ionViewWillEnter defers this call until the
   *  walkthrough closes (see above), and closeOnboarding() is the other caller. */
  private detectionStarted = false;

  private beginDetection(): void {
    if (this.detectionStarted) return;
    this.detectionStarted = true;
    this.startDetection();
  }

  /** Steps this run of the walkthrough will actually show, in order — fixed once at trigger
   *  time so nextOnboardingStep()/onboardingIsLastStep() don't re-derive it mid-tour. */
  private onboardingSteps: Array<'docForm' | 'autoCapture' | 'skip'> = [];

  /** Returns true when the tour was actually started — ionViewWillEnter uses this to decide
   *  whether to defer the camera start (see beginDetection()). */
  private maybeShowOnboarding(): boolean {
    if (this.scanOnboarding.seen()) return false;
    const steps = this.onboardingApplicableSteps();
    if (!steps.length) {
      // Defensive — 'autoCapture' is unconditional so this can't currently happen, but keeps
      // the method correct if a future step becomes conditional too.
      void this.scanOnboarding.markSeen();
      return false;
    }
    this.onboardingSteps = steps;
    this.onboardingStep.set(steps[0]);
    this.scheduleOnboardingAnchorMeasure();
    return true;
  }

  onboardingIsLastStep(): boolean {
    const idx = this.onboardingSteps.indexOf(this.onboardingStep() as 'docForm' | 'autoCapture' | 'skip');
    return idx === this.onboardingSteps.length - 1;
  }

  nextOnboardingStep(): void {
    const idx = this.onboardingSteps.indexOf(this.onboardingStep() as 'docForm' | 'autoCapture' | 'skip');
    const next = this.onboardingSteps[idx + 1];
    if (next) {
      this.onboardingStep.set(next);
      this.scheduleOnboardingAnchorMeasure();
    } else {
      this.closeOnboarding();
    }
  }

  closeOnboarding(): void {
    this.onboardingStep.set('none');
    this.onboardingAnchorRect.set(null);
    void this.scanOnboarding.markSeen();
    // The camera was deliberately held off while the tour was up (see ionViewWillEnter) —
    // start it now, however the tour ended (walked through, or closed early via the X).
    this.beginDetection();
  }

  /** Defers the measurement to the next tick — the step's target element (the ghost Skip
   *  button in particular) is only rendered once Angular flushes the DOM update for the
   *  onboardingStep signal write above, so reading getBoundingClientRect() synchronously here
   *  would still see the previous step's layout (or nothing at all, on the very first step). */
  private scheduleOnboardingAnchorMeasure(): void {
    this.onboardingAnchorRect.set(null);
    setTimeout(() => this.measureOnboardingAnchor(), 0);
  }

  private measureOnboardingAnchor(): void {
    const step = this.onboardingStep();
    const el =
      step === 'docForm'
        ? this.bucketToggleAnchor()?.nativeElement
        : step === 'autoCapture'
          ? this.autoCaptureAnchor()?.nativeElement
          : step === 'skip'
            ? this.skipOnboardingAnchor()?.nativeElement
            : undefined;
    if (!el) {
      this.onboardingAnchorRect.set(null);
      return;
    }
    this.onboardingViewportWidth.set(window.innerWidth);
    this.onboardingViewportHeight.set(window.innerHeight);
    const rect = el.getBoundingClientRect();
    this.onboardingAnchorRect.set({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }

  /** Tapping the toggle: switches immediately if nothing is captured yet, otherwise opens the
   *  discard-confirm dialog first (see bucketSwitchEnabled). */
  onBucketTap(bucket: CaptureBucket): void {
    if (bucket === this.bucket()) return;
    if (this.bucketSwitchEnabled()) {
      this.selectBucket(bucket);
    } else {
      this.pendingBucket = bucket;
      this.bucketChangeConfirmOpen.set(true);
    }
  }

  confirmBucketChange(): void {
    this.bucketChangeConfirmOpen.set(false);
    const bucket = this.pendingBucket;
    this.pendingBucket = null;
    if (bucket) this.selectBucket(bucket);
  }

  cancelBucketChange(): void {
    this.bucketChangeConfirmOpen.set(false);
    this.pendingBucket = null;
  }

  /** Resolves the bucket to a concrete type, persists the preference, restarts the capture
   *  session for the new type, and retargets detection without restarting the camera. */
  private selectBucket(bucket: CaptureBucket): void {
    const allowed = this.propertyConfig.scanDocTypes() as DocumentTypeId[];
    const type = resolveScanEntryType(bucket, allowed);
    void this.capturePreference.setBucket(bucket);
    this.selectedType.set(type);
    this.session.start(type);
    this.currentSideIndex.set(0);
    this.detection.retarget({
      targetRatio: type.guideRatio,
      extractWidth: type.extractWidth,
      extractHeight: type.extractHeight,
      tuning: { ...DETECTION_TUNING, ...(type.tuning ?? {}) },
      captureMode: type.captureMode,
      tuningProfiles: type.id === 'passport' ? undefined : CARD_TUNING_PROFILES,
    });
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
    const next = !this.torchOn();
    await this.detection.setTorch(next);
    if (next) this.session.markFlashUsed();
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
    this.detectionStarted = false;
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
      tuningProfiles: type.id === 'passport' ? undefined : CARD_TUNING_PROFILES,
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
    // Independent, unthrottled: a lighting problem is a live actionable fact and shouldn't be
    // throttled the way the infrequent UX nag below is. Restricting this to 'manual' is not a
    // narrowing — a badly-lit auto-capture cannot exist in the first place (tick() already
    // blocks capture('auto') while lighting fails).
    const lightingIssue = source === 'manual' && (!quality.wellLit || !quality.glareFree);
    const nagDue = source === 'manual' && this.autoCaptureOn() && isManualCaptureNagDue();
    if (lightingIssue || nagDue) {
      if (nagDue) markManualCaptureNagShown();
      this.pendingManualCapture.set({ full, quality, reason: lightingIssue ? 'lighting' : 'nag' });
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
      source,
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

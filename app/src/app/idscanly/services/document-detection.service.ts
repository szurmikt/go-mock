import { Injectable, NgZone, signal } from '@angular/core';
import * as Sentry from '@sentry/angular';
import type { CornerPoints } from 'jscanify/client';
import { DETECTION_TUNING, DetectionTuning, TuningProfile } from '../capture-tuning';
import { CaptureQuality } from '../models/capture-quality';
import { OpenCvLoaderService } from './opencv-loader.service';
import { LanguageService } from '../../services/language.service';

export type DetectionStatus = 'idle' | 'searching' | 'aligned' | 'bad-light' | 'captured';

/** Which lighting check failed, for the matching on-screen instruction swap. */
export type LightingIssue = 'dark' | 'glare';

/** Whether a capture was auto-fired by the dwell timer or triggered by the manual shutter. */
export type CaptureSource = 'auto' | 'manual';

/** Result of the pre-crop completeness analysis — see `analyzeCompletenessOnFrame`. */
interface CompletenessResult {
  complete: boolean;
  cornersFound: boolean;
  coverageFraction: number;
  ratio: number;
  reason: 'not-found' | 'clipped' | 'geometry' | null;
}

export interface DetectionStartOptions {
  video: HTMLVideoElement;
  /** Expected document aspect ratio (width / height) for the active type. */
  targetRatio: number;
  extractWidth: number;
  extractHeight: number;
  /** Effective detection profile (DETECTION_TUNING merged with any per-type override). */
  tuning: DetectionTuning;
  /**
   * How to produce the captured image: 'warp' perspective-flattens the detected quad (cards);
   * 'frame' crops the full frame to the guide box (passport booklet). See `capture()`.
   */
  captureMode: 'warp' | 'frame';
  /**
   * Lazy accessor for the guide-box element — used in 'frame' mode to crop the capture to what the
   * guide rectangle shows. Resolved at capture time (not at start), since the guide is rendered behind
   * the type-selected `@if` and isn't in the DOM yet during the synchronous start() call.
   */
  getGuideEl?: () => HTMLElement | null | undefined;
  /**
   * Invoked (inside Angular zone) with the full-resolution flattened capture and its quality verdict.
   * The quality is computed in `capture()` for BOTH the auto and manual paths (they converge there),
   * so the manual shutter — which bypasses every live gate — can never store an unvalidated image.
   */
  onCapture: (full: HTMLCanvasElement, quality: CaptureQuality, source: CaptureSource) => void;
  /** Invoked (inside Angular zone) if the camera/OpenCV can't start. */
  onError?: (error: unknown) => void;
  /** Optional canvas — when supplied, each tick draws the analysis frame + detected quad into it. */
  debugCanvas?: HTMLCanvasElement;
  /**
   * Open-ended rotation list for the adaptive tuning-profile hunt (Card bucket only — see
   * CARD_TUNING_PROFILES). Omitted, or a single-entry list, disables rotation entirely (used for
   * the passport type, whose difficulty is booklet geometry/hand-jitter, not border contrast).
   */
  tuningProfiles?: TuningProfile[];
}

/** Live per-frame detection diagnostics (for tuning / on-screen debug readout). */
export interface DetectionDebug {
  found: boolean;
  ratio: number;
  areaFraction: number;
  ratioOk: boolean;
  areaOk: boolean;
  centreOk: boolean;
  stable: boolean;
  aligned: boolean;
  /** Mean grayscale luminance (0–255) of the frame — only computed once geometry is aligned. */
  meanLuminance?: number;
  /** Fraction of clipped (near-white) pixels — only computed once geometry is aligned. */
  clippedFraction?: number;
  /** True while waiting for the previously-captured document to leave frame (see `arm(requireExit)`). */
  awaitingExit?: boolean;
  error?: string;
}

/**
 * Owns the live camera feed + throttled jscanify detection loop + stability/dwell auto-capture.
 *
 * State machine surfaced via `status`:
 *   searching (gray brackets) -> aligned (green brackets) -> [held for dwellMs] -> captured.
 *
 * The loop runs outside the Angular zone (it ticks several times a second); only status changes
 * and the capture callback re-enter the zone so the UI updates without thrashing change detection.
 */
@Injectable({ providedIn: 'root' })
export class DocumentDetectionService {
  readonly status = signal<DetectionStatus>('idle');
  /** Which lighting check failed while a document is otherwise aligned (drives the instruction swap). */
  readonly lightingIssue = signal<LightingIssue | null>(null);
  readonly debug = signal<DetectionDebug | null>(null);
  /** Persistent append-only event log for on-device debugging. */
  readonly logs = signal<string[]>([]);
  private loggedFirstTick = false;
  /** Throttles the periodic metrics log line (see tick()) to ~1/sec — real per-tick metrics
   *  otherwise never surface anywhere readable (the on-screen badges are 9px and unreadable in
   *  a phone screenshot); temporary diagnostic aid for tuning capture-tuning.ts against real
   *  footage, same spirit as the existing tick#1 gate log. */
  private lastMetricsLogAt = 0;

  private stream?: MediaStream;
  private timer?: ReturnType<typeof setInterval>;
  private readonly analysis = document.createElement('canvas');
  private scanner?: import('jscanify/client').default;
  private opts?: DetectionStartOptions;
  /** Effective detection profile for the active type; read throughout the loop. */
  private tuning: DetectionTuning = DETECTION_TUNING;

  private armed = false;
  private prevCorners: CornerPoints | null = null;
  private alignedSince = 0;
  /** When false, the dwell-elapsed branch in `tick()` never fires `capture('auto')` — the manual
   *  shutter (which doesn't consult this) becomes the only way to capture. Reset to `true` on every
   *  fresh `start()`/`stop()`. */
  private autoCaptureEnabled = true;
  readonly torchSupported = signal(false);
  readonly torchOn = signal(false);
  /**
   * True while the just-armed side must not be the same document still sitting in frame from the
   * previous capture ("turn your card") — public so the page can show dedicated feedback for this
   * exact window, independent of the geometry-driven `status` (which doesn't reliably reflect it;
   * see the two call sites below).
   */
  readonly awaitingExit = signal(false);
  private notAlignedStreak = 0;

  /**
   * Adaptive tuning-profile hunt (Card bucket only) — see capture-tuning.ts CARD_TUNING_PROFILES.
   * `activeProfileIndex` always starts at 0 (the known-good default) on every `start()`/
   * `retarget()` — i.e. every NEW scan session (a fresh document, or a Card↔Passport bucket
   * switch) begins at default, never at whatever a PREVIOUS, unrelated scan happened to rotate
   * to. It is NOT reset by `arm()`, so a profile the hunt rotates to for one side of a document
   * carries forward to that document's other sides (front→back, retakes) without re-hunting.
   *
   * An earlier version instead remembered the last-winning profile indefinitely (reset only on
   * app restart) so it could resume across entirely separate scans too. That was found, via real-
   * device testing, to be actively harmful: a single noisy rotation — e.g. ~1.6s with no candidate
   * contour while the user was still positioning the card, which is completely normal and not
   * evidence the card needs a different profile — could permanently pin every LATER scan in the
   * app session onto the driving-licence-contrast profile if it ever fluke-aligned even once,
   * silently breaking auto-capture for a perfectly normal ID card with no recovery short of an
   * app restart. Resetting per scan session trades a small amount of re-hunting efficiency across
   * guests for never getting stuck.
   */
  private tuningProfiles: TuningProfile[] = [];
  private activeProfileIndex = 0;
  private noCandidateStreak = 0;
  /** True while the hunt is actively rotating profiles — surfaced on the Scan page's message. */
  readonly huntActive = signal(false);

  constructor(
    private readonly cvLoader: OpenCvLoaderService,
    private readonly zone: NgZone,
    private readonly lang: LanguageService,
  ) {
    // Surface otherwise-silent async failures to the on-screen log during debugging.
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (e) =>
        this.pushLog(`UNHANDLED REJECTION: ${(e.reason as Error)?.message ?? e.reason}`),
      );
      window.addEventListener('error', (e) =>
        this.pushLog(`WINDOW ERROR: ${e.message ?? e}`),
      );
    }
  }

  async start(opts: DetectionStartOptions): Promise<void> {
    this.opts = opts;
    this.tuningProfiles = opts.tuningProfiles ?? [];
    // A new scan session always starts at the known-good default profile (index 0) — see
    // tuningProfiles' declaration for why this matters.
    this.activeProfileIndex = 0;
    // Set before requestCamera() — it reads cameraIdeal* from the active profile. Neither
    // PASSPORT_TUNING nor DRIVING_LICENCE_TUNING override cameraIdealWidth/Height or
    // loopIntervalMs, so an active tuning-profile override never affects the camera request.
    this.tuning = this.effectiveTuning(opts.tuning);
    this.loggedFirstTick = false;
    this.autoCaptureEnabled = true;
    this.pushLog('start: requesting camera');

    // IMPORTANT: request the camera FIRST, before any other await. iOS Safari only grants
    // getUserMedia when it is called within the user-gesture (the type-chip tap); awaiting a slow
    // resource (OpenCV.js, ~8 MB) beforehand loses that gesture context and the prompt is denied.
    try {
      this.stream = await this.requestCamera();
    } catch (error) {
      const description = this.describeError(error, 'camera');
      this.pushLog(`camera FAILED: ${description}`);
      // No prior Sentry visibility into IDScanly camera-start failures — this is exactly
      // the class of issue the WKWebView/getUserMedia reliability risk would surface as.
      Sentry.captureException(error, {
        tags: {
          context: 'idscanly_camera_start',
          error_name: (error as { name?: string })?.name ?? 'unknown',
        },
      });
      this.zone.run(() => opts.onError?.(description));
      return;
    }
    const track = this.stream.getVideoTracks()[0];
    const settings = track?.getSettings();
    this.pushLog(`camera ok ${settings?.width ?? '?'}x${settings?.height ?? '?'}`);
    const capabilities = track?.getCapabilities?.();
    this.zone.run(() => this.torchSupported.set(!!(capabilities as { torch?: boolean })?.torch));

    opts.video.srcObject = this.stream;
    opts.video.setAttribute('playsinline', 'true');
    opts.video.muted = true;
    try {
      await opts.video.play();
    } catch {
      // Autoplay can reject before a user gesture on some browsers; the loop tolerates this.
    }

    // Now load OpenCV.js + jscanify (the camera preview is already live at this point).
    this.pushLog('calling getScanner');
    try {
      this.scanner = await this.cvLoader.getScanner((step) => this.pushLog(`cv: ${step}`));
    } catch (error) {
      const description = this.describeError(error, 'opencv');
      this.pushLog(`OpenCV FAILED: ${description}`);
      Sentry.captureException(error, {
        tags: {
          context: 'idscanly_opencv_load',
          error_name: (error as { name?: string })?.name ?? 'unknown',
        },
      });
      this.zone.run(() => opts.onError?.(description));
      return;
    }
    this.pushLog(`getScanner returned (type=${typeof this.scanner})`);

    this.arm();
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => this.tick(), this.tuning.loopIntervalMs);
    });
    this.pushLog('loop started');
  }

  private pushLog(message: string): void {
    this.zone.run(() => this.logs.update((entries) => [...entries.slice(-11), message]));
    // eslint-disable-next-line no-console
    console.log(`[capture] ${message}`); // visible in Safari Web Inspector when debugging on-device
  }

  private setDebugMessage(message: string): void {
    this.zone.run(() =>
      this.debug.set({
        found: false,
        ratio: 0,
        areaFraction: 0,
        ratioOk: false,
        areaOk: false,
        centreOk: false,
        stable: false,
        aligned: false,
        error: message,
      }),
    );
  }

  /** Try the rear camera; if the device can't satisfy that constraint, retry with any camera. */
  private async requestCamera(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(this.lang.t('idscanly.errNoGetUserMedia'));
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          // `ideal` (NOT `min`): asks for a sharper source frame but lets Safari fall back to the
          // closest mode it can actually focus, so it won't break autofocus the way a hard `min` did.
          width: { ideal: this.tuning.cameraIdealWidth },
          height: { ideal: this.tuning.cameraIdealHeight },
        },
        audio: false,
      });
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'OverconstrainedError' || name === 'NotFoundError') {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      throw error;
    }
  }

  /** Turns an opaque error into a user-facing, debuggable message. */
  private describeError(error: unknown, phase: 'camera' | 'opencv'): string {
    const name = (error as { name?: string })?.name ?? '';
    const message = (error as { message?: string })?.message ?? String(error);
    if (phase === 'opencv') {
      return `${this.lang.t('idscanly.errOpenCvLoad')} ${message}`;
    }
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return this.lang.t('idscanly.errCameraPermission');
      case 'NotFoundError':
        return this.lang.t('idscanly.errNoCamera');
      case 'NotReadableError':
        return this.lang.t('idscanly.errCameraInUse');
      default:
        return `${this.lang.t('idscanly.errCameraGeneric')}${name ? ` (${name})` : ''}: ${message}`;
    }
  }

  /**
   * Re-arm detection for the next side (or after a retake) without restarting the camera.
   *
   * @param requireExit When true (passed when advancing to the next side after a capture), the
   *   document just captured must be observed absent for `exitConfirmTicks` consecutive ticks before
   *   alignment can lead to a new capture — otherwise a slow flip (the card still sitting in the same
   *   spot) re-aligns within one tick and gets auto-captured again as the next side.
   */
  arm(requireExit = false): void {
    this.armed = true;
    this.prevCorners = null;
    this.alignedSince = 0;
    this.setAwaitingExit(requireExit);
    this.notAlignedStreak = 0;
    this.setLightingIssue(null);
    // Resets the hunt streak/indicator but NOT activeProfileIndex — continuity across sides of
    // the same document (front→back) keeps whichever profile most recently worked rather than
    // restarting the hunt every side.
    this.noCandidateStreak = 0;
    this.setHuntActive(false);
    this.setStatus('searching');
  }

  /**
   * Re-arm detection for a different document type WITHOUT restarting the camera — the Card/
   * Passport toggle's switch path. Neither PASSPORT_TUNING nor DRIVING_LICENCE_TUNING override
   * cameraIdealWidth/Height (baked into the stream once, at start()'s requestCamera()) or
   * loopIntervalMs (baked into the running interval, also start()-only) — every other
   * tuning/geometry field is read fresh per tick, so switching types never needs a new
   * getUserMedia call.
   */
  retarget(opts: {
    targetRatio: number;
    extractWidth: number;
    extractHeight: number;
    tuning: DetectionTuning;
    captureMode: 'warp' | 'frame';
    tuningProfiles?: TuningProfile[];
  }): void {
    if (!this.opts) {
      return;
    }
    this.opts = {
      ...this.opts,
      targetRatio: opts.targetRatio,
      extractWidth: opts.extractWidth,
      extractHeight: opts.extractHeight,
      tuning: opts.tuning,
      captureMode: opts.captureMode,
      tuningProfiles: opts.tuningProfiles,
    };
    this.tuningProfiles = opts.tuningProfiles ?? [];
    // Same reasoning as start() — a bucket switch is a fresh detection cycle for a new type/
    // geometry, not a continuation, so it starts at the default profile too.
    this.activeProfileIndex = 0;
    this.tuning = this.effectiveTuning(opts.tuning);
    this.arm();
  }

  /** Merges the active tuning profile's overrides over `base` — always from the pristine base
   *  (never from `this.tuning`), so rotating AWAY from a profile correctly resets the fields it
   *  had overridden back to base rather than compounding across rotations. */
  private effectiveTuning(base: DetectionTuning): DetectionTuning {
    if (this.tuningProfiles.length <= 1) {
      return base;
    }
    return { ...base, ...this.tuningProfiles[this.activeProfileIndex].tuning };
  }

  private setHuntActive(value: boolean): void {
    if (this.huntActive() === value) {
      return;
    }
    this.zone.run(() => this.huntActive.set(value));
  }

  /** Ticks required for one profile's "did it work" window: enough time to let a newly-rotated
   *  profile's card settle into frame (tuningHuntSettlingMs) plus the normal dwell window,
   *  converted to a tick count via the loop's own real cadence. */
  private profileWindowTicks(): number {
    const windowMs = this.tuning.tuningHuntSettlingMs + this.tuning.dwellMs;
    return Math.max(1, Math.round(windowMs / this.tuning.loopIntervalMs));
  }

  /** Rotates to the next profile in the list, re-merged from the pristine base tuning. */
  private rotateTuningProfile(): void {
    if (!this.opts || this.tuningProfiles.length <= 1) {
      return;
    }
    this.activeProfileIndex = (this.activeProfileIndex + 1) % this.tuningProfiles.length;
    this.tuning = this.effectiveTuning(this.opts.tuning);
    this.setHuntActive(true);
    this.pushLog(`tuning hunt: rotated to '${this.tuningProfiles[this.activeProfileIndex].id}'`);
  }

  /** Fully tear down: stop the loop and release the camera. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.armed = false;
    this.prevCorners = null;
    this.alignedSince = 0;
    this.setAwaitingExit(false);
    this.notAlignedStreak = 0;
    this.autoCaptureEnabled = true;
    this.tuningProfiles = [];
    this.activeProfileIndex = 0;
    this.noCandidateStreak = 0;
    this.setHuntActive(false);
    if (this.opts) {
      this.opts.video.srcObject = null;
    }
    this.opts = undefined;
    this.setLightingIssue(null);
    this.setStatus('idle');
    this.zone.run(() => {
      this.torchSupported.set(false);
      this.torchOn.set(false);
    });
  }

  /** Enable/disable dwell-based auto-capture; the manual shutter (`captureManual()`) is unaffected. */
  setAutoCapture(enabled: boolean): void {
    this.autoCaptureEnabled = enabled;
  }

  /** Best-effort torch toggle on the live camera track. No-ops (and logs) if unsupported or rejected. */
  async setTorch(on: boolean): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) {
      return;
    }
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as any] });
      this.zone.run(() => this.torchOn.set(on));
    } catch (error) {
      this.pushLog(`torch FAILED: ${this.describeError(error, 'camera')}`);
    }
  }

  private setStatus(status: DetectionStatus): void {
    if (this.status() === status) {
      return;
    }
    this.zone.run(() => this.status.set(status));
  }

  private setLightingIssue(issue: LightingIssue | null): void {
    if (this.lightingIssue() === issue) {
      return;
    }
    this.zone.run(() => this.lightingIssue.set(issue));
  }

  private setAwaitingExit(value: boolean): void {
    if (this.awaitingExit() === value) {
      return;
    }
    this.zone.run(() => this.awaitingExit.set(value));
  }

  private tick(): void {
    const cvGlobal = (window as Window).cv;
    const v = this.opts?.video;
    const gate =
      `armed=${this.armed} scanner=${!!this.scanner} cvMat=${typeof cvGlobal?.Mat === 'function'} ` +
      `rs=${v?.readyState ?? '-'} vw=${v?.videoWidth ?? '-'}`;
    // Always publish a per-tick gate diagnostic; the normal metrics below overwrite it on a good
    // frame, so this only persists when the loop bails out early (telling us exactly why).
    this.setDebugMessage(gate);
    if (!this.loggedFirstTick) {
      this.loggedFirstTick = true;
      this.pushLog(`tick#1 ${gate}`);
    }

    if (!this.armed || !this.opts || !this.scanner) {
      return;
    }
    const cv = cvGlobal;
    const video = this.opts.video;
    if (!cv || video.readyState < 2 || !video.videoWidth) {
      return;
    }

    const width = this.tuning.analysisWidth;
    const height = Math.round((width * video.videoHeight) / video.videoWidth);
    if (this.analysis.width !== width || this.analysis.height !== height) {
      this.analysis.width = width;
      this.analysis.height = height;
    }
    const ctx = this.analysis.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);

    // Always paint the raw analysis frame into the debug PiP first, so we can see the camera feed
    // even if the OpenCV step below throws.
    const dbg = this.opts.debugCanvas;
    if (dbg) {
      if (dbg.width !== width || dbg.height !== height) {
        dbg.width = width;
        dbg.height = height;
      }
      dbg.getContext('2d')?.drawImage(this.analysis, 0, 0);
    }

    let mat: any;
    try {
      mat = cv.imread(this.analysis);
      const biasRegion = this.guideRectInAnalysisPixels(width) ?? undefined;
      const rawCorners = this.detectCorners(mat, cv, biasRegion);
      const corners =
        rawCorners && this.cornersComplete(rawCorners) ? rawCorners : null;

      const metrics = corners ? this.evaluate(corners, width, height) : null;
      const aligned = metrics?.aligned ?? false;
      // isStable compares against the PREVIOUS tick's corners, so evaluate it before updating prev.
      const stable = aligned && corners ? this.isStable(corners, width) : false;
      // Skip the lighting check too while still waiting for the previous document to leave frame —
      // it's irrelevant until awaitingExit clears.
      const light = aligned && corners && !this.awaitingExit() ? this.analyzeLighting(mat, cv) : null;

      // Adaptive tuning hunt (Card bucket only — tuningProfiles.length > 1): rotate through
      // CARD_TUNING_PROFILES when the live loop finds no candidate contour AT ALL for several
      // consecutive ticks. Deliberately NOT triggered by "found but misaligned" — a found-but-
      // rejected candidate is a framing problem the rotation can't fix, and rotating on it risks
      // masking a real framing issue. Gated on !awaitingExit(), mirroring the lighting-check skip.
      if (this.tuningProfiles.length > 1 && !this.awaitingExit()) {
        if (!corners) {
          this.noCandidateStreak += 1;
          if (this.noCandidateStreak >= this.profileWindowTicks()) {
            this.rotateTuningProfile();
            this.noCandidateStreak = 0;
          }
        } else {
          this.noCandidateStreak = 0;
        }
      }

      this.publishDebug(corners, metrics, stable, light, width, height);

      const now = performance.now();
      if (now - this.lastMetricsLogAt > 800) {
        this.lastMetricsLogAt = now;
        const r = metrics ? `${metrics.ratio.toFixed(2)}${metrics.ratioOk ? '(ok)' : ''}` : '-';
        const a = metrics ? `${metrics.areaFraction.toFixed(2)}${metrics.areaOk ? '(ok)' : ''}` : '-';
        const c = metrics ? (metrics.centreOk ? 'Y' : 'N') : '-';
        const lum = light ? light.mean.toFixed(0) : '-';
        const clip = light ? light.clipped.toFixed(2) : '-';
        this.pushLog(
          `m: found=${!!corners} ratio=${r} area=${a} centre=${c} stable=${stable ? 'Y' : 'N'} ` +
            `lum=${lum} clip=${clip} status=${this.status()}`,
        );
      }

      if (!aligned || !corners) {
        this.resetAlignment();
        return;
      }

      this.prevCorners = corners;

      // The previous capture's document may still be sitting in the exact same spot — hold here until
      // it's been observed gone for `exitConfirmTicks` ticks, so a slow flip can't get re-captured as
      // the next side. The existing "Turn it over" instruction already tells the user what clears this.
      if (this.awaitingExit()) {
        this.notAlignedStreak = 0;
        this.alignedSince = 0;
        this.setStatus('searching');
        return;
      }

      // Gate green on lighting: an aligned-but-poorly-lit frame shows the amber "bad light" state with a
      // matching instruction, instead of looking identical to "no document detected".
      if (light?.issue) {
        this.setLightingIssue(light.issue);
        this.alignedSince = 0;
        this.setStatus('bad-light');
        return;
      }
      this.setLightingIssue(null);

      if (!stable) {
        this.alignedSince = 0;
        this.setStatus('searching');
        return;
      }

      if (this.alignedSince === 0) {
        this.alignedSince = performance.now();
        // Clears the "still searching" hunt indicator the moment real alignment is found,
        // regardless of which profile is active — activeProfileIndex itself (not touched by
        // arm()) already carries a working profile forward across sides of the same document.
        if (this.tuningProfiles.length > 1) {
          this.setHuntActive(false);
        }
      }
      this.setStatus('aligned');
      if (this.autoCaptureEnabled && performance.now() - this.alignedSince >= this.tuning.dwellMs) {
        this.capture('auto');
      }
    } catch (error) {
      // Surface the error to the debug readout instead of silently swallowing it.
      const message = (error as { message?: string })?.message ?? String(error);
      this.zone.run(() =>
        this.debug.set({
          found: false,
          ratio: 0,
          areaFraction: 0,
          ratioOk: false,
          areaOk: false,
          centreOk: false,
          stable: false,
          aligned: false,
          error: message,
        }),
      );
    } finally {
      mat?.delete?.();
    }
  }

  /**
   * Find the largest closed contour and return its corner points — a parameterised reimplementation of
   * jscanify's `findPaperContour` (Canny → blur → Otsu → biggest contour). Two reasons we don't call
   * jscanify's version directly:
   *   1. The Canny thresholds and an optional contrast pre-step are hardcoded there; here they come from
   *      the active per-type `tuning` profile, so a weak-bordered card (pink licence on a light desk)
   *      can relax them without affecting the cards that already detect fine.
   *   2. We return plain `{x,y}` corner numbers (copied out by `getCornerPoints`) rather than a contour
   *      Mat, so the caller never has to reason about jscanify's contour-ownership/double-free quirk.
   *
   * The contrast-normalise step is feature-detected at runtime: the vendored OpenCV.js is a trimmed
   * Emscripten build whose exact symbol set we can't introspect statically, so we degrade
   * CLAHE → equalizeHist → plain grayscale → raw frame rather than risk a hard throw on-device.
   */
  private detectCorners(
    mat: any,
    cv: any,
    biasRegion?: { x: number; y: number; w: number; h: number },
  ): CornerPoints | null {
    const edges = new cv.Mat();
    const blur = new cv.Mat();
    const thresh = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    let gray: any = null;
    let clahe: any = null;
    try {
      // Source fed to Canny. By default (contrastNormalize off) we pass the frame straight through, as
      // jscanify does, so the white/laminated cards keep their exact, already-working pipeline.
      let src = mat;
      if (this.tuning.contrastNormalize && typeof cv.cvtColor === 'function' && cv.COLOR_RGBA2GRAY != null) {
        try {
          gray = new cv.Mat();
          cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
          if (typeof cv.createCLAHE === 'function') {
            clahe = cv.createCLAHE(2.0, new cv.Size(8, 8));
            clahe.apply(gray, gray);
          } else if (typeof cv.equalizeHist === 'function') {
            cv.equalizeHist(gray, gray);
          }
          src = gray; // grayscale alone (even without CLAHE) is a cleaner Canny input than RGBA.
        } catch {
          src = mat; // any op missing/failed → fall back to the raw frame, never break detection.
        }
      }

      cv.Canny(src, edges, this.tuning.cannyLow, this.tuning.cannyHigh);
      cv.GaussianBlur(edges, blur, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
      cv.threshold(blur, thresh, 0, 255, cv.THRESH_OTSU);
      cv.findContours(thresh, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

      // Expand the bias region by the tuning margin once, outside the loop.
      const region = biasRegion
        ? {
            x: biasRegion.x - biasRegion.w * this.tuning.liveDetectionMarginFraction,
            y: biasRegion.y - biasRegion.h * this.tuning.liveDetectionMarginFraction,
            w: biasRegion.w * (1 + 2 * this.tuning.liveDetectionMarginFraction),
            h: biasRegion.h * (1 + 2 * this.tuning.liveDetectionMarginFraction),
          }
        : null;

      let maxArea = 0;
      let maxIndex = -1;
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        // Ignore contours whose centre falls outside the guide box + margin — see
        // liveDetectionMarginFraction. Only applies when a bias region was supplied (the live
        // tick() loop); detectCornersOnFrame's capture-time calls omit it and are unaffected.
        if (region) {
          const rect = cv.boundingRect(contour);
          const cx = rect.x + rect.width / 2;
          const cy = rect.y + rect.height / 2;
          if (cx < region.x || cx > region.x + region.w || cy < region.y || cy > region.y + region.h) {
            continue;
          }
        }
        const area = cv.contourArea(contour);
        if (area > maxArea) {
          maxArea = area;
          maxIndex = i;
        }
      }
      if (maxIndex < 0) {
        return null;
      }
      const contour = contours.get(maxIndex);
      if (contour.rows === 0) {
        return null;
      }
      // getCornerPoints copies plain numbers out of the contour, so it stays valid after we free the
      // MatVector (and with it this contour) in the finally block below.
      return this.scanner!.getCornerPoints(contour);
    } finally {
      gray?.delete?.();
      clahe?.delete?.();
      edges.delete();
      blur.delete();
      thresh.delete();
      contours.delete();
      hierarchy.delete();
    }
  }

  /**
   * Detect corners on an already-captured canvas (the full frame, or — in warp mode — a sub-canvas
   * cropped to the guide region; see `warpWithinGuide`). Downscales `source` to `analysisWidth` the
   * same way `tick()` does, so the returned corners are in analysis-pixel space and a single uniform
   * scale (`scaleCornersToFull`) maps them back to `source`'s own pixel coordinates.
   *
   * Detecting here on the exact frame being captured — rather than reusing whatever `tick()`'s ~200ms
   * loop last cached in `prevCorners` — keeps the corners and the warped pixels in sync, which matters
   * most for a manual tap that lands between ticks.
   */
  private detectCornersOnFrame(source: HTMLCanvasElement): CornerPoints | null {
    const cv = (window as Window).cv;
    if (!cv || !source.width || !source.height) {
      return null;
    }
    const width = this.tuning.analysisWidth;
    const height = Math.round((width * source.height) / source.width);
    if (this.analysis.width !== width || this.analysis.height !== height) {
      this.analysis.width = width;
      this.analysis.height = height;
    }
    const ctx = this.analysis.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(source, 0, 0, width, height);

    let mat: any;
    try {
      mat = cv.imread(this.analysis);
      const corners = this.detectCorners(mat, cv);
      return corners && this.cornersComplete(corners) ? corners : null;
    } catch {
      return null;
    } finally {
      mat?.delete?.();
    }
  }

  /** Draws the analysis frame + detected quad into the debug canvas and publishes metrics. */
  private publishDebug(
    corners: Required<CornerPoints> | null,
    metrics: ReturnType<DocumentDetectionService['evaluate']> | null,
    stable: boolean,
    light: { issue: LightingIssue | null; mean: number; clipped: number } | null,
    frameW: number,
    frameH: number,
  ): void {
    const dbg = this.opts?.debugCanvas;
    if (dbg) {
      if (dbg.width !== frameW || dbg.height !== frameH) {
        dbg.width = frameW;
        dbg.height = frameH;
      }
      const dctx = dbg.getContext('2d');
      if (dctx) {
        dctx.drawImage(this.analysis, 0, 0);
        if (corners) {
          dctx.strokeStyle = metrics?.aligned ? (stable ? '#5dcaa5' : '#f2c14e') : '#e8643c';
          dctx.lineWidth = 3;
          dctx.beginPath();
          dctx.moveTo(corners.topLeftCorner.x, corners.topLeftCorner.y);
          dctx.lineTo(corners.topRightCorner.x, corners.topRightCorner.y);
          dctx.lineTo(corners.bottomRightCorner.x, corners.bottomRightCorner.y);
          dctx.lineTo(corners.bottomLeftCorner.x, corners.bottomLeftCorner.y);
          dctx.closePath();
          dctx.stroke();
        }
      }
    }

    this.zone.run(() =>
      this.debug.set({
        found: !!corners,
        ratio: metrics ? Math.round(metrics.ratio * 100) / 100 : 0,
        areaFraction: metrics ? Math.round(metrics.areaFraction * 100) / 100 : 0,
        ratioOk: metrics?.ratioOk ?? false,
        areaOk: metrics?.areaOk ?? false,
        centreOk: metrics?.centreOk ?? false,
        stable,
        aligned: (metrics?.aligned ?? false) && stable,
        meanLuminance: light ? Math.round(light.mean) : undefined,
        clippedFraction: light ? Math.round(light.clipped * 100) / 100 : undefined,
        awaitingExit: this.awaitingExit(),
      }),
    );
  }

  private evaluate(c: Required<CornerPoints>, frameW: number, frameH: number) {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const topEdge = dist(c.topLeftCorner, c.topRightCorner);
    const bottomEdge = dist(c.bottomLeftCorner, c.bottomRightCorner);
    const leftEdge = dist(c.topLeftCorner, c.bottomLeftCorner);
    const rightEdge = dist(c.topRightCorner, c.bottomRightCorner);

    const quadW = (topEdge + bottomEdge) / 2;
    const quadH = (leftEdge + rightEdge) / 2;
    const valid = quadW > 0 && quadH > 0;
    const ratio = valid ? quadW / quadH : 0;

    const target = this.opts!.targetRatio;
    const ratioOk = valid && Math.abs(ratio - target) <= this.tuning.ratioTolerance * target;

    const areaFraction = (quadW * quadH) / (frameW * frameH);
    const areaOk =
      areaFraction >= this.tuning.minAreaFraction &&
      areaFraction <= this.tuning.maxAreaFraction;

    const centreX =
      (c.topLeftCorner.x + c.topRightCorner.x + c.bottomLeftCorner.x + c.bottomRightCorner.x) / 4;
    const centreY =
      (c.topLeftCorner.y + c.topRightCorner.y + c.bottomLeftCorner.y + c.bottomRightCorner.y) / 4;
    const centreOk =
      Math.abs(centreX - frameW / 2) <= frameW * this.tuning.centerToleranceFraction &&
      Math.abs(centreY - frameH / 2) <= frameH * this.tuning.centerToleranceFraction;

    return { ratio, areaFraction, ratioOk, areaOk, centreOk, aligned: ratioOk && areaOk && centreOk };
  }

  private resetAlignment(): void {
    this.prevCorners = null;
    this.alignedSince = 0;
    this.setLightingIssue(null);
    if (this.awaitingExit()) {
      // Debounced: require several CONSECUTIVE not-aligned ticks (not just one flickered frame) before
      // treating the previous document as genuinely gone.
      this.notAlignedStreak += 1;
      if (this.notAlignedStreak >= this.tuning.exitConfirmTicks) {
        this.setAwaitingExit(false);
        this.notAlignedStreak = 0;
      }
    }
    if (this.armed) {
      this.setStatus('searching');
    }
  }

  /**
   * Lighting/exposure check on the same downscaled frame already read for contour detection — no extra
   * frame grab, no native plugin. Returns the failing check (if any) plus the raw metrics for the debug
   * readout. Guards each OpenCV op and degrades to "no issue" rather than throwing on the trimmed
   * Emscripten build, mirroring `detectCorners()`.
   */
  private analyzeLighting(
    mat: any,
    cv: any,
  ): { issue: LightingIssue | null; mean: number; clipped: number } {
    let gray: any = null;
    try {
      if (typeof cv.cvtColor !== 'function' || cv.COLOR_RGBA2GRAY == null) {
        return { issue: null, mean: 0, clipped: 0 };
      }
      gray = new cv.Mat();
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

      const { mean, clipped } = this.measureExposure(gray, cv);
      // Dark takes priority over glare for the live instruction swap.
      const issue: LightingIssue | null =
        mean < this.tuning.minMeanLuminance
          ? 'dark'
          : clipped > this.tuning.maxClippedFraction
            ? 'glare'
            : null;
      return { issue, mean, clipped };
    } catch {
      // Any missing/failed op → don't block capture on a lighting check we couldn't run.
      return { issue: null, mean: 0, clipped: 0 };
    } finally {
      gray?.delete?.();
    }
  }

  /**
   * Mean luminance + clipped (near-white) fraction of a single-channel grayscale Mat — the two
   * exposure metrics shared by the live lighting gate (`analyzeLighting`) and the Review-screen quality
   * verdict (`analyzeCaptureQuality`), so the two can't drift. Caller owns `gray`.
   */
  private measureExposure(gray: any, cv: any): { mean: number; clipped: number } {
    const mean = cv.mean(gray)[0] as number;
    let clipped = 0;
    let clip: any = null;
    try {
      if (typeof cv.threshold === 'function' && typeof cv.countNonZero === 'function' && cv.THRESH_BINARY != null) {
        clip = new cv.Mat();
        cv.threshold(gray, clip, this.tuning.glareClipLevel - 1, 255, cv.THRESH_BINARY);
        clipped = cv.countNonZero(clip) / (gray.rows * gray.cols);
      }
    } finally {
      clip?.delete?.();
    }
    return { mean, clipped };
  }

  /**
   * Variance of the Laplacian of a grayscale Mat — a standard focus/blur metric (higher = sharper).
   * Returns `Infinity` (treated as "sharp") if the op is unavailable on the trimmed build, so we never
   * fail a capture on a sharpness check we couldn't actually run. Caller owns `gray`.
   */
  private measureSharpness(gray: any, cv: any): number {
    if (typeof cv.Laplacian !== 'function' || typeof cv.meanStdDev !== 'function' || cv.CV_64F == null) {
      return Infinity;
    }
    let lap: any = null;
    let m: any = null;
    let sd: any = null;
    try {
      lap = new cv.Mat();
      cv.Laplacian(gray, lap, cv.CV_64F);
      m = new cv.Mat();
      sd = new cv.Mat();
      cv.meanStdDev(lap, m, sd);
      const std = (sd.data64F?.[0] as number) ?? 0;
      return std * std;
    } catch {
      return Infinity;
    } finally {
      lap?.delete?.();
      m?.delete?.();
      sd?.delete?.();
    }
  }

  /**
   * Quality verdict for a finished capture — the Review screen's signal and the ONLY quality control on
   * the manual-shutter path. Sharpness/exposure/glare are computed on the full-res captured canvas
   * (downscaled to `analysisWidth` for consistent thresholds + speed) — that's the image being
   * submitted. Completeness is measured separately by the caller on the PRE-crop full frame (see
   * `analyzeCompletenessOnFrame`) and passed in. Mirrors the guard/cleanup style of `analyzeLighting`;
   * degrades to a passing verdict rather than throwing if OpenCV ops are missing.
   */
  private analyzeCaptureQuality(
    canvas: HTMLCanvasElement,
    cv: any,
    completeness: CompletenessResult,
  ): CaptureQuality {
    if (!cv || typeof cv.imread !== 'function' || typeof cv.cvtColor !== 'function' || cv.COLOR_RGBA2GRAY == null) {
      return this.buildQuality(Infinity, 255, 0, completeness);
    }
    let src: any = null;
    let work: any = null;
    let gray: any = null;
    let region: any = null;
    try {
      src = cv.imread(canvas);
      const scale = this.tuning.analysisWidth / src.cols;
      work = new cv.Mat();
      if (scale < 1 && typeof cv.resize === 'function' && cv.INTER_AREA != null) {
        const w = this.tuning.analysisWidth;
        const h = Math.max(1, Math.round(src.rows * scale));
        cv.resize(src, work, new cv.Size(w, h), 0, 0, cv.INTER_AREA);
      } else {
        src.copyTo(work);
      }
      gray = new cv.Mat();
      cv.cvtColor(work, gray, cv.COLOR_RGBA2GRAY);

      // Weight the checks toward the card's central data-field area rather than a uniform
      // whole-card average — a defect (glare, blur) sitting over the text matters far more than
      // the same defect near the edges/margins, and a whole-card average can let a locally bad
      // center pass as "good" (confirmed live: a heavily glared, blurry driving licence scored
      // "Sharp, well-lit, glare-free" because the glare blob was a small fraction of the WHOLE
      // card, even though it sat squarely over the data fields — IDScanly's own extraction came
      // back empty, confirming the capture had actually failed). region === gray (no distinct
      // ROI) when the region would be degenerate, so the delete below is a safe no-op then.
      region = this.centerRegion(gray, cv, 0.65, 0.65);
      const laplacianVar = this.measureSharpness(region, cv);
      const { mean, clipped } = this.measureExposure(region, cv);
      return this.buildQuality(laplacianVar, mean, clipped, completeness);
    } catch {
      // Couldn't measure → don't block submission on a check we couldn't run.
      return this.buildQuality(Infinity, 255, 0, completeness);
    } finally {
      if (region && region !== gray) region.delete?.();
      gray?.delete?.();
      work?.delete?.();
      src?.delete?.();
    }
  }

  /**
   * Crops a grayscale Mat to its centered rectangular region (as a fraction of width/height) — see
   * `analyzeCaptureQuality` for why. Returns the same Mat unchanged if the requested region would
   * be degenerate (e.g. cover the whole frame or more). The returned ROI Mat shares data with
   * `mat` (standard OpenCV reference-counted semantics) — safe to `.delete()` independently of
   * `mat`, which callers already do for their own Mats.
   */
  private centerRegion(mat: any, cv: any, widthFraction: number, heightFraction: number): any {
    const w = Math.max(1, Math.round(mat.cols * widthFraction));
    const h = Math.max(1, Math.round(mat.rows * heightFraction));
    if (w >= mat.cols && h >= mat.rows) {
      return mat;
    }
    const x = Math.max(0, Math.round((mat.cols - w) / 2));
    const y = Math.max(0, Math.round((mat.rows - h) / 2));
    return mat.roi(new cv.Rect(x, y, w, h));
  }

  /**
   * Completeness check for the Review-screen quality verdict — detects whether the whole document was
   * visible when the shot was taken, catching an occlusion (finger/hand over the card) or a badly
   * placed card that the sharpness/exposure/glare checks alone can't see (they're happy to call a
   * well-lit photo of half a card "good").
   *
   * Runs on the FULL pre-crop camera frame, never on the saved capture. The v1 of this check analyzed
   * the captured output and flagged every good capture: warp mode maps the card's corners exactly onto
   * the output canvas, so the saved image has no card edges left inside it for Canny to find (they ARE
   * the image boundary), and the manual guide crop is nearly as tight. Only the pre-crop frame still
   * shows the card boundary against background.
   *
   * Detection is bounded to the guide box + `completenessMarginFraction` (so an oversized contour
   * elsewhere in the frame can't be picked, mirroring `warpWithinGuide`'s crop-first reasoning, but with
   * a larger margin so the card's edges + surrounding background are inside the crop). Verdict:
   *  - no quad found        → incomplete ('not-found'): occlusion breaks the contour — but also fires
   *                           if the detector simply fails, hence the softer UI copy for this reason.
   *                           NOT loosened for manual: detection doesn't require an axis-aligned
   *                           rectangle (a tilted card still produces a detectable quad), so "nothing
   *                           found at all" stays a meaningful signal regardless of source;
   *  - quad touches the region border → incomplete ('clipped'): card runs outside where it should be;
   *  - ratio or coverage off → incomplete ('geometry'): wrong shape, or too small vs the guide box.
   * Ratio tolerance, coverage floor, and the clip boundary are all SOURCE-DEPENDENT (see
   * `capture-tuning.ts` manual* constants): an auto-capture only fires after the live loop confirms
   * several consecutive well-aligned frames, so its frame is trustworthy at the tighter defaults; a
   * manual shutter tap hands this one arbitrary, ungated, often hand-held-at-an-angle frame, which is
   * genuinely foreshortened in the image (real perspective, not measurement noise) and needs real
   * tolerance. The clip boundary specifically: manual's actual saved output (`cropToGuide`) is just the
   * guide box, no margin, so a corner near the padded region's edge can still be safely inside what
   * manual actually saves — checked against the guide box itself, not the padded region, for manual.
   * If the guide element isn't available (can't measure at all), degrades to complete — matching the
   * other checks' "couldn't run → don't block" posture.
   */
  private analyzeCompletenessOnFrame(
    full: HTMLCanvasElement,
    targetRatio: number,
    source: CaptureSource,
  ): CompletenessResult {
    const region = this.guideRegionInFullPixels(
      full.width,
      full.height,
      this.tuning.completenessMarginFraction,
    );
    const guide = this.guideRectInSourcePixels();
    if (!region || !guide || !full.width || !full.height) {
      return { complete: true, cornersFound: false, coverageFraction: 0, ratio: 0, reason: null };
    }

    const regionCanvas = this.cropCanvas(full, region);
    const cornersAnalysis = this.detectCornersOnFrame(regionCanvas);
    const corners = cornersAnalysis
      ? this.scaleCornersToFull(cornersAnalysis, regionCanvas.width)
      : null;
    if (!corners) {
      return { complete: false, cornersFound: false, coverageFraction: 0, ratio: 0, reason: 'not-found' };
    }

    const isManual = source === 'manual';
    const ratioTolerance = isManual
      ? this.tuning.manualCompletenessRatioTolerance
      : this.tuning.completenessRatioTolerance;
    const minCoverage = isManual
      ? this.tuning.manualMinCaptureCoverageFraction
      : this.tuning.minCaptureCoverageFraction;

    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const quadW = (dist(corners.topLeftCorner, corners.topRightCorner) + dist(corners.bottomLeftCorner, corners.bottomRightCorner)) / 2;
    const quadH = (dist(corners.topLeftCorner, corners.bottomLeftCorner) + dist(corners.topRightCorner, corners.bottomRightCorner)) / 2;

    const ratio = quadH > 0 ? quadW / quadH : 0;
    const ratioOk = quadH > 0 && Math.abs(ratio - targetRatio) <= ratioTolerance * targetRatio;

    // Coverage vs the UNPADDED guide box: a well-placed card fills most of the brackets the user framed
    // it in, regardless of how much context margin the detection crop added.
    const coverageFraction = (quadW * quadH) / (guide.sw * guide.sh);
    const coverageOk = coverageFraction >= minCoverage;

    // Clip boundary: for auto, the padded analysis region (matches warpWithinGuide's own crop-first
    // reasoning). For manual, the guide box itself — that's the actual saved output (cropToGuide), so
    // that's the boundary that matters. 2% epsilon (of the boundary's own size) absorbs detection jitter.
    const clipBounds = isManual
      ? { x: guide.sx - region.x, y: guide.sy - region.y, w: guide.sw, h: guide.sh }
      : { x: 0, y: 0, w: region.w, h: region.h };
    const eps = 0.02 * Math.max(clipBounds.w, clipBounds.h);
    const pts = [corners.topLeftCorner, corners.topRightCorner, corners.bottomLeftCorner, corners.bottomRightCorner];
    const clipped = pts.some(
      (p) =>
        p.x <= clipBounds.x - eps ||
        p.y <= clipBounds.y - eps ||
        p.x >= clipBounds.x + clipBounds.w + eps ||
        p.y >= clipBounds.y + clipBounds.h + eps,
    );

    const complete = ratioOk && coverageOk && !clipped;
    const reason: CompletenessResult['reason'] = complete ? null : clipped ? 'clipped' : 'geometry';
    return { complete, cornersFound: true, coverageFraction, ratio, reason };
  }

  /** Turn the raw metrics into the booleans, verdict, and human-readable summary line. */
  private buildQuality(
    laplacianVar: number,
    meanLuminance: number,
    clippedFraction: number,
    completeness: CompletenessResult,
  ): CaptureQuality {
    const sharp = laplacianVar >= this.tuning.minSharpnessVar;
    const wellLit = meanLuminance >= this.tuning.minMeanLuminance;
    const glareFree = clippedFraction <= this.tuning.maxClippedFraction;
    // `complete` is deliberately NOT part of the verdict (see CaptureQuality.complete's doc
    // comment) — the geometry re-detection behind it is a heuristic proxy, not a measurement of
    // the image content, and produced enough visible false positives on genuinely fully-captured
    // documents to undermine trust in the whole verdict. Still computed and returned for
    // diagnostics/telemetry (Mixpanel, the "Show debug" readout), just no longer shown or acted on.
    const complete = completeness.complete;
    const verdict = sharp && wellLit && glareFree ? 'good' : 'recheck';
    const issues = [
      !sharp ? this.lang.t('idscanly.qualityBlurry') : null,
      !wellLit ? this.lang.t('idscanly.qualityDark') : null,
      !glareFree ? this.lang.t('idscanly.qualityGlare') : null,
    ].filter((s): s is string => s !== null);
    const summary =
      verdict === 'good' ? this.lang.t('idscanly.qualityGood') : this.capitalize(issues.join(' · '));
    return {
      sharp,
      wellLit,
      glareFree,
      complete,
      verdict,
      summary,
      metrics: {
        laplacianVar,
        meanLuminance,
        clippedFraction,
        cornersFound: completeness.cornersFound,
        coverageFraction: completeness.coverageFraction,
        ratio: completeness.ratio,
        completenessReason: completeness.reason,
      },
    };
  }

  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private cornersComplete(c: CornerPoints): c is Required<CornerPoints> {
    const pts = [c.topLeftCorner, c.topRightCorner, c.bottomLeftCorner, c.bottomRightCorner];
    return pts.every((p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y));
  }

  private isStable(c: Required<CornerPoints>, frameW: number): boolean {
    const prev = this.prevCorners;
    if (!prev || !this.cornersComplete(prev)) {
      return false;
    }
    const threshold = frameW * this.tuning.stabilityThresholdFraction;
    const moved = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    return (
      moved(c.topLeftCorner, prev.topLeftCorner!) < threshold &&
      moved(c.topRightCorner, prev.topRightCorner!) < threshold &&
      moved(c.bottomLeftCorner, prev.bottomLeftCorner!) < threshold &&
      moved(c.bottomRightCorner, prev.bottomRightCorner!) < threshold
    );
  }

  /**
   * Manual shutter — capture immediately, bypassing the alignment/dwell gate. Always available
   * regardless of the auto-capture toggle. No-op once we've already fired for this side (`armed` is
   * false during extraction / before the caller re-arms).
   */
  captureManual(): void {
    if (this.armed) {
      this.capture('manual');
    }
  }

  private capture(source: CaptureSource): void {
    if (!this.opts) {
      return;
    }
    // Stop further ticks from firing while we extract / before the caller re-arms.
    this.armed = false;
    this.alignedSince = 0;
    this.setLightingIssue(null);
    this.prevCorners = null;

    const video = this.opts.video;
    const full = document.createElement('canvas');
    full.width = video.videoWidth;
    full.height = video.videoHeight;
    full.getContext('2d')?.drawImage(video, 0, 0);

    // Completeness must be measured on the full frame BEFORE crop/warp — the cropped/warped output
    // contains no card edges to detect (warp maps them exactly onto the canvas boundary), which is why
    // the earlier post-crop version of this check flagged every good capture. Runs for both auto and
    // manual captures (user decision: auto's live gate isn't trusted as a substitute).
    const completeness = this.analyzeCompletenessOnFrame(full, this.opts.targetRatio, source);

    // A MANUAL tap always crops the guide box: the user expects the saved image to match exactly what
    // they framed in the preview (WYSIWYG), and edge-detection can't be trusted on a single ungated
    // frame. AUTO capture follows the type's captureMode — 'warp' perspective-flattens the detected
    // card (the dwell/stability gate has already confirmed a real aligned document; the preview was
    // only guidance), 'frame' crops the guide box.
    const cropOnly = source === 'manual' || this.opts.captureMode === 'frame';
    const captured = cropOnly
      ? this.cropToGuide(full) ?? full
      : this.warpWithinGuide(full) ?? full;

    // Quality is computed here, on the path EVERY capture flows through (auto + manual shutter), so the
    // manual override — which skips the live alignment/lighting gates — can't store an unvalidated image.
    const quality = this.analyzeCaptureQuality(captured, (window as Window).cv, completeness);

    this.setStatus('captured');
    this.zone.run(() => this.opts?.onCapture(captured, quality, source));
  }

  /**
   * 'warp' capture, bounded to the guide box so the result can never exceed what the user framed.
   *
   * We crop the full frame to the guide region (+ a small margin) BEFORE detecting corners. That
   * matters because the detector picks the single largest rectangular contour: on the full frame an
   * oversized object outside the brackets — the whole open booklet, a keyboard edge, the desk — can
   * beat the actual document and get warped to fill the output (the reported "captured a completely
   * different/zoomed-out region" bug). Cropping first removes those objects from the image entirely,
   * so they can't be selected.
   *
   * If a clean quad is found inside the crop we perspective-flatten it from the FULL-res frame (corners
   * offset back into full-frame coordinates), keeping deskew and maximum detail. If no clean quad is
   * found we fall back to the exact guide-box crop (`cropToGuide`) — literally the pixels the user saw
   * inside the brackets — rather than jscanify's unconstrained full-frame re-detect. Returns null only
   * if even the guide crop can't be produced, so `capture()` can fall back to the raw frame.
   */
  private warpWithinGuide(full: HTMLCanvasElement): HTMLCanvasElement | null {
    if (!this.opts || !this.scanner) {
      return null;
    }
    const region = this.guideRegionInFullPixels(full.width, full.height);
    if (!region) {
      // No guide element to bound to (shouldn't happen mid-scan) — degrade to an unconstrained warp.
      return this.warp(full, this.detectCornersOnFrame(full));
    }

    const regionCanvas = this.cropCanvas(full, region);
    const cornersInRegion = this.scaleCornersToFull(
      this.detectCornersOnFrame(regionCanvas),
      regionCanvas.width,
    );
    // Only trust the quad if it fills most of the crop. Inside this tight crop the dominant contour is
    // normally the document/page edge; a much smaller one means the detector latched onto an internal
    // feature (a hologram, the photo) and warping it would zoom into that. In that case the exact guide
    // crop below (what the user actually framed) is the safer, WYSIWYG result.
    if (cornersInRegion && this.quadFillsCanvas(cornersInRegion, regionCanvas)) {
      const cornersInFull = this.offsetCorners(cornersInRegion, region.x, region.y);
      try {
        const warped = this.scanner.extractPaper(
          full,
          this.opts.extractWidth,
          this.opts.extractHeight,
          cornersInFull,
        );
        if (warped) {
          return warped;
        }
      } catch {
        // Fall through to the guide crop below.
      }
    }
    return this.cropToGuide(full);
  }

  /** True if the detected quad covers at least half the crop area (shoelace area / canvas area). */
  private quadFillsCanvas(c: Required<CornerPoints>, canvas: HTMLCanvasElement): boolean {
    const pts = [c.topLeftCorner, c.topRightCorner, c.bottomRightCorner, c.bottomLeftCorner];
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      area += a.x * b.y - b.x * a.y;
    }
    area = Math.abs(area) / 2;
    return area >= 0.5 * canvas.width * canvas.height;
  }

  /**
   * Unconstrained warp — only used now as the no-guide-element degrade path of `warpWithinGuide`.
   * Scales `lockedCorners` (analysis-pixel space) up to full-res and hands them to jscanify's
   * `extractPaper`; with no corners, falls back to jscanify's own full-res detect. Returns null if
   * extraction finds nothing.
   */
  private warp(
    full: HTMLCanvasElement,
    lockedCorners: CornerPoints | null,
  ): HTMLCanvasElement | null {
    if (!this.opts || !this.scanner) {
      return null;
    }
    try {
      const scaled = this.scaleCornersToFull(lockedCorners, full.width);
      return scaled
        ? this.scanner.extractPaper(full, this.opts.extractWidth, this.opts.extractHeight, scaled)
        : this.scanner.extractPaper(full, this.opts.extractWidth, this.opts.extractHeight);
    } catch {
      return null;
    }
  }

  /** Crop `src` to a source-pixel rectangle into a fresh canvas. */
  private cropCanvas(
    src: HTMLCanvasElement,
    rect: { x: number; y: number; w: number; h: number },
  ): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(rect.w));
    out.height = Math.max(1, Math.round(rect.h));
    out
      .getContext('2d')
      ?.drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, 0, out.width, out.height);
    return out;
  }

  /** Translate all four corners by (dx, dy) — used to lift region-local corners into full-frame space. */
  private offsetCorners(
    c: Required<CornerPoints>,
    dx: number,
    dy: number,
  ): Required<CornerPoints> {
    const o = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
    return {
      topLeftCorner: o(c.topLeftCorner),
      topRightCorner: o(c.topRightCorner),
      bottomLeftCorner: o(c.bottomLeftCorner),
      bottomRightCorner: o(c.bottomRightCorner),
    };
  }

  /**
   * Map analysis-frame corner points up to full-res-frame coordinates. The analysis canvas preserves
   * the frame's aspect ratio (height is derived from `analysisWidth`), so a single uniform scale factor
   * applies to both axes. Returns null unless all four corners are present.
   */
  private scaleCornersToFull(
    corners: CornerPoints | null,
    fullWidth: number,
  ): Required<CornerPoints> | null {
    if (!corners || !this.cornersComplete(corners)) {
      return null;
    }
    const scale = fullWidth / this.tuning.analysisWidth;
    const s = (p: { x: number; y: number }) => ({ x: p.x * scale, y: p.y * scale });
    return {
      topLeftCorner: s(corners.topLeftCorner),
      topRightCorner: s(corners.topRightCorner),
      bottomLeftCorner: s(corners.bottomLeftCorner),
      bottomRightCorner: s(corners.bottomRightCorner),
    };
  }

  /**
   * Maps the on-screen guide box's CSS rect into source-video pixel coordinates. The viewfinder shows
   * the video with `object-fit: cover`, so the source is uniformly scaled to fill the element box and
   * centred, with the overflow clipped — this inverts that to find which video pixels the guide box
   * actually corresponds to right now. Shared by `cropToGuide` (frame-mode crop) and
   * `guideRegionInAnalysisPixels` (warp-mode capture-time detection bias). Returns null if the guide
   * element/video metrics aren't available or the mapped rectangle is degenerate.
   */
  private guideRectInSourcePixels(): { sx: number; sy: number; sw: number; sh: number } | null {
    const video = this.opts?.video;
    const guideEl = this.opts?.getGuideEl?.();
    if (!video || !guideEl) {
      return null;
    }
    const videoRect = video.getBoundingClientRect();
    const guideRect = guideEl.getBoundingClientRect();
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || !videoRect.width || !videoRect.height) {
      return null;
    }

    // object-fit: cover — the source is scaled to fully cover the element box, then centred.
    const scale = Math.max(videoRect.width / vw, videoRect.height / vh);
    const offsetX = (videoRect.width - vw * scale) / 2;
    const offsetY = (videoRect.height - vh * scale) / 2;

    const toSourceX = (cssX: number) =>
      Math.min(vw, Math.max(0, (cssX - videoRect.left - offsetX) / scale));
    const toSourceY = (cssY: number) =>
      Math.min(vh, Math.max(0, (cssY - videoRect.top - offsetY) / scale));

    const sx = toSourceX(guideRect.left);
    const sy = toSourceY(guideRect.top);
    const sw = toSourceX(guideRect.right) - sx;
    const sh = toSourceY(guideRect.bottom) - sy;
    if (sw < 1 || sh < 1) {
      return null;
    }
    return { sx, sy, sw, sh };
  }

  /**
   * Maps the on-screen guide box into ANALYSIS-frame pixel coordinates — the same downscaled,
   * uncropped frame the live tick() loop runs detection on (`this.analysis`, populated by a plain
   * `drawImage(video, 0, 0, width, height)`, i.e. a uniform scale of the full video frame with no
   * offset). Used to bias contour selection toward "near the guide box" — see detectCorners() and
   * liveDetectionMarginFraction. Returns null under the same conditions as guideRectInSourcePixels().
   */
  private guideRectInAnalysisPixels(
    analysisWidth: number,
  ): { x: number; y: number; w: number; h: number } | null {
    const video = this.opts?.video;
    const rect = this.guideRectInSourcePixels();
    if (!video || !rect || !video.videoWidth) {
      return null;
    }
    const scale = analysisWidth / video.videoWidth;
    return { x: rect.sx * scale, y: rect.sy * scale, w: rect.sw * scale, h: rect.sh * scale };
  }

  /**
   * 'frame' capture: crop the full-res frame to whatever the on-screen guide box covers, so the saved
   * image matches what the user framed. Returns null (→ caller keeps the full frame) if the guide rect
   * can't be mapped right now.
   */
  private cropToGuide(full: HTMLCanvasElement): HTMLCanvasElement | null {
    const rect = this.guideRectInSourcePixels();
    if (!rect) {
      return null;
    }
    const cropped = document.createElement('canvas');
    cropped.width = Math.round(rect.sw);
    cropped.height = Math.round(rect.sh);
    cropped
      .getContext('2d')
      ?.drawImage(full, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, cropped.width, cropped.height);
    return cropped;
  }

  /**
   * The guide box expanded by a margin, in full-res source-pixel coordinates and clamped to the frame —
   * the crop `warpWithinGuide` detects within (default `guideRegionMarginFraction`, kept small so an
   * oversized object outside the brackets can't be picked as the document) and the completeness check
   * detects within (`completenessMarginFraction`, larger so the card's edges + background context are
   * inside the crop). Returns null if the guide rect isn't available.
   */
  private guideRegionInFullPixels(
    fullWidth: number,
    fullHeight: number,
    marginFraction?: number,
  ): { x: number; y: number; w: number; h: number } | null {
    const rect = this.guideRectInSourcePixels();
    if (!rect) {
      return null;
    }
    const margin = marginFraction ?? this.tuning.guideRegionMarginFraction;
    const mx = rect.sw * margin;
    const my = rect.sh * margin;
    const x = Math.max(0, rect.sx - mx);
    const y = Math.max(0, rect.sy - my);
    const right = Math.min(fullWidth, rect.sx + rect.sw + mx);
    const bottom = Math.min(fullHeight, rect.sy + rect.sh + my);
    return { x, y, w: right - x, h: bottom - y };
  }
}

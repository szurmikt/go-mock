/**
 * Detection / auto-capture tuning knobs — collected in ONE place so they can be tuned against
 * real device footage without hunting through the detection service.
 *
 * These are deliberate starting guesses (see README open question #2), not validated values.
 */
export const DETECTION_TUNING = {
  /** How often the detection loop runs. ~150–250 ms per handoff (not every frame — saves CPU/battery). */
  loopIntervalMs: 200,

  /** How long the guide must stay green/aligned before auto-capture fires. ~400–600 ms per handoff. */
  dwellMs: 500,

  /** Width (px) of the downscaled canvas we run OpenCV on. Smaller = faster, less precise. */
  analysisWidth: 480,

  /**
   * Preferred camera capture resolution — the source frame the final image is warped from, so it's
   * the real detail ceiling. Applied as `ideal` (NOT `min`): Safari picks the closest well-supported
   * mode and keeps normal autofocus. (A hard `min: 2560` previously forced an odd mode that wouldn't
   * focus — hence the blur.) 1080p is a focus-safe sharp default; try 1280x720 if AF still struggles,
   * or 2560x1440 if your device focuses fine and you want more. The detection loop is unaffected — it
   * always downscales to `analysisWidth` first.
   */
  cameraIdealWidth: 1920,
  cameraIdealHeight: 1080,

  /**
   * Lower / upper hysteresis thresholds for the Canny edge step inside the contour detector. These are
   * jscanify's hardcoded defaults, exposed here so a per-type profile can relax them for a card whose
   * border barely contrasts with the background (see DRIVING_LICENCE_TUNING).
   */
  cannyLow: 50,
  cannyHigh: 200,

  /**
   * When true, grayscale + CLAHE (contrast-limited adaptive histogram equalisation) the frame before
   * Canny, so a weak/low-contrast border (e.g. a pink licence on a light desk) still yields an edge.
   * Off by default — the white/laminated cards already detect fine and don't need it.
   */
  contrastNormalize: false,

  /** Detected quad must cover at least this fraction of the analysis frame (document close enough). */
  minAreaFraction: 0.15,

  /** ...and at most this fraction (not so close it's clipped). */
  maxAreaFraction: 0.98,

  /** Allowed relative deviation of detected aspect ratio from the type's guide ratio (0.30 = ±30%). */
  ratioTolerance: 0.3,

  /** Per-corner movement between consecutive ticks must stay below this fraction of frame width. */
  stabilityThresholdFraction: 0.04,

  /** Detected quad centre must be within this fraction of frame size from the frame centre. */
  centerToleranceFraction: 0.25,

  /**
   * Capture-time-only padding around the guide box, as a fraction of its width/height. The warp-mode
   * capture crops the frame to the guide region + this margin BEFORE detecting corners, so an
   * oversized contour outside the brackets (the whole booklet, a keyboard edge, the desk) can't be
   * picked as "the document" — see DocumentDetectionService.warpWithinGuide. Kept small: just enough
   * slack that a card whose edge sits right on the bracket line isn't clipped out of the crop. Doesn't
   * touch the live `tick()` loop or its dwell/stability gate, so auto-capture behaviour is unchanged.
   */
  guideRegionMarginFraction: 0.06,

  /**
   * Margin (fraction of guide-box size) around the guide box the LIVE tick() loop's contour search
   * is biased toward — a candidate contour whose centre falls outside guide box + this margin is
   * ignored, even if it's the largest one in the frame. Without this, "largest contour in the WHOLE
   * frame" can latch onto an unrelated object elsewhere in a cluttered scene (a second card, a wallet
   * edge, a strap) instead of the card the user is framing, flip-flopping between candidates tick to
   * tick so the geometry never stabilises and auto-capture never fires — reproduced 2026-07-15 with a
   * card held over a wallet containing a second card. Deliberately much more generous than
   * `guideRegionMarginFraction` (which crops tightly at CAPTURE time once the user is already
   * aligned): here the user is often still adjusting position, so the search area needs real slack.
   * STARTING GUESS — tune against real device footage.
   */
  liveDetectionMarginFraction: 0.5,

  /**
   * Lighting/exposure gate — checked on the same downscaled frame as the contour step (no extra
   * dependency, no native plugin). The green bracket state is gated on these passing as well as the
   * geometry checks; failing one shows the amber "bad light" state instead. STARTING GUESSES — tune
   * against real device footage (see README open question #6).
   */
  /** Mean grayscale luminance (0–255) below this → "too dark" (underexposed). */
  minMeanLuminance: 60,

  /** A grayscale pixel at/above this value counts as "clipped"/near-white (used for the glare check). */
  glareClipLevel: 245,

  /**
   * Fraction of clipped (near-white) pixels above which the frame is flagged as "glare". This is the
   * more important of the two checks — lamination glare on real ID/licence cards also breaks Canny.
   */
  maxClippedFraction: 0.1,

  /**
   * Sharpness gate for the Review-screen quality verdict (NOT the live loop). Variance of the Laplacian
   * of the captured image, measured at `analysisWidth`; below this the capture reads as blurry/out of
   * focus. This is the only quality check the manual shutter has — auto-capture never reaches it blurry.
   * STARTING GUESS — tune against real device footage (see README open question #6).
   */
  minSharpnessVar: 120,

  /**
   * Completeness gate for the Review-screen quality verdict — the document quad detected on the FULL
   * pre-crop camera frame must cover at least this fraction of the guide box. Measured pre-crop because
   * the saved capture itself is useless for this: warp mode maps the card edge-to-edge onto the output
   * (no card edges left inside the image to detect — the v1 post-crop check failed on every good
   * capture because of exactly this), and the manual guide crop is nearly as tight. Below this, a
   * finger/hand covering part of the card, or a badly placed card, reads as incomplete even if sharp.
   * STARTING GUESS — tune against real device footage. Applies to AUTO captures only — see
   * `manualMinCaptureCoverageFraction` for manual.
   */
  minCaptureCoverageFraction: 0.72,

  /**
   * Coverage floor for MANUAL captures specifically — much looser than the auto value above, for the
   * same reason as `manualCompletenessRatioTolerance`: an approximately-framed hand-held card won't fill
   * the on-screen guide brackets as precisely as a laid-flat, gate-confirmed auto-capture. Still
   * requires roughly half the guide box's worth of card to be found, so a genuinely mostly-obstructed or
   * way-out-of-frame shot still fails. STARTING GUESS.
   */
  manualMinCaptureCoverageFraction: 0.45,

  /**
   * Ratio tolerance for the completeness check specifically — deliberately looser than the live loop's
   * `ratioTolerance` (0.3, below). The live gate is about frame-by-frame alignment precision; this one
   * just answers "is this basically the right document shape." STARTING GUESS. Applies to AUTO captures
   * only — see `manualCompletenessRatioTolerance` for manual.
   */
  completenessRatioTolerance: 0.45,

  /**
   * Ratio tolerance for MANUAL captures specifically — much looser than the auto value above. An auto
   * capture only fires after the live loop confirms several consecutive well-aligned frames; a manual
   * shutter tap hands the completeness check one arbitrary, ungated frame, typically hand-held at some
   * angle. A tilted card is GENUINELY foreshortened in the 2D image — its measured ratio really does
   * shrink from perspective, not detection error — so it needs real tolerance, not a tighter one. In the
   * same neighborhood as PASSPORT_TUNING.ratioTolerance (0.8, below), tuned for the same "hard to frame
   * precisely" reason. STARTING GUESS.
   */
  manualCompletenessRatioTolerance: 0.75,

  /**
   * Margin (fraction of guide-box size) around the guide box for the completeness check's detection
   * crop. Much larger than `guideRegionMarginFraction` (0.06, above) on purpose: the warp-bias crop
   * wants to EXCLUDE outside objects, the completeness crop must INCLUDE the card's edges plus enough
   * surrounding background for Canny to close the card contour even when the card sits right on the
   * bracket line.
   */
  completenessMarginFraction: 0.2,

  /**
   * Consecutive not-aligned ticks required to confirm a just-captured document has actually left frame
   * before the next side becomes capture-eligible. Without this, a slow flip (the card still sitting in
   * the same spot right after capturing the front) re-aligns within one tick and gets auto-captured
   * again as the next side. Debounced (not a single tick) so one motion-blur frame mid-flip can't
   * prematurely clear the gate. STARTING GUESS — tune against real device footage.
   */
  exitConfirmTicks: 2,

  /** JPEG quality used when serialising captured canvases to data URLs. */
  jpegQuality: 0.92,

  /** Longest edge (px) of the small tray thumbnail generated from each capture. */
  thumbnailMaxEdge: 280,
};

/** Shape of a detection profile — so per-document overrides are type-checked. */
export type DetectionTuning = typeof DETECTION_TUNING;

/**
 * Passport-specific overrides (merged over DETECTION_TUNING).
 *
 * A passport is an open booklet, not a flat card: there is no clean isolated bio-page rectangle, the
 * page curves when held, and the user holds it by hand. The defaults (tuned for a card) are too
 * strict, so these relax the alignment gates and let a hand-held booklet settle longer before
 * auto-capture. STARTING GUESSES — tune against real device footage (see README open question #2).
 */
export const PASSPORT_TUNING: Partial<DetectionTuning> = {
  // Bio-page-alone vs. whole-spread framing vary a lot, so the ratio gate is effectively lenient.
  ratioTolerance: 0.8,
  // A held booklet often doesn't fill as much of the frame as a card laid flat.
  minAreaFraction: 0.1,
  // Hand-held framing drifts off-centre more.
  centerToleranceFraction: 0.35,
  // Hand jitter — allow more per-tick corner movement before considering it "stable".
  stabilityThresholdFraction: 0.07,
  // Give the held booklet a touch longer to settle before auto-capture fires.
  dwellMs: 700,
};

/**
 * Driving-licence-specific overrides (merged over DETECTION_TUNING).
 *
 * The Hungarian licence is pink on a typically light desk, so its outer border has almost no luminance
 * contrast and Canny at the default thresholds never closes the card rectangle — the detector then
 * latches onto an internal feature (the portrait) and never auto-captures. Contrast-normalising and
 * lowering the Canny thresholds recovers the weak border. The ratio/area/centre gates are left at the
 * defaults — they aren't the problem.
 */
export const DRIVING_LICENCE_TUNING: Partial<DetectionTuning> = {
  contrastNormalize: true,
  cannyLow: 30,
  cannyHigh: 120,
};

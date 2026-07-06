/**
 * Per-side capture quality verdict, computed once on the full-resolution captured image (see
 * `DocumentDetectionService.analyzeCaptureQuality`). This is the Review screen's quality signal — and
 * the SOLE backstop for the manual-shutter path, which bypasses every live alignment/lighting gate.
 *
 * Thresholds behind the booleans are starting guesses (see `capture-tuning.ts`), not validated values.
 */
export interface CaptureQuality {
  /** Variance-of-Laplacian focus metric is above the sharpness threshold (not blurry). */
  sharp: boolean;
  /** Mean luminance is above the darkness threshold (not underexposed). */
  wellLit: boolean;
  /** Clipped (near-white) pixel fraction is below the glare threshold. */
  glareFree: boolean;
  /**
   * The whole document was visible when the shot was taken: a 4-corner quad was found on the FULL
   * pre-crop camera frame (not the saved capture — warp/crop leave no card edges inside that image),
   * its aspect ratio matches the known document type, it covers most of the guide box, and it doesn't
   * run off the analyzed region. Catches an occlusion (finger/hand over the card) or a badly placed
   * card that would otherwise still read as "sharp" — see
   * `DocumentDetectionService.analyzeCompletenessOnFrame`.
   */
  complete: boolean;
  /** `good` only when all four checks pass; otherwise `recheck`. */
  verdict: 'good' | 'recheck';
  /** Short human-readable line, e.g. "Sharp, well-lit, glare-free" or "Could be sharper · glare detected". */
  summary: string;
  /** Raw metrics behind the verdict — kept for the debug readout / threshold tuning. */
  metrics: {
    laplacianVar: number;
    meanLuminance: number;
    clippedFraction: number;
    /** Completeness readout, all measured on the pre-crop full frame. */
    cornersFound: boolean;
    /** Detected quad area / guide-box area. */
    coverageFraction: number;
    ratio: number;
    /** Why `complete` is false: card outline not found / runs off the region / wrong shape or size. */
    completenessReason: 'not-found' | 'clipped' | 'geometry' | null;
  };
}

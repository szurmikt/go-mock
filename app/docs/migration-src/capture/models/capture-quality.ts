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
  /** `good` only when all three checks pass; otherwise `recheck`. */
  verdict: 'good' | 'recheck';
  /** Short human-readable line, e.g. "Sharp, well-lit, glare-free" or "Could be sharper · glare detected". */
  summary: string;
  /** Raw metrics behind the verdict — kept for the debug readout / threshold tuning. */
  metrics: { laplacianVar: number; meanLuminance: number; clippedFraction: number };
}

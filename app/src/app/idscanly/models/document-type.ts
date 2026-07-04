/**
 * Per-document-type configuration.
 *
 * This is the hardcoded "the app already knows" logic referenced in the handoff: the user only
 * picks the document type they are holding; how many sides it needs and what guide/extract
 * geometry to use are looked up here.
 *
 * Sidedness rule (fixed for this prototype): ID card = two-sided, everything else one-sided.
 * A production rollout might revisit this per country/jurisdiction — intentionally NOT built here.
 */

import { DetectionTuning, DRIVING_LICENCE_TUNING, PASSPORT_TUNING } from '../capture-tuning';

export type DocumentTypeId =
  | 'id-card'
  | 'passport'
  | 'driving-licence'
  | 'address-card';

export type Side = 'front' | 'back';

export interface DocumentTypeConfig {
  id: DocumentTypeId;
  label: string;
  /** Tabler icon name (without the `ti-` prefix). Matches the UI mockup. */
  icon: string;
  /** Capture slots in order. Length 2 => two-sided (ID card only). */
  sides: Side[];
  /** Guide / expected document aspect ratio as width / height. */
  guideRatio: number;
  /**
   * Target output dimensions handed to jscanify `extractPaper`. These approximate ~300 dpi of the
   * physical document. The real requirement is owned by the (out-of-scope) server-side OCR step —
   * see README open question #4. Tune here in one place.
   */
  extractWidth: number;
  extractHeight: number;
  /**
   * How an AUTO capture is produced once detection fires (a MANUAL shutter tap always crops the guide
   * box regardless, for WYSIWYG — see DocumentDetectionService.capture()):
   *  - 'warp'  : perspective-warp the detected quad flat (jscanify `extractPaper`). Good for flat
   *              cards (ID-1 types).
   *  - 'frame' : skip the warp; crop the full-res frame to the guide-box region. Used for the
   *              passport booklet, whose curved/ambiguous page warps into a distorted image.
   */
  captureMode: 'warp' | 'frame';
  /** Optional per-type detection overrides, merged over DETECTION_TUNING. */
  tuning?: Partial<DetectionTuning>;
  /**
   * Overrides the default "Scanning the Nth page" live instruction on Scan. For a single-sided type
   * where "page" is misleading (e.g. a passport's bio page isn't "page 1" of anything being counted
   * here), set a more specific instruction instead.
   */
  scanningMessage?: string;
}

// ID-1 card format (85.6 x 54 mm) => ratio ~1.586, used for ID / licence / address card.
// Warp target ~1.6x the old 1012x638 (~480 dpi) so a 1080p source frame's card detail is preserved
// rather than downsampled. Keep in step with DETECTION_TUNING.cameraIdeal* — there's no point
// extracting more pixels than the camera frame actually contains.
const ID1_RATIO = 1.586;
const ID1_W = 1620;
const ID1_H = 1021;

// ID-3 / TD3 passport bio page (125 x 88 mm) => ratio ~1.42. OPEN QUESTION #1: confirm on hardware.
const PASSPORT_RATIO = 1.42;
const PASSPORT_W = 2130;
const PASSPORT_H = 1500;

export const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    id: 'id-card',
    label: 'ID card',
    icon: 'credit-card',
    sides: ['front', 'back'],
    guideRatio: ID1_RATIO,
    extractWidth: ID1_W,
    extractHeight: ID1_H,
    // 'warp' applies to AUTO capture only — once the dwell/stability gate confirms a real aligned
    // card, perspective-flattening the detected quad is worth it. A MANUAL tap always crops the guide
    // box instead (see capture()), because the user expects the saved image to match exactly what they
    // framed in the preview, and edge-detection can't be trusted on a single ungated frame.
    captureMode: 'warp',
  },
  {
    id: 'passport',
    label: 'Passport',
    icon: 'e-passport',
    sides: ['front'],
    guideRatio: PASSPORT_RATIO,
    extractWidth: PASSPORT_W,
    extractHeight: PASSPORT_H,
    // A booklet can't be reliably edge-detected + warped (it curves, and the largest contour is
    // ambiguous), so capture the framed crop instead and lean on the manual shutter + relaxed gates.
    captureMode: 'frame',
    scanningMessage: "Scan the passport's details page",
    tuning: PASSPORT_TUNING,
  },
  {
    id: 'driving-licence',
    label: 'Driving licence',
    icon: 'car',
    sides: ['front'],
    guideRatio: ID1_RATIO,
    extractWidth: ID1_W,
    extractHeight: ID1_H,
    captureMode: 'warp',
    tuning: DRIVING_LICENCE_TUNING,
  },
  {
    id: 'address-card',
    label: 'Address card',
    icon: 'home',
    sides: ['front'],
    guideRatio: ID1_RATIO,
    extractWidth: ID1_W,
    extractHeight: ID1_H,
    captureMode: 'warp',
  },
];

export function getDocumentType(id: DocumentTypeId): DocumentTypeConfig {
  const config = DOCUMENT_TYPES.find((d) => d.id === id);
  if (!config) {
    throw new Error(`Unknown document type: ${id}`);
  }
  return config;
}

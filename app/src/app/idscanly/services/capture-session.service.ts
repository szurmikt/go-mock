import { Injectable, inject, signal } from '@angular/core';
import { CaptureQuality } from '../models/capture-quality';
import { DocumentTypeConfig, Side } from '../models/document-type';
import { ScanResultInterface } from '../../models/guest.interface';
import { BusyGuardService } from '../../services/busy-guard';
import { CaptureSource } from './document-detection.service';

export interface CapturedSide {
  side: Side;
  /** Full-resolution flattened/cropped capture — the real output handed off. */
  fullCanvas: HTMLCanvasElement;
  /** Full-resolution image as a data URL, for display on the Review screen. */
  fullDataUrl: string;
  /** Small downscaled copy for the tray slot. */
  thumbDataUrl: string;
  /** Quality verdict computed at capture time — drives the Review-screen feedback. */
  quality: CaptureQuality;
  /** Whether this side was captured via auto-detection or a manual shutter tap — feeds
   *  scan_succeeded's auto_capture_used at submit time. */
  source: CaptureSource;
}

/** Busy-guard key for the whole scan flow — see start()/reset()/clearScanResult(). */
const SCAN_BUSY_KEY = 'idscanly-scan';

/**
 * Holds the in-progress capture session across navigation (Scan -> Review -> GuestDetail).
 *
 * Also owns the scan flow's busy-guard claim, so a live-update reload can't discard captures
 * mid-scan. Held here rather than in the pages because these three methods already mark the
 * flow's real start and end points, across every exit path.
 */
@Injectable({ providedIn: 'root' })
export class CaptureSessionService {
  private readonly busyGuard = inject(BusyGuardService);

  readonly documentType = signal<DocumentTypeConfig | null>(null);
  readonly captures = signal<Map<Side, CapturedSide>>(new Map());

  /** Navigation context for the round-trip back to guest-detail. */
  readonly context = signal<{ reservationCode: string; guestId: string } | null>(null);

  /** Pending IDScanly scan result consumed by guest-detail on ionViewWillEnter. */
  readonly scanResult = signal<ScanResultInterface | null>(null);

  /** Whether the torch was turned on at any point this session — feeds scan_succeeded's
   *  flash_used. Session-scoped (not per-side): a flash toggled on for one side and off for
   *  the next still counts as "flash was used" for this scan. */
  private flashUsedInSession = false;

  /** When the current capture attempt started — feeds scan_succeeded's scan_duration_seconds. */
  private sessionStartedAt: number | null = null;

  markFlashUsed(): void {
    this.flashUsedInSession = true;
  }

  get flashUsed(): boolean {
    return this.flashUsedInSession;
  }

  /** Elapsed time since start() was last called, in whole seconds, or null if never started. */
  get elapsedSeconds(): number | null {
    return this.sessionStartedAt !== null
      ? Math.round((Date.now() - this.sessionStartedAt) / 1000)
      : null;
  }

  start(type: DocumentTypeConfig): void {
    this.busyGuard.acquire(SCAN_BUSY_KEY);
    this.documentType.set(type);
    this.captures.set(new Map());
    this.flashUsedInSession = false;
    this.sessionStartedAt = Date.now();
  }

  setSide(captured: CapturedSide): void {
    const next = new Map(this.captures());
    next.set(captured.side, captured);
    this.captures.set(next);
  }

  clearSide(side: Side): void {
    const next = new Map(this.captures());
    next.delete(side);
    this.captures.set(next);
  }

  getSide(side: Side): CapturedSide | undefined {
    return this.captures().get(side);
  }

  /**
   * Consumed by guest-detail once the result sheet has the scan — the flow's end point on the
   * success path, which never calls reset().
   */
  clearScanResult(): void {
    this.busyGuard.release(SCAN_BUSY_KEY);
    this.scanResult.set(null);
  }

  /** Abandonment path: scan-screen close, review-screen discard. */
  reset(): void {
    this.busyGuard.release(SCAN_BUSY_KEY);
    this.documentType.set(null);
    this.captures.set(new Map());
    this.context.set(null);
    this.scanResult.set(null);
    this.flashUsedInSession = false;
    this.sessionStartedAt = null;
  }
}

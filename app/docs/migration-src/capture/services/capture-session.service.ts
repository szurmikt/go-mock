import { Injectable, signal } from '@angular/core';
import { CaptureQuality } from '../models/capture-quality';
import { DocumentTypeConfig, Side } from '../models/document-type';

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
}

/**
 * Holds the in-progress capture session across navigation (Scan -> Review).
 *
 * Prototype keeps captures as in-memory canvases / data URLs — no disk writes, so
 * `Capacitor.convertFileSrc()` is not needed yet (see README if disk saving is added later).
 */
@Injectable({ providedIn: 'root' })
export class CaptureSessionService {
  readonly documentType = signal<DocumentTypeConfig | null>(null);
  /** Captured sides keyed by side. A signal so screens react to capture/retake. */
  readonly captures = signal<Map<Side, CapturedSide>>(new Map());

  start(type: DocumentTypeConfig): void {
    this.documentType.set(type);
    this.captures.set(new Map());
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

  reset(): void {
    this.documentType.set(null);
    this.captures.set(new Map());
  }
}

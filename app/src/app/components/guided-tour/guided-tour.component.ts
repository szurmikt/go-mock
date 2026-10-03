import { Component, OnInit, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface GuidedTourStep {
  id: string;
  titleKey: string;
  bodyKey: string;
  /** Resolved lazily, each time the step is shown (after a tick) — the target may only exist
   *  once the host has reacted to stepChange (e.g. the scan page's ghost Skip button). */
  anchor: () => HTMLElement | null | undefined;
  /** 'below' = card under the anchor, arrow up; 'above' = card over the anchor, arrow down. */
  placement: 'above' | 'below';
}

/**
 * First-run walkthrough: dark scrim, one callout card at a time pointing at a real element,
 * Next / Close, plus an always-rendered X. Extracted from the Scan page's onboarding so other
 * screens (My filters) can reuse it. The host owns the "seen" flag and decides when to render
 * this (`@if`) — the component starts at the first step when created and emits `closed` however
 * the tour ends (walked through, or dismissed via the X).
 */
@Component({
  selector: 'app-guided-tour',
  standalone: true,
  imports: [TranslatePipe, NgTemplateOutlet],
  templateUrl: './guided-tour.component.html',
  styleUrl: './guided-tour.component.scss',
})
export class GuidedTourComponent implements OnInit {
  readonly steps = input.required<GuidedTourStep[]>();
  /** Fired when the tour advances to another step (not for the first one — the host already
   *  knows it, and writing host state from here during creation would be a change-detection
   *  hazard). */
  readonly stepChange = output<string>();
  readonly closed = output<void>();
  /** Fired (just before `closed`) only when the user walks past the last step — not for the X. */
  readonly finished = output<void>();
  /** Label for the last step's button; defaults to "Close". */
  readonly finishLabelKey = input<string>('common.close');
  /** Where the X sits. 'bottom' for pages whose top-right corner is occupied by the very thing
   *  being explained (e.g. My filters' "+ New"). */
  readonly closePosition = input<'top' | 'bottom'>('top');

  readonly index = signal(0);
  readonly anchorRect = signal<{ top: number; left: number; width: number; height: number } | null>(null);
  readonly viewportWidth = signal(window.innerWidth);
  readonly viewportHeight = signal(window.innerHeight);

  /** Callout card width — see cardLeft(). */
  private static readonly CARD_WIDTH = 240;

  ngOnInit(): void {
    this.scheduleMeasure();
  }

  step(): GuidedTourStep | undefined {
    return this.steps()[this.index()];
  }

  isLast(): boolean {
    return this.index() >= this.steps().length - 1;
  }

  next(): void {
    if (this.isLast()) {
      this.finished.emit();
      this.close();
      return;
    }
    this.index.update(i => i + 1);
    this.stepChange.emit(this.step()!.id);
    this.scheduleMeasure();
  }

  close(): void {
    this.anchorRect.set(null);
    this.closed.emit();
  }

  /** Where to place a callout card so it's horizontally centered on the real anchor, clamped so
   *  it never runs off either edge of the viewport. Where the clamp kicks in (an anchor near a
   *  screen edge) the card stops following it — see arrowLeft() for how the arrow stays right. */
  cardLeft(anchor: { left: number; width: number }): number {
    const vw = this.viewportWidth();
    const width = GuidedTourComponent.CARD_WIDTH;
    const center = anchor.left + anchor.width / 2;
    return Math.min(Math.max(16, center - width / 2), vw - 16 - width);
  }

  /** Arrow x within the card (px from the card's left edge): tracks the anchor's true center
   *  even when cardLeft() was clamped, kept 24px inside the card's rounded corners. */
  arrowLeft(anchor: { left: number; width: number }): string {
    const cardWidth = GuidedTourComponent.CARD_WIDTH;
    const trueCenter = anchor.left + anchor.width / 2;
    const margin = 24;
    const x = Math.min(Math.max(trueCenter - this.cardLeft(anchor), margin), cardWidth - margin);
    return `${x}px`;
  }

  /** Deferred a tick — the step's target (and the host's reaction to stepChange) is only in the
   *  DOM once Angular flushes, so measuring synchronously would see the previous layout. */
  private scheduleMeasure(): void {
    this.anchorRect.set(null);
    setTimeout(() => this.measure(), 0);
  }

  private measure(): void {
    const el = this.step()?.anchor();
    if (!el) {
      this.anchorRect.set(null);
      return;
    }
    this.viewportWidth.set(window.innerWidth);
    this.viewportHeight.set(window.innerHeight);
    const rect = el.getBoundingClientRect();
    this.anchorRect.set({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }
}

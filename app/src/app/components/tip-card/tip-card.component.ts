import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TipCard } from '../../models/tip-card.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type TipCardVariant = 'home' | 'list';

/**
 * The ONE tip-card shell, shared by Home's carousel and the Help & Tips list — per the
 * Claude Design reference (project 8082e5d1-5847-4ef6-a2b2-c4c3940964e7, "Education
 * Cards.dc.html"): image on the left spanning the full card height (30% width), ~78px row
 * height, 1px border (this app's default `.card` — --card-border: 1px solid var(--line-strong)
 * — already matches that design exactly, so the shell just reuses `.card` rather than
 * inventing a new border style).
 *
 * The two variants differ only in the trailing affordance, which is a genuine per-context
 * difference, not a design deviation: `home` shows a dismiss X (Home-only action, absolute
 * top-right overlay, matching the reference's banner treatment); `list` shows a chevron +
 * optional unseen dot (matching the reference's list-row treatment — the Home carousel never
 * shows the dot, since every card there is unseen by definition).
 */
@Component({
  selector: 'app-tip-card',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './tip-card.component.html',
  // Without this, the <app-tip-card> host defaults to `display: inline` (the browser default
  // for any custom element with no stylesheet rule for it) — which ignores `height` entirely.
  // On the Help & Tips list this went unnoticed because each card sits as a direct child of a
  // `display: flex` column, where flex items are auto-"blockified" per spec regardless of their
  // own display value; on Home the card sits inside a plain (non-flex) wrapper div, where an
  // inline host can't receive the wrapper's explicit height at all and instead sizes itself
  // from its own content (the image), rendering visibly taller. `display: block` makes the
  // host participate in layout the same way in both places.
  styles: [':host { display: block; height: 100%; }'],
})
export class TipCardComponent {
  @Input({ required: true }) card!: TipCard;
  @Input() variant: TipCardVariant = 'list';
  @Input() unseen = false;
  @Output() open = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  onDismiss(event: Event): void {
    event.stopPropagation();
    this.dismiss.emit();
  }
}

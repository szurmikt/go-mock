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

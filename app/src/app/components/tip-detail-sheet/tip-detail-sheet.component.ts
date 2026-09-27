import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { MixpanelService } from '../../services/mixpanel';
import { TipsService } from '../../services/tips.service';
import { TipCard } from '../../models/tip-card.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { MarkdownLitePipe } from '../../pipes/markdown-lite.pipe';

type TipSheetSurface = 'home' | 'list';

/**
 * Card detail bottom sheet for the Help & tips feature. Opened imperatively from Home and
 * from the full Help & Tips list, each via their own `<app-tip-detail-sheet #tipSheet />`
 * instance — same pattern as FeedbackSheetComponent.
 */
@Component({
  selector: 'app-tip-detail-sheet',
  standalone: true,
  imports: [TranslatePipe, MarkdownLitePipe],
  templateUrl: './tip-detail-sheet.component.html',
})
export class TipDetailSheetComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private mixpanel = inject(MixpanelService);
  private tips = inject(TipsService);

  visible = signal(false);
  current = signal<TipCard | null>(null);
  feedback = signal<'up' | 'down' | null>(null);
  private surface: TipSheetSurface = 'home';

  readonly hasNext = computed(() => {
    const c = this.current();
    if (!c) return false;
    return this.tips.nextUnseenCard(this.auth.userId(), c.id) !== null;
  });

  open(card: TipCard, surface: TipSheetSurface): void {
    this.surface = surface;
    this.visible.set(true);
    this.showCard(card);
  }

  close(): void {
    this.visible.set(false);
    this.current.set(null);
  }

  /** Walks the full library, not just whatever subset this sheet was opened from — see
   *  TipsService.nextUnseenCard for why. Stays open, just swaps the displayed card. */
  next(): void {
    const c = this.current();
    if (!c) return;
    const nextCard = this.tips.nextUnseenCard(this.auth.userId(), c.id);
    if (nextCard) this.showCard(nextCard);
  }

  tryIt(): void {
    const c = this.current();
    if (!c?.action) return;
    const action = c.action;
    this.mixpanel.trackTipCardTryItTapped({ card_id: c.id, category: c.category });
    this.close();
    this.router.navigate([action.route], { queryParams: action.queryParams });
  }

  /** Mixpanel-only signal — no persisted "voted" state, the handoff doesn't ask for one. */
  giveFeedback(rating: 'up' | 'down'): void {
    const c = this.current();
    if (!c) return;
    this.feedback.set(rating);
    this.mixpanel.trackTipCardFeedback({ card_id: c.id, category: c.category, rating });
  }

  private showCard(card: TipCard): void {
    this.current.set(card);
    this.feedback.set(null);
    // Opening the sheet marks the card seen immediately, per the handoff — this is
    // deliberate even though it means "Next tip" consumes the library as you read; see
    // TipsService.nextUnseenCard's doc comment and the Home carousel's snapshot-on-visit
    // design (home.page.ts) for why that doesn't visibly disrupt the Home screen.
    this.tips.markSeen(this.auth.userId(), card.id, card.updatedAt);
    this.mixpanel.trackTipCardOpened({
      card_id: card.id,
      category: card.category,
      surface: this.surface,
    });
  }
}

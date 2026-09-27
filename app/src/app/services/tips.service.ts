import { Injectable, inject, signal } from '@angular/core';
import { Config } from '../config/config';
import { RemoteTipsService } from './remote-tips.service';
import { TipCard } from '../models/tip-card.interface';
import { StorageService } from './storage';

interface TipCardState {
  seen: boolean;
  dismissed: boolean;
  /** The card's `updatedAt` in effect when this record was written. Read-time comparisons
   *  against the card's *current* updatedAt are what makes an edited card resurface as
   *  unseen — see cardState() below. */
  updatedAt: string;
}

type UserTipState = Record<string, TipCardState>;
type TipStateStore = Record<string, UserTipState>;

/**
 * Feature education cards, fetched remotely (see RemoteTipsService, Supabase `tip_cards`
 * table — originally bundled with the app, see app/docs/feature-education-cards-handoff.md
 * for the feature's original design). Seen/dismissed state is local, keyed by userId — not
 * the device — so one person's "seen" never hides a card from a colleague on the same shared
 * front-desk device.
 *
 * Deliberately does not inject AuthService (avoids any DI-cycle risk, and mirrors
 * MixpanelService.identify(userId, ...)'s existing pattern of taking userId as a plain
 * parameter from the caller rather than reading it itself).
 */
@Injectable({ providedIn: 'root' })
export class TipsService {
  private store = signal<TipStateStore>({});
  private remoteTips = inject(RemoteTipsService);

  constructor(private storage: StorageService) {}

  async init(): Promise<void> {
    const stored = await this.storage.get<TipStateStore>(Config.STORAGE_TIP_STATE_KEY);
    if (stored) this.store.set(stored);
  }

  /**
   * The full remote library (see RemoteTipsService), unfiltered by seen/dismissed state —
   * this is the single feed for the Help & Tips list page, which is the recovery path for
   * anything dismissed from Home.
   */
  getCards(): TipCard[] {
    return this.remoteTips.cards();
  }

  /** Resets to a fresh (unseen, not dismissed) state whenever the stored record predates the
   *  card's current updatedAt — i.e. a real content edit makes the card resurface, while a
   *  typo fix that never bumps updated_at leaves the user's seen/dismissed state untouched. */
  private cardState(userId: string, cardId: string, updatedAt: string): TipCardState {
    const stored = this.store()[userId]?.[cardId];
    if (!stored || new Date(stored.updatedAt).getTime() < new Date(updatedAt).getTime()) {
      return { seen: false, dismissed: false, updatedAt };
    }
    return stored;
  }

  isSeen(userId: string, cardId: string, updatedAt: string): boolean {
    return this.cardState(userId, cardId, updatedAt).seen;
  }

  isDismissed(userId: string, cardId: string, updatedAt: string): boolean {
    return this.cardState(userId, cardId, updatedAt).dismissed;
  }

  /** Not seen and not dismissed, featured cards first (stable sort — otherwise preserves the
   *  server-side sort_order). Only used for Home's carousel source data; the list page always
   *  reads getCards() directly. */
  unseenCards(userId: string): TipCard[] {
    const cards = this.getCards().filter(
      c => !this.isSeen(userId, c.id, c.updatedAt) && !this.isDismissed(userId, c.id, c.updatedAt),
    );
    return [...cards].sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false));
  }

  homeCards(userId: string): TipCard[] {
    return this.unseenCards(userId).slice(0, 3);
  }

  /**
   * Walks the FULL library (not just Home's 3) in server sort_order, returning the first card
   * after `afterId` that isn't seen yet. Deliberately not scoped to whatever subset the sheet
   * was opened from — the handoff just says "next unseen card," and the sheet is opened from
   * both Home and the full list, so one consistent traversal order is simpler than two
   * different "next" behaviors depending on entry point.
   */
  nextUnseenCard(userId: string, afterId: string): TipCard | null {
    const cards = this.getCards();
    const idx = cards.findIndex(c => c.id === afterId);
    for (let i = idx + 1; i < cards.length; i++) {
      if (!this.isSeen(userId, cards[i].id, cards[i].updatedAt)) return cards[i];
    }
    return null;
  }

  async markSeen(userId: string, cardId: string, updatedAt: string): Promise<void> {
    if (!userId || this.isSeen(userId, cardId, updatedAt)) return;
    this.updateState(userId, cardId, updatedAt, { seen: true });
    await this.persist();
  }

  async dismiss(userId: string, cardId: string, updatedAt: string): Promise<void> {
    if (!userId) return;
    this.updateState(userId, cardId, updatedAt, { dismissed: true });
    await this.persist();
  }

  /** Debug-only: wipes this user's seen/dismissed history so every card reappears in Home's
   *  carousel and shows as unseen again — lets QA re-test the dismiss/seen flow on demand
   *  instead of needing a fresh install or a different account. Mirrors
   *  ScanOnboardingService.reset(). */
  async reset(userId: string): Promise<void> {
    if (!userId) return;
    this.store.update(s => {
      const { [userId]: _removed, ...rest } = s;
      return rest;
    });
    await this.persist();
  }

  private updateState(
    userId: string,
    cardId: string,
    updatedAt: string,
    patch: Partial<Pick<TipCardState, 'seen' | 'dismissed'>>,
  ): void {
    // cardState() itself resets a stale record to fresh (seen:false, dismissed:false) before
    // the patch is applied, so an edit-triggered resurface can't leak a pre-edit dismissed/seen
    // flag through a write that only touches the other flag.
    this.store.update(s => ({
      ...s,
      [userId]: {
        ...s[userId],
        [cardId]: { ...this.cardState(userId, cardId, updatedAt), ...patch, updatedAt },
      },
    }));
  }

  private persist(): Promise<void> {
    return this.storage.set(Config.STORAGE_TIP_STATE_KEY, this.store());
  }
}

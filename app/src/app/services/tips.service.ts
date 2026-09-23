import { Injectable, signal } from '@angular/core';
import { Config } from '../config/config';
import { TIP_CARDS } from '../data/tip-cards.data';
import { TipCard } from '../models/tip-card.interface';
import { StorageService } from './storage';

interface TipCardState {
  seen: boolean;
  dismissed: boolean;
}

type UserTipState = Record<string, TipCardState>;
type TipStateStore = Record<string, UserTipState>;

/**
 * Feature education cards, bundled with the app (see
 * app/docs/feature-education-cards-handoff.md). Seen/dismissed state is local, keyed by
 * userId — not the device — so one person's "seen" never hides a card from a colleague on
 * the same shared front-desk device.
 *
 * Deliberately does not inject AuthService (avoids any DI-cycle risk, and mirrors
 * MixpanelService.identify(userId, ...)'s existing pattern of taking userId as a plain
 * parameter from the caller rather than reading it itself).
 */
@Injectable({ providedIn: 'root' })
export class TipsService {
  private store = signal<TipStateStore>({});

  constructor(private storage: StorageService) {}

  async init(): Promise<void> {
    const stored = await this.storage.get<TipStateStore>(Config.STORAGE_TIP_STATE_KEY);
    if (stored) this.store.set(stored);
  }

  /**
   * The full bundled library, unfiltered by seen/dismissed state — this is the single feed
   * for the Help & Tips list page, which is the recovery path for anything dismissed from
   * Home. Condition-based gating (role/platform/feature-toggle) is not implemented yet; no
   * seed card sets `condition`, so this is currently a no-op pass-through.
   */
  getCards(): TipCard[] {
    return TIP_CARDS;
  }

  private cardState(userId: string, cardId: string): TipCardState {
    return this.store()[userId]?.[cardId] ?? { seen: false, dismissed: false };
  }

  isSeen(userId: string, cardId: string): boolean {
    return this.cardState(userId, cardId).seen;
  }

  isDismissed(userId: string, cardId: string): boolean {
    return this.cardState(userId, cardId).dismissed;
  }

  /** Not seen and not dismissed, featured cards first (stable sort — otherwise preserves the
   *  authored "newest first" array order from tip-cards.data.ts). Only used for Home's carousel
   *  source data; the list page always reads getCards() directly. */
  unseenCards(userId: string): TipCard[] {
    const cards = this.getCards().filter(
      c => !this.isSeen(userId, c.id) && !this.isDismissed(userId, c.id),
    );
    return [...cards].sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false));
  }

  homeCards(userId: string): TipCard[] {
    return this.unseenCards(userId).slice(0, 3);
  }

  /**
   * Walks the FULL library (not just Home's 3) in authored order, returning the first card
   * after `afterId` that isn't seen yet. Deliberately not scoped to whatever subset the sheet
   * was opened from — the handoff just says "next unseen card," and the sheet is opened from
   * both Home and the full list, so one consistent traversal order is simpler than two
   * different "next" behaviors depending on entry point.
   */
  nextUnseenCard(userId: string, afterId: string): TipCard | null {
    const cards = this.getCards();
    const idx = cards.findIndex(c => c.id === afterId);
    for (let i = idx + 1; i < cards.length; i++) {
      if (!this.isSeen(userId, cards[i].id)) return cards[i];
    }
    return null;
  }

  async markSeen(userId: string, cardId: string): Promise<void> {
    if (!userId || this.isSeen(userId, cardId)) return;
    this.updateState(userId, cardId, { seen: true });
    await this.persist();
  }

  async dismiss(userId: string, cardId: string): Promise<void> {
    if (!userId) return;
    this.updateState(userId, cardId, { dismissed: true });
    await this.persist();
  }

  private updateState(userId: string, cardId: string, patch: Partial<TipCardState>): void {
    this.store.update(s => ({
      ...s,
      [userId]: {
        ...s[userId],
        [cardId]: { ...this.cardState(userId, cardId), ...patch },
      },
    }));
  }

  private persist(): Promise<void> {
    return this.storage.set(Config.STORAGE_TIP_STATE_KEY, this.store());
  }
}

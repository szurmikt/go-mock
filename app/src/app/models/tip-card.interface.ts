export interface TipCardAction {
  route: string;
  queryParams?: Record<string, string>;
}

// Remote content (Supabase `tip_cards` table) — see RemoteTipsService. title/summary/body/
// actionLabel are already resolved to the current app language by the time a TipCard reaches
// a component; there is no translation *key* to look up anymore, unlike the old bundled
// TIP_CARDS (removed) which went through the `tr` pipe against static translation files.
export interface TipCard {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  image: string;
  /** Resolved "Try it" button label for the current language — present only when `action` is. */
  actionLabel?: string;
  action?: TipCardAction;
  featured?: boolean;
  /** The row's `updated_at` at fetch time — TipsService compares this against what was in
   *  effect when a user last saw/dismissed the card, so a real content edit (not a typo fix
   *  that leaves updated_at alone) makes the card resurface as unseen. */
  updatedAt: string;
}

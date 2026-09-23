export interface TipCardAction {
  labelKey: string;
  route: string;
  queryParams?: Record<string, string>;
}

export interface TipCard {
  id: string;
  category: string;
  titleKey: string;
  summaryKey: string;
  bodyKey: string;
  image: string;
  featured?: boolean;
  // Documentation only ("which release introduced it") — not read by any sort/filter/gating
  // logic. Kept as a plain field so a future pass can add real recency-based sorting without
  // a data-model change; do not assume it does anything today.
  bundleVersion?: string;
  action?: TipCardAction;
  // Reserved for future role/platform/feature-toggle gating — no seed card sets it, and
  // TipsService.getCards() does not evaluate it. Do not assume it filters anything yet.
  condition?: string;
}

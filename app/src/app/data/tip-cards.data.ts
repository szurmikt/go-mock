import { TipCard } from '../models/tip-card.interface';

// Bundled with the app, not server-hosted (see app/docs/feature-education-cards-handoff.md) —
// a card describes a feature that ships in the SAME bundle, so the two must move together.
// Read this only through TipsService.getCards(); don't import it anywhere else.
//
// Authored newest-first: array order IS the "newest first" ordering TipsService sorts by
// (alongside featured-first) — no date parsing, no separate sort key.
export const TIP_CARDS: TipCard[] = [
  {
    id: 'auto-lock',
    category: 'security',
    titleKey: 'helpTips.cardAutoLockTitle',
    summaryKey: 'helpTips.cardAutoLockSummary',
    bodyKey: 'helpTips.cardAutoLockBody',
    image: 'assets/tips/lock.svg',
    featured: true,
    bundleVersion: '1.0.7',
    action: {
      labelKey: 'helpTips.cardAutoLockAction',
      route: '/settings',
      queryParams: { open: 'autoLock' },
    },
  },
  {
    id: 'language',
    category: 'general',
    titleKey: 'helpTips.cardLanguageTitle',
    summaryKey: 'helpTips.cardLanguageSummary',
    bodyKey: 'helpTips.cardLanguageBody',
    image: 'assets/tips/globe.svg',
    bundleVersion: '1.0.7',
    action: {
      labelKey: 'helpTips.cardLanguageAction',
      route: '/settings',
      queryParams: { open: 'language' },
    },
  },
  {
    id: 'search',
    category: 'general',
    titleKey: 'helpTips.cardSearchTitle',
    summaryKey: 'helpTips.cardSearchSummary',
    bodyKey: 'helpTips.cardSearchBody',
    image: 'assets/tips/search.svg',
    bundleVersion: '1.0.7',
    action: {
      labelKey: 'helpTips.cardSearchAction',
      route: '/search',
    },
  },
  {
    id: 'open-in-pms',
    category: 'general',
    titleKey: 'helpTips.cardOpenInPmsTitle',
    summaryKey: 'helpTips.cardOpenInPmsSummary',
    bodyKey: 'helpTips.cardOpenInPmsBody',
    image: 'assets/tips/pms.svg',
    bundleVersion: '1.0.5',
    // No action — the feature is automatic (no destination to open), per the handoff's rule
    // that only stable, non-record-specific destinations get a "Try it" button.
  },
  {
    id: 'id-scan',
    category: 'scanning',
    titleKey: 'helpTips.cardIdScanTitle',
    summaryKey: 'helpTips.cardIdScanSummary',
    bodyKey: 'helpTips.cardIdScanBody',
    image: 'assets/tips/id-card.svg',
    bundleVersion: '1.0',
    // No action — the scan entry point is guest-specific, so there's no stable destination to
    // deep-link to, per the same handoff rule as above.
  },
];

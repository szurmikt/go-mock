# Implementation handoff: Feature education cards (Help & tips)

## What we're building

A library of feature education cards shipped with the app. Home shows up to 3 unseen cards; Settings → Help & tips lists all of them; tapping a card opens a bottom sheet with detail and a deep link into the feature.

**Why:** updates install silently, so staff never see release notes, and existing features (auto-lock, task snooze, etc.) go unnoticed. The cards replace an earlier idea of an update popup — updates stay silent.

Designs for all four screens are attached (Home, card detail sheet, Settings, Help & tips list).

## Data model

Cards are **bundled with the app**, not server-side. A card describes a feature that ships in the same bundle, so the two must move together — a server-hosted card could appear on a device that doesn't have the feature yet. Live updates already let us publish a new card within hours without store approval.

Store as a JSON array in the app, one entry per card:

```ts
interface TipCard {
  id: string;              // stable, used for seen/dismissed state
  category: string;        // 'security' | 'checkin' | 'tasks' | 'housekeeping' | ...
  titleKey: string;        // i18n keys, not literal strings
  summaryKey: string;
  bodyKey: string;
  image: string;           // asset path
  featured?: boolean;      // shows the NEW badge
  bundleVersion?: string;  // which release introduced it
  action?: {               // the "Try it" deep link
    labelKey: string;
    route: string;         // e.g. '/settings/auto-lock'
  };
  condition?: string;      // optional visibility flag (role, platform, feature toggle)
}
```

**Keep the loading seam clean.** Read the cards through a single service (e.g. `TipsService.getCards()`) with the local JSON behind it. If we later move content to Supabase, only that service changes. Do not scatter imports of the JSON across components.

Card text goes through the **existing i18n pipeline** like any other app copy.

## State

Seen/dismissed state is **local, keyed by user ID** — not per device. GO runs on shared front-desk devices, so one person's "seen" must not hide a card from a colleague. No server is involved.

Track per card: `seen` (detail sheet was opened) and `dismissed` (X tapped on Home).

## Screens

### 1. Home section

- Section renders **below the stats/arrivals content, not above it**. A tip must never push today's arrivals down — operational content keeps visual priority. (The mockup shows it above the Yesterday/Today/Tomorrow control; move it down.)
- Shows up to **3 cards the user hasn't seen or dismissed**, newest first, `featured: true` first.
- Horizontal swipeable carousel with page dots, as in the design.
- Each card: image, title, optional NEW badge, one-line summary, X to dismiss.
- **X dismisses that one card only**, not the section.
- "See all tips" link → Help & tips.
- When nothing is unseen, **the whole section is hidden** — no empty state, no placeholder.
- The floating tab bar overlays content, so keep the existing bottom padding rules intact.

### 2. Card detail (bottom sheet)

- Opens from Home or from the Help & tips list.
- **Sheet sizes to its content.** Don't open near full height for a 3-line body (the mockup has a large empty area).
- Order: image, title, body text.
- **Optional "Try it" deep link**, e.g. "Open auto-lock setting" → navigates to the feature and closes the sheet. Most cards won't have one. When present it's the only action in the sheet, so style it as the main button there.
- The deep link **only applies to features with a stable destination**, mainly Settings screens. Features that act on a specific record — changing a reservation status, adding a comment — have no destination we can pick, since we can't know which reservation to open. Those cards describe the flow in the body text and render with no button.
- Thumbs up/down feedback sits at the bottom, below the deep link when there is one.
- "Next tip →" moves to the next unseen card without closing.
- Opening the sheet marks the card `seen`.

### 3. Settings

- Add "Help & tips" under the APP group, as designed.
- Move "Reset Scan Tour" into Help & tips — it belongs to the same learning surface.

### 4. Help & tips list

- Full screen, reached from Settings.
- Search field plus category filter chips.
- Cards grouped by category.
- **One unread convention only:** a blue dot for unseen cards; the NEW badge only for cards from a recent release. A card can have both.
- **Never fade an unseen card.** In the mockup the NEW card is rendered faded — seen cards are the quieter ones, unseen stay full contrast. Seen cards must remain fully usable.

## Analytics (Mixpanel)

Track: card shown on Home, card opened, "Try it" tapped, card dismissed, thumbs up/down. We want to know whether the education actually changes behaviour — e.g. whether more users change the auto-lock setting after seeing that card.

## Out of scope

- Server-hosted card content (revisit when non-developers need to publish, or when targeting by property/role is needed)
- A/B testing card copy
- Update prompts or "what's new" popups — updates stay silent

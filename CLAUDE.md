# SabeeApp Go — Design Prototype · Project Brief

> **Read this file at the start of every session.** It is the single source of truth for project context, design decisions, and current state. No additional explanation from the user should be needed to continue work.
>
> After making significant changes, update the Changelog and any stale sections before ending the session.
>
> **Scope:** this file documents the `design/` prototype only (the standalone, no-backend HTML/React mockup) and lives inside that folder — it is not read automatically from a session started at the repo root. For the real shipping app (`app/`, Ionic + Angular), see `../app/CLAUDE.md` — that file has its own complete, continuous changelog, including the Angular app's earlier history that used to be logged here. This file used to sit at the repo root, mixed in with app-level and repo-level concerns despite being entirely about the prototype; it moved here so prototype work stays self-contained in its own folder.

---

## 1. Project Overview

**SabeeApp Go** is a mobile-first hotel management app for property managers and front-desk staff. The goal is a native-quality iOS PWA prototype built in pure HTML/CSS/React — no bundler, no backend — that can be opened directly as a `file://` URL on a phone or desktop browser.

**Who it's for:** Hotel managers who manage one or more properties. They use the app to:
- See today's arrivals at a glance (guest list, counts, status)
- Check in / check out guests
- Scan guest travel documents (ID/passport via camera)
- View and search reservations
- Manage guest personal details (edit guest info)
- Block dates on the calendar
- Switch between managed properties

**What problem it solves:** A lightweight mobile companion to SabeeApp PMS (the main web-based property management system). Account management, billing, and complex configuration stay in the PMS; daily front-desk operations happen here.

**Current state:** Interactive prototype covering the core flows. All data is hardcoded. No network calls, no authentication backend.

**Version 1 scope note:** The first backend release will NOT support the full feature set. The Home screen has been simplified accordingly — it shows the arrivals list directly (merged from a separate Arrivals screen) rather than the original dashboard tiles (Occupancy, ADR, RevPar, Feedback). The original home screen is preserved in `home-screen-old.js`.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| UI framework | React 18 (UMD) | No build step needed; loaded from unpkg CDN |
| JSX transform | Babel Standalone | Transpiles JSX in the browser at runtime |
| Styling | Plain CSS (`styles.css`) | Single file, no Sass/PostCSS needed |
| Build tool | `build.py` (Python 3) | Inlines all JS files as `<script type="text/babel">` blocks into `index.html` |
| Fonts | Nunito via Google Fonts (preconnect) | Rounded, friendly — well-suited for hospitality |
| Icons | Inline SVG components (`icons.js`) | Zero external requests, themeable via `color: currentColor` |
| Signature capture | [`signature_pad`](https://github.com/szimek/signature_pad) (UMD, unpkg CDN) | Only non-React runtime dependency; used by `signature-screen.js` for the Check-in & Accepting T&C flow |

**How the build works:**
1. Edit source files (`.js`, `.jsx`, `.css`)
2. Run `python3 build.py` from the Design directory
3. `build.py` reads each file in `SCRIPT_ORDER`, wraps it in `<script type="text/babel">`, and writes `index.html`
4. Open `index.html` directly in a browser — works as `file://` URL, no server needed
5. `styles.css` is linked by relative path and is **not** inlined — CSS edits take effect without rebuilding

**`SCRIPT_ORDER` in `build.py` (order matters — globals must be defined before use):**
```
icons.js → data.js → login-screen.js → property-screen.js →
home-screen.js → arrivals-screen.js → calendar-screen.js → tasks-screen.js →
detail-screens.js → signature-screen.js → tweaks-panel.jsx → app.js
```

**HTML meta tags in `build.py`:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```
- `viewport-fit=cover` — content extends under iOS notch/home indicator
- `interactive-widget=resizes-visual` — keyboard overlays content on Android/Chrome instead of resizing layout
- `apple-mobile-web-app-capable` — enables PWA mode when added to home screen
- `black-translucent` — in PWA mode: status bar is transparent with adaptive icons; dark overlay shows through it during modals

---

## 3. File Structure

```
Design/
├── build.py               # Build script: inlines JS → index.html. Edit SCRIPT_ORDER here.
├── index.html             # OUTPUT — never edit manually; always run python3 build.py
├── styles.css             # All CSS — design tokens, layout, components, animations
│
├── icons.js               # SVG icon library (global `I`), StatusBar, Pill, Toast atoms
├── data.js                # Hardcoded data: RESERVATIONS, ROOMS, BLOCKS, GUESTS, SERVICES, FINANCES, PROPERTIES
│
├── login-screen.js        # LoginScreen + MFAScreen
├── property-screen.js     # PropertySelectScreen (post-login mandatory property chooser)
├── home-screen.js         # HomeScreen (merged arrivals view) + Segment + ReservationCard
├── home-screen-old.js     # BACKUP of original home screen (tiles, occupancy, ADR, RevPar)
│                          #   NOT in SCRIPT_ORDER — never built, kept for reference only
├── arrivals-screen.js     # ArrivalsScreen (dormant) + ReservationDetailScreen
├── calendar-screen.js     # CalendarScreen — full-bleed room×date Gantt grid, 2nd tab bar item
├── tasks-screen.js        # TasksScreen + BriefingScreen, 3rd tab bar item
├── detail-screens.js      # GuestDetailScreen + EditGuestScreen + SearchScreen + IDScanScreen
│                          #   Also contains Row, Tiny, SectionTitle helper components
├── signature-screen.js    # CheckinSignScreen (Check-in & Accepting T&C) + SignatureCaptureScreen
│                          #   Full-screen overlays rendered from ReservationDetailScreen, not routed
│
├── tweaks-panel.jsx       # TweaksPanel + useTweaks hook + all Tweak* controls (reusable utility)
└── app.js                 # App root: stack navigation, PageTransitions, BlockDateScreen, BottomNav
```

**Globals exposed via `window.*`** — each file sets these; later files read them as globals:

| File | Exposes |
|---|---|
| `icons.js` | `I`, `StatusBar`, `Pill`, `Toast` |
| `data.js` | `RESERVATIONS`, `ROOMS`, `BLOCKS`, `BRIEFING_ITEMS`, `TASKS`, `GUESTS`, `SERVICES`, `FINANCES`, `PROPERTIES` |
| `login-screen.js` | `LoginScreen`, `MFAScreen` |
| `property-screen.js` | `PropertySelectScreen` |
| `home-screen.js` | `Segment`, `ReservationCard`, `HomeScreen` |
| `arrivals-screen.js` | `ArrivalsScreen`, `ReservationDetailScreen` |
| `calendar-screen.js` | `CalendarScreen` |
| `tasks-screen.js` | `TasksScreen`, `BriefingScreen` |
| `detail-screens.js` | `GuestDetailScreen`, `EditGuestScreen`, `SearchScreen`, `IDScanScreen` |
| `signature-screen.js` | `CheckinSignScreen` (`SignatureCaptureScreen` stays file-local, not exported — only `CheckinSignScreen` uses it) |
| `tweaks-panel.jsx` | `useTweaks`, `TweaksPanel`, `TweakSection`, `TweakRadio`, `TweakSlider`, etc. |

**Note on `Segment` and `ReservationCard`:** These were originally in `arrivals-screen.js` but moved to `home-screen.js` when the screens were merged. `home-screen.js` loads before `arrivals-screen.js` in SCRIPT_ORDER, so `ArrivalsScreen` references them as `window.Segment` / `window.ReservationCard`.

---

## 4. Design System

### Color Tokens (defined in `:root`, `styles.css`)

```css
/* Brand */
--primary:         rgb(0, 142, 255)         /* blue — CTAs, accents, icons */
--primary-strong:  rgb(0, 113, 202)         /* hover/press state */
--primary-soft:    rgb(190, 219, 255)       /* soft borders */
--primary-soft-bg: rgba(239, 246, 255, 0.6) /* tinted card backgrounds */

/* Text */
--ink:   rgb(20, 35, 46)      /* primary text, headings */
--ink-2: rgb(60, 60, 60)      /* secondary headings */
--ink-3: rgb(108, 117, 125)   /* meta text, labels */
--ink-4: rgb(146, 146, 146)   /* placeholders, disabled, captions */

/* Surfaces */
--bg:          rgb(249, 250, 251)  /* page background */
--surface:     #ffffff             /* cards, inputs, sheets */
--line:        rgb(233, 236, 239)  /* light dividers */
--line-strong: rgb(183, 183, 183)  /* card borders */

/* Semantic */
--success:      rgb(13, 207, 151)   /* positive metrics, check-in status */
--success-soft: rgb(231, 249, 245)
--warn:         rgb(251, 110, 139)  /* negative metrics, errors */
--warn-soft:    rgb(255, 232, 237)
```

### Spacing Tokens

```css
--pad:      16px   /* page horizontal padding (14px in compact) */
--gap:      16px   /* grid/stack gaps (12px in compact) */
--card-pad: 16px   /* card internal padding (12px in compact) */
```

**Rule:** All layout margins/paddings use these tokens. Never hardcode `16px` for layout spacing — the density toggle switches all three tokens.

### Border Radius

```css
--radius:    14px   /* cards, sheets */
--radius-sm: 10px   /* buttons, inner containers, stat cards */
--radius-xs:  6px   /* pills, badges, icon backgrounds */
```

### Typography

Font: `Nunito` (weights 400, 600, 700, 800). Heavy use of `font-weight: 800` for headings and key values.

```css
--font-xs:   12px   /* badges, document IDs, micro captions */
--font-sm:   15px   /* labels, meta text, captions, error messages */
--font-base: 16px   /* body, .res-meta / .res-email, secondary text */
--font-md:   17px   /* standard UI text, .fact-value, sheet field values */
--font-lg:   18px   /* sheet .field .v / fact-grid value rows */
--font-xl:   22px   /* card titles, section titles, sheet headers */
```

Two deliberate off-scale literals survive (with a comment in the SCSS where they appear):
- **16px** on form/search inputs ([sabeeapp-design.scss:222-223](app/src/theme/sabeeapp-design.scss#L222-L223)) — iOS WKWebView zooms in on focus if a field is below 16px
- **19px** on `.detail-value` — the prominent value display in ID-scan results and guest detail rows; one class, one size

Plus a handful of intentional one-offs not in the scale: 11px (`.pill.home-test-pill`, `.nav-item`), 20px (`.otp-sep`, tile `h3`), 24px (`.sub-header h1`, `.otp-digit`), 28px (property-select header), 32px (`.scan-screen .not-processed`).

OS font scaling is disabled globally:
```css
html, body { -webkit-text-size-adjust: none; text-size-adjust: none; }
```

### Shadow Tokens

```css
--shadow-sm:  0 1px 3px rgba(0,0,0,.08)
--shadow-md:  0 2px 8px rgba(0,0,0,.10)
--shadow-lg:  0 4px 20px rgba(0,0,0,.12)
--shadow-fab: 0 6px 24px rgba(0,142,255,0.45), 0 2px 6px rgba(0,142,255,0.3)
```

### Card Style Variants (`[data-card]` on `.app-window`)

Toggled via the Tweaks Panel — all card elements use the same token set:

```css
/* outlined (default) */  --card-bg: #fff;  --card-border: 1px solid var(--line-strong);  --card-shadow: none;
/* soft */                --card-bg: rgb(246,247,251); --card-border: transparent; --card-shadow: none;
/* elevated */            --card-bg: #fff;  --card-border: 1px solid rgba(0,0,0,0.04); --card-shadow: <multi-layer>;
```

`.card` and `.guest-card` both reference `var(--card-bg)`, `var(--card-border)`, `var(--card-shadow)`.

### Status Pill Variants (`[data-pill]` on `.app-window`)

Three modes: `soft` (default), `solid`, `outline`. Each status value has its own `--pill-color` and `--pill-soft`:

| Status | Color |
|---|---|
| `onboard` | blue-teal `rgb(13,160,200)` |
| `check-in` | green `rgb(13,180,140)` |
| `check-out` | orange `rgb(255,140,40)` |
| `confirmed` | purple `rgb(120,90,255)` |
| `open` | grey `rgb(108,117,125)` |

### Density Variants (`[data-density]` on `.app-window`)

- `comfy` (default): `--pad: 16px`, `--gap: 16px`, `--card-pad: 16px`
- `compact`: `--pad: 14px`, `--gap: 12px`, `--card-pad: 12px`

### Icon Usage

All icons in the `I` object (`icons.js`). Use as JSX:
```jsx
<I.Bell />
<I.ChevronDown style={{ width: 22, height: 22, color: "var(--primary)" }} />
```
Icons use `stroke="currentColor"` (outline) or `fill="currentColor"` (filled variants like `I.HomeFill`, `I.GridFill`). Color is set via the CSS `color` property.

**Full icon list:** `Search`, `Bell`, `Settings`, `ChevronDown`, `ChevronBack`, `ChevronRight`, `Scan`, `Calendar`, `ArrowIn`, `ArrowOut`, `Users`, `Bars`, `Comment`, `Filter`, `Home`, `HomeFill`, `Grid`, `GridFill`, `IDCard`, `Phone`, `Phone2`, `Mail`, `Briefcase`, `Door`, `Check`, `Plus`, `X`, `Bolt`, `Edit`, `Send`

### Safe Area Rules

**CRITICAL:** Always write `env()` directly in property values — never inside a CSS custom property. A WebKit bug prevents `env()` from resolving correctly when nested in `var()` on some iOS versions.

```css
/* CORRECT */
padding-bottom: env(safe-area-inset-bottom, 8px);
padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));

/* BROKEN on some iOS — do NOT do this */
--safe-pad: env(safe-area-inset-bottom, 8px);
padding-bottom: var(--safe-pad);
```

**Current safe area values in use:**

| Location | Value | Reason |
|---|---|---|
| `.sheet` padding-bottom | `env(safe-area-inset-bottom, 8px)` | Clears home indicator; no extra base pixels |
| `.action-item:last-of-type` padding-bottom | `8px` | Tighter wrap on last action (was 14px both sides) |
| `.fab` bottom | `calc(16px + env(safe-area-inset-bottom, 0px))` | Positions FAB above home indicator |
| `GuestDetailScreen` scroll padding-bottom | `calc(80px + env(safe-area-inset-bottom, 0px))` | Keeps content above FAB |
| `.page` padding-top | `env(safe-area-inset-top, 0px)` | PWA mode: pushes content below transparent status bar |
| `.login-page` padding-top | `env(safe-area-inset-top, 0px)` | Same as above for login screens |
| Most scroll areas | `calc(24px + env(safe-area-inset-bottom, 0px))` | Standard scroll content clearance |
| `.login-footer` | `calc(32px + env(safe-area-inset-bottom, 0px))` | Login screen footer clearance |

### Viewport Height

```css
.app-window {
  height: 100vh;    /* fallback */
  height: 100svh;   /* iOS 16+: stays constant when keyboard appears */
}
```
`100svh` (small viewport height) does not change when the soft keyboard opens, preventing layout jumps.

### App Shell Structure

```
<body> (background: #0b1220 dark)
  #root
    .app-stage (position: fixed; inset: 0; dark gradient bg)
      .app-window (max 440px wide, 100svh tall, flex column, overflow hidden)
        div[position: relative; flex: 1; overflow: hidden]
          PageTransitions → .page screens
          .toast-stack
        BottomNav (floating pill, visible only on the 4 root tab screens)
    TweaksPanel (position: fixed, outside app-window)
```

The `.sheet-backdrop` uses `position: fixed; inset: 0` (not `absolute`) so it covers the full viewport, including the safe-area-inset-top region, maximising overlay coverage.

---

## 5. Screens & Components

### Navigation Model (`app.js`)

Stack-based navigation:
- `stack` — array of `{ name, payload? }` objects; `top = stack[stack.length - 1]`
- `go(name, payload)` — push screen (forward slide)
- `back()` — pop screen (back slide)
- `setRootTab(name)` — replace full stack with `[{ name }]` (tab ids equal screen names)

Page transitions: 320ms slide right (forward) / slide left (back), cubic-bezier(0.32, 0.72, 0, 1).

**Bottom tab bar (`BottomNav`, floating pill):** 4 root tabs — `home`, `calendar`, `tasks`, `ai`. `showNav = ROOT_TABS.includes(top.name)` in `app.js`, so the bar only appears on these 4 screens and hides once you drill into any pushed/modal screen (reservation, guest, search, ID scan, block date, …). `tasks` and `ai` currently render a shared `PlaceholderScreen` ("Coming soon") — no flows designed yet.

**Full routing in `renderScreen`:**
```
login → property → home
mfa → property → home
home → search / reservation / idscan / blockdate
calendar → reservation / (in-place block-date sheet)
reservation → guest → editguest / idscan
```

### Auth Flow: Login → MFA → Property Select → Home

#### `LoginScreen` (`login-screen.js`)
- Language dropdown top-right: EN, HU, DE, TR, FR, LV, ES (cosmetic only)
- Floating-label email + password fields
- "Sign in" with 600ms fake delay + spinner
- **Valid credentials:** `tamas@szurmik.com` / `password` → MFA screen
- **Wrong credentials:** error bottom sheet
- **Both fields empty + Sign in:** skips auth, goes straight to PropertySelect (developer cheat)
- Footer text: "Account management is handled through your SabeeApp PMS"

#### `MFAScreen` (`login-screen.js`)
- 6 individual `type="tel" inputMode="numeric"` boxes in two groups of 3 (separated by `·`)
- Auto-advance on each digit entry
- **Auto-submits** on 6th digit — no separate Verify button
- Paste support on first box: pastes full 6-digit code + auto-submits
- On wrong code: shake CSS animation + clears all boxes + re-focuses first box
- **Auto-focus:** `useEffect` with 350ms `setTimeout` — avoids losing iOS gesture context during the 320ms slide-in animation (the reason `autoFocus` prop doesn't work here)
- **Valid OTP:** `444555`

#### `PropertySelectScreen` (`property-screen.js`)
- Mandatory screen after login; no back button
- Lists all 3 PROPERTIES as tappable cards (`I.Home` icon + name + type + `I.ChevronRight`)
- Selecting sets `property` state in App and replaces stack with `[{ name: "home" }]`

### `HomeScreen` (`home-screen.js`) — merged Arrivals view

This screen is the merged result of the original Home + Arrivals screens. The original home screen dashboard (tiles, occupancy, metrics) was removed for v1 because the backend won't support it.

**Layout (top to bottom):**
1. **`.page-header`** — property name (tappable → property switcher sheet) with `I.ChevronDown` in primary blue; Bell + Settings icon buttons (cosmetic)
2. **Property switcher sheet** (conditional) — `sheet-backdrop` with list of all PROPERTIES as `action-item` rows; active property shows a small blue dot
3. **Search field** — tappable placeholder (outside scroll, always visible); navigates to SearchScreen
4. **`.app-scroll`** (scrolls):
   - `Segment` — Yesterday / Today / Tomorrow tabs
   - `.stat-block` — two stat cards: Guests (23/56), Reservations (6/17)
   - `.section-title` — `{tab}'s Arrivals` heading + Filter icon button (cosmetic)
   - Staggered list of `ReservationCard` components from `RESERVATIONS`

**State:** `switchOpen` (property sheet), `tab` (day segment)
**Navigation:** each `ReservationCard` → `go("reservation", r.id)`

#### `Segment` component (`home-screen.js`)
Animated sliding segment control. Uses `IntersectionObserver` on button refs to position the animated thumb via `offsetLeft`/`offsetWidth`. Exported as `window.Segment`.

#### `ReservationCard` component (`home-screen.js`)
```jsx
<ReservationCard r={reservation} onClick={fn} dimmed={bool} />
```
Shows: reservation code (blue), status pill, guest name, email, date/guests/nights, room type. `dimmed` applies `opacity: 0.5` for non-today "open" reservations. Uses classes `card res-card tap-anim tappable`. Exported as `window.ReservationCard`.

### `CalendarScreen` (`calendar-screen.js`)

Full-bleed room × date Gantt grid — 2nd tab bar item. Prototype of the room-calendar UX discussed with the user: a frozen-pane grid (like the desktop PMS calendar) panned with a single drag gesture in any direction on mobile, rather than separate horizontal/vertical scrollbars.

**Data model** (`data.js`): the calendar assumes the real API will hand the app a flat room list — `ROOMS: [{ id, type, name, maxOccupancy, housekeeping? }]` — no separate room-types table. `housekeeping` is one of `clean | dirty | progress | supervision`, shown as a colored dot after the room name — it's **optional**: service rooms like `Parking` carry no `housekeeping` field at all (they aren't cleaned), and the dot is simply omitted wherever a room lacks one (both the room-list row and the tap-to-expand popover check `room.housekeeping` before rendering it). Rooms are grouped by `type` purely for the calendar's group headers (preserves array order, no explicit sort). `RESERVATIONS` entries carry additive `roomId` / `startDate` / `endDate` (ISO, exclusive end) fields; a reservation occupies nights `[startDate, endDate)`. `BLOCKS: [{ id, roomId, startDate, endDate }]` holds owner-created blocked ranges (grey diagonal-stripe bars). All demo dates are generated relative to `new Date()` at load time (`relDate(offsetDays)` in `data.js`) — built from **local** date parts (`getFullYear`/`getMonth`/`getDate`), not `toISOString()`, which converts to UTC first and silently shifts the date back a day in any timezone ahead of UTC (e.g. CEST); `calIso()` in `calendar-screen.js` has the same fix for the same reason. `ROOMS` is intentionally kept small (~18 rooms) — trimmed down from an earlier 25-room stress-test set, keeping every room id that `RESERVATIONS`/`BLOCKS` actually reference plus a couple of spares per type for variety.

**Row model — real per-section sticky headers, not scroll:** the grid is pointer-driven (JS pans via `transform`, not native scroll), so CSS `position: sticky` doesn't apply. `calBuildRows(rooms, collapsed)` in `calendar-screen.js` builds a flat `rowList` that interleaves a `{ kind: "header", type, y, height }` row before each room-type's rooms (skipping that type's room rows entirely when collapsed), each carrying its cumulative vertical offset — this list is the single source of truth for every row's position, used both for rendering and for hit-testing taps. On top of that, a *sticky-with-push* effect is computed by hand each render: `activeHeader` is the last header whose `y <= panY`; if a `nextHeader` exists, `pinnedOffset = min((nextHeader.y - panY) - CAL_GROUP_H, 0)` — normally 0 (header pinned flush at the top), going negative as the next section's header approaches, sliding the pinned copy up and out just as the next one arrives. Two renderings of a header type coexist: a single full-width `.cal-type-row` rendered as a direct child of `.cal-wrap` (not nested inside the frozen room column — it used to be, which visually clipped it to the room column's width and left a seam at the column's border; it now spans edge-to-edge like the pinned copy, with its own `top: CAL_HEADER_H + row.y - panY` tracking the vertical pan by hand since it isn't inside either panned `-inner` container), and the floating `.cal-sticky-header` (same span, `top: CAL_HEADER_H + pinnedOffset`) that shows the currently-active section. There's no separate grid-side band element any more — one element does the job. **Room types are collapsible** — tapping any header row (inline or the pinned one) toggles that type's rooms via a `collapsed` Set, with a rotating chevron for affordance. The grid's horizontal gridlines are drawn per-room via a `.cal-room-band` element positioned at each room row's real `y`/`height` (not a single uniform-tile CSS background) — row heights aren't uniform (28px headers vs. 44px rooms interleaved), so a single repeating background drifts out of sync with the actual rows after the first header.

**Layout, top to bottom:**
1. Slim `.page-header` — property name (tappable → same property-switcher sheet pattern as `HomeScreen`, and styled identically: plain `<h1>` that wraps to 2 lines for a long name rather than truncating, 22px chevron) + two icon buttons in the same `.actions` wrapper `HomeScreen` uses: a calendar-frame "Today" icon (`I.Today`) showing the **live day-of-month number** inside the frame (Apple/Google `calendar_today` app-icon pattern — pass today's `day` as a prop; no background circle, sized to 36px, colored via `.icon-btn`'s default `var(--ink-2)` to match Bell/Settings on Home) and a "+" circle (`.cal-add-btn`, black, 28px) that opens a room picker to start a block (see below)
2. `.cal-wrap` — the frozen-pane grid, filling the rest of the screen (behind the floating tab bar):
   - `.cal-corner` — top-left cell, shows the currently-left-most visible month (e.g. "Sep"), recomputed live from `panX`. Mirrors `.cal-date-cell`'s two-row grid (a fixed 12px day-of-week row, blank here, then the month on the second row) rather than centering a single line, so the month text lands on the exact same baseline as the date numbers next to it — centering a 1-line block and a 2-line block in the same height puts their text at different vertical positions, which was the original bug
   - `.cal-dates` — date header row, horizontally panned only (`translateX`), today's column tinted. Each `.cal-date-cell` uses `display: grid; grid-template-rows: 12px 1fr` (not flexbox `justify-content: center`) so the date number always starts at the same fixed offset regardless of whether the day-of-week line above it has real content — flexbox centering a variable-height two-line block is fragile and was the source of a second, related alignment bug
   - `.cal-rooms` — room-code column, vertically panned only (`translateY`); truncated with ellipsis since real room names are host-entered free text and can be arbitrarily long; each row shows name + housekeeping dot where the room has one (dot *after* the name, matching the PMS reference)
   - `.cal-body` — the actual grid: reservation bars (colored by status, mapped to the PMS legend's checked-in/online-checked-in/checked-out/future-arrival/optional palette) and blocked-date bars (grey hatch) both span from the **midpoint** of the check-in/block-start day's column to the midpoint of the checkout/block-end day's column — not the column edges — matching the desktop PMS convention that arrival/departure happen midday. Both are drawn with a `clip-path` chevron on the right (pointing out) *and* a matching notch cut into the left edge (pointing in, same rightward direction) so consecutive guests in the same room interlock visually, rather than the single right-only point used in the first pass. A today-column tint and the per-room `.cal-room-band` gridlines sit behind them. Bars are `pointer-events: none` — all hit-testing happens in JS from the pan gesture's coordinates, not from DOM event targets on the bars themselves

**Interaction model** (all on one `.cal-wrap` pointer handler, using Pointer Events + `setPointerCapture`):
- **Tap vs. pan:** threshold-based — a touch that moves past 6px becomes a pan (updates `panX`/`panY`, clamped to grid bounds); one that releases under that threshold is treated as a tap, hit-tested against `rowList`/`RESERVATIONS`/`BLOCKS` using the tap's grid coordinates
- **Tap a room-type header** (inline or the pinned sticky copy) → collapses/expands that type
- **Tap a reservation bar** → `go("reservation", r.id)` (same `ReservationDetailScreen` as Home)
- **Tap a blocked cell** → toast "This date is blocked"
- **Tap an empty cell** → tap-tap block creation, scoped per room row: first tap sets a solid grey `pending` marker (not dashed — reads as "this day is selected," closer to how the standalone `BlockDateScreen` highlights a picked date); a second tap in the *same* room row on a **different** date opens an inline confirm sheet (room + From/To). **Both tapped dates are included** in the block (tapping the 7th then the 10th blocks the 7th–10th inclusive, checkout the 11th) — tapping the **same** date again blocks just that single night. Before opening the sheet, `calRangeConflict(roomId, startIso, endIso)` checks the *whole* range (not just the two tapped endpoints — a reservation or existing block can sit entirely between them) against `RESERVATIONS`/`BLOCKS` for that room; a conflict shows an error toast and drops the pending selection instead of opening the sheet. Tapping a different room row while a tap is pending discards it and starts a new one there instead. While the sheet is open, a grey range-highlight (`cal-pending`'s styling, reused) stays on the grid behind it, spanning exactly the nights that will be blocked — it used to disappear the instant the second tap fired, leaving the sheet's From/To text as the only feedback
  - **The confirm sheet itself**: Room is read-only; From and "To (last night)" are real `<input type="date">` fields (tapping either opens the OS's native date picker), cross-constrained via `min`/`max` so one can't move past the other; a nights-blocked summary line and a 2-row comment `<textarea>` sit below. "Block selected dates" re-runs `calRangeConflict` against the (possibly hand-edited) dates before confirming — editing the dates after the sheet is open bypasses the tap-time check entirely, so it has to be checked again independently, not just at the initial two-tap selection
- **Tap the room-code strip** → the row expands into a floating popover (`.cal-room-expanded`) showing the full untruncated name + housekeeping dot (if the room has one), overlapping the grid; auto-collapses after 2.5s or on any other tap
- **"+" button** → opens a room-picker sheet; picking a room auto-expands its type if collapsed, sets a pending block start at today for that room, and pans/centers the grid so that room's row is on screen — so the user always sees what they're about to select
- **"Today" icon** → animates `panX`/`panY` back to the anchor position (today's column at the grid's left edge, `panY = 0`)

The grid loads anchored so today's date column sits at the left edge (`panX` initialized from `ResizeObserver`'s first measurement, before first paint, to avoid a visible jump). Day columns are fixed-width (46px) — no pinch-zoom — per explicit direction from the user during design.

### `TasksScreen` / `BriefingScreen` (`tasks-screen.js`)

3rd tab bar item. `TasksScreen`: a tappable "Good morning" briefing card (`BRIEFING_ITEMS.length` things need attention → `go("briefing")`), a "Tasks" section title, a `Your`/`Team` `Segment` filter, and a checkable to-do list (`TASKS`, tap the row to toggle `done` — strikethrough + dimmed when done). `BriefingScreen`: lists `BRIEFING_ITEMS` (4 hardcoded ops items — ID scans outstanding, a key not returned, an overdue invoice, low stock) each with an "Add as task" button that pushes a new entry into `tasks` tagged with `fromBriefingId`, so the button flips to a disabled "Added" state and can't be added twice. `tasks` state (seeded from `TASKS` in `data.js`) is lifted to `App` in `app.js` alongside `property`, with `addTask`/`toggleTask` passed down — same pattern as everything else that needs to survive across screen navigation in this stack-based router.

### `ArrivalsScreen` (`arrivals-screen.js`) — DORMANT

This screen still exists in the codebase and routing but is no longer navigated to from the Home screen. `Segment` and `ReservationCard` have been moved out of this file to `home-screen.js`. The `ArrivalsScreen` references them as globals.

### `ReservationDetailScreen` (`arrivals-screen.js`)

- **Detail block** (`.detail-block`): reservation ID (blue), tappable status pill (cycles: confirmed → onboard → check-in → check-out → …, shows toast on change), guest name, fact-grid (check-in time, check-out time, guest composition, partner, room/type)
- **"Guests" section title** (`.section-title`)
- **Guest cards** (`.guest-card tap-anim tappable`): for each guest — ID + (Booker) badge, name, mini fact-grid (Age, Gender, Nationality, Reporting), scan button top-right (→ IDScanScreen); card tap → GuestDetailScreen
- **FAB** (`I.GridFill`) — same pattern as `GuestDetailScreen`'s FAB (`position: absolute; bottom: calc(16px + env(safe-area-inset-bottom, 0px))`; scroll area's `paddingBottom` bumped to `calc(80px + env(...))` to clear it) — opens an action sheet with **Change Status** (`I.Bolt`) and **Comments** (`I.Comment`). Note this reverses the earlier "no FAB on ReservationDetailScreen" decision (see §6) for this specific FAB+menu shell; the flat layout (no action rail / segment tabs) from that decision is otherwise unchanged
  - **Comments** opens a third sheet (`commentsSheetOpen` state, Session 8), reusing the same `.sheet` shell (auto height, 88% `max-height`) as the Property Selector and Status sheet, but as a flex column rather than one scrolling block: `.head` and a `.comments-compose` bar stay pinned, and only the middle `.comments-list` (`flex: 1; min-height: 0; overflow-y: auto`) scrolls once content exceeds the cap. Comments (`{ id, author, role, dateTime, message }`, from `COMMENTS[r.id]` in `data.js`) render oldest-first as flat rows — an initials avatar (`.comment-avatar`, primary-tinted for staff, grey/outline for `role === "Guest"`), author + role + timestamp on one line, message below — deliberately not chat bubbles, since a comment can come from any staff member or the guest and there's no fixed "me" side to anchor a bubble layout to. The compose bar (`textarea` + round `I.Send` button, disabled when empty) sits permanently at the sheet's bottom edge, iMessage/Slack-thread style, rather than a separate "add comment" tap; sending appends a local `{ author: "You", role: "Front Desk", dateTime: "Just now" }` entry to component state only (nothing persists across reopening the sheet or navigating away) and auto-scrolls the list to the new message. Only `34MRK211` has seed comments in `data.js`; every other reservation opens to an empty-state message
  - **Change Status** opens a second sheet, the **Reservation Status** history timeline (`statusSheetOpen` state), modeled on the real PMS's "Status and timeline" panel (`ReservationDetail` page, `Reservation details` tab) but rendered as a vertical history log rather than the PMS's horizontal stepper: one row per step up to and including the current one (filled blue `.icon-circle`, bold label, mock timestamp from `historyStamp(offsetDays, hh, mm)`), a solid `.connector` between them; then, only if the reservation hasn't reached its last step, an unlabeled row holding two pill-shaped `.status-action-btn` buttons (**Sign** with `I.Edit`, **Report to VIZA**) hanging off a dashed `.connector`; then any remaining steps as outline/grey future rows — except the very next one, whose `.icon-circle` renders at 48px (vs. the standard 40px) with a blue drop shadow and is directly tappable (calls `advanceStatus()`, which sets `status` to that step's key and toasts), signalling it's the actionable "tap here to advance" step rather than just a distant future waypoint. Every transition advances immediately except one: since **Check-out** only ever directly follows **Onboard** in this order, tapping it opens a small confirmation sheet first (Session 9) — checking a guest out right after onboarding them is unusual enough (most likely a mis-tap) to warrant a guard, even though every other step-to-step tap here proceeds without one. `STATUS_STEPS` (`arrivals-screen.js`) is `[Reserved (I.Calendar) → Check-in (I.Refresh) → Onboard (I.ArrowIn) → Check-out (I.ArrowOut)]` — note this order differs from the existing tappable-pill `cycle()`'s order (`confirmed → onboard → check-in → check-out`); the two aren't reconciled (see Known Issues #10). All four steps' timestamps are precomputed once at module load via `historyStamp`, with fixed non-positive day offsets (-6, -2, -2, 0) chosen so a "done" step's timestamp is never in the future, regardless of which reservation is open — this is one shared illustrative timeline, not derived from any reservation's real `checkIn`/`checkOut` fields. **Sign** is a real flow as of Session 9 (see `CheckinSignScreen` below) rather than a placeholder toast; **Report to VIZA** remains a placeholder with just an inline loading/done animation (Session 7)

### `CheckinSignScreen` / `SignatureCaptureScreen` (`signature-screen.js`)

Behind `ReservationDetailScreen`'s Reservation Status sheet's **Sign** action (see above). Modeled on a paper hotel registration card rather than a short "tap to accept" dialog, since a real property's T&C + house policy text runs to several paragraphs and can't just be summarized next to the signature field.

Both screens are **full-screen take-overs rendered as overlays from within `ReservationDetailScreen` itself** (`checkinOpen` / `signed` state on that component), not routed through `app.js`'s screen stack. This is deliberate, not an oversight: the stack is single-active-screen (pushing a new route unmounts the current one — see `CalendarScreen`'s pan-position Known Issue for the same underlying behavior), so a `go("signature", …)` round trip would reset `ReservationDetailScreen`'s local state on the way back, losing the "Sign" button's done-state the moment it was set. Rendering both as local overlays (same technique the Comments/Status sheets already use, just full-screen instead of a bottom sheet) keeps everything in one component tree.

- **`CheckinSignScreen`** — title "Check-in & Accepting T&C". Guest name + property (`PROPERTIES[0]`, since `ReservationDetailScreen` isn't passed a real selected-property prop today) + today's date in a card; the full `HOTEL_TERMS` placeholder text (`data.js`) below it in a `.checkin-terms` card; a one-line consent sentence naming the guest and their email (copy will be "emailed" — not actually sent, consistent with the rest of the prototype); then an empty dashed `.sig-field` ("Tap to sign"). Tapping it opens `SignatureCaptureScreen`; on completion the field re-renders with the captured signature image in place of the placeholder, and can be tapped again to redo it. A sticky **Confirm & Save** button at the bottom is `disabled` (native attribute, not just visual) until a signature exists — mirrors `BlockDateScreen`'s "Block selected dates" disabled-until-both-dates-picked pattern. Confirming calls `onConfirm(signature)`, which `ReservationDetailScreen` uses to set `signed = true`, close the overlay, and toast — the Sign button then renders in the same green `.status-action-btn.done` state Report to VIZA uses (checkmark, "Signed", disabled).
- **`SignatureCaptureScreen`** — full-bleed [`signature_pad`](https://github.com/szimek/signature_pad) canvas (`SignaturePad` global, loaded via unpkg in `build.py`), always full-screen regardless of the check-in page's own scroll length or the device's orientation. This is what answers the "needs to work in landscape, or full-screen behind another tap" design question from the brainstorm that preceded this feature: there's no separate expand step, because the capture view is *always* the maximum available screen space — rotating the phone mid-signature just gives a wider canvas for free via the `resize`/`orientationchange` listener. That handler is the one non-obvious piece: resizing a `<canvas>` element clears it, so on every resize it snapshots whatever's currently drawn as `signature_pad`'s vector point data (`toData()`/`fromData()`) — not a bitmap — and redraws it after resizing, rather than wiping the in-progress signature the moment the phone turns. A dashed `.sig-baseline` guide sits over the canvas; **Clear** (disabled while empty) resets the pad; **Done** (disabled while empty, via `isEmpty()`) hands the PNG back via `toDataURL()` and closes back to `CheckinSignScreen`.

### `GuestDetailScreen` (`detail-screens.js`)

- **Sub-header** with back button + "Guest details" title
- **Scrollable content** (paddingBottom: `calc(80px + env(safe-area-inset-bottom, 0px))` to clear FAB):
  - Card: personal info (ID, name, maiden name, mother's name, birth date/place, citizenship)
  - Card: contact (phone + call button, email + mail button)
  - Card: document (type, scanned Y/N, number)
- **FAB** (`I.GridFill`) — `position: absolute; bottom: calc(16px + env(safe-area-inset-bottom, 0px))` — opens action sheet
- **Action sheet**: "Edit guest" (→ EditGuestScreen) and "ID Scan" (→ IDScanScreen)

### `EditGuestScreen` (`detail-screens.js`)

- Sub-header: back + "Edit Guest"
- Floating-label form fields (same `.form-group` pattern as LoginScreen):
  - **Personal:** First & Last name, Maiden full name, Mother's full name, Birth Date, Birth place, Citizenship
  - **Contact Details:** Phone (`type="tel"`), Email (`type="email"`)
  - **Travelling document:** Document Type (select: Passport/ID Card/Driving Licence/Residence Permit), Document Number
- Section titles in primary blue (`.group-title` / `SectionTitle` component)
- Sticky "Save" button (`.btn`) at bottom with `border-top: 1px solid var(--line)` separator
- Save → toast "Guest details saved" + back

### `SearchScreen` (`detail-screens.js`)

- Sub-header: back + "Search"
- Auto-focus input (immediate, since SearchScreen opens on user gesture)
- Empty state: suggestion chips for "Emma Williams", "68CXK25", "Junior Suit", "Booking.com"
- Filters `RESERVATIONS` by name, email, id, room, roomNo (case-insensitive, `useMemo`)
- Results: `res-card` cards → `go("reservation", r.id)`
- Clear (X) button when query non-empty

### `IDScanScreen` (`detail-screens.js`)

- Dark full-screen camera UI (`.scan-screen`: `background: #0d0f12`)
- Animated scan frame: dashed border + corner brackets (CSS `::before`/`::after`) + laser sweep (`@keyframes scan-bounce`)
- Three phases managed by `phase` state:
  - `camera` → laser animation visible, shutter button active
  - `scanning` → spinner overlay, 1.6s delay
  - `result` → bottom sheet with hardcoded OCR result (name, doc type, number, age, gender, etc.)
- Result sheet actions: Edit (toast) and Save (toast + back)

### `BlockDateScreen` (`app.js`)

- Sub-header: back + "Block Date"
- Calendar grid for current month (Mon-first — `(first.getDay() + 6) % 7` lead cells)
- Tap first date = start; tap second = end (range); tapping when range exists resets start
- Range: edge dates filled primary blue, between dates filled `--primary-soft-bg`
- From/To summary card
- "Block selected dates" → disabled until both selected; on tap: toast + back

### Shared Atoms

#### `StatusBar` (`icons.js`)
Simulated iOS status bar — `height: 44px`, shows time string (default `"9:27"`) + signal/wifi/battery SVG icons. **Currently not used on any screen** (the real device status bar shows on top). Available if a fake status bar is ever needed for screenshots or presentation.

#### `Pill` (`icons.js`)
```jsx
<Pill status="check-in" />   // auto-labels from status
<Pill status="onboard">Custom label</Pill>
```
Renders `.pill[data-status="…"]`. Color mode controlled by `[data-pill]` on `.app-window`.

#### `Toast` (`icons.js`)
`<Toast msg="Text" />` — small dark snackbar with `I.Check` icon, appears at `top: 50px`. Managed in `App` state: `addToast(msg)` pushes a toast, auto-removes after 2.2s.

#### `TweaksPanel` (`tweaks-panel.jsx`)

Developer-only floating panel. Activated via `window.parent.postMessage({ type: '__activate_edit_mode' })` — compatible with iframe-based design tool embedding. Draggable, viewport-clamped.

Currently exposes three tweaks:
- **Density:** Comfy / Compact
- **Card style:** Outlined / Soft / Elevated
- **Status pill:** Soft / Solid / Outline

Defaults in `app.js`:
```js
const TWEAK_DEFAULTS = { density: "comfy", card: "outlined", pill: "soft" };
```

---

## 6. Key Decisions

### No build tool / no server
The prototype must work as a `file://` URL. This rules out ESM imports (CORS), `require()`, or any bundler. React + Babel are loaded from unpkg CDN. All JS is inlined by `build.py`.

### Global `window.*` instead of imports
No module system available. Each file registers its exports on `window`; later files read them as globals. The `/* global Foo, Bar */` comment at the top of each file documents expected dependencies.

### `100svh` for keyboard stability
`height: 100svh` on `.app-window` stays constant when the iOS soft keyboard appears. `100vh` resizes on keyboard open/close, causing layout jumps and the MFA screen content moving upward.

### `html { overflow: hidden }` to prevent iOS keyboard scroll
iOS scrolls the document when an input is focused inside an `overflow: hidden` container. This caused the MFA screen content to jump when a digit box was tapped. `overflow: hidden` on `html` prevents this.

### Delayed focus on MFA screen
`autoFocus` loses its iOS "user gesture" context during the 320ms slide-in animation — the keyboard won't open. Fix: `useEffect` with `setTimeout(..., 350)` fires after the animation, preserving the gesture chain so the keyboard opens correctly.

### `position: fixed` for `.sheet-backdrop`
Changed from `position: absolute` (scoped to `.page`) to `position: fixed; inset: 0` so the overlay covers the maximum possible viewport area, including the safe-area-inset-top region. On desktop, `.sheet` gets `max-width: min(440px, 100%); margin: 0 auto` to stay within the app-window bounds.

### `black-translucent` status bar + `env(safe-area-inset-top)` on pages
**PWA mode only** (saved to home screen). With `black-translucent`, the iOS status bar is transparent with adaptive icon colors (iOS auto-selects dark or light icons based on background luminance). The dark backdrop overlay then shows through the transparent status bar, visually dimming it. `env(safe-area-inset-top, 0px)` is added to `.page` and `.login-page` so content doesn't overlap with the status bar area in PWA mode. In browser mode, this env() value is 0 (browser handles safe areas itself), so there is no visible layout change in browser testing.

### Sheet bottom padding: no extra base, just env()
`.sheet` uses `padding-bottom: env(safe-area-inset-bottom, 8px)` — no extra fixed pixels beyond the safe area. The action-item already has `padding: 14px 4px` (reduced to `8px` bottom for `:last-of-type`). This produces a native-feeling tight wrap above the home indicator (≈8px gap). Earlier attempts with `calc(24px + env(...))` and `calc(12px + env(...))` all produced too much visible whitespace.

### Home screen merged with Arrivals
For v1, the backend won't support the full dashboard metrics (Occupancy, ADR, RevPar, Feedback). The Home screen was simplified to show the arrival list directly. The original dashboard screen is preserved in `home-screen-old.js` (not in SCRIPT_ORDER). `Segment` and `ReservationCard` were moved from `arrivals-screen.js` to `home-screen.js`.

### Left-side blue card border — `border-left` not a child div
`border-left: 3px solid var(--primary)` applied directly on `.res-card` and `.guest-card`. A previous approach used an inner `<div class="accent">` with the card having `overflow: hidden` — this clipped the `border-radius` at the left edge. Direct `border-left` avoids the clipping issue.

### `.btn` uses `width: 100%` not `flex: 1`
`flex: 1` in a flex column expands the button's HEIGHT to fill the container, not its width. Fix: `width: 100%`. Exception: `.sheet .actions .btn` gets `flex: 1; width: auto` for horizontal side-by-side buttons.

### `env()` must not be nested inside `var()`
A WebKit bug on some iOS versions prevents `env(safe-area-inset-*)` from resolving when written inside a CSS custom property. All safe area usage is inline in the declaration value.

### No segment tabs on ReservationDetailScreen; FAB re-added in Session 6
The original design had FAB + action rail + Guests/Services/Finances segment tabs. The rail and segment tabs were removed: the screen has a flat layout (detail block → Guests section → guest cards). The FAB itself was removed too at the time, then re-added in Session 6 (same pattern as GuestDetailScreen's FAB) to hold a Change Status / Comments action menu — see `ReservationDetailScreen` in §5.

### `styles.css` is cache-busted with a content hash, appended by `build.py`
`index.html`'s `<link rel="stylesheet">` points to `styles.css?v=<md5-of-styles.css>` rather than a bare `styles.css`. `index.html` itself is rewritten wholesale every build (never byte-identical to a cached copy, so it's never at risk), but `styles.css` is loaded as a genuinely separate file, and a plain browser reload can serve a stale cached copy of it even after `python3 build.py` — which happened repeatedly in Session 7 and cost several rounds of "the fix doesn't look like it landed" before the actual cause (a stale `styles.css`, not a CSS logic error) was found. The hash changes only when `styles.css`'s content actually changes, so unrelated rebuilds don't force needless re-fetches.

---

## 7. Known Issues / To Revisit

1. **Status bar dimming during backdrop in browser** — `black-translucent` + `env(safe-area-inset-top)` only works in PWA mode (added to home screen). In regular Safari browser, the native iOS status bar is outside the web viewport and cannot be styled dynamically. This is a fundamental web platform limitation.

2. **Services and Finances data unused** — `SERVICES` and `FINANCES` data exists in `data.js` but there's no UI for it. The Services/Finances tabs were removed from ReservationDetailScreen. May be added in a future iteration.

3. **Departures screen not built** — No dedicated departures view. The `ArrivalsScreen` route exists in routing but isn't navigated to from the current home. A departures-specific view (different data, check-out flow) hasn't been designed.

4. **BlockDate calendar is single-month** — No month navigation (prev/next). Acceptable for prototype.

5. **Search is client-side only** — No date search, fuzzy matching, or server-side filtering.

6. **Bottom nav is built but hidden** — `showNav = false` in `app.js`. `BottomNav` component exists with 4 tabs (Home, Arrivals, Scan, Search).

7. **Bell icon on home is cosmetic** — No screen navigates from it. (Settings icon does navigate to `/settings` in the Angular app.)

8. **OTP on Android untested** — `type="tel"` inputs with manual focus management are validated on iOS only.

9. **`home-screen-old.js` not in build** — This backup file exists in the directory but is intentionally excluded from `SCRIPT_ORDER` in `build.py`. Do not add it.

10. **ReservationDetailScreen's Change Status action's Report to VIZA button is still a placeholder; status advancement is unreconciled across three paths** — **Change Status** opens a real Reservation Status history-timeline sheet (Session 6, see §5). Of its two action buttons, **Sign** got a real flow in Session 9 (`CheckinSignScreen`, see §5); **Report to VIZA** is still a placeholder (it got a real inline loading/done animation in Session 7, but doesn't call anything real). There are now three independent ways to mutate a reservation's `status`, in two different orders: the detail block's tappable pill (`cycle()`: confirmed → onboard → check-in → check-out) vs. the status sheet's big tappable "next" circle (`advanceStatus()`, Session 7, walking `STATUS_STEPS`: confirmed → check-in → onboard → check-out). Advancing one doesn't visibly move the other, and neither is reconciled with what "Change Status" should really mean, nor with completing the Sign flow (`signed` is a separate boolean, not itself a status transition). **Comments** (Session 8) is no longer part of this issue — it now opens a real sheet, see §5 — but its content is local-state-only (see §8 Session 8 changelog) and not wired to anything either.
12. **Signed state doesn't persist, same as Comments** — `CheckinSignScreen`'s captured signature and `ReservationDetailScreen`'s `signed` flag are local component state only; reopening a reservation after navigating away resets both, same as Comments (Known Issue above) and consistent with this whole prototype's hardcoded-data approach. Not a bug to fix casually — real persistence needs the backend integration noted in §9.

~~11. `IDScanScreen`'s scanning spinner references a missing `@keyframes spin`~~ — **false alarm, retracted**: `@keyframes spin` is real, it's just not in `styles.css` — `build.py` injects it directly into `index.html`'s `<head>` via its own inline `<style>` block (`build.py` lines ~50-52), which a plain `grep` across `.css`/`.js` source files misses since it's neither. `IDScanScreen`'s spinner works fine; `status-spin` (Session 7) remains its own separate keyframe regardless, which is harmless.

---

## 8. Changelog

> Angular/Ionic app (`app/`) session history that was logged here (Sessions 4-23, 2026-05-18 through 2026-06-06) has moved to `../app/CLAUDE.md`'s own changelog, so that app has one continuous history in one place. This file's changelog now covers only the `design/` prototype (Sessions 1-3, then 4 below).

### 2026-09-11 — Session 9

**Built the Sign flow behind `ReservationDetailScreen`'s Reservation Status sheet**, replacing the `addToast("Coming soon")` placeholder from Session 6/7 — the first of the sheet's two action buttons to get a real flow (Report to VIZA remains a placeholder, see Known Issues #10).

Brainstormed the UX with the user first (no code), starting from the real [`signature_pad`](https://github.com/szimek/signature_pad) library the user had in mind. Talked through where the consent sentence and signature area should live, and how to give the signature area enough room on a phone (landscape support vs. a separate full-screen "expand" tap). The user's own framing settled it: this should read like a physical hotel check-in card a guest signs — a title, the guest/property/date, the actual (lengthy) T&C text, and a signature line at the bottom, with the signing itself happening in a dedicated full-screen capture step rather than trying to fit a usable signature pad into a single card. Also explicitly confirmed as separate decisions: a dedicated **Confirm & Save** button rather than saving the instant a signature is captured, and that button must not be tappable without a signature.

- New `signature-screen.js` (added to `SCRIPT_ORDER` in `build.py`, after `detail-screens.js`): `CheckinSignScreen` ("Check-in & Accepting T&C") and `SignatureCaptureScreen`. See §5 for the full result. Both are rendered as full-screen overlays from *within* `ReservationDetailScreen`'s own JSX (new `checkinOpen`/`signed` state there), not routed through `app.js` — the app's stack navigation unmounts a screen when you push past it and remounts it fresh on `back()` (same behavior already noted as a Known Issue for `CalendarScreen`'s pan position), which would have silently reset the "Signed" done-state on the way back out of a routed signature screen. Sidestepping that by keeping the whole flow as local overlay state — the same technique the existing Comments/Status sheets already use, just full-screen instead of a bottom sheet — was a deliberate call, not an oversight
- Added the [`signature_pad`](https://unpkg.com/signature_pad@5.1.4/dist/signature_pad.umd.min.js) UMD build via unpkg in `build.py`, alongside the existing React/ReactDOM/Babel CDN scripts — the prototype's first non-React runtime dependency
- New `HOTEL_TERMS` placeholder text in `data.js` — several paragraphs (check-in/check-out times, ID scanning consent, cancellation/no-show charges, damage liability, smoking, quiet hours, pets), deliberately long rather than a one-line summary, since a real property's T&C is expected to run long and the whole point of the check-in-card layout is to show it in full above the signature line
- `SignatureCaptureScreen`'s canvas resize handling is the one genuinely non-obvious piece: resizing a `<canvas>` element clears it, so the resize/orientationchange handler snapshots whatever's currently drawn as `signature_pad`'s vector point data (`toData()`) before resizing and redraws it after (`fromData()`) — not a bitmap round-trip. This is also what answers the original landscape/full-screen brainstorm question without needing a separate "expand" affordance: the capture view is always full-screen already, so rotating the phone mid-signature just hands the same in-progress signature a wider canvas for free
- New CSS: `.checkin-sign-backdrop` / `.sig-capture-backdrop` (full-screen takeover wrapper, escaping the page-transition container's `overflow: hidden` via `position: fixed`, same trick `.sheet-backdrop` already uses, but filling the whole screen instead of docking to the bottom — nests a real `.page` as the flex child so both new screens get `.page`'s existing sub-header/app-scroll/safe-area handling for free), `.checkin-terms`, `.checkin-consent-note`, `.sig-field` (empty/filled states), `.sig-capture-bar`, `.sig-canvas-wrap`, `.sig-baseline`
- The Sign button itself now renders in the same green `.status-action-btn.done` state Report to VIZA already uses (checkmark, "Signed", disabled) once `CheckinSignScreen`'s Confirm & Save completes — kept visually consistent with the one action in this sheet that already had a real done-state, rather than inventing a new one
- Signed state is local component state only, same caveat as Comments (Session 8) and consistent with the rest of this hardcoded-data prototype — see Known Issues #12

**Follow-up fix from the user's first on-device look:** the captured signature rendered tiny inside `CheckinSignScreen`'s `.sig-field` once signed. Root cause wasn't the display CSS — it was what got saved: `SignatureCaptureScreen`'s canvas is full-screen (mostly empty space around a small scribble), so saving the whole canvas via `toDataURL()` produced a tall, mostly-blank portrait PNG; squeezed into the `.sig-field`'s short, wide box via `max-height`, that gave a razor-thin sliver of actual ink. Fixed with a new `cropSignature()` helper (`signature-screen.js`) that computes the ink's bounding box directly from `signature_pad`'s own point data (`toData()`, padded 24 CSS px for stroke width/antialiasing) and draws just that region into a new, tightly-cropped canvas before calling `toDataURL()` — the saved image is now sized to the signature itself, not the capture screen. This changed what gets threaded through as "the signature": `CheckinSignScreen`'s `signature` state is now `{ dataUrl, raw }` rather than a bare string, since redoing an existing signature needs the original *point data* (`raw`, reloaded via `fromData()` at 1:1 scale) — reloading the already-cropped `dataUrl` into the full-screen canvas via `fromDataURL`'s width/height params would have stretched a small tight crop across the whole screen, distorting it.

**Added a confirmation before Onboard → Check-out in the Reservation Status sheet's tappable "next" circle.** Requested directly: checking a guest out immediately after onboarding them is an unusual, high-consequence jump (most likely a mis-tap, not an intentional action) even though it's mechanically just the next single step in `STATUS_STEPS`'s walk — every other transition in this flow still advances immediately on tap. `advanceStatus()` (`arrivals-screen.js`) now branches: if the next step's key is `"check-out"` it opens a new `checkoutConfirmOpen` sheet instead of advancing directly (the actual advance logic moved into `doAdvance(next)`); confirming calls `confirmCheckout()`, which re-reads the next step and runs `doAdvance`. The dialog reuses the plain `.sheet` + `.head` + `.actions` shell already used elsewhere (e.g. `IDScanScreen`'s result sheet) rather than a bespoke design — a short message plus a `.btn.secondary` **Cancel** / `.btn` **Check out** pair, per the "some default confirmation dialog" ask. Since `check-out` only ever directly follows `onboard` in `STATUS_STEPS`'s order, this is effectively "confirm the onboard → check-out transition specifically," not a generic per-step guard.

### 2026-09-09 — Session 6

**Re-added a FAB to `ReservationDetailScreen`**, reversing part of the Session 2 "no FAB or segment tabs" decision (`arrivals-screen.js`, same file `ReservationDetailScreen` lives in):
- Same visual/interaction pattern as `GuestDetailScreen`'s FAB: `I.GridFill` FAB button opening a `sheet-backdrop`/`sheet` action menu; scroll area's bottom padding bumped from `24px` to `80px` base to clear it
- Menu holds two actions: **Change Status** (`I.Bolt`) and **Comments** (`I.Comment`). **Comments** is a placeholder per the user's direction (screen to be defined later) — just closes the sheet and shows an `addToast("Coming soon")`
- The existing tappable status pill (cycles confirmed → onboard → check-in → check-out) is unchanged and untouched by this — "Change Status" as a FAB action is a separate, not-yet-reconciled affordance (see Known Issues #10)

**Built the Reservation Status history-timeline sheet** behind the new **Change Status** action, modeled on a screenshot the user supplied of the real desktop PMS's "Status and timeline" panel (converted from the PMS's horizontal stepper to a vertical history log, since this is a narrow mobile sheet):
- New `STATUS_STEPS` array (`arrivals-screen.js`): `Reserved (I.Calendar) → Check-in (I.Refresh, new icon) → Onboard (I.ArrowIn) → Check-out (I.ArrowOut)`. `I.Refresh` was added to `icons.js` — nothing existing matched the PMS reference's circular-arrow check-in glyph
- Steps up to and including the reservation's current status render as filled blue circles with a bold label and a mock timestamp; a solid `.connector` bar links consecutive completed steps
- If the reservation hasn't reached its final step, a dashed `.connector` leads to a row of two pill-shaped `.status-action-btn` buttons — **Sign** (`I.Edit`) and **Report to VIZA** — both placeholders (`addToast("Coming soon")`), matching the two buttons visible under the "Onboard" step in the user's reference screenshot — then another dashed connector continues to the remaining steps, rendered as grey/outline "future" rows
- All four steps' timestamps come from a `historyStamp(offsetDays, hh, mm)` helper, computed once at module load with fixed non-positive offsets (-6, -2, -2, 0 days) so a "done" step's timestamp is never in the future no matter which reservation's sheet is opened — this is one shared illustrative timeline, not derived from any reservation's actual `checkIn`/`checkOut` fields
- New CSS in `styles.css`: `.status-timeline`, `.status-step` (`.done`/`.current`/`.future` modifiers), `.status-actions`, `.status-action-btn`
- Not reconciled with the existing tappable status pill's own `cycle()` step order, which is `confirmed → onboard → check-in → check-out` (onboard before check-in) — the PMS-accurate order used here has check-in before onboard. Advancing one doesn't move the other. Flagged in Known Issues #10 for whenever the user wants them unified
- **Two layout bugs fixed after first on-device look** (screenshot showed the "Report to VIZA" button's text wrapping and overflowing its pill, and the dashed connector into the actions row sitting visibly left of the icon circles above it): `.status-step .node-col` had no explicit width, so a row with just a bare `.connector` (no `.icon-circle` sibling) collapsed to the connector's own 3px width instead of matching the 40px column the icon circles sit in — fixed by giving `.node-col` a fixed `width: 40px`. Separately, `.status-step .body` had no `flex: 1`, so it shrink-wrapped to its content's preferred width instead of filling the row, starving `.status-actions` of the space it needed and forcing the longer button label to wrap — fixed by adding `flex: 1; min-width: 0`. The buttons themselves were also switched from a fixed `height: 48px` (which let wrapped text overflow the pill) to `min-height` + padding, so any future wrap grows the pill instead of breaking it

### 2026-09-10 — Session 8

**Built the Comments sheet behind `ReservationDetailScreen`'s FAB menu**, replacing the `addToast("Coming soon")` placeholder from Session 6 — the same FAB menu's other action, Change Status, already had a real sheet to match against (see §5 for the full result, and Known Issues #10 for what's still not wired up).

Brainstormed with the user first (no code) on three open questions before building: chat-bubble vs. flat-list comment rows, oldest-first vs. newest-first ordering, and where "add comment" should live (persistent bottom compose bar vs. a header "+" button vs. an icon-only affordance). Landed on flat rows (no natural "me" side to anchor a bubble to, since authors are a mix of staff and the guest), oldest-first, and a persistent bottom compose bar (textarea + round `I.Send` button) — closest to how staff would actually use a running log, at the cost of needing real keyboard-safe layout since the sheet already sits at the screen's bottom edge.

- New `COMMENTS` data in `data.js`: keyed by reservation id, each entry `{ id, author, role, dateTime, message }`. Only `34MRK211` (Emma Williams — the same reservation used for all the Status-sheet testing) is seeded, with 5 entries mixing Front Desk, Housekeeping, and the guest herself, telling a small story (a quiet-room request → a late-checkout ask → staff confirming it → housekeeping prepping the room → check-in) so the sheet's scroll/max-height behavior has enough content to actually exercise
- New `I.Send` icon (`icons.js`) — nothing existing fit the compose button. First pass was a paper-plane glyph; the user didn't like it and, after confirming no similar send-style icon existed anywhere else in `icons.js` to reuse, chose a plain upward arrow (iMessage/Slack-style) over reusing `I.ChevronRight` or `I.Check` — swapped in as the same `I.Send` export so the compose button's markup didn't need to change
- **Reused the existing `.sheet` shell exactly as asked** (auto height, `max-height: 88%`, same as the Property Selector and Status sheet) rather than inventing a new modal pattern, but as a `.comments-sheet` modifier: `display: flex; flex-direction: column; overflow: hidden` on the sheet itself, so `.head` and the new `.comments-compose` bar stay pinned while only `.comments-list` (`flex: 1; min-height: 0; overflow-y: auto`) scrolls once content exceeds the cap — the head and compose bar's natural heights are simply subtracted from the sheet's clamped height by flex, no measurement code needed
- `ReservationDetailScreen` (`arrivals-screen.js`) gained `commentsSheetOpen`, `comments` (seeded from `COMMENTS[r.id] || []`), and `commentDraft` state, plus `sendComment()` (appends a local `{ author: "You", role: "Front Desk", dateTime: "Just now" }` entry and clears the draft) and a small `initials()` helper for the avatar circles. `comments` is local component state only — sent comments don't persist back to `data.js` or survive leaving the screen, consistent with the rest of the prototype's hardcoded-data approach
- Auto-scrolls `.comments-list` to the bottom both when the sheet opens and after sending — otherwise, with oldest-first ordering and a tall thread, the sheet would open scrolled to the oldest comment instead of the most recent one nearest the compose bar
- Guest-authored rows get a visually distinct avatar (`.comment-row.guest .comment-avatar` — grey/outline, matching `.card` token colors) instead of the primary-blue-tinted one staff rows get, so the log is scannable at a glance without reading every name
- Empty state ("No comments yet") for every other reservation, since only `34MRK211` has seed data
- **Two follow-up fixes from the user's on-device look:** the message text (`.comment-message`, `var(--font-base)`) read too small against the rest of the app's card content — `--font-base` resolves to 15px in the real token values (CLAUDE.md's §4 table had drifted to a stale 16px), and 15px turned out to only be used elsewhere for short UI chrome (status-bar clock, segment tab labels), never for a block of prose — bumped to `var(--font-md)` (17px), matching `.fact .v` / the guest-card fact-grid values, the closest "primary card content" precedent; `.comment-author` bumped from `var(--font-sm)` (13px) to `var(--font-base)` (15px) so it didn't read smaller than the message under it, and `.comment-role`/`.comment-time` moved to `var(--font-xs)` (matching the existing micro-caption precedent, e.g. `.guest-card .id`). Second, and more substantive: the compose bar had no visible bottom clearance above the screen edge, unlike every other sheet's ending elements. Root cause was a negative-margin bug, not a missing-padding one — `.comments-compose` carried `margin: 0 calc(var(--pad)*-1) calc(var(--pad)*-1)` (bleeding all three non-top sides to `.sheet`'s edges, same trick `.sheet .head` uses on its top edge), but unlike `.head`'s case, `.sheet.comments-sheet`'s own bottom padding is already 0 (not `var(--pad)` like `.head`'s parent padding is) — so there was no padding left for the negative margin to "cancel," and it instead shrank the compose bar's contribution to the flex column's auto-height calculation by 16px more than intended, leaving that much of its own `padding-bottom` (`12px + env(safe-area-inset-bottom, 8px)`) clipped away by `.sheet.comments-sheet`'s `overflow: hidden`. Fixed by dropping just the bottom component of that negative margin (`margin: 0 calc(var(--pad) * -1)`) — the horizontal bleed is unaffected and safe to keep, since `.sheet`'s width is definite (not content-summed the way flex-column auto height is), so it doesn't hit the same clipping interaction

### 2026-09-10 — Session 7

**Reservation Status sheet refinements, same day as first on-device feedback:**
- Removed the "History" section label above the timeline — the CSS-only `.status-sheet-label` class was dropped along with it since nothing else used it
- **The immediate next step's circle now reads as tappable**: its `.icon-circle` renders at 48px instead of the standard 40px, with a blue drop shadow (`box-shadow: 0 4px 14px rgba(0,142,255,0.25)`) and a `scale(0.92)` press state, and is wired to a new `advanceStatus()` (`arrivals-screen.js`) that sets `status` to that step's key and toasts — distinguishing "the one action available right now" from the remaining future steps after it, which stay small/inert. `.status-step .node-col` was widened from 40px to 48px to fit the bigger circle without breaking the connector-line alignment fixed the same day as Session 6's layout bugs
- `advanceStatus()` is a third, independent way to mutate the reservation's `status` state — alongside the detail block's tappable pill (`cycle()`) and whatever "Change Status" eventually does beyond opening this sheet — and it walks `STATUS_STEPS`' PMS-accurate order (confirmed → check-in → onboard → check-out), not `cycle()`'s order (confirmed → onboard → check-in → check-out). Same unreconciled-order caveat as Session 6, now with one more path affected — see Known Issues #10
- Added `margin-bottom: 50px` to `.status-timeline` so the last row (whichever step that is — future/grey, or the tappable "next" circle) doesn't sit flush against the sheet's bottom edge
- **Fixed the last row's label sitting above its circle's vertical center, not centered on it** (visible once the "next" circle grew to 48px in a reservation with only one future step left — e.g. Onboard current, Check-out both "next" and "last" — the mismatch between the bigger icon and the single-line label became obvious). First attempt (`.status-step.last { align-items: center; }` alone) didn't actually fix it — confirmed by the user's follow-up screenshot, still misaligned. Root cause was two-layered: (1) every non-last row's `node-col` is taller than its own icon only because of the connector stretching down to the next circle — that's what makes the default top-align happen to land the label about right, not the icon's height itself; (2) the last row's `.body` was still inheriting the standard `padding-bottom: 22px`, which made `.body`'s own natural height *taller* than the 48px icon — so `align-items: center` centered the smaller item (the icon/`node-col`) down into that extra space, instead of centering the label (whose text still sat at the top of its own now-oversized box) up to the icon. Fixed by also zeroing that row's padding via `.status-step.last .body { padding-bottom: 0; }` — trailing space below the whole list already comes from `.status-timeline`'s own `margin-bottom: 50px`, so nothing depended on it
- **Moved the Sign / Report to VIZA buttons up, closer to the status they belong to**: the gap above them (the current step's own `padding-bottom: 22px`) is now `6px` via a new `.tight-bottom` class on that step, and the gap below them (the actions row's own `padding-bottom`) was widened from `22px` to `36px` — so the buttons now read as attached to the current status above, with clearer separation from the future step below, instead of floating roughly centered between the two

**Two-stage status-advance flow, requested by the user as an explicit before/after scenario** (Stage 1: Reserved + Check-in done, Onboard next with only Sign showing; tap Onboard → brief "Updating status" spinner → Stage 2: Onboard done, Report to VIZA now also showing, Check-out becomes the new next step):
- First attempt gated the actions row by *current status* (a `STATUS_ACTIONS` map: `confirmed`/`check-in` → `["sign"]`, `onboard` → `["sign","report"]`), which put the buttons directly under whichever step was current — the user corrected this: Sign/Report belong to *Onboard specifically* ("Terms and Conditions signing belongs to onboarding"), so they must always render immediately below the Onboard row, whether Onboard is still the upcoming/outlined step (Sign only, since Report to VIZA "is not possible before onboarding") or already done (Sign + Report, now both attached below onboard's *done* row rather than below whatever the current step later becomes). `STATUS_ACTIONS` was removed; the sheet's render is now one IIFE that walks `doneSteps` (`STATUS_STEPS.slice(0, statusIndex+1)`) and inserts the actions block right after whichever entry has `key === "onboard"` (regardless of whether that entry is `current` or an already-passed `done` step), and separately checks whether the single shown next-step is Onboard (`nextIsOnboard`) to attach the Sign-only block after *that* instead when onboarding hasn't happened yet
- **Only the single immediate-next step renders now**, not the full remaining chain of future steps — collapsed the old `STATUS_STEPS.slice(statusIndex + 1).map(...)` (which drew every remaining step as small grey rows) down to just `STATUS_STEPS[statusIndex + 1]` rendered once, always with the big tappable "next" treatment. This is a behavior change from Session 6/7: previously, if `status` were `confirmed`, Check-in/Onboard/Check-out would all show as future rows at once; now only Check-in would show, and the rest only appear one at a time as each prior step is reached — matches the user's Stage 1/2 description, where Check-out was described as not appearing at all until Onboard was reached
- **Second on-device look at this exact Stage 1 view (Onboard as the outlined next step, Sign attached below it) found the same "label sits above the icon's center, not centered" bug as before, plus the dashed connector reading as disproportionately long, plus a full-width Sign button.** Root cause this time was subtler than the earlier "last row" case: this row does have a connector (leading down into its own Sign-only actions block, since it's not literally the last thing on screen), so the earlier "no connector → no stretch → tiny box" diagnosis didn't apply — instead, the *connector's own* `min-height: 24px` was inflating `.node-col`'s hypothetical height to `48px icon + 24px connector + 4px margins = 76px`, which comfortably exceeded the actual content's need (a single short label, ~34px including its own padding) — so default stretch handed `.body` that same bloated 76px, and its content, still top-anchored inside it, ended up sitting well above the icon's real vertical center, with an oversized gap opening up below the label before the dashed segment and the Sign button beneath it. Fixed two ways together: (1) dropped the connector's `min-height` from `24px` to `8px` — it's meant as a floor for otherwise-empty segments, not a target size, and 24px was forcing rows taller than their content warranted whenever a short label was the only thing setting the pace; (2) generalized the earlier `.status-step.last { align-items: center; }` fix into `.status-step.next { align-items: center; }`, since `.next` is present on this single shown future row in both its variants (`.tight-bottom`, leading into Sign, and `.last`, leading into nothing) — centering explicitly here means the row's exact height no longer needs to coincidentally match the label's height for alignment to look right, unlike the top-align rows still relying on that coincidence
- **Sign button no longer stretches full-width when it renders alone** — `.status-action-btn` was `flex: 1` (fills 100% of `.status-actions` when it's the only child), which the user didn't want: Sign should be the same width whether Onboard hasn't been reached yet (Sign alone) or has (Sign + Report to VIZA side by side). Changed to a fixed `flex: 0 0 calc(50% - 6px)` (half the row, minus half the 12px gap) — with two buttons this totals exactly 100% as before, and with one it just leaves the other half of the row blank instead of stretching to fill it
- **Found the real explanation for why the centering/spacing fix appeared not to work on the user's next screenshot — it hadn't been re-fetched.** `build.py` was rewriting `index.html` fresh every run, so the JS was always current, but `<link rel="stylesheet" href="styles.css">` had no cache-buster, and the user was iterating by editing + rebuilding + reloading the same open tab rather than a hard refresh each time — a completely reasonable workflow this project's own CLAUDE.md explicitly encourages ("CSS edits take effect without rebuilding"), which normally holds, right up until the browser's disk cache for that specific file doesn't invalidate on a plain reload. Fixed at the source: `build.py` now MD5-hashes `styles.css`'s contents and appends it as a `?v=<hash>` query string on the `<link>` tag, so any CSS change forces a fresh fetch on the very next `python3 build.py`, with no dependence on the browser's cache behavior or the user remembering to hard-refresh
- **Added a real inline animation to Report to VIZA** (previously just `addToast("Coming soon")` like Sign still is): new `vizaStatus` state (`idle` → `loading` → `done`) on `ReservationDetailScreen`, driven by `reportToViza()`. Clicking swaps the button's label for a small spinner (`.status-spinner-sm`, a scaled-down variant of the status-sheet's existing `.status-spinner`) and "Reporting…" for 1.2s, then settles on an `I.Check` icon and "Scheduled", turning the button's border/text green (`.status-action-btn.done`, using the existing `--success` token) and disabling it (`.status-action-btn:disabled { opacity: 1 }`, overriding the browser's default dimmed-disabled look so it still reads as a completed state, not a greyed-out one) — Sign was intentionally left as a plain toast, since only Report to VIZA was asked for here
- **The label-vs-icon centering bug came back a third time on the very next screenshot** (row heights had visibly shrunk, confirming the cache-buster above did fix the stale-CSS problem — this was a genuinely different, still-unsolved layout bug, not a repeat of the caching one). Root cause, finally correctly diagnosed: every fix so far tried to make the LABEL center within *whatever height the row as a whole ends up being* — via `align-items: center` on `.status-step`, in various narrowing scopes (`.last`, then `.next`) — but a row's total height depends on things that have nothing to do with where its own label sits relative to its own icon: the timestamp below it, the connector's length, whether an actions block follows. Chasing that height kept "fixing" one row shape while silently reintroducing the bug for a different one. The actual fix doesn't touch row height at all: each label is now wrapped in a `.label-line` div with a `min-height` matching its icon's diameter (`40px` for normal rows, `48px` for the big tappable `.next` row) and `display: flex; align-items: center`, so the label centers *within a box guaranteed to be exactly as tall as the icon*, decoupled from everything else in the row. Since both the icon and `.label-line` are top-anchored at their row's top edge and are now the same height, their centers coincide exactly regardless of what a timestamp, connector, or trailing actions block adds afterward. This let the earlier `.status-step.next { align-items: center }` rule be deleted outright — the whole family of `.last`/`.next`/`.tight-bottom` alignment special-casing is gone; those classes now only ever control spacing, never alignment
- **What the user was actually pointing at in the next screenshot turned out to be a different, real bug once talked through** — not a leftover centering issue at all. The `.label-line` fix above did work; what the follow-up screenshot showed was the dashed connector below the Onboard-as-next circle trailing down toward the Sign button with nothing at the other end of it — because Check-out is deliberately not shown yet at that point (only the single immediate-next step ever renders), that dash didn't lead to another circle, it just dangled into empty space above the actions row. The user's framing cut straight to the actual rule that had been missing all along: **a connector should only ever exist in the gap between two real circles — never trailing past the last one with nothing to connect to.** Fixed by deleting the one line responsible: `{nextIsOnboard && <div className="connector dashed" />}` in the next-step block (`arrivals-screen.js`) — that row no longer renders a connector at all, matching how the Check-out-as-next row (the `.last` case) already had none. The other dashed segment, from Onboard's own *done* row into its actions block, was deliberately left alone: there, a real circle (Check-out) always eventually follows on the other side of the actions row, so that segment does still connect two circles, just with the actions block sitting visually on top of the middle of it
- New `statusUpdating` state and a rewritten `advanceStatus()`: tapping the next circle no longer updates `status` immediately — it sets `statusUpdating` true, waits 1.4s (`setTimeout`), then sets `status` to the next step's key, clears `statusUpdating`, and toasts. While `statusUpdating` is true, the next step's circle swaps its icon for a new `.status-spinner` (a bordered-ring CSS spin, `@keyframes status-spin`) and its label for "Updating status…", and the circle stops responding to taps (`onClick` only wired when `!statusUpdating`, plus `.icon-circle.updating { cursor: default; box-shadow: none; }`)
- Note (later retracted — see Known Issues #11): first assumed `IDScanScreen`'s "Reading document…" spinner referenced a nonexistent `@keyframes spin` and had never actually rotated; turned out `@keyframes spin` is real, just injected by `build.py` straight into `index.html`'s `<head>` rather than living in `styles.css`, which a source-file grep missed. `status-spin` (its own separate keyframe, added for the sheet's spinner) is unaffected either way
- **Fixed the demo not actually showing Stage 1 on first open**: the two-stage flow above was implemented correctly, but reservation `34MRK211` (Emma Williams, the one the user was testing against — same one shown in every screenshot this session) had `status: "onboard"` in `data.js` from the start, so opening its Reservation Status sheet always landed straight into what would be Stage 2 (Onboard already done/filled, Check-out already showing) — the Stage-1 view (Onboard outlined/next, Sign-only, no Check-out yet) was reachable in principle but never what you'd actually see by just opening the sheet. Changed that reservation's seed `status` to `"check-in"` so opening the sheet now starts at Stage 1 as described. This also changes this reservation's status pill everywhere else it renders (Home/Arrivals card, the detail block's own pill) from "Onboard" to "Check-in" — a visible but intentional side effect of the same one `status` field driving all of it

### 2026-09-07 — Session 5

**Calendar prototype polish and bug-fixing pass, continuing on `calendar-prototype`** (tested live over LAN via `python3 -m http.server`, not just visual review — the user drove it on a phone against a mock of the real desktop PMS calendar for comparison):

- **Fixed a real timezone bug, not just a display glitch**: both `calIso()` (`calendar-screen.js`) and `relDate()` (`data.js`) built date strings with `date.toISOString().slice(0,10)`. `toISOString()` converts to UTC first, so on a local midnight in any timezone ahead of UTC (e.g. CEST) it silently rolls back to the previous UTC day — the date *displayed* (`d.getDate()`, computed locally) was correct, but every date *string* used for hit-testing, reservations, and blocks was a day behind it, and the drift compounded through calculations (tapping the 7th could register as the 6th, tapping the 10th as the 7th). Both now build the ISO string from local date parts directly
- **Block-date range is now inclusive of both tapped endpoints** (tap 7th then 10th → blocks the 7th–10th, checkout the 11th) — the first pass computed an exclusive end from the second tap directly, which is correct for the underlying `[start, end)` data model but meant the *tapped* end date itself wasn't blocked, contradicting what tapping two dates should visually mean
- **Header alignment, two separate bugs, both now grid-based instead of flex-centering a variable two-line block**: (1) the corner month label sat off-baseline from the date-header numbers because centering a 1-line block (month) and a 2-line block (day-of-week + number) in the same height puts their text at different vertical positions — fixed by giving the corner the same two-row structure; (2) `.cal-date-cell`/`.cal-corner` still drifted slightly because flexbox's `justify-content: center` depends on the *actual rendered height* of the (often-empty) day-of-week line — replaced with a `display: grid; grid-template-rows: 12px 1fr` so the date number always starts at a fixed offset regardless of what's above it
- **Room-type divider rows are now one full-width element**, not a room-column/grid-band pair — the pair used to be visually split by the frozen room column's own `border-right`, breaking the "one continuous bar" look; the single element is now a direct child of `.cal-wrap` (outside both panned `-inner` containers) with its own hand-computed `top: CAL_HEADER_H + row.y - panY`, with a `transition: top` applied only during the "Today"/room-picker snap animations so it still glides in step with the rest of the grid
- **Grid horizontal lines fixed**: they were a single CSS `repeating-linear-gradient` tiled uniformly every `CAL_ROW_H` from the top, but real row heights aren't uniform (28px type-header bands interleave with 44px room rows) — every row after the first header drifted out of sync with the tiled lines, making bars look "off the grid." Replaced with an explicit `.cal-room-band` element per actual room row, positioned from the same `rowList` used for hit-testing, so gridlines and bar positions can never disagree
- **Reservation/blocked bars redesigned to match the real desktop PMS calendar** (screenshot supplied by the user for reference): bars now start at the midpoint of the check-in/block-start day's column and end at the midpoint of the checkout/block-end day's column (arrival/departure happen midday), not at the column edges; the shape gained a chevron notch cut into the left edge to match the existing point on the right — both "arrows" point the same direction (rightward), so adjacent guests in the same room interlock the way they do on the desktop reference. (First attempt had the left notch backwards — protruding outward like a left-pointing arrow instead of cutting inward to match the right's direction; caught by the user comparing directly against the reference image)
- **Block-date confirm sheet upgraded**: From/To are now real `<input type="date">` fields (native OS date picker on tap), cross-constrained via `min`/`max`; added a 2-row comment `<textarea>`. Added `calRangeConflict(roomId, startIso, endIso)`, checking the *whole* selected range (not just the two tapped endpoints — an existing reservation or block can sit entirely between them) against `RESERVATIONS`/`BLOCKS`; it's called both at the initial two-tap selection (before the sheet even opens) and again when "Block selected dates" is pressed, since hand-editing the dates in the sheet afterward bypasses the tap-time check entirely. A range-highlight now also stays visible on the grid behind the open sheet (previously vanished the instant the second tap fired)
- **Housekeeping status made optional** (`ROOMS[].housekeeping` can now be absent): service rooms like `Parking` aren't cleaned, so they carry no `housekeeping` field, and the colored dot is only rendered where `room.housekeeping` is truthy (both the room-list row and the tap-to-expand popover). Added 3 more parking spaces (2 → 5 total)
- **Renamed the 4 Honeymoon Suite rooms** from bare numbers (`101`/`103`/`201`/`10`) to themed names (Serenity/Tranquility/Sunset/Moonlight Suite) — `id` left unchanged so `RESERVATIONS`/`BLOCKS` references still resolve; the one task referencing "Suite 201" by number was updated to match
- **"Today" icon redesigned**: replaced the static calendar-with-dot glyph with the Apple/Google `calendar_today` app-icon pattern — the frame shows the actual live day-of-month number (`I.Today` now takes a `day` prop), and a stray horizontal divider line in the SVG that started cutting through the digit once it was added was removed. Went through a few iterations on sizing/framing before landing on: no background circle (the "+" button keeps its filled-circle treatment, since it's a distinct primary action, not a cosmetic icon), 36px, colored via `.icon-btn`'s default instead of primary blue
- **`CalendarScreen`'s header brought in line with `HomeScreen`'s**: property name is a plain `<h1>` that wraps to 2 lines instead of truncating with an ellipsis; both icon buttons moved into the same `.actions` wrapper class `HomeScreen` uses instead of an ad-hoc inline flex div, for identical spacing/alignment; `.page-header` itself changed from `align-items: flex-start` to `center` (it was pinning the title and the now-taller icon buttons to the top of the row instead of centering them against each other) — this is a shared class, so it also (harmlessly, both are single-line) affects `HomeScreen`/`TasksScreen`
- **Fixed a real missing-CSS bug in the Tasks tab**: `tasks-screen.js`'s task list used `.task-item`/`.task-check`/`.task-title`/`.task-who` classes that were never defined in `styles.css` at all, so the list rendered as bare unstyled text with a stray checkmark glyph floating with no layout around it. Added the missing card/checkbox-row styling
- Removed then restored the "+" add-block button after a miscommunication mid-session (a "clean calendar" request was about the Today icon's built-in visual, not the separate "+" button) — worth noting only because it's exactly the kind of back-and-forth this file's "confirm before assuming scope" instinct exists for

### 2026-09-05 — Session 4

**Room calendar prototype, built on a new `calendar-prototype` branch/worktree (`../SabeeAppGO-calendar`, branched off `main`):**

- Added `ROOMS` (flat `{ id, type, name, maxOccupancy }` list — matches what the real API is expected to return, no separate room-types table) and `BLOCKS` (blocked date ranges per room) to `data.js`. Gave each existing `RESERVATIONS` entry additive `roomId` / `startDate` / `endDate` fields (ISO, exclusive end), computed relative to `new Date()` via a new `relDate(offsetDays)` helper so the demo data always looks populated around "today" regardless of when the prototype is opened
- New `calendar-screen.js` / `CalendarScreen` — a full-bleed room × date Gantt grid: frozen date header (pans horizontally only), frozen/truncated room-code column (pans vertically only), and a computed "current room type" band that fakes a sticky group header (the grid is pointer-driven, not natively scrolled, so real CSS `position: sticky` doesn't apply). Panning is one continuous drag gesture in any direction, threshold-based tap-vs-pan (6px), reservation bars open `ReservationDetailScreen`, empty cells use a tap-tap (per room row) flow into an inline block-date confirm sheet
- Introduced a 4-tab bottom bar — Home, Calendar, Tasks, AI — replacing the old unused 4-tab set (Home/Arrivals/Scan/Search) that existed in code but was never shown (`showNav` was hardcoded `false`). `showNav` is now `ROOT_TABS.includes(top.name)`, so the bar shows only on the 4 root tab screens and hides on any pushed/modal screen. Restyled `.bottom-nav` from an edge-to-edge bar into a floating rounded pill per the user's direction ("almost full screen view... tab bar floating at bottom")
- Added `I.Tasks` and `I.Sparkle` icons; `tasks` and `ai` routes render a shared `PlaceholderScreen` ("Coming soon") — no flows designed for those tabs yet
- Bumped `HomeScreen`'s scroll bottom padding (24px → 94px) so its last card clears the new floating tab bar

**Design decisions made in conversation before building** (see `CalendarScreen` section above for the resulting implementation): flat `Room` model over a full `ROOM_TYPES` table (API will supply rooms directly, keep the app dumb); tap-vs-pan disambiguated by movement threshold, not long-press or a mode toggle; block creation reuses the existing two-tap pattern rather than press-drag-to-range; date header fixed/frozen, but the room column is a narrow truncated strip rather than a full-width frozen column (host-entered room names aren't guaranteed short); fixed-width day columns, no pinch-zoom; loads anchored to today with a "Today" snap-back button.

**Same-session follow-ups, after the first pass was tested on-device:**
- Fixed a real bug, not just a workaround: `.page`'s `will-change: transform` (added for the slide-transition) forces it to permanently establish its own stacking context per spec, which trapped every sheet/modal rendered inside any screen below the floating tab bar's z-index no matter how high the sheet's own z-index was set. Removed `will-change: transform` — fixes it for every sheet on every screen, not just Calendar's
- Restyled reservation/blocked bars as right-pointing chevrons (`clip-path`) with a palette remapped to the PMS legend (onboard→checked-in/onboard blue, check-in→lighter checked-in-online blue, check-out→tan, confirmed→dark navy/future-arrival, open→coral/optional); added a housekeeping status dot (`clean/dirty/progress/supervision`) after each room name; corner cell shows the current month, computed live from `panX`
- **Room types are now collapsible** with real per-section sticky-with-push headers (see `CalendarScreen` section above for `calBuildRows`/`pinnedOffset`) — reverses the earlier "always fully expanded" decision once the always-flat list turned out to take too much vertical space with more rooms on screen
- Block-date flow refined to match the user's exact spec: tapping the same date twice now blocks that single night (previously cancelled the selection); the pending-selection marker is a solid grey fill ("greyed") instead of a dashed outline; the "+" button's room picker auto-expands a collapsed type and pans/centers the grid to the chosen room so the user can see what they're selecting
- Trimmed `ROOMS` from a 25-room stress-test set back down to ~14 (every id actually referenced by `RESERVATIONS`/`BLOCKS`, plus a couple of spares per type) once the bulk/long-name testing purpose was served
- Added `TASKS` tab: `tasks-screen.js` (`TasksScreen` + `BriefingScreen`), `BRIEFING_ITEMS`/`TASKS` in `data.js`, `tasks` state lifted to `App`. Renamed the "AI" tab label to "Ask Sabee"
- **Published the prototype**: pushed the built `Design/` output to a new GitHub repo the user created (`github.com/szurmikt/go-mock`) and enabled GitHub Pages via the API — live at `https://szurmikt.github.io/go-mock/`. (Repo creation via the API was blocked by the Claude Code sandbox's auto-mode safety classifier and had to be done manually by the user instead; pushing to a user-created repo and enabling Pages went through fine)

### 2026-05-03 — Session 3

**Home screen redesign (merged with Arrivals):**
- Created `home-screen-old.js` as a backup of the original dashboard home screen
- Rewrote `home-screen.js`: removed tile grid, occupancy donut, ADR/RevPar tiles, feedback card
- New HomeScreen layout: header → search → Segment (day picker) → stat block → arrivals list
- Moved `Segment` and `ReservationCard` components from `arrivals-screen.js` to `home-screen.js` (load order requires this — home loads before arrivals in SCRIPT_ORDER)
- Exposed `window.Segment` and `window.ReservationCard` so `ArrivalsScreen` can still reference them
- Cleaned up `arrivals-screen.js`: removed the now-moved components, updated `/* global */` comment, removed unused `useMemo` from destructure

**Three device bug fixes (reported via iPhone 14 / iOS 26 screenshots):**
- **FAB too high**: reduced `.fab` bottom from `calc(24px + env(...))` → `calc(16px + env(...))`. Reduced GuestDetailScreen scroll padding from `100px` → `80px`
- **Sheet bottom space too large**: changed `.sheet` padding-bottom through multiple iterations: `24px` → `12px base` → `0 base`, landing on `env(safe-area-inset-bottom, 8px)` (no extra fixed base). Also added `padding-bottom: 8px` to `.action-item:last-of-type` (down from 14px) for native-feeling wrap
- **Sheet backdrop**: changed `.sheet-backdrop` from `position: absolute` to `position: fixed; inset: 0`. Added `max-width: min(440px, 100%); margin: 0 auto` on `.sheet` inside `@media (min-width: 720px)` to keep sheet contained on desktop

**Status bar in PWA mode:**
- Changed `apple-mobile-web-app-status-bar-style` from `default` → `black-translucent` in `build.py`
- Added `padding-top: env(safe-area-inset-top, 0px)` to `.page` and `.login-page` in `styles.css`
- In PWA mode: status bar becomes transparent; dark modal overlay shows through it, dimming the status bar area. In browser mode: `env(safe-area-inset-top)` = 0 so no layout change

**CLAUDE.md created** — comprehensive project brief for session continuity

### 2026-05-02 — Session 2 (reconstructed from context)

- Full login flow: LoginScreen + MFAScreen with OTP auto-submit and shake error
- PropertySelectScreen — post-login mandatory property chooser
- Property state + in-app property switching (bottom sheet with blue dot active indicator)
- PROPERTIES data in data.js
- app.js routing: login → mfa → property → home
- Language selector dropdown replacing pill buttons
- iOS keyboard fixes for MFA: `html { overflow: hidden }`, `height: 100svh`, `interactive-widget=resizes-visual`, 350ms delayed focus
- `.btn` height bug fix: `width: 100%` not `flex: 1`
- Status title nowrap fix: `-webkit-text-size-adjust: none` + `white-space: nowrap`
- Design system tokens: font scale, shadow scale, 3-level radius
- Compact density `--pad: 14px`
- `.tappable` as generic class; `.guest-card` card token usage
- `viewport-fit=cover` + PWA meta tags
- Removed FAB, action rail, segment tabs from ReservationDetailScreen
- Scrollable Arrivals with IntersectionObserver scroll-aware header
- Unified res-card and guest-card left-border (`border-left` direct, no accent div)
- Added: EditGuestScreen, SearchScreen, IDScanScreen, BlockDateScreen

### 2026-05-02 — Session 1 (reconstructed)

- Initial project setup: `build.py`, `styles.css`, `index.html` output pattern
- Initial screens: HomeScreen with tiles, ArrivalsScreen, ReservationDetailScreen, GuestDetailScreen
- Design token system: colors, spacing, card variants, pill variants, density variants
- Tweaks Panel integration

---

## 9. Up Next

Roughly prioritised — confirm with user before starting:

### Angular app (`app/`) — follow-up from Session 6
- [x] **Delete the now-dead `/id-scan` result + failure overlays** — done in Session 10. Removed the result + TIMEOUT/CANCELLED/INTERRUPTED overlays from [id-scan.page.html](app/src/app/pages/id-scan/id-scan.page.html); camera + scanning phases retained. The route still exists; `?preview=…` deep-links into the removed overlays are gone (guest-detail's `?previewScanSheet=…` covers the same modes)
- [ ] **Verify cancelled / noshow API strings against real data** — Session 6 used educated-guess keys `cancelled` and `noshow`. Once a real reservation with one of these statuses comes through the API and renders as the grey "Option" pill, update the two `case` strings in `pillStatus` / `pillLabel` ([services/reservation.ts](app/src/app/services/reservation.ts#L15-L37))
- [x] **Guard `DocumentReaderService` for web** — done in Session 16. Wrapped the constructor's Regula `processParams`/`functionality` writes (and an `init()` early-return) with `Capacitor.isNativePlatform()`, so injecting on guest-detail no longer throws `cordova is not defined` in browser/Electron. Resolved Sentry SABEEAPPGO-2/4. The `reader = DocumentReader.instance` field initializer was left as-is (it doesn't throw on its own — the crash was at `set dateFormat`)
- [x] **RFID NFC chip read failing / Regula scan timeout** — moot: Regula was removed entirely (2026-08-28, see `../app/CLAUDE.md`'s changelog), IDScanly is now the sole scan backend and has no RFID/chip-reading path at all (accepted, deliberate scope loss, not a bug to fix).

### Screens to build
- [ ] **Departures screen** — dedicated view for today's departures (check-out times, balance due, room key return)
- [ ] **Notifications screen** — target for the Bell icon on HomeScreen
- [ ] **Tasks tab** — currently a `PlaceholderScreen` ("Coming soon"); no flows designed yet
- [ ] **"Ask Sabee" tab** — currently a `PlaceholderScreen` ("Coming soon"); no flows designed yet

### CalendarScreen polish (Session 4 prototype)
- [ ] **Preserve pan position across navigation** — `CalendarScreen` unmounts on `go("reservation", …)` (single-active-screen stack model) and remounts fresh on `back()`, resetting pan to the today-anchor. Acceptable for the prototype; would need pan state lifted to `App` to fix
- [ ] **Weekend/past-date shading** — the real PMS fades past dates and often tints weekends; not implemented yet
- [ ] **Room search/jump** — no way to jump directly to a specific room row yet, only pan
- [ ] **Multi-day drag-select** — block creation is tap-tap only (per earlier user decision); a press-drag range-select was considered and explicitly deferred

### Features to add to existing screens
- [ ] **Services panel** on ReservationDetail — list extras (Breakfast, Airport Transfer, etc.) with quantities and prices from `SERVICES` data
- [ ] **Finances panel** on ReservationDetail — room cost, services total, amount paid, balance; from `FINANCES` data
- [ ] **Filter sheet in Arrivals** — once filtering is needed (by status, room type, source channel), reintroduce the filter icon button in `.section-title` and design the sheet. Icon was removed in Session 8 since it was cosmetic
- [ ] **Check-in / Check-out action flow** — after tapping a status pill, show a confirmation flow rather than just cycling
- [ ] **Multi-month calendar** — add prev/next month navigation to BlockDateScreen

### Polish / fixes
- [ ] **Notification badge** — Bell icon should show a count bubble
- [ ] **Stagger animation consistency** — some lists use `.stagger`, others don't; make consistent
- [ ] **Empty state for "no arrivals" day** — when Yesterday or Tomorrow has no reservations matching the filter

### Stretch / future
- [ ] **Dark mode** — CSS tokens are structured to support it; needs `[data-theme="dark"]` override block
- [ ] **Haptic feedback** — `navigator.vibrate()` on confirmations for presentation realism
- [ ] **Real API integration** — replace hardcoded `data.js` with fetch calls to SabeeApp API

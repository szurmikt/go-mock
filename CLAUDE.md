# SabeeApp Go — Design Prototype · Project Brief

> **Read this file at the start of every session.** It is the single source of truth for project context, design decisions, and current state. No additional explanation from the user should be needed to continue work.
>
> After making significant changes, update the Changelog and any stale sections before ending the session.

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

**How the build works:**
1. Edit source files (`.js`, `.jsx`, `.css`)
2. Run `python3 build.py` from the Design directory
3. `build.py` reads each file in `SCRIPT_ORDER`, wraps it in `<script type="text/babel">`, and writes `index.html`
4. Open `index.html` directly in a browser — works as `file://` URL, no server needed
5. `styles.css` is linked by relative path and is **not** inlined — CSS edits take effect without rebuilding

**`SCRIPT_ORDER` in `build.py` (order matters — globals must be defined before use):**
```
icons.js → data.js → login-screen.js → property-screen.js →
home-screen.js → arrivals-screen.js → detail-screens.js →
tweaks-panel.jsx → app.js
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
├── data.js                # Hardcoded data: RESERVATIONS, GUESTS, SERVICES, FINANCES, PROPERTIES
│
├── login-screen.js        # LoginScreen + MFAScreen
├── property-screen.js     # PropertySelectScreen (post-login mandatory property chooser)
├── home-screen.js         # HomeScreen (merged arrivals view) + Segment + ReservationCard
├── home-screen-old.js     # BACKUP of original home screen (tiles, occupancy, ADR, RevPar)
│                          #   NOT in SCRIPT_ORDER — never built, kept for reference only
├── arrivals-screen.js     # ArrivalsScreen (dormant) + ReservationDetailScreen
├── detail-screens.js      # GuestDetailScreen + EditGuestScreen + SearchScreen + IDScanScreen
│                          #   Also contains Row, Tiny, SectionTitle helper components
│
├── tweaks-panel.jsx       # TweaksPanel + useTweaks hook + all Tweak* controls (reusable utility)
└── app.js                 # App root: stack navigation, PageTransitions, BlockDateScreen, BottomNav
```

**Globals exposed via `window.*`** — each file sets these; later files read them as globals:

| File | Exposes |
|---|---|
| `icons.js` | `I`, `StatusBar`, `Pill`, `Toast` |
| `data.js` | `RESERVATIONS`, `GUESTS`, `SERVICES`, `FINANCES`, `PROPERTIES` |
| `login-screen.js` | `LoginScreen`, `MFAScreen` |
| `property-screen.js` | `PropertySelectScreen` |
| `home-screen.js` | `Segment`, `ReservationCard`, `HomeScreen` |
| `arrivals-screen.js` | `ArrivalsScreen`, `ReservationDetailScreen` |
| `detail-screens.js` | `GuestDetailScreen`, `EditGuestScreen`, `SearchScreen`, `IDScanScreen` |
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

**Full icon list:** `Search`, `Bell`, `Settings`, `ChevronDown`, `ChevronBack`, `ChevronRight`, `Scan`, `Calendar`, `ArrowIn`, `ArrowOut`, `Users`, `Bars`, `Comment`, `Filter`, `Home`, `HomeFill`, `Grid`, `GridFill`, `IDCard`, `Phone`, `Phone2`, `Mail`, `Briefcase`, `Door`, `Check`, `Plus`, `X`, `Bolt`, `Edit`

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
        BottomNav (hidden — showNav = false in app.js)
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
- `setRootTab(name)` — replace full stack with root screen

Page transitions: 320ms slide right (forward) / slide left (back), cubic-bezier(0.32, 0.72, 0, 1).

**Full routing in `renderScreen`:**
```
login → property → home
mfa → property → home
home → search / reservation / idscan / blockdate
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

### `ArrivalsScreen` (`arrivals-screen.js`) — DORMANT

This screen still exists in the codebase and routing but is no longer navigated to from the Home screen. `Segment` and `ReservationCard` have been moved out of this file to `home-screen.js`. The `ArrivalsScreen` references them as globals.

### `ReservationDetailScreen` (`arrivals-screen.js`)

- **Detail block** (`.detail-block`): reservation ID (blue), tappable status pill (cycles: confirmed → onboard → check-in → check-out → …, shows toast on change), guest name, fact-grid (check-in time, check-out time, guest composition, partner, room/type)
- **"Guests" section title** (`.section-title`)
- **Guest cards** (`.guest-card tap-anim tappable`): for each guest — ID + (Booker) badge, name, mini fact-grid (Age, Gender, Nationality, Reporting), scan button top-right (→ IDScanScreen); card tap → GuestDetailScreen

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

### No FAB or segment tabs on ReservationDetailScreen
The original design had FAB + action rail + Guests/Services/Finances segment tabs. These were removed: the screen now has a flat layout (detail block → Guests section → guest cards). A FAB still exists on GuestDetailScreen for the action menu.

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

---

## 8. Changelog

### 2026-06-03 — Session 19 (current) — Mixpanel product analytics + new app icon/splash/logo

> Note: All changes are in the Angular/Ionic app (`app/`). Branch `MixPanel-Integration`. **Shipped builds: iOS 72→73 (TestFlight), Android versionCode 15→16 (signed AAB `sabeeapp-go-v16.aab`).** Builds 72/v15 shipped *before* the EU-host fix and **don't report analytics** — 73/v16 are the keepers. Android AAB is built but **not auto-uploaded** (manual Play Console drag-drop, Internal testing).

**Mixpanel analytics integrated** (`mixpanel-browser` — Capacitor WebView covers web/iOS/Android). Init in [main.ts](app/src/main.ts) mirroring Sentry; token in [environment.ts](app/src/environments/environment.ts)/[environment.prod.ts](app/src/environments/environment.prod.ts) (`mixpanelToken`, same prod token in dev for now — TODO dedicated dev project). Full event reference: [app/docs/mixpanel-tracking-plan.md](app/docs/mixpanel-tracking-plan.md).

- **⚠️ EU data residency — the project is on `eu.mixpanel.com` (project 4029913).** The JS SDK defaults to the **US** ingestion host, so events were silently dropped (Verify Connection spun forever, zero data). Fix: `api_host: 'https://api-eu.mixpanel.com'` in `mixpanel.init` ([main.ts](app/src/main.ts)). This was the one non-obvious gotcha — **do not remove `api_host`**. Verified end-to-end: events arrive in the EU project with `API Endpoint: api-eu.mixpanel.com`.
- **New [MixpanelService](app/src/app/services/mixpanel.ts)** — defensive wrapper (every call in `try/catch`; analytics must never break the app), depends on nothing app-level so it injects into `AuthService`/`DocumentReaderService` with **no DI cycle**. Holds session state + typed `track*` helpers.
- **Identity centralised at AuthService chokepoints** ([auth.ts](app/src/app/services/auth.ts), mirrors Session-17 `clearSessionData`): `identify(user_id)` from `fetchUser`/`selectProperty` (covers fresh login, restore, backfill); `reset()` in `logout()` (covers all 4 logout paths); `login_completed` in `verifyMfa`. Profile (`people.set`) carries only the **staff** user's `$name`/`$email` + property — **no guest PII** anywhere (search sends `query_length`/`from_recent` not text; scans send document *type* not number/name).
- **Sessions** driven by the existing `App.appStateChange` listener ([app.component.ts](app/src/app/app.component.ts)): `session_started` (cold start / resume after >30 min idle) + `session_ended` (`duration_seconds`); `session_id` registered as a super property. Super props: `app_version`, `platform`, `environment`, `api_mode`, `session_id`.
- **Action events** at their call sites: `home_segment_changed` + `property_switched` ([home.page.ts](app/src/app/home/home.page.ts)), `search_performed` ([search.page.ts](app/src/app/pages/search/search.page.ts)), `guest_updated{from_scan,fields_changed}` ([guest-edit.page.ts](app/src/app/pages/guest-edit/guest-edit.page.ts)), `scan_result_edited`/`scan_result_saved` ([guest-detail.page.ts](app/src/app/pages/guest-detail/guest-detail.page.ts)), and `scan_succeeded{attempts}`/`scan_failed{reason,attempt_number}` via the single `logScanOutcome` chokepoint ([document-reader.service.ts](app/src/app/services/document-reader.service.ts), `_scanAttempts` counter incremented in `scan()`). Scan events are native-only (won't fire in `ionic serve`).
- Bumped the Angular initial-bundle budget 2.0→2.5 MB ([angular.json](app/angular.json)) — `mixpanel-browser` (~50 kB) crossed it.

**New app icon + splash + login logo.** User provided a 500×500 square brand badge (`/tmp/sabeeapp_go_icon01.png`, cream mark on blue `#0080ff`). Installed `@capacitor/assets` (+ `npm run resources` script). Source assets live in [app/assets/](app/assets/) (`icon-only.png` full-bleed, `icon-foreground.png` keyed mark on transparent for Android adaptive, `icon-background.png` solid `#0080ff`, `splash.png`/`splash-dark.png`). Generated all iOS + Android icons + splashes (light/dark). Login + update-required screens swapped from the horizontal wordmark to the square badge (rounded, [login.page.html](app/src/app/pages/login/login.page.html) 112px, [update-required.page.html](app/src/app/pages/update-required/update-required.page.html) 96px) via new `src/assets/app-icon.png`; old `logo-sabeeapp-go.png` kept for easy revert. **Caveat:** source was 500×500 (upscaled ~2× to 1024 for icons) — a ≥1024 or vector master would be crisper for final store assets.

**Verification:** `npm run build` passes (only the known `global.scss` Sass deprecation). Mixpanel verified live in the EU project via `ionic serve` (`session_started`/`ended`, `identify` with distinct_id = staff user_id, correct super-props, action events). Icon/splash verified by rendered preview (iOS rounded + Android circle-masked). Scan events + on-device icon/splash require a device build (73/v16).

### 2026-06-02 — Session 18 — Auto-detect scanned doc type + capture Hungarian address card

> Note: All changes are in the Angular/Ionic app (`app/`). Branch `AddressCard-Scan-added`. **Shipped builds: iOS 68→71 (TestFlight), Android versionCode bumped to 14 (signed AAB).** Builds: 68 (Hungarian address + NFC feature), 69 (RFID availability diagnostic), 70 (NFC entitlement — the actual enablement), 71 (RFID data-group limiting). The scan-routing + address-capture below was developed in a parallel session; the **NFC enablement + RFID tuning** are this session's work.

**One scan action auto-routes by detected type — no second button.** The user verified (Regula's own DocReader app) that the **Hungarian address card (lakcímkártya)** *is* recognized by the SDK (`DocumentType.AddressCard = 183`) and its residence address is OCR'd as a single combined string. The app already runs `Scenario.FULL_PROCESS` and Regula returns the document type on every scan, so detection is free — we don't need an "Address Card scan" button or any pre-selection. The guest-detail FAB action was renamed **"ID Scan" → "Scan Document"** ([guest-detail.page.html](app/src/app/pages/guest-detail/guest-detail.page.html)); a single type-agnostic action now fills identity fields from passports/IDs/licences and the **address section** (added Session 17, previously manual-entry only) from an address card.

- **`Config` doc-type lists are labels, not gates** ([config.ts:18-31](app/src/app/config/config.ts#L18-L31)) — they only translate the detected type into a `document_type` string for the `regula_id === 0` field. `AddressCard = 183` was deliberately **not** added (it'd mislabel it "id"); scanning works regardless.
- **Address capture** ([document-reader.service.ts](app/src/app/services/document-reader.service.ts)): new `captureAddressFields()` reads `FieldType.PLACE_OF_REGISTRATION (69)` (fallback `ADDRESS (17)`) directly — hardcoded, independent of the server `fieldsToScan` config — and derives `country_code` from the issuing-state code (field 1, already read as `issuingAuthority`, 3-letter format matching `CountryOption.country_code`). Emits dedicated `address_*` keys (not `country_code`, which the citizenship logic owns) into `scannedGuestData`. Identity docs return neither field, so it's inert for them.
- **Address parser** ([utils/hungarian-address.ts](app/src/app/utils/hungarian-address.ts) + `.spec.ts`, 7 tests): `parseHungarianAddress()` splits the combined string (`"6100 KISKUNFÉLEGYHÁZA KISKUN UTCA 13"`) into `{ zip, city, address_line }` — leading 4-digit ZIP, then a street-keyword heuristic (utca/út/tér/körút/…) to find the city/street boundary so multi-word city names degrade gracefully; falls back to first-token-city. All-null on blank input. Best-effort, editable prefill.
- **Routing with merge semantics** ([docuscan.ts](app/src/app/services/docuscan.ts)): `scannedDataToGuestScannedData` nests the `address_*` keys into a single `address` object (parallel to the `document` special-case, kept out of the flat top level). `fillGuestDataFromScannedData` now **merges per-field** — `document` and `address` only overwrite sub-fields the scan actually returned, and the flat identity copy skips null/empty — so an address card won't wipe the guest's document/identity, and an identity doc won't wipe the address. Persists via the existing `updateGuest` → `nullifyEmpty(guest)` path (same as Session 17's guest-edit save); no save-path change needed.
- **Result sheet** ([guest-detail.page.html](app/src/app/pages/guest-detail/guest-detail.page.html)): new Address section (Postal code + City two-column, Country via `countryName()`, Address) shown via `@if` only when address data is present — identity scans show identity fields, an address-card scan shows the address. Detected type already surfaces in the existing "Document type" row (falls back to the raw Regula name, e.g. "Hungary - Address card #1"). `MOCK_SCAN_RESULT` extended with address fields so the section is previewable in-browser via `?previewScanSheet=result`.

**NFC/RFID chip reading enabled — the real fix was the iOS entitlement, not the license.** Chipped HU ID cards/passports wouldn't read over NFC: `isRFIDAvailableForUse()` returned false on an NFC-capable iPhone 14. New diagnostic logging (`logRfidAvailability()` in [document-reader.service.ts](app/src/app/services/document-reader.service.ts)) proved via Sentry that **`licenseRfid=true` but `forUse=false`** — the Regula license *does* carry RFID; the gap was the **missing iOS NFC entitlement** (`isRFIDAvailableForUse` = license AND framework/device-NFC, and on iOS the latter requires the entitlement). Fix:
- New [ios/App/App/App.entitlements](app/ios/App/App/App.entitlements) with `com.apple.developer.nfc.readersession.formats = [TAG]` (pairs with the `iso7816.select-identifiers` AID list + `NFCReaderUsageDescription` already in Info.plist).
- `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` wired into both App build configs ([project.pbxproj](app/ios/App/App.xcodeproj/project.pbxproj)).
- `-allowProvisioningUpdates` added to [publish-ios.sh](app/scripts/publish-ios.sh) (archive + export) so automatic signing registers the App ID's "NFC Tag Reading" capability and regenerates the profile non-interactively — signed cleanly first try.
- **Build 70 verified:** Sentry flipped to `forUse=true`; an HU Id Card (2016) read over the chip (`scan_type=rfid`, name extracted).

**RFID limited to text data groups (skip the facial image) for speed.** `configureRfidDataGroups()` runs after `initialize()` (when `reader.rfidScenario` is populated from native) and disables the heavy biometric/image groups on the **eMRTD/ePassport application**: DG2 (facial image — the slow one), DG3/DG4 (fingerprints/iris, EAC-protected), DG5/DG7 (portrait/signature images), DG6 (reserved). Keeps DG1 (MRZ), DG11 (personal details), DG12 (doc details); leaves DG14/DG15 (chip/active auth) at defaults so authentication is unaffected. Each DG setter pushes a *merged* partial update to native, so untouched groups keep their defaults. **Build 71 verified:** chip read noticeably faster, all text fields intact (Sentry `scan_type=rfid`, name/DOB populated; the data-group log fires per scan).

**Multipage modal regression (known, deferred).** This feature switched the scan from Regula's **automatic** multipage (`multipageProcessing=true` — modal stays open, slides between the two captures) to **manual** multipage (`multipageProcessing=false` + `manualMultipageMode=true` + per-page `startNewPage()`/relaunch) to stop the Session-11 passport over-prompt. Side effect: for 2-sided ID cards the scanner modal now dismisses after page 1 and re-opens for page 2 (down/up) instead of the smooth in-modal slide — confirmed against git history (`e7af63f` had `multipageProcessing=true`). Now lower priority since chipped IDs read via the chip (optical 2-page is a fallback). **Open follow-up:** revert that branch to `multipageProcessing=true` to restore the modal-open slide (trade-off: Regula owns the page flow again + the over-prompt risk, mitigated by its built-in "Skip next page" button).

**Verification:** `npm run build` passes (only the pre-existing `global.scss` Sass `@import` deprecation). `hungarian-address.spec.ts` 7/7 pass (ChromeHeadless). **RFID device-confirmed** end-to-end on builds 70/71 via Sentry (`forUse=true`, `scan_type=rfid`, fields populated, faster read). Still not device-verified: a real **address-card** (lakcímkártya) parse→save→persist round-trip (`documentType.type === 183`, address under field `69`); `country_code` format ("HUN" vs other) is best-effort with `countryName()` raw-code fallback.

### 2026-06-02 — Session 17 — Guest Address details section + guest_id-only ID display

> Note: All changes are in the Angular/Ionic app (`app/`). Branch `Add-Address-Section`. **Shipped builds: iOS 63 (TestFlight), Android versionCode 10 (signed AAB `sabeeapp-go-v10.aab`).** These bundle the whole session: Guest Address details, `guest_id`-only ID display, the property-selector field-swap doc fix, and the cross-property data-isolation fix (logout/switch clearing + home `ionViewWillEnter`). The Android AAB is built but **not auto-uploaded** — manual Play Console drag-drop (Internal testing).

**Address details surfaced on Guest Details + Guest Edit.** The guest API returns an `address` object (`{ country_code, zip, city, address_line }`) that was **already in the model** ([guest.interface.ts:18-23](app/src/app/models/guest.interface.ts#L18-L23)) and **already mapped** by `convertGuest()` ([reservation.ts:162](app/src/app/services/reservation.ts#L162), defaults to all-null) — but never displayed or editable. This was purely a UI gap.

- **Field set is only those 4.** The SabeeApp PMS shows a much richer Hungarian-style breakdown (region, street number, building, staircase, floor, door), but the `go` API collapses all of it into the single `address_line`. Matching the full PMS breakdown needs backend changes, out of this app's scope.
- **Order = PMS order (option B), per user**, so it feels familiar to PMS users: **Postal code + City → Country → Address (street)**. Considered envelope order (street→city→zip→country) but PMS-familiarity won. `zip` is labelled **"Postal code"** to match PMS wording.
- **Guest Details (read)** ([guest-detail.page.html](app/src/app/pages/guest-detail/guest-detail.page.html)): new `.card` between Contact details and Travelling document — Postal code + City (two-column, mirrors the Birth date/place row), Country (resolved to name), Address. Always renders with `—` placeholders for blanks (matches Contact/Document sections). Added `countryName(code)` to [guest-detail.page.ts](app/src/app/pages/guest-detail/guest-detail.page.ts) for the country-code→name lookup against `options.countries()`; the existing `citizenshipName()` now delegates to it (same lookup, clearer name).
- **Guest Edit** ([guest-edit.page.html](app/src/app/pages/guest-edit/guest-edit.page.html) + [guest-edit.page.ts](app/src/app/pages/guest-edit/guest-edit.page.ts)): new form group (Postal code, City, Country select reusing the same `options.countries()` dropdown as citizenship, Address). `form` extended with the 4 fields, pre-populated from `found.address?.*` in `ngOnInit`, written back via an `address` object in `save()`. Empty fields become `null` through the existing `nullifyEmpty()` ([reservation.ts:209](app/src/app/services/reservation.ts#L209)), matching the API's nullable address — no save-path or list-sync change needed.

**Guest ID display unified to `guest_id` everywhere.** The Guest Details screen showed `reservation_guest_id` (the per-reservation join ID, e.g. 41539072) while the reservation guest card showed `guest_id` (the persistent person ID, e.g. 24195367) — same guest, two different "ID" labels. Per user, `reservation_guest_id` is a technical ID and should never be exposed. [guest-detail.page.html:31](app/src/app/pages/guest-detail/guest-detail.page.html#L31) now shows `g.guest_id` (guarded by `@if (g.guest_id)`), matching the card. All remaining `reservation_guest_id` references are technical-only (the `@for ... track` key, the `loadGuest()` lookup, the `updateGuest` payload) and untouched. This reverses the display half of Session 13's decision (which had switched the row to `reservation_guest_id`).

**Verification:** `npm run build` passes (only the pre-existing `global.scss` Sass `@import` deprecation warning). Device/serve end-to-end (load address, edit + save + persist, empty-address `—` state) not yet run on a real build.

**Property selector field swap — root-caused to the API, fixed server-side, no app change.** The property rows (Select Property screen, home Switch Property sheet, home header title) were showing the **company/legal name bold on line 1** and the friendly hotel name small on line 2 — backwards. A user screenshot was conclusive: "4 Évszak Mátra Kft." (one company) appeared bold on three rows, each with a different hotel name (Erdei-/Hegyi-/Völgyhotel) below; the list was even sorted by the line-2 (hotel) value via [`sortPropertiesByCompany`](app/src/app/services/auth.ts#L15-L28) (which sorts by `property_company_name`).

- **Root cause was server-side, not the app:** the properties API had the two fields **swapped relative to their names** — `property_name` returned the *company* name and `property_company_name` the *friendly hotel* name. The templates render `property_name` bold (Session 15), so the swap surfaced as "company bold." This was **systemic across all properties**, not the one-off data-entry mismatch the Session 15 entry below claims (that claim was wrong — see correction there).
- **API developers fixed it.** The endpoint now returns fields matching their names: `property_name` = friendly hotel name, `property_company_name` = company name. With the corrected data, the **existing app code is already correct** on all three surfaces — hotel name bold on line 1 (+ `property_id` on the two selectors, none on the title), company on line 2 — and `sortPropertiesByCompany` now genuinely sorts by company (the user's chosen sort). **No code change was made, by design.** ⚠️ **Do not "swap the property fields" in the templates** — post-fix that would re-break the display (company bold).
- **Runtime caveat:** the property list is cached in device storage (`STORAGE_PROPERTIES_KEY`, [auth.ts:64-66](app/src/app/services/auth.ts#L64-L66)) and restored on launch. A session authenticated **before** the server-side fix keeps showing the stale swapped data until the list is re-fetched — **log out/in (or re-select the property)** to pull corrected fields. Verify in Postman that `property_name` = hotel and `property_company_name` = company (e.g. Three Corners Hotel Anna / Királyi Art Kft.).

**Cross-property data leak — reservations/guests now cleared on logout & property switch (data-isolation bug).** A user reported (severe) seeing **another property's reservations** on the home screen after logging out and back in. Root cause: reservation/guest data lives only in memory — `ReservationService` (`_reservations` signal, `_guestCache` Map, `_fetchedAt`) and `DocuscanService._lastScanResult` — and **`AuthService.logout()`/`selectProperty()` never cleared it**. Combined with the 60-second staleness gate in `fetchReservations` ([reservation.ts:69](app/src/app/services/reservation.ts#L69)), a fresh login (or property switch) landing inside that window served the **previous** property's cached list. The home switcher happened to clear it ([home.page.ts:126-130](app/src/app/home/home.page.ts#L126-L130)), but the **post-login Select Property screen and logout did not** — exactly the reported path.

- **Fix centralised at the chokepoint** ([auth.ts](app/src/app/services/auth.ts)): new private `clearSessionData()` calls `reservations.clear()` + `docuscan.clear()`. Called from **`logout()`** (always) and **`selectProperty()`** (when the `property_id` actually changes). Every logout path now benefits (settings, interceptor 401, lock-overlay, login secret-tap) plus both property selectors — no reliance on individual screens remembering to clear. Added `DocuscanService.clear()` ([docuscan.ts](app/src/app/services/docuscan.ts)) to null `_lastScanResult` (scanned guest PII). `ReservationService.clear()` already existed.
- **No DI cycle:** `ReservationService`/`DocuscanService` don't depend on `AuthService` (verified — build has no cyclic-dependency error). Reservations/guests are **memory-only** (no persisted storage key), so clearing the service state fully satisfies "remove from storage/memory/cache"; nothing to wipe in device Preferences.
- **Deliberately out of scope:** `OptionsService` (countries/genders — global reference data, not guest/reservation data; components already clear+reload it on switch), `DocuscanService.fieldsToScan` (scan-field config, not PII), and `DocumentReaderService.scanResult` (transient Regula state, only displayed mid-scan; not injected into `AuthService` to avoid early native-plugin construction on web). The briefing screen is hardcoded mock data.

**Follow-on: empty home arrivals after logout→login→Select Property — home now loads on `ionViewWillEnter`.** Clearing the stale list (above) exposed a latent bug it had been masking: `HomePage` fetched reservations only in **`ngOnInit`** ([home.page.ts](app/src/app/home/home.page.ts)), which fires once per component creation — **not** on Ionic view re-entry. After logout→login→Select Property, Ionic reuses the cached home view, so `ngOnInit` didn't re-run and (with the list now correctly empty) the user saw a blank arrivals list until a pull-to-refresh or full reload. Fix: `HomePage` now implements `ViewWillEnter` and fetches in **`ionViewWillEnter`** (fires on every entry; the 60s staleness gate dedupes back-navigation), matching the pattern already used by `GuestDetailPage`. The in-place home property switcher still fetches explicitly in `selectProperty` (no view re-entry there).

- **Verification:** `npm run build` passes. Manual: log in to property A, view arrivals; log out; log in and pick property B → home must show **only** B's arrivals **with no pull-to-refresh needed** (and a guest opened under A must not appear under B). Repeat via the home property switcher.

### 2026-06-01 — Session 16 — Guest Card crash fix + string/integer ID handling (encryption-removal fallout)

> Note: All changes are in the Angular/Ionic app (`app/`). **Shipped builds: iOS 61 (TestFlight), Android versionCode 8 (signed APK).** Branch `Fixing-GuestID-and-PropertyID`.

The backend team **removed the encryption** from `client_id` / `guest_id` / `property_id` on the **TEST** API, so those IDs now come back as **plain integers** instead of encrypted **string** tokens (PROD still returns strings). This surfaced two bugs, both reported via Sentry, both fixed here.

**Bug 1 — Guest Card wouldn't open on web/Electron (`ReferenceError: cordova is not defined`)** ([services/document-reader.service.ts](app/src/app/services/document-reader.service.ts)):
- Sentry **SABEEAPPGO-2** (7 users / 189 events) and **SABEEAPPGO-4** (5 users / 36 events), both on `/guest/:code/:guestId/`, both still firing minutes before the session. Root cause was the long-documented "Known regression risk" (§9): `DocumentReaderService` is `providedIn: 'root'` and its **constructor eagerly touches the Regula native plugin** (`this.reader.processParams.dateFormat = …`), which reaches through to the cordova bridge. On web/Electron (`ionic serve`, `localhost:4200`, `environment=development` — confirmed from the event tags) `cordova` is undefined, so constructing the service threw during Angular DI, which **aborted construction of `GuestDetailPage`** (it injects the service) → the card never rendered. Native iOS/Android builds were never affected (cordova exists there).
- **Why now:** before the encryption removal the guest route param was an encrypted token; now it's a plain integer, so QA actually navigates to the guest card in the browser, exposing this pre-existing latent web-only crash.
- **Fix:** guard the native access with `Capacitor.isNativePlatform()` — wrap the three `processParams`/`functionality` assignments in the constructor, and early-return at the top of `init()`. Scanning is native-only anyway, so this is behaviourally inert on device. The `reader = DocumentReader.instance` field initializer was left as-is (the stacktrace showed the throw at `set dateFormat`, after `.instance` returned, so it's safe).

**Bug 2 — "Guest not found" on the guest card (string vs integer ID mismatch)** ([services/reservation.ts](app/src/app/services/reservation.ts)):
- Once the page constructed, it showed "Guest not found" with **no** Sentry error (silent logic miss). Cause: `loadGuest()` does a **strict** `guests.find(g => g.reservation_guest_id === this.guestId)`. The route param is always a string (`"21405092"`); after encryption removal the API returns `reservation_guest_id` as a **number** (`21405092`), so `"21405092" === 21405092` is `false`. The old code only worked on PROD by accident (both sides were strings).
- **Fix — normalize at the boundary, not at every comparison.** `convertGuest()` now coerces `reservation_guest_id` and `guest_id` to `String(...)`; `convert()` coerces `booker_id`; `updateGuest()`'s booker-match comparison is hardened to `String(...) !== String(...)`. `String()` is identity on a string and a converter on a number, so **PROD (string) passes through unchanged and TEST (integer) normalizes to the same string** — no env-specific branch, safe on both. Normalizing once at the API boundary (rather than per-comparison) fixed three read sites at once: guest-detail, id-scan, and guest-edit all read the same normalized guests, and the TS `reservation_guest_id: string` contract is honest again.
- **Verified on TEST end-to-end:** guest card opens; editing a guest saves (`updateGuest` POSTs `guest_id` as a string and the TEST write endpoint accepts it — `success: true`); pull-to-refresh refetches from the API and shows the persisted change. PROD's save path is unchanged (it already used strings).

**Resolves Sentry SABEEAPPGO-2 and SABEEAPPGO-4.**

**Build/version:** iOS `CURRENT_PROJECT_VERSION` → 61 (`publish:ios` → TestFlight). Android `versionCode` → 8; built a **signed release APK** via `gradlew assembleRelease` (the `publish:android` script only makes an AAB — APK was requested), tagged `sabeeapp-go-v8.apk`, signed with the `signingConfigs.release` keystore (`CN=SabeeApp`).

**Follow-up (same session) — more plain-integer IDs after encryption removal; reshipped as iOS 62 / APK v9:**
- **`client_id` unified to `1070` for both TEST and PROD** ([config/config.ts](app/src/app/config/config.ts), [services/auth.ts](app/src/app/services/auth.ts)). The encryption removal means PROD now also accepts a plain integer, so the Session-15 TEST/PROD split (`CLIENT_ID` encrypted hex `'366f7aff6d185668'` vs `TEST_CLIENT_ID: 1000`) collapsed to a single `CLIENT_ID: 1070`; `auth.login()` always sends `Config.CLIENT_ID` (dropped the `isTest()` branch). [docs/token-client-id-test-vs-prod.md](app/docs/token-client-id-test-vs-prod.md) was refreshed with a "RESOLVED (encryption removed)" note at the top; the original investigation is retained as historical context.
- **Morning Briefing property gate set to `6250`** ([pages/briefing/briefing.const.ts](app/src/app/pages/briefing/briefing.const.ts)). `BRIEFING_PROPERTY_ID` was the encrypted hex `'65d60b4abe1e6c90'`; now `'6250'` (string, to match the `String(property_id)` comparison at [home.page.ts:70](app/src/app/home/home.page.ts#L70)).
- **Builds:** iOS `CURRENT_PROJECT_VERSION` → 62 (TestFlight), Android `versionCode` → 9 (signed APK `sabeeapp-go-v9.apk`). Builds 61/v8 carry the old `client_id`/briefing values and will fail PROD login against the updated backend — superseded by 62/v9.

### 2026-05-31 — Session 15 — Feature Request & Feedback collection + login client_id fix

> Note: All changes are in the Angular/Ionic app (`app/`). No build/version bump, no TestFlight upload (local verification only). Branch `Feature-Request-Collection`.

**Feature Request & Feedback collection.** An in-app way for front-desk staff to send feature requests or general feedback, written to the same Supabase second backend used by the version gate (insert-only RLS). Triage happens in the Supabase dashboard.

- **New shared component** [components/feedback-sheet/feedback-sheet.component.ts](app/src/app/components/feedback-sheet/feedback-sheet.component.ts) + `.html` (no `.scss` — design-system classes only). A single standalone bottom-sheet opened from **two** triggers via a template ref (`<app-feedback-sheet #fb />` → `fb.open()`): the **home header lightbulb** (replacing the dead notification bell) and a new **Settings → "Request a Feature"** button above logout. Segmented control (`Feature Request` default / `Feedback`) drives the title + textarea placeholder; reuses the home `.segment` animated-thumb pattern (`@ViewChildren('segBtn')` + `offsetLeft/Width`). Single textarea, full-width Submit. Submit disabled while empty (trimmed) or in-flight.
- **Success/error UX** (per user decision, no toast — the app has none): on success the sheet swaps to an in-sheet confirmation ("Thanks! We'll be in touch if we have questions." + Done button); on error it stays in the form, shows an inline message ("Could not send right now. Please try again."), and preserves the typed text. Insert via the shared `SupabaseService`.
- **Supabase `feedback` table** (already existed) columns confirmed via MCP: `id, created_at` (defaults) + `type, content, user_id, user_name, user_email, property_id, property_name, app_version`. RLS = single insert-only policy (`INSERT`, role `public`, `with_check true`). Insert maps `type` = segment (`feature_request`|`feedback`), metadata captured silently from `AuthService` + `Config.APP_VERSION`. No new column added (user chose "name + ID only").

**`user_id` wired through auth.** `fetchUser()` (`/users/me`) returned `user_id` but discarded it. Added `userId` to `AuthState` ([models/auth.interfaces.ts](app/src/app/models/auth.interfaces.ts)), persisted it in `fetchUser`, exposed `auth.userId` computed. Also broadened the `fetchUser` re-fetch gate in `loadStoredAuth` **and** `selectProperty` to fire when `userId` is missing (`!auth.name || !auth.userId`), so sessions authenticated *before* this change backfill the id on next launch (the first test row had an empty `user_id` for exactly this reason).

**Property display swap — friendly name is now the bold primary.** Session 13 showed `property_company_name` (the legal company, e.g. "Dob Corner Kft.") as the bold identifier. Per user, the friendly `property_name` (e.g. "Zensoft", "Great Example Hotel") is now bold (+ `property_id`), with `property_company_name` as the smaller secondary line — on the **home title** (restructured to stack name over company), the **property switcher**, and the **property-select** screen ([home.page.html](app/src/app/home/home.page.html), [property-select.page.html](app/src/app/pages/property-select/property-select.page.html)). The API contract is `property_name` = friendly, `property_company_name` = company (confirmed via Postman); the earlier "company name in feedback" was an **upstream data mismatch** on one property (company typed into its `property_name`), not our bug. `sortPropertiesByCompany` left as-is (still sorts by company) — flagged, not changed. **[Corrected 2026-06-02, Session 17 — see that entry: this was wrong. The properties API actually had `property_name`/`property_company_name` swapped server-side for ALL properties (not a one-off), so this "friendly is now bold" change in fact rendered the COMPANY name bold. The API team fixed the swap server-side; the app code here is correct only post-fix.]** Feedback stores `property_name` + `property_id` (already correct, no code change).

**Login `client_id` — TEST vs PROD fix.** Test-API login failed with correct credentials. Root cause (found by logging the raw `/token` body, not CORS): the app sent one `client_id` (`'366f7aff6d185668'`) to both envs. **PROD** validates it as an **encrypted** token; **TEST** requires a **plain integer**. So PROD rejected `1000` with `ret_code 1005` "encrypted wrong" and TEST rejected the hex with `ret_code 1003` "must contain an integer". Fix: added `Config.TEST_CLIENT_ID = 1000` and `auth.login()` now sends `this.env.isTest() ? Config.TEST_CLIENT_ID : Config.CLIENT_ID` (mirrors the `apiUrl`/`testApiUrl` split). `1000` is simply what TEST accepted — swap if an official test client id exists. Full write-up for the API team in [app/docs/token-client-id-test-vs-prod.md](app/docs/token-client-id-test-vs-prod.md).

**Login errors now reach Sentry.** `LoginPage.submit()` previously swallowed login failures into a UI sheet — nothing reached Sentry. Added `logLoginError()` ([login.page.ts](app/src/app/pages/login/login.page.ts)): `Sentry.captureException` tagged `context: login` + `api_mode`, with status/url/body diagnostics. Also, since the API signals failures as HTTP 200 `{ success: false, errors }`, `auth.login()` now throws an `Error` carrying the real `ret_msg` (+ `apiErrors`) instead of letting an opaque "cannot read mfa_token" `TypeError` propagate — so the captured reason is meaningful. The user-facing message stays the generic "incorrect credentials" via `extractMessage` (API internals aren't shown to users).

**Verification:** `npm run build` passes (zero errors; only the pre-existing `global.scss` `@import` deprecation). Test + prod login both verified working via the mode-aware `client_id`. Feedback insert + RLS confirmed via Supabase MCP. The `client_id` split and the TEST-vs-PROD `/token` discrepancy are documented for the API team.

### 2026-05-31 — Session 14 — Minimum Version Check (Force Update) via Supabase

> Note: All changes are in the Angular/Ionic app (`app/`). No build/version bump, no TestFlight upload (local verification only).

A launch-time "Force Update" gate, independent of the SabeeApp PMS API. On every cold start *and* on resume from background, the app reads its platform's `minimum_version` from the Supabase `app_config` table and, if `Config.APP_VERSION` (`1.1.0`) is below it, routes to a non-dismissible `/update-required` screen. If Supabase is unreachable within 3s, it **fails open** (lets the user through) so a degraded backend can't lock everyone out.

This is the version-only subset of a larger handoff spec. **Deliberately dropped** (user-confirmed): the kill-switch flag and per-row custom message. The live `app_config` table only has `id, platform, minimum_version, updated_at` — no `kill_switch`/`message` columns, and we did **not** add them. Schema confirmed via the Supabase MCP before coding (RLS `SELECT` policy `"Allow read from app"` grants PUBLIC read, so the publishable key can read).

**New files:**
- [services/supabase.ts](app/src/app/services/supabase.ts) — `SupabaseService`, lazy single `SupabaseClient` from `environment.supabaseUrl`/`supabaseAnonKey`
- [utils/version.ts](app/src/app/utils/version.ts) + [version.spec.ts](app/src/app/utils/version.spec.ts) — `isVersionBelow(current, minimum)`, numeric part-by-part compare with zero-padding (`'1.0'` vs `'1.1.0'`); equal is not below. 6 unit tests, all pass (`ng test --include='**/version.spec.ts'`)
- [services/app-config.ts](app/src/app/services/app-config.ts) — `AppConfigService.runVersionGate()`: resolves platform (`web`→`android`), `getConfig()` races the Supabase query against a 3000ms timeout (`Promise.race`), returns `{ blocked: boolean }`. Sentry `captureMessage('app gated', { level: 'info', tags: { platform } })` on block; `captureException(... 'version_gate config unavailable', { tags: { context: 'version_gate' } })` + fail-open on null. Exports `AppConfig`/`GateResult` types
- [pages/update-required/](app/src/app/pages/update-required/update-required.page.ts) — minimal standalone page, design-system classes only (no `.scss`): logo + "Update required" + hardcoded message. No Update button (iOS App Store ID unknown), no back, no nav

**Modified:**
- [environment.ts](app/src/environments/environment.ts) / [environment.prod.ts](app/src/environments/environment.prod.ts) — added `supabaseUrl` (`https://qiwhynwwgicpyeszecuj.supabase.co`) + `supabaseAnonKey` (publishable `sb_publishable_…` key, safe client-side given RLS). Same in both, mirroring `sentryDsn`
- [app.routes.ts](app/src/app/app.routes.ts) — `/update-required` lazy `loadComponent`, **no** `authGuard`, before the catch-all redirect
- [app.component.ts](app/src/app/app.component.ts) — inject `AppConfigService`; the `appStateChange` resume listener is now registered **before** the boot-time gate's early-return (so resume re-check survives gating) and re-runs `runVersionGate()` on every foreground; the boot gate runs after `apiEnv.init()`, before `loadStoredAuth`, and `return`s early on block (skips auth/biometric/options/inactivity timer)
- **Stale spec fix (incidental):** [api.spec.ts](app/src/app/services/api.spec.ts), [auth.spec.ts](app/src/app/services/auth.spec.ts), [storage.spec.ts](app/src/app/services/storage.spec.ts) imported the old `Api`/`Auth`/`Storage` class names (renamed to `…Service` long ago) — a compile error that blocked the *entire* Karma run. Fixed the import/type names so the suite compiles and `version.spec.ts` can run. **Note:** 7 of those component/service specs still fail with `NG0201: No provider found for HttpClient` (they never set up `provideHttpClient`) — pre-existing harness gap, left alone
- **Dead-pipe cleanup (incidental):** removed the unused `TranslatePipe` from [id-scan.page.ts](app/src/app/pages/id-scan/id-scan.page.ts) (`imports` + `providers` + import line) — it was only referenced in HTML comments, producing an NG8113 build warning. The remaining Sass `@import` deprecation warning in `global.scss` was left as-is (needs a cascade-order-aware `@use` migration; harmless until Dart Sass 3.0)

**New dependency:** `@supabase/supabase-js` (added to `app/package.json`).

**Verification:** `npm run build` passes (the NG8113 warning is gone); `version.spec.ts` 6/6 pass; live `app_config` query + RLS policy confirmed via Supabase MCP. Manual device/serve flows (force-update, fail-open offline, resume re-check) from the plan are ready but not yet run on a real build. **To test the block in-browser** (`ionic serve` is platform `web` → reads the **android** row): set `android.minimum_version` above `1.1.0` in the Supabase Table Editor, reload, then reset to `'1.0'`.

### 2026-05-31 — Session 13 — Surface guest_id and property_id in lists

> Note: All changes are in the Angular/Ionic app (`app/`). Template-only — no TS/SCSS changes, no build bump.

Three small list-row tweaks on branch `Guest+PropertyID-fixes` to make internal IDs visible during QA without opening detail screens. Same `property_id` is shown on both surfaces that list properties, and every guest card now leads with its `guest_id` (previously only the booker had an `.id` row, and it contained only `"(Booker)"` text — non-booker guests had no header row at all).

**Property switcher sheet (home)** ([home/home.page.html:184](app/src/app/home/home.page.html#L184)):
- Property company name now renders as `{{ p.property_company_name }} ({{ p.property_id }})`. The secondary `property_name` row underneath is unchanged

**Property select screen** ([pages/property-select/property-select.page.html:53](app/src/app/pages/property-select/property-select.page.html#L53)):
- Same treatment on the post-login property chooser — `(property_id)` appended to the bold company-name line

**Reservation detail guest cards** ([pages/reservation-detail/reservation-detail.page.html:120-125](app/src/app/pages/reservation-detail/reservation-detail.page.html#L120-L125)):
- The `.id` row is now unconditional and renders `{{ g.guest_id }}` followed by an optional `(Booker)` span (still gated by `isFirstGuest(g)`). Reverses a small piece of Session 8's removal — Session 8 hid the placeholder `ID: 12345` because no real guest ID was wired through; now the real `g.guest_id` is rendered

**Why no build:** templates only, no released-build behaviour change requested. Next iOS/Android publish picks these up automatically.

### 2026-05-29 — Session 12 — Scan-logging fixes + NG0955 track-key flood

> Note: All changes are in the Angular/Ionic app (`app/`).

Follow-up to Session 11 — the new Sentry logging immediately surfaced three issues, all fixed here. **Shipped builds: iOS 57 (TestFlight), Android versionCode 6 (AAB).**

**Cancel no longer raises a Sentry Issue** ([services/document-reader.service.ts](app/src/app/services/document-reader.service.ts)):
- The first cancel logged as both a Log *and* an Issue (SABEEAPPGO-8). Cause: Regula's `DocReaderAction.interrupted()` returns `true` for `CANCEL` too, and the old `isFailure` re-evaluated `interrupted()` independently of the cancel branch. Now `isFailure` is set *inside* the classification chain (CANCEL is matched first and stays non-failure), so only TIMEOUT/INTERRUPTED/error reach Issues; cancels and successes stay Logs-only

**Removed `undefined` ERROR-log noise** ([services/document-reader.service.ts](app/src/app/services/document-reader.service.ts)):
- Each scan start emitted an ERROR-level Sentry Log with message `undefined`. Source: the leftover `@LogMethod` dev decorator on `init()` ran `console.error(new Error().stack…)`. Removed the decorator from `init()` and deleted the dead `LogMethod`/`loggedMethod` helpers

**NG0955 duplicate-track-key flood** ([home/home.page.html](app/src/app/home/home.page.html#L107), [pages/search/search.page.html](app/src/app/pages/search/search.page.html#L64)):
- Sentry Logs were flooded with Angular NG0955 "duplicated keys" (key `""` × ~82) on every reservation-list re-render. Reservation lists tracked by `r.id`, but the reservations *list* endpoint returns no usable `id` (`convert()` does `id: r.id` with no fallback). Switched both lists to `track r.reservation_code` (the real unique key, already used for routing). No TS change

**Build/version:** iOS `CURRENT_PROJECT_VERSION` → 57, Android `versionCode` → 6 (manual Play Console upload via `sabeeapp-go-v6.aab`).

### 2026-05-28 — Session 11 — Maximum Regula scan logging to Sentry

> Note: All changes are in the Angular/Ionic app (`app/`).

**Shipped build: iOS 56 (TestFlight).** Logging-only change — no scan behaviour was altered.

**Motivation:** a tester's UK passport scan repeatedly "timed out", but nothing reached Sentry. Root cause (from the screen recording + code): Regula *read the data page fine*, then got stuck in the multipage "Please provide the next page" loop and hit its **default** timeout. On timeout the app discarded everything Regula returned and showed our own generic "ID Scan Timed out" sheet. `handleCompletion(action, results, error)` was collapsing Regula's three-arg callback into a single `ReaderStatus` enum — `results` ignored, and a timeout carries `error: null`, so the prior `console.error`-only path never fired. We never saw Regula's actual response.

**Maximum per-scan logging** ([services/document-reader.service.ts](app/src/app/services/document-reader.service.ts), [config/config.ts](app/src/app/config/config.ts)):
- New private `buildScanDiagnostics()` + `logScanOutcome()`. Every terminal scan outcome (success, timeout, cancel, interrupted, error) is logged with the full Regula `results`: `documentType`, `processingFinishedStatus`, `morePagesAvailable`, `imageQuality`, `chipPage`, `elapsedTime`, `status`, the raw result JSON, and — on success — the app's mapped/displayed `_scanResult()`, so we can diff "what Regula returned" vs "what the app shows"
- **Logs vs Issues split** (respects the Sentry free Developer plan: 5k errors/mo shared, **separate 5 GB/mo Logs**): all outcomes incl. successes → Sentry **Logs** via `Sentry.logger.{info,warn,error}` (`enableLogs: true` already set in [main.ts](app/src/main.ts#L11)); failures (timeout/interrupted/error) *additionally* raise an **Issue** via `captureMessage`/`captureException` with tags (`regula.action/doc_type/more_pages/multipage`) + a `regula_scan` context. Successes are deliberately not Issues. ~10 testers ≪ both quotas
- Full payload also `console.*`'d for Xcode/Console.app. `rawResult` capped at 16 KB for the Sentry log attribute (full version stays in console)
- Wired into `handleCompletion` (TIMEOUT/CANCEL/INTERRUPTED branches + the stopped → `processResults().then(...)` success path); `handleException` now also `Sentry.captureException`s so init-time prepareDatabase/initialize failures are captured; scan-start breadcrumb added in `scan()`
- Master switch `Config.SCAN_DEBUG_LOGGING` (default `true`) gates the verbose Logs + console dumps; the failure→Issue capture stays on regardless. Flip to `false` to dial back after the testing period

**Deliberately out of scope (follow-up once logs come back):** the actual timeout fix — disabling `multipageProcessing` for passports, raising Regula's `timeout*` params, or salvaging the intermediate `results` Regula returns on TIMEOUT (the SDK confirms intermediate results are available on timeout).

**Build/version:** iOS `CURRENT_PROJECT_VERSION` → 56.

### 2026-05-28 — Session 10 — Localization, font-scale cleanup, id-scan trim + search polish

> Note: All changes are in the Angular/Ionic app (`app/`).

A batch of accumulated work committed together. **Shipped builds: iOS 55 (TestFlight), Android versionCode 5 (AAB).** Both were built from this working tree, so the commit matches what shipped.

**Date/time localization** ([pipes/localized-date.pipe.ts](app/src/app/pipes/localized-date.pipe.ts), [pipes/localized-time.pipe.ts](app/src/app/pipes/localized-time.pipe.ts) new, [pages/reservation-detail/reservation-detail.page.ts](app/src/app/pages/reservation-detail/reservation-detail.page.ts), [reservation-detail.page.html](app/src/app/pages/reservation-detail/reservation-detail.page.html)):
- `LocalizedDatePipe` is now language-aware. A `LOCALE_MAP` translates the app's language code to a day-first BCP-47 locale so English resolves to `en-GB` ("27 May") rather than `en-US` ("May 27"); other languages keep their natural Intl ordering. New `format: 'full' | 'dayMonth'` param (`dayMonth` → `{ day: 'numeric', month: 'short' }`). Marked `pure: false` because the `dayMonth` branch reads the `LanguageService` signal and must re-run on language change (same pattern as `TranslatePipe`). Formatters are cached by `cacheKey`
- New `LocalizedTimePipe` — 24h `HH:MM`, normalizes `"YYYY-MM-DD HH:MM:SS"` → ISO (`replace(' ', 'T')`) so WebKit parses it as local time; falls back to a regex `HH:MM` match
- `ReservationDetailPage` imports `LocalizedTimePipe`; check-in/out rows now render `arrival_date | localizedDate:'dayMonth'` + `checked_in_time | localizedTime` (likewise check-out)

**Font-scale token normalization** ([theme/sabeeapp-design.scss](app/src/theme/sabeeapp-design.scss) + login/mfa/property-select/reservation-detail/settings/guest-detail HTML):
- `:root` tokens redefined: `--font-sm` 13→15, `--font-base` 15→16, `--font-2xl` (26px) removed (unused after the change). Scale is now 12/15/16/17/18/22
- Replaced ad-hoc hardcoded `font-size` literals with `var(--font-*)` tokens across the listed pages and in SCSS (`.pill`, `.toast`, `.res-email`, `.res-meta`, `.fact-value`) — snapping one-off sizes (13/14/15/16/17/22px) onto the nearest scale token
- A few secondary-text colors darkened `--ink-4` → `--ink-3` for legibility (`.stat .label`, `.fact .l`, `.detail-label`)
- The **Typography** section (Section 4) was rewritten to document the new scale, the two surviving off-scale literals (16px inputs, 19px `.detail-value`), and the intentional one-offs

**id-scan dead-overlay cleanup** ([pages/id-scan/id-scan.page.html](app/src/app/pages/id-scan/id-scan.page.html)):
- Removed the now-dead result + failure (TIMEOUT/CANCELLED/INTERRUPTED) overlays (~120 net lines). These were superseded by the guest-detail bottom sheets in Session 6; the normal flow no longer navigated to them. Completes the long-standing "Up Next" cleanup item. Camera + scanning phases retained

**Search field polish + two-line reservation card** ([theme/sabeeapp-design.scss](app/src/theme/sabeeapp-design.scss#L201), [home/home.page.html](app/src/app/home/home.page.html), [pages/search/search.page.html](app/src/app/pages/search/search.page.html)):
- All three inline magnifier SVGs (home search button, home property-filter, search page) swapped to the design-prototype geometry — `circle r="7"`, `path d="m21 21-4.3-4.3"`, `stroke-width="2"`, rounded caps — fixing the "cut-off" look from the old `r="8"`/`stroke-width="2.5"`/square-cap version
- `.search-field`: `gap` 10→8, `padding` `0 14px`→`0 12px` (text closer to icon); input `font-size` 16→18 (primary input; still ≥16px so no iOS auto-zoom). Inline 16px removed from the real inputs so the SCSS rule drives them; home placeholder `<span>` set to 18px directly
- Reservation card date row now stacks date over "X guests / Y nights" via new `.res-when { display: flex; flex-direction: column; gap: 2px; }`; dropped the `·` separator. Applied on home + search cards

**Build/version:** iOS `CURRENT_PROJECT_VERSION` → 55, Android `versionCode` → 5 (bumped by the publish scripts).

### 2026-05-27 — Session 9 — Keyboard polish: sheet corners + iOS window bg

> Note: All changes are in the Angular/Ionic app (`app/`).

Two small visual fixes for what happens when the iOS keyboard opens.

**Sheet bottom corners collapse 48 → 24 when keyboard rises** ([theme/sabeeapp-design.scss:74](app/src/theme/sabeeapp-design.scss#L74), [theme/sabeeapp-design.scss:393](app/src/theme/sabeeapp-design.scss#L393), [app.component.ts:5](app/src/app/app.component.ts#L5), [app.component.ts:66-67](app/src/app/app.component.ts#L66-L67)):

- The Session-7 concentric-corners pattern sets `--sheet-radius-bottom: 48px` on `body.ios-native` so the sheet's bottom corners are concentric with the ~47pt iPhone bezel. That reasoning only holds while the sheet's bottom edge sits next to the bezel
- The property switcher now contains a filter input. When focused, the keyboard pushes the sheet up — the bottom is suddenly floating mid-screen with no bezel near it, and the 48px radius reads oversized vs. the 24px top
- Fix: wire `@capacitor/keyboard` (already a dependency, previously unused) `keyboardWillShow` / `keyboardWillHide` listeners in `AppComponent.ngOnInit` inside the existing `ios-native` block. They toggle `body.keyboard-open`. CSS adds `body.keyboard-open { --sheet-radius-bottom: var(--sheet-radius-top); }` after the `ios-native` rule (later, equal-specificity wins). `.sheet` gets `transition: border-radius 0.2s ease` so corners animate smoothly with the keyboard rather than snapping
- iOS-only is sufficient: Android keeps 24/24 already, nothing to override. Browser preview is unaffected since the Keyboard plugin no-ops on web

**Black gaps at the iOS keyboard's rounded top corners** ([ios/App/App/AppDelegate.swift:10-14](app/ios/App/App/AppDelegate.swift#L10-L14)):

- Visible on the MFA screen (and any keyboard-opening screen): the two triangular gaps next to the keyboard panel's rounded top corners showed black against the otherwise light `#f9fafb` app body
- Root cause traced through Capacitor sources: with `KeyboardResize.Native` (default), the iOS plugin shrinks `webView.frame` ([Keyboard.m:225](app/node_modules/@capacitor/keyboard/ios/Sources/KeyboardPlugin/Keyboard.m#L225)). `CAPBridgeViewController.loadView()` does `view = webView` ([CAPBridgeViewController.swift:46](app/node_modules/@capacitor/ios/Capacitor/Capacitor/CAPBridgeViewController.swift#L46)) — so the VC's view IS the WebView. When it shrinks, the keyboard's rounded-corner gap is outside the VC view entirely. What's left to paint is the `UIWindow`, whose `backgroundColor` defaults to `nil` → black. The existing `capacitor.config.ts ios.backgroundColor: '#f9fafb'` only sets `webView.backgroundColor` + `scrollView.backgroundColor` ([CAPBridgeViewController.swift:308-310](app/node_modules/@capacitor/ios/Capacitor/Capacitor/CAPBridgeViewController.swift#L308-L310)) — not the window. The web-side CSS `body { background: var(--bg) }` is inside the shrunk WebView and can't reach this area either
- Fix: one line in `application(_:didFinishLaunchingWithOptions:)` setting `window?.backgroundColor` to `UIColor(red: 0xf9/255, green: 0xfa/255, blue: 0xfb/255, alpha: 1)`. No new files, no Xcode project edit, no storyboard change, no Capacitor config change
- **Color duplication note:** `#f9fafb` is now hardcoded in three places — `capacitor.config.ts ios.backgroundColor`, the CSS `--bg` token, and `AppDelegate.swift`. Considered deduping via a `CAPBridgeViewController` subclass reading `bridge.config.backgroundColor`, but a subclass + storyboard `customClass` swap was overkill for a stable brand color. Three matching literals + a comment cross-referencing the others wins on simplicity. If the color ever changes, `grep -ri 'f9fafb\|249, 250, 251'` finds them in seconds

**Rejected alternatives for the window-bg fix** (recorded so we don't relitigate):
- Subclass `CAPBridgeViewController` and set `view.backgroundColor` — doesn't work; the VC's view IS the WebView, so setting its bg is identical to what `capacitor.config.ts` already does and the WebView gets clipped to its new smaller frame
- Switch `KeyboardResize` to `body` or `ionic` — also fixes the gaps but is a much bigger change with regression risk on every screen that has an input

**Build uploaded:** iOS 50 via `npm --prefix /Users/tamas/SabeeAppGO/app run publish:ios`. Jump from 46 (last keeper) to 50 reflects three earlier publish invocations that didn't ship — per [Publish script bumps first](feedback_publish_script_bumps_first.md), each consumes a build number even if cancelled.

### 2026-05-26 — Session 8 — Test/Live API switch with hidden gesture + login logo

> Note: All changes are in the Angular/Ionic app (`app/`).

**Test ↔ Live API switch.** For QA workflows we needed to point real TestFlight/Play builds at the test API (`https://smart.sabeeapp.com/api2/go`) without shipping a separate binary. The toggle is a hidden 7-tap gesture on the login screen with persistent mode + on-screen indicators.

**API plumbing** ([services/api-environment.ts](app/src/app/services/api-environment.ts) new; [services/api.ts](app/src/app/services/api.ts), [services/auth.ts](app/src/app/services/auth.ts), [app.component.ts](app/src/app/app.component.ts)):
- New `ApiEnvironmentService` (singleton) owns the active API base via a `mode: 'live' | 'test'` signal. Computed `apiUrl()` returns `environment.testApiUrl` or `environment.apiUrl`. Persists via `StorageService` (Capacitor Preferences) under `STORAGE_API_ENV_KEY: 'apiEnvironment'`
- `ApiService` changed from `private base = environment.apiUrl` (cached-at-construction) to `private get base() { return this.env.apiUrl(); }` — runtime-resolved per request. This was the reason a service was needed instead of mutating the imported `environment` object: a mutation wouldn't update the already-captured `base` string field
- `AuthService`: 5 inline `${environment.apiUrl}/...` template literals (login, MFA verify, fetchUser, refresh, loadProperties) replaced with `${this.env.apiUrl()}`. Constructor now also injects `ApiEnvironmentService`
- `AppComponent.ngOnInit` — `await this.apiEnv.init()` runs as the first await, BEFORE `loadStoredAuth()`. Critical ordering: `loadStoredAuth` immediately fires `/users/me` if a stored token + property exist, so the env must be restored first or the stored token gets sent to the wrong host
- Sentry DSN deliberately left static — same Sentry project regardless of API env, no value in swapping it at runtime

**Hidden gesture + indicators** ([login.page.html](app/src/app/pages/login/login.page.html), [login.page.ts](app/src/app/pages/login/login.page.ts), [home.page.html](app/src/app/home/home.page.html), [theme/sabeeapp-design.scss](app/src/theme/sabeeapp-design.scss)):
- 44×44 invisible button in the bottom-left of `.login-page` (`position: absolute; bottom: env(safe-area-inset-bottom); left: 0`). 44px = Apple HIG minimum so 7 taps in a row aren't flaky; bottom-left less prone to accidental triggering than top-right
- Taps 1–3 silent; tap 4 onward shows a top-center toast "*N* more taps to switch to Test/Live Mode". 2 s inactivity resets the counter. Tap 7 calls `apiEnv.setMode()` — no logout/redirect, the TEST MODE banner appears on the same page via the signal
- Gesture lives ONLY on login, never on home. Decision: if you're stranded in test mode without valid test credentials, you need a recovery path that doesn't require successful sign-in. Login is reachable from any state by logging out
- Login banner (red `TEST MODE` pill + helper text) inserted between `.login-body` and `.login-footer` — NOT below the footer, since `.login-footer` already has `padding-bottom: calc(32px + env(safe-area-inset-bottom))` so anything below it lands in the home-indicator zone
- Home header gets a small passive `TEST` pill inside `.actions` (left of the bell) — no gesture there, just an "in case you forgot" indicator while signed in
- New `.pill[data-status="test"]` colour variant (reuses `--warn` / `--warn-soft`) and `.home-test-pill` size variant (`padding: 4px 8px; font-size: 11px`) sit next to the existing 10 status-pill variants

**Login screen logo** ([assets/logo-sabeeapp-go.png](app/src/assets/logo-sabeeapp-go.png), [login.page.html](app/src/app/pages/login/login.page.html#L15)):
- Replaced the original three-line text block ("SABEEAPP GO" / "Welcome back" / "Sign in to your account") with the SabeeApp Go wordmark PNG
- Iteration: started with the brand-only SVG wordmark (no "GO"), then tried inline SVG with a `<text>` element for "GO" using Nunito 800 + `fill="var(--primary)"` — that worked because inline SVG inherits the page's already-loaded Google Font (an `<img>`-rendered SVG can't — it's sandboxed and only sees locally-installed fonts). Final form is `<img src="assets/logo-sabeeapp-go.png">` since the user provided an authoritative PNG. 288px wide, 80px bottom gap (originally 200/40 then bumped 20%/2× per visual feedback)
- Old `sabeeapp-logo.svg` deleted along the way (only consumer was the inline-SVG variant that's gone)

**UI polish:**
- Removed the cosmetic filter icon from the home `{Today}'s Arrivals` section title — it never had a click handler. Was the last filter icon in the app
- Guest cards on reservation-detail no longer show `ID: 12345`. Only the booker now renders an `.id` row containing `(Booker)`. Non-booker guests have no header row above their name. Dropped `margin-left: 4px` on `.id .booker` (was spacing it from the now-removed "ID: " text)

**Builds uploaded:** iOS 45 (API switch + filter/ID removal), iOS 46 (login logo + sizing). Android versionCode 2 covers both — single AAB. The iOS pbxproj shows 42 → 46 because the publish-ios.sh script bumps `CURRENT_PROJECT_VERSION` before any build step, and a few invocations early in the session burned numbers 43–44 before the keepers landed. Per [Publish script bumps first](feedback_publish_script_bumps_first.md): `npm --prefix /Users/tamas/SabeeAppGO/app run publish:ios` from anywhere is the safe form.

### 2026-05-25 — Session 7 — Bottom-sheet concentric-corners refactor

> Note: All changes are in the Angular/Ionic app (`app/`).

**The visible problem**: on a real iPhone, every bottom sheet (Switch Property, FAB action sheet, Settings Language picker, ID-scan result/failure) sat ~34px above the screen bottom with a noticeable empty band below it. Root cause was `.sheet { bottom: max(8px, env(safe-area-inset-bottom, 8px)); }` — in browser `env()` returns 0 so `max()` resolves to 8px (looked fine), but on iPhone `env()` is ~34px so the sheet floated 34px up. Browser-only testing had hidden it for weeks.

**Iteration path** (4 TestFlight builds in one session):
- **Build 40**: `bottom: 8px` — symmetric 8px floating card on all sides. Cleaner, but still looked off because the sheet's own 28px rounded corners didn't relate to the device's screen-corner radius.
- **Build 41**: flush `bottom/left/right: 0`, only top corners rounded, relying on the iPhone screen mask to clip the bottom corners. Geometrically lossy — the sheet's straight side edges meet the device's curved bezel, so the visible gap varies around the curve.
- **Build 42 (final)**: concentric-corners pattern from Claude Design. Sheet inset 8px on L/R/bottom; all four corners rounded at `device_radius − sheet_gap`. The 8px gap between sheet edge and device bezel stays visually uniform around the curve because the two arcs are concentric.

**Final implementation** ([theme/sabeeapp-design.scss](app/src/theme/sabeeapp-design.scss), [app.component.ts](app/src/app/app.component.ts)):
- New tokens in `:root` — `--device-radius: 24px` (default), `--sheet-gap: 8px`, `--sheet-radius: max(8px, calc(var(--device-radius) - var(--sheet-gap)))`. The `max(8px, …)` floor keeps the radius sane when `--device-radius` is small or 0.
- `body.ios-native { --device-radius: 47px; }` override → 39px sheet radius on iPhone (representative of iPhone 13–16 ~47pt screen corner; an intentional hardcoded compromise, won't be perfect for iPhone X at 39pt or iPhone 16 Pro at 62pt, but on par with how we accept that compromise across iPhone models).
- `body.ios-native` class set in `AppComponent.ngOnInit` via `Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'`. One line, no runtime cost.
- `.sheet-backdrop` rewritten as `display: flex; align-items: flex-end; padding: 0 var(--sheet-gap) var(--sheet-gap);` — backdrop now positions the sheet via flex/padding. `.sheet` itself is `position: relative; width: 100%;` (no inset offsets). Safe-area clearance moved INSIDE the sheet via `padding-bottom: calc(var(--pad) + env(safe-area-inset-bottom, 0px))` so tap targets stay above the home indicator without pushing the sheet up.
- `.sheet .head { border-radius: var(--sheet-radius) var(--sheet-radius) 0 0; }` — top corners track the sheet's so the gray head band doesn't overshoot.
- Android and desktop browser both fall through to the 24px default → 16px sheet radius. No Android plugin, no per-device detection (see rejected approaches).

**Token cleanup**: deleted `--radius-lg: 28px`. It was an Angular-port-only token (the design prototype's scale is 6/10/14, never 28); only used by `.sheet`; now orphan after the switch to `--sheet-radius`. `grep -rn 'radius-lg' src/` returns zero post-delete.

**Rejected approaches:**
- *Custom Capacitor plugin reading Android's real screen-corner radius via `WindowInsets.getRoundedCorner()` (API 31+)*. Would have been 3 new files + Java native code + lifecycle quirks (`runOnUiThread`, null insets) for one CSS variable controlling a 2–5px visual difference most users won't perceive. We don't detect iPhone's radius dynamically either; symmetry was intentional.
- *Larger Android default (~32px)*. Picking any value will be wrong on outliers (Galaxy S Ultra ~56px, Pixel A ~26px). 24px is conservative and looks clean as a small card on every Android.

**Build-script gotcha learned the hard way**: [app/scripts/publish-ios.sh:14](app/scripts/publish-ios.sh#L14) `sed`-bumps `CURRENT_PROJECT_VERSION` as its FIRST step, before `ng build`, before `xcodebuild`. **Any** cancelled run still consumes a build number. Earlier in this session, 7 cancelled invocations from the wrong cwd burned numbers 33–39 before the successful upload at build 40. Safe invocation: `npm --prefix /Users/tamas/SabeeAppGO/app run publish:ios` from anywhere (npm honors `--prefix` and runs the script with that as cwd). Don't `cd`-then-restart, don't kill mid-flight.

**Builds uploaded:** 40 (symmetric floating card), 41 (flush bottom + top corners only), 42 (concentric corners, the keeper).

### 2026-05-22 — Session 6 — ID Scan result/failure bottom sheets + reservation status mapper

> Note: All changes are in the Angular/Ionic app (`app/`).

**ID Scan result UI moved to a bottom sheet on guest-detail** ([app/src/app/pages/guest-detail/guest-detail.page.ts](app/src/app/pages/guest-detail/guest-detail.page.ts), [app/src/app/pages/guest-detail/guest-detail.page.html](app/src/app/pages/guest-detail/guest-detail.page.html)):
- Extended the existing scan sheet with a new `result` mode. A `scanSheetMode` signal (`'loading' | 'result' | 'failed'`) drives a branching `@if` in the template; `scanSheetTitle` computed signal swaps the header between "ID Scan" / "ID Scan result". The `effect()` watching `documentReader.readerStatus()` no longer navigates to `/id-scan` on `FINISHED` — it just swaps the sheet mode, keeping guest-detail visible behind the backdrop
- Result content uses master-CSS classes throughout — `.detail-label` + `.detail-value` rows (same as the personal-info card on guest-detail) with two-column flex (`gap: 24px`) for Document type / Document number, Age / Gender, Place of birth / Date of birth; full-width rows for First & Last name, Citizenship, Mother's name. Replaces the wall of inline styles in the old `/id-scan` result overlay
- Edit / Save actions ported from `IdScanPage.processDocument` as `processScanResult('edit' | 'save')`. Save calls `reservationService.updateGuest()` then dismisses the sheet and refreshes via `this.loadGuest()` — user stays on guest-detail with the updated data visible. Edit navigates to `/guest/:code/:guestId/edit`. In preview mode (`_previewScanResult` set), both actions just dismiss without API calls

**ID Scan failure states (TIMEOUT / CANCELLED / INTERRUPTED) moved to the same sheet:**
- The `effect()` failure branch now sets `scanSheetMode.set('failed')` + `failedStatus.set(status)` instead of navigating away. Title varies via `scanSheetTitle`: "ID Scan Timed out" / "ID Scan Cancelled" / "ID Scan Interrupted"
- Failed mode renders just the action bar (head + actions, no body) — Cancel (secondary) dismisses, Scan Again calls `scanAgain()` which delegates to `goScan()` for a fresh `init()` + `scan()` cycle. In preview-failed mode, Scan Again just dismisses
- Preview URLs added on guest-detail: `?previewScanSheet=result`, `=timeout`, `=cancelled`, `=interrupted`. `MOCK_SCAN_RESULT` duplicated from id-scan.page.ts per the "no premature abstraction" convention

**`/id-scan` page status:** the result + failure overlays on `/id-scan` are now dead code from the normal flow (no path navigates to them on success/failure anymore). Left in place — they're still reachable via the original `?preview=result` / `?preview=timeout` deep-links and remain functional, but should be removed in a follow-up cleanup pass once we're confident the new sheets cover everything

**Sheet action bar polish** ([theme/sabeeapp-design.scss:298-303](app/src/theme/sabeeapp-design.scss#L298-L303)):
- Added `padding-bottom: 12px` to `.sheet .actions`. The sheet's own `padding-bottom: env(safe-area-inset-bottom, 8px)` stacks below this, giving ~46px total gap below the buttons on iPhone (matches the original `/id-scan` reference design which used `calc(12px + env(safe-area-inset-bottom))`) and a visible 12px gap in browser preview. **Why this is needed:** modern browsers support `env()` and return `0` for the inset on desktop — the 8px fallback only triggers on browsers that don't support `env()` at all. Without an explicit base on `.actions`, the buttons sit flush against the sheet's bottom edge in the browser preview

**Reservation status mapper extended** ([services/reservation.ts:15-37](app/src/app/services/reservation.ts#L15-L37), [theme/sabeeapp-design.scss:252-254](app/src/theme/sabeeapp-design.scss#L252-L254), [home/home.page.ts:127-131](app/src/app/home/home.page.ts#L127-L131)):
- A debug log on `convert(r)` revealed the API returns `status: null` for some reservations. Decision: keep null mapped to the existing grey pill, but rename the label from "Open" → **"Option"** and the internal key from `'open'` → `'option'` to better reflect "no lifecycle status assigned yet". CSS rule renamed in lockstep — `.pill[data-status="open"]` → `.pill[data-status="option"]`. Same grey colors
- Added two new statuses with educated-guess API keys: `cancelled` → red "Cancelled" pill (`rgb(220,53,69)` / `rgb(252,232,235)`, in the `--warn` family) and `noshow` → dark-grey "No show" pill (`rgb(73,80,87)` / `rgb(225,228,232)`, deliberately darker than the `option` and `checked-out` greys so a no-show is visually distinguishable from "no info yet"). If real API strings differ (e.g. `no_show`, `CANCELLED`), only the two `case` keys need updating — the styling stands
- Home-screen dimming logic extended: `cancelled` and `noshow` dim on all tabs (terminal states with no possible action); `option` still dims only on non-Today tabs (legacy behavior, just renamed)

**Build/version:** Two TestFlight uploads via `npm run publish:ios` — build 27 (sheets) and build 28 (status mapper)

### 2026-05-21 — Session 5 — ID Scan preview + loading-phase bottom sheet

> Note: All changes are in the real Angular/Ionic app (`app/`), not the design prototype (`Design/`).

**Preview capabilities for ID scan support pages** (commit `969669b`, [app/src/app/pages/id-scan/id-scan.page.ts](app/src/app/pages/id-scan/id-scan.page.ts), [app/src/app/app.component.ts](app/src/app/app.component.ts)):
- Three preview modes on `/id-scan` triggered by `?preview=<mode>` query param: `loading` (forces `ReaderStatus.INIT`), `timeout` (`ReaderStatus.TIMEOUT`), `result` (`ReaderStatus.FINISHED` + `MOCK_SCAN_RESULT` — Hungarian passport "János Kovács" b. 1985-06-22, doc AB1234567)
- Two private signals `_previewStatus` / `_previewResult` are layered in front of `DocumentReaderService` via `computed()`. When set, they take priority over the real reader state; `ngOnInit` checks the query param first and short-circuits so the Regula plugin is never invoked in preview mode
- `AppComponent.ngOnInit` now captures `window.location.pathname + window.location.search` *before* the auth flow runs. After login/property resolution, if the URL isn't an authless route (`/login`, `/mfa`, `/property-select`, `/`), it routes there instead of defaulting to `/home`. This means deep-link preview URLs survive the auth redirect

**Bottom-sheet redesign for ID scan loading phase** ([app/src/app/pages/guest-detail/guest-detail.page.ts](app/src/app/pages/guest-detail/guest-detail.page.ts), [app/src/app/pages/guest-detail/guest-detail.page.html](app/src/app/pages/guest-detail/guest-detail.page.html), [app/src/app/pages/id-scan/id-scan.page.ts](app/src/app/pages/id-scan/id-scan.page.ts), [app/src/app/services/document-reader.service.ts](app/src/app/services/document-reader.service.ts)):
- Replaced the full-screen white loader that `/id-scan` showed during `DocumentReaderService.init()` + native camera launch with a bottom sheet that opens on guest-detail. **Design principle:** guest-detail must stay partially visible behind the backdrop so the user retains context for which guest they're scanning. That rules out navigating to `/id-scan` before the camera takes over — init + scan now both run from guest-detail
- Sheet pattern reused 1:1 from the property switcher / settings language picker / guest-detail FAB action sheet: same `.sheet-backdrop` + `.sheet` + `.head` HTML, same global SCSS at [theme/sabeeapp-design.scss:305-365](app/src/theme/sabeeapp-design.scss#L305-L365). No new shared component — pattern is copy-paste across pages
- **Flow:** tap FAB → "ID Scan" action item now calls `goScan()` which closes the action sheet, opens the scan sheet (`scanSheetOpen.set(true)`), calls `documentReader.init()`, then `documentReader.scan()` (native camera takes over). An Angular `effect()` on guest-detail watches `documentReader.readerStatus()`; when it transitions to `FINISHED` / `TIMEOUT` / `CANCELLED` / `INTERRUPTED`, the sheet dismisses and the page navigates to `/guest/:code/:guestId/scan?fromScan=true`
- `IdScanPage.ngOnInit` checks `?fromScan=true` and skips its own `init()` + `scan()` calls. The existing template renders whatever post-scan state the reader is already in (result, timeout, etc.). The full-screen result/timeout UI is unchanged — those screens are queued for a follow-up where they'll also become bottom sheets on guest-detail
- `DocumentReaderService.init()` is now idempotent: returns early if `_readerStatus() === READY`. Required because guest-detail and id-scan can both call it now
- Sheet messages: "Starting ID scan…" by default; "Loading scan database…" while `readerStatus() === INIT`. Hardcoded English to match existing patterns — `TranslatePipe` is effectively unused in templates today (every reference in id-scan.page.html is in a comment), so adding translation keys would create dead code
- Backdrop tap dismisses the sheet during the pre-camera phase only. `cancelScanSheet()` early-returns if `awaitingScanResult()` is true (i.e. once `scan()` was called and the native camera has launched)
- **Browser preview URLs on guest-detail:** `?previewScanSheet=starting` and `?previewScanSheet=loading` open the sheet with a stubbed message (no Regula call) for `ionic serve` testing

**Known regression risk (cordova-on-web):**
- `DocumentReaderService` is now injected into `GuestDetailPage` as well as `IdScanPage`. The service constructor (and its `reader = DocumentReader.instance` field initializer) accesses the Regula plugin at construction time, which is the source of [SABEEAPPGO-1](https://sabeeapp.sentry.io/issues/SABEEAPPGO-1) / [SABEEAPPGO-2](https://sabeeapp.sentry.io/issues/SABEEAPPGO-2) (`ReferenceError: cordova is not defined`) on web/Electron. Since Angular `providedIn: 'root'` services are singletons created on first injection, this may now fire on the first guest-detail visit in browser instead of (or in addition to) the first `/id-scan` visit. No production impact — native builds have cordova defined. Worth verifying that `?previewScanSheet=…` URLs actually render in `ionic serve`; if not, the fix is to guard the service constructor with `Capacitor.isNativePlatform()` or defer DI via `runInInjectionContext` inside `goScan()`

### 2026-05-18 — Session 4 — Angular app

> Note: This session's changes are in the real Angular/Ionic app (`app/`), not the design prototype (`Design/`).

**Regula Document Reader integration** (`app/src/app/services/`, `app/src/app/pages/id-scan/`):
- New `DocumentReaderService` — wraps `@regulaforensics/document-reader` Cordova plugin: initialization, scenario selection, RFID config, scan lifecycle, result extraction (name, DOB, document type, nationality, document number, etc.)
- New `DocuscanService` — bridges scan results to the guest data model (`ScannedDataInterface` → `GuestInterface`)
- `IdScanPage` fully rewritten — real camera scan via Regula, `Capacitor.isNativePlatform()` guard (shutter disabled on non-native), three phases (`camera` → `scanning` → `result`), result routes to guest edit screen
- New pipes: `DashIfEmptyPipe`, `DefaultValuePipe`
- New models: `ScannedDataInterface`, `GuestPostInterface`, `DocumentData`
- Old `scan-modal` component removed

**Translation / Language system** (`app/src/app/services/language.service.ts`):
- New `LanguageService` — fetches translations from API (`languages` endpoint), caches in device storage, reads device locale on first launch, merges API translations over bundled English fallback; background refresh on every app start
- `TranslatePipe` — `{{ 'key' | translate }}` syntax
- Bundled fallback translations in `translations.ts` + `translations.en.json`
- Language selection persists across sessions

**Settings screen** (`app/src/app/pages/settings/`):
- Language picker bottom sheet — lists API-fetched languages, active language shown with blue dot
- Version / build number display via `App.getInfo()`
- Lock screen button
- "Test Sentry" button (dev-only — triggers a manual error to verify the Sentry pipeline)
- Profile section: name + email at top

**Sentry error monitoring** (`app/src/main.ts`, `app/src/environments/`):
- `@sentry/angular` integrated; DSN from `environment.sentryDsn`
- Captures unhandled Angular errors + console `warn`/`error` calls
- Environment tag set automatically (`development` vs `production`)

**Publishing infrastructure** (`app/scripts/`, `app/StorePublish.md`):
- `publish-ios.sh` — automates `xcodebuild` archive + export + TestFlight upload via `xcrun altool`
- `publish-android.sh` — automates AAB build + signing + upload
- `StorePublish.md` — step-by-step store submission guide
- `ExportOptions.plist` added for Xcode archive export config

**Android fixes:**
- `AndroidManifest.xml` cleaned up and corrected
- `capacitor.build.gradle` patched

**Known open issue (Sentry):**
- [SABEEAPPGO-1](https://sabeeapp.sentry.io/issues/SABEEAPPGO-1) / [SABEEAPPGO-2](https://sabeeapp.sentry.io/issues/SABEEAPPGO-2) — `ReferenceError: cordova is not defined` on the scan route in browser/Electron. `DocumentReaderService` constructor calls into the Regula plugin during Angular DI even on non-native platforms. `isNative` guard exists on the page but not inside the service's `init()` path.

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
- [ ] **Fix the Regula scan timeout (UK passport)** — follow-up to the Session 11 logging. Once the Sentry Logs confirm the cause, pick: disable `multipageProcessing` for passports (one-shot on the data page; ID cards need front+back so may need a doc-type pre-selection), raise Regula's `timeout*` `ProcessParams`, and/or salvage the intermediate `results` Regula hands us on TIMEOUT (the data page is already read — route it through `processResults` instead of discarding). Behaviour was intentionally left unchanged in Session 11

### Screens to build
- [ ] **Departures screen** — dedicated view for today's departures (check-out times, balance due, room key return)
- [ ] **Notifications screen** — target for the Bell icon on HomeScreen

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

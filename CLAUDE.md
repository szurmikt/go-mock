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
--font-xs:   12px   /* captions, labels */
--font-sm:   13px   /* meta text */
--font-base: 15px   /* body */
--font-md:   17px   /* standard UI text */
--font-lg:   18px   /* card titles, sheet headers */
--font-xl:   22px   /* section titles, large values */
--font-2xl:  26px   /* hero numbers */
```

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

4. **Filter button in Arrivals list is cosmetic** — The filter icon in `.section-title` renders but has no action.

5. **BlockDate calendar is single-month** — No month navigation (prev/next). Acceptable for prototype.

6. **Search is client-side only** — No date search, fuzzy matching, or server-side filtering.

7. **Bottom nav is built but hidden** — `showNav = false` in `app.js`. `BottomNav` component exists with 4 tabs (Home, Arrivals, Scan, Search).

8. **Bell and Settings icons are cosmetic** — No screen navigates from these.

9. **OTP on Android untested** — `type="tel"` inputs with manual focus management are validated on iOS only.

10. **`home-screen-old.js` not in build** — This backup file exists in the directory but is intentionally excluded from `SCRIPT_ORDER` in `build.py`. Do not add it.

---

## 8. Changelog

### 2026-05-03 — Session 3 (current)

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

### Screens to build
- [ ] **Departures screen** — dedicated view for today's departures (check-out times, balance due, room key return)
- [ ] **Notifications screen** — target for the Bell icon on HomeScreen
- [ ] **Settings / Profile screen** — target for the Settings icon on HomeScreen

### Features to add to existing screens
- [ ] **Services panel** on ReservationDetail — list extras (Breakfast, Airport Transfer, etc.) with quantities and prices from `SERVICES` data
- [ ] **Finances panel** on ReservationDetail — room cost, services total, amount paid, balance; from `FINANCES` data
- [ ] **Filter sheet in Arrivals** — the Filter icon button on the section title header does nothing; design a filter sheet (by status, room type, source channel)
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

# SabeeApp Go — Developer Guide

A reference for developers working on this codebase. Covers architecture, conventions, and feature-by-feature implementation notes.

---

## 1. What this app is

**SabeeApp Go** is a mobile-first hotel front-desk companion to the SabeeApp PMS (the main web-based property management system). It is used by hotel managers and front-desk staff for daily operations:

- View today's arrivals and their status
- Check guests in and out
- Search reservations by name, code, or email
- View and edit guest personal details
- Scan travel documents (ID / passport) to pre-fill guest data
- Switch between managed properties

Account management, billing, and complex configuration stay in the PMS. This app handles what staff need while standing at the front desk.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Ionic 8 + Angular 20 |
| Components | All standalone (`standalone: true`) — no NgModules |
| State | Angular Signals (`signal`, `computed`) — no BehaviorSubject, no NgRx |
| HTTP | Angular `HttpClient` + functional interceptor |
| Persistence | `@capacitor/preferences` (wrapped in `StorageService`) |
| Device APIs | `@capacitor/device` (device ID) |
| Styling | Plain CSS — single file `src/theme/sabeeapp-design.scss` |

**Design reference:** `../Design/index.html` — a pure React/HTML prototype of the full UI. Run `python3 ../Design/build.py` to rebuild it after editing source files there. All visual decisions originate from this prototype.

**How to run:**
```bash
npx ng serve --host 0.0.0.0 --port 8100
```
Accessible at `http://localhost:8100` in browser, or via local IP on a phone on the same network.

**How to build:**
```bash
npx ng build
```

---

## 3. Architecture

### File layout

```
src/app/
  app.component.ts        — boot logic (loadStoredAuth → redirect)
  app.config.ts           — Angular providers, interceptor wiring
  app.routes.ts           — all routes (lazy-loaded)
  config/config.ts        — API constants, storage keys
  guards/auth.guard.ts    — redirects unauthenticated users to /login
  interceptors/
    api.interceptor.ts    — headers, token refresh, 401 handling
  models/
    auth.interfaces.ts    — AuthState, TokenResponse, ApiResponse
    guest.interface.ts    — GuestInterface
    property.interface.ts — PropertyInterface
    reservation.interface.ts — ReservationInterface, BookerInterface
  pages/
    login/                — email + password form
    mfa/                  — 6-digit TOTP boxes
    property-select/      — property picker after login
    home/                 — arrivals list (main screen)
    search/               — client-side reservation search
    reservation-detail/   — single reservation view
    guest-detail/         — guest read-only + FAB action sheet
    guest-edit/           — guest edit form
    settings/             — user info + logout
  services/
    api.ts                — thin HttpClient wrapper
    auth.ts               — auth state, login flow, token refresh
    reservation.ts        — reservation + guest data, pillStatus/pillLabel
    storage.ts            — Capacitor Preferences wrapper
src/theme/
  sabeeapp-design.scss    — entire design system (ported from Design/styles.css)
```

### Page pattern

Every screen follows the same structure:

```html
<ion-content>
  <div class="page" style="background: var(--bg)">
    <div class="sub-header">...</div>   <!-- or .page-header on home -->
    <div class="app-scroll">...</div>   <!-- scrollable body -->
  </div>
</ion-content>

<!-- FABs, sheets, overlays go OUTSIDE ion-content -->
<!-- They are siblings of ion-content inside ion-page (position: absolute; inset: 0) -->
<!-- This prevents them from scrolling with the content -->
@if (condition) {
  <button class="fab">...</button>
  <div class="sheet-backdrop">...</div>
}
```

`IonContent` is the only Ionic component used in templates. Everything else is plain HTML styled with `sabeeapp-design.scss` classes.

### State management

Signals only — no Observables in component state:

```typescript
// Private writable
private _data = signal<Thing | null>(null);

// Public readonly
readonly data = this._data.asReadonly();

// Derived
readonly isReady = computed(() => !!this._data());
```

Services expose signals; components read them in templates with `service.signal()`.

### Lazy routes

Every page is lazy-loaded. New routes follow this pattern in `app.routes.ts`:

```typescript
{
  path: 'my-page',
  canActivate: [authGuard],
  loadComponent: () => import('./pages/my-page/my-page.page').then(m => m.MyPage),
},
```

---

## 4. Design system

All styles live in `src/theme/sabeeapp-design.scss`, imported globally. Never write component-level SCSS — keep `.scss` files for pages empty.

### Color tokens

```css
--primary / --primary-strong / --primary-soft / --primary-soft-bg
--ink / --ink-2 / --ink-3 / --ink-4      /* text: dark → muted */
--bg / --surface / --line / --line-strong  /* backgrounds + borders */
--warn / --warn-soft                       /* red: errors, destructive */
--success / --success-soft                 /* green: positive */
```

### Spacing tokens

```css
--pad        /* page horizontal padding: 16px */
--gap        /* grid gaps: 16px */
--card-pad   /* card internal padding: 16px */
```

### Key reusable classes

| Class | Use |
|---|---|
| `.card` | White rounded card with border |
| `.btn` | Full-width primary action button |
| `.btn.secondary` | Outlined blue button |
| `.btn.danger` | Red/warn button (e.g. Log out) |
| `.pill[data-status="…"]` | Coloured status badge |
| `.sub-header` | Back button + title bar for detail pages |
| `.page-header` | Property name + icon buttons (home screen) |
| `.app-scroll` | `flex: 1; overflow-y: auto` scrollable area |
| `.form-group` | Floating-label input wrapper |
| `.sheet-backdrop` / `.sheet` | Bottom sheet overlay |
| `.fab` | Floating action button (position: absolute) |
| `.action-item` | Tappable row inside a sheet |
| `.tap-anim.tappable` | Press feedback on cards |
| `.group-title` | Section header in primary blue |
| `.spin` / `.spin-primary` | Loading spinner |

### Status pill system

Two utility functions exported from `src/app/services/reservation.ts`:

- `pillStatus(apiStatus)` — maps API status string to the CSS `data-status` value
- `pillLabel(apiStatus)` — maps API status string to the human-readable label

| API status | CSS class | Color | Label |
|---|---|---|---|
| `checkin` | `check-in` | Green | Check in |
| `checkedin` | `checked-in` | Blue-teal | Checked in |
| `checkout` | `check-out` | Orange | Check out |
| `checkedout` | `checked-out` | Grey | Checked out |
| `onboard` | `onboard` | Blue-teal | Onboard |
| `confirmed` | `confirmed` | Purple | Confirmed |
| _(other)_ | `open` | Grey | Open |

Usage in templates:
```html
<span class="pill" [attr.data-status]="pillStatus(r.status)">
  {{ pillLabel(r.status) }}
</span>
```

### Safe area rule

Always write `env(safe-area-inset-*)` inline in property values — never inside a CSS custom property. A WebKit bug prevents resolution when nested in `var()` on some iOS versions.

```css
/* Correct */
padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));

/* Broken on some iOS — never do this */
--safe: env(safe-area-inset-bottom, 0px);
padding-bottom: var(--safe);
```

---

## 5. Authentication flow

### Boot sequence (`app.component.ts`)

```
loadStoredAuth()
  ├── if authenticated + property selected → /home
  ├── if authenticated, no property         → /property-select
  └── not authenticated                     → /login
```

`replaceUrl: true` is used on all boot navigations so the user cannot back-navigate to the blank splash.

### Login flow

```
POST /token  →  { mfa_token }
                    ↓
POST /mfa/verify  →  { access_token, refresh_token, expires_in, roles }
                    ↓
GET /users/me  →  { name, email }   (fetched immediately after MFA, stored in AuthState)
                    ↓
GET /properties  →  list
                    ↓
select property  →  /home
```

The email entered on the login screen is passed through router state (`login → mfa`) and stored in `AuthState`. The name comes from `/users/me`. Both survive restarts via Capacitor Preferences.

### Token storage

The entire `AuthState` is stored as one JSON blob under the key `authState`:

```typescript
interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;   // absolute ms timestamp
  roles: string[];
  email: string;
  name: string;
}
```

### Token refresh (`api.interceptor.ts`)

Before every request: if `expiresAt - Date.now() < 5 * 60 * 1000` (less than 5 minutes remaining), the interceptor refreshes proactively. On a 401 response, it retries once. On repeated failure, it calls `auth.logout()` and navigates to `/login`.

A shared `isRefreshing` flag prevents concurrent refresh storms when multiple requests fire simultaneously.

### Auth guard

`src/app/guards/auth.guard.ts` — returns `true` if `auth.isAuthenticated()`, otherwise redirects to `/login`. Applied to all routes except `/login`, `/mfa`, `/property-select`.

---

## 6. Reservation data

`ReservationService` (`src/app/services/reservation.ts`) owns all reservation and guest state.

### Fetching

```typescript
fetchReservations()   // GET /reservations?start_date=…&end_date=…  (±14 days from today)
fetchDetail(code)     // GET /reservations/details?reservation_code=…
fetchGuests(code)     // GET /guests?reservation_code=…
updateGuest(code, g)  // POST /guests
```

Reservations are stored in `_reservations` signal and shared across the Home and Search screens — the Search page checks `reservations().length === 0` and fetches if empty, but otherwise reuses whatever Home already loaded.

### Search logic (`search.page.ts`)

- Minimum 3 characters to trigger results
- `reservation_code` and `booker.first_name` / `booker.last_name` use `startsWith` match
- `booker.email` uses `includes` match (to support `@domain.com` domain searches)
- Results sorted by arrival date closest to today; future arrivals before past ones as tie-break
- Recent search terms saved to Capacitor Preferences (`searchHistory` key), max 10, deduplicated, most-recent-first

---

## 7. API conventions

**Base URL:** `https://smart.sabeeapp.com/api2/go` (from `environment.apiUrl`)

All requests go through `ApiService` (`src/app/services/api.ts`) which is a thin `HttpClient` wrapper. Headers are injected by the interceptor — never add them manually in a service.

**Standard response envelope:**
```typescript
{ success: boolean, data: T, errors: unknown }
```

**Headers injected automatically:**

| Header | Value |
|---|---|
| `Api-Version` | `1.0` |
| `App-Version` | `1.1.0` |
| `Ci-Version` | `4` |
| `Device-Id` | UUID from `@capacitor/device` |
| `Lang` | `en` |
| `Token` | access token (omitted when not authenticated) |
| `Property-Id` | selected property ID (omitted until property is selected) |

---

## 8. Screens — current state

| Route | Component | Status |
|---|---|---|
| `/login` | `LoginPage` | Email + password; error displayed as bottom sheet |
| `/mfa` | `MfaPage` | 6 digit boxes; auto-advance, paste, shake on error |
| `/property-select` | `PropertySelectPage` | Real API; stores selection in Preferences |
| `/home` | `HomePage` | Yesterday / Today / Tomorrow segment; stat cards; arrivals list; property switcher sheet |
| `/search` | `SearchPage` | Client-side; recent history chips; sorted results |
| `/reservation/:code` | `ReservationDetailPage` | Detail block; guest list |
| `/guest/:code/:guestId` | `GuestDetailPage` | Read-only view; FAB → action sheet (Edit / ID Scan) |
| `/guest/:code/:guestId/edit` | `GuestEditPage` | Floating-label form; sticky Save button outside `ion-content` |
| `/settings` | `SettingsPage` | Shows user name + email; Log out button |

---

## 9. ID Scan (not yet implemented)

### What it does

The user taps "ID Scan" from the guest action sheet (on Guest Detail). The phone camera opens, the guest holds their ID or passport up to the frame, the Regula SDK reads the document via OCR (and optionally RFID), and the extracted data is shown in a review sheet. The user can save it directly to the guest record or discard.

### Scanner library — Regula Forensics

| Package | Platform | Notes |
|---|---|---|
| `@regulaforensics/document-reader` | Web / browser | Works in Capacitor's WebView via WebAssembly. Start here. |
| `@regulaforensics/ionic-native-document-reader/ngx` | Native iOS / Android | Imported in old app but commented out — unfinished. |

A **license file** is required: place it at `src/assets/regula.license`. This file is provided by Regula and is property-specific. Do not commit it — load it at runtime from `assets/`.

NFC / RFID reading uses `@capgo/capacitor-nfc`. Optional — OCR-only scans work without it.

### UI flow — three phases

```
camera  →  (shutter tap)  →  scanning  →  (SDK result)  →  result
                                                         ↓ (discard)
                                                       camera
```

**`camera` phase** — full-screen dark background (`scan-screen`), animated scan frame with corner brackets and sweeping laser line, hint text, shutter button.

**`scanning` phase** — spinner overlay, "Reading document…", shutter disabled.

**`result` phase** — bottom sheet with extracted fields (name, document type/number, age, gender, birth date/place, citizenship, mother's name). **Edit** → Guest Edit pre-filled. **Save** → `updateGuest()` → back.

### Route

```typescript
{
  path: 'guest/:code/:guestId/scan',
  canActivate: [authGuard],
  loadComponent: () => import('./pages/id-scan/id-scan.page').then(m => m.IdScanPage),
},
```

Entry point: the "ID Scan" `action-item` in `guest-detail.page.html`.

### Files to create

```
src/app/pages/id-scan/
  id-scan.page.ts       — phase signal, SDK invocation, save logic
  id-scan.page.html     — dark layout: viewfinder, toolbar, result sheet
  id-scan.page.scss     — empty (styles go in sabeeapp-design.scss)

src/app/services/id-scan.service.ts   — Regula SDK wrapper + scan fields cache
```

### Scan fields configuration

```
GET /properties/settings  →  { success: true, data: { scan_fields: [...] } }
```

Cache `scan_fields` in Capacitor Preferences (`fieldsToScan` key). Re-use across sessions; refresh when property changes. Reference: `DocuscanService.load()` in old app.

### SDK initialization

```typescript
const license = await fetch('assets/regula.license').then(r => r.arrayBuffer());
await DocumentReader.initializeReader({ license });
```

Initialize lazily inside the page's `ngOnInit` — not at app boot. Show a spinner until ready, then enable the shutter.

### Data model

```typescript
interface ScannedData {
  doc_reader_scanned_document_id: string;
  first_name: string;   last_name: string;   full_name: string;
  mother_name: string;  maiden_name: string;
  birth_date: string;   birth_place: string;
  gender: string;       citizenship: string;  age: number;
  document: {
    document_type: string;
    document_number: string;
    date_of_issue_of_the_document: string;
  };
}
```

### Saving to the guest record

Reuse the existing `ReservationService.updateGuest()`:

```typescript
const updated: GuestInterface = {
  ...currentGuest,
  first_name: scanned.first_name,
  // ... other fields
  scanned_data: { doc_reader_scanned_document_id: scanned.doc_reader_scanned_document_id },
};
await reservationService.updateGuest(reservationCode, updated);
```

### Statistics (required)

Call for **every** scan attempt — success, failure, or cancellation:

```
PUT /guests/scan_statistics
{
  reservation_guest_id, doc_reader_scanned_document_id,
  status: "Completed" | "Failed" | "Cancelled" | "Discarded",
  scan_type, message, date_of_issue, type
}
```

Reference: `DocuscanService.sendStatistics()` in old app.

### CSS classes to add to `sabeeapp-design.scss`

| Class | Purpose |
|---|---|
| `.scan-screen` | Full-screen dark background (`#0d0f12`) |
| `.scan-viewfinder` | `flex: 1; position: relative` area above toolbar |
| `.scan-frame` | Dashed white border rectangle, centered |
| `.scan-corners` | Corner brackets via `::before` / `::after` |
| `.scan-laser` | Sweeping horizontal line, `@keyframes scan-bounce` |
| `.scan-toolbar` | Bottom bar holding the shutter button |
| `.shutter-btn` | Large circular white button |

### Old app pitfalls — do not copy

- `RegulaService` (native SDK) is fully commented out. Do not use it.
- `BootstrapService` initializes the SDK at app boot — causes startup delay even when the user never scans. Initialize lazily instead.
- Statistics call was fire-and-forget with no error handling. At minimum log failures.

### Suggested implementation order

1. Port CSS classes above to `sabeeapp-design.scss`
2. Create `IdScanPage` with three-phase UI and hardcoded mock result
3. Wire route and "ID Scan" button in guest-detail action sheet
4. Install `@regulaforensics/document-reader`, add license file, replace mock with real SDK
5. Map SDK result fields → `ScannedData`, show in result sheet
6. Connect Save → `updateGuest()` + `sendStatistics()`
7. Add scan fields config from `GET /properties/settings`

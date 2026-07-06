# SabeeApp Go — Ionic App · Developer Context

> Read this at the start of every session. It is the single source of truth for architecture, conventions, and build patterns for this app.

---

## 1. What This App Is

A mobile-first hotel management app (Ionic 8 + Angular 20, standalone components). It is the native replacement for the HTML prototype at `/Users/tamas/SabeeAppGO/Design`. All visual design comes from that prototype — the SCSS design system is a direct port of `Design/styles.css`.

**Old Ionic app for reference only:** `/Users/tamas/SabeeAppGO/old-ionic-app` — provides API contracts, data models, and business logic. Do not copy its bugs (see §8).

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Ionic 8 + Angular 20 |
| Component model | **Standalone components throughout** — no NgModules |
| State management | **Angular Signals** (`signal`, `computed`, `effect`) |
| Token storage | **`@capacitor/preferences`** — one JSON blob per domain, not separate keys |
| HTTP | `HttpClient` with functional `HttpInterceptorFn` |
| Styling | Port of `Design/styles.css` — see §4 |
| Build | `ionic serve` / `ng build` |

---

## 3. File Structure

```
sabeeapp-go/
├── src/
│   ├── global.scss                   # Ionic core imports + @import 'theme/sabeeapp-design'
│   ├── theme/
│   │   ├── sabeeapp-design.scss      # SINGLE SOURCE OF TRUTH for all styles
│   │   └── variables.scss            # Empty — all tokens live in sabeeapp-design.scss
│   ├── environments/
│   │   ├── environment.ts            # { production: false, apiUrl: '...' }
│   │   └── environment.prod.ts
│   └── app/
│       ├── app.component.ts          # Boot logic: loadStoredAuth → biometric check → redirect; inactivity timer; App lifecycle listener
│       ├── app.config.ts             # provideRouter, provideHttpClient(withInterceptors), provideIonicAngular
│       ├── app.routes.ts             # All routes (lazy loadComponent)
│       ├── config/
│       │   └── config.ts             # API_VERSION, APP_VERSION, CLIENT_ID, storage keys
│       ├── models/
│       │   ├── auth.interfaces.ts      # AuthState, TokenResponse, MfaTokenResponse, ApiResponse<T>
│       │   ├── property.interface.ts   # PropertyInterface
│       │   └── reservation.interface.ts # ReservationInterface, BookerInterface
│       ├── components/
│       │   └── lock-overlay/         # LockOverlayComponent — biometric session-lock screen
│       ├── services/
│       │   ├── auth.ts               # AuthService — Signals-based auth state + all auth API calls
│       │   ├── api.ts                # ApiService — thin HttpClient wrapper (get/post + query params)
│       │   ├── storage.ts            # StorageService — Capacitor Preferences wrapper
│       │   ├── reservation.ts        # ReservationService — fetch/filter reservations + pillStatus()
│       │   ├── biometric.ts          # BiometricService — session lock signal + native biometric auth
│       │   └── options.service.ts    # OptionsService — app-wide static options (countries); loaded once at property selection
│       ├── interceptors/
│       │   └── api.interceptor.ts    # Functional interceptor: headers + proactive/reactive token refresh
│       ├── guards/
│       │   └── auth.guard.ts         # CanActivateFn — blocks unauthenticated access
│       ├── pages/
│       │   ├── login/                # LoginPage
│       │   ├── mfa/                  # MfaPage (6-digit boxes)
│       │   ├── property-select/      # PropertySelectPage
│       │   ├── search/               # SearchPage — client-side search, min 3 chars
│       │   └── reservation-detail/   # ReservationDetailPage — detail block + guests list
│       └── home/                     # HomePage — arrivals list + segment + property switcher
```

---

## 4. Design System

### How it works

All styles live in **`src/theme/sabeeapp-design.scss`**. This is a direct SCSS port of `Design/styles.css` from the prototype, with two additions:

1. Ionic token mappings (`--ion-color-primary` → `--primary`, etc.)
2. Ionic component resets (`ion-content { --background: transparent }`, `ion-page { background: var(--bg) }`)

`global.scss` imports Ionic core then imports `sabeeapp-design.scss`. Per-component `.scss` files are intentionally empty — **all shared classes go in `sabeeapp-design.scss`**, not in component files.

### Using styles in templates

Use the **exact same class names** as the prototype. Every class from `Design/styles.css` is available globally:

```html
<!-- Page shell classes -->
.login-page   .login-header   .login-body   .login-footer
.sub-header   .back   .title   .right

<!-- Layout -->
.app-scroll          (scrollable content area)
.page-header         (top bar with property name + icon buttons)
.section-title h2    (section headings above lists)
.stat-block          (two-up stat cards)

<!-- Cards -->
.card                (generic card — uses --card-bg, --card-border, --card-shadow)
.res-card            (reservation card with left blue border)
.guest-card          (guest card with left blue border)
.detail-block        (grey detail block on ReservationDetail)
.fact-grid .fact     (2-column key-value grid inside detail-block)

<!-- Forms -->
.form-group          (floating-label wrapper)
  input + label      (label floats when input has a value)
.lang-select         (styled native <select> with chevron)
.btn                 (primary button — also .btn.secondary)
.icon-btn            (36×36 transparent icon button)

<!-- Interactive -->
.tappable  .tap-anim       (press feedback)
.stagger > *               (staggered slide-in animation on list items)
.pill[data-status="..."]   (status badges — see §6)
.segment .seg .seg-thumb   (animated segment control)

<!-- Overlays -->
.sheet-backdrop  .sheet  .sheet .head  .action-item  .action-icon
.toast-stack  .toast

<!-- OTP -->
.otp-row  .otp-digit  .otp-sep

<!-- Scan screen -->
.scan-screen  .scan-frame  .scan-laser  .shutter-btn

<!-- Spinners -->
.spin            (white spinner — use inside .btn)
.spin-primary    (blue spinner — use on white backgrounds)

<!-- States -->
.page-loading    (centered spinner container, padding-top 48px)
.empty           (centered error text, padding 48px, font-weight 600)
.empty-state     (centered hint/empty text, padding 32px, font-sm, font-weight 600)

<!-- Card row detail -->
.detail-label    (13px / ink-4 / 600 — row label in info cards)
.detail-value    (19px / ink / 700 — row value in full-size detail cards)
.fact-value      (17px / ink / 700 — compact value in fact grids)
```

### Design tokens (all available as CSS custom properties)

```
Colors:   --primary  --primary-strong  --primary-soft  --primary-soft-bg
          --ink  --ink-2  --ink-3  --ink-4
          --bg  --surface  --line  --line-strong
          --success  --success-soft  --warn  --warn-soft

Spacing:  --pad (16px)  --gap (16px)  --card-pad (16px)
Radius:   --radius (14px)  --radius-sm (10px)  --radius-xs (6px)
Font:     --font-xs/sm/base/md/lg/xl/2xl  (12→26px)
Shadows:  --shadow-sm/md/lg  --shadow-fab
Cards:    --card-bg  --card-border  --card-shadow  (set by [data-card] attribute)
```

---

## 5. How to Build a New Screen

### Step 1 — Generate the page

```bash
cd /Users/tamas/SabeeAppGO/sabeeapp-go
ionic generate page pages/my-screen --no-interactive
```

This creates `src/app/pages/my-screen/` with `.ts`, `.html`, `.scss`, `.spec.ts`.

**Immediately delete the module files** (the CLI generates them even for standalone projects):
```bash
rm src/app/pages/my-screen/my-screen.module.ts
rm src/app/pages/my-screen/my-screen-routing.module.ts
```

### Step 2 — Make the component standalone

Open the generated `.ts` and change:

```typescript
// generated (wrong)
@Component({ selector: 'app-my-screen', ..., standalone: false })
export class MyScreenPage implements OnInit { ... }

// correct
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-my-screen',
  templateUrl: './my-screen.page.html',
  styleUrls: ['./my-screen.page.scss'],
  standalone: true,
  imports: [IonContent],  // add other Ionic components as needed
})
export class MyScreenPage { ... }
```

### Step 3 — Add the route

In `src/app/app.routes.ts`, add a lazy-loaded entry:

```typescript
{
  path: 'my-screen',
  canActivate: [authGuard],   // omit for unauthenticated screens
  loadComponent: () => import('./pages/my-screen/my-screen.page').then(m => m.MyScreenPage),
},
```

### Step 4 — Write the template

Use `IonContent` as the only Ionic wrapper. Everything inside is plain HTML with prototype class names:

```html
<!-- Scrollable screen with sub-header (detail screens) -->
<ion-content>
  <div class="page">

    <div class="sub-header">
      <button class="back" (click)="back()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <span class="title">Screen Title</span>
    </div>

    <div class="app-scroll">
      <!-- content here -->
    </div>

  </div>
</ion-content>
```

```html
<!-- Root screen (no back button, has page-header) -->
<ion-content>
  <div class="page">

    <div class="page-header">
      <div class="title-row">
        <h1>Property Name</h1>
        <I.ChevronDown />
      </div>
      <div class="actions">
        <button class="icon-btn"><!-- bell icon --></button>
        <button class="icon-btn"><!-- settings icon --></button>
      </div>
    </div>

    <div class="app-scroll">
      <!-- scrollable content -->
    </div>

  </div>
</ion-content>
```

### Step 5 — Clear the component SCSS

Leave the component `.scss` file empty or with just a comment. Never put shared-component styles in here:

```scss
// Component styles — all layout in sabeeapp-design.scss
```

> **Critical rule:** Never invent class names in a template that don't already exist in `sabeeapp-design.scss`. If you use a class, it must be in that file or the element will be unstyled. For one-off layout that doesn't need a reusable class, use inline styles — the same way the prototype does.

### Step 6 — Navigate to/from the screen

```typescript
// Navigate forward
this.router.navigate(['/my-screen'], { state: { somePayload: value } });

// Read payload
const payload = this.router.getCurrentNavigation()?.extras?.state?.['somePayload'];

// Navigate back
this.router.back();   // or
window.history.back();
```

---

## 6. Status Pills

Use the `<app-pill>` pattern from the prototype — or a plain span with the right classes:

```html
<span class="pill" data-status="check-in">Check-in</span>
<span class="pill" data-status="onboard">Onboard</span>
<span class="pill" data-status="check-out">Check-out</span>
<span class="pill" data-status="confirmed">Confirmed</span>
<span class="pill" data-status="open">Open</span>
```

The pill visual mode (soft/solid/outline) is controlled by a `[data-pill]` attribute on a parent element (the prototype puts it on `.app-window`; for now default is `soft`).

---

## 7. Auth Service API

`AuthService` (`src/app/services/auth.ts`) exposes Signals — inject it and read them directly in templates:

```typescript
// Signals (readable in templates without async pipe)
auth.isAuthenticated()        // boolean
auth.accessToken()            // string | null
auth.name()                   // string | null — from GET /users/me, populated after property selection
auth.email()                  // string | null
auth.roles()                  // string[]
auth.selectedProperty()       // PropertyInterface | null
auth.properties()             // PropertyInterface[] — populated by loadProperties(), persisted
auth.deviceId()               // string

// Async methods
await auth.login(email, password)          // → { mfaToken: string }
await auth.verifyMfa(mfaToken, code)       // sets auth state
await auth.loadProperties()               // → PropertyInterface[]
await auth.selectProperty(property)       // persists selection + calls fetchUser() if name missing
await auth.fetchUser()                    // GET /users/me → stores name; called by selectProperty() and loadStoredAuth()
await auth.refreshAccessToken()           // called automatically by interceptor
await auth.logout()                       // clears state + storage
await auth.loadStoredAuth()              // called once at app boot

// Used by interceptor
auth.needsRefresh()   // true when < 5 min remain (NOT the old app's buggy 10-second window)
```

---

## 8. Reservation Service

`ReservationService` (`src/app/services/reservation.ts`) fetches and holds the reservation list as a Signal.

```typescript
// Signals
res.reservations()   // ReservationInterface[] — all fetched reservations (±14 day window)
res.loading()        // boolean
res.error()          // string | null

// Methods
await res.fetchReservations()   // GET /reservations?start_date&end_date (±14 days)
```

**Status mapping** — `pillStatus(apiStatus: string)` converts API status to prototype pill value:

| API value | Pill data-status |
|---|---|
| `checkin` | `check-in` |
| `checkedin` | `onboard` |
| `checkout` / `checkedout` | `check-out` |
| `onboard` | `onboard` |
| `confirmed` | `confirmed` |
| anything else | `open` |

**Filtering for tabs:** filter `res.reservations()` by `r.arrival_date === targetDate` (format `yyyy-MM-dd`).

**Dimming rule:** `opacity: 0.5` when tab !== "Today" && `pillStatus(r.status) === 'open'`.

---

## 9. Options Service

`OptionsService` (`src/app/services/options.service.ts`) holds app-wide static reference data fetched from `GET /options`. It is a `providedIn: 'root'` singleton — one instance for the lifetime of the app.

### Lifecycle rule: load once, clear on property switch

```typescript
// Called once in PropertySelectPage.select(), after auth.selectProperty():
await options.load();    // fetches /options, populates signal

// Called at the top of PropertySelectPage.select() before selectProperty():
options.clear();         // resets signal to [] so re-selecting a property always re-fetches
```

**Why here and not at app boot:** `Property-Id` is added to request headers only after `auth.selectProperty()` completes. Loading options before that would send the request without the correct property context.

### Reading data in components

```typescript
// Inject the service
constructor(public options: OptionsService) {}

// Use the signal directly in the template (synchronous — already populated by the time any guarded screen loads)
@for (c of options.countries(); track c.country_code) {
  <option [value]="c.country_code">{{ c.name }}</option>
}
```

**Do not fetch `/options` inside individual components.** By the time any `authGuard`-protected page loads, `options.countries()` is already populated.

### Exported types

```typescript
export interface CountryOption {
  id: number;
  name: string;
  country_code: string;   // stored value, e.g. "HU", "DE"
}

export interface SelectOption {
  value: string;   // stringified numeric id
  label: string;   // display name
}
```

### Available signals

```typescript
options.countries()      // CountryOption[]  — from options.country
options.documentTypes()  // SelectOption[]   — from options.document_type
options.genders()        // SelectOption[]   — from options.gender
```

Usage in templates:

```html
<!-- Document type dropdown -->
<select [(ngModel)]="form.document_type">
  @for (dt of options.documentTypes(); track dt.value) {
    <option [value]="dt.value">{{ dt.label }}</option>
  }
</select>

<!-- Gender dropdown (guard against empty to avoid orphan label) -->
@if (options.genders().length) {
  <select [(ngModel)]="form.gender">
    @for (g of options.genders(); track g.value) {
      <option [value]="g.value">{{ g.label }}</option>
    }
  </select>
}
```

---

## 10. API Contract

**Base URL:** `https://smart.sabeeapp.com/api2/go`

**Headers injected automatically by `api.interceptor.ts` on every request:**

```
Api-Version:  1.0
App-Version:  1.1.0
Ci-Version:   4
Device-Id:    <from @capacitor/device>
Lang:         en
Token:        <accessToken>         (omitted when not authenticated)
Property-Id:  <property_id>         (omitted until property is selected)
```

**Auth endpoints:**

| Step | Method | Path | Body |
|---|---|---|---|
| Login | POST | `/token` | `{ username, password, device_id, grant_type: "password", client_id: "366f7aff6d185668" }` |
| MFA verify | POST | `/mfa/verify` | `{ mfa_token, method: "totp", code }` |
| Refresh | POST | `/token` | `{ grant_type: "refresh_token", refresh_token }` |
| Properties | GET | `/properties` | — |
| Reservations | GET | `/reservations` | `?start_date=yyyy-MM-dd&end_date=yyyy-MM-dd` |
| Options | GET | `/options` | — · returns `{ data: { options: { country, gender, document_type } } }` · fetched once via `OptionsService.load()` at property selection |
| Current user | GET | `/users/me` | — · requires `Property-Id` header · returns `{ data: [{ user_id, name, email, role }] }` (array) · called by `auth.fetchUser()` after property selection |
| Reservation detail | GET | `/reservations/:code` | — |
| Guests | GET | `/reservations/:code/guests` | — |
| Update guest | PUT/PATCH | `/guests/:guestId` | guest fields |

**API response wrapper:**
```typescript
interface ApiResponse<T> { success: boolean; data: T; errors: unknown; }
```

---

## 11. Bugs Fixed Versus Old App — Do Not Reintroduce

| # | Old bug | Correct behaviour |
|---|---------|-------------------|
| 1 | Proactive token refresh triggered with ~10 s remaining (`expiresAt - 3590s`) | Refresh when **< 5 min remain**: `auth.needsRefresh()` → `expiresAt - Date.now() < 300_000` |
| 2 | Biometric inactivity timer: `diffLimit = 60 * 0.5` = 30 seconds | Lock threshold is **60 seconds** (`LOCK_AFTER_MS = 60_000` in `AppComponent` and `BiometricService`) |
| 3 | Auth stored as 5 separate Preferences keys | Stored as **one JSON blob** under `Config.STORAGE_AUTH_KEY` |
| 4 | `Property-Id` header sent with empty value during login flow | Interceptor only adds it **when `auth.selectedProperty()` is non-null** |

---

## 12. Ionic Component Rules

**Use Ionic components sparingly** — only for things that need native behaviour:

| Use Ionic for | Use plain HTML for |
|---|---|
| `IonContent` (scroll container) | All form inputs (`<input>`, `<select>`) |
| `IonSpinner` (loading state) | Buttons (`.btn`) |
| `AlertController` (error dialogs) | Cards, headers, nav items |
| `IonRefresher` (pull-to-refresh) | Labels, icons, lists |

**Never use** `IonInput`, `IonItem`, `IonButton`, `IonSelect` for screens that need the prototype look — they inject their own visual styles that fight our design system.

**Import pattern for standalone pages:**

```typescript
import { IonContent, AlertController } from '@ionic/angular/standalone';
// NOT from '@ionic/angular' (that's the old module-based import)
```

---

## 13. Routing Reference

```typescript
// app.routes.ts — current routes
/login            → LoginPage        (no guard)
/mfa              → MfaPage          (no guard, receives mfaToken via router state)
/property-select  → PropertySelectPage (no guard, after MFA)
/home             → HomePage         (authGuard)
/search           → SearchPage       (authGuard)
/reservation/:code → ReservationDetailPage (authGuard, fetches detail + guests on init)
/guest/:code/:guestId      → GuestDetailPage (authGuard, read-only view + FAB action sheet)
/guest/:code/:guestId/edit → GuestEditPage   (authGuard, form + POST /guests on save)
```

**Guard:** `authGuard` (`src/app/guards/auth.guard.ts`) redirects to `/login` if `auth.isAuthenticated()` is false.

**Boot redirect** (`app.component.ts` `ngOnInit`):
1. `await auth.loadStoredAuth()` — restores tokens + selected property from Capacitor Preferences
2. If authenticated → `await biometric.checkAndLock()` — lock if backgrounded for ≥ 1 min before cold start
3. If authenticated + property selected → `/home`
4. If authenticated + no property → `/property-select`
5. Else → `/login`

---

## 14. Biometric Session Lock

`BiometricService` (`src/app/services/biometric.ts`) owns the session-lock state. It is a **session lock** (not a login replacement) — tokens remain valid, no server round-trip on unlock.

### Lock triggers

| Trigger | Mechanism |
|---|---|
| Inactivity ≥ 1 min | `setTimeout` in `AppComponent`, reset by `@HostListener('touchstart'/'click')` |
| Background ≥ 1 min | `App.addListener('appStateChange')` in `AppComponent`; timestamp persisted to `Config.STORAGE_BACKGROUND_AT_KEY` |
| Cold start after long background | `biometric.checkAndLock()` called in boot sequence after `loadStoredAuth()` |

### BiometricService API

```typescript
biometric.sessionLocked()          // signal<boolean> — read in templates
biometric.lockSession()            // set locked = true
biometric.unlockSession()          // set locked = false
await biometric.recordBackground() // persist Date.now() to storage (called on appStateChange pause)
await biometric.checkAndLock()     // read stored timestamp; lock if elapsed ≥ 60s; clear timestamp
await biometric.isAvailable()      // boolean — device has enrolled biometrics
await biometric.authenticate()     // boolean — true on success, false on failure/cancel
```

### Lock overlay

`LockOverlayComponent` (`src/app/components/lock-overlay/`) renders in `AppComponent` template when `biometric.sessionLocked() && auth.isAuthenticated()`. It auto-calls `authenticate()` on `ngOnInit`. After 3 failures, a "Use password instead" button appears that calls `auth.logout()` and navigates to `/login`.

### In-browser behaviour

The native biometric plugin is unavailable in the browser. `authenticate()` catches the error and returns `false`, so the lock overlay appears but every unlock attempt registers as failure. This is expected — test the actual biometric flow on a device or simulator.

### Plugin

`capacitor-native-biometric@4.2.2` — supports iOS Face ID + Touch ID. `NSFaceIDUsageDescription` is set in `ios/App/App/Info.plist`.

---

## 15. Running the App

```bash
cd /Users/tamas/SabeeAppGO/app
ionic serve              # dev server at http://localhost:4200
npx ng build             # production build check (must be zero errors, zero warnings)
npm run sync:ios         # sync Capacitor plugins after npm install (auto-patches Package.swift)
```

The CLI (`ionic`) must be installed globally: `npm install -g @ionic/cli`

Node version: v25 (odd, non-LTS) — produces a deprecation warning from Angular CLI but builds correctly.

---

## 16. iOS Build & TestFlight

### Build flow

```bash
cd /Users/tamas/SabeeAppGO/app
npm run build -- --configuration production
npm run sync:ios
# ✔  DocumentReaderPlugin is patched back automatically

xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme SabeeAppGo \
  -configuration Release \
  -destination generic/platform=iOS \
  -archivePath /tmp/SabeeAppGo-<N>.xcarchive \
  archive

xcodebuild -archivePath /tmp/SabeeAppGo-<N>.xcarchive \
  -exportArchive \
  -exportOptionsPlist /tmp/ExportOptions.plist \
  -exportPath /tmp/SabeeAppGo-<N>-export
```

ExportOptions.plist (create in `/tmp` — not committed):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>destination</key>
    <string>upload</string>
</dict>
</plist>
```

### DocumentReaderPlugin — patched automatically by `npm run sync:ios`

`cap sync ios` regenerates `ios/App/CapApp-SPM/Package.swift` and removes the local `DocumentReaderPlugin` entry every time. **Always use `npm run sync:ios` instead of `npx cap sync ios`** — it runs `scripts/patch-package-swift.js` immediately after sync to restore both entries. Running bare `cap sync ios` will break the build.

### Build number

`CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` — increment before each TestFlight upload. Current: **18**.

### App Store requirements

- `NSCameraUsageDescription` must be in `Info.plist` — Regula SDK references camera APIs even if you don't call `AVCaptureSession` directly.
- `NSFaceIDUsageDescription` must be in `Info.plist` — for biometric authentication.

---

## 17. Pull-to-Refresh (Home Screen)

Uses standard `ion-refresher slot="fixed"` with `ion-refresher-content` — no custom visual overrides. The Ionic native refresher handles gesture detection, animation, and the spinner.

```html
<ion-refresher slot="fixed" (ionRefresh)="handleRefresh($event)">
  <ion-refresher-content></ion-refresher-content>
</ion-refresher>
```

```typescript
async handleRefresh(event: CustomEvent) {
  await this.res.fetchReservations(true);
  (event.target as HTMLIonRefresherElement).complete();
}
```

No custom state, no page translation, no ptr-chip. Previous custom implementation caused: needing to pull too far (page translateY fought the gesture), intermittent missing animation (async getProgress() race), intermittent missing spinner (500ms reset timer race).

---

## 18. Reservation Detail — Fresh Guest Data on Back-Navigation

`ReservationDetailPage` implements `ionViewWillEnter` (from `@ionic/angular`) in addition to `ngOnInit`. `ngOnInit` only fires once; `ionViewWillEnter` fires every time the page comes into view (including on back-navigation from GuestEditPage).

```typescript
async ionViewWillEnter() {
  if (!this.reservationCode) return;
  try {
    this.guests.set(await this.res.fetchGuests(this.reservationCode));
  } catch { /* keep existing list */ }
  // Sync booker name from service signal (updated optimistically by updateGuest)
  const synced = this.res.reservations().find(r => r.reservation_code === this.reservationCode);
  if (synced) {
    this.reservation.update(prev => prev ? { ...prev, booker: synced.booker } : prev);
  }
}
```

`ReservationService.updateGuest()` patches the `_reservations` signal in-place after a successful save, matching on `booker.booker_id === guest.guest_id`. This means the home screen reservation list also reflects name changes without a full re-fetch.

---

## 19. Changelog

### 2026-07-06 — IDScanly: completeness-check overhaul (manual vs auto), submit-progress overlay, per-property extended logging

> Branch `add-idscanly`. **Shipped builds: iOS 82, 83, 84, 85, 86 (TestFlight).** All from real-device/browser testing feedback in one continuous session. Local LAN browser testing (`ionic serve --ssl --external`) was used heavily alongside TestFlight since IDScanly is browser-based (`getUserMedia`/OpenCV), not a native plugin — no native rebuild needed to iterate on most of this.

**Completeness check false positives — root-caused and fixed in two passes (builds 82→84).** After adding a post-capture "is the whole document visible" check (coverage + aspect-ratio + corner-detection on the captured image), real-device testing showed it flagging fully-legible, successfully-recognized captures ("Part of the document is out of frame") on essentially every manual capture and some auto ones.

- **Pass 1 (build 82, `capture-tuning.ts`):** first hypothesis was the thresholds were simply too strict — relaxed `minCaptureCoverageFraction` 0.85→0.72. Didn't fix it.
- **Pass 2 (build 84, `document-detection.service.ts`):** actual root cause — the check ran on the *saved* capture, not the live frame. Warp mode (`extractPaper`) maps the card's corners exactly onto the output canvas, so the saved image has **no card edges left inside it** for Canny to find; the manual guide-box crop is nearly as tight. New `analyzeCompletenessOnFrame()` runs instead on the FULL pre-crop camera frame (guide box + `completenessMarginFraction` 0.2 margin, enough to include the card edges + background context), reusing the existing `detectCornersOnFrame`/`scaleCornersToFull`/`cropCanvas` primitives. Coverage is now quad-vs-guide-box (not quad-vs-captured-canvas, which was unmeasurable post-warp — the whole bug). Adds a `reason: 'not-found' | 'clipped' | 'geometry'` to `CaptureQuality.metrics` so the Review screen's "Show debug" toggle (new, mirrors the Scan page's debug overlay) shows *why*, not just pass/fail — this is what let the next round be diagnosed from real numbers instead of another guess.
- **Pass 3 (build 86 — actually landed in 85, see below):** even after the pre-crop fix, manual captures (hand-held, single ungated frame) kept false-flagging while auto (multi-frame live-gate-confirmed) didn't. Traced to the check using identical thresholds regardless of capture source — a hand-held tilt is *genuinely* foreshortened in the 2D image (real perspective, not detection error). Added `manualCompletenessRatioTolerance` (0.75 vs auto's 0.45) and `manualMinCaptureCoverageFraction` (0.45 vs auto's 0.72), plus a source-aware clip-boundary check (manual's actual saved output is just the guide box, no margin, so its clip test compares against the guide box itself, not the padded analysis region). Mirrors the existing `PASSPORT_TUNING` precedent (loosen geometry tolerance for "hard to frame precisely," don't disable the check).

**Review screen polish (build 82):** deduped the per-side status sub-line (was hardcoding "Could be clearer" even when the summary already said something else); moved the "one side could be clearer" warning + submit error out of the scrollable area into the always-visible sticky bar above Submit (previously a user could tap Submit without ever scrolling to see it); dropped the "Submit both sides" / "Submit" conditional label to a plain static "Submit" (no partial-submit option exists, so the qualifier was misleading); added the "Show debug" per-side metrics toggle.

**Submit-progress overlay (build 82):** `idrecognition` is a single opaque fetch that the edge function internally polls up to 30s for (`docs/idrecognition-handoff.md`) — previously the only feedback was a spinner glyph in the button. New full-screen overlay (mirrors the Scan page's `.scanner-loader`) with a 10-dot chase loader (pure CSS, no JS animation loop) and three TIMED stages: "Processing images…" (0s) → "Running recognition…" (2.5s) → "Still working — almost there…" (10s, covers the documented long-tail case) — plus a fixed privacy line ("The photos of your document are not stored after processing" — confirmed accurate, not a guess). New `?preview=submitting` dev hook for browser testing since `submit()` early-returns in preview mode otherwise.

**Post-submit note decluttering (build 84):** new `submitAttempted` signal hides the pre-submit quality warning the instant Submit is tapped, so it stops competing with a real `submitError` if the request fails.

**Per-property extended logging → Sentry (builds 85, 86).** A `console.log` of the full `idrecognition` response (added for local debugging) was flagged as a real risk: Sentry's default breadcrumb integration captures *all* `console.*` calls app-wide (separate from the explicit `consoleLoggingIntegration({levels:['warn','error']})` in `main.ts`, which only feeds Sentry's Logs feature) — meaning guest PII (name, DOB, document number, mother's maiden name) could ride along on any unrelated error's breadcrumb trail, for every property, contradicting this app's existing practice of keeping guest PII out of third-party services (see Mixpanel's metadata-only approach, Session 19).
- **New Supabase column** `property_settings.extended_logging boolean not null default false` (migration `add_extended_logging_to_property_settings`), set `true` only for property `6250` (the IDScanly test property).
- **`PropertyConfigService`** (`app/src/app/services/property-config.service.ts`): new `extendedLogging` signal, read alongside `scan_vendor`/`scan_doc_types` in `load()`; also fires `console.warn('Logging Enabled for <propertyId>')` whenever it reads `true` — deliberately `console.warn` (not `.log`) so the existing `consoleLoggingIntegration` picks it up, confirming in Sentry that the flag is active *independent of any scan attempt* (no direct `Sentry.logger` call needed for this one).
- **`review.page.ts`**: the bare `console.log` replaced with `logIdscanlyResponse()`, gated on `propertyConfig.extendedLogging()` — folds console output into the same gate too, so every *other* property gets nothing logged anywhere (closing the original leak concern generally, not just for Sentry). When enabled, sends both `console.log` and `Sentry.logger.info('idscanly response', attributes)` (Sentry Logs, not breadcrumbs — mirrors Regula's `logScanOutcome`/`buildScanDiagnostics` pairing), with a flat-attributes + size-capped JSON-blob shape matching that existing convention.
- **`main.ts`**: added `beforeSendLog` to `Sentry.init()` dropping any log whose message contains `[webpack-dev-server]` — the LAN dev-serve session's own live-reload client logs its compile warnings/WebSocket errors via `console.warn`/`.error`, which `consoleLoggingIntegration` was faithfully forwarding as unrelated noise alongside the real scan diagnostics. Dev-server-only; doesn't touch TestFlight/production.
- **Known open item, diagnosed not fixed:** on the LAN self-signed-HTTPS dev session specifically, Sentry's envelope `fetch()` was observed failing with `Fetch API cannot load ... due to access control checks` (a CORS/network failure) in Safari's Web Inspector — `extended_logging` read correctly (`console.warn` fired, proving our code path works) but delivery to Sentry's ingest endpoint failed at the browser/network layer. Suspected artifact of the self-signed cert + Safari's fetch/CORS handling for that specific local setup, not a code bug — build 86 on TestFlight (real HTTPS, no self-signed cert) is the way to confirm.

**Verification:** `npm run build` clean throughout (only the pre-existing SCSS-budget/CommonJS warnings). Device/browser-verified per-fix as described above (debug-readout numbers, the specific ID card + passport captures that were false-flagging, the sticky-bar note timing, the staged submit messages). **Not yet fully closed:** whether builds 85/86's `manualCompletenessRatioTolerance`/`manualMinCaptureCoverageFraction` numbers are exactly right for real-world hand-held captures beyond the two test documents used, and whether the Sentry CORS issue above reproduces on TestFlight (86) or is confirmed LAN-dev-only.

### 2026-07-05 — IDScanly: build 81 ships the accumulated Review-page fixes

> Branch `add-idscanly`. **Shipped build: iOS 80→81 (TestFlight).** Bundles every fix logged below that was previously marked "No build/version bump yet": the document-type canonical-enum mapping (guest-edit prefill + save), the scan-screen header safe-area-inset fix (unreachable back button), the Review page layout bug + dark theme, the Review header/margin match to the rest of the app, and the review-summary-card → plain-instructional-text replacement.

**Verification:** each fix's own entry below already covers build-clean status; none had been device-verified before this shipment. Build 81 is now processing in TestFlight — device-verify all five together (Document Type select prefill/save, scan-header back button reachable, Review page fixed header + visible Retake buttons + dark theme, Review margins/header match, plain-text review summary).

### 2026-07-04 — IDScanly: Review page summary card replaced with plain instructional text

> Branch `add-idscanly`. No build/version bump yet. Follow-up: the boxed "ID card / 2 sides captured · check before submitting" summary row (icon + bordered card) was replaced with a single plain text line, styled like the Scan screen's `.scan-message` instructional text ("Scanning the 1st page") — no icon, no border/card.

- **[review.page.html](src/app/idscanly/pages/review/review.page.html):** the `.review-summary` block (id-card icon box + title/meta text pair) removed; replaced with `<p class="review-message">{{ documentType()?.label }} — {{ captureSummary() }}</p>`, still driven by the same `documentType()`/`captureSummary()` signals — content unchanged, just the presentation.
- **[review.page.scss](src/app/idscanly/pages/review/review.page.scss):** `.review-summary` and its `__icon`/`__text`/`__title`/`__meta` rules deleted; new `.review-message` mirrors `.scan-message`'s typography (21px/600-weight/`#f0efe8`), sized down slightly in vertical spacing since `.review-scroll` already provides the horizontal inset (unlike `.scan`, which has no container padding and relies on each child section setting its own).

**Verification:** `npm run build` clean (same two pre-existing budget/CommonJS warnings). Not yet device-verified.

### 2026-07-04 — IDScanly: Review page header style + horizontal margins to match the rest of the app

> Branch `add-idscanly`. No build/version bump yet. Follow-up to the layout/dark-theme fix above — requested to (1) use the same left-right content margin as every other screen, and (2) match the Scan screen's plain header instead of the global boxed/centered-title header.

- **Horizontal margin** ([review.page.scss](src/app/idscanly/pages/review/review.page.scss) `.review-scroll`): was `padding-bottom` only (cards ran edge-to-edge). Other detail screens inset their scrollable content by `var(--pad)` (16px) on an inner wrapper (e.g. guest-detail's `<div style="padding: 0 16px">`) — `.review-scroll` now gets `padding: 0 var(--pad) calc(80px + env(safe-area-inset-bottom, 0px))`, matching that convention with the design-token variable rather than a hardcoded value.
- **Header style**: the global `.sub-header` centers its `.title` via `position:absolute;left:50%;transform:translate(-50%,-50%)` with an 800-weight/17px look, and its `.back` button is a 44×44 rounded hit-box with hover/active background states — a heavier, more decorative treatment than the Scan screen's `.scan-header` (plain flex row, title sits directly next to a bare icon button, no box, no centering, 16px/500-weight). Since Angular scopes component styles, the review page's `.sub-header`/`.back`/`.title` are overridden locally (same markup, no HTML change) to drop the absolute centering and the button's box/hover treatment, matching `.scan-header`'s plain look and palette (`#b4b2a9` back icon, `#f0efe8` title, same `calc(14px + safe-area-inset-top) 16px 10px` padding). Purely a scoped CSS override — no shared class/component was introduced (mirrors how each page already owns its own header CSS in this codebase).

**Verification:** `npm run build` clean (same two pre-existing budget/CommonJS warnings, both below the error threshold). Not yet device-verified.

### 2026-07-04 — IDScanly: Review page layout bug (missing header/2nd retake button) + dark theme

> Branch `add-idscanly`. No build/version bump yet. Reported from a TestFlight screenshot: the Review (capture-preview) page looked "weird" — the sub-header wasn't visible, there was a large empty gap above the sticky submit button, and the 2nd side's Retake button was missing. Also requested: the Review page should match the Scan screen's dark look instead of its original light design.

**Root cause (layout bug):** `.app-scroll` ([sabeeapp-design.scss](src/theme/sabeeapp-design.scss)) is `flex: 1; overflow-y: auto` — it only becomes its own independently-scrolling region when its parent `.page` is `display: flex; flex-direction: column`. Every other page with a scrollable body + sticky footer (e.g. [guest-edit.page.html](src/app/pages/guest-edit/guest-edit.page.html)) sets this via an inline `style="display: flex; flex-direction: column"` on its `.page` div — **Review's `.page` div never had it.** Without it, `.app-scroll`'s `flex:1`/`overflow:auto` are no-ops, so the *entire* `.page` (header included) became one long block that `ion-content`'s own native scroll moved as a unit — the header scrolled away with everything else instead of staying fixed, which is what the screenshot showed. Compounding this: **the sticky submit button was a `position:absolute` child *inside* `<ion-content>`**, unlike guest-edit's proven pattern (its Save button is a sibling placed *after* `</ion-content>` closes, explicitly commented "fixed outside ion-content so it never scrolls"). Left inside, the button's positioning was unreliable relative to whatever content happened to scroll underneath it, which is what covered the 2nd card's Retake row.

- **Fix** ([review.page.html](src/app/idscanly/pages/review/review.page.html)): added the inline flex style to `.page` (now matches guest-edit exactly), and moved `.sticky-btn-bar` to be a sibling *after* `</ion-content>` instead of a child inside it. The lightbox (`position: fixed`) was left in place — `fixed` already escapes any scrolling/containing-block ambiguity regardless of nesting.
- **Dark theme** ([review.page.scss](src/app/idscanly/pages/review/review.page.scss)): reskinned to match the Scan screen's palette exactly (`#1c1c1a` page bg via a new `.review-content { --background }` hook mirroring `.scan-content`, `#f0efe8` primary text, `#b4b2a9` secondary text, `#3a3a36` dividers, `#0d0d0c` recessed surfaces). Rather than overriding every individual selector, the shared `--card-bg`/`--card-border`/`--card-shadow` custom properties (that `.card`/`.side-card`/`.review-summary` already read) are redefined once on `.page` — CSS custom properties cascade to descendants regardless of Angular's per-component style scoping, so this repaints every `.card`-based element in one place. `.sub-header`'s `.back`/`.title` colors, the retake button, error banner (now matches the scan screen's `.debug__error` dark-red style), and the sticky bar background were each given scoped dark overrides — all scoped to this component's stylesheet (Angular emulated encapsulation), so nothing leaks to other pages. Semantic accent colors (`--success`/`--warn`, the quality pills) were deliberately left unchanged — they're vivid enough to read correctly on both light and dark.

**Verification:** `npm run build` clean (only the pre-existing SCSS-budget/CommonJS warnings, both below the error threshold). **Not yet device-verified** — needs a TestFlight/device check that: the header now stays fixed while scrolling, both cards' status/Retake rows are visible without being covered, and the button no longer floats with an odd empty gap above it.

### 2026-07-04 — IDScanly: scan-screen header sat under the status bar (unreachable back button)

> Branch `add-idscanly`. No build/version bump yet. Reported from a TestFlight screenshot: the back chevron + "ID card: 2nd Page" title rendered at the very top of the screen, overlapping the status bar/TestFlight ribbon, making back navigation impossible.

App-wide convention ([sabeeapp-design.scss](src/theme/sabeeapp-design.scss)): `ion-content { --padding-top: 0 }` globally (content extends under the notch/status bar, `viewport-fit=cover` + `black-translucent`), so **every page header is individually responsible for adding its own `env(safe-area-inset-top)`** — e.g. `.sub-header` does this already. The IDScanly scan page's custom `.scan-header` ([scan.page.scss](src/app/idscanly/pages/scan/scan.page.scss)) never got this treatment — flat `padding: 14px 16px 10px` with no top inset — so on a real device (status bar present) the header rendered under it instead of below it.

- **Fix:** `padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 10px;` — same pattern as `.sub-header`, `env()` written directly in the property value per the project's safe-area rule (never nested in a custom property — WebKit bug). The Review page already uses the shared `.sub-header` class, so it was unaffected.

**Verification:** `npm run build` clean. **Not yet device-verified** — needs a TestFlight/device check that the back button is now below the status bar and tappable.

### 2026-07-04 — IDScanly: Document Type not prefilled on guest-edit (value-vocabulary fix)

> Branch `add-idscanly`. No build/version bump yet (local verification; ship with the next TestFlight build). Follow-up to the field-map fixes above, reported after clicking Edit from an IDScanly scan-result sheet.

The Document Type `<select>` on guest-edit was blank after Edit, even though the result sheet had correctly displayed the recognized type. **Not a missing prefill** — `guest-edit.page.ts:129-131` already reads the scan's `document_type` into `form.document_type` unconditionally (vendor-agnostic, shared with Regula). The bug is a **value-vocabulary mismatch**: the `<select>`'s `<option value>`s come from `options.documentTypes()` ([options.service.ts](src/app/services/options.service.ts)) — the API's own canonical enum, populated from `GET /options`. Regula's scan path deliberately produces exactly that enum (`document-reader.service.ts:615-627` hardcodes `'id'|'passport'|'driving_license'` via `Config.ID_CARDS`/`PASSPORTS`/`DRIVING_LICENCES`) specifically so the value round-trips through this shared `<select>`. IDScanly's mapper never did that translation — it stored the OCR's own freeform classification string (live-captured: `"identity_card"`) or the human label (`"ID card"`), neither of which matches any `<option value>`, so the native select silently fell back to the blank option. The same wrong value also flowed into the **Save** payload (`guest.document.document_type`), a more severe consequence of the identical bug.

- **Fix** ([idscanly-docuscan.service.ts](src/app/idscanly/services/idscanly-docuscan.service.ts)): new `CANONICAL_DOCUMENT_TYPE` map (`'id-card'→'id'`, `'passport'→'passport'`, `'driving-licence'→'driving_license'`) translates the app's own `DocumentTypeId` — which the user explicitly picked in the doc-type sheet *before* scanning, so it's always known and authoritative — into the API's enum. The `scannedData.document_type` box (feeds both the edit `<select>` and the save payload) now uses this canonical value instead of the OCR string. `documentData.document_type` (the separate, **display-only** field feeding the result sheet's `docTypeName()` friendly-label lookup) is deliberately left reading the raw OCR string — unaffected, preserves display fidelity.
- **Side-effect fixed for free:** the mapper previously set a non-null `document_type` box even for address-card scans, which — via the shared `fillGuestDataFromScannedData()` document-merge — silently overwrote the guest's existing `document.document_type` on an address-card scan, contradicting the documented "address card touches only guest.address" invariant. The canonical map omits `'address-card'` (→ `box(null)`), and `null ?? existing` in the merge now correctly preserves the existing value.
- **Confirmed shared/pre-existing mechanism, not IDScanly-only:** the guest-edit prefill + `<select>` comparison code has no vendor branch and predates IDScanly (shipped Build 15, 2026-05-09). Regula's own literals happen to already match `/options` by design (that's the whole reason `Config.ID_CARDS`/etc. exist), so Regula was unaffected in practice — but the underlying value-space mismatch is general-purpose code, worth remembering if a future scan source is added.

**Verification:** `npm run build` clean. **Not yet device-verified:** scan ID card / passport / driving licence via IDScanly → Edit → confirm the select preselects correctly for each; Save → reopen → confirm `document_type` persists as the canonical value; scan an address card → Save → confirm the guest's existing document type is unchanged.

### 2026-07-04 — IDScanly: field-map fixes from first device test

> Branch `add-idscanly`. **Shipped build: iOS 79→80 (TestFlight).** Follow-up to the integration below, after the first on-device scan (Hungarian ID, property 6250) returned a live `idrecognition` response.

The mapper's field names were written blind and **didn't match the live response**, silently dropping the guest's **name and mother's name** from both the scan-result sheet and the saved guest. The captured `summary.fields` uses `givenNames`/`surname`/`motherMaidenName` (not `firstName`/`lastName`/`motherName`), has no `dateOfIssue` (issue date is in `visibleDates[0]`), and no `age`. Five fixes:

- **Name + mother's name (data loss, primary)** ([idscanly-docuscan.service.ts](src/app/idscanly/services/idscanly-docuscan.service.ts) + `IdRecognitionFields` in [idrecognition.service.ts](src/app/idscanly/services/idrecognition.service.ts)): read `givenNames ?? firstName` → `first_name`, `surname ?? lastName` → `last_name`, `motherMaidenName ?? motherName` → `mother_name` (old names kept as fallbacks). The sheet's name row `@if` guards on `first_name`/`last_name`, so it was hidden entirely until this. Downstream unchanged — Regula's shared `fillGuestDataFromScannedData()` flat-copies these boxes onto the guest, so they now display **and** persist on Save.
- **Age** — computed from `dateOfBirth` via a new pure `computeAge()` helper (was hard-null → "N/A").
- **Issue date** — `dateOfIssue ?? visibleDates[0]` → `date_of_issue_of_the_document` + `documentData.date_of_issue` (best-effort; feeds the saved guest).
- **Document type label** ([guest-detail.page.ts](src/app/pages/guest-detail/guest-detail.page.ts) `docTypeName`): added the API/DB enum spellings `identity_card`/`driving_license`/`address_card` (+ no-underscore variants) → the sheet showed raw `identity_card` instead of "ID Card". Single display chokepoint — also fixes the guest read view. Mapper still stores the API's faithful value; only display resolves.
- **Two-column clipping** ([guest-detail.page.html](src/app/pages/guest-detail/guest-detail.page.html) scan-sheet + address rows, [sabeeapp-design.scss](src/theme/sabeeapp-design.scss) `.detail-value`): a long unbreakable value (`KECSKEMET(MAGYARORSZAG)`) overflowed the `flex:1` column and pushed Date-of-birth off-screen. Added `min-width:0` to the flex columns + `overflow-wrap:anywhere` on `.detail-value` (benefits every two-column detail row app-wide).

**Boundary note:** field *extraction* is IDScanly-only (the mapper) — no Regula impact. The doc-type-label + clipping fixes are in **shared** result-sheet/read-view code, so they also improve the Regula sheet (additive lookup-map keys + CSS; no behaviour change). The **save** path (`scannedDataToGuestScannedData` + `fillGuestDataFromScannedData`) is Regula's `DocuscanService`, reused by both — which is why the field-name bug dropped the name on save too, not just in the sheet.

**Verification:** `npm run build` clean (only the known warnings). Field names verified against the captured live payload; transform is pure renames + a pure age helper. Real camera + Edge Function round-trip only runs on device → **re-test on build 80** (confirm the sheet shows Name, Mother's name, friendly "ID Card", numeric Age, and no column clipping; Save → reopen → persisted). **Still unverified pre-device:** the address-card (`is_identity_document:false`) live field names, and whether the API's `documentType` string is accepted by `POST /guest`.

### 2026-07-04 — IDScanly: second scan backend, selected per-property via Supabase

> Branch `add-idscanly`. **Shipped build: iOS 78→79 (TestFlight).** Two commits: `ef60605` (pure file-move of Regula into `src/app/regula/`) + `ff33cd8` (the IDScanly module) + the cold-start fix below.

Adds **IDScanly** — a browser-based (OpenCV/`getUserMedia`) document scanner + Supabase Edge Function OCR — as a **second scan backend alongside Regula**. Which scanner is active is decided **per property** by the Supabase `property_settings` table (project `qiwhynwwgicpyeszecuj`, SabeeApp GO): `scan_vendor = 'regula'` → existing native Regula flow; `'idscanly'` → new flow; **no row / null → scanning disabled entirely** (the "Scan Document" FAB action is hidden). Unlike Regula, IDScanly runs in `ionic serve` (desktop browser + webcam), so the whole flow is testable without a device.

- **⚠️ Supabase via raw `fetch()` only — no `@supabase/supabase-js`.** Hard user constraint. `@supabase/supabase-js` is deliberately NOT in `package.json`; every Supabase call (config read + Edge Function) uses raw `fetch()` against `${environment.supabaseUrl}` with the anon key. **Do not add the Supabase client library.**
- **Regula isolated first** (`ef60605`, zero logic change): `services/document-reader.service.ts`, `services/docuscan.service.ts`, `services/docuscan.ts`, `pages/id-scan/` moved under `src/app/regula/`; imports updated. Both scanners now live in sibling folders (`src/app/regula/`, `src/app/idscanly/`) so either can be removed cleanly.
- **[PropertyConfigService](src/app/services/property-config.service.ts)** (new) — raw `fetch()` GET `property_settings?property_id=eq.<id>&select=scan_vendor,scan_doc_types`. Exposes `scanVendor = signal<'regula'|'idscanly'|null>` and `scanDocTypes = signal<string[]>`; maps DB enum (`id_card`/`passport`/`driving_license`/`address_card`) → IDScanly ids (`id-card`/`passport`/`driving-licence`/`address-card`). Any error/no-row ⇒ null/empty (scan disabled).
- **Config lifecycle wired into [AuthService](src/app/services/auth.ts)** (mirrors the Session-17 `clearSessionData` chokepoint): `propertyConfig.load()` on `selectProperty()` (post-login select + Home switcher) **and** on `loadStoredAuth()` (the cold-start fix — see below); `propertyConfig.clear()` in `clearSessionData()` (logout + property switch).
- **New module `src/app/idscanly/`** — copied from `app/docs/migration-src/` with only import-path + design changes: `capture-tuning.ts`, `models/`, `utils/`, `services/opencv-loader.service.ts` + `document-detection.service.ts` (OpenCV via `assets/opencv/opencv.js` ~8.6 MB + `jscanify` npm), `services/capture-session.service.ts` (in-memory singleton: document type, captures, **nav context**, **pending `scanResult`** consumed by guest-detail), `services/idrecognition.service.ts` (**rewritten** to raw `fetch()` POST `${supabaseUrl}/functions/v1/idrecognition`, `Authorization: Bearer <anon>` — the function has `verify_jwt: true`, satisfied by the anon JWT), and new **`services/idscanly-docuscan.service.ts`** mapping `IdRecognitionResponse → ScanResultInterface` (**same type Regula emits**, so the existing guest-detail result sheet renders both with no template change). Minimal `types/jscanify.d.ts` (package ships no types; `constructor()` + `getCornerPoints(contour, img?)` — signatures match actual usage, reads `window.cv`).
- **Two new pages, redesigned to the SabeeApp Go system** (Tabler `ti ti-*` icon classes → inline SVG; hardcoded `#378add`/`#5dcaa5`/`#f2c14e` → `var(--primary)`/`var(--success)`/`var(--warn)`; camera surround stays dark `#1c1c1a`): **[scan](src/app/idscanly/pages/scan/scan.page.ts)** (`IdscanScanPage`, `/idscanly/scan`) — live camera + jscanify contour detection, auto/manual capture, per-side ID card front/back, nag dialog; redirects to `/home` if no document type set. **[review](src/app/idscanly/pages/review/review.page.ts)** (`IdscanReviewPage`, `/idscanly/review`) — `.sub-header` + `.card` per-capture quality verdict + sticky `.btn` submit; on submit calls the Edge Function, maps → `ScanResultInterface`, stores in `session.scanResult`, and navigates back to `/guest/:code/:guestId` (`replaceUrl`).
- **[guest-detail](src/app/pages/guest-detail/guest-detail.page.ts) changes** (result sheet + `processScanResult('save'|'edit')` **unchanged**): `ionViewWillEnter` consumes `captureSession.scanResult()` into a new `_idscanlyResult` signal and opens the shared sheet in `'result'` mode; `scanResult` computed prefers `_idscanlyResult`; new `docTypeSheetOpen` sheet lists `availableDocTypes` (DOCUMENT_TYPES filtered by `scanDocTypes`); the "Scan Document" action is gated by `@if (propertyConfig.scanVendor())` and `openScanDocument()` routes to Regula's `goScan()` or IDScanly's `startIdscanly(type)` by vendor.
- **Cold-start gap fixed** ([auth.ts](src/app/services/auth.ts) `loadStoredAuth`): restoring a stored property did `_selectedProperty.set()` but never called `selectProperty()`, so `propertyConfig.load()` didn't fire on app relaunch — scan would silently disappear until a manual property switch. Added `propertyConfig.load(property.property_id)` right after the restore. `selectProperty()` (both switch surfaces) already covered.
- **Also:** CAMERA permission + `camera` feature (`required=false`) in [AndroidManifest.xml](android/app/src/main/AndroidManifest.xml); `angular.json` `anyComponentStyle` budgets raised 2/4 kB → 4/8 kB for the inherently-large `scan.page.scss` (6.19 kB).

**Field-map caveat (needs live validation):** `IdscanlyDocuscanService`'s `summary.fields` → guest mapping is best-effort (the IDScanly response field names aren't documented). Validate against a real Edge Function response and adjust the map. `doc_reader_scanned_document_id` is set to the marker `'idscanly'`; `is_identity_document = documentType.id !== 'address-card'`.

**Verification:** `npm run build` clean (only the pre-existing `global.scss` Sass deprecation + the two expected IDScanly warnings — SCSS budget note + `jscanify` CommonJS bailout). Supabase confirmed via MCP: `idrecognition` Edge Function ACTIVE (v9); test row inserted (`property_id='6250'`, `scan_vendor='idscanly'`, all four doc types). **Not yet device-verified:** on-device `getUserMedia` gesture context, a real OCR round-trip, and the field-map accuracy.

### 2026-06-10 — Translations: authenticated re-fetch + pre-auth `login` bundle

> No build/version bump, no TestFlight upload (local verification only). Branch `fix-UI-translations`.

Fixes why switching language only ever affected the login screen. The `/languages` endpoint **auth-gates** its payload: unauthenticated it returns **only the `login` namespace**; with a valid `Token` it returns the full 15-namespace set (PROD keys already match `translations.en.json` — the TEST API's old `btnLogin`/`lblEmail` scheme is not what PROD serves). But `LanguageService.init()` runs via `provideAppInitializer` **before** `loadStoredAuth()`, so the app's only fetch was always unauthenticated → it never loaded the authenticated set, even with a stored session.

- **Part 2 (core) — re-fetch once a token exists** ([services/auth.ts](src/app/services/auth.ts)): new private `AuthService.refreshTranslations()` calls the existing `LanguageService.fetchLanguages()` (fire-and-forget) at the two points a token becomes available — `verifyMfa()` (fresh login) and `loadStoredAuth()` (cold-start restore). The interceptor auto-attaches `Token`/`Property-Id`. **DI-cycle note:** this is driven from `AuthService`, NOT an `effect()` inside `LanguageService`. Making `LanguageService` inject `AuthService` closes the cycle `LanguageService → AuthService → ReservationService (for clearSessionData) → LanguageService`, which compiles but throws at bootstrap (blank screen). `AuthService → LanguageService` is a clean sink (no back-edge). **Never make `LanguageService` depend on `AuthService`.**
- **Part 1 — `login` is the "pre-auth bundle"**: only the Login + MFA screens are truly pre-token (token is set in `verifyMfa`, so property-select onward is authenticated). Since `login` is the one namespace returned unauthenticated, every key those two screens use now lives there. **Moved** (exclusively pre-token): `mfa.title/subtitle/invalidCode` → `login.mfaTitle/mfaSubtitle/mfaInvalidCode` (the `mfa` namespace is deleted), `common.tryAgain` → `login.tryAgain`, `errors.loginIncorrect` → `login.errIncorrect`. **Copied** (kept in `errors` for future post-token use): `errors.noInternet`/`errors.generic` → `login.errNoInternet`/`login.errGeneric`. Applied in lockstep to [translations.ts](src/app/services/translations.ts) (with a pre-auth-bundle comment block above the `login` namespace) + [translations.en.json](src/app/services/translations.en.json) (kept byte-for-byte in sync), and the `| tr` keys in [mfa.page.html](src/app/pages/mfa/mfa.page.html) + [login.page.html](src/app/pages/login/login.page.html). Key count 173 → 175.
- **Login error-type fix** ([login.page.ts](src/app/pages/login/login.page.ts)): `extractMessage()` now picks by failure type instead of always falling back to "incorrect credentials" — `HttpErrorResponse status 0` (no response: network/CORS/DNS/TLS) → `login.errNoInternet`; credential rejection (API 200 `{success:false}` thrown w/ `apiErrors`, or HTTP 401) → `login.errIncorrect`; anything else (e.g. 5xx) → `login.errGeneric`. Stops a "no internet" failure from falsely reading as "wrong password".
- **Backend follow-ups (not app code):** (1) PROD `login` English **values are scrambled** — misaligned ~1 row (`emailLabel`="Login", `passwordLabel`="Email", `signInBtn`="Password", `appName`="Username") and `welcomeTitle` returns Hungarian under `Lang: en`; needs a content fix. (2) Add the 7 new `login.*` keys to the server's unauthenticated `login` group (hand off the updated `translations.en.json`). (3) Confirm the authenticated `/languages` returns the full set with just `Token` (no `Property-Id`) — the post-`verifyMfa` re-fetch fires before a property is picked; if `Property-Id` is required, move that re-fetch to after `selectProperty()`.
- **Verification:** `npx ng build` clean; no stale refs to moved keys; `.ts`/`.json` key sets identical (175=175). **Not yet device/serve-verified:** open Network on `ionic serve` to confirm a second `/languages` fires after login + on cold start, and that a non-EN switch translates post-login screens (needs the API serving a non-EN map).

### 2026-06-09 — i18n wired into the UI (last-mile of the translation system)

> No build/version bump, no TestFlight upload (local verification only). The translation **infrastructure** (`LanguageService`, the `tr` pipe, the bundled English fallback + `translations.en.json` key file) had shipped back in the 2026-05-18 session but was **never consumed** — 0 of 15 templates used the pipe, so switching language in Settings changed nothing. This session does the wiring.

- **`LanguageService.t(key, params?)` added** ([services/language.service.ts](src/app/services/language.service.ts)) — instant lookup for TS code (alerts, error signals, computed sheet titles) where the template pipe isn't usable. Resolution order: active merged map → bundled `TRANSLATIONS` (ultimate EN floor) → raw key, with `{{param}}` substitution. **`TranslatePipe` now delegates to it** ([pipes/translate.pipe.ts](src/app/pipes/translate.pipe.ts)) so there's one implementation; pipe stays `pure: false` so text re-renders on language change.
- **All user-facing templates wired** to `{{ 'ns.key' | tr }}` (attributes via `[placeholder]`/`[attr.aria-label]="'…' | tr"`), each component adding `TranslatePipe` to its standalone `imports`: login, mfa, property-select, home, search, settings, reservation-detail, guest-detail, guest-edit, id-scan, feedback-sheet, update-required, lock-overlay.
- **Parameterised + dynamic cases:** home day tabs use `('home.' + t.toLowerCase()) | tr`; the section heading / empty state use params (`home.arrivalsHeading` = `"{{day}}'s Arrivals"`, `home.noArrivalsFor`) fed a translated `dayLabel()` computed.
- **TS-side strings** routed through `lang.t(...)`: property-select load alert, reservation-detail / guest-detail / guest-edit error+empty states, login `extractMessage` fallback, guest-detail scan sheet titles/messages, the id-scan init alert, and `ReservationService`'s list error/`networkError` (service injects `LanguageService` — no DI cycle).
- **Key set grew 117 → 173** across both [translations.ts](src/app/services/translations.ts) and [translations.en.json](src/app/services/translations.en.json) (kept byte-for-byte in sync per the file header). New: `common.submit/done/filterPlaceholder`, `reservationDetail.roomType/direct/cityTaxLiable/booker`, `guestDetail` address + scan-state labels, `idScan.scanAgain`, and new `feedback`/`updateRequired`/`lock` namespaces + assorted `errors.*`. **`translations.en.json` is the translator deliverable** — hand it off; translated output is served via the `languages` endpoint and merged over EN (incomplete translations fall back to English per-key automatically).
- **Out of scope (left hardcoded by intent):** the `TEST`/`TEST MODE` dev-mode indicators (login/home) and the throwaway mock Briefing screen.
- **Verification:** `npx ng build` clean (zero errors/warnings); a coverage script confirmed all 132 referenced keys resolve and the `.ts`/`.json` key sets are identical (173 = 173). **Not yet done:** on-device/serve check of a live non-EN language switch + incomplete-translation fallback (needs the API to serve a non-EN map).

### 2026-05-13 — (unreleased)

- **Settings profile section:** top of Settings page now shows name + email fetched from `GET /users/me` (centered, name 22px/800, email 14px/600 below). Requires `Property-Id` header — endpoint returns 403 without it.
- **`auth.fetchUser()` lifecycle:** `loadStoredAuth()` reordered to restore selected property *before* calling `fetchUser()`, so the header is available on cold start. `verifyMfa()` no longer calls `fetchUser()` (no property yet). `selectProperty()` calls `fetchUser()` when name is missing (covers first login and property switch). Response is an array — parsed as `res.data?.[0]`.
- **`npm run sync:ios` + `scripts/patch-package-swift.js`:** `cap sync ios` regenerates `Package.swift` and drops `DocumentReaderPlugin` every time. `scripts/patch-package-swift.js` re-inserts both entries (dependency + product) immediately after sync. Always use `npm run sync:ios` instead of bare `cap sync ios`.
- **Inline CSS refactoring:** extracted repeated patterns into utility classes in `sabeeapp-design.scss`: `.page` (background), `.page-loading` (spinner container), `.empty` (48px error state), `.empty-state` (32px hint state), `.detail-label`, `.detail-value`, `.fact-value`. Applied across all templates — `guest-detail`, `id-scan`, `reservation-detail`, `guest-edit`, `home`, `search`, `property-select`.

### 2026-05-13 — Build 18

- **Pull-to-refresh simplified:** removed custom PTR machinery (ptrState, pullProgress, pageTranslateY, ptr-chip SVG, onPull handler). Now uses stock `ion-refresher` + `ion-refresher-content` with no overrides. Fixes: had to pull too far (page translateY was fighting the gesture), pull animation sometimes missing (async getProgress() race), spinner sometimes missing (500ms reset timer could fire before refreshing state was set).
- Uploaded build 18 to TestFlight.

### 2026-05-11 — Build 17

- **Pull-to-refresh indicator position fix:** moved `ptr-chip` div outside `<ion-content>` — `position: fixed` inside ion-content's shadow DOM slots anchors relative to the content area (safe-area + pull offset), not the viewport, placing the indicator ~160pt down instead of ~45pt. Moving it outside makes it truly viewport-fixed.

### 2026-05-11 — Build 16

- **Pull-to-refresh fixes:** fixed broken spinner animation by replacing CSS `transform-box`/`transform-origin` with SVG `animateTransform` (explicit rotation centre `(16,28)`); reduced max content translation from 100px → 80px; resized SVG from 32×56 to 32×44 with ring moved to cy=28; reduced dot travel from 38 → 22 SVG units; added pale outlined target dot at ring centre as pull indicator.
- Uploaded build 16 to TestFlight.

### 2026-05-09 — Build 15

- **Booker name sync:** `ReservationService.updateGuest()` now patches the `_reservations` signal after save, matching `booker.booker_id === guest.guest_id`. Home screen reservation list reflects name edits without a full refresh.
- **Reservation detail stale data:** added `ionViewWillEnter()` hook to `ReservationDetailPage` — re-fetches guests and syncs booker name on every back-navigation from guest edit.
- **Options-backed dropdowns:** `OptionsService` extended with `documentTypes` and `genders` signals fetched from `GET /options`. `GuestEditPage` document type and gender selects now use these signals instead of hardcoded values.
- Uploaded build 15 to TestFlight.

### 2026-05-08 — Build 13 / 14

- Added `NSCameraUsageDescription` to `Info.plist` (build 13 was rejected by App Store Connect — error 90683).
- Established pattern: `DocumentReaderPlugin` must be manually re-added to `CapApp-SPM/Package.swift` after every `cap sync ios`.
- Build 14 uploaded and accepted.

### 2026-05-07 — Build 11 (initial TestFlight)

- First TestFlight upload. Core flows working: login → MFA → property select → home → reservation detail → guest detail → guest edit → ID scan.
- `OTHER_LDFLAGS = "$(inherited) -ObjC"` required for Regula DocumentReader SDK linkage.

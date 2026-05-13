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
  <div class="page" style="background: var(--bg)">

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
  <div class="page" style="background: var(--bg)">

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
auth.roles()                  // string[]
auth.selectedProperty()       // PropertyInterface | null
auth.properties()             // PropertyInterface[] — populated by loadProperties(), persisted
auth.deviceId()               // string

// Async methods
await auth.login(email, password)          // → { mfaToken: string }
await auth.verifyMfa(mfaToken, code)       // sets auth state
await auth.loadProperties()               // → PropertyInterface[]
await auth.selectProperty(property)       // persists selection
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

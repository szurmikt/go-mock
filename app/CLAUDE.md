# SabeeApp Go — Ionic App · Developer Context

> Read this at the start of every session. It is the single source of truth for architecture, conventions, and build patterns for this app.
>
> **Scope:** this file documents the real shipping app (`app/`, Ionic + Angular). Its changelog (§19) is the single continuous history of this app, including Sessions 4-23 (2026-05-18 through 2026-06-06) that were originally logged in the root `SabeeAppGO/CLAUDE.md` before that file's scope was narrowed to the `Design/` prototype only. For that prototype, see the root `CLAUDE.md`.

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
| 2 | Biometric inactivity timer: `diffLimit = 60 * 0.5` = 30 seconds | Lock threshold is **10 minutes** (`LOCK_AFTER_MS = 10 * 60 * 1000` in `AppComponent` and `BiometricService`) |
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
2. If authenticated → `await biometric.checkAndLock()` — lock if backgrounded for ≥ 10 min before cold start
3. If authenticated + property selected → `/home`
4. If authenticated + no property → `/property-select`
5. Else → `/login`

---

## 14. Biometric Session Lock

`BiometricService` (`src/app/services/biometric.ts`) owns the session-lock state. It is a **session lock** (not a login replacement) — tokens remain valid, no server round-trip on unlock.

### Lock triggers

| Trigger | Mechanism |
|---|---|
| Inactivity ≥ 10 min | `setTimeout` in `AppComponent`, reset by `@HostListener('touchstart'/'click')` |
| Background ≥ 10 min | `App.addListener('appStateChange')` in `AppComponent`; timestamp persisted to `Config.STORAGE_BACKGROUND_AT_KEY` |
| Cold start after long background | `biometric.checkAndLock()` called in boot sequence after `loadStoredAuth()` |

### BiometricService API

```typescript
biometric.sessionLocked()          // signal<boolean> — read in templates
biometric.lockSession()            // set locked = true
biometric.unlockSession()          // set locked = false
await biometric.recordBackground() // persist Date.now() to storage (called on appStateChange pause)
await biometric.checkAndLock()     // read stored timestamp; lock if elapsed ≥ 10 min; clear timestamp
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

xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
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

### Build number

`CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` — increment before each TestFlight upload. Current: **100**. `MARKETING_VERSION` (both Debug and Release configs) is NOT auto-bumped by `scripts/publish-ios.sh` — bump by hand when Apple closes the current version train (see 2026-08-12 and 2026-08-18 changelog entries). Current: **1.0.4**.

### App Store requirements

- `NSCameraUsageDescription` must be in `Info.plist` — IDScanly's document-scan flow uses the camera.
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

### 2026-08-28 — Regula removed entirely — IDScanly is now the sole scan backend

> Branch `regula-remove-and-cleanup`. Two commits: source-level removal + native-project cleanup (with an unrelated CocoaPods fix folded into the second). No build/version bump, no TestFlight upload.

Regula (native SDK, optical + RFID/NFC chip reading) is dropped for good. IDScanly (browser-based OpenCV + Supabase Edge Function OCR, live since 2026-07-04) is now the only scan backend — it already independently covers all four document types, including Hungarian address cards (`mapAddressCard()`, 2026-08-18 entry above), so there is no functional gap. **RFID/NFC chip reading has no IDScanly equivalent and is a deliberate, accepted loss** — decided with the user up front.

**Source removal:**
- Deleted `src/app/regula/` in full (`document-reader.service.ts`, the dead legacy `docuscan.service.ts` duplicate, `pages/id-scan/`) and `utils/hungarian-address.ts`+spec (Regula-only; IDScanly's `mapAddressCard()` is fully independent code, never called it).
- **Moved** `regula/services/docuscan.ts` (`DocuscanService` — the guest save/merge logic both vendors' scan results flow through) to `services/docuscan.ts`, since it was never Regula-exclusive despite its old location. Trimmed its long-dead `fieldsToScan`/`sendStatistics` API surface (zero callers anywhere) while there.
- Surgically stripped the Regula-only slice out of `guest-detail.page.ts`/`.html` — `DocumentReaderService`/`ReaderStatus` injection, the reader-status `effect()`, `goScan()`/`scanAgain()`, the `'failed'` sheet mode, the Regula-only `?previewScanSheet=` deep links (`starting`/`loading`/`timeout`/`cancelled`/`interrupted`) — while leaving the shared FAB, doc-type picker, result sheet, and `processScanResult()` save/edit flow completely untouched. The "Scan Document" action is now unconditional (previously gated on `propertyConfig.scanVendor()`).
- **`PropertyConfigService.scanVendor` removed entirely** (not just narrowed) — queried the live `property_config` table first: all 531 rows (530 live + 1 test) already read `scan_vendor = 'idscanly'`, zero exceptions, perfectly correlated with `go_enabled`. The vendor field had nothing left to select between. `scanDocTypes`/`DOC_TYPE_MAP` were deliberately left untouched — the user wants the per-property document-type-restriction mechanism to stay available even though every row currently allows all four types. The `scan_vendor` **column** itself was left in Supabase (unused, harmless) — no schema migration.
- Removed Regula-only `Config` constants (`SCAN_DEBUG_LOGGING`, `ADDRESS_CARDS`, `ID_CARDS`, `PASSPORTS`, `DRIVING_LICENCES`) and the dead `/guest/:code/:guestId/scan` route.
- Narrowed Mixpanel's `vendor: 'regula' | 'idscanly'` unions to `'idscanly'` on all four scan events, and dropped the Regula-only optional fields (`scan_type`, `document_type_id`) — confirmed no IDScanly call site ever set them, so this is a type-only change.
- Pruned translation keys with zero remaining consumers after the above (`idScan.title`/`webNotAvailable`/`initializing`/`instruction`/`resultTitle`/`edit`/`save`/`scanAgain`/`resultSaved`, `guestDetail.idScan`/`scanTimedOut`/`scanCancelled`/`scanInterrupted`/`scanFailed`/`scanLoadingDb`) across `translations.ts`/`.en.json`/`.hu.json` — key-parity re-checked programmatically (231 = 231 = 231). The `idScan.fullName`/`docType`/`docNumber`/`age`/`gender`/`birthPlace`/`birthDate`/`citizenship`/`motherName` keys were **kept** — despite the namespace name, they're read by the shared, still-live result sheet, not a Regula-only page.

**Native project cleanup**, then a full resync + from-scratch rebuild verification:
- `package.json`: removed `@regulaforensics/document-reader` + `@regulaforensics/document-reader-core-fullrfid`; `sync:ios` reverted to plain `cap sync ios` (the `patch-package-swift.js` step, and the script itself, are gone — nothing left to re-patch into `Package.swift`).
- iOS: deleted `App.entitlements` (NFC-only content) + its two `CODE_SIGN_ENTITLEMENTS` wirings in `project.pbxproj`; dropped `NFCReaderUsageDescription` + the `iso7816.select-identifiers` array from `Info.plist`; dropped the Podfile's `pod 'CordovaPlugins'` line (confirmed via Capacitor's own CLI source that a fresh Podfile wouldn't include it once there are zero Cordova-bridged plugins — this project now has none).
- Android: dropped the NFC permission + `<uses-feature>` from `AndroidManifest.xml`.
- `pod install` explicitly confirmed the binaries are gone: `Removing CordovaPlugins / DocumentReader / DocumentReaderFullRFID / RegulaCommon`.

**Unrelated bug found and fixed along the way.** Verifying "does this still build" required a fully clean `Pods`/`Podfile.lock`/`DerivedData` wipe (the committed `Podfile.lock` hadn't changed since a very early commit, meaning local CocoaPods state had been incrementally patched, never rebuilt from scratch, for a long time) — that clean rebuild surfaced a real, pre-existing, **Regula-unrelated** bug: `scripts/patch-native-biometric.js` (runs on every `npm install`) writes a second `ios/Plugin/objc/Plugin.h` into `capacitor-native-biometric` purely to satisfy its SPM target's "no Swift+ObjC in one target" rule, but the plugin's CocoaPods podspec globs it too, producing two build steps that write the same output header (`error: Multiple commands produce ... Plugin.h`). A warm/incremental Pods state silently tolerated this (likely last-writer-wins); a from-scratch install does not. Fixed by extending the same patch script to also add `exclude_files = 'ios/Plugin/objc/**/*'` to the podspec (CocoaPods doesn't need the SPM-only ObjC shim — the top-level `ios/Plugin/Plugin.m` already provides `CAP_PLUGIN` registration for the Pods build). Confirmed same version (`4.2.2`/`0.0.1`) before and after, so this wasn't a dependency bump either — purely a latent conflict this session's clean-build verification happened to expose.

**§16 doc fixes (unrelated, found while touching this section):** the documented archive scheme name `-scheme SabeeAppGo` doesn't exist — `xcodebuild -workspace App.xcworkspace -list` shows the real scheme is `App`; corrected. Removed the now-obsolete "DocumentReaderPlugin — patched automatically" subsection and its "Regula SDK references camera APIs" App Store note (camera permission is IDScanly's now).

**Verification:** `npx ng build` clean throughout (only the three pre-existing known warnings). Grep-audited `app/src`, `ios/`, `android/`, `package.json`, `scripts/` for `regula`/`Regula`/`DocumentReader`/`RFID` — zero real hits (the only matches were false positives: `RegularExpression`/`regexp` in a minified bundle, and unrelated hits inside the vendored `opencv.js`). **From a fully clean `Pods`/`Podfile.lock`/`DerivedData`/`node_modules` state:** `xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -destination "generic/platform=iOS Simulator" build` → **BUILD SUCCEEDED**; `./gradlew assembleDebug` → **BUILD SUCCESSFUL**. **Device-verified by the user** via `ionic serve --ssl --external` (LAN HTTPS) on a real iPhone in Safari — confirmed the IDScanly scan flow works end-to-end on this branch.

### 2026-08-25 — Sentry logs/errors now tagged with `platform` (iOS/Android/web)

> Branch `fixing-platform-in-sentry-logging`, merged into `main`. No dedicated build.

Follow-up to the 2026-08-24 IDScanly Sentry-logging entry, which flagged that `platform` had no Sentry counterpart to Mixpanel's existing `platform` super property. Resolved the open "global tag vs. per-log attribute" question in favor of a **global tag set once at boot**, not a per-log attribute — every future Sentry event and log automatically carries it with no per-call-site changes needed.

- **[app.component.ts](app/src/app/app.component.ts)** `ngOnInit()`: `Sentry.setTag('platform', Capacitor.getPlatform())` as the very first line, before any other boot logic, so it's present even on an error during boot. Same `Capacitor.getPlatform()` source Mixpanel already uses ([mixpanel.ts](app/src/app/services/mixpanel.ts)).

**Verification:** `npx ng build` clean. **Not yet device-verified** — next real-device session should confirm the `platform` tag actually appears on a Sentry event/log.

### 2026-08-24 — Shipment: iOS build 100 (v1.0.4) / Android versionCode 29 (v1.0.4) — submitted to both stores

> Branch `improving-sentry-scan-logging-visibility`. Ships the two entries logged directly below this one. **Submitted to the App Store and Play Store this session.**

**iOS crossed into a new marketing version for the first time this session.** `MARKETING_VERSION` bumped `1.0.3` → `1.0.4` in both Debug and Release configs of [project.pbxproj](ios/App/App.xcodeproj/project.pbxproj) — Android had already been on `1.0.4` since the previous shipment (see the 2026-08-24 "iOS build 98" entry below), this is iOS catching up to match. Two `scripts/publish-ios.sh` runs this session: build 99 (first upload at the new `1.0.4`, carrying the Lock Now button + the `pid`/`code`/`property_id`/`reservation_code`/`guest_id` log additions below) and build 100 (same `1.0.4`, adding the `app_version` log attribute after it was flagged as missing) — **100 is the build that was actually submitted for review**, 99 shipped to TestFlight but was superseded before submission.

**Android**: `scripts/publish-android.sh` run twice this session (`versionCode` 27→28→29, `versionName` unchanged at `1.0.4`) for the same reason as iOS above — 28 was an interim AAB/APK pair built to hand-test the Lock Now button on a real device before the final `app_version` addition, 29 is the one submitted to Play Console.

**Verification:** `npx ng build` clean throughout (only the three pre-existing known warnings). iOS 100 exported and uploaded successfully (`EXPORT SUCCEEDED` / `Upload succeeded`) and has since been submitted for App Store review. Android AAB `sabeeapp-go-v29.aab` built successfully and uploaded to Play Console. **Not yet independently device-verified this session** — the Lock Now button was hand-verified via the interim `sabeeapp-go-v28.apk` (see its own entry below); the Sentry log attribute additions have not yet been confirmed against a real IDScanly scan on a device.

### 2026-08-24 — Settings: "Lock Now" debug button (property 6250 only) — instant biometric-lock trigger for device testing

> Branch `improving-sentry-scan-logging-visibility`. No dedicated build (ships as part of the 1.0.4 shipment above).

The Settings screen's Session-4-era "Lock screen button" had been removed at some point and was never reintroduced, leaving no way to exercise `BiometricService`'s session-lock flow (§14) on a real device without actually waiting out the real 10-minute inactivity/background threshold — a real blocker for verifying the 2026-08-24 biometric-passcode-fallback fix (see below) hands-on.

- **New [lock-debug.const.ts](src/app/pages/settings/lock-debug.const.ts)** — `LOCK_DEBUG_PROPERTY_ID = '6250'`, mirroring the existing `IDSCANLY_DEBUG_PROPERTY_ID`/`BRIEFING_PROPERTY_ID` gate-by-test-property convention (same `String(property_id)` comparison).
- **[settings.page.ts](src/app/pages/settings/settings.page.ts)**: new `lockButtonEnabled` computed (`auth.selectedProperty()?.property_id` against the const) and `lockNow()`, which just calls the already-existing `biometric.lockSession()` — no new locking mechanism, this only exposes the existing one on demand.
- **[settings.page.html](src/app/pages/settings/settings.page.html)**: new button rendered above Logout, gated behind `@if (lockButtonEnabled())`, plain English label ("Lock Now") — deliberately left untranslated, matching the precedent set by IDScanly's own untranslated "Show debug" dev/QA toggles (calibration tooling, not staff-facing product copy).

**Device-verified this session** via the interim `sabeeapp-go-v28.apk` — confirmed the button appears on property 6250's Settings screen and immediately shows the lock/biometric overlay on tap, without waiting for the real timeout.

### 2026-08-24 — IDScanly Sentry logs: property_id + reservation_code searchable in the message, guest_id + app_version visible as attributes

> Branch `improving-sentry-scan-logging-visibility`. No dedicated build (ships as part of the 1.0.4 shipment above).

Prompted by a real support investigation (reservation `6P4TGNC`, property `8926` — a report that IDScanly hadn't extracted mother's name/birth place) that hit a dead end: the two IDScanly diagnostic logs (`idscanly response` in `review.page.ts`, `idscanly external-result` in `external-result.service.ts`, both gated on `propertyConfig.extendedLogging()`) already carried a `pid` field, but buried inside a large `response_json`/`sent_json` blob attribute — invisible to Sentry's Logs product, which **only full-text-searches the `message` field**, not structured attributes. There was no way to jump directly to the log for a specific property or reservation, only to page through everything chronologically.

- **[review.page.ts](src/app/idscanly/pages/review/review.page.ts) `logIdscanlyResponse()`**: now takes the already-in-scope `ctx: { reservationCode, guestId }` (read from `CaptureSessionService.context()` in `submit()`, previously read but never passed in) plus `AuthService.selectedProperty()?.property_id` (already injected). Message changed from `'idscanly response'` to `` `idscanly response pid=${propertyId} code=${reservationCode}` `` — plain space-separated tokens **appended** to the existing message text, so any saved search on the original substring still matches. `property_id`, `reservation_code`, `guest_id`, and (added in a same-day follow-up, after being flagged as missing) `app_version` (from the already-existing `AppVersionService`) added as structured attributes alongside the existing ones.
- **[external-result.service.ts](src/app/idscanly/services/external-result.service.ts)**: `submitInBackground()` widened to take a new `reservationCode: string` param, threaded from both call sites — [guest-detail.page.ts](src/app/pages/guest-detail/guest-detail.page.ts) and [guest-edit.page.ts](src/app/pages/guest-edit/guest-edit.page.ts), both of which already had `this.reservationCode` in scope one line above the existing call. `logOutcome()`'s message changed the same way: `` `idscanly external-result pid=${propertyId} code=${reservationCode}` ``, same four attributes added (`guest_id` sourced from the already-passed `guest.guest_id`). The catch-path `Sentry.captureException` also gained `property_id`/`reservation_code`/`guest_id`/`app_version` **tags** (Sentry's Issues search supports tag filtering, unlike Logs' message-only search) — consistent coverage across both the log and the error-capture path.
- **Deliberately scoped to IDScanly only** — Regula's parallel diagnostics (`document-reader.service.ts` `logScanOutcome`/`buildScanDiagnostics`/etc.) were explicitly excluded per the user's direction; that service has no reservation/guest context mechanism at all today and would need its own design pass.
- **Message format convention**: `<original message> pid=<propertyId> code=<reservationCode>` — chosen specifically so a future lookup is a plain-text search for the bare reservation code or `pid=<id>`, no query syntax needed.
- **Known follow-up, deliberately not done this session**: `platform` (iOS/Android/web) is not logged to Sentry at all today — only `environment` (production/development) is set in `Sentry.init()` ([main.ts](src/main.ts)); Mixpanel already has an equivalent `platform` super property via `Capacitor.getPlatform()` ([mixpanel.ts](src/app/services/mixpanel.ts)) that Sentry has no counterpart to. Flagged by the user immediately after this entry shipped; picked up on its own branch (`fixing-platform-in-sentry-logging`) rather than folded in here, since global-tag-at-boot vs. per-log-attribute is an open scope question.

**Verification:** `npx ng build` clean at every step (only the three pre-existing known warnings). Both logging call sites are gated behind `propertyConfig.extendedLogging()` and only fire on a real IDScanly scan submit/save — **not yet confirmed against a real device scan** that the new message format and attributes actually show up correctly in Sentry Logs.

### 2026-08-24 — Shipment: iOS build 98 / Android versionCode 27, versionName 1.0.4 (+ signed APK) — biometric passcode fallback + IDScanly network retry

> Ships the two fix entries logged directly below this one. **Shipped: iOS 98 (TestFlight, uploaded successfully — processing), Android versionCode 27 / versionName 1.0.4 (signed AAB `sabeeapp-go-v27.aab` + signed APK `sabeeapp-go-v27.apk`, both built — manual Play Console drag-drop for the AAB, not auto-uploaded).**

**iOS needed no version bump.** `MARKETING_VERSION` stayed at `1.0.3` (unchanged since build 97) — that train was still open, so `scripts/publish-ios.sh` bumped only `CURRENT_PROJECT_VERSION` (97→98) and the archive/export/upload succeeded on the first attempt.

**Android's `1.0.3` had already been approved and published on the Play Store**, so a same-version AAB would have been rejected. Per the established pattern (see the 2026-08-23/2026-08-18/2026-08-12 entries below), bumped Android's `versionName` in [build.gradle](android/app/build.gradle) `1.0.3` → `1.0.4` by hand (`scripts/publish-android.sh` only auto-bumps `versionCode`, never `versionName`) — **this time iOS did not need the matching bump**, since its own train was still open; only Android's build.gradle changed, `project.pbxproj`'s `MARKETING_VERSION` was left at `1.0.3`. First Android build (`versionCode` 26, still `versionName 1.0.3`) was built then discarded once the mismatch was caught, before any upload — no wasted Play Console submission. Rebuilt at `versionCode` 27 / `versionName 1.0.4`.

**Signed APK built alongside the AAB, on request** — `gradlew -p android assembleRelease` (same pattern as the 2026-06-01 Session 16 entry below), output copied to `sabeeapp-go-v27.apk` for direct install/sideload use cases the Play-Console-only AAB doesn't cover.

**Verification:** `npx ng build` clean throughout (only the three pre-existing known warnings). iOS 98 exported and uploaded successfully (`EXPORT SUCCEEDED` / `Upload succeeded`), now processing in TestFlight. Android AAB (v27) and APK (v27) both built successfully (`BUILD SUCCESSFUL`), neither uploaded anywhere yet (AAB → Play Console is a manual step; APK has no equivalent auto-upload). **Not yet device-verified** — see each fix's own entry below for what specifically needs checking on a real device.

### 2026-08-24 — Fix: IDScanly submit retries a dropped connection before failing

> Branch: none (uncommitted local change, folded into this session's shipment above). No dedicated build — ships as part of the iOS 98 / Android 1.0.4 shipment above.

`IdRecognitionService.submit()`'s single `fetch()` POST to the `idrecognition` Edge Function had no retry — a connection dropped before any response reached JS (WKWebView's "Load failed", a DNS blip, a cellular handoff mid-scan-submission) surfaced immediately as a hard submit failure, even though the same request often succeeds a second later with no user action needed.

- **[idrecognition.service.ts](src/app/idscanly/services/idrecognition.service.ts)**: new private `fetchWithRetry()` wraps the POST in a retry loop over `NETWORK_RETRY_DELAYS_MS = [500, 1500]` (2 retries, short backoff) — retries **only** a fetch-level `throw` (no response reached JS at all). An HTTP error response (4xx/5xx) is a real answer from the server and is returned as-is on the first attempt, never retried — `submit()`'s existing non-OK-response handling (→ `http_error` tagged error) is unchanged.
- Scoped deliberately narrow: no retry on the empty-body case, no change to the `network_error`/`http_error`/`empty_response` error-kind contract Mixpanel's `scan_failed` reason already relies on (see the 2026-08-12 Mixpanel entry below) — a request that still fails after 2 retries throws the same `network_error`-tagged error as before, just ~2s later.

**Verification:** `npx ng build` clean. **Not yet device/browser-verified** — no way to simulate a genuine dropped-connection mid-`fetch()` in this environment; next real-device IDScanly submit under flaky network (e.g. a cellular handoff) should confirm a transient drop no longer surfaces as a user-facing failure.

### 2026-08-24 — Fix: biometric lock had no passcode fallback (iOS + Android), read as "app doesn't ask for a biometric scan"

> Reported by a user: the app doesn't ask for a biometric scan for all users, and when no biometric (Touch/Face ID, or Android biometric) is enrolled there's no fallback to the device passcode — on both platforms. Ships as part of the iOS 98 / Android 1.0.4 shipment above.

**Root cause, one bug explaining both symptoms.** [biometric.ts](src/app/services/biometric.ts) `authenticate()` called `NativeBiometric.verifyIdentity()` with no `useFallback` option. Per the plugin's own types/README (`capacitor-native-biometric@4.2.2`), `useFallback` defaults to `false` — so on a device with no enrolled biometrics (or a failed biometric read), `verifyIdentity()` throws **immediately, with no OS prompt shown at all**. From the user's side this looks exactly like "the app doesn't ask for a biometric scan" — there's no dialog, biometric or passcode. `LockOverlayComponent.tryUnlock()` ([lock-overlay.component.ts](src/app/components/lock-overlay/lock-overlay.component.ts)) catches this as a plain failed attempt; after 3 such failures the only escape is "Use password instead" → `forceLogout()`, i.e. a full logout instead of a passcode unlock.

- **[biometric.ts](src/app/services/biometric.ts) `authenticate()`**: added `useFallback: true` + `fallbackTitle: 'Use Passcode'` (iOS-only label) to the `verifyIdentity()` call. With this, a device with no enrolled biometry (or a failed biometric attempt) now falls back to the system passcode/PIN prompt instead of failing silently — the user is actually asked to authenticate, just not necessarily via biometrics. Cross-checked against the plugin's native source (`ios/Plugin/Plugin.swift`, `android/.../NativeBiometric.java`) — both branch on this exact flag: iOS chooses `LAPolicy.deviceOwnerAuthentication` (biometry-or-passcode) vs. biometrics-only, and Android only enables device-credential fallback when this is `true`.
- **Investigated and ruled out: Android manifest permission.** The plugin's README says `USE_BIOMETRIC` must be declared in the app's own `AndroidManifest.xml` — it wasn't there, so this looked like a second, Android-only cause. Checked the actual dependency chain instead of trusting the (older) README: the plugin depends on `androidx.biometric:biometric:1.0.1` ([build.gradle](android/app/src/main/AndroidManifest.xml) → `node_modules/capacitor-native-biometric/android/build.gradle)`), and that library's own AAR manifest (confirmed by unzipping the cached artifact in `~/.gradle`) already self-declares both `USE_BIOMETRIC` and `USE_FINGERPRINT` — Gradle's manifest merger pulls these into the final APK automatically regardless of the app manifest. Added the permission explicitly, then reverted it once this was confirmed — it would have been redundant, not a fix. **The single `useFallback` change above is the entire fix; nothing else needed changing for Android.**
- **`BiometricService.isAvailable()` is dead code** — confirmed via grep, it's defined but never called anywhere in the app (the lock overlay always attempts `authenticate()` directly, regardless of enrollment state). Left as-is; not part of this fix's scope since nothing reads its return value.
- **Timing confirmed correct, not a bug — user confirmed 10 minutes is the intended threshold.** The lock overlay only appears when `biometric.sessionLocked()` is true, which happens after ≥10 minutes backgrounded or ≥10 minutes inactive (`LOCK_AFTER_MS` in both [app.component.ts](src/app/app.component.ts) and [biometric.ts](src/app/services/biometric.ts)) — a **session lock**, not a mandatory gate on every app open, per §14's existing "not a login replacement" design. The "doesn't ask for a biometric scan for all users" report is fully explained by the `useFallback` bug above (no OS prompt of any kind on a device with no enrolled biometrics), not by this threshold.
- **Doc/code drift fixed:** §11 and §14 previously claimed the lock threshold was "60 seconds"/"≥ 1 min" — stale from an earlier iteration. Both `app.component.ts` and `biometric.ts` have always actually had `LOCK_AFTER_MS = 10 * 60 * 1000` (10 minutes), which is the confirmed-correct value. Updated §11's bug-fix table and §14's trigger table/API comments to read 10 minutes throughout.

**Verification:** `npx ng build` clean (only the three pre-existing known warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new). **Not yet device-verified** — no biometric-capable device/simulator session available in this environment. Next device pass (both iOS and Android) should confirm: on a device/simulator with no biometrics enrolled, locking the session now prompts for the device passcode/PIN (not an instant silent failure); on a device with biometrics enrolled, a failed biometric attempt also offers the passcode fallback.

### 2026-08-23 — Shipment: build 97 (iOS) — merges the Turkish ID fix, IDScanly skip/control-bar redesign, and the guest-card scan shortcut

> Merged `fix/turkish-id-identity-number` and `add-scan-shortcut-to-guest-card` into `main` (the latter carrying `idscan-UI-improvement-with-skip`, and the former carrying `adding-idscanly-feedback-loop`, transitively). **Shipped build: iOS 97 (TestFlight, uploaded successfully — processing).** None of the three merged changes had been device/browser-verified before this shipment — each still needs its own on-device pass (see their individual entries below for what to check).

Ships the three feature entries logged directly below this one, none of which had been released since build 95 (2026-08-18). The merge itself only needed one manual conflict resolution: `app/CLAUDE.md`'s changelog, where `fix/turkish-id-identity-number` and `add-scan-shortcut-to-guest-card` had each inserted their own entry at the same anchor point (immediately after the `## 19. Changelog` header) relative to a common ancestor — resolved by ordering all three same-day entries newest-first by commit time. `guest-detail.page.ts` (touched by both the Turkish-fix branch and the scan-shortcut branch) auto-merged cleanly with no conflict.

**Same App Store Connect blocker as 2026-08-12 and 2026-08-18, recurred a third time:** the first upload attempt (build 96, `MARKETING_VERSION 1.0.2`) was rejected — `1.0.2` was already an approved, closed version train (confirmed by the user before the retry, and independently by the export error: *"The train version '1.0.2' is closed for new build submissions"*). `scripts/publish-ios.sh` only auto-bumps `CURRENT_PROJECT_VERSION` (the build number); `MARKETING_VERSION` still has to be bumped by hand every time. Fixed by bumping `MARKETING_VERSION` to `1.0.3` in both pbxproj configs, and Android's `versionName` (`android/app/build.gradle`) to `1.0.3` to match, then retrying — **build 96 was burned with no result** (the publish script bumps the build number before any build/archive step; the archive itself succeeded, only the export/upload was rejected), 97 is the one that shipped.

**Follow-up same day — Android AAB built.** `scripts/publish-android.sh` run on request: `versionCode` 24→25, signed release AAB built successfully (`BUILD SUCCESSFUL`), output `android/app/build/outputs/bundle/release/sabeeapp-go-v25.aab`. **Not uploaded to Play Console** — that step stays a manual drag-drop (Play Console → SabeeApp Go → Testing → Internal testing → Create new release), per the established pattern.

**User confirmed live** the Turkish ID identity-number fix (below) works — a real Turkish ID scan now saves the TC Kimlik No. correctly, meaning IDScanly's `personalNumber`→`identityNumber` rename has shipped on their end. The App Store "What's New" text for this release mentions it.

**Verification:** `npx ng build` clean on `main` post-merge (only the three pre-existing known warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new). `turkish-id.spec.ts` + `to-idscanly-fields.spec.ts` re-run post-merge, 13/13 green. iOS 97 exported and uploaded successfully (`EXPORT SUCCEEDED` / `Upload succeeded`), now processing in TestFlight. Android AAB (v25) built successfully, not yet uploaded. **Turkish ID fix confirmed working live** (see above) — its own entry below is now stale on that point. **Still not device-verified:** the reservation-detail scan-shortcut icon/fallback navigation, and the IDScanly skip-back-side control-bar redesign — see each feature's own entry below for exact checks.

### 2026-08-23 — Reservation-detail guest card: scan shortcut for not-yet-scanned guests

> Branch `add-scan-shortcut-to-guest-card`. No build/version bump, no TestFlight upload (local verification only — `npx ng build` clean; not yet device/`ionic serve`-verified in this environment).

Implements the "1e — Scanner-beam icon" treatment from a Claude Design exploration (`claude.ai/design` project, file `Scan Shortcut Ideas.dc.html`, read via the `design` MCP server). The reservation-detail guest card's top-right icon (`.scan-btn`) previously only ever appeared as a passive, non-interactive "already scanned" indicator (`@if (g.scanned_data)`, no click handler beyond `stopPropagation()`) — a guest with **no** document scanned had no fast path into the scan flow from the card at all; staff had to open Guest Details, use the FAB, then "Scan Document".

- **[reservation-detail.page.html](src/app/pages/reservation-detail/reservation-detail.page.html)** guest-card block: added an `@else if (propertyConfig.scanVendor())` branch alongside the existing scanned-indicator — when a guest has no `scanned_data` **and** the property has a scan vendor configured, a distinct scanner-beam glyph (corner brackets + center scan-line, from the approved 1e design — visually different from the filled id-card rectangle used for the already-scanned state) renders in the same slot. Tapping it `stopPropagation()`s (so the card's own `(click)="goGuest(g)"` doesn't also fire) and calls a new `startScan(g)`.
- **[reservation-detail.page.ts](src/app/pages/reservation-detail/reservation-detail.page.ts)**: injected `PropertyConfigService` (already a loaded root singleton by the time reservations are visible — no new loading logic). New `startScan(g)` does `router.navigate(['/guest', reservationCode, g.reservation_guest_id], { queryParams: { autoScan: '1' } })` — a real pushed navigation (not `replaceUrl`), which matters for the fallback behavior below.
- **[guest-detail.page.ts](src/app/pages/guest-detail/guest-detail.page.ts) `ngOnInit`**: reads the new `autoScan=1` query param (same convention as the existing `previewScanSheet` dev-preview param on this page) and calls the already-existing `openScanDocument()` — which itself branches on `propertyConfig.scanVendor()`, opening the "Select Document Type" sheet for IDScanly or falling back to Regula's `goScan()`. Reusing this existing method (rather than opening the doc-type sheet directly) keeps the shortcut vendor-safe for free.
- **Fallback-to-guest-overview requirement, satisfied with no new stack-management code:** because `startScan` does a real (non-`replaceUrl`) navigation to `/guest/:code/:guestId` *before* the scan flow starts, and every internal step inside `/idscanly/scan` ↔ `/idscanly/review` already uses `replaceUrl: true` (pre-existing, see the 2026-07-15 X-to-terminate entry), a single `location.back()` from anywhere in the scan/review flow — or simply closing the doc-type sheet (backdrop/X, which just flips `docTypeSheetOpen` back to `false`) — always lands back on Guest Details, not the reservation list. This was the whole point of routing the shortcut through guest-detail instead of opening the scan flow directly from reservation-detail.
- **[sabeeapp-design.scss](src/theme/sabeeapp-design.scss)** `.guest-card .scan-btn`: new `&.shortcut` modifier (`background: var(--primary-soft-bg); border: 1px solid var(--primary-soft)`, applied via an added `shortcut` class on the button) — the initial reuse of the bare `.scan-btn` styling (transparent, no border, icon-only) tested too subtle/easy-to-miss per user feedback on a real render; the modifier reuses the same background/border pairing already established by `.action-item .action-icon` elsewhere in this file, so it reads as a filled, tappable action rather than a bare glyph, without introducing new colors. The already-scanned indicator is unchanged (still bare `.scan-btn`, no border).
- **Scoped to IDScanly only, per the user's explicit call** — the shortcut's `Type Selection` step is `GuestDetailPage`'s existing `docTypeSheetOpen` sheet, which only exists for the IDScanly vendor path; Regula and the `Design/` HTML prototype were both out of scope for this session.

**Verification:** `npx ng build` clean throughout (only the three pre-existing known warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new). **Not yet device/browser-verified** — no `ionic serve`/camera session available in this environment; next pass should confirm on a not-yet-scanned guest on an IDScanly-enabled property that the new icon appears (with the filled/bordered look), tapping it opens "Select Document Type" with Guest Details visible behind it (not Reservation Details), and that closing the sheet or discarding mid-scan lands back on Guest Details; then confirm the icon reverts to the plain scanned-indicator once a scan is saved.

### 2026-08-23 — IDScanly scan screen: skip the ID card's back side + control-bar redesign

> Branch `idscan-UI-improvement-with-skip`. No build/version bump, no TestFlight upload (local verification only — `npx ng build` clean throughout; not yet device/`ionic serve`-verified in this environment).

Implements a Claude Design exploration (`claude.ai/design` project "SabeeApp GO ID scanning skip function", file `ID Scan Skip.dc.html`) against the real IDScanly browser-based scan flow — Turn 9/9a (control-bar layout) and a same-day Turn 10/10a follow-up (skip glyph). The `design` MCP server (`https://api.anthropic.com/v1/design/mcp`) was added to this project's local Claude Code config to read the file directly rather than transcribing screenshots.

**Scan screen** ([idscanly/pages/scan/scan.page.ts](src/app/idscanly/pages/scan/scan.page.ts) / [.html](src/app/idscanly/pages/scan/scan.page.html) / [.scss](src/app/idscanly/pages/scan/scan.page.scss)): the bottom control bar was a single row (torch — shutter — "AUTO" text toggle). Restructured to two rows per the design:
- Auto-capture and flash moved to a row of two 44px icon circles above the shutter — solid `var(--primary)` fill = on, `#1c1c1e` = off, same glyph either way (no more icon swap on toggle). Auto-capture's "AUTO" text button was replaced with a viewfinder/reticle icon to match; the `idscanly.auto` translation key (its only use) was deleted.
- New `showSecondPageExtras`/`firstPageThumb` computeds gate two new elements to only the ID card's back-side capture step (`type.sides.length > 1 && currentSideIndex() === 1` — every other document type in `DOCUMENT_TYPES` is single-sided, so this is inert for passport/driving-licence/address-card): a tappable 1st-page thumbnail bottom-left (`retakeFirstPage()` — clears the front capture via `session.clearSide()`, resets to side 0, re-arms detection with `detection.arm()`, the same "after a retake" case its own doc comment describes) and a new "Skip scan" button bottom-right (`skipSecondPage()` — stops detection, navigates to `/idscanly/review` with `replaceUrl`, same one-history-entry reasoning as the existing `commitCapture()` tail).
- Both side slots are always reserved at a fixed 56×40px footprint (real content or an empty `.control-bar__slot`) so the shutter never shifts position between the front and back capture steps.

**Review screen** ([idscanly/pages/review/review.page.ts](src/app/idscanly/pages/review/review.page.ts) / [.html](src/app/idscanly/pages/review/review.page.html) / [.scss](src/app/idscanly/pages/review/review.page.scss)): a skipped side must be visibly different from a document type that only ever has one side (driving licence/passport/address card), not just silently show one image card. New `missingSides` computed (the type's sides with no capture); `captureSummary` now reads "N of M sides captured" instead of "N side(s) captured" whenever a side is missing. A collapsed placeholder card renders per missing side — no empty image preview block, just a compact status row reading "Back side skipped" (shortened per feedback from an initial longer sentence) with the same Retake button/icon/action every captured-side card already has (`retake(side)` needed no changes — `session.clearSide()` on an uncaptured side is a harmless no-op, and `IdscanScanPage.ionViewWillEnter()` already resumes at the first side with no capture, which correctly lands back on the skipped side).

**Skip icon iterated three times against live device feedback**, ending on the design's own Turn 10 update: started as a custom double-chevron SVG (the design's original Turn 9 mockup used a literal `⇥` Unicode tab-forward character, judged unreliable across fonts/platforms so not copied verbatim), swapped to the literal `⇥` character per direct request for exact mockup fidelity, enlarged 22px→32px for legibility, rebuilt as a custom arrow+bar SVG for a controllable gap between the arrowhead and the bar (adjusted twice more on gap size and stroke proportions) — then the design file was updated with a real "Turn 10 · skip glyph options" comparison (four candidates on the same 56px circle) recommending **10a**: a filled single-triangle + trailing bar, the standard media-player "skip to next" icon (`fill="currentColor"`, path `M6 5l10 7-10 7V5zM17 5h2v14h-2z`). Applied verbatim (pulled the exact SVG path from the design file via the `design` MCP, not eyeballed from a screenshot) to both the Scan screen's skip button and the Review screen's skipped-side status icon — the second site was missed in the first pass and fixed after the user flagged the mismatch.

**Translations** ([translations.ts](src/app/services/translations.ts) / [translations.en.json](src/app/services/translations.en.json) / [translations.hu.json](src/app/services/translations.hu.json), `idscanly` namespace, kept in lockstep as always): added `ariaSkipScan`, `ariaRetakeFirstPage`, `captureSummaryPartial`, `sideSkippedMessage`; deleted the now-unused `auto` (replaced by the icon-only toggle) and `skipped` (the standalone "Skipped" pill was folded into the one-line `sideSkippedMessage` — "Back side skipped" — when the card was collapsed). Key-parity script-checked after every change (63 = 63 = 63 across ts/en/hu).

**Verification:** `npx ng build` clean at every step (only the three pre-existing known warnings — two IDScanly SCSS budget overages, now slightly larger from the new markup but still warnings not errors, + the `jscanify` CommonJS bailout). **Not yet device/browser-verified in this environment** — needs an `ionic serve` pass (IDScanly's camera + OpenCV run in-browser, unlike Regula) walking a full ID-card scan: confirm the toggle row's new position/icons, thumbnail retake, skip landing on Review with the collapsed skipped-side card, and that single-sided document types are visually unchanged.

### 2026-08-23 — IDScanly: Turkish ID cards save the identity number, not the card serial

> Branch `fix/turkish-id-identity-number` (off `adding-idscanly-feedback-loop`). No build/version bump, no TestFlight upload — IDScanly is browser-based, so this is verified via `ionic serve`. `npx ng build` clean; specs 13/13 green.

A Turkish national ID card carries **two** numbers: `documentNumber` (the card serial, reissued with every replacement card) and the holder's permanent TC Kimlik No. SabeeApp needs the latter, but `IdscanlyDocuscanService.mapToScanResult()` unconditionally stored `f.documentNumber`, so every Turkish guest was saved with the card serial. The identity number was in the response the whole time — as `personalNumber` — just never read.

- **New [idscanly/utils/turkish-id.ts](src/app/idscanly/utils/turkish-id.ts)** (`isTurkishIdentityCard`) — pure predicate in the `natural-case.ts` / `hungarian-address.ts` / `to-idscanly-fields.ts` mould, with its own spec (6 cases). The rule is exactly `documentCode === 'ID' && documentCountry === 'TUR'`, compared trimmed + upper-cased (this codebase has been bitten by a stray trailing newline in a vendor string before — see the `scan_vendor: "idscanly\n"` note in the 2026-07-12 entry). `issuingCountry` is deliberately **not** accepted as a stand-in for a missing `documentCountry`; widening is a one-line change confined to this function. Extracted as a util rather than a private method so it is testable without standing up the service (which injects `LanguageService`). This is the IDScanly-side counterpart to Regula's existing Turkey/TRNC field gate ([document-reader.service.ts:688-694](src/app/regula/services/document-reader.service.ts#L688-L694), which nulls `turkish_republic_identity_number` unless the issuing state is `TUR`/`KKT`).
- **[idscanly-docuscan.service.ts](src/app/idscanly/services/idscanly-docuscan.service.ts)** — the one-line fix at the single chokepoint: `document_number: box(isTurkishId ? f.identityNumber : f.documentNumber)`. Everything downstream is vendor- and country-agnostic and needed no change (`scannedDataToGuestScannedData` → `fillGuestDataFromScannedData` → `guest.document.document_number` → `POST /guests`, plus the result sheet and the guest-edit prefill), so the scan sheet, edit form, and save payload were all fixed by that line.
- **[idrecognition.service.ts](src/app/idscanly/services/idrecognition.service.ts)** — `IdRecognitionFields` gained typed `documentCode` and `identityNumber`. Both were previously reachable only through the interface's `[key: string]: unknown` index signature, which would have forced `as string` casts at the use site.

**Reads only `identityNumber`, with no fallback — two separate deliberate decisions.**
1. **No `personalNumber` alias** (user's explicit call). IDScanly is renaming the field to `identityNumber`; the app reads only the new name, so Turkish scans start working the moment the rename ships, with no second deploy. Until then they save an empty document number.
2. **No fallback to `documentNumber`** when `identityNumber` is absent. Saving the card serial into a field the property will read as an identity number is worse than saving nothing.

**"Leave empty" means the scan does not populate the field — it does not clear a saved value.** `box(undefined)` yields `{ value: null }`, and both the merge (`d.document_number ?? existing.document_number`) and the edit prefill (`?? this.form.document_number`) treat null as "the scan said nothing" and preserve what the guest already had. That preserve-on-null semantic is deliberate — it is what keeps an address-card scan from wiping identity data — and was **not** changed here. The result sheet still renders `—` for the row (the row stays visible because `document_type` is truthy), so the gap is visible before the user saves.

**The feedback loop reports it under the matching key.** [to-idscanly-fields.ts](src/app/idscanly/utils/to-idscanly-fields.ts) is documented as the mirror image of `mapToScanResult()`; leaving it emitting `documentNumber` would have made IDScanly's field diff flag a mismatch on *every* Turkish scan — the same class of systematic false positive as the already-documented title-casing skew. Since `toIdscanlyFields()` sees only the persisted `GuestInterface` (which cannot tell you the scan's `documentCode`/`documentCountry`), a new `documentNumberKey?: 'documentNumber' | 'identityNumber'` on `ScanResultInterface` ([guest.interface.ts](src/app/models/guest.interface.ts)) is threaded exactly the way `sessionId` already is: set by the mapper, forwarded through `ExternalResultService.submitInBackground()`, passed at both save sites (guest-detail's accept-as-is, and guest-edit which captures it in `ngOnInit` alongside `sessionId`/`is_identity_document`). Named for *what it means to the consumer* rather than `isTurkishId`, so the country rule stays confined to the mapper. Exactly one of the two keys is emitted, never both. Regula leaves it `undefined` and the call no-ops on `!sessionId` as before. Documented in [docs/external-result-handoff.md](docs/external-result-handoff.md).

**Deliberately unchanged:** the UI label still reads "Document number" everywhere (user's call). The field is shared across vendors, countries and the guest-edit form; a conditional label would need new keys in all three translation files and country-awareness on screens that have none, for no functional gain. Regula and the address-card path are untouched (address cards return early before any identity extraction and emit no document box).

**Verification:** `npx ng build` clean — only the three known pre-existing warnings (two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout), none new. `turkish-id.spec.ts` 6/6 and `to-idscanly-fields.spec.ts` 7/7 (ChromeHeadless, 13 total). **Confirmed working live** (2026-08-24, user-verified against a real Turkish ID scan) — IDScanly's `personalNumber`→`identityNumber` rename has shipped on their end, so this was no longer blocked by the time it was checked; a real scan now saves the 11-digit TC Kimlik No. into Document number instead of the card serial. **Still not independently re-verified this session:** that a Hungarian ID/passport are unchanged, and that the `idscanly external-result` log's `sent_json` carries `identityNumber` (no `documentNumber`) for the Turkish scan.

### 2026-08-18 — IDScanly feedback loop: final saved values posted back to the scan's session

> Branch `adding-idscanly-feedback-loop` (fast-forwarded onto `main` at build 95 before starting — the branch had been created earlier in the session off a then-current `main` and was 2 commits stale, with no commits of its own). No build/version bump, no TestFlight upload (local verification only — `npx ng build` clean, new unit spec 6/6 green). **The `external-result` Edge Function was written and deployed (v1, ACTIVE), and the loop is now verified end-to-end against a real scan — see "Deployment + what's verified" below.**

IDScanly added an endpoint — `POST /api/v1/sessions/{sessionId}/external-result` — that lets a client attach a raw external result to an existing scan session. IDScanly stores it separately from (never merged into) its own OCR fields, and their admin UI diffs the two, so sending back the values the user actually kept gives them a real accuracy signal. Previously `sessionId` was read once for a debug log in `review.page.ts` and then discarded, so there was nothing to attach a result to.

- **`sessionId` threaded through the existing result chokepoint.** New optional `sessionId?: string` on `ScanResultInterface` ([guest.interface.ts](src/app/models/guest.interface.ts)), populated in **both** return paths of `IdscanlyDocuscanService.mapToScanResult()` ([idscanly-docuscan.service.ts](src/app/idscanly/services/idscanly-docuscan.service.ts)) — the identity path and the `mapAddressCard()` early-return (which now takes it as a parameter). No new plumbing was needed beyond this: both save sites already read `ScanResultInterface` (guest-detail via `_idscanlyResult`, guest-edit via `docuscan.lastScanResult`).
- **New [to-idscanly-fields.ts](src/app/idscanly/utils/to-idscanly-fields.ts)** (`toIdscanlyFields`) — pure function in the `utils/natural-case.ts` / `hungarian-address.ts` mould, with its own spec (6 cases, ChromeHeadless green). Maps the `GuestInterface` **that was actually passed to `updateGuest()`** into a flat object keyed by **IDScanly's own field vocabulary** (`givenNames`/`surname`/`dateOfBirth`/…, the same names `IdRecognitionFields` models). Taking the persisted guest — rather than the form model or the scan boxes — means the payload cannot drift from what was really saved. Address cards get the address-only key set (`documentCountry`/`postalCode`/`city`/`streetAddress`), mirroring `mapAddressCard()`; blank/whitespace values normalise to `null`.
- **New [external-result.service.ts](src/app/idscanly/services/external-result.service.ts)** — raw `fetch()` POST to a new `external-result` Supabase Edge Function (no `@supabase/supabase-js`; hard constraint), sending the same `pid`/`sabeeToken`/`deviceId`/`isTest` server-side-validation fields `idrecognition` already sends, so the function can reuse the identical live-session + `scan_vendor` hardening. `submit()` throws with a `kind`-tagged error (`network_error`/`http_error`) like `IdRecognitionService`; `submitInBackground()` is the fire-and-forget wrapper the pages actually call — it **never** throws or rejects, and reports failures to Sentry (`context: idscanly_external_result`).
- **Wired into both save sites**, in each case *after* `updateGuest()` has already resolved: [guest-detail.page.ts](src/app/pages/guest-detail/guest-detail.page.ts) `processScanResult('save')` (accepted as-is) and [guest-edit.page.ts](src/app/pages/guest-edit/guest-edit.page.ts) `save()` (corrected first, capturing `sessionId` + `is_identity_document` in `ngOnInit` where the scan prefill is already read).

**Payload design — deliberate, decided with the user.** One flat object of **final values only**: no original/corrected pairing, no "what changed" flags, and an identical shape whether the user accepted the scan or edited it first. IDScanly already stores its own OCR output per session and does the comparison itself, so echoing it back is redundant; their docs confirm *"there are no required document fields"* and that any JSON object is accepted. **Considered and rejected:** mirroring the SabeeApp PMS *web* interface's payload (a `{"guest": {…}}` wrapper, PMS-internal key names like `client_first_name`/`passport_number`, paired `X`/`X_formatted` values). Their admin UI does a *best-effort* comparison against its own field names, so sending IDScanly's vocabulary makes that match exact, while `client_first_name` is *further* from it than even this app's own `first_name`; those keys exist nowhere in this app; and `reservation_client_id` is a SabeeApp-internal id with no bearing on OCR accuracy. **Open, non-blocking:** worth confirming IDScanly parses both shapes, in case they've already tuned a parser to the web interface's.

**No Regula impact, by construction.** `sessionId` is set in exactly one file (the IDScanly mapper), so it is always `undefined` on the Regula path and `submitInBackground()` returns immediately. This matters because *both* save sites are vendor-shared. A `propertyConfig.scanVendor() === 'idscanly'` check was **deliberately not added**: it asks a different question (current property config, a live value that reloads on property switch) than the one that matters (did this scan produce a session we can attach to), so the two can diverge in both directions — and `sessionId` is needed to build the URL regardless, making it necessary *and* sufficient on its own. A Regula scan, or a manual edit with no scan at all, makes zero network calls.

**No Mixpanel changes.** Two typed helpers (`trackScanFeedbackSent`/`Failed`) were added and then **reverted**: the success event would have fired 1:1 with the already-tracked `scan_result_saved`/`guest_updated` (no marginal insight), and "did our backend call succeed" is operational telemetry, not product analytics. That need is served by the Sentry capture above, matching the precedent in `document-detection.service.ts`. `mixpanel.ts` is untouched and `docs/mixpanel-tracking-plan.md` needs no update.

**Deployment + what's verified.** The `external-result` Edge Function was written and **deployed** this session (project `qiwhynwwgicpyeszecuj`, v1, ACTIVE, `verify_jwt: true`), documented in new [docs/external-result-handoff.md](docs/external-result-handoff.md) and added to [docs/supabase-handoff.md](docs/supabase-handoff.md)'s Edge Functions table. **It required no new secret** — an earlier assumption that this was blocked on obtaining the IDScanly API key was wrong: `idrecognition` already reads it from an `IDSCANLY_API_KEY` env secret, and the new function reads the same one, so the key was never needed client-side or in this session. The function mirrors `idrecognition`'s auth exactly (`validateSabeeSession()` against hardcoded live/test hosts with the real `Device-Id`; `isIdscanlyEnabled()` against `property_config.scan_vendor`), both failing closed, then forwards `result` to IDScanly unchanged. It adds one local guard `idrecognition` doesn't need — rejecting a non-object `result` with 400 before spending an upstream call, mirroring IDScanly's own `INVALID_EXTERNAL_RESULT` constraint.

**Verified:** all negative paths, by direct curl against the live function — missing `sessionId` → 400, primitive `result` → 400, bogus `sabeeToken` → 401, `GET` → 405, no Supabase JWT → 401 at the gateway. Every rejection happens *before* the IDScanly call, so no vendor usage is incurred. **Live happy path verified 2026-08-19** (browser on a real iPhone against `ionic serve`, property 6250, Hungarian ID card). Session `b3263387-932c-458a-9a71-e6df1bf6421c`: the client fired the call after the save, the CORS preflight passed (`OPTIONS` 200 immediately before the `POST` 200 — this settles the `verify_jwt: true` preflight question), both server-side auth checks passed, and IDScanly returned `{"success": true, "imageCount": 2, "message": "External result saved for 2 images"}`. **`imageCount: 2` is the assertion that mattered** — a 200 carrying `imageCount: 0` would have meant the threaded `sessionId` matched nothing, and is indistinguishable from real success by status code or response length alone. All 11 identity fields were populated, no nulls. An earlier call (session `43f37bfd-…`, 06:12) also returned 200 but predated the round-trip logging, so its payload was never recoverable — which is what prompted that logging.

**Still unverified: the edit path.** Both live calls went through guest-detail's accept-as-is branch (~5s between scan completion and save). `guest-edit.page.ts`'s branch — which captures `sessionId`/`is_identity_document` in `ngOnInit` and sends the corrected values — has never run. Also unverified: address-card payloads (the `mapAddressCard` branch), and whether an IDScanly session stays valid if the user spends several minutes editing before saving (a 404 would indicate it does not).

**Testing is browser-only — no TestFlight build needed**, since IDScanly is browser-based (`getUserMedia`/OpenCV) unlike Regula: `ionic serve --ssl --external` on a phone (or plain `ionic serve` on a desktop webcam), property 6250, scan → Save, then watch for `POST /functions/v1/external-result` in the Network tab returning 200 with `idscanly.imageCount >= 1`. **`imageCount: 0` is the failure mode to watch for** — it means IDScanly matched the session but no images, i.e. the threaded `sessionId` is wrong, and it would otherwise look like success. Note that on the LAN self-signed-HTTPS setup Sentry delivery itself can fail (documented 2026-07-06), so "no Sentry error" is not proof of success there — use the Network tab and the Supabase function logs instead.

**Follow-up same session — `extended_logging` now also covers the external-result round trip.** The Supabase edge logs record headers and status only, never bodies, and the `sessionId` travels in the request *body* (not the URL path), so neither the payload nor the session was recoverable after the fact — the first live call could only be confirmed as "a POST returned 200". `ExternalResultService` now has a private `logOutcome()` that dumps **both directions** — what we sent and what came back — to `console.log` + `Sentry.logger.info('idscanly external-result', …)`, gated on the same per-property `propertyConfig.extendedLogging()` flag as `review.page.ts`'s `logIdscanlyResponse()`, and following the same flat-attributes + `capJson()` (16 kB cap) convention. Gated, not unconditional, for the same reason as that one: the payload *is* guest PII (name, DOB, document number), which would otherwise ride into Sentry via breadcrumbs on any unrelated error. `submit()` changed from `Promise<void>` to `Promise<unknown>` so the response body is available to log. **`image_count` is lifted out as its own attribute** — it is the single value distinguishing a real success from a silent one (a 200 carrying `imageCount: 0` means IDScanly matched the session but attached the result to no images). New `PropertyConfigService` dependency introduced no DI cycle (it depends only on `ApiEnvironmentService`, and `ExternalResultService` is a leaf that only pages inject).

**Known difference handed off to IDScanly — title-casing skews their diff.** The live payload exposed something not considered during planning: IDScanly's OCR returns names/places in ALL CAPS, and `toNaturalCase()` title-cases them (and normalises parenthesis spacing) before they are displayed or saved. Since this payload carries *the saved values*, it carries the title-cased form — `TAMAS`→`Tamas`, `KECSKEMET(MAGYARORSZAG)`→`Kecskemet (Magyarorszag)`. A naive diff on their side therefore marks every name and place field as "corrected" on *every* scan, even when the OCR was character-perfect and the user changed nothing: a systematic false positive in precisely the accuracy signal this endpoint exists to produce. **Deliberately not fixed on our side** — sending raw OCR casing would misrepresent what was actually saved (the entire point of the payload), and the app deliberately does not track per-field "was this edited". Documented as a known difference in [docs/external-result-handoff.md](docs/external-result-handoff.md) with the resolution being a case-insensitive comparison on the consuming end. Document numbers, dates, and codes pass through untouched and diff exactly.

**Found while verifying, unrelated and not actioned:** `property_config` now holds **530 rows, every one with `extended_logging = true`** (526 of them created 2026-08-18 10:55). That flag gates dumping the full `idrecognition` response — which carries guest PII (name, DOB, document number, mother's maiden name) — to Sentry and the console; it was introduced (2026-07-06) deliberately scoped to the single test property 6250 for exactly that reason. Worth reviewing whether the bulk rollout meant to enable it everywhere.

**Verification:** `npx ng build` clean (only the three known pre-existing warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new). `to-idscanly-fields.spec.ts` 6/6 (ChromeHeadless). **Not yet runtime-verified** — no browser session run this pass. Next `ionic serve` should confirm via the Network tab that the call fires exactly once per IDScanly-sourced save from both paths, **never** for a Regula save or a scan-less manual edit, that the (expected) 404 surfaces nothing to the user and doesn't delay the sheet closing, and that the request body matches the documented shape; `?previewScanSheet=result` reaches the accept-as-is path without a camera.

### 2026-08-18 — Shipment: build 95 (iOS) / versionCode 24 (Android) — app-version centralization, Mixpanel fix, IDScanly address-card

> Branch `implement-address-card-scan`, fast-forward merged into `main` (local only — not pushed to `origin`). **Shipped builds: iOS 95 (TestFlight, uploaded successfully — processing), Android versionCode 24 (signed AAB `sabeeapp-go-v24.aab`, built — manual Play Console drag-drop, not auto-uploaded).**

Ships the three commits that had accumulated on `main` since build 93 without a release, all previously verified only via `npx ng build` / local reasoning, none previously device-tested: the Mixpanel `app_version` stale-constant fix, the `AppVersionService` centralization + force-update-gate fix (both 2026-08-13, see entries below), and today's IDScanly Hungarian address-card fix (see entry directly below this one).

**Same App Store Connect blocker as 2026-08-12, recurred:** the first upload attempt (consuming build number 94) was rejected — `MARKETING_VERSION` was still `1.0.1` in `project.pbxproj`, and that version train was already closed (a `1.0.1` release had been approved on the App Store since the last shipment). `scripts/publish-ios.sh` only auto-bumps `CURRENT_PROJECT_VERSION` (the build number), never `MARKETING_VERSION` — has to be bumped by hand every time the currently-approved version catches up to it. Fixed by bumping `MARKETING_VERSION` to `1.0.2` in both pbxproj configs, and Android's `versionName` (`android/app/build.gradle`) to `1.0.2` to match, then retrying — build 94 was burned with no result (the publish script bumps the build number before any build/archive step), 95 is the one that shipped.

**Verification:** `npx ng build` clean going into the build (already confirmed by each individual commit's own entry). iOS 95 exported and uploaded successfully (`EXPORT SUCCEEDED` / `Upload succeeded`), now processing in TestFlight. Android AAB built successfully via `gradlew bundleRelease`, not yet uploaded to Play Console (manual step, per established pattern). **Not yet device-verified** — once builds finish processing/are installed: confirm Mixpanel's `app_version` reports `1.0.2` (not a stale value), confirm the force-update gate still passes correctly on both platforms, and confirm a real IDScanly Hungarian address-card scan fills only the guest's address (see the entry below for exactly what to check).

### 2026-08-18 — IDScanly: Hungarian address-card scan fills address only (parity with Regula's address-card path)

> Branch `implement-address-card-scan`. No build/version bump, no TestFlight upload (local verification only — `npx ng build` clean).

IDScanly's document-type picker already listed "Address card" as a selectable type, and a real scan of a Hungarian address card (lakcímkártya) confirmed the vendor's response shape: `city`, `postalCode`, `streetAddress`/`streetName`/`streetType`/`houseNumber`, `documentCountry`, plus identity-shaped fields (`displayName`, `fullName`, `givenNames`, `surname`, `dateOfBirth`) that don't belong to an address card. But `IdscanlyDocuscanService.mapToScanResult()` had no per-type field extraction at all — it unconditionally ran the identity-extraction path for every document type, including address cards, silently dropping the address fields entirely (never read) while still populating `first_name`/`last_name`/`birth_date`/etc. This meant `guest-detail.page.ts`'s existing `is_identity_document === false` branch (which already correctly restores `guest.scanned_data` after save) wasn't enough on its own to protect the guest's identity fields — `fillGuestDataFromScannedData()`'s flat-copy loop would have written those identity boxes straight onto `guest.first_name`/`guest.last_name`/etc. *before* the restore, and that part is never undone. Regula's own address-card path avoids this by calling `stripToAddressFields()` (deletes every non-`address_*` key) before the shared merge ever runs — IDScanly had no equivalent step.

- **[idrecognition.service.ts](src/app/idscanly/services/idrecognition.service.ts)**: `IdRecognitionFields` gained `city`/`postalCode`/`streetAddress`/`streetName`/`streetType`/`houseNumber` (typed, previously only reachable via the interface's index signature). `documentCode`/`issuingAuthority`/`registrationDate` are received but deliberately never read — only the address is captured, per the requirement.
- **[idscanly-docuscan.service.ts](src/app/idscanly/services/idscanly-docuscan.service.ts)**: `mapToScanResult()` now branches to a new private `mapAddressCard()` at the very top when `documentType.id === 'address-card'`, before any identity extraction runs. `mapAddressCard()` produces a `ScannedGuestDataInterface` containing **only** the four `address_*` box keys (`address_country_code`/`address_zip`/`address_city`/`address_line`) — no identity box is ever created for this type, mirroring Regula's strip-before-merge behavior structurally instead of as a post-hoc deletion. `address_line` prefers the vendor's pre-combined `streetAddress` (already includes the house number), falling back to assembling `streetName`+`streetType`+`houseNumber`. `city`/`address_line` go through the existing `toNaturalCase()` (same ALL-CAPS-to-Title-Case treatment already applied to IDScanly's other prose fields); `zip`/`country_code` are left as codes, untouched. `documentData.is_identity_document: false` (unchanged behavior, now reached via the new branch). `date_of_issue: null` and no document-number box — nothing beyond the address is captured. The main (non-address-card) branch's `is_identity_document` literal simplified from `documentType.id !== 'address-card'` to `true`, since TypeScript now narrows `documentType.id` to exclude `'address-card'` past the early return (the old expression became a compile error — "no overlap").
- **Downstream, unchanged and already correct:** `docuscan.ts`'s shared `addressKeyMap`/`fillGuestDataFromScannedData()` (nests `address_*` into `guest.address` via a safe per-field merge), `guest-detail.page.ts`'s `processScanResult('save')` `is_identity_document` branch (restores `guest.scanned_data` for non-identity scans), the result-sheet's address section, and `GuestInterface.address`'s existing `{country_code, zip, city, address_line}` shape — all vendor-agnostic, already exercised by Regula's identical address-card flow (see the 2026-06-05 entry below), so IDScanly gets the same guarantees for free once the mapper stopped emitting identity boxes.
- **Known, accepted limitation carried over from Regula's address-card path:** the vendor's `documentCountry` is a 3-letter code (e.g. `"HUN"`) while `CountryOption.country_code` (from `GET /options`) is 2-letter (`"HU"`) — `countryName()` falls back to showing the raw code on a lookup miss. Not fixed here, matches the existing, already-documented Regula limitation.

**Verification:** `npx ng build` clean (only the three pre-existing known warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new). `idscanly.docTypeAddressCard` confirmed already translated in all three translation files (added when the picker option was originally built). **Not yet device/browser-verified** — no camera session available in this environment; needs a real IDScanly address-card scan (`ionic serve --ssl --external` or TestFlight) to confirm the result sheet shows only the address section (no name/DOB/document rows), Save populates `guest.address` without touching `guest.first_name`/`last_name`/`document`/`scanned_data`, and the "Scanned: Yes/No" row + reservation-detail scan icon stay unchanged.

### 2026-08-13 — Follow-up: AppVersionService centralizes real app version across all consumers, adds a distinct analytics sentinel

> Branch `fixing-tracking-appversion` (same branch as the entry directly below). No build/version bump, no TestFlight upload (local verification only — `npx ng build` clean at every step).

Completes the "follow-up, not done this session" item from the entry below: the other three `Config.APP_VERSION` consumers (the `App-Version` header, feedback submissions, and — most importantly — the force-update version gate) now resolve the real installed version too, instead of the stale hardcoded constant.

**New [app-version.ts](src/app/services/app-version.ts) (`AppVersionService`)** — single source of truth, mirrors the existing `deviceId` resolve-once-at-boot pattern in `auth.ts`:
- `version` signal: defaults to `Config.APP_VERSION`, overwritten with the real `App.getInfo()` result in `init()` (only ever fails — and keeps the fallback — on platforms without the native App plugin, i.e. web/`ionic serve`).
- `build` signal: same idea, for the build number (previously only read by `SettingsPage`'s own separate call).
- `analyticsVersion` computed: `'0.0.0'` on non-native platforms, real `version()` otherwise — see the sentinel note below.

**Wired into every remaining consumer:**
- [app.component.ts](src/app/app.component.ts): `appVersion.init()` is now called as the very first boot step (before `apiEnv.init()`), so it's resolved before the API interceptor or the force-update gate can fire; replaces the local `App.getInfo()` try/catch added in the prior commit on this branch.
- [api.interceptor.ts](src/app/interceptors/api.interceptor.ts): `App-Version` header now reads `appVersion.version()`.
- [app-config.ts](src/app/services/app-config.ts) `runVersionGate()`: `isVersionBelow()` now compares against `appVersion.version()` — the most important fix, since this gate had been silently comparing against a frozen fake number (`'1.1.0'`) since before it even existed.
- [feedback-sheet.component.ts](src/app/components/feedback-sheet/feedback-sheet.component.ts): `app_version` in the Supabase feedback payload now reads `appVersion.analyticsVersion()`.
- [settings.page.ts](src/app/pages/settings/settings.page.ts): no longer makes its own separate `App.getInfo()` call — reads the same already-resolved `version`/`build` signals from the service (one native call app-wide instead of two). Template guard in [settings.page.html](src/app/pages/settings/settings.page.html) updated to require both `appVersion()` and `appBuild()` before showing the version line, preserving the old "hide until both resolved" behavior now that `version` defaults to a truthy fallback instead of `''`.

**`Config.APP_VERSION` updated `'1.1.0'` → `'1.0.1'`** to match the real current native `MARKETING_VERSION`/`versionName`, and is now read in exactly one place: as `AppVersionService.version()`'s initial/web-fallback value. No consumer reads the constant directly anymore.

**Mixpanel/feedback get a distinct `'0.0.0'` sentinel instead of a real-looking fallback number — deliberate design split, decided with the user.** A live Mixpanel check (a screenshot from a `localhost:8100` browser session) showed `app_version: 1.1.0` and was initially mistaken for the fix not working — it was actually the documented, correct web fallback firing (`App.getInfo()` throws unconditionally on web — `"Not implemented on web."`, confirmed by reading the `@capacitor/app` web plugin source directly). To make this unambiguous going forward without needing to cross-reference the `platform` property on every event, `analyticsVersion` reports `'0.0.0'` on non-native platforms for Mixpanel and feedback specifically. **Deliberately not applied to `version()` itself** (the API header + the gate): `isVersionBelow('0.0.0', minimum_version)` would be `true` against virtually any real `minimum_version`, permanently force-blocking every web/dev session to `/update-required` — breaking the existing, documented QA workflow where `ionic serve` (platform `web`) intentionally reads the Android `minimum_version` row so someone can test both the blocked and pass-through states from a browser (see Session 14, 2026-05-31). `version()` keeps the real-or-`1.0.1`-fallback value for that reason.

**Verification:** `npx ng build` clean throughout (only the three pre-existing known warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new). Browser-verified the fallback mechanism itself (confirmed `app_version: 1.1.0` in a live Mixpanel event, traced to the documented fallback path, then to the plugin source). **Not yet device-verified** — no build was shipped this session; next TestFlight/Play upload should confirm native sessions report the real `1.0.1` (or later) to Mixpanel/feedback/the API header, and that the force-update gate still behaves correctly on both platforms.

### 2026-08-13 — Fix: Mixpanel app_version was a stale hardcoded constant, never the real shipped version

> Branch `fixing-tracking-appversion`. No build/version bump, no TestFlight upload (local verification only — `npx ng build` clean, `npm install --dry-run` clean). Follow-up to the previous session's live Mixpanel-MCP validation of the `improve-mixpanel-tracking` branch, which surfaced this while spot-checking `app_version` on real events.

**Root cause:** `Config.APP_VERSION` ([config.ts](src/app/config/config.ts)) is a hand-typed string literal — `'1.1.0'` — that has never once matched the real native app version. It predates Mixpanel entirely (already `'1.1.0'` in the very first commit that created `config.ts`) and was never touched through the recent `1.0 → 1.0.1` `MARKETING_VERSION`/`versionName` bump (see the 2026-08-12 entry below). Grepping every consumer found **four** places reading it, all silently wrong: the `App-Version` HTTP header ([api.interceptor.ts](src/app/interceptors/api.interceptor.ts)), the Mixpanel `app_version` super property ([mixpanel.ts](src/app/services/mixpanel.ts)), feedback/feature-request submissions ([feedback-sheet.component.ts](src/app/components/feedback-sheet/feedback-sheet.component.ts)), and — most concerning — the force-update version gate itself ([app-config.ts](src/app/services/app-config.ts) `isVersionBelow(Config.APP_VERSION, minimum_version)`), meaning the update-required screen has been comparing Supabase's `minimum_version` against a frozen fake number the whole time. Meanwhile the *correct* mechanism already existed and was already in use: [settings.page.ts](src/app/pages/settings/settings.page.ts) calls Capacitor's `App.getInfo()` to show the user their real installed version — just never reused anywhere else.

**Fix — scoped to Mixpanel only, per the user's explicit request** (the other three consumers are flagged as a follow-up, not fixed here):

- **[mixpanel.ts](src/app/services/mixpanel.ts)** `registerSuperProps()` signature changed from `(apiMode)` to `(apiMode, appVersion: string)` — no longer reads `Config.APP_VERSION` internally; the `Config` import was removed from this file entirely (it was the only usage).
- **[app.component.ts](src/app/app.component.ts)**: right before the boot-time `registerSuperProps()` call, resolves the version via `await App.getInfo()` (same call `SettingsPage` already makes), falling back to `Config.APP_VERSION` only in a `catch` — i.e. only on platforms without the native App plugin (web/`ionic serve`), where there's no real App Store/Play version to report anyway. Every native run (iOS/Android) now reports the true installed version to Mixpanel; only browser/dev sessions fall back to the stale constant.
- **[config.ts](src/app/config/config.ts)**: added explanatory comments on `APP_VERSION` documenting the remaining three stale consumers as a TODO, and on `API_VERSION`/`CI_VERSION` documenting the opposite conclusion (see below).

**Investigated but deliberately left alone — `API_VERSION`/`CI_VERSION`.** Grepped for every usage: both have exactly one consumer each, the same `api.interceptor.ts` headers (`Api-Version`/`Ci-Version`), no cross-system spread like `APP_VERSION` had. **Decided with the user:** these are intentionally static backend-API-contract constants (not app-release versions), meant to be bumped by hand only when the API contract itself changes — not a bug, left as `'1.0'`/`'4'`. Documented inline in `config.ts` so a future pass doesn't re-flag them.

**Also removed — unused `package.json` `"version": "0.0.1"`.** Grepped the whole repo (including `capacitor.config.ts`, `angular.json`, both publish scripts) for any reader of this field — found none; the only file even mentioning `package.json` was the auto-generated `package-lock.json`. It was inert scaffold boilerplate from project creation (the package is already `"private": true`, so npm's publish-validity requirement never applied either). Removed the field; confirmed `npm install --dry-run` and `npx ng build` both stay clean. `package-lock.json`'s root entry still carries the old value until the next real `npm install` naturally resyncs it — left as-is rather than forcing a lockfile rewrite for a purely cosmetic field.

**Verification:** `npx ng build` clean (only the three pre-existing known warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new). `npm install --dry-run` clean, no warnings. **Not yet device-verified** — no build was shipped this session; next TestFlight/Play upload should confirm Mixpanel's `app_version` now reports the real `MARKETING_VERSION`/`versionName` instead of `1.1.0`.

**Follow-up, not done this session:** apply the same `App.getInfo()`-at-boot fix to the other three `Config.APP_VERSION` consumers (`App-Version` header, feedback submissions, the force-update gate) — or better, resolve the real version once at boot and thread it through, rather than each consumer independently reading a constant.

### 2026-08-12 — Mixpanel: property_id as a super property + full IDScanly scan-funnel tracking

> Branch `improve-mixpanel-tracking`. **Shipped builds: iOS 93 (TestFlight, uploaded successfully — processing), Android versionCode 23 (signed AAB `sabeeapp-go-v23.aab`, built — manual Play Console drag-drop, not auto-uploaded).** Marketing version bumped `1.0` → `1.0.1` on both platforms as part of this shipment — see note below. **Device/browser-verified in a follow-up session** via the Mixpanel MCP server against the live EU project (4029913) — see the Verification note at the end of this entry for what was confirmed.
>
> **Unrelated App Store Connect blocker hit during this shipment:** the first iOS upload attempt (build 92) was rejected — `MARKETING_VERSION` was still `1.0` in `project.pbxproj` (both Debug and Release configs), and that version "train" was already closed since a `1.0` release had previously been approved on the App Store (`CFBundleShortVersionString` must exceed the last approved version, not just the build number). `scripts/publish-ios.sh` only auto-bumps `CURRENT_PROJECT_VERSION` (the build number) — `MARKETING_VERSION` has to be bumped by hand. Fixed by bumping `MARKETING_VERSION` to `1.0.1` in both pbxproj configs and Android's `versionName` (`android/app/build.gradle`) to match, then retrying. **Build 92 was burned with no result** (the publish script bumps the build number before any build/archive step, so a failure downstream still costs a number) — 93 is the one that actually shipped.

**Part 1 — `property_id` as a Mixpanel super property.** Previously the active property only reached Mixpanel via `identify()`'s People-profile update (`people.set`), so individual *events* couldn't be segmented/filtered by property at all. Added `MixpanelService.setActiveProperty(propertyId, propertyName)` ([mixpanel.ts](src/app/services/mixpanel.ts)), which calls `mixpanel.register()` — a real super property attached to every subsequent `track()` call, distinct from and additional to the existing People-profile update. `mixpanel.register()` overwrites the previous value, so a property switch mid-session correctly re-tags all following events without needing a new analytics session (the "session" concept — driven by `MixpanelService`'s own 30-minute-idle `session_id` — is unaffected by property switches; only `App.appStateChange` backgrounding starts a new one).

- **[auth.ts](src/app/services/auth.ts)** `identifyToMixpanel()`: now also calls `setActiveProperty()` alongside the existing `identify()` call. Since this method already fires from both the mandatory post-login property pick and every in-app property-switcher selection (`selectProperty()`), no new call sites were needed to cover "every property switch."
- **[app.component.ts](src/app/app.component.ts)**: `setActiveProperty()` is called (a) inside the `App.addListener('appStateChange', …)` `isActive` branch, immediately before `handleAppActive()`, so a foreground that starts a new session already has the property registered before `session_started` fires; and (b) once inside the `loadStoredAuth().then(...)` callback on cold boot, backfilling the super property (persisted via `localStorage`, see `main.ts`'s `mixpanel.init()`) as soon as the restored property is known. **Known, accepted gap:** the very first `mixpanel.handleAppActive()` call in `ngOnInit()` runs before `loadStoredAuth()` resolves, so a fresh install's very first `session_started` fires without `property_id` — self-heals from the next session onward once (b) has run once.
- `mixpanel.reset()` on logout (already existing, [auth.ts](src/app/services/auth.ts) `logout()`) clears all `register()`-ed super properties per mixpanel-browser semantics, including the new one — no extra cleanup code needed, but not independently re-verified this session (flagged in the plan for the user to confirm live).

**Part 2 — full IDScanly scan-funnel tracking.** IDScanly previously fired only the two vendor-shared events (`scan_result_edited`/`scan_result_saved`, both in `guest-detail.page.ts`) — nothing tracked the scan flow itself (start, per-side capture quality, discard, or the `idrecognition` submit outcome), unlike Regula which already had `scan_succeeded`/`scan_failed`. Per the user's decision: reuse `scan_succeeded`/`scan_failed` (add a `vendor: 'regula' | 'idscanly'` discriminator) rather than new `idscanly_*`-prefixed events, and track the full funnel rather than just the submit outcome.

New/changed events in **[mixpanel.ts](src/app/services/mixpanel.ts)**:
- `trackScanStarted({ vendor, document_type })` — fired from **[guest-detail.page.ts](src/app/pages/guest-detail/guest-detail.page.ts)** `startIdscanly(type)` when a document type is picked in the IDScanly doc-type sheet.
- `trackScanCaptureCompleted({ vendor: 'idscanly', document_type, side, source: 'auto'|'manual', quality_verdict, sharp, well_lit, glare_free, complete })` — fired from **[scan.page.ts](src/app/idscanly/pages/scan/scan.page.ts)** `commitCapture()` on every successful side capture (fires again on a retake's recapture, so no separate retake event was added — the second capture-completed event for that side carries its own quality score). Required threading the previously-discarded `source: CaptureSource` parameter through `commitCapture()` from both call sites (`onCaptured()` and the manual-nag-confirmed `useTakenPhoto()`, which is always `'manual'`).
- `trackScanDiscarded({ vendor, document_type, stage: 'capture'|'review', sides_captured })` — fired from `scan.page.ts` `close()` (`stage: 'capture'`, the X before any submission) and **[review.page.ts](src/app/idscanly/pages/review/review.page.ts)** `confirmDiscard()` (`stage: 'review'`, X + confirm after captures exist).
- `trackScanSucceeded`/`trackScanFailed` — widened with `vendor` (now required on both) and, on `trackScanFailed`, a new optional `document_type`. `trackScanSucceeded` gained IDScanly-only optional fields (`is_complete`, `is_processing`, `image_count`, `successful_image_count`, `failed_image_count`, straight from the `idrecognition` response's `summary`); `trackScanFailed`'s `reason` enum widened with IDScanly-specific values (`network_error`, `http_error`, `empty_response`, `camera_unavailable`) alongside Regula's existing `timed_out`/`cancelled`/`interrupted`/`error`. Fired from `review.page.ts` `submit()` (success/catch, with a new local `submitAttempts` counter mirroring Regula's `_scanAttempts` since Submit is retryable after a failure) and from `scan.page.ts`'s camera `onError` callback (`reason: 'camera_unavailable'`, `attempt_number: 0`).
- **[document-reader.service.ts](src/app/regula/services/document-reader.service.ts)** (Regula): both existing call sites tagged `vendor: 'regula'`; the failed one also gained `document_type` (from the same `mpDocType` already computed for the succeeded branch) — no other behavior change.
- **[idrecognition.service.ts](src/app/idscanly/services/idrecognition.service.ts)**: `submit()`'s three failure paths (fetch-level throw, non-OK response, empty/null body) now throw a `taggedError()` — `Error & { kind: 'network_error' | 'http_error' | 'empty_response' }` — following the existing `Error & { apiErrors?: unknown }` pattern from `auth.ts login()`, so `review.page.ts`'s catch block can pick a real `reason` instead of the generic `'error'` fallback.

**Verification:** `npx ng build` clean at every step (only the three pre-existing known warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new).

**Follow-up session — live-verified via the Mixpanel MCP** (queried the EU project, `Get-Property-Values` in `expanded` mode against a real staff distinct_id who ran a live IDScanly session on property `6250`): a full id-card scan (front+back, auto-captured) and a driving-licence scan (front only — intentional, see [parked-topics.md](docs/parked-topics.md) note / driving-licence only needs the front) both produced clean event sequences — `scan_started` → 1-2× `scan_capture_completed` → `scan_succeeded`, no unexpected `scan_discarded`/`scan_failed`. Field-level checks all passed: `scan_capture_completed` carries `vendor`/`document_type`/`side`/`source`/`quality_verdict` + the four boolean quality flags correctly typed; `scan_succeeded` carries `vendor: 'idscanly'` with `document_type_id`/`scan_type` correctly `null` (Regula-only fields) and `is_complete`/`image_count`/`successful_image_count`/`failed_image_count` internally consistent with the capture count. `property_id`/`property_name` confirmed present as a real super property on every event type checked (`scan_started`, `scan_capture_completed`, `scan_succeeded`, `session_ended`, `home_segment_changed`) once a property was selected in the session, including a live in-app property switch (`property_switched` showed `property_id` flipping `6250→8987→6250`, and subsequent events picked up the new value immediately). The one known/expected gap — the very first `session_started` of a cold boot has `property_id: null` before `loadStoredAuth()` resolves — was directly observed in the data and matches the documented self-healing behavior above, not a bug.

**Not verified this pass:** Regula's `vendor: 'regula'` tagging on `scan_succeeded`/`scan_failed` (no Regula scan occurred in the session used for validation — needs a native-device Regula scan to confirm no regression), and `mixpanel.reset()` clearing the `property_id` super property on logout (no logout event was captured in the validated window).

### 2026-07-23 — Fix: MFA screen appeared for an account with MFA disabled + App Store/Play reviewer bypass

> Branch `fixing-mfa-required-at-login`. **Shipped builds: iOS 91 (TestFlight, uploaded successfully — processing), Android versionCode 22 (signed AAB `sabeeapp-go-v22.aab`, built — manual Play Console drag-drop, not auto-uploaded).**

**Reported:** logging in with `housekeeperappstore@gmail.com` (MFA supposedly disabled for this account) still showed the `/mfa` code-entry screen. Diagnosed with a temporary `console.log` of the raw `/token` response in `AuthService.login()` (added then removed, no net diff) — confirmed `POST /token` returned `{ success: true, data: { mfa_token, required: true, methods: ['totp'] } }`. Two findings: (1) the client never reads `required` at all — [auth.ts](src/app/services/auth.ts) `login()` only checks whether `mfa_token` is truthy, and [login.page.ts](src/app/pages/login/login.page.ts) `submit()` navigated to `/mfa` unconditionally whenever `mfa_token` was present; (2) more importantly, the server itself reported `required: true` for this account — so the "MFA disabled" toggle wasn't actually suppressing the MFA step server-side. That server-side question is unresolved/out of scope for this session.

**What was actually needed, per the API developer:** this account isn't a real "disable MFA" case — it's the **App Store / Google Play reviewer test account**, which can't complete real MFA (no authenticator app installed on the review device). The backend's answer: for this one account, `POST /mfa/verify` accepts an **empty string** as the code and returns a real `access_token` regardless of the `required` flag.

- **[config.ts](src/app/config/config.ts):** new `Config.APP_REVIEW_ACCOUNT_EMAIL = 'housekeeperappstore@gmail.com'`, commented as the reviewer-account MFA bypass.
- **[login.page.ts](src/app/pages/login/login.page.ts) `submit()`:** after `auth.login()` succeeds, if the email matches, calls `auth.verifyMfa(mfaToken, '', email)` directly and navigates straight to `/property-select` (`replaceUrl: true`) — the `/mfa` route is never reached for this account. Every other account is unaffected — still routes through `/mfa` exactly as before. `MfaPage` itself was not touched (kept the change to one file, and avoids a confusing UX where a code-entry screen would silently ignore whatever the user types — the two options were weighed and this one was simpler and more honest).
- **Known limitation, flagged and accepted by the user:** this is a hardcoded single-email special-case, not a general "MFA disabled" mechanism — it only covers this one reviewer account. If more accounts ever need MFA skipped, this should be driven by a real server-returned signal (e.g. a trustworthy `required: false`) rather than a growing list of hardcoded emails. The underlying server-side mystery (why `required: true` was returned for an account believed to have MFA off) was not investigated further this session — out of scope once the reviewer-bypass need was clarified.

**Verification:** `npx ng build` clean (only the three pre-existing known warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout, none new). Manually confirmed via the diagnostic log that `/token` returns `mfa_token`/`required: true` for the account in question. Build 91 archived, exported, and uploaded to TestFlight successfully (`EXPORT SUCCEEDED` / `Upload succeeded`). **Not yet device-verified:** once build 91 finishes processing, a real login with `housekeeperappstore@gmail.com` confirming it lands on `/property-select` with no `/mfa` screen shown.

### 2026-07-16 — IDScanly: "Show debug" gated to property 6250; its data now rides along to Sentry instead

> Branch `idscanly-response-postprocessing`. No build/version bump, no TestFlight upload (local verification only — `npm run build` clean).

The Scan and Review screens' "Show debug" dev/QA toggles (capture-tuning readouts added while diagnosing tonight's auto-capture/marble-background issue) were visible to every user on every property. Per the user's decision: restrict them to the internal test property, and instead of losing that diagnostic visibility for everyone else, fold it into the existing per-property Sentry logging.

- **New [idscanly-debug.const.ts](src/app/idscanly/idscanly-debug.const.ts)** — `IDSCANLY_DEBUG_PROPERTY_ID = '6250'`, explicitly commented as a debug-only gate and a cleanup candidate (mirrors the existing `BRIEFING_PROPERTY_ID` pattern in `briefing.const.ts`, same `String(property_id)` comparison convention).
- **[scan.page.ts](src/app/idscanly/pages/scan/scan.page.ts) / [.html](src/app/idscanly/pages/scan/scan.page.html)** and **[review.page.ts](src/app/idscanly/pages/review/review.page.ts) / [.html](src/app/idscanly/pages/review/review.page.html)**: both inject `AuthService` and add a `debugToolsEnabled` computed comparing `auth.selectedProperty()?.property_id` against the new const; the "Show debug" `<button>` on each screen is now wrapped in `@if (debugToolsEnabled())` — removed from the DOM entirely for every other property, not just CSS-hidden. The underlying overlays (pip canvas + metrics badges, debug-log panel, per-side debug readout) were left untouched — they're already gated on `showDebug()`, which can now never flip `true` without the button.
- **[review.page.ts](src/app/idscanly/pages/review/review.page.ts) `logIdscanlyResponse()`** (still gated on `propertyConfig.extendedLogging()`, unchanged): now also attaches `captures_json` (per-side `CaptureQuality` — verdict, sharp/wellLit/glareFree/complete, summary, metrics — the exact data the Review debug readout displays) and `detection_log_json` (`DocumentDetectionService.logs()`, the same rolling log the Scan screen's debug panel renders) to the existing `Sentry.logger.info('idscanly response', …)` call, alongside the already-sent `response_json`. Mirrored into the paired `console.log` for local-dev parity. New `DocumentDetectionService` injection on review.page — no DI-cycle risk (page components sit at the leaf of the graph).
- **Known, accepted limitation:** `DocumentDetectionService.logs` is a ~12-line rolling buffer, so only the most recent ~10s of live-tick history (typically just the last capture attempt, at the 800ms throttle added earlier tonight) survives by the time Submit fires — earlier-side history may already be evicted. Not expanded as part of this change.

**Verification:** `npm run build` clean (only the three pre-existing known warnings). `logIdscanlyResponse()`'s early-return on `extendedLogging() === false` is unchanged, so the new Sentry fields are inert for every property without that flag set. **Not yet device/browser-verified** — no camera/browser session available in this environment; next `ionic serve --ssl --external` pass should confirm the "Show debug" buttons are gone for a non-6250 property and present for 6250, and that a submit on an `extended_logging`-enabled property shows `captures_json`/`detection_log_json` in the console alongside the response.

### 2026-07-15 — IDScanly: X-to-terminate on Scan/Review, replacing the ambiguous back chevron

> Branch `idscanly-response-postprocessing`. No build/version bump, no TestFlight upload (local verification only — `npm run build` clean, translation key parity 243/243/243 confirmed).

Reported from LAN phone testing (`ionic serve --ssl --external`): once an IDScanly scan is running there was no obvious way to bail out. Both `scan.page` and `review.page` already had a working exit — a small grey top-left back chevron that stopped the camera and navigated back — but it read as "step back" rather than "cancel," so it went unnoticed. Per the user's decision: replace it entirely (not add alongside it) with a single, prominent **X** in the top-right on both screens — once the camera has started, the only affordance is "terminate," not "navigate."

- **[scan.page.html](src/app/idscanly/pages/scan/scan.page.html) / [.scss](src/app/idscanly/pages/scan/scan.page.scss) / [.ts](src/app/idscanly/pages/scan/scan.page.ts):** header restructured to title-left/X-right (`justify-content: space-between`); `.scan-header__back` → `.scan-header__close`. `goBack()` renamed to `close()`: `detection.stop(); session.reset(); location.back()` — exits immediately, no confirmation (nothing valuable has been produced yet on this screen).
- **[review.page.html](src/app/idscanly/pages/review/review.page.html) / [.scss](src/app/idscanly/pages/review/review.page.scss) / [.ts](src/app/idscanly/pages/review/review.page.ts):** same header swap. Since real captured photos exist here, the X no longer navigates directly — `close()` opens a new `confirmDiscardOpen` signal, rendering a "Discard this scan?" dialog (new `.discard-dialog` block, styled after the existing `.nag-dialog` pattern from `scan.page.scss` but scoped locally, with the destructive "Discard" button using `--warn` instead of `--primary`). "Keep reviewing" just closes the dialog; "Discard" (`confirmDiscard()`) does `session.reset(); location.back()`.
- **Why a single `location.back()` fully removes the whole flow from history:** every internal transition in this flow (`scan.page.ts` scan→review, `review.page.ts` retake→scan) already uses `{ replaceUrl: true }` specifically so the flow occupies one history entry regardless of how many retakes happen (pre-existing code comments confirm this was intentional). Only the initial guest-detail → `/idscanly/scan` hop is a real push. So no new history-clearing logic was needed — the existing `replaceUrl` discipline already guarantees X pops cleanly back to guest-detail.
- **`CaptureSessionService.reset()`** (pre-existing, unchanged) clears `documentType`/`captures`/`context`/`scanResult` in one call — reused as the "wipe the in-progress session" step on both screens.
- **Translations:** 3 new `idscanly` keys (`discardMessage`, `discardCancel`, `discardConfirm`) added in lockstep to `translations.ts`/`translations.en.json`/`translations.hu.json` (240→243 keys, all three files confirmed identical). The existing `idscanly.ariaClose` (`'Close'`) is reused for both new X buttons' aria-labels — no new key needed there.

**Verification:** `npm run build` clean (only the pre-existing SCSS-budget/CommonJS warnings — the two IDScanly budget overages grew slightly with the new dialog CSS but stayed warnings, not errors). Key-parity script-checked: 243/243/243 across ts/en/hu, `idscanly` namespace 60/60 in en/hu with identical key sets. **Device/browser-verified by the user** via `ionic serve --ssl --external` on phone — confirmed working.

### 2026-07-15 — IDScanly: natural-case names/mother's name/birth place (was ALL CAPS)

> Branch `idscanly-response-postprocessing`. No build/version bump, no TestFlight upload (local verification only — `npm run build` clean, new unit spec 5/5 green).

IDScanly's OCR/edge-function response returns names and places in ALL CAPS (e.g. `"TAMAS SZURMIK"`), shown as-is in the guest-detail scan-result sheet, prefilled into the guest-edit form, and saved verbatim via `POST /guests`. Regula (the other scan backend) already has a partial, buggy attempt at this (`document-reader.service.ts:694-731`, gated behind an opaque `lc_id !== 0` check) — IDScanly had none. **Scoped to IDScanly only** (Regula and already-saved legacy guest records are untouched) using **simple Title Case** — capitalize the first letter of each word, lowercase the rest; no special handling of apostrophes/hyphens/connector words (so `O'BRIEN` → `O'brien`, not `O'Brien` — a known, accepted limitation).

- **New [utils/natural-case.ts](src/app/utils/natural-case.ts)** (`toNaturalCase()`) — pure function, follows the existing `utils/text.ts`/`utils/date.ts`/`utils/hungarian-address.ts` pattern. Uses `\p{L}` (Unicode letter class, `u` flag) so accented Hungarian letters capitalize correctly (á→Á). `null`/`undefined`/`''` pass through unchanged. New [natural-case.spec.ts](src/app/utils/natural-case.spec.ts), ChromeHeadless green.
- **Follow-up same session — parenthesis handling:** real IDScanly birth-place values sometimes arrive glued to a parenthesized country, e.g. `"KECSKEMET(MAGYARORSZAG)"`. `toNaturalCase()` now normalizes to exactly one space before `(` and after `)` (regardless of what was there — missing, doubled, or already correct), and the capitalization boundary regex treats `(` as a word boundary too, so the word inside also gets capitalized: `"KECSKEMET(MAGYARORSZAG)"` → `"Kecskemet (Magyarorszag)"`. Spec grew to 7 cases (added the parenthesis case + an idempotency check on already-spaced input).
- **[idscanly-docuscan.service.ts](src/app/idscanly/services/idscanly-docuscan.service.ts) `mapToScanResult()`** — the single place IDScanly's raw fields become the `ScannedGuestDataInterface` boxes consumed by the result sheet, the edit-form prefill, and the save payload. `firstName`/`lastName` are run through `toNaturalCase()` right after extraction (so the derived `full_name` fallback join also inherits natural casing); `full_name` is also transformed when it comes straight from `f.fullName`; `mother_name` and `birth_place` boxes are transformed at their source. `maiden_name` is always `box(null)` for this mapper (no OCR field) — nothing to transform. IDScanly has no address-capture path (Hungarian address-card OCR is Regula-only) — nothing to transform there either. `document_type`/`document_number`/dates/gender/age are untouched (codes/structured data, not prose).

**Deliberately out of scope (user's call):** Regula's existing (buggy) casing attempt, and already-saved guest records that predate this fix — those still display in ALL CAPS until re-scanned via IDScanly or manually edited.

**Verification:** `npm run build` clean (only the three known pre-existing warnings — two IDScanly SCSS budget overages + the `jscanify` CommonJS bailout). `natural-case.spec.ts` 5/5 (ChromeHeadless). **Not yet device/browser-verified** — no camera/IDScanly session available in this environment; needs a real scan (or `ionic serve` with `?preview=…`) to confirm the result sheet, edit-form prefill, and saved guest all show natural-cased text.

### 2026-07-15 — iPhone-only device family (drop iPad support to satisfy App Store Connect screenshot requirement)

> **Shipped build: iOS 90 (TestFlight).**

App Store Connect blocked "Add for Review" with "You must upload a screenshot for 13-inch iPad displays" — the app has never supported iPad, but the Xcode project's `TARGETED_DEVICE_FAMILY` was `"1,2"` (iPhone + iPad / "Universal"), so App Store Connect required iPad-size screenshots for a device class the app was never built or tested for.

- **[project.pbxproj](app/ios/App/App.xcodeproj/project.pbxproj):** `TARGETED_DEVICE_FAMILY` changed from `"1,2"` to `1` (iPhone only) in both the Debug and Release build configurations (lines 363, 384) — the file-level equivalent of setting Xcode's Deployment Info → Devices dropdown to "iPhone" instead of "Universal". No other project settings touched.
- Once App Store Connect processes a build declaring iPhone-only support, the iPad screenshot requirement for this version should no longer apply — it only asks for screenshots on device classes the binary declares support for.

**Verification:** not yet confirmed in App Store Connect (requires the new build to finish processing, then re-attempt "Add for Review").

### 2026-07-15 — IDScanly submit overlay: 10-second tick-ring progress animation

> No build/version bump, no TestFlight upload (local verification only — `npm run build` clean; animation mechanics verified via headless-Chrome screenshots of a standalone reproduction, see below).

Average IDScanly recognition time is ~9.2s, but the Review page's submit overlay showed an indeterminate 10-dot chase — no sense that the wait is almost over. Replaced it with a determinate-feeling circular "watch tick" ring that fills clockwise over **10 seconds**, under a single message "Processing your documents…". An early result dismisses the overlay exactly as before (`submitting()` flips off, animation unmounts). Past 10s (backend can legitimately take up to ~30s) the full ring pulses gently and the existing "Still working — almost there…" message takes over.

- **[review.page.html](src/app/idscanly/pages/review/review.page.html):** `.submit-overlay__dots` replaced with an SVG tick ring — track + fill are the **same dashed circle** (50 ticks via `pathLength="100"` + `stroke-dasharray: 0.8 1.2`), the fill revealed by a `<mask>` whose solid stroke animates `stroke-dashoffset` 100→0. `--overtime` modifier bound to `submitStage() === 'longwait'`.
- **[review.page.scss](src/app/idscanly/pages/review/review.page.scss):** dot styles + `submit-dot-chase` keyframe deleted; new ring styles. Sweep uses `animation: submit-ring-sweep 10s steps(50) forwards` — `steps(50)` lights ticks one-by-one (~200ms each, watch-like) instead of partially revealing them; `rotate(-90deg)` starts at 12 o'clock. Overtime = `submit-ring-pulse` opacity pulse on the full ring. **The 10s duration must stay in sync with the `longwait` timer in review.page.ts** (commented on both sides).
- **[review.page.ts](src/app/idscanly/pages/review/review.page.ts):** stages collapsed `'images' | 'recognition' | 'longwait'` → `'processing' | 'longwait'` — the 2.5s "Running recognition…" split is gone (one message covers 0–10s); `startStageTimers()` keeps only the 10 000ms timer. `dotIndices` removed. `submit()`/teardown untouched; the `?preview=submitting` dev hook still drives the same signals.
- **Translations** ([translations.ts](src/app/services/translations.ts) + en/hu JSON): `idscanly.submitProcessing` → "Processing your documents…" (HU: "Dokumentumok feldolgozása…"); `idscanly.submitRecognition` deleted from all three files. Key parity re-verified: 240 = 240 = 240 across ts/en/hu.

**Verification:** `npm run build` clean (only the three known pre-existing warnings). `/idscanly/review` is behind `authGuard` (+ the new fail-closed property gating at boot), so no browser session could reach the real page here; instead the exact markup + compiled CSS were reproduced in a standalone HTML page and screenshotted with headless Chrome at virtual times 2.5s / 6s / 9.5s / 12s — confirmed: ticks light clockwise from 12 o'clock (~25% / ~60% / ~95%), full ring + "Still working" message + pulse after 10s. **Not yet verified in the real app:** an `ionic serve` pass over `?preview=submitting` with a logged-in session, and WKWebView rendering of the animated `<mask>` on device (Blink renders it fine; if WKWebView ever doesn't, the documented fallback is 50 individual tick spans with staggered `animation-delay`, like the old `dotIndices` pattern).

### 2026-07-13 — Property gating: first Go rollout wave restricted to allowlisted properties, per environment

> Branch `feat/property-gating`. No build/version bump, no TestFlight upload (local verification only — `npm run build` clean throughout; Supabase changes confirmed live via curl + MCP against the REST endpoint, not yet device/`ionic serve`-verified end-to-end).

The first backend release only supports a limited set of properties (PIDs). Previously any property a user's SabeeApp PMS account manages showed up in the post-login property picker and the in-app switcher — no way to restrict that to a rollout cohort. Added a remote allowlist on the existing Supabase `property_config` table (already used for `scan_vendor`/`scan_doc_types`/`extended_logging`), so enabling a property for Go is a one-row edit, no app rebuild. **This is a visibility/rollout gate, not a security boundary** — the backend API must still authorize every request by PID regardless of this allowlist.

**Supabase `property_config` — two new columns, one migration each, same session:**
- `go_enabled boolean not null default false` — explicit opt-in per property; a property already having a `property_config` row for language/scan-vendor reasons does not implicitly enable Go.
- `environment text not null default 'live', check (environment in ('live','test'))`, and the primary key widened from `property_id` alone to `(property_id, environment)`. Prompted by a follow-up dilemma: `property_id` can collide between the live and test SabeeApp systems (each assigns its own IDs), so a single `property_id`-keyed row was already ambiguous for the pre-existing `scan_vendor`/`extended_logging` columns too, not just the new gating column. Named `environment` (not `is_test`) with values `'live'`/`'test'` to exactly match `ApiEnvironmentService`'s existing `ApiEnvMode` type and the `api_mode` Mixpanel super-property that already models this same live/test split — zero translation needed at call sites, `apiEnv.mode()` is passed straight into the Supabase filter.
- **Known anomaly, unresolved:** right after the `go_enabled` migration (before `environment` existed), all 4 pre-existing rows read back as `go_enabled = true` via both a direct SQL `SELECT` and the live REST endpoint — despite the column's declared default being `false` and `pg_attribute.attmissingval` for the column correctly showing `{f}` (false) at the catalog level. Root cause not found (no trigger on the table, confirmed a real base table not a view, no `UPDATE` had touched `updated_at`). Did not reproduce for the `environment` column added later the same session — that one backfilled correctly to the declared default `'live'`. **User's call:** left the 4 rows as `go_enabled = true` rather than force them to `false` and re-enable manually — they're already the known IDScanly test properties (`467`, `6250`, `9345`, `9400`), so having them in wave 1 was acceptable. Flagging in case the same anomaly recurs on a future `ADD COLUMN ... DEFAULT`.
- All 4 existing rows defaulted to `environment = 'live'` (assumed PROD-system PIDs) — **not yet confirmed** whether any of them are actually TEST-system IDs that happen to share a number with a different PROD property; such a row would need a manual duplicate.

**New [property-gating.service.ts](src/app/services/property-gating.service.ts) (`PropertyGatingService`)** — deliberately a separate service from `PropertyConfigService`, not an extension of it, because the failure semantics are opposite: `PropertyConfigService.load()` fails open (any error clears the signals, scanning silently disabled) while this must fail closed (mirrors `AppConfigService`'s precedent of being its own service with its own contract). `resolveEnabledPropertyIds(propertyIds)` bulk-queries `property_config?property_id=in.(...)&environment=eq.<mode>&go_enabled=eq.true&select=property_id` via the same raw-`fetch()` + anon-key pattern as every other Supabase call in this app (no `@supabase/supabase-js`, hard constraint) and returns `null` (not an empty `Set`) on any non-OK response or thrown exception, so callers can tell "verified, nothing enabled" apart from "couldn't verify" and block rather than silently letting everyone through. `property_config.property_id` is `text`, so results are parsed back to `number` to match `PropertyInterface.property_id`.

**[property-config.service.ts](src/app/services/property-config.service.ts)** and **`PropertyGatingService`** both now inject `ApiEnvironmentService` and append `&environment=eq.${apiEnv.mode()}` to their queries — contained entirely inside the two services, no call-site changes needed anywhere else.

**[auth.ts](src/app/services/auth.ts) (`AuthService`)** — new `goEnabledPropertyIds` signal (the resolved allowlist, cached for the session so the in-app switcher doesn't re-hit Supabase on every open — user's explicit call: reuse the cached list rather than live-reverify on switch, since a newly enabled/disabled property should take effect on next login, not mid-session) with `setGoEnabledPropertyIds()` setter, cleared on `logout()`. New `clearSelectedProperty()` — evicts just the active property (keeps the session authenticated), used when the boot-time gate finds the restored property no longer allowed.

**Two new blocking pages**, cloned from the existing `update-required` pattern (centered icon, title + message, no back nav, no guard):
- **[pages/go-unavailable/](src/app/pages/go-unavailable/)** (`/go-unavailable`) — "SabeeApp Go isn't available for you yet — contact SabeeApp support." Reached when the resolved allowed-set is empty.
- **[pages/service-unavailable/](src/app/pages/service-unavailable/)** (`/service-unavailable`) — "Unable to verify access — check your connection and try again," **plus a Retry button** (unlike `update-required`, this is a transient-network state, not a durable policy state; Retry does a full `window.location.reload()`, re-running the whole boot sequence). Reached when `resolveEnabledPropertyIds` returns `null` (Supabase unreachable) — per the user's fail-closed decision: **no login or session-restore possible without Supabase.**

New `goGating` i18n namespace (4 keys) added in lockstep to [translations.ts](src/app/services/translations.ts), [translations.en.json](src/app/services/translations.en.json), [translations.hu.json](src/app/services/translations.hu.json) — key-parity confirmed (241 = 241 keys, en/hu). Both new routes registered in [app.routes.ts](src/app/app.routes.ts), no guard, same shape as `update-required`.

**Three integration points:**
- **[property-select.page.ts](src/app/pages/property-select/property-select.page.ts) `loadProperties()`** — after `auth.loadProperties()`, resolves the allowlist for the fetched PIDs: `null` → `/service-unavailable`; empty → `/go-unavailable`; otherwise filters the rendered list to the allowed IDs and caches the set on `auth`.
- **[app.component.ts](src/app/app.component.ts) boot sequence** — a restored session with an active property is the boot-time equivalent of login, so it's re-verified the same way (using the already-restored cached `auth.properties()`, no extra PMS call) before falling through to `/home`: unreachable → `/service-unavailable`; empty → `/go-unavailable`; restored property no longer in the allowed set → `auth.clearSelectedProperty()` + `/property-select`; otherwise proceeds as before. Runs only when both a token and a selected property were restored — an authenticated user with no property still goes straight to `/property-select`, which does its own gating.
- **[home.page.ts](src/app/home/home.page.ts) `filteredProperties`** — the in-app switcher list is filtered to `auth.goEnabledPropertyIds()` before the existing text-query filter applies; a missing allowlist (shouldn't happen once `/home` is reachable) fails closed to an empty list rather than showing everything.

**Verification:** `npm run build` clean throughout (only the three pre-existing known warnings). Both Supabase migrations confirmed live via MCP (`list_tables`, `pg_attribute`/`pg_constraint` introspection) and via direct `curl` against the real REST endpoint — confirmed a property resolves under `environment=eq.live` and returns empty under `environment=eq.test` (correct system isolation). End-to-end gating behavior (row editable only via Supabase Studio's row-editor panel, not inline grid, for primary-key columns) confirmed working live by the user via the Studio UI. **Not yet done:** a full `ionic serve`/device pass through all four gating branches (service-unavailable + retry, go-unavailable, filtered picker, evicted-session-restore) — no browser session available in this environment.

### 2026-07-12 — Production-readiness review follow-through: PII log cleanup, idrecognition auth hardening, IDScanly camera-failure Sentry reporting

> Branch `rc10-cleanup`. No build/version bump, no TestFlight upload (local + Supabase-deploy verification only — `npm run build` green throughout).

Follow-up to a full-app production-readiness review. Four items closed:

- **PII removed from console.log in the native Regula scan pipeline** ([regula/services/document-reader.service.ts](src/app/regula/services/document-reader.service.ts), [regula/pages/id-scan/id-scan.page.ts](src/app/regula/pages/id-scan/id-scan.page.ts), [regula/services/docuscan.ts](src/app/regula/services/docuscan.ts), [regula/services/docuscan.service.ts](src/app/regula/services/docuscan.service.ts)): 17 unconditional `console.log`/`.error` call sites dumping guest name/DOB/document number/mother's maiden name/full scan results were removed — these fed Sentry's default breadcrumb capture (`sendDefaultPii: true` in `main.ts`) regardless of `Config.SCAN_DEBUG_LOGGING`, so this PII was very likely already riding along on unrelated error reports. Also gated the three `console.*(consolePayload)` calls inside `logScanOutcome()` (which carry the full mapped scan result + raw SDK result) behind the same `Config.SCAN_DEBUG_LOGGING` flag the rest of that function already respects — previously only the Sentry Logs half was gated, the bare console output wasn't.
- **`idrecognition` Supabase Edge Function hardened against unauthenticated abuse** (deployed source only, not in this repo; client change in [idscanly/services/idrecognition.service.ts](src/app/idscanly/services/idrecognition.service.ts)): the function previously trusted nothing but the public Supabase anon key — trivially extractable from any installed Capacitor build (unzip the `.ipa`/`.apk`, the JS bundle ships unencrypted). Now requires, before any IdScanly usage is incurred: (1) a live SabeeApp session — the client sends its access token + device id + `isTest` flag, the function calls SabeeApp's own `/users/me` against one of two hardcoded (never client-supplied) hosts; (2) the claimed `property_id` must have `property_config.scan_vendor = 'idscanly'`. Both checks fail closed. **Bug found during live device testing:** the first deploy used a placeholder `Device-Id` in the `/users/me` call and rejected valid sessions — SabeeApp's API ties token validation to the device the token was issued to. Fixed by passing the client's real `auth.deviceId()` through. Confirmed working end-to-end on property `6250` via LAN HTTPS (`ionic serve --ssl --external`) from a real phone.
- **IDScanly camera/OpenCV start failures now reported to Sentry** ([idscanly/services/document-detection.service.ts](src/app/idscanly/services/document-detection.service.ts)): `requestCamera()` and `cvLoader.getScanner()` failures already had solid user-facing error handling (retry with relaxed constraints, translated error messages) but zero Sentry visibility. Both now `Sentry.captureException` with a context tag + error name, so a real WKWebView/`getUserMedia` reliability issue (flagged as unresolved in the IDScanly migration guide) would surface with a stack trace instead of silence if it fires on a real device. Torch-toggle failures deliberately left unreported (documented best-effort, no-ops on devices without a torch — not worth Sentry noise). **Does not fix the underlying reliability question** — that still needs a real iOS build tested on-device, not just a browser/LAN test.
- **CLAUDE.md changelog history split correctly between the two files**: Sessions 4-23 (2026-05-18 – 2026-06-06), which were Angular-app history but had been logged in the root `SabeeAppGO/CLAUDE.md` (a file whose actual scope is the `Design/` HTML/React prototype), moved into this file's own changelog in chronological order (see below). Each file's top now states its scope explicitly.

**Found but not yet actioned (flagged to the user, awaiting a decision):**
- `property_config` currently has IdScanly enabled on **4 properties** (`6250`, `9345`, `467`, `9400`), not just the one original test property assumed during the review. The three unresolved IDScanly risks above (WKWebView/`getUserMedia`, back-nav camera reacquire, undertuned capture-completeness thresholds) are live for real staff at all four.
- Property `9345`'s `scan_vendor` value has a literal trailing newline (`"idscanly\n"`) — a likely paste artifact. Since the edge function's (and possibly the client's, unverified) vendor check uses strict `===` equality, this property may currently be silently rejected from IdScanly despite being configured for it. Not yet fixed at the data level or by making the comparison trim defensively.
- Dead duplicate `LanguageService` (`services/languages/language.service.ts` + its `translations.ts` sibling, zero imports anywhere) — flagged as safe to delete, not yet done.

**Verification:** `npm run build` clean throughout (only the three pre-existing warnings). Edge function changes confirmed live via Supabase logs + one real device scan on property `6250`. Sentry wiring is code-only, not yet exercised by a real camera failure.

### 2026-07-11 — IDScanly: wired up i18n (the whole scan/review flow was hardcoded English)

> No build/version bump, no TestFlight upload (local verification only — `npm run build` green). Follow-up to the earlier same-day translation fix above, but a separate bug: IDScanly (added 2026-07-04, after the 2026-06-09 "i18n wired into the UI" session) was built entirely after that session and never went through it — reported as "the new scan via idscanly doesn't have translation strings."

**Root cause:** every user-facing string in `src/app/idscanly/` (scan camera screen, review/submit screen, document-type labels) was a plain string literal — zero `| tr` pipe usage, zero `idscanly.*` keys in the translation files, confirmed by grep before starting.

- **New `idscanly` namespace** (58 keys) added in lockstep to [translations.ts](src/app/services/translations.ts) (runtime English fallback), [translations.en.json](src/app/services/translations.en.json) (API hand-off spec), and [translations.hu.json](src/app/services/translations.hu.json) (best-effort Hungarian hand-off draft — same "not certified" caveat as the rest of that file). Key-parity checked by script (237 keys, identical key sets, across all three files).
- **[document-type.ts](src/app/idscanly/models/document-type.ts):** `DocumentTypeConfig.label` and the optional `scanningMessage` are now **translation keys** (e.g. `idscanly.docTypeIdCard`), not display text — documented inline on the interface. Every consumer resolves them via `LanguageService.t()` / the `tr` pipe before display.
- **[scan.page.ts](src/app/idscanly/pages/scan/scan.page.ts) / [.html](src/app/idscanly/pages/scan/scan.page.html):** `pageTitle`/`message`/new `flipCardLabel` computeds now build translated strings (camera guidance, glare/dark warnings, turn-card prompt, per-type scanning message); `ORDINALS` (`'1st'`/`'2nd'`/…) became `ORDINAL_KEYS` resolved per-language (Hungarian gets `'1.'`/`'2.'` ordinal notation instead of an English ordinal suffix). Template: shutter/torch/auto-capture aria-labels, "Tap to capture", "AUTO", the manual-capture nag dialog (message + both buttons), the "Starting scanner…" loader text, and the back button now all go through `| tr`.
- **[document-detection.service.ts](src/app/idscanly/services/document-detection.service.ts):** camera/OpenCV error strings (`describeError()`) and capture-quality summary fragments (`buildQuality()` — "Sharp, well-lit, glare-free" / "could be sharper" / "too dark" / "glare detected" / the two incomplete-capture messages) now resolve through an injected `LanguageService`. These feed both the Scan screen's error overlay and the Review screen's per-side quality line, so this one service change covers both screens.
- **[review.page.ts](src/app/idscanly/pages/review/review.page.ts) / [.html](src/app/idscanly/pages/review/review.page.html):** `images` (Front/Back side labels), `captureSummary` (singular/plural split into two full keys — no ICU pluralization in this codebase, matches the existing pattern), `footerNote`, `submitStageMessage` (the 3 timed submit stages), and a new `lightboxCaption` computed are all translated. Template: header title, Good quality/Recheck pills, "Ready to submit", Retake button, empty state, lightbox aria-labels, the submit-overlay privacy note, and the Submit button (reuses `common.submit`) — all via `| tr`. The two thrown-error strings (`'Session context missing…'`, the generic catch-all) are translated too, reusing `errors.generic` for the latter (same English text already existed as a key).
- **[idscanly-docuscan.service.ts](src/app/idscanly/services/idscanly-docuscan.service.ts):** the `documentData.document_type` display-only fallback (`f.documentType ?? documentType.label`) now translates `documentType.label` before use — required because that field changed from plain text to a translation key; left untranslated it would have regressed by writing a raw key string (e.g. `idscanly.docTypeIdCard`) into a field that used to correctly fall back to readable English.
- **[guest-detail.page.html](src/app/pages/guest-detail/guest-detail.page.html):** the "Select Document Type" sheet (the entry point into the IDScanly flow, opened from the guest-detail FAB) — title and the `type.label` list items — now translated. `TranslatePipe` was already imported on this page from the earlier i18n session.
- **Deliberately left English (scope decision):** the dev/QA "Show debug"/"Hide debug" toggles and their raw diagnostic readouts (`found Y/N`, `ratio 1.2`, `lum 130`, etc.) on both screens — these are calibration tooling for tuning `capture-tuning.ts` against real footage, not staff-facing product copy, consistent with how the changelog already describes them ("Dev/QA toggle... mirrors the Scan page's debug overlay"). Also left alone: `guestDetail.docTypeName()`'s friendly-label map (Passport/ID Card/Driving Licence/…) — it's shared with the pre-existing Regula flow and predates IDScanly; flagging it here as a **known pre-existing gap** but out of scope for an "idscanly.*" fix. The `Male`/`Female` gender normalization in `idscanly-docuscan.service.ts` is intentionally-untranslated **data**, not display text — it mirrors Regula's identical `'M'→'Male'` mapping (`document-reader.service.ts:740`) and matches the API's own gender enum; translating it would break matching against `options.genders()`.

**Verification:** `npm run build` clean (only the three pre-existing warnings: the two IDScanly SCSS budget overages and the `jscanify` CommonJS bailout — none new). Key-parity script confirms all three translation files carry identical `idscanly.*` key sets. **Not yet device/serve-verified:** a live non-EN language switch through the actual camera scan → review → submit flow (needs a browser session with camera access, not available in this environment).

### 2026-07-11 — Fix: Home screen arrivals heading couldn't be translated correctly (Hungarian grammar)

> No build/version bump, no TestFlight upload (local verification only — `npm run build` green, verified live in `ionic serve`). Branch: none (committed directly to `main`, matching the previous session's pattern for small no-build-bump changes).

**Reported:** the Home screen's day-tab section heading ("Today's Arrivals") translated into Hungarian as "Érkezések – Ma" — grammatically foreign. The idiomatic Hungarian is "Mai érkezők", which requires the day word itself to change form (Ma → **Mai**, an adjectival suffix) and a different noun for "arrivals" (*érkezők*, not *Érkezések*) than the one already used for the tab label. No `{{day}}`-slot interpolation can produce that, because the inserted word needs a different grammatical form depending on which sentence it's dropped into.

- **[translations.ts](src/app/services/translations.ts) / [translations.en.json](src/app/services/translations.en.json) / [translations.hu.json](src/app/services/translations.hu.json):** replaced the templated `home.arrivalsHeading` (`"{{day}}'s Arrivals"`) and `home.noArrivalsFor` (`"No arrivals for {{day}}"`) keys with six full, standalone keys — `arrivalsHeadingYesterday/Today/Tomorrow` and `noArrivalsYesterday/Today/Tomorrow` — following the "one full key per variant" pattern already established elsewhere in this file (`login.errIncorrect`/`errNoInternet`/`errGeneric`; `guestDetail.scanTimedOut`/`scanCancelled`/etc.). Each language now writes a complete, natural sentence per day-state instead of filling a shared slot.
- **[home.page.ts](src/app/home/home.page.ts) / [home.page.html](src/app/home/home.page.html):** the heading and empty-state now select the full key by string-concatenating the key *name* with `tab()` (`('home.arrivalsHeading' + tab()) | tr`), mirroring the existing tab-button pattern (`('home.' + t.toLowerCase()) | tr`) rather than interpolating a translated *value* into another translated string. Removed the now-unused `dayLabel` computed, the `LanguageService` injection, and the `LowerCasePipe` import (all only existed to feed the old `{{day}}` param).
- **Key mechanism reconfirmed while debugging a follow-up report ("Tomorrow" tab not translating):** `translations.en.json`/`translations.hu.json` in this repo are **not read by the running app at all** — grepped, no import/fetch reference anywhere in `src/app`. They exist purely as a hand-off spec for the SabeeApp API's translation content (the live `/languages` endpoint, merged over the bundled English `translations.ts` fallback, is the actual runtime source — see `LanguageService.fetchLanguages()`). The "Tomorrow" segment-tab bug turned out to be exactly that: the user manages the API-side translation content directly and had just added the Hungarian `home` namespace entries, but missed the `tomorrow` key — confirmed **no frontend code was at fault** (the tab-label lookup is identical for all three tabs).
- **Out of scope, flagged only:** two lower-risk instances of a similar "translated fragment + hardcoded/quoted value" pattern exist — `search.page.html:60` (`'search.noResults' | tr` + a raw quoted query string) and `guest-detail.page.html:32` (`'guestDetail.id' | tr` + hardcoded colon + raw value). Neither has a reported bug; left alone to avoid scope creep.

**Verification:** `npm run build` clean (only the pre-existing IDScanly SCSS-budget/CommonJS warnings). Manually verified in `ionic serve` (localhost:8100) against a live logged-in session ("Demo Boutique Hotel"): English heading correct across all three tabs; Hungarian heading now reads "Mai érkezők"/"Tegnapi érkezők"/"Holnapi érkezők" once the corresponding API content existed. Hungarian wording for the new keys is a best-effort draft (not a certified translation) — same caveat as every other `.hu.json` entry.

### 2026-07-08 — Remote language allowlist via Supabase `app_config.languages` + `property_settings` → `property_config` rename

> No build/version bump, no TestFlight upload (local verification only — `npm run build` green). Two related Supabase-driven changes made together.

**Remote language restriction.** The Login dropdown and Settings language picker previously always offered all 7 bundled languages (`En, Hu, De, Tr, Fr, Lv, Es` — the codes the SabeeApp `/languages` endpoint's `Language[]` uses), with no way to hide one remotely. Added a `languages text[] not null default array['En','Hu','De','Tr','Fr','Lv','Es']` column to Supabase `app_config` (one row per platform, same table the minimum-version gate already uses) — an admin can now shrink a platform's row to restrict the picker without an app rebuild.

- **[language.service.ts](src/app/services/language.service.ts):** new `enabledLanguages = signal<string[] | null>(null)` (`null` = no restriction / fetch not yet resolved — fail-open, same philosophy as the version gate: "a degraded backend can't lock everyone out"). New `fetchEnabledLanguages()` mirrors `PropertyConfigService`'s raw-`fetch()`-against-PostgREST pattern exactly (`GET {supabaseUrl}/rest/v1/app_config?platform=eq.{ios|android}&select=languages`, anon-key headers) — no `@supabase/supabase-js`, consistent with the IDScanly-session hard constraint. Codes are run through the existing private `normalize()` so a case mismatch against the API's codes can't silently defeat the filter. Cache-hydrated from `StorageService` (`enabledLanguages` key) in `init()` the same way `cachedLangs`/`cachedTranslations` already are, so cold start doesn't flash the unfiltered list before the network fetch resolves. `displayLanguages` now filters the list down to the enabled codes, with a safety fallback to the unfiltered list if the intersection would ever be empty (never let a bad remote config brick language selection).
- **[settings.page.ts](src/app/pages/settings/settings.page.ts) `openLangPicker()`:** now also calls `fetchEnabledLanguages()` alongside the existing `fetchLanguages()` refresh, so toggling the Supabase row takes effect without an app restart.
- **No template changes** — both consumers (`login.page.html`'s `<select>`, `settings.page.html`'s picker sheet) already read the one `displayLanguages` computed signal.
- **Decided (user):** if a user's already-selected language becomes disabled remotely, their active selection is left alone — only the *picker list going forward* is restricted, no forced language switch.
- Went through `PropertyConfigService`'s established pattern rather than the `config` Edge Function used by the boot-blocking version gate — that function is narrow-purpose/launch-critical and `app_config` already has a public-read RLS policy the anon key can query directly, so no Edge Function redeploy was needed for this half.

**`property_settings` → `property_config` rename (Supabase table + app).** Prompted by reviewing the above: `app_config` and `property_settings` used inconsistent terminology for the same kind of thing — remote control-plane values ops/engineering toggles (version gate, language allowlist, scan vendor), not end-user preferences. Picked "config" over "settings" partly to avoid confusion with the app's own in-app Settings page (profile/language/logout). An unrelated `property_config` table from a different, host_id-keyed schema previously occupied that name in the same Supabase project; the user cleaned it up first, freeing the name.

- `alter table public.property_settings rename to property_config` — plain catalog rename, RLS policy (`"Allow read from app"`) and data preserved automatically (confirmed via `pg_policies` post-rename).
- The `config` Edge Function (deployed source, not in this repo) updated: `.from('property_settings')` → `.from('property_config')`, response key `property_settings` → `property_config` (redeployed as v2). This data is presently unused/dead in `AppConfigService.runVersionGate()` (only `app_config.minimum_version` is read there), so the redeploy is behaviorally inert — just keeping the contract consistent.
- App-side: [property-config.service.ts](src/app/services/property-config.service.ts) REST URL + comment updated to `property_config`; [app-config.ts](src/app/services/app-config.ts)'s `fetchConfig()` return-type field renamed `property_settings` → `property_config` to match; a stray comment in [review.page.ts](src/app/idscanly/pages/review/review.page.ts) updated. **No TS class/file renames** — `PropertyConfigService`/`property-config.service.ts` was already named "config," not "settings," so this rename actually makes the TS naming finally match what it queries.

**Verification:** `npm run build` clean (only the pre-existing IDScanly SCSS-budget/CommonJS warnings). Both Supabase changes confirmed live via `curl` against the anon-key REST endpoints and the redeployed edge function (`property_config` reachable with real data, old `property_settings` path now 404s, edge function returns the renamed key). Language restriction verified by temporarily narrowing the `android` row to `{En,Hu}` and confirming the exact REST call `LanguageService.fetchEnabledLanguages()` makes returns that filtered set — not yet visually confirmed in a running `ionic serve`/device session (no browser session available in this environment). Both `app_config` rows are back to the full 7-language default post-verification.

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

> The entries below (Sessions 4-23, 2026-05-18 through 2026-06-06) were originally logged in the root `SabeeAppGO/CLAUDE.md` before that file's scope was narrowed to the `Design/` prototype only. Moved here so this app has one continuous changelog.

### 2026-06-06 — Session 23 (current) — Data freshness: stale-while-revalidate + pull-to-refresh on reservation detail

> Note: All changes are in the Angular/Ionic app (`app/`). Branch `Data-Freshness-SWR`. No build/upload (local verification only — `npm run build` green, `ionic serve` running).

Mitigates the staleness diagnosed in Session 20's caching Q&A (no API changes possible). The app is 100% pull-based; two problems were addressed: the reservation list's 60s gate flashed a list-replacing spinner on every real re-fetch, and the **guest cache had no expiry** (a PMS-side guest change never surfaced for the rest of the session). Approach: silent **stale-while-revalidate (SWR)** with a **60s window for both reservations and guests** — cache serves instantly, a background re-fetch fires at most once/60s, an in-flight lock dedups concurrent calls. The 60s number is unchanged (already in production for reservations); the wins are flicker-free refresh, a *finite* guest TTL, header refresh on back-navigation, a force-fresh-before-edit guard, and pull-to-refresh on the detail screen.

- **[services/reservation.ts](app/src/app/services/reservation.ts):** `fetchReservations()` gained an in-flight lock (`_inFlight`) and now toggles `_loading`/`_error` **only on the empty first load** (`showSpinner = _reservations().length === 0`) — re-entry/pull-to-refresh on a populated list revalidates silently (the list signal is never cleared, so old data stays visible). `fetchGuests(code, force=false)` gained a 60s TTL (`GUEST_STALE_MS` + `_guestFetchedAt` map) and a per-`reservationCode` in-flight lock (`_inFlightGuests`) — fixes the infinite stickiness and collapses the reservation→guest drill-down to one request. New synchronous `peekGuests(code)` for instant first paint. `clear()` clears `_guestFetchedAt`; `updateGuest()` deletes its timestamp too.
- **[reservation-detail.page.ts](app/src/app/pages/reservation-detail/reservation-detail.page.ts) / [.html](app/src/app/pages/reservation-detail/reservation-detail.page.html):** fetch moved from `ngOnInit` → `ionViewWillEnter` (so back-navigation refreshes the header — `ngOnInit` doesn't re-run on Ionic re-entry). Seeds from cache (`reservations().find` + `peekGuests`) for instant paint, sets `loading` only when nothing is shown yet; `fetchDetail` is always-uncached (fresh header every visit), guests are SWR-gated. Removed the now-redundant booker-name sync block. **Pull-to-refresh added** (`ion-refresher` + `handleRefresh`, mirrors home): force-fetches `fetchDetail` + `fetchGuests(code, true)` for **the given reservation's guests** — and because that overwrites the shared `_guestCache`, the Guest Details screen shows the refreshed data afterwards. Session-20 global `ion-refresher` notch offset already applies (no new CSS).
- **[guest-detail.page.ts](app/src/app/pages/guest-detail/guest-detail.page.ts):** `loadGuest()` reworked to SWR — paints the cached guest via `peekGuests` instantly, sets `loading` only when `!guest()`, then refreshes silently. Removes the every-entry spinner blank.
- **[guest-edit.page.ts](app/src/app/pages/guest-edit/guest-edit.page.ts):** the `ngOnInit` load is now `fetchGuests(code, true)` — the edit form always starts from the latest server copy (bypasses the 60s window), guarding against editing/overwriting a stale guest. Covers both entry paths (guest-detail FAB and scan-result edit).

**Trade-offs / out of scope:** `fetchDetail` runs once per detail entry (intended). Idle-on-screen still won't auto-update (no timer) — freshness is on navigation + pull-to-refresh. 60s windows are tunable constants.

**Verification:** `npm run build` passes (only the known `global.scss` Sass `@import` deprecation). Not yet device/serve-verified by hand: open the Network tab on `ionic serve` to confirm no spinner flash on re-entry, 60s dedup, single `guests` call on drill-down, fresh `guests` on Edit, and fresh `reservations/details` + `guests` on pull-to-refresh.

### 2026-06-05 — Session 22 — Accent-insensitive reservation search

> Note: All changes are in the Angular/Ionic app (`app/`). Branch `Improve-guest-search`. No build/upload (local verification only).

**Search now folds diacritics so `Tamas` matches `Tamás`.** The search-screen filter compared with only `.toLowerCase()`, so accented and unaccented letters were distinct — a booker named `Tamás` couldn't be found by typing `tamas`.

- New [utils/text.ts](app/src/app/utils/text.ts) `normalizeText()` — `NFD`-decompose, strip combining marks (`/[̀-ͯ]/g`), lowercase; `null`/`undefined` → `''`. Spec [text.spec.ts](app/src/app/utils/text.spec.ts) (5 tests, ChromeHeadless green).
- Wired into the `results` computed in [search.page.ts](app/src/app/pages/search/search.page.ts) — every `.toLowerCase()` (query + `reservation_code`, booker first/last name, email) swapped for `normalizeText()`. Match semantics unchanged (startsWith-per-word on names + full name, `includes` on email).

**Out of scope (deferred):** searching *within guests* (not just the booker). The reservations list only carries the booker; guests load per-reservation via `/guests`, so a client-side prefetch would fan out to one call per reservation — not viable at hundreds of reservations. The right fix is server-side (guests inline in the list response, or a dedicated guest-search endpoint).

**Verification:** `npm run build` passes (only the known `global.scss` Sass `@import` deprecation); `text.spec.ts` 5/5. Manual: a `Tamás` booker is found by typing `tamas`; code/email search and the <3-char hint still work.

### 2026-06-05 — Session 21 — Address card scan fills address only (not an ID document) + property filter by ID

> Note: All changes are in the Angular/Ionic app (`app/`). Branch `Improve-Property-Selector`. **Shipped builds: iOS 76→77 (TestFlight, processing), Android versionCode 19→20 (signed AAB `sabeeapp-go-v20.aab`, built — manual Play Console drag-drop, not auto-uploaded).** Both builds bundle the two changes below.

**Address card (lakcímkártya) is no longer treated as an identity document.** Reported issue: scanning a Hungarian address card filled the guest's identity fields (name, etc.) and lit the "scanned ID document" indicators — but an address card is not a person-identifier. Now an address-card scan fills **only** the address section and never counts as a scanned ID. **Hard requirement (user):** the `POST /guest` payload's `scanned_data` section must never carry address-card data — on save it stays exactly as the guest already had it (prior real ID scan record, or `null`); address data goes only into the guest's flat `address` object.

- **Classify once at scan production** ([document-reader.service.ts](app/src/app/services/document-reader.service.ts) `processResults`): new `Config.ADDRESS_CARDS = [183]` (`DocumentType.AddressCard`, kept out of the identity lists so it isn't mislabeled "id"). When the detected type is an address card, set `documentData.is_identity_document = false`, capture the address, then `stripToAddressFields()` deletes every non-`address_*` key (incl. the seeded `doc_reader_scanned_document_id`) and the identity post-processing (`alterPersonalData`/`fixNameFields`/`fixCountryAndCitizenshipFields`) is skipped. So the emitted scan result carries nothing identity-like — the result sheet's identity `@if` blocks hide automatically; only the Address section (and the informational detected-type row) render. New `is_identity_document?: boolean` on `DocumentData` ([statistics-interface.ts](app/src/app/models/statistics-interface.ts); `undefined` ⇒ treat as identity, so identity docs and preview are unaffected).
- **Save path** ([guest-detail.page.ts](app/src/app/pages/guest-detail/guest-detail.page.ts) `processScanResult('save')`): for an address card, reuse the existing per-field address merge (`scannedDataToGuestScannedData` + `fillGuestDataFromScannedData`, which only touches `guest.address`), then **restore the original `scanned_data`** so `updateGuest`'s payload `scanned_data` is unchanged. Identity docs unchanged.
- **Edit path** ([guest-edit.page.ts](app/src/app/pages/guest-edit/guest-edit.page.ts) `ngOnInit`): no longer reassigns `found.scanned_data` for address cards (it prefills the form from a local copy instead), so `save()`'s `...g` spread sends `scanned_data` unchanged. Address form fields still prefill from `scanned.address`.
- Net: the reservation-detail scan icon (`@if (g.scanned_data)`) and guest-detail "Scanned: Yes/No" row stay **No** for address-card-only guests; order-independent (an ID scan + an address card keeps Scanned: Yes and updates the address; vice-versa preserves the address). `id-scan.page.ts` is dead since Session 10 — out of scope.

**Property selector — filter by property ID.** The property filter (home Switch-Property sheet + post-login Select-Property screen) now also matches `String(p.property_id)`; placeholder updated "Filter properties…" → "Filter by name or ID…" ([home.page.ts](app/src/app/home/home.page.ts), [home.page.html](app/src/app/home/home.page.html), [property-select.page.ts](app/src/app/pages/property-select/property-select.page.ts), [property-select.page.html](app/src/app/pages/property-select/property-select.page.html)).

**Verification:** `npm run build` passes (only the known `global.scss` Sass `@import` deprecation). **Device-verify required** (Regula is native-only): scan a HU address card → result sheet shows only the address; Save → `guest.address` populated, scan icon off, "Scanned: No"; then regression-check that a passport/ID still fills identity + "Scanned: Yes". Property-ID filter is verifiable in-browser.

### 2026-06-04 — Session 20 — Pull-to-refresh notch fix + scanned birth-date fix + scan-icon fix; RFID NFC failure diagnosed

> Note: All changes are in the Angular/Ionic app (`app/`). **Shipped builds: iOS 76 (TestFlight, processing), Android versionCode 18→19 (signed AAB `sabeeapp-go-v19.aab`, built — manual Play Console drag-drop, not auto-uploaded).** All three fixes below are bundled into 76/v19.

**Pull-to-refresh spinner was hidden under the notch.** With the `black-translucent` status bar + `viewport-fit=cover`, `ion-content` extends under the notch and is set to `--padding-top: 0`. Ionic's `ion-refresher` is `position: absolute; top: 0; height: 60px` with the spinner centered, so it rendered inside the notch region. Fix: one global rule in [sabeeapp-design.scss](app/src/theme/sabeeapp-design.scss) (next to the `ion-content` block) — `ion-refresher { top: calc(env(safe-area-inset-top, 0px) + 16px); }`. The 16px on top of the inset yields ≈30px of clear space above the spinner (the box already has ~14px slack above the 32px spinner). Covers both refresher pages (home + briefing). `env()` written directly in the value per the safe-area rule. iOS-/notch-only; Android/browser see inset 0 → no visible change.

**Scanned birth date never filled the edit form / scan result sheet — date-format token bug.** The Regula reader was configured `processParams.dateFormat = 'yyyy-mm-dd'` ([document-reader.service.ts](app/src/app/services/document-reader.service.ts#L124)). Lowercase `mm` is **minutes**, not month (`MM`) — a date has no time, so Regula emitted an invalid string like `1985-00-22` (month `00`). Both consumers silently reject it: the scan result sheet's `| localizedDate` (`new Date()` → `—`) and the edit form's strict `<input type="date">` (needs `YYYY-MM-DD`). In-browser previews always looked fine because `MOCK_SCAN_RESULT` hardcodes a clean ISO date — only real device scans hit it. **Fixes:** (1) `dateFormat` → `'yyyy-MM-dd'` (root cause; fixes all Regula-formatted date fields). (2) Defensive `toInputDate()` normalizer ([utils/date.ts](app/src/app/utils/date.ts) + [date.spec.ts](app/src/app/utils/date.spec.ts), 7 tests) wired into the scanned birth-date prefill in [guest-edit.page.ts](app/src/app/pages/guest-edit/guest-edit.page.ts) — coerces ISO / ISO-with-time / `dd.mm.yyyy` / `dd/mm/yyyy` to strict `YYYY-MM-DD`, rejects impossible dates, returns `''` to fall back. Native-only (Regula + `isNativePlatform()` guard) → device-verify on 76/v19.

**Scan (ID-card) icon showed on guest cards that were never scanned.** The reservation-detail card icon (`@if (g.scanned_data)`, [reservation-detail.page.html:110](app/src/app/pages/reservation-detail/reservation-detail.page.html#L110)) and the guest-detail "Scanned: Yes/No" row both do a bare truthy check on `scanned_data`. The boundary mapping was `scanned_data: g.scanned_data ?? null` ([reservation.ts](app/src/app/services/reservation.ts#L164)) — `??` only nulls literal `null`/`undefined`, so the API's non-null **placeholder** (structure present, all fields one level down `null`) stayed truthy and lit the icon. User confirmed the API returns exactly such a placeholder. **Fix:** normalize once at the boundary in `convertGuest` via a new private `hasScanRecord(sd)` that keys on a non-empty `doc_reader_scanned_document_id` (the real "a scan happened" marker — what scan-statistics keys on); `scanned_data` becomes `null` unless a real scan record exists. Fixes both display sites with no template changes; robust to `{}`, all-null, `id: 0`/`""`. No regression to scan-prefill (guest-edit overwrites `scanned_data` from the live `lastScanResult` first).

**RFID NFC chip read failing on Hungarian ID — diagnosed via Sentry, not yet fixed.** A complaint that RFID ID scan (which "worked in the past") now finishes the Regula screen then appears to loop. Sentry Logs (project `sabeeappgo`, 7d) show: 15 `scan finished` (mostly 2026-06-03, success) vs. today's failures — all with `doRfid: true`. Two modes: (a) dominant **iOS CoreNFC "Session invalidated unexpectedly"** (`actionKey: ERROR`, `isReadingRfid: false`, null results) firing ~1 min apart at the end = repeated retries each dying the same way (the perceived "loop"; the manual-multipage advance is actually capped at `MAX_PAGES = 3`); (b) a **TIMEOUT** with `overallStatus: { optical: 1, rfid: 2 }`, `morePages: 1`, `chipPage: 0` — **optical reads fine, the chip read does not.** These are Logs only (no JS Issue/stack — it's a native NFC failure). **Key finding: no scan/RFID/NFC code changed since build 71** (where RFID was device-verified working) — `git log be62f3a..HEAD` on `document-reader.service.ts` / `docuscan.ts` / `App.entitlements` / `Info.plist` / `publish-ios.sh` shows only the Mixpanel/icons commit (untouched scan path); today's only scan-service edit is the `dateFormat mm→MM` string. So this is **environmental** (iOS-version NFC change, a stale/again-started NFC session, or a provisioning/entitlement gap in the installed build), not a code regression. Logs don't carry build/release or iOS version. See Up Next for the proposed graceful-fallback + on-device diagnosis.

**Verification:** `npm run build` passes (only the known `global.scss` Sass `@import` deprecation). `date.spec.ts` 7/7 (ChromeHeadless). The birth-date and scan-icon fixes need device/API verification on 76/v19; the refresher fix needs an on-device/notch check. RFID failure is unresolved (diagnosis only).

### 2026-06-03 — Session 19 — Mixpanel product analytics + new app icon/splash/logo

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
- `TranslatePipe` — `{{ 'ns.key' | tr }}` syntax (pipe name is `tr`; wired into all templates in app Session 2026-06-09)
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

# SabeeApp Go — Developer Handoff
## For the Ionic/Angular developer adding the communication & data layer

> This document describes every screen in the React prototype, what data it needs, what actions it triggers, and exactly where to hook in real API calls. Read `CLAUDE.md` first for the full design system context. This document focuses purely on the data contract.

---

## 1. How the Prototype Works Today

The current prototype is a **React 18 / Babel Standalone** single-page app built from source files in this folder. It has zero network calls. All data lives in `data.js` as hardcoded JavaScript constants. The purpose of this prototype was to establish and validate the UI/UX — navigation flows, screen layouts, component behaviour, and visual design.

Your job is to replace every hardcoded constant and fake interaction with real API calls, while preserving the screens, visual design, and UX behaviour described here.

The prototype's source files are:
```
data.js              → all hardcoded data — your primary reference
login-screen.js      → LoginScreen, MFAScreen
property-screen.js   → PropertySelectScreen
home-screen.js       → HomeScreen
arrivals-screen.js   → ReservationDetailScreen (also dormant ArrivalsScreen)
detail-screens.js    → GuestDetailScreen, EditGuestScreen, SearchScreen, IDScanScreen
app.js               → navigation, BlockDateScreen
```

---

## 2. Data Models

These are the TypeScript interfaces derived directly from the prototype's hardcoded data. Define these in your Angular services/models.

```typescript
// ─── Auth ────────────────────────────────────────────────────────────────────

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  requiresMfa: boolean;
  mfaToken?: string;     // short-lived token to be exchanged at /auth/mfa
  accessToken?: string;  // only set if MFA is disabled for this account
}

interface MfaRequest {
  mfaToken: string;      // received from LoginResponse
  code: string;          // 6-digit code from authenticator app
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Property ────────────────────────────────────────────────────────────────

interface Property {
  id: string;            // e.g. "sunshine"
  name: string;          // e.g. "Sunshine Hotel & Apartments"
  type: string;          // e.g. "Hotel & Apartments" | "Apartments" | "Hotel"
}

// ─── Reservation ─────────────────────────────────────────────────────────────

type ReservationStatus = "onboard" | "check-in" | "check-out" | "confirmed" | "open";

interface Reservation {
  id: string;             // PMS reservation code, e.g. "34MRK211"
  name: string;           // primary guest full name
  email: string;          // primary guest email
  room: string;           // room type name, e.g. "Junior Suite"
  roomNo: string;         // room number, e.g. "201"
  date: string;           // display date of arrival, e.g. "Dec 18, 2025"
  guests: number;         // total guest count
  nights: number;
  status: ReservationStatus;
  source: string;         // booking channel, e.g. "Booking.com"
  checkIn: string;        // "26/04/2025  15:30" — datetime of check-in
  checkOut: string;       // "28/04/2025  11:30"
  partner: string;        // OTA / booking channel name (same as source in prototype)
  composition: string;    // "2 (2/0/0)" = "total (adults/children/infants)"
}

// ─── Guest ───────────────────────────────────────────────────────────────────

type GuestAge      = "Adult" | "Child" | "Infant";
type GuestGender   = "Male" | "Female";
type DocumentType  = "Passport" | "ID Card" | "Driving Licence" | "Residence Permit";

interface Guest {
  id: string;             // guest ID (not reservation ID)
  name: string;           // full name
  maiden?: string;        // maiden full name, shown as "—" if not set
  mother?: string;        // mother's full name
  birth: string;          // date of birth, "28/11/1980"
  birthPlace: string;
  nationality: string;
  citizenship: string;
  age: GuestAge;
  gender: GuestGender;
  reporting: string;      // regulatory reporting category, e.g. "VIZA / NTAK"
  booker: boolean;        // true = this guest is the lead booker
  phone: string;          // "—" if not set
  email: string;          // "—" if not set
  docType: DocumentType;
  docNo: string;
  scanned: boolean;       // true = travel document has been scanned via IDScan
}

// ─── Services & Finances (on reservation) ───────────────────────────────────

interface Service {
  name: string;           // e.g. "Breakfast (×2)"
  qty: number;
  price: string;          // e.g. "€36.00" — consider returning a number + currency code
}

interface Finance {
  room: string;           // room cost total, e.g. "€220.00"
  services: string;       // services total
  total: string;
  paid: string;
  balance: string;        // outstanding balance (total - paid)
}

// ─── Arrivals stats ──────────────────────────────────────────────────────────

interface ArrivalsStats {
  guestsArrived: number;  // shown as "23 / 56" in prototype (arrived / total expected)
  guestsTotal: number;
  reservationsArrived: number;
  reservationsTotal: number;
}

// ─── ID Scan OCR result ──────────────────────────────────────────────────────

interface OcrResult {
  name: string;
  docType: string;
  docNo: string;
  age: number;
  gender: string;
  birthPlace: string;
  birth: string;          // ISO date preferred
  citizenship: string;
  mother: string;
}

// ─── Block dates ─────────────────────────────────────────────────────────────

interface BlockDatesRequest {
  propertyId: string;
  startDate: string;      // ISO date "2025-12-18"
  endDate: string;
  roomId?: string;        // optional — block specific room or all rooms
}
```

---

## 3. Navigation Structure

The prototype uses a custom stack navigator. Map it to Ionic `NavController` or Angular Router as follows.

### Route table

| Prototype screen name | Suggested Ionic/Angular route | Angular component |
|---|---|---|
| `login` | `/login` | `LoginPage` |
| `mfa` | `/mfa` | `MfaPage` |
| `property` | `/property-select` | `PropertySelectPage` |
| `home` | `/home` | `HomePage` |
| `arrivals` | `/arrivals` | `ArrivalsPage` _(dormant — not yet linked from home)_ |
| `reservation` (+ id payload) | `/reservation/:id` | `ReservationDetailPage` |
| `guest` (+ resId, guestId) | `/reservation/:resId/guest/:guestId` | `GuestDetailPage` |
| `editguest` (+ resId, guestId) | `/reservation/:resId/guest/:guestId/edit` | `EditGuestPage` |
| `search` | `/search` | `SearchPage` |
| `idscan` | `/idscan` | `IdScanPage` |
| `blockdate` | `/block-date` | `BlockDatePage` |

### Navigation calls to translate

| Prototype call | Ionic equivalent |
|---|---|
| `go("reservation", r.id)` | `navCtrl.navigateForward('/reservation/' + r.id)` |
| `go("guest", { resId, guestId })` | `navCtrl.navigateForward('/reservation/' + resId + '/guest/' + guestId)` |
| `back()` | `navCtrl.navigateBack()` or `location.back()` |
| `setRootTab("home")` (after login) | `navCtrl.navigateRoot('/home')` |

### Page transitions

The prototype has a 320ms slide-right (forward) / slide-left (back) transition with `cubic-bezier(0.32, 0.72, 0, 1)`. Ionic's default `IonRouterOutlet` produces the same effect natively on iOS — use it as-is. The custom CSS classes `.page-enter`, `.page-enter-active`, `.page-back-enter`, `.page-back-enter-active` in `styles.css` are the React prototype's equivalent and can be removed once Ionic handles transitions.

---

## 4. Global Application State

These values must be accessible across screens. Use an Angular service (e.g. `AuthService`, `AppStateService`).

| State | Type | Set when | Used by |
|---|---|---|---|
| `accessToken` | `string` | After successful login or MFA | Every authenticated API call |
| `refreshToken` | `string` | After successful login or MFA | Token refresh flow |
| `selectedProperty` | `Property \| null` | On `PropertySelectPage` | HomeScreen header, all data-fetching calls |

Persist `accessToken` + `refreshToken` in `@ionic/storage` (survives app restart). Store `selectedProperty` in-memory only (user selects it every session, or you can also persist it).

---

## 5. Screen-by-Screen API Contract

For each screen: what data it needs, where the prototype currently gets it, and what real calls to make.

---

### 5.1 LoginScreen

**File:** `login-screen.js`

**What it does:** Email + password form. Shows a spinner during submission. On failure: error bottom sheet. On success: navigates to MFA screen.

**Currently fakes:** Hardcoded credential check against `VALID_EMAIL = "tamas@szurmik.com"` and `VALID_PASSWORD = "password"`. 600ms `setTimeout` simulates network delay.

**Developer cheat (keep for dev builds):** Both fields empty + submit → skips auth and goes straight to `PropertySelectPage`. Useful for bypassing login during UI testing.

**Real API call:**
```
POST /api/auth/login
Body:  { email: string, password: string }
→ 200: { requiresMfa: true, mfaToken: "…" }       // proceed to MFA
→ 200: { requiresMfa: false, accessToken: "…", refreshToken: "…" }  // skip MFA
→ 401: { message: "…" }   // show error sheet
```

**On success:** Store `mfaToken` temporarily (in-memory) and navigate to `MfaPage`, passing the token. If `requiresMfa: false`, store tokens in `AuthService` and navigate to `PropertySelectPage`.

**Error sheet behaviour:** The prototype clears the password field and re-focuses it when the sheet is dismissed. Preserve this UX.

---

### 5.2 MFAScreen

**File:** `login-screen.js`

**What it does:** 6 individual digit inputs, auto-advance, auto-submit on 6th digit. On wrong code: shake animation + clear all + re-focus first. On success: navigate to property select.

**Currently fakes:** Hardcoded OTP `VALID_OTP = "444555"`. 600ms `setTimeout` simulates server round trip.

**Real API call:**
```
POST /api/auth/mfa/verify
Body:  { mfaToken: "…", code: "444555" }
→ 200: { accessToken: "…", refreshToken: "…" }
→ 401: { message: "Invalid code" }   // trigger shake animation
```

**On success:** Store tokens in `AuthService`. Navigate to `PropertySelectPage`.

**iOS keyboard note (critical):** The 6 inputs use `type="tel" inputMode="numeric"`. Auto-focus on the first input must fire with a 350ms delay after navigation completes, not immediately on mount. This is because iOS loses the gesture context needed to open the keyboard during page transition animation (which lasts 320ms). In Ionic Angular, use `ionViewDidEnter()` lifecycle hook + a 50ms `setTimeout` (Ionic handles the 300ms transition itself before calling `ionViewDidEnter`). Example:
```typescript
ionViewDidEnter() {
  setTimeout(() => this.firstInput.setFocus(), 50);
}
```

---

### 5.3 PropertySelectScreen

**File:** `property-screen.js`

**What it does:** Lists all properties the user manages. Tapping a property sets it as the active property and navigates to home. No back button (mandatory step after login).

**Currently fakes:** Hardcoded `PROPERTIES` array (3 properties in `data.js`).

**Real API call:**
```
GET /api/properties
Headers: Authorization: Bearer {accessToken}
→ 200: Property[]
```

**On property tap:** Store selected `Property` in `AppStateService`, navigate root to `HomePage`.

---

### 5.4 HomeScreen

**File:** `home-screen.js`

**What it does:** Header (property name + property-switcher sheet), search bar, day segment (Yesterday / Today / Tomorrow), stats block, arrivals list.

**Currently fakes:**
- Stats `23 / 56` (guests) and `6 / 17` (reservations) are hardcoded strings.
- Arrivals list uses the global `RESERVATIONS` array regardless of the selected tab.
- `dimmed={tab !== "Today" && r.status === "open"}` — reservation cards for other days dim "open" status reservations. Preserve this behaviour when real data arrives.

**Real API calls:**

```
// Arrivals list + stats for selected day
GET /api/properties/{propertyId}/arrivals?date={date}
Headers: Authorization: Bearer {accessToken}
date = ISO date string, e.g. "2025-12-18"
→ 200: {
    stats: {
      guestsArrived: number,
      guestsTotal: number,
      reservationsArrived: number,
      reservationsTotal: number
    },
    arrivals: Reservation[]
  }
```

Call this whenever the user switches tabs (Yesterday / Today / Tomorrow). Derive `date` from today + offset (-1 / 0 / +1 days).

**Stats display format:** `guestsArrived + " / " + guestsTotal` → shown as `"23 / 56"`.

**Property switcher sheet:** Tapping the property name opens a bottom sheet listing all properties. The currently active property shows a small blue dot indicator (`property?.id === p.id`). On selecting a new property: update `AppStateService.selectedProperty` and reload the arrivals for the new property.

```
// Already loaded at PropertySelectScreen, but you may need to re-fetch
GET /api/properties   →  Property[]
```

---

### 5.5 ReservationDetailScreen

**File:** `arrivals-screen.js`

**What it does:** Shows full reservation detail (detail block with all reservation fields + fact grid) and a list of guest cards for that reservation.

**Currently fakes:** Finds the reservation in the global `RESERVATIONS` array by ID. Finds guests in `GUESTS[reservationId]`.

**Real API calls:**

```
// Reservation detail
GET /api/reservations/{id}
→ 200: Reservation  (same fields as the Reservation interface above)

// Guests on this reservation
GET /api/reservations/{id}/guests
→ 200: Guest[]
```

You can merge these into a single endpoint if the backend returns guests embedded in the reservation: `GET /api/reservations/{id}?include=guests`.

**Status cycling action:** The status `Pill` on this screen is tappable and cycles through statuses: `confirmed → onboard → check-in → check-out → confirmed`. On each tap it currently shows a toast and updates local state only.

```
PATCH /api/reservations/{id}/status
Body:  { status: ReservationStatus }
→ 200: { status: ReservationStatus }   // confirm new status
```

Optimistically update the UI, revert on error.

**Toast labels for status changes:**
| Status value | Display label in toast |
|---|---|
| `check-in` | "Check-in" |
| `check-out` | "Check-out" |
| `onboard` | "Onboard" |
| `confirmed` | "Confirmed" |

**Guest card scan button:** The `I.IDCard` button inside each guest card navigates to `IDScanScreen`. It is separate from tapping the card itself (which navigates to `GuestDetailScreen`). Both are live in the prototype.

---

### 5.6 GuestDetailScreen

**File:** `detail-screens.js`

**What it does:** Read-only display of a single guest's personal info, contact details, and travel document. FAB opens action sheet with "Edit guest" and "ID Scan".

**Currently fakes:** Finds the guest by `guestId` inside `GUESTS[resId]`.

**Real API call:**

```
GET /api/guests/{guestId}
→ 200: Guest
```

Alternatively, if GuestDetailScreen is always reached after loading `ReservationDetailScreen`, you can pass the `Guest` object through navigation state rather than re-fetching.

**`scanned` field:** Displays "Yes" / "No" under Travelling document. This field must be updated to `true` after a successful `IDScanScreen` save for this guest. See section 5.9.

---

### 5.7 EditGuestScreen

**File:** `detail-screens.js`

**What it does:** Form with floating-label inputs for all guest personal data, contact, and travel document. "Save" button at the bottom.

**Currently fakes:** Initialises form from the hardcoded guest object. On save: shows toast "Guest details saved" + navigates back. No data is written anywhere.

**Real API call:**

```
PUT /api/guests/{guestId}
Body: {
  name: string,
  maiden: string,
  mother: string,
  birth: string,          // "28/11/1980" — confirm format with backend
  birthPlace: string,
  citizenship: string,
  phone: string,
  email: string,
  docType: DocumentType,
  docNo: string
}
→ 200: Guest   // return updated guest
```

On success: show toast "Guest details saved", navigate back to `GuestDetailScreen`. Update the cached guest in whatever state/store you use so the detail screen reflects the changes immediately without re-fetching.

**Form fields reference:**

| Field | Input type | Prototype label |
|---|---|---|
| `name` | text | "First & Last name" |
| `maiden` | text | "Maiden full name" |
| `mother` | text | "Mother's full name" |
| `birth` | text (consider `date`) | "Birth Date" |
| `birthPlace` | text | "Birth place" |
| `citizenship` | text | "Citizenship" |
| `phone` | tel | "Phone" |
| `email` | email | "Email" |
| `docType` | select | "Document Type" |
| `docNo` | text | "Document Number" |

---

### 5.8 SearchScreen

**File:** `detail-screens.js`

**What it does:** Full-screen search. Empty state shows suggestion chips. Results shown as reservation cards that navigate to `ReservationDetailScreen`.

**Currently fakes:** Client-side `Array.filter()` on the hardcoded `RESERVATIONS` array, matching against `name`, `email`, `id`, `room`, `roomNo`.

**Real API call:**

```
GET /api/properties/{propertyId}/search?q={query}
→ 200: Reservation[]
```

**Debounce:** Add 250–300ms debounce before firing — do not call on every keystroke. Show a loading spinner while waiting.

**Suggestion chips:** Currently hardcoded to `["Emma Williams", "68CXK25", "Junior Suite", "Booking.com"]`. These could stay static (they are just demo helpers) or be replaced with the user's recent searches stored locally.

**Auto-focus:** The search input gets `autoFocus` immediately (no delay needed here, because SearchScreen is always opened by an explicit user tap on the search bar, preserving the gesture context). In Ionic Angular, use `ionViewDidEnter()` + `this.searchInput.setFocus()` with no delay.

---

### 5.9 IDScanScreen

**File:** `detail-screens.js`

**What it does:** Dark full-screen camera UI with animated scan frame. Three phases: `camera` (live viewfinder) → `scanning` (spinner, 1.6s) → `result` (bottom sheet with OCR-extracted fields). Result sheet has "Edit" and "Save" actions.

**Currently fakes:** Camera viewfinder is a plain dark background (no real camera feed). After tapping the shutter button: 1.6s wait → shows hardcoded OCR result for "Emma Smith".

**Real implementation — two parts:**

**Part A — Camera capture (Capacitor):**
```typescript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const image = await Camera.getPhoto({
  quality: 90,
  resultType: CameraResultType.Base64,
  source: CameraSource.Camera,
  allowEditing: false,
});
// image.base64String → send to OCR endpoint
```

For the live viewfinder UI in the prototype (the scan frame with corner brackets and laser sweep), consider using `@capacitor-community/camera-preview` to show a real camera preview behind your Angular overlay.

**Part B — OCR API call:**
```
POST /api/ocr/scan
Headers: Authorization: Bearer {accessToken}
Body:    { image: string }   // base64-encoded JPEG
→ 200: OcrResult
→ 422: { message: "Could not read document" }   // show error state
```

**On "Save" in the result sheet:**
```
PATCH /api/guests/{guestId}
Body: {
  name: result.name,
  docType: result.docType,
  docNo: result.docNo,
  birth: result.birth,
  birthPlace: result.birthPlace,
  citizenship: result.citizenship,
  mother: result.mother,
  scanned: true          // mark document as scanned
}
→ 200: Guest
```

Note: `IDScanScreen` can be launched from two places — the scan button inside a `GuestDetailScreen` guest card, and the standalone scan button on `ReservationDetailScreen`. In the first case, you have a `guestId` to save to. In the second case (navigated to from the reservation-level scan button), you may not know which guest to attach the result to — the result sheet should then only offer "Edit" mode, pre-filling the `EditGuestScreen` form with the OCR data.

**On "Edit" in the result sheet:** Navigate to `EditGuestScreen` with form pre-populated from the OCR result (instead of from the existing guest record).

---

### 5.10 BlockDateScreen

**File:** `app.js`

**What it does:** Single-month calendar (current month). Tap once to set start date, tap again to set end date. "Block selected dates" button submits.

**Currently fakes:** Shows toast "Date blocked" and navigates back. No data is written.

**Real API call:**
```
POST /api/properties/{propertyId}/blocks
Body: {
  startDate: string,   // ISO date, e.g. "2025-12-10"
  endDate: string,     // ISO date, e.g. "2025-12-14"
  roomId?: string      // optional — if blocking a specific room
}
→ 200: { id: string, startDate: string, endDate: string }
→ 422: { message: "…" }   // e.g. "Dates overlap existing booking"
```

The prototype currently shows only the current month with no prev/next navigation. This is a known limitation — month navigation can be added when implementing the real version.

---

## 6. Screens Not Yet Built (in prototype)

These appear in the `CLAUDE.md` "Up Next" list. They have no UI yet — build them from scratch.

### 6.1 Services tab on ReservationDetail

Data already exists in `data.js`:
```
SERVICES["34MRK211"] = [
  { name: "Breakfast (×2)", qty: 2, price: "€36.00" },
  { name: "Spa Access",     qty: 1, price: "€45.00" }
]
```
API: `GET /api/reservations/{id}/services → Service[]`

### 6.2 Finances tab on ReservationDetail

Data already exists in `data.js`:
```
FINANCES["34MRK211"] = {
  room: "€220.00", services: "€81.00", total: "€301.00",
  paid: "€150.00", balance: "€151.00"
}
```
API: `GET /api/reservations/{id}/finances → Finance`

### 6.3 Departures screen

No prototype — to be designed and built. Will share the same `Reservation` data model but filtered by check-out date and showing `check-out` status flows.

### 6.4 Notifications screen

No prototype. Target for the Bell icon (top right of HomeScreen). Suggest a flat list of notification items with read/unread state.

---

## 7. HTTP Client Setup

### Base URL and headers

Every authenticated request needs:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
Accept-Language: {selectedLanguage}   // "en" | "hu" | "de" | "tr" | "fr" | "lv" | "es"
```

The language selector on `LoginScreen` is currently cosmetic. Wire it to an `AppStateService.language` property and include the value in every request header.

### Token refresh

Implement an Angular `HttpInterceptor` that:
1. Attaches `Authorization` header to every request.
2. On `401` response: attempts a token refresh via `POST /api/auth/refresh { refreshToken }`.
3. On successful refresh: retries the original request with the new token.
4. On failed refresh: clears stored tokens and navigates to `/login`.

### Error handling

The prototype has error UI in two places:
- `LoginScreen` — error bottom sheet for wrong credentials (reuse `.sheet` + `.sheet-backdrop` pattern)
- `MFAScreen` — inline "Invalid code" text with shake animation

For all other screens, errors should show via the toast system (already built as `addToast(msg)` pattern in the prototype, maps to Ionic `ToastController` or the custom `Toast` component).

---

## 8. Design System — What to Preserve

The CSS in `styles.css` defines the entire visual language. Whether you use Ionic's component library or custom HTML, ensure these are preserved:

### CSS custom properties

All design tokens are in `:root` in `styles.css`. Import or copy the `:root` block into your global styles. Do not override these values with Ionic's default variables unless intentional.

Key tokens:
```css
--primary: rgb(0, 142, 255)       /* brand blue — buttons, links, accents */
--ink:     rgb(20, 35, 46)        /* primary text */
--bg:      rgb(249, 250, 251)     /* page background */
--surface: #ffffff                /* cards */
--radius:  14px                   /* card border radius */
--pad:     16px                   /* page horizontal padding */
```

### Card variants (`[data-card]`)

The prototype supports three card styles toggled via the Tweaks Panel: `outlined` (default), `soft`, `elevated`. These are controlled by `data-card` attribute on the root `.app-window` element. Preserve this mechanism for demo purposes.

### Status pill colours

The `Pill` component in `icons.js` renders a badge with colour-coded status. The CSS rules are in `styles.css` under `[data-pill]` and `[data-status]`. Each `ReservationStatus` value maps to a specific colour:

| Status | Colour |
|---|---|
| `onboard` | blue-teal |
| `check-in` | green |
| `check-out` | orange |
| `confirmed` | purple |
| `open` | grey |

### Safe area insets (iOS)

**Critical:** Never put `env(safe-area-inset-bottom)` or `env(safe-area-inset-top)` inside a CSS custom property (`var()`). A WebKit bug on some iOS versions silently fails to resolve it. Always write the value inline:

```css
/* CORRECT */
padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));

/* BROKEN on some iOS */
--my-var: env(safe-area-inset-bottom, 0px);
padding-bottom: calc(16px + var(--my-var));
```

Current safe area values in use across the app are documented in `CLAUDE.md` section 4.

### Viewport and PWA meta tags

These must be present in the app's `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```
- `viewport-fit=cover` — content extends under iOS notch and home indicator area
- `interactive-widget=resizes-visual` — keyboard overlays content on Android instead of shrinking the layout
- `black-translucent` — in PWA mode (saved to home screen): status bar is transparent; modal backdrops visually dim through it

### App height

```css
.app-window {
  height: 100vh;    /* fallback */
  height: 100svh;   /* iOS 16+: fixed height, doesn't change when keyboard appears */
}
```
Use `100svh` (small viewport height) in Ionic — it stays constant when the soft keyboard opens, preventing layout jumps. Equivalent in Ionic: set `ion-app` to `height: 100svh`.

### iOS keyboard and overflow

On iOS, if a focused `<input>` is inside an `overflow: hidden` container, the OS scrolls the entire document upward. Fix:
```css
html { overflow: hidden; }
```
This is already in `styles.css`. Preserve it.

---

## 9. Quick Reference — Where Fake Data Lives

| What | Where in prototype | Replace with |
|---|---|---|
| Login credentials | `VALID_EMAIL`, `VALID_PASSWORD` in `login-screen.js` | `POST /api/auth/login` |
| OTP code | `VALID_OTP` in `login-screen.js` | `POST /api/auth/mfa/verify` |
| Properties list | `PROPERTIES` in `data.js` | `GET /api/properties` |
| Arrivals list | `RESERVATIONS` in `data.js` | `GET /api/properties/{id}/arrivals?date=…` |
| Arrivals stats (23/56, 6/17) | Hardcoded strings in `home-screen.js` and `arrivals-screen.js` | Included in arrivals response (see §5.4) |
| Reservation detail | `RESERVATIONS.find(x => x.id === id)` | `GET /api/reservations/{id}` |
| Guest list on reservation | `GUESTS[reservationId]` in `data.js` | `GET /api/reservations/{id}/guests` |
| Guest detail | `GUESTS[resId].find(x => x.id === guestId)` | `GET /api/guests/{guestId}` |
| Save guest | Toast only, no write | `PUT /api/guests/{guestId}` |
| Status cycle | Local `useState`, toast only | `PATCH /api/reservations/{id}/status` |
| OCR scan result | Hardcoded object in `IDScanScreen` | Camera → `POST /api/ocr/scan` |
| Block dates | Toast only, no write | `POST /api/properties/{id}/blocks` |
| Services per reservation | `SERVICES[reservationId]` in `data.js` | `GET /api/reservations/{id}/services` |
| Finances per reservation | `FINANCES[reservationId]` in `data.js` | `GET /api/reservations/{id}/finances` |
| Search results | Client-side filter on `RESERVATIONS` | `GET /api/properties/{id}/search?q=…` |

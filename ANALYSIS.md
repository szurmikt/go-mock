# SabeeApp GO — Ionic/Angular App Analysis

> Analysis of the existing Ionic/Angular app in `/old-ionic-app`. Read-only — no changes made.
> Use this as a reference when building the React prototype to ensure feature parity and correct API integration.

---

## 1. App Purpose and Target Users

**Application**: SabeeApp GO — Hotel Management Mobile App

**Purpose**: A hybrid mobile application for hotel staff to manage guest reservations, check-ins/check-outs, guest information, document scanning, and view hotel analytics/performance metrics. A mobile companion to the SabeeApp PMS web system.

**Target Users**:

- Hotel managers
- Front desk staff
- Check-in/check-out personnel
- Guest service representatives
- Hotel administrators

**Key Features**:

- Multi-property management (switch between properties)
- Reservation management and filtering
- Guest check-in/check-out tracking
- Guest document scanning and validation
- Guest feedback monitoring
- Hotel occupancy tracking
- Financial metrics (ADR, RevPAR)
- Customizable widget-based dashboard
- Multi-language support
- Biometric authentication (fingerprint/face recognition)
- Session timeout security with biometric re-authentication

---

## 2. All Screens / Pages

| Page                   | Route                                              | Protected | Purpose                                                                                        |
| ---------------------- | -------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| **Splash**             | `/`, `/splash`                                     | No        | Initial loading screen; shows logo while app bootstraps                                        |
| **Login**              | `/login`                                           | No        | 3-step auth: email/password → MFA code → property selection                                    |
| **Dashboard**          | `/dashboard`                                       | Yes       | Customizable home with widgets (reservations, arrivals, departures, occupancy, feedback, etc.) |
| **Reservations**       | `/reservations`                                    | Yes       | List all reservations; search and date-range filter                                            |
| **Arrivals**           | `/arrivals`                                        | Yes       | Guests arriving today/yesterday/tomorrow; date segmentation                                    |
| **Departures**         | `/departures`                                      | Yes       | Guests departing today/yesterday/tomorrow; date segmentation                                   |
| **Reservation Detail** | `/reservation/:reservationCode`                    | Yes       | Full reservation: guest list, services, finances, status management, comments modal            |
| **Guest Detail**       | `/guest/:reservationCode/:reservationGuestId`      | Yes       | Guest profile: personal info, document details, scanned data                                   |
| **Guest Edit**         | `/guest/:reservationCode/:reservationGuestId/edit` | Yes       | Edit form: name, birth date, document type/number, citizenship, gender, email, phone           |
| **Settings**           | `/settings`                                        | Yes       | Dashboard widget management (add/remove/reorder), tab management, language switching           |
| **ID Scan**            | `/idscan`                                          | Yes       | Dedicated document scanning page (minimal implementation)                                      |
| **Guest Feedback**     | `/guestfeedback`                                   | Yes       | Guest ratings; segmentation (all / needs attention)                                            |
| **Document Reader**    | `/reader`                                          | No        | Regula document recognition component (currently commented out)                                |

---

## 3. Navigation Flow

### Authentication Flow

```
Splash
  ├─ No valid token → Login
  │     Step 1: email + password → get mfa_token
  │     Step 2: MFA code → get access_token + refresh_token
  │     Step 3: Property selection → set active property
  │         └─ Dashboard
  └─ Valid token exists → Dashboard (auto-refresh if close to expiry)
```

### Protected Route Guard (`AuthGuard`)

- Checks if `property` is loaded in UserService
- Loads from storage if not
- Redirects to Login if still undefined

### Main Navigation (Tab/Bottom Nav)

```
Dashboard → Reservations → /reservation/CODE → /guest/CODE/GUEST_ID → /guest/.../edit
                                                                    └─ Scan Modal
         → Arrivals → /reservation/CODE
         → Departures → /reservation/CODE
         → Settings
```

### Modals / Overlays

- Property selector modal (dashboard, reservations)
- Comments modal (reservation detail)
- Scan modal (guest detail — document scanning)
- Widget selector (settings)
- Language switcher
- Block date modal

---

## 4. All API Endpoints

### Base URLs

| URL                                               | Used for                              |
| ------------------------------------------------- | ------------------------------------- |
| `https://smart.sabeeapp.com/api2/go/`             | Main production API                   |
| `https://x8ki-letl-twmt.n7.xano.io/api:xxtHSl_D/` | Xano API (widgets, booking, accounts) |

**URL Routing** (in `ApiService.prepareUrl()`): requests starting with `/widgets/*`, `/booking/*`, `/accounts_by_userid/*` go to Xano; all others go to the main API.

### Authentication

| Method | Endpoint     | Body / Params                                                                            |
| ------ | ------------ | ---------------------------------------------------------------------------------------- |
| POST   | `token`      | `{username, password, device_id, grant_type: 'password', client_id: '366f7aff6d185668'}` |
| POST   | `token`      | `{grant_type: 'refresh_token', refresh_token}`                                           |
| POST   | `mfa/verify` | `{mfa_token, method: 'totp', code}`                                                      |

### User & Property

| Method | Endpoint      | Body / Params   |
| ------ | ------------- | --------------- |
| GET    | `users/me`    | —               |
| GET    | `properties`  | —               |
| POST   | `setProperty` | `{property_id}` |

### Reservations

| Method | Endpoint               | Body / Params                                                                |
| ------ | ---------------------- | ---------------------------------------------------------------------------- |
| GET    | `reservations`         | `{start_date, end_date}` (format: `yyyy-MM-dd`; default ±14 days from today) |
| GET    | `reservations/details` | `{reservation_code}`                                                         |

### Guests

| Method | Endpoint                 | Body / Params                                                                                             |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| GET    | `guests`                 | `{reservation_code}`                                                                                      |
| POST   | `guests`                 | `{reservation_code, guest: {...}}`                                                                        |
| PUT    | `guests/scan_statistics` | `{reservation_guest_id, doc_reader_scanned_document_id, status, scan_type, message, date_of_issue, type}` |

### Configuration

| Method | Endpoint              | Body / Params                                        |
| ------ | --------------------- | ---------------------------------------------------- |
| GET    | `options`             | — (returns gender, document_type, country dropdowns) |
| GET    | `properties/settings` | — (returns `fieldsToScan` array)                     |
| GET    | `languages`           | Header: `Lang: [language_code]`                      |

### HTTP Headers (added by interceptor to every request)

| Header        | Value                        |
| ------------- | ---------------------------- |
| `Api-Version` | Config.API_VERSION (`1.0`)   |
| `Device-Id`   | Device UUID from Capacitor   |
| `App-Version` | Config.APP_VERSION (`1.1.0`) |
| `Platform`    | Device OS + version          |
| `Device-Name` | Manufacturer + model         |
| `Ci-Version`  | Config.CI_VERSION (`4`)      |
| `Lang`        | Current language code        |
| `Property-Id` | Active property ID           |
| `Token`       | JWT access token             |

**Request timeout**: 10 seconds on all requests.

---

## 5. Authentication

**Mechanism**: OAuth 2.0 with TOTP-based MFA + device tracking

### Login Process

1. POST `token` with email + password → server returns `mfa_token`
2. POST `mfa/verify` with `mfa_token` + TOTP code → server returns `access_token`, `refresh_token`, `expires_in`
3. Client stores tokens and computes `expiresAt = now + expires_in`

### Token Storage

Stored in Ionic Storage (IndexedDB/SQLite):

- `accessToken`, `refreshToken`, `expiresAt`, `scope`, `authData`

### Token Refresh

- **Pre-emptive**: interceptor automatically refreshes when token is ~59m 50s old (3590s before expiry)
- **Reactive**: 401 response triggers refresh + request retry
- **Fallback**: failed refresh → clear all tokens → redirect to login
- Uses same `token` endpoint with `grant_type: 'refresh_token'`

### Session Security

- Biometric re-authentication required if app is backgrounded for >30 seconds (`diffLimit = 60 * 0.5` in `app.component.ts`)
- On foreground: checks last active time, prompts biometric if threshold exceeded

---

## 6. Data Models and Key Interfaces

### Authentication

```typescript
interface AuthInterface {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  roles: string[];
}
```

### User & Property

```typescript
interface UserInterface {
  id: string;
  name: string;
  email: string;
}

interface PropertyInterface {
  property_id: number;
  property_name: string;
  property_company_name: string;
}
```

### Reservation

```typescript
interface ReservationInterface {
  id: string;
  reservation_code: string;
  partner: { partner_id: string; partner_name: string };
  booker: BookerInterface;
  arrival_date: string; // yyyy-MM-dd
  departure_date: string; // yyyy-MM-dd
  checked_in_time: string;
  checked_out_time: string;
  status: string; // confirmed | checkin | checkedin | checkout | checkedout | onboard
  room_type_id: string;
  room_type_name: string;
  room_id: string;
  room_name: string;
  guest_count: { adults: number; children: number; infants: number };
  number_of_guests: number;
  nights: number;
  guests: GuestInterface[];
  services: ServiceInterface[];
  finances: FinanceInterface[];
}

interface BookerInterface {
  booker_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ServiceInterface {
  service_id: string;
  name: string;
  price: number;
}

interface FinanceInterface {
  finance_id: string;
  name: string;
  price: number;
}
```

### Guest

```typescript
interface GuestInterface {
  reservation_guest_id: string;
  guest_id: string;
  first_name: string;
  last_name: string;
  mother_name: string;
  maiden_name: string;
  birth_date: string; // yyyy-MM-dd
  birth_place: string;
  guest_age: string;
  gender: string; // M | F | Other
  city_tax_liable: string;
  citizenship: string; // country code
  address: AddressInterface | null;
  email: string;
  phone_number: string;
  document: {
    document_type: string; // passport | idcard | driving_licence | residence_permit
    document_number: string;
    date_of_issue_of_the_document: string;
  } | null;
  scanned_data: ScannedDataInterface | null;
  locked: boolean;
  rfid_tag?: number;
  age?: number;
}

interface ScannedDataInterface {
  doc_reader_scanned_document_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  mother_name: string;
  maiden_name: string;
  birth_date: string;
  birth_place: string;
  gender: string;
  citizenship: string;
  age: number;
  document: { document_type: string; document_number: string; date_of_issue_of_the_document: string } | null;
}

interface AddressInterface {
  country_code: string;
  zip: string;
  city: string;
  address_line: string;
}
```

### Settings & Widgets

```typescript
interface Settings {
  widgets: string[];
  views: DashboardView[];
  tabs: DashboardTab[];
}

interface DashboardView {
  id: string; // view1, view2, …
  title: string;
  widgets: string[];
}

interface DashboardTab {
  id: string;
  icon: string; // SVG path
  type: TabType; // View | Action
  view: string | undefined;
  action: string | undefined;
  weight: number;
  enabled: boolean;
}
```

### Enums

```typescript
enum ReservationDataSegments {
  guests,
  services,
  finances,
}
enum DateSegments {
  yesterday,
  today,
  tomorrow,
}
```

### Reservation Status Values

`confirmed` → `onboard` → `checkin` / `checkedin` → `checkout` / `checkedout`

---

## 7. Services

### `AuthService`

Manages tokens, device info, authentication state.

- `onReady()` — init device info + load stored tokens
- `setToken(authData)` — persist access/refresh token + expiry
- `isAuthenticated()` — validate token, auto-refresh if needed
- `generateNewToken()` — refresh via refresh token
- `removeToken()` — clear all auth data
- `getUUID()`, `getDeviceInfo()` — device identifiers
- Prevents concurrent refresh with `tokenRefreshing` flag

### `UserService`

User profile, property selection, login/logout.

- `login(email, password)` — step 1, returns mfa_token
- `mfa(code)` — step 2, sets access tokens
- `fetchProperties()` — get property list
- `setProperty(id)` — activate a property
- `logout()` — clear session + redirect
- BehaviorSubjects: `userBS`, `propertyBS`

### `ReservationService`

Reservation and guest data — fetch, cache, transform.

- `fetchReservations(start, end)` — default ±14 days window
- `fetchReservationByReservationCode(code)` — single reservation with guests
- `fetchGuestsByReservationCode(code)`
- `fetchGuestById(code, guestId, forceUpdate?)`
- `updateGuest(code, guest)`
- Conversion methods map API response shapes to internal interfaces
- BehaviorSubjects: `reservationsBS`, `reservationBS`, `guestBS`
- Subject: `reservationsS` (search results stream)

### `ApiService`

HTTP client wrapper.

- `get<T>(action, params?, headers?)`
- `post<T>(action, body?, headers?)`
- `put<T>(action, body?, headers?)`
- `prepareUrl(action)` — routes to main API vs Xano based on endpoint prefix
- 10-second timeout on all requests

### `ApiInterceptor`

HTTP interceptor on every outgoing request/incoming response.

- Injects auth headers (token, device, platform, property)
- Pre-emptive token refresh at 59m 50s
- 401 handling with retry after refresh
- Queue to prevent concurrent refresh calls

### `BootstrapService`

App initialization orchestrator.

- `init()` — start bootstrap sequence
- `initApp()` — load user → property → options → docuscan fields
- `isInitialized()` — check if all services ready
- BehaviorSubject `bootstrapBS` emits `true` when done

### `SettingsService`

Dashboard widget and tab configuration, per-property storage.

- `loadSettings()` — load from storage, fallback to defaults
- `saveWidgets(widgets)` — persist widget list
- `saveView()`, `saveTab()`, `addTab()`
- Storage key is property-scoped: `widget_settings_[propertyId]`

### `StorageService`

Thin wrapper over Ionic Storage.

- `setLocalData(key, value)`, `getLocalData(key)`, `removeLocalData(key)`, `clearLocalData()`

### `LanguageService`

Multi-language support and translation management.

- `onReady()` — detect device language, load translations
- `fetchLanguages()` — fetch language list + translations from API
- `getTranslation(group, key)` — look up specific string
- BehaviorSubjects: `languagesBS`, `translationBS`

### `OptionsService`

Cache dropdown options (gender, document_type, country list).

- `load()` — check storage, then API
- `get()` — return cached options
- Returns: `{ gender: {...}, document_type: {...}, country: [{id, name, country_code}] }`

### `DocuscanService`

Document scanning field config and statistics.

- `load()` — load scan field config from API
- `fetchScanFields()` — GET `properties/settings`
- `fillGuestDataFromScannedData()` — copy scanned data into guest object
- `sendStatistics()` — PUT `guests/scan_statistics`

### `WidgetsService`

Available widget catalogue and per-property widget data.

- `getAllWidgets()` — static list of 11 widgets
- `getWidgetByKey(key)` — get component by widget path
- `getData()` — load widget data from storage or API

### `BiometricService`

Fingerprint/face authentication.

- `checkBiometric()` — check device support
- `verify()` — prompt for biometric auth

### Other Services

- `Events` — pub/sub event bus
- `ModalService` — helper for Ionic modal creation
- `PlatformService` — iOS/Android detection

---

## 8. Key Components

| Component                   | Purpose                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| `ReservationCardComponent`  | Reservation summary card: code, booker, dates, room, status badge   |
| `GuestCardComponent`        | Guest profile snippet: name, age, doc info, citizenship             |
| `SearchComponent`           | Search/filter input, real-time; emits search text                   |
| `PropertyListComponent`     | Modal for property switching                                        |
| `LanguageSwitcherComponent` | Language selection dropdown                                         |
| `ScanModalComponent`        | Document scan bottom sheet; Regula integration; copy-to-form action |
| `CommentsModalComponent`    | View/edit reservation comments                                      |
| `FinanceCardComponent`      | Finance entry: name, amount, transaction details                    |
| `ServiceCardComponent`      | Service entry: name, price                                          |
| `CustomBackButtonComponent` | Styled back button used across protected pages                      |
| `WidgetSelectComponent`     | Add-widget modal in Settings                                        |
| `DashboardTabComponent`     | Edit dashboard tab modal                                            |
| `BlockDateModalComponent`   | Block dates on calendar                                             |

---

## 9. State Management

**Approach**: RxJS BehaviorSubjects in services — no Redux/NgRx.

### Observable State

```
UserService:       userBS, propertyBS
ReservationService: reservationsBS, reservationBS, guestBS, reservationsS (Subject)
SettingsService:   settingsBS
LanguageService:   languagesBS, translationBS
BootstrapService:  bootstrapBS
WidgetsService:    propertyWidgetBS
```

### State Flow

1. Login → `AuthService.setToken` → `UserService.fetchProperties`
2. Property select → `UserService.setProperty` → `BootstrapService.initApp`
3. Bootstrap → load user → property → options → docuscan fields → `bootstrapBS.next(true)`
4. Pages subscribe to BehaviorSubjects for data
5. Logout → clear all BehaviorSubjects + storage + redirect

### Persistence Strategy

- Memory → Storage → API (check in order, fetch only if needed)
- Ionic Storage: tokens, user, properties, settings, options, translations, scan fields, language
- Property-scoped keys for settings and widget data

---

## 10. Third-Party Libraries

### Core

| Library                  | Version | Purpose                      |
| ------------------------ | ------- | ---------------------------- |
| `@angular/core`          | 16+     | Framework                    |
| `@ionic/angular`         | latest  | Hybrid mobile UI             |
| `@ionic/storage-angular` | latest  | Persistent key-value storage |
| `rxjs`                   | latest  | Reactive programming         |

### Capacitor (Native APIs)

| Plugin                               | Purpose                               |
| ------------------------------------ | ------------------------------------- |
| `@capacitor/app`                     | App lifecycle (foreground/background) |
| `@capacitor/device`                  | Device UUID, OS, language             |
| `@capacitor/keyboard`                | Keyboard show/hide events             |
| `@awesome-cordova-plugins/biometric` | Fingerprint/face auth                 |
| `@awesome-cordova-plugins/file`      | File system access                    |

### UI

| Library    | Purpose                           |
| ---------- | --------------------------------- |
| `ionicons` | Icon library                      |
| `swiper`   | Touch carousel for dashboard tabs |

### Utilities

| Library     | Purpose                                      |
| ----------- | -------------------------------------------- |
| `crypto-es` | SHA512 hashing (currently bypassed in login) |

### Document Scanning (commented out / infrastructure only)

- `@regulaforensics/ionic-native-document-reader` — Regula document reader

---

## 11. App Configuration

**`config/config.ts`**:

```
APP_ID:               'com.sabeeapp.goapp'
API_VERSION:          '1.0'
APP_VERSION:          '1.1.0'
APP_BUILD:            '2512041'
CI_VERSION:           '4'
API_URL:              '' (set via environment)
DEV_API_URL:          'https://smart.sabeeapp.com/api2/go'
API_URL_XANO:         'https://x8ki-letl-twmt.n7.xano.io/api:'
IS_DEV:               true (toggleable via long press at login)
API_CHANGE_TIMEOUT:   5000ms
API_CHANGE_PASSWORD:  'nosuccesswithoutfailure'
```

**Document Type Constants** (used in docuscan):

- `ID_CARDS`: 50+ document type codes
- `PASSPORTS`: 18+ document type codes
- `DRIVING_LICENCES`: 50+ codes

---

## 12. Storage Keys Reference

| Key                             | Content                                      |
| ------------------------------- | -------------------------------------------- |
| `accessToken`                   | JWT access token                             |
| `refreshToken`                  | Refresh token                                |
| `expiresAt`                     | Token expiry timestamp                       |
| `scope`                         | OAuth scope                                  |
| `authData`                      | Full auth response                           |
| `user`                          | UserInterface object                         |
| `property`                      | Active PropertyInterface                     |
| `properties`                    | All PropertyInterface[]                      |
| `language`                      | Active language code                         |
| `languages`                     | Available languages list                     |
| `translations`                  | Translation strings                          |
| `options`                       | Dropdown options (gender, doc type, country) |
| `fieldsToScan`                  | Scan field config from `properties/settings` |
| `widget_settings_[propertyId]`  | Per-property dashboard settings              |
| `property_widgets_[propertyId]` | Per-property widget data                     |
| `lastActive`                    | Timestamp app last foregrounded (biometric)  |
| `lastCheckedRegulaDB`           | Last Regula database update check            |

---

## 13. Key Workflows

### Guest Check-In

1. Arrivals → tap reservation card
2. Reservation Detail → tap guest card
3. Guest Detail → FAB → Scan Modal
4. Document scanned → data fills edit form
5. Save → PUT `guests` with updated data
6. Status pill cycled to `checkedin`

### Document Scanning

1. Guest Detail → FAB → open ScanModal
2. Regula reader initializes, user scans ID/passport
3. Structured data returned (name, DOB, document number, citizenship, etc.)
4. "Copy to Form" populates edit fields
5. User reviews and saves → PUT `guests/scan_statistics` logs outcome

### Multi-Property

1. Post-login property selection persisted to storage
2. All requests include `Property-Id` header
3. In-app property switch: PropertyListModal → `setProperty` → reload data
4. Settings and widgets are per-property (storage key includes property ID)

---

## 14. Known Limitations in Existing App

1. **Document scanning incomplete** — Regula integration mostly commented out
2. **Services & Finances** — hardcoded mock data in `ReservationService`, not fetched from API
3. **Guest Feedback** — mock data, no API fetch
4. **Daily Performance, RevPAR, ADR widgets** — exist as routes but minimal implementations
5. **Comments** — modal references `reservation.comments` which may not be in API response
6. **Edit Reservation** — `edit()` method stubbed, not fully implemented

---

## 15. Technology Stack Summary

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| Platform          | Ionic hybrid mobile                 |
| Framework         | Angular 16+                         |
| Language          | TypeScript                          |
| State             | RxJS BehaviorSubjects in services   |
| Storage           | Ionic Storage (IndexedDB/SQLite)    |
| HTTP              | Angular HttpClient + Interceptor    |
| Authentication    | OAuth 2.0 + TOTP MFA + Device ID    |
| UI Components     | Ionic Framework                     |
| Document Scanning | Regula (infrastructure only)        |
| Biometrics        | Capacitor + Awesome Cordova Plugins |
| Routing           | Angular Router with AuthGuard       |
| Forms             | Angular Reactive Forms              |
| Native APIs       | Capacitor (lifecycle, device info)  |
| Icons             | Ionicons                            |

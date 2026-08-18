# Supabase Integration — Handover

## Client setup

**No `@supabase/supabase-js` client anywhere in this app** — deliberate, hard constraint (see the IDScanly integration). Every Supabase call is a raw `fetch()`, using one of two access patterns:

1. **Direct PostgREST REST calls**, with the anon/publishable key, straight against `{supabaseUrl}/rest/v1/<table>` — used for simple reads gated entirely by RLS (`PropertyConfigService`, `LanguageService.fetchEnabledLanguages()`).
2. **Edge Functions**, at `{supabaseUrl}/functions/v1/<fn>` — used where a service-role key is needed server-side, multiple tables are combined in one round trip, or the call is a write with no client-side RLS check desired (`AppConfigService`, `FeedbackSheetComponent`, IDScanly's `idrecognition.service.ts`).

## Auth / keys

- **Project URL:** `https://qiwhynwwgicpyeszecuj.supabase.co`
- **Key used:** the **publishable (anon) key** `sb_publishable_rd0rgQytObIOQsYq26xMeg_WNpekL7h`, hardcoded identically in [environment.ts](../src/environments/environment.ts) and [environment.prod.ts](../src/environments/environment.prod.ts) (same Supabase project for dev and prod — no separate dev project).
- This is safe to ship client-side **only because every table is gated by Row Level Security (RLS)** — there's no service-role key in the app itself (Edge Functions hold it server-side, in Supabase's function environment). Each table's client-side access is whatever its RLS policy allows for the `public` role with this key.
- No SabeeApp PMS token/session is involved — Supabase auth is completely independent of the `AuthService`/`/token` flow used for the main API. The only overlap is that `AuthService` fields (`auth.userId()`, `auth.name()`, `auth.email()`, `auth.selectedProperty()`) get **copied into row payloads**, not used for authentication.

## Tables and what's fetched

### 1. `app_config` — read-only, version gate + language allowlist

Columns: `id, platform, minimum_version, updated_at, languages` (no `kill_switch`/`message` columns exist). `platform` is `'ios'` or `'android'` (web/PWA reads the android row). `languages text[]` (added 2026-07-08) lists which language codes the Login dropdown / Settings language picker may offer for that platform; `NOT NULL DEFAULT` is all 7 bundled codes (`En,Hu,De,Tr,Fr,Lv,Es`) — an empty array is treated as "no restriction," not "block everything."

Two independent consumers:

- **[app-config.ts](../src/app/services/app-config.ts)** (`AppConfigService.runVersionGate()`), called from [app.component.ts](../src/app/app.component.ts) at boot and on app-resume — goes through the `config` **Edge Function** (see below), reading only `minimum_version`. Raced against a 3s timeout (`CONFIG_TIMEOUT_MS`); on timeout/error/null it **fails open** (`{ blocked: false }`) and logs a Sentry exception. If `Config.APP_VERSION` < `minimum_version`, the app routes to the non-dismissible `/update-required` screen.
- **[language.service.ts](../src/app/services/language.service.ts)** (`LanguageService.fetchEnabledLanguages()`), called at app boot (`init()`, fire-and-forget) and on every Settings language-picker open — goes **directly** against PostgREST (no Edge Function needed for this one):
  ```ts
  fetch(`${environment.supabaseUrl}/rest/v1/app_config?platform=eq.${platform}&select=languages&limit=1`, { headers: { apikey, Authorization: `Bearer ${apikey}` } })
  ```
  Result feeds a `null`-means-unrestricted signal (fail-open) and is cached via `StorageService` for cold-start hydration.

- RLS: a public `SELECT` policy ("Allow read from app") grants read to the anon/publishable key.

### 2. `property_config` — read-only, per-property scan settings

Renamed from `property_settings` on 2026-07-08 for naming consistency with `app_config` (both are ops-toggled control-plane values, not end-user preferences — picked "config" partly to avoid confusion with the app's own in-app Settings page). The rename was a plain Postgres catalog rename; RLS and data carried over unchanged.

Columns: `property_id (text, PK), scan_vendor, scan_doc_types (scan_doc_type[] enum array), extended_logging (bool), created_at, updated_at`.

- **[property-config.service.ts](../src/app/services/property-config.service.ts)** (`PropertyConfigService.load(propertyId)`), called from `AuthService.selectProperty()` / `loadStoredAuth()` — direct PostgREST:
  ```ts
  fetch(`${environment.supabaseUrl}/rest/v1/property_config?property_id=eq.${propertyId}&select=scan_vendor,scan_doc_types,extended_logging&limit=1`, { headers: { apikey, Authorization: `Bearer ${apikey}` } })
  ```
  Drives which scan backend (`regula` | `idscanly` | none) and which document types are offered per property; `extended_logging` gates the IDScanly review-page Sentry/console dump (see [idscanly/pages/review/review.page.ts](../src/app/idscanly/pages/review/review.page.ts)). No row / error ⇒ everything cleared (scan disabled, logging off).
- Also read (only `scan_vendor, scan_doc_types`, keyed by `?property_id=`) as the second half of the `config` Edge Function's combined response — currently unused by any caller of that function; `AppConfigService.runVersionGate()` only inspects `app_config`.
- RLS: a public `SELECT` policy ("Allow read from app") grants read to the anon/publishable key.

### 3. `feedback` — write-only, in-app feedback

Used by [feedback-sheet.component.ts](../src/app/components/feedback-sheet/feedback-sheet.component.ts), surfaced from the home header lightbulb and Settings → "Request a Feature" (both via `<app-feedback-sheet>`). Goes through the `feedback` **Edge Function** (`POST {supabaseUrl}/functions/v1/feedback`), not a direct table insert.

Row shape:

```ts
{
  type: 'feature_request' | 'feedback',   // from the sheet's segmented control
  content: string,                         // trimmed textarea
  user_id: auth.userId(),
  user_name: auth.name(),
  user_email: auth.email(),
  property_id: String(property?.property_id ?? ''),
  property_name: property?.property_name ?? '',
  app_version: Config.APP_VERSION,
}
```

- Columns: `id, created_at` (defaulted) + the 8 fields above.
- On insert error, the sheet stays open with an inline error and preserves typed text (no toast — the app has none); on success it swaps to an in-sheet confirmation. Triage happens directly in the Supabase dashboard — the app can never read feedback back.

## Edge Functions

| Slug | Purpose | Auth | Reads/writes |
|---|---|---|---|
| `config` | Combined boot-time config fetch | `verify_jwt: false`, service-role key server-side | `app_config` (by `?platform=`) + `property_config` (by `?property_id=`, currently unused data) |
| `feedback` | Feedback/feature-request insert | `verify_jwt: false` | `feedback` table |
| `idrecognition` | IDScanly OCR proxy | `verify_jwt: true` (anon JWT satisfies it) | no direct table access — see [idrecognition-handoff.md](idrecognition-handoff.md) |
| `external-result` | IDScanly scan-feedback proxy — final saved values posted back to the scan's session | `verify_jwt: true` + server-side live-session/`scan_vendor` check, mirroring `idrecognition` | reads `property_config` for the vendor check — see [external-result-handoff.md](external-result-handoff.md) |

## Summary table

| Table | Operation | Caller(s) | Access pattern | RLS | Purpose |
|---|---|---|---|---|---|
| `app_config` | `SELECT` (by `platform`) | `AppConfigService.runVersionGate()`; `LanguageService.fetchEnabledLanguages()` | Edge Function (`config`); direct REST | public read | Force-update gate + language allowlist, checked at boot + resume + Settings open |
| `property_config` | `SELECT` (by `property_id`) | `PropertyConfigService.load()` | direct REST | public read | Per-property scan vendor/doc-types/logging opt-in |
| `feedback` | `INSERT` | `FeedbackSheetComponent.submit()` | Edge Function (`feedback`) | insert-only, dashboard-triage | User-submitted feature requests / feedback |

No other Supabase tables, RPCs, storage buckets, or realtime channels are used anywhere in the app.

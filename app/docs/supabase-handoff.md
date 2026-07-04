# Supabase Integration — Handover

## Client setup

[src/app/services/supabase.ts](../src/app/services/supabase.ts) — `SupabaseService` is a `providedIn: 'root'` singleton with a lazily-created `SupabaseClient`:

```ts
this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
```

Exposes one getter, `db`, used directly by consumers (`this.supabase.db.from(...)`). No wrapper methods — callers use the raw Supabase JS client.

## Auth / keys

- **Project URL:** `https://qiwhynwwgicpyeszecuj.supabase.co`
- **Key used:** the **publishable (anon) key** `sb_publishable_rd0rgQytObIOQsYq26xMeg_WNpekL7h`, hardcoded identically in [environment.ts](../src/environments/environment.ts) and [environment.prod.ts](../src/environments/environment.prod.ts) (same Supabase project for dev and prod — no separate dev project).
- This is safe to ship client-side **only because every table is gated by Row Level Security (RLS)** — there's no service-role key in the app. Each table's access is whatever its RLS policy allows for the `public` role with this key.
- No SabeeApp PMS token/session is involved — Supabase auth is completely independent of the `AuthService`/`/token` flow used for the main API. The only overlap is that `AuthService` fields (`auth.userId()`, `auth.name()`, `auth.email()`, `auth.selectedProperty()`) get **copied into row payloads**, not used for authentication.

## Tables and what's fetched

### 1. `app_config` — read-only, version gate

Used by [src/app/services/app-config.ts](../src/app/services/app-config.ts) (`AppConfigService.runVersionGate()`), called from [src/app/app.component.ts](../src/app/app.component.ts) at boot and on app-resume.

```ts
this.supabase.db.from('app_config').select('platform, minimum_version').eq('platform', platform).single()
```

- Columns: `id, platform, minimum_version, updated_at` (no `kill_switch`/`message` columns exist).
- `platform` is `'ios'` or `'android'` (web/PWA reads the android row).
- Raced against a 3s timeout (`CONFIG_TIMEOUT_MS`); on timeout/error/null it **fails open** (`{ blocked: false }`) and logs a Sentry exception — so an unreachable Supabase never locks users out.
- If `Config.APP_VERSION` < `minimum_version`, the app routes to the non-dismissible `/update-required` screen.
- RLS: a public `SELECT` policy ("Allow read from app") grants read to the anon/publishable key.

### 2. `feedback` — write-only, in-app feedback

Used by [src/app/components/feedback-sheet/feedback-sheet.component.ts](../src/app/components/feedback-sheet/feedback-sheet.component.ts), surfaced from the home header lightbulb and Settings → "Request a Feature" (both via `<app-feedback-sheet>`).

```ts
this.supabase.db.from('feedback').insert(row)
```

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
- RLS: single **insert-only** policy, role `public`, `with_check: true` — the app can never read feedback back, only write it. Triage happens directly in the Supabase dashboard.
- On insert error, the sheet stays open with an inline error and preserves typed text (no toast — the app has none); on success it swaps to an in-sheet confirmation.

## Summary table

| Table | Operation | Caller | RLS | Purpose |
|---|---|---|---|---|
| `app_config` | `SELECT` (single row by `platform`) | `AppConfigService.runVersionGate()` | public read | Force-update gate, checked at boot + resume |
| `feedback` | `INSERT` | `FeedbackSheetComponent.submit()` | public insert-only | User-submitted feature requests / feedback |

No other Supabase tables, RPCs, storage buckets, or realtime channels are used anywhere in the app — `grep` for `supabase` only turns up these two consumers plus the service itself and the environment files.

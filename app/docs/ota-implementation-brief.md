# Briefing: Implement Live Updates (OTA)

**Repo:** SabeeApp GO
**Decision made — this is implementation, not evaluation.**

---

## What we're building

Live (OTA) updates via `@capawesome/capacitor-live-update`, hosted on **Capawesome Cloud ($9 tier)**. Web-layer changes ship without an App Store / Play release. Cadence: 2–4 releases/week, 450 active devices.

## What you already established (don't re-investigate)

- Capacitor 8.3.1, no Cordova
- `capacitor.config.ts`: `webDir: 'www'`, no `server.url`
- No custom native code (`AppDelegate.swift` boilerplate, `MainActivity` one-liners)
- No Angular service worker
- No offline queue — app is 100% pull-based, stale-while-revalidate
- **An existing Force Update gate:** `src/app/services/app-config.ts` + `app-version.ts`, checking a Supabase `app_config` table keyed by native platform + minimum version, on launch and resume
- Two flows hold unsaved in-memory state with no draft persistence: **IDScanly scan flow** (camera → scanning → review) and the **guest-edit form**

Context: Regula and other native SDKs are being dropped; IDScanly OCR is server-side. Native releases will be calendar-driven only, roughly 1–2 per year.

---

## Account setup (done — use these values)

- Organization: `thePass Ltd`
- App: `SabeeApp GO`
- **App ID: `65afcebf-188f-4000-a966-a07d671bd66f`**
- Plan: Live Updates Starter ($9) — 1,000 MAU / 100 GB transfer. Currently ~509 devices.
- Channels: `production` (protected), `beta`, `dev`
- CLI auth: the `CAPAWESOME_CLOUD_TOKEN` environment variable. **Never read, echo, or commit
  the token value.**
- Bundle signing: RSA 4096 key pair, generated 2026-08-29. The private key is held outside the
  repo and is never committed, echoed, or pasted anywhere. The **public key** below goes into
  `capacitor.config.ts` and is committed — it is public by design.

**Public key** — use exactly this value, as a single line with no internal line breaks:

```json
{
  "plugins": {
    "LiveUpdate": {
      "publicKey": "-----BEGIN PUBLIC KEY-----MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAwQJ+fETluHowvaRcz2ZlsQbuOarOiRPOE1RclxYAuen+lxy3n0kVVmht0oyhwrtUbsc6rWZaFImr73AF7idabr6SpJ6CNHEO37zV7WAQu5fOTEDAPtXsegKPDQl5bIAY6rxxK3hYpVP0e5WOIhh6kA9odgoseMCu7T3t7VdDOmwjco6jUpGl+zAKxnrpqalHh2jIUjfdLNZ8AmsuQRnY+HQCt/k2aop05wtKi6htyIseCZYslX+kx7H6/sg5mylSQr1q/egkILt3otYOsJFglPPxdH2vvCnLoueO6ScxZvJZjWoVAXJ43WgLTjnxJ8gtf2gLq/kR9x3TGdFi1UpvwELtaroVlzj4OwiclI/biXo3lwVyBkdfHFCUsFnHiUx2v9xdvCcLwWsSb8IKEMoy+UDTNlEDuLmKZ4ET4dHDW9VoeeMm55g+P09O6mN7kodpbm2oRlcfuVD+zKMSTSgZQd+xmtwFDrdR2a4PFKknXYL/5LW0kUVVzcYOkWwgEVbV+ktmU/AItYtv02TJF+YEt4GFr72GUUymbMqKCNUEjhoVCBpnkGjMC2WI12nVK8Lhloa5rbCeEFARS6J4M/7hjWK5uQIvCs8lZtfdJseHaeO7TLzQeEK+wtTNL4KRoiz2F0XuLrJKz7kK7g1sznF2Z2H60Bntaagrj8NuWCTaGQ8CAwEAAQ==-----END PUBLIC KEY-----"
    }
  }
}
```

Note: this key pair is effectively permanent. The public key is compiled into every binary from
here on, so it cannot be rotated without a store release and an adoption wait. Do not regenerate it.

Useful CLI commands (pattern is `apps:<resource>:<action>`; all accept `--json`, `--yes`):

```
npx @capawesome/cli apps:liveupdates:upload --path www --channel <name> --app-id <id> \
    --android-min <v> --ios-min <v>
npx @capawesome/cli apps:channels:create --app-id <id> --name <name> [--protected]
```

`--android-min` / `--ios-min` / `--android-max` / `--ios-max` are how §6 native version targeting
is enforced — use them on every upload rather than building our own gate.

---

## Implementation

### 1. Plugin and native config

Install and sync. In `capacitor.config.ts`, set at minimum: `appId`, `defaultChannel`, `publicKey`, and **`readyTimeout`**.

⚠️ **`readyTimeout` defaults to 0, which disables rollback.** It must be set explicitly. Start at 10000ms.

Set the auto-update strategy so the plugin does **not** apply updates on its own — we drive the trigger ourselves (see §3).

These values are native config: changing them later costs a store release. Flag anything you're unsure about rather than guessing.

### 2. A single `LiveUpdateService`

The **only** file in the app that touches the plugin. Nothing else may import it. This is what keeps a future migration to self-hosted bundles down to one file.

Responsibilities: call `ready()`, check for and download bundles, decide when to apply, emit telemetry.

### 3. Trigger: resume, with a busy guard

**Apply on resume (background→foreground), not on launch only.** Staff leave the app resident for days — a launch-only trigger would recreate the slow-adoption problem we are solving.

Ordering at launch and resume: **the existing Supabase force-update gate runs first.** If it blocks (native binary below minimum), do not fetch or apply a bundle. Only proceed to live-update logic when that gate passes.

### 4. `ready()` placement

Call it once the app is **genuinely functional** — after session restore and the first successful backend call — not when Angular has merely bootstrapped.

Rationale: a bundle that renders but cannot reach the backend must still roll back. Calling `ready()` too early defeats the entire safety mechanism.

### 5. Busy guard

A small registry any flow can mark itself busy in. Wire it into:
- the IDScanly scan flow (camera → scanning → review, until the explicit save)
- the guest-edit form (while dirty)

While anything is registered busy, do not reload. Apply at the next resume when clear.

Keep the mechanism generic — more flows will need it later.

### 6. Native version targeting

Use Capawesome's native-version targeting so a bundle can never reach a binary that cannot run it. Even though native churn is about to drop to near zero, this must exist before the first production bundle.

### 7. Analytics

Register `app_version` **and** `bundle_version` as Mixpanel super-properties, plus events for bundle downloaded / applied / failed.

⚠️ **This must ship in the same release as the plugin.** Without `bundle_version`, `app_version` no longer identifies the running code and adoption data becomes retroactively meaningless.

Follow the existing Mixpanel PII conventions in this repo — do not introduce new user-identifying properties.

### 8. Settings/diagnostics

Display native version and bundle version, copyable. Needed the first time we debug a specific hotel.

### 9. CI publish

Add a publish step: build → zip → checksum → sign → upload to the channel. Keep the upload target isolated so it can be swapped without touching the rest.

### 10. Channel resolution at runtime

Do **not** pin the channel natively in `build.gradle` / `Info.plist`. The channel must be
resolvable per property so a hotel can be moved into or out of the pilot with a database
change rather than a new build.

Resolve it from the existing Supabase config lookup, keyed by property ID. This needs a
per-property channel mapping that `app_config` does not have today — either a column on the
property record or a small mapping table.

Constraints:
- The channel is only knowable **after login**. A fresh install with no session must fall
  back to `production`.
- **Fall back to `production` on any error, timeout, or unrecognised value.** Never fail into
  `dev` or `beta`.
- Keep this code deliberately dumb and change it rarely. It lives in the web bundle, so a
  subtly wrong version that still reaches `ready()` will not auto-revert, and fixing it means
  publishing to every channel.

### 11. Update strategy must be explicit

Set the plugin's auto-update strategy to custom/none. Not `background`, not `always-latest`.
Any built-in strategy will reload the webview on its own schedule and will eventually do it
mid-scan. The trigger is ours: resume, gated by the busy guard (§3, §5).

---

## Acceptance tests

Run on a real device, on a slow connection. In order:

1. A published bundle downloads and applies on resume
2. It does **not** apply while a scan is in progress
3. It does **not** apply while the guest-edit form is dirty
4. **A deliberately broken bundle** — one that throws before `ready()` — **auto-reverts to the previous bundle**
5. A tampered bundle is rejected by signature verification
6. A bundle targeted at a newer native version is not delivered to an older binary
7. Mixpanel events carry both `app_version` and `bundle_version`
8. The existing force-update gate still behaves as before
9. A device whose property is mapped to `beta` receives beta bundles; changing the
   mapping in Supabase moves it back to `production` without a rebuild
10. A device with no session, or a failed channel lookup, falls back to `production`

**Test 4 is the gate. If auto-revert does not work, stop and report — do not proceed to anything else.** With a 1–2 person team and no on-call, it is the only safety net that exists.

---

## Non-goals

Do not build, and do not propose:

- An update prompt ladder, staleness tiers, or update-priority levels — unnecessary at 1–2 native releases a year
- Any replacement for the existing Supabase force-update gate — it stays exactly as it is
- Self-hosted bundle hosting — decided against for now, revisit above 1,000 MAU
- Delta/differential updates — Capawesome's own guidance is that content-hashed Angular builds negate the benefit

---

## Output

Work through §1–9 in order. Before starting, list anything you need from me (`appId`, keys, channel names).

When implementation is done, report the acceptance-test results **before** anything is published to a production channel.


---

## Follow-up work from real-device acceptance testing (2026-08-30)

Test 4 (deliberately broken bundle) passed on the core mechanic: `rollback()` drops straight
to the embedded native bundle (not to the previous OTA bundle), confirmed from native source
and independently from the device's own Settings screen, Mixpanel, and Sentry. That part is
closed. Five things came out of testing it for real that need addressing before this is
called fully verified.

### 12. Rollback telemetry did not fire — fix before closing test 4

`trackBundleFailed({reason: 'rollback'})` never fired during test 4, even though the native
`rollbackPerformed` flag it reads should have been `true` on the first post-rollback `ready()`
call. This is the one event that makes a revert visible in Mixpanel at fleet scale — it not
firing on the one occasion it existed for is a design gap, not a transient blip to wave through.

Do this in order:
1. Make the failure loud in a debug build first — temporarily bypass `MixpanelService.safe()`
   for this one call, or add a breadcrumb immediately before/after it, to find out whether the
   call is even reached and if so what actually fails.
2. Regardless of what that finds, do not make this event the only record of a rollback. Add a
   `live_update_events` table in Supabase (property_id, device/session id, previous_bundle_id,
   reason, created_at) and insert into it using the same Supabase connection already used
   reliably at boot for `runVersionGate()`. Keep the Mixpanel event too, best-effort, for
   dashboards — but the thing fleet-scale monitoring reads from should not be a fire-and-forget
   client SDK call fired milliseconds after a `webView.load()`.

This table doubles as the basis for fleet monitoring: a count of rows per day/property is
enough to notice a bad publish. No new infrastructure beyond one table — reuse Supabase.

### 13. Rollback white-screen — build the loading state now

15 seconds of blank screen during the `readyTimeout` window before auto-revert is not
acceptable. Build the loading state option we discussed: a static loading state written
directly into `index.html`/CSS, outside Angular, so it renders before any JS parses. Ships via
the next OTA bundle, no native dependency, no store release needed.

Do this after §12, not before — §12 is part of what "test 4 passes" means for this project.

### 14. Replace the silent 90s resume gate with a visible update prompt

The existing design applies a staged bundle on resume only after ≥90s in background
(`MIN_BACKGROUND_MS_FOR_RELOAD`). In practice most staff will switch away briefly and bring the
app back from background in well under 90s, not force-quit it — so the resume path may rarely
fire, and adoption ends up depending on unpredictable OS-level process eviction. That
reproduces the slow-adoption problem this project exists to fix.

Replace it with a foreground "Update ready" prompt, shown as soon as a bundle is staged,
defaulting to auto-apply after a short grace period (e.g. "Update ready — applying in 8s",
with a "not now" option). No background-duration threshold is needed once the reload is a
visible, consented action instead of a silent one. This is an internal, fully-controlled
fleet — there is no reason to be as conservative here as a consumer app would need to be.

- Reuse the existing busy guard / dirty-tracking to suppress or pause the countdown during an
  active scan or a dirty guest-edit form — same protection the silent resume path had.
- Keep the quiet ≥90s-background resume path running underneath as a backstop for devices that
  are genuinely backgrounded rather than in active use.
- Add `trackBundleUpdatePrompted` / `trackBundleUpdateAccepted` / `trackBundleUpdateDismissed`
  alongside the existing bundle events, so real acceptance rate is visible.

### 15. No active session — always force the latest bundle immediately

Found via a real fresh-install test: reinstalling the app and using it without backgrounding it
left the device on the embedded native bundle for the entire first session, since "boot
stages, resume applies" assumes a resume will come along to apply what got staged at boot.

This is a "no session" problem, not a "first-time user" problem, and the fix is a general
rule: whenever there is no active/resumed session — covers first install and any time the app
is sitting at the login screen pre-authentication — check-and-apply should run immediately and
unconditionally. No busy guard check needed (nothing can be in progress before login, since
scan sessions and dirty guest-edit forms only exist post-login), no countdown, no dismiss
option. Use the same loading transition from §13 so it never looks broken.

Per the existing channel rule (§10), this always targets `production` pre-login, which is
correct — a fresh install has no property yet. Once login + property selection completes,
control hands off to the property's channel and the §14 prompt-based mechanism, since real
in-progress state exists from that point on.

Verify: the login screen should render immediately rather than blocking on the bundle check,
applying the update via the loading transition once it resolves — a slow-to-appear login
screen just trades one bad first impression for another.

### 16. Native-fallback staleness — operational, not code, but keep in mind

Because rollback always lands on the embedded native bundle (§ above, confirmed from source),
that floor gets staler every week without a native release. At 2-4 OTA releases/week, the
floor could realistically be 15-20 releases behind by the time it's ever needed. Two habits,
not code changes: cut a native release periodically purely to reset the floor, independent of
whether native code changed; and don't ship a backend/API contract change the currently
embedded bundle can't tolerate until the floor has been reset. The existing canary process
(property `6250`, iOS + Android, plus 1-2 colleagues, before anything reaches `production`) is
the main real defense against this happening at fleet scale and is already standing practice.

Separately, worth asking: does the plugin expose any alternative to full native rollback (e.g.
falling back to the last-known-good OTA bundle instead of embedded)? If not, that's a point in
favor of the self-hosted migration already planned for later, where the fallback target would
be under our own control.

### 17. Mixpanel `bundle_id` readability

The raw UUID is assigned server-side by Capawesome on upload — it's their primary key, not
something we control, and not fixable at the source. `bundle_id` already exists as a tracked
property in Mixpanel, so add a Mixpanel lookup table mapping each bundle_id to a human label
(e.g. "v42 - fix-guest-edit-crash", sourced from the `--git-ref` value already passed to
`apps:liveupdates:upload`). No app code change — just register one lookup-table row per
publish. Low priority, do this whenever convenient.

---

## Additional acceptance tests

11. From a fresh install with no session, the latest `production` bundle applies before or
    immediately as the login screen becomes usable, with no blank/broken screen during the
    transition. **Test this in isolation from channel behavior**: publish a bundle to
    `production` that is visibly different from what's embedded in the current native binary,
    then delete-and-reinstall with no login at all. Do not test this by publishing to `dev` and
    reinstalling — `dev` is only resolvable after property selection, so a fresh install will
    never see it regardless of whether this test passes, and that will look identical to this
    test failing. Confirm directly: does the pre-login boot check download and apply a
    `production` bundle immediately, or does it only stage one for a later resume? It must be
    the former.
12. The rollback in test 4 also produces a `live_update_events` row in Supabase and a
    `bundle_failed` event in Mixpanel — re-run test 4 after §12 is fixed and confirm both
13. The "Update ready" prompt from §14 appears within a few seconds of a bundle being staged
    while the app is in the foreground, counts down and applies automatically if not dismissed,
    and is suppressed while a scan or dirty guest-edit form is active

Test 4 remains the gate, now including its telemetry half (additional test 12 above) — do not
treat test 4 as closed until both the revert and its Supabase/Mixpanel record are confirmed.

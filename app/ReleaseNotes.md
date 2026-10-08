# Release Notes — OTA Bundles

Log of every bundle pushed to Capawesome Cloud, newest first. One entry per `npm run publish:liveupdate <channel>` run.

**Format:**

```
### YYYY-MM-DD — <channel> — <bundle id>
- <what changed, one bullet per user-facing/behavioral change>
```

**Promoting a bundle to another channel** (`npm run promote:liveupdate <bundle-id> <channel>`, see [scripts/promote-liveupdate.sh](scripts/promote-liveupdate.sh)) attaches the exact same build to a new channel with no rebuild — so it gets its own entry here, same bundle ID, new channel/date, bullets copied verbatim from the original entry (the content is identical by construction; only the channel changed).

---

### 2026-10-08 — dev — fc5b2c04-7017-4869-bcca-6a91b222d504
> Branch `feature/country-picker-search`, built from an **uncommitted** working tree — the bundle's `git 351f4e5` tag does NOT contain these changes. Promote by bundle id (`promote:liveupdate`), not by re-publishing from a commit.
- Guest Edit: Citizenship and Address country open a searchable bottom sheet instead of the long native dropdown (search ignores case/accents, matches 2-letter codes)
- The sheet shows the property's 10 most-used countries on top, then a divider, then A–Z; counts are per device and per property, and go up only when a save changes the country (Edit screen and scan-result save)
- "Clear" button in the sheet header removes a chosen country
- Mixpanel: new `country_picker_used` event (field, outcome, picked_from, top_rank, top_count, used_search, query_length, changed — never the country itself)

### 2026-10-06 — prod — f8dd23d6-031e-4597-9363-ba493a8e090d
> git `0edd3f3`. Published to `dev`, device-tested, promoted (not rebuilt) to `early` and `prod` the same day. Same as `ff034331` below plus the timing change.
- Mixpanel: `scan_succeeded` / `scan_failed` now carry `recognition_duration_ms` (IDScanly request time) and `payload_kb` (submitted image size) — no user-facing change

### 2026-10-06 — early — f8dd23d6-031e-4597-9363-ba493a8e090d
- Same bundle/changes as the `prod` entry above — promoted, not rebuilt.

### 2026-10-06 — dev — f8dd23d6-031e-4597-9363-ba493a8e090d
- Same bundle/changes as the `prod` entry above.

### 2026-10-06 — prod — ff034331-e646-468f-8f83-707d5dbadf6a
> Bundle built from git `2776f1a` (working tree), published to `dev` 2026-10-03, device-tested, promoted (not rebuilt) to `early` and `prod` on 2026-10-06. Does not include the IDScanly recognition-timing commit `0edd3f3`.
- Home filter chips with Manage Filters (create, reorder, edit, delete with confirmation); +7 / +14 days filters now include today
- First-run guided tours for Home's filter strip and the My filters screen (shared tour component; the Scan walkthrough now uses it too)
- Arrived/departed section headers always visible; a checked-out guest is no longer miscounted as "not yet arrived"
- Mixpanel: filter-strip engagement tracking (no user-facing change)

### 2026-10-06 — early — ff034331-e646-468f-8f83-707d5dbadf6a
- Same bundle/changes as the `prod` entry above — promoted, not rebuilt.

### 2026-09-23 — dev — 2dfa357b-1397-4799-9f9e-164fade555e8
> git `b611b5e`. Implements `app/docs/feature-education-cards-handoff.md`.
- New Help & tips education-card feature: Home shows up to 3 unseen bundled tip cards below arrivals (never above), tapping one opens a content-sized detail sheet (image/title/body/optional "Try it" deep link/thumbs feedback/Next tip), Settings gains a "Help & tips" entry leading to a searchable, category-filtered full list
- Seed cards cover real shipped features only: Auto-Lock interval, Language switching, Search, "Open in PMS", ID scanning
- "Reset Scan Tour" moved from Settings onto the new Help & Tips page

### 2026-09-08 — dev — 6e0fefa1-a4a8-409c-a728-2dc78649cdf7
> Rebuild from `main` (git `b1754b9`) after merging `idscanly-identity-doc-address` in full — same content as the bundle below plus one addition.
- Debug-only: Sentry breadcrumb instrumentation on the scan-result Edit path (temporary, no user-facing change)

### 2026-09-08 — dev — 32c78152-6ec0-432e-980c-bf1791bfe268
> Integration build (git `aab2a3d`, branch `dev-push-2026-09-08`) combining two sibling branches on top of the bundle below, since `dev` rebuilds cumulatively: `add-mixpanel-unlock-tracking` in full, plus just the fix commit from `fix/version-gate-log-not-exception` (its docs reorg and Ionic-scaffolding cleanup were deliberately left out of this push).
- Mixpanel: new `session_unlock_result` event per biometric-lock episode (`outcome`, `trigger`, `attempts`, `auto_lock_minutes`, `biometry_type`) — no user-facing change
- Fix: `version_gate config unavailable` now reported as a Sentry Log, not an Issue — no user-facing change

### 2026-09-07 — dev — 7c64a1af-a9f8-46b4-8883-37c2a305069c
> Retroactively logged — this publish (git `242e615`) was recorded in the CLAUDE.md changelog but missed an entry here at the time.
- IDScanly: identity-document scans (passport/ID card) now capture an embedded address when the OCR returns one, without affecting the "ID scanned" flag

### 2026-09-03 — prod — fd51569d-983c-4d7e-a751-f3bbb3f419f4
> Promoted from `dev` (build #36, git `b10451a`) — same bytes, no rebuild. First production release of the Scan-screen walkthrough below; content also includes the three `dev`-only fix entries beneath this one, since each `dev` push rebuilds the bundle cumulatively.
- First-run Scan-screen walkthrough: explains the Card/Passport Document form toggle, Auto-Capture, and Skip, shown once per device, with call-out arrows pointing at each real control
- Camera no longer starts until the walkthrough finishes; a persistent close button guarantees an exit regardless of tour state
- Settings gained a "Reset Scan Tour" debug button (property 6250 only)

### 2026-09-03 — early — fd51569d-983c-4d7e-a751-f3bbb3f419f4
> Promoted from `dev` (build #36, git `b10451a`) — same content as the `prod` entry above.

### 2026-09-03 — dev — fd51569d-983c-4d7e-a751-f3bbb3f419f4
- Fix: the walkthrough's Skip arrow drifted from the button when its card had to clamp near the screen edge — the arrow now tracks the real button independently of the card's position

### 2026-09-03 — dev — 8f21af87-c84b-48b3-8ea2-8acdd66aab30
- Fix: the walkthrough's Auto-Capture arrow pointed at empty space left of the actual toggle (it's one of a centered button pair, not edge-anchored) — the callout now centers itself on the real button

### 2026-09-03 — dev — 9443975e-88ce-43b8-b227-3319aca0a644
- Fix: the walkthrough's call-out arrow didn't render on the Document form step, and had a visible gap on the other two — now a pseudo-element flush against each card's edge

### 2026-09-03 — dev — 20e2af04-a14b-4e25-b292-ada24770bd25
- First-run Scan-screen walkthrough: explains the Card/Passport Document form toggle, Auto-Capture, and Skip, shown once per device
- Camera no longer starts until the walkthrough finishes (was running underneath it, could desync the tour); added a persistent close button on the walkthrough overlay
- Settings gained a "Reset Scan Tour" debug button (property 6250 only) to re-trigger the walkthrough

### 2026-09-01 — dev — dbdadeff-d4d1-487c-b429-a3b8d3d29a57
- Mixpanel `scan_started` now carries a `source` (`guest_card` | `fab_menu`), so scan entry point is reportable — no new event, no user-facing change

### 2026-08-31 — prod — ed96716e-499f-4e10-8c07-e5c880cf583b
- Force logout on a rejected refresh token now also covers HTTP 403 (the shape the API actually uses), not just 401
- Force logout on "no refresh token available" too, instead of retrying forever
- Refresh request unified into one shared function (`AuthService.performRefreshRequest()`) used by the real refresh flow — no more risk of it drifting from a separately hand-built debug path
- Refresh request no longer sends `client_id` or a `Token` header — matches the API's own documented contract for this endpoint, neither affected the underlying bug
- Diagnostics on a rejected refresh: device-id comparison (current vs. the id embedded in the token itself) always logged; full request/response detail gated behind the same per-property `extended_logging` flag IDScanly's diagnostics already use
- Root cause found: a stale refresh token whose embedded device id no longer matched the device's current one — see CLAUDE.md changelog for the full investigation. *Why* the device id itself changed historically is still unresolved.

### 2026-08-31 — early — ed96716e-499f-4e10-8c07-e5c880cf583b
- Same bundle/changes as the `prod` entry above — promoted, not rebuilt.

### 2026-08-31 — dev — ed96716e-499f-4e10-8c07-e5c880cf583b
- Same bundle/changes as the `prod` entry above.

### 2026-08-31 — dev — 1317c33c-1a29-4145-86c1-3ef2070d4212
- Force logout on a rejected refresh token, not just HTTP 401 (was silently retrying forever on a dead refresh token)

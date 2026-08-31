# Release Notes — OTA Bundles

Log of every bundle pushed to Capawesome Cloud, newest first. One entry per `npm run publish:liveupdate <channel>` run.

**Format:**

```
### YYYY-MM-DD — <channel> — <bundle id>
- <what changed, one bullet per user-facing/behavioral change>
```

**Promoting a bundle to another channel** (`npm run promote:liveupdate <bundle-id> <channel>`, see [scripts/promote-liveupdate.sh](scripts/promote-liveupdate.sh)) attaches the exact same build to a new channel with no rebuild — so it gets its own entry here, same bundle ID, new channel/date, bullets copied verbatim from the original entry (the content is identical by construction; only the channel changed).

---

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

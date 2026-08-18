# Parked Topics

Ideas and concerns raised during development that were deliberately **not** acted on at the time — captured here so they aren't lost, not because they're queued for immediate work. When one is picked up, move it into `app/CLAUDE.md` §9 "Up Next" (or just implement it) and remove it from this file.

---

## Hash `user_id` before sending to Mixpanel

**Date:** 2026-08-12
**Status:** Open / not started

**Context:** `identifyToMixpanel()` ([auth.ts](../src/app/services/auth.ts#L83-L95)) sends the real SabeeApp `user_id` — a small sequential integer (e.g. `4859`) — straight to Mixpanel as `distinct_id`, via `MixpanelService.identify()` ([mixpanel.ts](../src/app/services/mixpanel.ts#L50-L62)). Only staff users are identified this way (never guests), and the ID itself carries no PII — but it does expose your internal ID scheme to a third-party tool: anyone with Mixpanel export access could roughly infer how many staff accounts exist, and if the same ID is reused as a key elsewhere it becomes a cross-system correlation handle.

**Proposed resolution:** Replace the raw `user_id` with a **keyed hash** — `HMAC-SHA256(user_id, SECRET)` — where `SECRET` lives server-side only and never ships in the app bundle.

- A **plain, unsalted hash** (`SHA256(user_id)`) is *not* sufficient: SabeeApp `user_id`s are a small integer space, so anyone with the hashed values can precompute `SHA256(1)` through `SHA256(999999)` in milliseconds and reverse the whole set. This is true regardless of whether the hash is computed client-side or server-side — the fix is the secret, not the location.
- Because of that, the hashing **must happen on the backend** (e.g. `GET /users/me` returns a pre-hashed `analytics_id` field instead of, or alongside, the raw `user_id`). The app would just forward that opaque value to `mixpanel.identify()` unchanged.
- To look up a specific user's Mixpanel activity, compute the same `HMAC-SHA256(user_id, SECRET)` from a backend context that holds the secret — one-way for everyone else, reversible only where the secret is available.

**Scope note:** this requires a SabeeApp API change (not something this repo can do alone) — flagging that as the reason it wasn't just implemented inline.

# Handoff: Auto-Lock Interval Setting

## Context

SabeeApp GO's Settings screen (`Language` / `Request a Feature` / `Lock Now` / `Log out`) already has some kind of idle-lock mechanism — the manual "Lock Now" button implies the app can already force a lock/re-auth state. This task adds a new row: a user-configurable interval for how long the app waits before it locks itself automatically.

**This session could not access the actual SabeeApp GO source repo** — only a folder of PRDs/docs. So before touching UI, first locate:
1. Wherever the existing idle-lock timer/logic lives today (triggered by "Lock Now", or presumably an existing background/foreground or inactivity timer) — this task needs to make its duration read from the new setting instead of whatever is hardcoded there now.
2. The `Language` button's component/implementation — reuse its exact button style and (if it opens a picker/action sheet) its sheet component, so the new control is visually and structurally consistent rather than a one-off.

## Scope note — read before implementing

There is a `app-lock-prd.md` in this same folder (drafted 2026-08-27) proposing a materially different design: idle timeout as **server-owned/admin-set per property** (not user-adjustable on-device), and PIN-vs-biometric resolved automatically by device capability rather than picked by the user. Tamas explicitly decided (2026-08-31) to set that PRD aside and ship this simpler, fully local version first, to see how users react before investing in the bigger rework. Don't reconcile the two — just be aware the PRD exists and describes a different intended end-state, in case that context matters later.

Also explicitly out of scope for this pass: any PIN / Biometric ID selection UI. Earlier iterations of this design combined interval + auth-method selection in one modal; that's been deliberately cut down to interval-only.

## UI spec

**New row:** a pill-style button labeled `Auto-Lock: {value} min`, in the same visual style as the existing `Language` / `Request a Feature` / `Lock Now` rows (full-width, rounded, outlined, blue text, centered, optional leading icon — a clock/timer icon fits the pattern the others use). Place it directly after `Lock Now` (grouped with lock-related settings) and before `Log out`.

**Tapping it** opens a bottom sheet / action sheet (reuse whatever sheet mechanism `Language` uses) listing five options: **10, 30, 60, 90, 120 minutes**. Single-select list; tapping an option applies it immediately and dismisses the sheet — no separate "Save"/"Confirm" step. The current value should be visibly indicated as selected when the sheet opens (checkmark or highlight, matching whatever pattern `Language`'s sheet already uses for its current selection, if any).

**Default value:** flag as an open question — confirm with Tamas what the current hardcoded idle-lock duration is today (if the app already locks after some fixed interval), and use that as the default for users who've never touched this setting, rather than picking an arbitrary default.

## Storage

**Local device setting only** — not synced to the server or the user's account. Use whatever local key-value storage mechanism SabeeApp GO already uses elsewhere for device-local settings (Capacitor Preferences API is the conventional choice for this stack if nothing else is already established — check for precedent before introducing a new pattern). Store as a plain integer (minutes).

Wire the existing idle-lock timer to read this value instead of its current hardcoded duration.

## Mixpanel

Log the chosen value as a **profile property** (e.g. `auto_lock_interval`), via `people.set`, not as an event. This is deliberate: a profile property lets Tamas query, via a Mixpanel Insights breakdown, both (a) how many users have ever touched this setting at all (profiles where the property exists) and (b) the distribution of values they've chosen — without needing a separate funnel/event analysis.

**Critical constraint:** only call `people.set('auto_lock_interval', value)` when the user actively picks an option from the sheet. **Never** set it on screen load, on app init, or as a side effect of applying the default — the property's mere presence on a profile is being used as the "used this feature" signal, so setting it automatically would make that signal meaningless. Users who never open the sheet should simply have no `auto_lock_interval` property on their profile.

Project is on EU residency (`eu.mixpanel.com` / `api-eu.mixpanel.com`) — make sure whatever Mixpanel client/wrapper is already in use in the app is used here too (don't hand-roll a new API call path).

## Out of scope

- PIN / Biometric ID selection (see Scope note above).
- Server-side / admin-set timeout (see `app-lock-prd.md` for that alternative design — not being built now).
- Any change to the existing "Lock Now" manual-lock behavior beyond making its idle-timer duration configurable.
- An "off"/"never lock" option — not requested, don't add it speculatively.

## Open questions for the implementer to confirm before/while building

- Where does the existing idle-lock timer live, and what's its current hardcoded duration (needed for the default)?
- Does `Language`'s sheet show a "currently selected" indicator? If yes, mirror that pattern here; if the component doesn't support it, flag back rather than guessing.
- Confirm the local storage mechanism already used for device-local (non-synced) settings elsewhere in the app, if any exists, before introducing a new one.

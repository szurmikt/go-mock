# SabeeApp Go — Mixpanel Tracking Plan

A reference for the Mixpanel project: every event, its properties, the identity
model, and what is deliberately **not** tracked. Use it to populate **Lexicon**
(descriptions + tags) and to build reports.

- **Project token:** `03021fbbdcc35a8b657f5b91d4ad93b2` (prod). Dev currently uses the
  same token — distinguish with the `environment` super property until a dedicated
  dev project exists.
- **SDK:** `mixpanel-browser` (Capacitor WebView → covers web/iOS/Android), initialised
  in [src/main.ts](../src/main.ts) with `persistence: 'localStorage'`, `track_pageview: false`.
- **Wrapper:** all calls go through [`MixpanelService`](../src/app/services/mixpanel.ts).

---

## Privacy rule (non-negotiable)

This is an **internal staff tool** that handles **guest PII** during scans. Events
carry **only categorical / numeric metadata**. The only person ever identified is the
**logged-in staff member** (`identify` + `people.set`).

**Never sent:** guest names, emails, document numbers, dates of birth, nationality,
address, or raw search text.

---

## Super properties (attached to every event)

| Property | Type | Values | Notes |
|---|---|---|---|
| `app_version` | string | e.g. `1.1.0` | from `Config.APP_VERSION` |
| `platform` | string | `web` \| `ios` \| `android` | Capacitor platform |
| `environment` | string | `development` \| `production` | build flag — use to filter dev noise |
| `api_mode` | string | `live` \| `test` | the test/live API toggle |
| `session_id` | string | uuid | set per session; tags every event in that session |

---

## Identity model

- `identify(user_id)` fires once the staff `user_id` is known (after property select /
  `/users/me`), on every login and on session restore.
- **Profile (`people.set`)**: `$name`, `$email` (staff member), plus `property_id`,
  `property_name`, `company` for the active property.
- `reset()` on **logout** (all logout paths) so the next user is not merged with the previous.
- `user_id` is the SabeeApp database user id — stable, never the email.

---

## Events

### Usage & sessions

| Event | When | Properties |
|---|---|---|
| `session_started` | cold start, or returning to foreground after >30 min idle | `session_id` |
| `session_ended` | app sent to background | `session_id`, `duration_seconds` (int) |
| `login_completed` | MFA verification succeeds | `method` = `mfa` |

- **"When / how often they use the app"** → `session_started` count per user (DAU/WAU,
  Mixpanel **Retention** & **Frequency** reports — no extra event needed).
- **"How long they use it"** → sum `session_ended.duration_seconds` per user/day, or per
  `session_id`. (Each foreground stint emits its own `session_ended`; group by `session_id`
  for total active time per session.)

### Navigation & search

| Event | When | Properties |
|---|---|---|
| `filter_chip_selected` | taps a filter chip on home (real user tap only — never on launch-restore or a delete-triggered fallback) | `filter_id`, `is_preset` (bool), `guests`, `day`, `sort`, `position` (int, 0-based index in the strip at tap time) |
| `filter_created` | saves a new filter in the Filter Editor | `filter_id`, `guests`, `day`, `sort` |
| `filter_edited` | saves an edit to an existing filter in the Filter Editor | `filter_id`, `guests`, `day`, `sort`, `is_preset` (bool — was the edited filter one of the 4 seeded presets, vs. one the user made) |
| `filter_deleted` | deletes a filter in Manage Filters | `filter_id`, `is_preset` (bool) |
| `filter_reordered` | drag-reorders filters in Manage Filters | `filter_id_order` (string[], the new order) |
| `manage_filters_opened` | taps the filter icon at the end of the chip strip | `filter_count` (int) |
| `filter_strip_session_baseline` | once per analytics session, the first time Home resolves its filter data — see "Filter engagement reporting" below | `active_filter_id`, `active_filter_position` (int), `active_filter_is_preset` (bool), `guests`, `day`, `sort`, `filter_count` (int) |
| `property_switched` | switches property via the home switcher | `property_id`, `property_name`, `from_property_id` |
| `search_performed` | commits a search (Enter) or opens a result | `query_length` (int), `results_count` (int), `from_recent` (bool) |

- **`home_filters_customized`** is a **People profile property** (`people.set`), not an
  event — set to `true` only on a user's first create/edit/delete/reorder of a filter (never
  on load/seeding). Its mere presence on a profile is the "customized this feature" signal,
  same convention as `auto_lock_interval` below.
- **`home_filter_count`** is a **People profile property** (`people.set`) — the number of
  filters the user currently has, kept in sync on every seed/create/delete. Lets Mixpanel
  report the average/distribution straight off user profiles, no event aggregation needed.
- **Filter engagement reporting** (adoption/engagement with the chip strip itself — average
  filter count, preset vs. custom usage, popular configs/positions, and per-session
  engagement intensity) has its own logic writeup: [filter-engagement-reporting.md](filter-engagement-reporting.md).

- **"Are they using recent search terms"** → ratio of `search_performed` where
  `from_recent = true`. (`from_recent` = the committed term matches a previously saved
  recent term. The query text itself is never sent.)

### App lock / unlock

The biometric session lock (§14 of `app/CLAUDE.md`) is a local, device-side lock — not a login
replacement. Its interval is a **people-profile property**, not an event:

| Property | When set | Value |
|---|---|---|
| `auto_lock_interval` | user picks a value in the Settings → Auto-Lock sheet | minutes (int) |

Set only on an explicit pick, never on load/default — its mere presence on a profile is the "has
this user ever touched the setting" signal, so auto-setting it on init would make that signal
meaningless.

| Event | When | Properties |
|---|---|---|
| `session_unlock_result` | a lock episode resolves — either the user gets back in, or gives up after 3 failed attempts and falls back to a full logout+relogin | `outcome` = `unlocked` \| `abandoned_logout`, `trigger` = `inactivity` \| `background` \| `cold_start`, `attempts` (int), `auto_lock_minutes` (int, the value in effect when the lock fired), `biometry_type` = `face_id` \| `touch_id` \| `fingerprint` \| `iris_authentication` \| `face_authentication` \| `multiple` \| `none` \| `unknown` |

- **One event per lock episode**, not per attempt — `attempts` already carries how many tries it
  took. A separate `session_locked` event was considered and dropped: every lock episode ends in
  one of the two outcomes anyway, so lock volume is derivable as `unlocked + abandoned_logout`
  (the only gap is an app force-quit while locked, not worth a dedicated event).
- **`biometry_type` is not proof of which method unlocked the app.** `capacitor-native-biometric`'s
  `verifyIdentity()` resolves with no payload on success, so a device-passcode fallback
  (`useFallback: true`) is indistinguishable from a real Face ID/Touch ID success at the JS level —
  this plugin cannot report which one actually happened. `biometry_type` only reports what's
  *enrolled* on the device (from `NativeBiometric.isAvailable()`), as a coarse proxy.
- **`abandoned_logout` is a real logout**, not a "password unlock" — the "Use password instead"
  button (shown after 3 failures) calls `auth.logout()` and routes to a full re-login against the
  API, discarding the session rather than decrypting it.
- **"What auto-lock interval do people actually use"** → `session_unlock_result.auto_lock_minutes`
  distribution (point-in-time value at each lock, independent of the `auto_lock_interval` profile
  property, which only reflects the *current* setting).
- **"How often do people fail out entirely"** → `session_unlock_result` where
  `outcome = abandoned_logout`, as a share of all lock episodes.

### Guest editing

| Event | When | Properties |
|---|---|---|
| `guest_updated` | Guest Edit form saved successfully | `reservation_code`, `property_id`, `from_scan` (bool), `fields_changed` (int) |

### Reservation status & notes (Reservation Detail)

| Event | When | Properties |
|---|---|---|
| `reservation_status_sheet_opened` | Status sheet opened | `reservation_code`, `property_id`, `source` (`fab`/`pill`), `current_status` |
| `reservation_status_changed` | Forward status change attempted | `reservation_code`, `property_id`, `from_status`, `to_status`, `success` |
| `reservation_status_reverted` | Long-press revert to an earlier status attempted | `reservation_code`, `property_id`, `from_status`, `to_status`, `steps_back`, `success` |
| `reservation_note_added` | Note posted | `reservation_code`, `property_id`, `note_type` (`reservation`/`room`), `housekeeper_visible` (reservation notes only), `success` |
| `reservation_note_deleted` | Note deleted | `reservation_code`, `property_id`, `note_type`, `success` |

- **"Open the sheet but don't change anything"** → `reservation_status_sheet_opened` vs. changed + reverted.
- **"Mistakes / corrections"** → `reservation_status_reverted` volume, `steps_back` distribution.
- Privacy: never the note text or the selected room-note dates.

### VIZA reporting (Reservation Detail sheet + Guest Edit VIZA mode)

Every event carries `reservation_code`, `property_id`. Field **names** and counts only — never values.

| Event | When | Properties |
|---|---|---|
| `viza_sheet_opened` | Report-to-VIZA sheet opened from the FAB | `total_guests`, `sendable_count` (scanned/modified), `incomplete_count` (sendable but missing a mandatory field), `not_scanned_count`, `sending_count`, `sent_count`, `auto_checked_count` (complete cards pre-ticked) |
| `viza_banner_shown` | "Ready for VIZA reporting" banner became visible on Reservation Detail (once per page visit) | `ready_count` (complete sendable guests), `total_guests` |
| `viza_banner_tapped` | Banner tapped (opens the sheet) | — |
| `viza_card_toggled` | Staff tick / untick a complete card | `checked` (bool), `was_edited` (bool, status `modified`) |
| `viza_card_blocked` | Checkbox tapped on an incomplete card (stays unchecked) | `missing_fields` (field names), `missing_count` |
| `viza_edit_opened` | Edit tapped on a card | `reason` (`missing_fields`\|`voluntary`), `missing_fields` |
| `viza_edit_saved` | Save on Guest Edit in VIZA mode | `changed_fields` (field names), `changed_count`, `now_complete` (bool), `success` |
| `viza_edit_abandoned` | Left Guest Edit VIZA mode without saving | `had_changes` (bool) |
| `viza_report_sent` | Send tapped (fires after the attempt) | `selected_count`, `sendable_count`, `edited_count` (selected with status `modified`), `unticked_count` (complete cards left unticked), `success`, `error_kind` (`http_error`\|`api_rejected`, failures only) |
| `viza_sheet_closed` | Sheet closed without sending | `sendable_count`, `selected_count` |

- **"Does read-only-first hold?" (edit rate)** → `viza_edit_opened` / `viza_sheet_opened`, split by `reason`; `incomplete_count` / `sendable_count` on open.
- **"Which fields does the scan miss?"** → `missing_fields` breakdown on `viza_card_blocked` / `viza_edit_opened`; `changed_fields` on `viza_edit_saved`.
- **"One-tap rate"** → `viza_report_sent` where `unticked_count = 0` and `edited_count = 0`.
- **Does the banner nudge work?** → `viza_banner_tapped` / `viza_banner_shown`, then how many of those sessions end in `viza_report_sent`; compare send rates for sheets opened via banner vs. the FAB (`viza_sheet_opened` right after a tap).
- **Drop-off** → `viza_sheet_closed` and `viza_edit_abandoned` vs. `viza_report_sent`; failures via `success = false`.

- **"Do they edit guest cards"** → `guest_updated` volume / per-user.
- **"How many times they change scanned data"** → `guest_updated` where `from_scan = true`;
  `fields_changed` = how many fields differ from the scan-prefilled values (0 = saved a scan
  unchanged). See also `scan_result_edited` below.

| Event | When | Properties |
|---|---|---|
| `country_picker_used` | Citizenship / Address-country picker sheet on Guest Edit closes (once per opening) | `field` (`citizenship`\|`country_code`), `outcome` (`picked`\|`dismissed`), `picked_from` (`top`\|`list`\|`search`, only when picked), `top_rank` (1-based, only when picked from the top section), `top_count` (int, size of the "most used" section, 0 = none yet), `used_search` (bool), `query_length` (int), `changed` (bool, picked value differs from the field's previous value) |

- **"How often are the country selectors used"** → `country_picker_used` volume, broken down by `field`.
- **"Does the top-10 section help"** → share of `picked_from = top` among `outcome = picked` where `top_count > 0`; `top_rank` shows how deep people go.
- **"Do they search"** → `used_search` ratio. The country itself is never sent (nationality is guest PII).

### Document scanning (the value moment)

| Event | When | Properties |
|---|---|---|
| `scan_started` | a document type is picked in the IDScanly doc-type sheet (guest-detail) | `vendor` = `idscanly`, `document_type` (string), `source` = `guest_card` \| `fab_menu` |
| `scan_capture_completed` | one side is captured (fires again on a retake's recapture) | `vendor`, `document_type`, `side`, `source` = `auto` \| `manual`, `quality_verdict` = `good` \| `recheck`, `sharp`/`well_lit`/`glare_free`/`complete` (bool) |
| `scan_succeeded` | a scan produced data | `vendor` = `idscanly`, `document_type` (string), `attempts` (int), `is_complete`/`is_processing` (bool), `image_count`/`successful_image_count`/`failed_image_count` (int), `document_form` = `id` \| `passport`, `auto_capture_used` (bool), `2nd_page_skipped` (bool), `flash_used` (bool), `scan_duration_seconds` (int) |
| `scan_failed` | submit errored, or the camera failed to start | `vendor`, `document_type`, `reason` = `error` \| `network_error` \| `http_error` \| `empty_response` \| `camera_unavailable`, `attempt_number` (int) |
| `scan_discarded` | the X is confirmed on the capture or review screen before submit | `vendor`, `document_type`, `stage` = `capture` \| `review`, `sides_captured` (int) |
| `scan_result_edited` | taps **Edit** on the scan-result sheet (corrects before saving) | `document_type` |
| `scan_result_saved` | scan result saved to the guest | `document_type` |

- **"Failed / cancelled / timed-out scans"** → `scan_failed` broken down by `reason`.
- **"How many attempts to make a scan"** → `scan_succeeded.attempts` (count of scan launches
  since the last success; `1` = first-try). Distribution / average over `attempts`.
- **"Where staff start scans from"** → `scan_started` broken down by `source`: `guest_card`
  is the not-yet-scanned-guest shortcut icon in the reservation-detail guest card; `fab_menu`
  is the "Scan Document" FAB action on guest-detail. Both paths converge on the same doc-type
  picker before this event fires — `source` is captured at the moment each entry point is
  tapped and carried through to here.
- `document_type` is the app's own IDScanly document-type id (e.g. `id-card`, `passport`) —
  categorical, **not** the document number.
- **How the capture behaved:** `scan_succeeded.document_form` is the bucket the user picked on
  the scan screen (`id` covers the Card toggle — id-card/driving-licence/address-card all share
  it today; `passport` the Passport toggle). It's kept separate from `document_type` because the
  Card bucket always scans as `document_type: 'id-card'` at capture time — any later
  id-card/address-card reclassification (from IDScanly's own OCR response) isn't reflected back
  into this event, so `document_form` stays the more reliable "what did the user select" signal.
  `auto_capture_used` is `true` only if at least one submitted side was actually produced by
  auto-detection (not just whether the toggle was left on). `2nd_page_skipped` is `false` for
  single-sided types (passport) — nothing to skip — and for a 2-sided type it's `true` whenever
  the back side wasn't captured (via the "Skip scan" button, or otherwise incomplete at submit).
  `flash_used` is `true` if the torch was switched on at any point during the session, even if
  later turned back off. `scan_duration_seconds` is wall-clock time from starting the capture
  session (or from the last Card/Passport bucket switch, which restarts the timer) to this
  successful submit.

### Help & tips

| Event | When | Properties |
|---|---|---|
| `help_card_shown` | a Home carousel card is actually scrolled into view (not just present in the array — a one-card-at-a-time carousel only shows one of up to 3 at once) | `card_id`, `category`, `surface` = `home` |
| `help_card_opened` | the detail sheet opens (from Home or the Help & Tips list) | `card_id`, `category`, `surface` = `home` \| `list` |
| `help_card_try_it_tapped` | the sheet's "Try it" deep-link button is tapped | `card_id`, `category` |
| `help_card_dismissed` | the X is tapped on a Home carousel card | `card_id`, `category` |
| `help_card_feedback` | thumbs up/down in the detail sheet | `card_id`, `category`, `rating` = `up` \| `down` |

- **"Is the education actually changing behavior?"** → the whole point of this feature. Cross-
  reference `help_card_opened` for `card_id: 'auto-lock'` against the existing
  `auto_lock_interval` people-property (set only on an explicit Settings pick, see "App lock /
  unlock" above) — did more users change their Auto-Lock interval after seeing that card than
  before it shipped?
- **"Are staff finding tips useful?"** → ratio of `up` to `down` in `help_card_feedback`,
  broken down by `card_id`.
- **"Is the carousel or the full list doing the work?"** → `help_card_opened` broken down by
  `surface`.
- `help_card_shown` only fires for `surface: 'home'` — the full Help & Tips list has no
  scroll-visibility tracking (every row is reachable by a simple scroll, not gated behind a
  one-at-a-time carousel), so "reach" there is better read from `help_card_opened` directly.

---

## Suggested first reports

1. **Activation funnel:** `login_completed` → `scan_succeeded` (or `scan_result_saved`).
2. **Scan reliability:** `scan_succeeded` vs `scan_failed` (segment by `reason`, `platform`);
   average `attempts`.
3. **Engagement:** DAU/WAU from `session_started`; median `session_ended.duration_seconds`.
4. **Feature usage:** `filter_chip_selected` (chip popularity, preset vs. custom via
   `is_preset`), `home_filters_customized` profile-property adoption rate, `property_switched`,
   `search_performed` (`from_recent` ratio), `guest_updated` (`from_scan` ratio,
   `fields_changed` distribution). For a deeper engagement/adoption breakdown of the filter
   strip specifically, see [filter-engagement-reporting.md](filter-engagement-reporting.md).
5. **How scanning is actually used:** auto-capture adoption (`scan_succeeded.auto_capture_used`
   ratio); average `scan_duration_seconds`, overall and split by `document_form`; how often the
   2nd page is skipped (`2nd_page_skipped` ratio, id-only); flash/torch usage rate — a proxy for
   how often staff scan in low light.

> Tip: while testing, filter all reports to `environment = production` to exclude dev/serve traffic.

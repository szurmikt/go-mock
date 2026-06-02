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
| `home_segment_changed` | taps Yesterday/Today/Tomorrow on home | `segment` = `yesterday` \| `today` \| `tomorrow` |
| `property_switched` | switches property via the home switcher | `property_id`, `property_name`, `from_property_id` |
| `search_performed` | commits a search (Enter) or opens a result | `query_length` (int), `results_count` (int), `from_recent` (bool) |

- **"Are they using recent search terms"** → ratio of `search_performed` where
  `from_recent = true`. (`from_recent` = the committed term matches a previously saved
  recent term. The query text itself is never sent.)

### Guest editing

| Event | When | Properties |
|---|---|---|
| `guest_updated` | Guest Edit form saved successfully | `reservation_code`, `property_id`, `from_scan` (bool), `fields_changed` (int) |

- **"Do they edit guest cards"** → `guest_updated` volume / per-user.
- **"How many times they change scanned data"** → `guest_updated` where `from_scan = true`;
  `fields_changed` = how many fields differ from the scan-prefilled values (0 = saved a scan
  unchanged). See also `scan_result_edited` below.

### Document scanning (the value moment)

| Event | When | Properties |
|---|---|---|
| `scan_succeeded` | a scan produced data | `attempts` (int), `document_type` (string), `document_type_id` (int), `scan_type` = `optical` \| `rfid` |
| `scan_failed` | scan timed out / cancelled / interrupted / errored, no data | `reason` = `timed_out` \| `cancelled` \| `interrupted` \| `error`, `attempt_number` (int), `scan_type` |
| `scan_result_edited` | taps **Edit** on the scan-result sheet (corrects before saving) | `document_type` |
| `scan_result_saved` | scan result saved to the guest | `document_type` |

- **"Failed / cancelled / timed-out scans"** → `scan_failed` broken down by `reason`.
- **"How many attempts to make a scan"** → `scan_succeeded.attempts` (count of scan launches
  since the last success; `1` = first-try). Distribution / average over `attempts`.
- `document_type` is the Regula document label (e.g. `Hungary - ID Card`, `passport`) —
  categorical, **not** the document number.
- **Known approximation:** `scan_type` is derived from whether the chip path was attempted
  (`doRfid`); a scan that falls back from RFID to optical may report `rfid`. An RFID-fallback
  that still extracts data is counted as success, not failure.

---

## Suggested first reports

1. **Activation funnel:** `login_completed` → `scan_succeeded` (or `scan_result_saved`).
2. **Scan reliability:** `scan_succeeded` vs `scan_failed` (segment by `reason`, `scan_type`,
   `platform`); average `attempts`.
3. **Engagement:** DAU/WAU from `session_started`; median `session_ended.duration_seconds`.
4. **Feature usage:** `home_segment_changed`, `property_switched`, `search_performed`
   (`from_recent` ratio), `guest_updated` (`from_scan` ratio, `fields_changed` distribution).

> Tip: while testing, filter all reports to `environment = production` to exclude dev/serve traffic.

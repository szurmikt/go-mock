# API changes used in `rc/0926-3`

New/extended SabeeApp API surface consumed by the branches merged into `rc/0926-3`
(the Reservation Notes & Status feature stack: `utc-local-date-parser` →
`implement-reservation-status-management` → `implement-comments` → `add-status-revert`
→ `add-comment-type-switch` → `add-note-delete`). The Help & Tips feature
(`helpandtips-cards`) calls no new endpoints.

## New endpoints

| Endpoint | Purpose |
|---|---|
| `POST /reservations/status` | Change a reservation's status — `{ reservation_code, status }`, `status` one of `confirmed \| checkedin \| onboard \| checkedout` |
| `PUT /reservations/comment` | Create a note — `{ reservation_code, type, comment, show_for_housekeeper? }` (type `'reservation'`) or `{ reservation_code, type, comment, comment_dates? }` (type `'room'`) |
| `DELETE /reservations/comment` | Delete a note — `{ comment_id, type }` |
| `GET /properties/settings` | New endpoint. Returns `property_time_zone` (IANA name, e.g. `Europe/Budapest`) — used to render check-in/check-out/status timestamps and note times in the property's real local time instead of the viewing device's |

## Existing endpoint, extended response

| Endpoint | New fields |
|---|---|
| `GET /reservations/details` | `created_datetime`, `onboard_time` — per-stage status timestamps, alongside the pre-existing `checked_in_time`/`checked_out_time`. `comments` array (mapped client-side to `notes`) — each entry: `comment_id`, `type` (`'reservation' \| 'room'`), `comment`, `comment_date`, `comment_dates` (room-type only), `created_datetime`, `user`, `show_for_housekeeper` |

## Not part of this RC

`open_in_pms` on the reservation model already shipped in a prior `main` release
(2026-08-26) — not new work in this RC.

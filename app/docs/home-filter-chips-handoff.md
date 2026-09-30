# Handoff: Home filter chips (saved views for the reservation list)

## Context

SabeeApp GO's Home screen today shows: hotel header → search → education carousel → `Yesterday | Today | Tomorrow` segment → two counter tiles (`Guests` / `Reservations`) → "Today's Arrivals" card list. Problems raised by customers and at the workshop:

- The list order has no logic (it follows how reservation codes come back from the API).
- Staff want room-number order and a way to focus on who still needs checking in.
- On busy days the list is long and the header eats most of the screen.

This task replaces the day segment and counter tiles with a **horizontally scrollable strip of filter chips**. Each chip is a saved view (a filter). The app ships with presets, and users can create, edit, delete and reorder their own.

**Wireframe:** `chip-strip-wireframe.html` (same folder). It has 5 frames: Home, Manage filters, Filter editor, Multi-day view, Scrolled/sticky state. It's a grayscale wireframe, not a visual spec: use the app's existing components and styles.

This session could not access the source repo. First locate the Home page component, the current arrivals/departures/in-house data loading, the day segment, the counter tiles, and the existing "reservation open on the PC goes on top" logic.

## What a filter is

| Field | Values | Notes |
|---|---|---|
| Guests | `arrivals` / `departures` / `in_house` | UI label is **"Guests"** |
| Day | `yesterday` / `today` / `tomorrow` / `next_7_days` / `next_14_days` | Always **relative** to the current date. If Guests = `in_house`, Day is fixed to `today` (other options disabled) |
| Sort by | `room` / `name` / `created` | |
| Name | string | Auto-generated from the fields (e.g. "Today's arrivals", "Arrivals · next 7 days"). The user can overwrite it. Once edited manually, stop auto-updating it |

There is **no** status/hide checkbox. It was deliberately dropped. Completed guests are grouped instead (see List behaviour).

## Presets (seeded on first launch)

Seed these in this order. After seeding they are ordinary filters: editable, deletable, reorderable.

1. Today's arrivals: arrivals · today · room
2. Today's departures: departures · today · room
3. In-house: in_house · today · room
4. Tomorrow's arrivals: arrivals · tomorrow · room

## UI spec

### Home: chip strip
- Remove the `Yesterday | Today | Tomorrow` segment and the `Guests` / `Reservations` counter tiles.
- The chip strip sits where the segment was, below search and the carousel. Hotel header, search and carousel stay as they are.
- Chips scroll horizontally, and exactly one is selected. The selection persists across app restarts.
- Each chip shows its name plus a count:
  - Arrivals today: `pending/total` (e.g. `2/3` = 2 still to check in out of 3).
  - Everything else: total count. See open questions for departures.
- A **filter icon** is fixed at the right end of the strip, outside the scroll area. It opens Manage filters.
- Remove the "Today's Arrivals" section title. The selected chip already says what the list is.

### List behaviour
- **Completed guests fold to the bottom** in a collapsed section: `Checked in (n)` for arrivals, `Checked out (n)` for departures. Tap to expand. In-house has no such section. Default is collapsed. Remembering the expand state within the session is fine.
- **Multi-day filters** (`next_7_days`, `next_14_days`) are grouped by day with a header per day ("Today · Wed 30 Sep", "Tomorrow · Thu 1 Oct", "Fri 2 Oct"…). Sort applies **within** each day. Skip empty days. Each day gets its own collapsed completed-section, but only if it's non-empty.
- **Room sort** uses natural sort, so `2` < `10`, "Room 9" < "Room 12", and text names like "City Panorama" sort alphabetically. Use `localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })`. Reservations without an assigned room go last.
- The existing **"reservation open on the PC goes on top"** rule stays above any sort.

### Sticky behaviour
- While scrolling, the chip strip becomes **sticky** at the top. The filter icon is **hidden** while the strip is stuck.
- In multi-day views, the day header sticks **below** the chip strip, and the next day's header pushes it up.
- Search, the hotel header and the carousel scroll away normally. No change to current search behaviour.
- No scroll-to-top button. iOS status-bar tap already works via `ion-content`. Don't add a floating button.

### Manage filters screen (opened from the filter icon)
- Header: `‹ Back` · "My filters" · `+ New`.
- One row per filter: drag handle, name, a one-line summary (e.g. "by room"), edit and delete.
- Drag to reorder. This order is the chip order on Home.
- Edit / `+ New` open the Filter editor.

### Filter editor (bottom sheet or page, whichever the app already uses)
- Rows: **Guests** (segmented) · **Day** (segmented, five options; may need to wrap or scroll on narrow screens) · **Sort by** (segmented) · **Name** (text field, pre-filled with the auto name) · **Save**.
- With Guests = In-house, Day is locked to Today.

## Storage

- **Device-local only** for v1. Nothing goes to the server. Use the local storage mechanism the app already uses for device settings (check precedent, e.g. the auto-lock interval setting, before introducing anything new).
- **Key by user ID**, e.g. `home_filters:{userId}`. One person's filters must not appear for another user who logs in on the same device.
- Filters are **not** per property: the same chips appear after switching hotels, and the counts reflect the current property.
- Store: the ordered array of filters (`id`, `guests`, `day`, `sort`, `name`, `nameEdited`, `isPreset`), plus the selected filter id.
- Server sync / cross-device sync is explicitly deferred. It depends on the Mixpanel data below.

## Mixpanel

This data decides whether server-side sync gets built. Follow the app's existing event naming and use the existing Mixpanel wrapper (EU residency).

- Event **filter chip selected**, with props `filter_id`, `is_preset`, `guests`, `day`, `sort`.
- Events **filter created / edited / deleted / reordered**. Created and edited carry the filter's fields.
- Profile property `home_filters_customized = true`, set via `people.set` **only** on the first create, edit, delete or reorder. Never set it on load or seeding. Its presence is the "has customized" signal.

## Out of scope
- Status/hide checkbox (dropped on purpose).
- Server-side storage and cross-device sync.
- Scroll-to-top button. The "tap Home tab to scroll to top" behaviour belongs with the future Home | Tasks tab bar.
- Card redesign (compact rows), search changes (e.g. matching all guest names), floor-based sorting.
- Custom date ranges beyond the five Day options.

## Open questions: confirm while building, don't guess
- **Departures chip count:** use `pending/total` like arrivals (still to check out / total), or just the total? Suggestion: same `pending/total` pattern for consistency.
- **Deleting the last filter:** allow it (then show an empty state with "+ New"), or require at least one? Suggestion: require at least one.
- **Reset to defaults** in Manage filters: not decided. Leave it out unless trivial, and flag it.
- **Status data:** confirm the list data already carries checked-in / checked-out status per reservation (cards show "Confirmed" / "Checked in", so it likely does) and that the departures list has a checked-out state.
- **Room name field:** confirm which field backs "106 (Fl.1)" vs "617". Sort on the room name itself, not the floor suffix.

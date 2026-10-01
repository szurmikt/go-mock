# Filter-strip engagement reporting — logic, not steps

This is **not** a click-by-click Mixpanel walkthrough. It's the reasoning behind each
report: what question it answers, which events/properties feed it, and how they should be
grouped/joined. Event and property definitions themselves live in
[mixpanel-tracking-plan.md](mixpanel-tracking-plan.md) — this file only covers how to turn
that data into the answers below.

## The questions this is meant to answer

1. On average, how many filters does a user keep?
2. Do people mostly stick with the 4 seeded presets, or do they build their own?
3. Which filter configurations (and which positions in the strip) actually get used?
4. How many people ever discover/open "Manage Filters" at all?
5. **The main one:** within a typical session, how much do people actually interact with
   the chip strip — is everyone a little engaged, or is there a distinct chunk of users who
   never touch it at all while others use it constantly?

---

## 1. Average / distribution of filters per user

`home_filter_count` is a People-profile property, already kept current on every
seed/create/delete — no event math needed. Average or histogram it directly across user
profiles.

**One real caveat:** `home_filter_count` alone can't distinguish "never touched anything"
from "deleted one, added another, net count unchanged." A user sitting at exactly 4 could
be completely untouched, or could have swapped every preset out. Always pair this number
with `home_filters_customized` (true/false) before reading anything into "most people have
4 filters" — that could mean "most people never customize" or "most people customize but
happen to land back at 4," and those are very different findings.

## 2. Preset vs. custom usage

Two different granularities answer slightly different versions of this question —
pick based on what "usage" should mean:

- **Per-user, binary:** `home_filters_customized = true` vs `false` — did this person ever
  create/edit/delete/reorder *anything*, ever. This is the bluntest, most reliable signal
  ("have they left the factory defaults at all") and should be the headline number.
- **Per-user, specifically about presets:** among users who DID customize, how many of them
  ever fired a `filter_edited` with `is_preset: true` — i.e. actually modified one of the 4
  starting filters, as opposed to leaving the presets alone and only adding new ones
  alongside them. This is a materially different behavior (tweaking what's given vs.
  building something new) and the two shouldn't be collapsed into one number.
- **Per-event:** `count(filter_edited where is_preset=true) / count(filter_edited total)` —
  useful as a sanity check or a trend line, but it's an event ratio, not a user count — don't
  present it as "X% of users."

## 3. Popular configurations and popular positions

- **Popular configuration:** group `filter_chip_selected` by the `(guests, day, sort)`
  triple, not by `filter_id` — `filter_id` is unique per filter instance per user, so it
  never aggregates meaningfully across the fleet. `(guests, day, sort)` is the
  cross-user-comparable shape (e.g. "arrivals × today × room" is a config regardless of
  which user's filter it is).
- **Popular position:** group `filter_chip_selected` by `position`. This tells you how often
  people tap into position 0 vs. 1 vs. 2 vs. 3+.
- **The normalization that matters here:** raw tap counts by position will always skew
  toward 0/1, partly because fewer users even *have* a 4th or 5th filter to tap in the first
  place. Before concluding "nobody uses position 3," normalize against how many
  sessions/users actually had a chip at that position — `filter_strip_session_baseline`'s
  `filter_count` is the denominator for this (a session where `filter_count = 2` structurally
  cannot produce a tap at position 3). Treat position-based findings as "do people reach past
  the first couple of visible chips," not as a ranking of literal slot numbers.

## 4. Manage Filters adoption

- **Reach:** % of users with ≥1 `manage_filters_opened`, ever — "have they ever found the
  screen at all."
- **Follow-through:** of the users who opened it, what fraction went on to fire a
  `filter_created`/`filter_edited`/`filter_deleted`/`filter_reordered` in roughly the same
  session (same `session_id`)? The gap between "opened it" and "opened it and changed
  something" is people who looked and decided not to bother, or got lost — worth knowing as
  its own number rather than folding it into `home_filters_customized`, since that profile
  property only captures the outcome, not the abandoned attempt.

## 5. Per-session engagement — the core question

This is the one that actually answers "is everyone a little engaged, or is there a distinct
engaged minority and a disengaged majority." The logic, per session (`session_id` is already
a super property, so every event in a session already carries it):

- **`baseline`** = the single `filter_strip_session_baseline` event for that `session_id` —
  gives the filter/position/preset-ness that was *already* selected when the session began,
  and the user's `filter_count` at that moment. Without this, a session with zero taps is
  ambiguous: stuck on the default because they never looked, or deliberately sitting on a
  filter they already like? The baseline removes that ambiguity.
- **`taps`** = count of `filter_chip_selected` events sharing that `session_id`.
- **`distinct_filters_tapped`** = count of *distinct* `filter_id` values among those taps
  (someone bouncing back and forth between the same two chips should read differently from
  someone methodically checking four different ones).

**Per-session classification**, from these three numbers:

| Class | Condition | Reads as |
|---|---|---|
| No engagement | `taps = 0` | Used whatever was already selected (the baseline), end of story |
| Single switch | `taps = 1` | Picked one specific view and stayed on it |
| Actively browsing | `taps ≥ 2` (especially with `distinct_filters_tapped ≥ 2`) | Flipping between multiple views in one visit |

**Rolling this up to the user level** is what actually answers the question as asked:

- **Per-user engagement rate** = (sessions classified "No engagement") ÷ (total sessions for
  that user). This is the number that tells you whether disengagement is spread thinly
  across everyone (most users occasionally skip it) or concentrated (a specific group *never*
  engages while others engage constantly) — look at the **distribution** of this rate across
  users, not just its average. A bimodal distribution (clusters near 0% and near 100%) is the
  "distinct set of highly-engaged vs. non-engaged users" pattern being asked about; a
  distribution clustered in the middle means engagement is more evenly spread.
- **"Highly engaged" cohort** — users whose average `taps` per session sits well above the
  fleet median. Don't pre-pick a threshold number before looking at the real distribution;
  let the data define what "well above average" means first.
- **"Passive" cohort** — users with a near-0% engagement rate *despite having enough
  sessions to have had the chance* (exclude very new users with only 1-2 sessions — they
  haven't had much opportunity either way, and including them would inflate the passive
  group with people who simply haven't been around long).
- **Are they always on the default specifically** (a sharper version of "passive"): cross
  `baseline.active_filter_position = 0` AND `baseline.active_filter_is_preset = true` against
  "no engagement" sessions. That combination — default position, a preset, zero taps — is the
  cleanest "this person has never meaningfully interacted with the feature" signal. Someone
  sitting on position 2 with zero taps is a different, more ambiguous case: they may have
  already found their preferred filter and simply never need to change it, which is still a
  form of satisfied usage, just not active-within-session usage.

## Known limitations — don't over-read these numbers

- `filter_strip_session_baseline` only fires once Home actually resolves its filter data
  within a session. A session that never opens Home at all has no baseline row and is simply
  absent from this analysis, not counted as "no engagement."
- `position` is per-user (filters are user-reorderable), so a cross-user "position 3 is
  unpopular" finding conflates "what sits at position 3 for this particular person" with an
  absolute slot ranking. It's a reach/discoverability signal, not a ranking of fixed slots.
- Nothing distinguishes "opened Manage Filters, looked, and decided no change was needed"
  from "opened it and got confused/gave up" — both look identical (a `manage_filters_opened`
  with no follow-up mutation event in the same session). If that distinction ever matters,
  it would need its own signal (e.g. time spent on the screen), not inferred from what's
  tracked today.

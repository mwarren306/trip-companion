# Trip shell — design

## Overview

The trip shell is the app's frame and its first-run entry point. It loads `data/itinerary.json`
once, decides which view to open based on the device date, renders the sticky day navigation, the
day header, and the timeline of stops and transport legs, and exposes a small context object
(`ctx`) that every other feature view mounts against. It owns no itinerary content of its own — it
reads `data/` and records only checkmarks (persisted through the store, spec 06).

This design honours the always-on steering: plain HTML/CSS/ES modules, no framework or build step
(`tech.md`); one view per file exporting `mount(el, ctx)` (`structure.md`); colours only from
`styles/tokens.css` (`design-system.md`); WCAG 2.1 AA with 44px targets and text-labelled status
(`accessibility.md`); and no placeholder copy — unavailable elements are not rendered
(`product.md`, `design-system.md`).

### Scope

In scope: data load and parse-failure handling, date-based routing, day chips, day header with
three facts, the timeline (stop cards + leg connectors + continuous thread), stop numbering and
category pins, status chips, alert blocks, time windows, the Directions / Copy coordinates
actions, check-off with header progress count, and the To-sort view (the `data.todo` checklist,
requirements section 6).

Out of scope (owned by later specs, mounted inside this shell): map rendering (03), transport-leg
expansion detail and booking-reference lock (02, 05), trail-status panel (04), the store's
Supabase sync internals (06), and offline/install (07). The shell defines the seams; it does not
implement those features.

## Architecture

### Module layout

Follows `structure.md` exactly. The shell touches:

```
index.html      landmarks: <header> (nav + day header), <main> (timeline/map container)
app.js          entry: load data, route to a view, build ctx, wire storage
views/days.js   the shell view: day chips, day header, timeline of stops and legs
lib/store.js    checkmark persistence (consumed here via ctx.store; internals are spec 06)
lib/geo.js      duration parsing / summing for "time on the move", maps URL helper
styles/tokens.css   colour + type + shape tokens (unchanged here)
styles/app.css      all shell layout and component styles
data/itinerary.json read-only at runtime
```

`app.js` is the composition root. `views/days.js` is a pure view: it receives an element and a
context and renders; it holds no module-level mutable state.

### Boot sequence (app.js)

1. Read `data/itinerary.json` via `fetch('data/itinerary.json')` against the local origin (no
   network dependency; the service worker in spec 07 will serve it from cache).
2. Parse. On failure, render the parse-failure view (req 1.5) and stop.
3. On success, cache the parsed object and its `generated` date in `localStorage` under a
   `lastGoodItinerary` key so a future parse failure can report the last good `generated` date.
4. Compute the opening view and day from the device date (routing table below).
5. Build `ctx` and call the chosen view's `mount(el, ctx)`.

### The `ctx` object

The single seam between the shell and every other view. Shape:

```js
ctx = {
  data,                 // parsed itinerary.json (frozen)
  today,                // Date, device local — injectable for tests (see Testing)
  selectedDayN,         // currently rendered day number
  store,                // lib/store.js: get(id) / toggle(id) / subscribe(fn) — checkmarks only
  geo,                  // lib/geo.js: parseDuration, sumMoveTime, mapsUrl, copyCoords
  navigate(viewName, dayN)  // shell-owned router; re-mounts the target view
}
```

Later specs read from `ctx` and never reach around it. `navigate` is how the tracker (1.3) and day
chips (2.2) change what is mounted.

### Routing table (req 1.2–1.4)

Comparison is on calendar date only (ISO `YYYY-MM-DD` string compare against `start`/`end`), no
timezone math — consistent with `tech.md` ("local Italian time, no timezone math in the UI").

| Device date vs trip | Opens | Detail |
|---|---|---|
| `start ≤ today ≤ end` | Days view on today | matches `iso` to a `days[].iso` |
| `today < start` | To-sort (tracker) view | shows days-until-start = `start − today` in whole days |
| `today > end` | Days view on last day | `days[days.length − 1]` |

The To-sort branch mounts `views/tracker.js`. This view is owned by spec 01 (requirements section
6): it renders `data.todo` as a checklist. The shell passes the days-until count through `ctx`.

## Components and interfaces

### index.html structure

One `h1` per view, semantic landmarks (`accessibility.md`):

```html
<header>
  <nav aria-label="Days"> … day chips … </nav>
  <div id="day-header"> … eyebrow, h1 title, three fact tiles … </div>
</header>
<main id="view"> … timeline (and later the map card, spec 03) … </main>
```

### Day chips (req 2.1–2.3)

- One chip per `days[]` entry, horizontal scroll, sticky, `--r-pill`.
- Selected chip: `--go` fill, white text. Today's chip when different from selected: a distinct
  marker (e.g. a ring / dot) plus a text cue, never colour alone (`accessibility.md`).
- Tap → `ctx.navigate('days', n)`, then `scrollIntoView({ inline: 'center' })` on the chip.
- Each chip ≥ 44px tall; label is the day's short `date` string, with an `aria-current="date"` on
  today's chip.

### Day header (req 3.1)

- Eyebrow: `Day n of N — place`.
- `h1`: day `title`.
- Three fact tiles:
  1. Stops: count of `items` where `kind === 'stop'`.
  2. Time on the move: sum of leg `duration` strings via `geo.sumMoveTime` (parses `"3 h 47"`,
     `"6 min"` etc.), rendered as a single readable duration.
  3. First stop: the `t` of the first stop item (a clock time like `12:00`, or a daypart like
     `morning`).
- While the trip is in progress, header also shows `k of n stops done` (req 5.3).
- Tabular numerals on all counts/times.

### Timeline (req 4.1–4.6)

Rendered from `day.items` in order into the 600px column with a 30px left gutter.

- **Thread:** a 2px `--line-2` vertical line in the gutter, drawn continuously so it passes
  *through* leg connectors and joins consecutive pins (the deliberate difference from Wanderlog per
  `design-system.md`). Implemented as a gutter background rather than per-item borders so it never
  breaks between a stop and the following leg.
- **Stop card:** white, 1px `--line`, `--r-card`. Row 1: 36px category-tint icon tile + time
  (`t`) over name. Then, conditionally and only when present:
  - status chip with text label (req 4.3) — `--ok/--warn/--open` pair by status;
  - `window` shown as `from–to` beside the time (req 4.5);
  - `note`;
  - alert block, never collapsed (req 4.4), `--warn` pair;
  - actions row (below).
- **Numbered pin:** 28px circle, category fill, white number. Numbering is sequential across
  stops within the day (legs are not numbered), computed by a running counter as items render
  (req 4.2). Same visual treatment reserved for the map marker in spec 03.
- **Leg connector:** compact form only in this spec — mode icon, bold `duration`, one fact from
  the leg summary. Expansion detail and booking lock are spec 02; the shell renders the compact
  connector and leaves an expansion seam.

### Actions row (req 4.6)

- **Directions** (primary, `--go` fill): opens
  `https://maps.apple.com/?daddr={la},{lo}&dirflg={directions}` where `directions` is the stop's
  `directions` field (`w`/`d`/`r` → walk/drive/transit flag). Built by `geo.mapsUrl(stop)`.
- **Copy coordinates** (secondary, outline): copies `"{la},{lo}"` via `navigator.clipboard`; when
  unavailable, falls back to `window.prompt` pre-filled with the string so the user can copy
  manually.
- Both ≥ 44px tap targets; icons `aria-hidden`, meaning in the text label.

### Check-off (req 5.1–5.3)

- A tick control on each stop card, ≥ 44px, `aria-pressed` reflecting done state.
- Tap when not done → `ctx.store.toggle(stopId)`, card collapses to a struck-through single line
  (name only), header progress count increments.
- Tap a done card again → restores full card (req 5.2).
- The shell subscribes to `ctx.store` so a checkmark synced from another device (spec 06) re-renders
  the affected card and the header count without a reload.
- Done state persists only through the store; nothing sensitive in `localStorage` (`tech.md`).

### To-sort view — `views/tracker.js` (req 6.1–6.7)

The pre-trip checklist, mounted by the shell when the device date is before `start` (and reachable
any time via `navigate('tracker')`). Structure mirrors the day view's landmarks: an `h1` "To sort"
in `<main>`, with the day-nav and day-header regions left empty for this view.

- **Header line (6.5):** `k of n to sort` — the count of open (not-done) items — rendered under
  the title. Recomputed on every toggle.
- **Days until start (6.6):** when `ctx.daysUntilStart` is set (before the trip), a line above the
  list, e.g. "6 days until the trip." / "1 day until the trip."
- **List (6.1–6.2):** `data.todo` in source order, one row per item. Each row shows `label`
  (always), `note` (only when present), and `due` (only when present) — no placeholder copy. Rows
  reuse the shared tick control and the struck-through done treatment from check-off.
- **Check-off (6.3–6.4):** tapping the tick calls `ctx.store.toggle(todoId)` exactly as stops do;
  a done item is struck through and its note/due hidden; tapping again restores. The view
  subscribes to `ctx.store` so an externally synced tick re-renders the row and the open count.
- **Empty state (6.7):** when `data.todo` is empty, a single line ("Nothing to sort.") instead of
  an empty list.

Todo ids share the stop id namespace only in that both are keys the store persists; the data model
gives todos `t`-prefixed ids (`t4`), distinct from stop/leg ids.

### Parse-failure view (req 1.5)

A single readable error block (`--warn` pair, an `h1`, one sentence). If `lastGoodItinerary` exists
in `localStorage`, append its `generated` date ("Last good copy generated {date}."). No stack
traces, nothing logged to console in the production path (`tech.md`).

## Data model

Consumes `data/itinerary.json` as documented in `data-model.md`. Shapes the shell relies on:

- Top level: `{ trip, start, end, generated, days[], todo[] }`.
- `day`: `{ n, iso, date, title, place, items[] }`.
- `item` is a stop or a leg, discriminated by `kind`:
  - stop: `{ kind:'stop', id, t, name, la, lo, cat, status?, window?, note?, alert?, directions, hasSecret? }`
  - leg: `{ kind:'leg', id, mode, summary, duration, distance, verified, source, steps[] }`

The shell treats `data/` as read-only (`structure.md`) and never invents fields. Money stays a
display string; coordinates are `la` then `lo` everywhere (`tech.md`).

## Error handling

- **Fetch/parse failure (1.5):** caught in `app.js` boot; renders the parse-failure view; reports
  last good `generated` if cached. The app does not throw past boot.
- **Missing optional stop fields:** each is rendered only when present (no placeholder copy). A
  stop with no `status`/`note`/`alert`/`window` renders as a bare card.
- **Empty/way-out-of-range dates:** routing clamps to first/last day per the table; an itinerary
  with zero days renders the parse-failure view (treated as unusable data).
- **Clipboard unavailable:** `Copy coordinates` uses the `window.prompt` fallback (4.6).

## Testing strategy

Per repo policy, tests are written when the feature is implemented (tasks below), not preemptively.
Planned coverage maps to the Acceptance criteria:

- **Routing:** inject a fixed `today` into `ctx` (the shell reads `ctx.today`, defaulting to
  `new Date()` in production) and assert the opening view/day for dates before, during, and after
  the trip — the "mock the clock" acceptance item.
- **Timeline order (Thu 17 Sep):** render the day and assert every `item` appears in source order
  with the thread element spanning the full column (unbroken).
- **Check-off:** toggle a stop, assert collapse + struck-through line + header count; toggle again,
  assert restore.
- **Performance:** Lighthouse mobile-throttled run targeting ≥ 95 (acceptance); verified manually
  against the built shell since there is no bundler.

Because the fixture `itinerary.json` currently has a single placeholder day, tests use a small
fixture with a `start`/`end` range and a `2026-09-17` day to exercise the acceptance cases.

## Design decisions and rationale

- **`ctx` as the only seam.** Keeps one-view-per-file (`structure.md`) enforceable and lets specs
  02–07 mount without the shell importing them. Avoids a framework's DI at zero cost.
- **Injectable `today`.** The acceptance criteria require testing before/during/after the trip;
  reading the clock from `ctx.today` makes that a data change, not a mock of globals.
- **Thread as gutter background, not per-item borders.** Guarantees the "continuous thread"
  requirement (4.1) and the Thu-17-Sep unbroken-thread acceptance, and avoids seams between a stop
  and its following leg.
- **Compact-only legs here.** Leg expansion and the booking lock belong to specs 02/05; the shell
  ships the connector and an expansion seam so those specs slot in without reworking the timeline.
- **Date compare on ISO strings.** Matches `tech.md`'s no-timezone-math rule and sidesteps DST/UTC
  bugs on a phone that may be in a different zone than Italy.

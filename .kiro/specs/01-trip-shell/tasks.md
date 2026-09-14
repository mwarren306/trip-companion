# Trip shell — tasks

- [ ] 1. Set up the shell skeleton and boot
  - Create `index.html` landmarks (`header` with `nav` + day-header container, `main#view`),
    self-hosted Inter link, and a single `<script type="module" src="app.js">`.
  - In `app.js`, implement the boot sequence: `fetch('data/itinerary.json')`, parse, build `ctx`,
    call the view's `mount(el, ctx)`.
  - Define the `ctx` object shape (`data`, `today`, `selectedDayN`, `store`, `geo`, `navigate`),
    with `today` defaulting to `new Date()` but overridable for tests.
  - _Requirements: 1.1_

- [ ] 2. Data load, caching, and parse-failure handling
  - On successful parse, cache the parsed object and its `generated` date in `localStorage`
    (`lastGoodItinerary`).
  - Implement the parse-failure view: one readable error block, plus the last good `generated`
    date when cached. No console logging in the production path.
  - _Requirements: 1.1, 1.5_

- [ ] 3. Date-based routing
  - Implement ISO-string date comparison (no timezone math) for `today` vs `start`/`end`.
  - Route: in-range → Days view on today's `iso`; before `start` → To-sort (tracker) view with
    days-until-start; after `end` → Days view on last day.
  - Pass days-until-start through `ctx` for the tracker branch.
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 4. Day chips navigation (`views/days.js`)
  - Render one sticky, horizontally scrolling chip per day, `--r-pill`, ≥ 44px tall.
  - Selected chip `--go`/white; today's chip marked distinctly with a non-colour cue and
    `aria-current="date"` when it differs from the selection.
  - On tap: `ctx.navigate('days', n)` then `scrollIntoView({ inline: 'center' })`.
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 5. Day header with three facts
  - Render eyebrow `Day n of N — place`, `h1` day title, and three fact tiles: stop count,
    time on the move (via `geo.sumMoveTime` over leg durations), and first stop's `t`.
  - Tabular numerals on counts and times.
  - _Requirements: 3.1_

- [ ] 6. `lib/geo.js` helpers
  - Implement `parseDuration` / `sumMoveTime` (parse strings like `"3 h 47"`, `"6 min"`),
    `mapsUrl(stop)` building the Apple Maps URL with the `directions` flag, and `copyCoords(stop)`
    with the `navigator.clipboard` → `window.prompt` fallback.
  - _Requirements: 3.1, 4.6_

- [ ] 7. Timeline: thread, stop cards, numbered pins
  - Render `day.items` in order in the 600px column with a 30px gutter.
  - Draw the continuous 2px `--line-2` thread through the gutter so it never breaks between a stop
    and the following leg.
  - Stop card per `design-system.md`: category-tint icon tile, time over name; numbered pin (28px,
    category fill) with a running counter numbering stops sequentially (legs unnumbered).
  - _Requirements: 4.1, 4.2_

- [ ] 8. Stop card conditional content
  - Render status chip with text label when `status` present; `window` as `from–to` beside the
    time; `note`; and the alert block (never collapsed) when `alert` present. Render each only when
    the field exists — no placeholder copy.
  - _Requirements: 4.3, 4.4, 4.5_

- [ ] 9. Compact transport-leg connector
  - Render the compact leg form (mode icon, bold `duration`, one summary fact) inside the timeline
    between stops, with an expansion seam left for spec 02. Icons `aria-hidden`.
  - _Requirements: 4.1_

- [ ] 10. Actions row
  - Add primary `Directions` (opens the Apple Maps URL via `geo.mapsUrl`) and secondary
    `Copy coordinates` (via `geo.copyCoords`, prompt fallback). Both ≥ 44px, focus-visible outline,
    icons `aria-hidden` with meaning in the label.
  - _Requirements: 4.6_

- [ ] 11. Check-off and header progress
  - Add a ≥ 44px tick control with `aria-pressed`. On toggle: call `ctx.store.toggle(id)`, collapse
    the card to a struck-through single line, update the `k of n stops done` header count; toggle
    again restores.
  - Subscribe to `ctx.store` so an externally synced checkmark re-renders the card and count.
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 12. Styles
  - Add all shell layout/component styles to `styles/app.css`, drawing every colour from
    `styles/tokens.css` tokens only. Respect `prefers-reduced-motion`; keep motion to the 160ms
    height/opacity reveals described in the design.
  - Note: `tokens.css` (full) and the base/layout, chips, day-header, and To-sort styles were
    pulled forward ahead of the timeline work so the design could be reviewed early. Timeline and
    stop-card styles remain for when tasks 7–11 land.
  - _Requirements: 2.1, 3.1, 4.1, 4.4_

- [x] 13. Tests against acceptance
  - Routing: with an injected `today`, assert the opening view/day for dates before, during, and
    after the trip. (`tests/routing.test.js`)
  - Timeline: render 2026-09-17 and assert all items appear in source order with an unbroken
    thread. (`tests/timeline.test.js`)
  - Check-off: assert collapse + struck-through + count on toggle, and restore on re-toggle.
    (`tests/timeline.test.js`)
  - To-sort: assert the todo list renders label/note/due, the open count, and days-until before the
    trip; ticking strikes through and decrements the count. (`tests/tracker.test.js`)
  - Run a throttled-mobile Lighthouse pass and confirm performance >= 95. **(Manual, browser-only —
    no bundler to automate; run in Chrome DevTools against the served app.)**
  - Headless-DOM shim for view tests: `tests/dom-shim.js`. Run all: `node --test`.
  - _Requirements: 1.2, 1.3, 1.4, 4.1, 5.1, 5.2, 5.3, 6.1, 6.5, 6.6_

- [ ] 14. To-sort view (`views/tracker.js`)
  - Render `data.todo` as a checklist in source order: each row shows `label`, plus `note` and
    `due` only when present. Empty `todo` → a single "Nothing to sort." line.
  - Show `k of n to sort` (open count) under the title, and, before the trip, the days-until-start
    line above the list.
  - Tick control (shared 44px control, `aria-pressed`) toggles via `ctx.store.toggle(id)` exactly
    as stop check-off does; done items are struck through with note/due hidden; re-tick restores.
    Subscribe to `ctx.store` so a synced tick re-renders the row and count.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 15. Dev-only date override
  - `?today=YYYY-MM-DD` in the URL forces `ctx.today` for local preview of date routing; invalid or
    absent falls back to the real clock. Documented in `README.md`.
  - _Requirements: 1.2, 1.3, 1.4 (preview support)_

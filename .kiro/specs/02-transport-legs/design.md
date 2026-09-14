# Transport legs — design

## Overview

A transport leg is the highest-stakes content in the app: the thing you read standing on a platform
with a train about to leave. Spec 01 shipped the leg's compact form in the timeline — mode icon,
bold duration, one summary fact, threaded between its two stops. Spec 02 completes the leg: it adds
`depart → arrive` and a lock glyph to the compact form, makes the leg expand in place to the full
instruction block (line/operator, times, numbered steps, where to buy, cost, validation, platform,
fallback, provenance), surfaces the encrypted booking reference inside the expanded form via spec
05's unlock flow, and enforces the correctness guards that keep invented facts out of the data.

This feature is presentation only. It never computes, estimates, or infers a fare, a time, or a
platform (`tech.md`, req 3.3); every value shown comes verbatim from `itinerary.json`, and a leg
that lacks the required provenance fields fails `tools/validate-data.mjs` and the build is not done.

This design honours the always-on steering: plain HTML/CSS/ES modules, no framework or build step
(`tech.md`); one view per file — legs stay inside `views/days.js`, which already owns the timeline
(`structure.md`); colours only from `styles/tokens.css`; WCAG 2.1 AA with 44px targets, text labels,
and motion that respects `prefers-reduced-motion` (`accessibility.md`, `design-system.md`); and no
placeholder copy — every optional field renders only when present (`product.md`).

### Scope

In scope: `depart → arrive` in the compact form (req 1.2); the compact lock glyph (req 1.3); the
tap-to-expand interaction and the expanded instruction block in the documented field order (req
2.1); expand/collapse that never shifts the stops above (req 2.3); the leg lock affordance inside
the expanded form, revealing the reference inline via spec 05 (req 2.2); the runtime 60-day
`verified` staleness treatment (req 3.2); full mode-icon coverage with a neutral fallback (req 4);
and the `validate-data` guard that legs carry `steps`/`duration`/`verified`/`source` (req 3.1).

Out of scope: the compact form's mode icon + duration + summary and the thread (shipped in spec 01);
the unlock mechanism itself — `lib/crypto.js`, `ctx.secrets`, Remember/Forget, background re-lock
(spec 05; this spec only mounts the affordance spec 05 exports); the map (spec 03); and the
itinerary data content (authored, not built here).

## Architecture

### Module layout

Follows `structure.md`. Legs live in the timeline, so spec 02 touches:

```
views/days.js       renderLeg(): compact form (extend) + expanded form (new); one open leg at a time
views/lock.js       (consumed) renderLockAffordance(leg, ctx) — spec 05, reused unchanged for legs
views/icons.js      (consumed/extend) modeIcon() already covers the modes; add a small lock glyph
lib/dates.js        (consumed/extend) a verified-staleness helper (days since a verified ISO date)
styles/app.css      expanded-leg block, depart→arrive, lock glyph, expand/collapse motion
data/itinerary.json (read-only) leg fields per data-model.md
tools/validate-data.mjs  (verify) already fails legs missing steps/duration/verified/source (3.1)
```

`renderLeg` grows from the seam spec 01 left: the `.leg-connector` element inside `li.leg`. Spec 01
deliberately drew the thread as a background of the `.timeline` `<ol>`, not as per-item borders, so
an expanded panel inside a leg `<li>` grows downward and the thread stays continuous — this is what
makes req 2.3 (expand without shifting the stops above) hold for free.

### Compact form (extends spec 01)

The compact connector today is: `.leg-icon` (mode) + `.leg-text` (`.leg-duration`, then `,
.leg-summary`). Spec 02 adds two things and makes the whole connector the expand control:

- **`depart → arrive` (req 1.2):** when the leg has `depart`, render `depart → arrive` in tabular
  numerals as a distinct element in the compact row (after the summary, or in place of it when the
  summary is a time restatement). The arrow is a text glyph, not an icon; times are tabular.
- **Lock glyph (req 1.3):** when the leg has `hasSecret`, a small inline lock icon (new in
  `icons.js`, `aria-hidden`, meaning carried by the expanded affordance's text) sits at the end of
  the compact row so the user knows a reference is attached before expanding.
- **Expand control:** the connector becomes a `<button>` (or gets a `role="button"` wrapper) with
  `aria-expanded`, ≥44px target, toggling the expanded panel. `distance` still never appears in the
  compact form — it belongs to the expanded block.

### Expanded form (new)

Tapping the connector expands a panel appended inside the same `li.leg`, below the connector. It
renders, **in this order and only when the field is present** (req 2.1, no placeholder copy):

1. `line` and `operator` (e.g. "FrecciaBianca 8620 · Trenitalia" — rendered as two text spans, no
   middle-dot per `design-system.md`; use a line break or comma).
2. `depart → arrive` in tabular numerals (repeated here in full even if shown compact).
3. `steps[]` as an ordered `<ol>` — the numbered instruction list, each step one action/fact.
4. `buy` — where to buy.
5. `cost` — the fare string, verbatim (never computed; `tech.md` money-as-string).
6. `validate` — stamp-or-not guidance.
7. `platform` — platform notes.
8. `fallback` — the backup plan.
9. `verified` and `source` in dim text — provenance (see staleness below).
10. **Lock affordance** (req 2.2) when `hasSecret`: `renderLockAffordance(leg, ctx)` from spec 05,
    mounted at the foot of the expanded block. Unlocking reveals the reference inline exactly as on
    a stop card — the same session key, one-tap once unlocked. This is the mount point spec 05
    deferred to spec 02; no new unlock code is written here.

Only one leg is expanded at a time (tapping a second collapses the first) to keep the day scannable;
this is a view-level convenience, not a requirement, and is noted as a decision below.

### Expand / collapse without shifting stops (req 2.3)

The panel is inside the leg's own `<li>`; expanding it pushes only the content *below* it down —
the stops above keep their position. Motion is a 160ms height/opacity reveal (`design-system.md`),
disabled under `prefers-reduced-motion`. Because the thread is a gutter background on the list, it
simply extends through the taller leg row; it never breaks. `aria-expanded` on the control and a
region role on the panel keep the state announced.

### Correctness guards (req 3.1–3.3)

- **Validation (3.1):** `tools/validate-data.mjs` already fails any leg missing `steps`,
  `duration`, `verified`, or `source` (verified in spec 01/tooling). Spec 02 adds no new required
  fields; it relies on this guard and treats the "build not done" contract as binding.
- **Staleness (3.2):** at render time, compare the leg's `verified` ISO date to `ctx.today`. If it
  is more than 60 days old, render `Checked <date>` in the warn colour instead of dim. A small
  helper in `lib/dates.js` (`daysSince(iso, today)` or reuse of the existing date math) computes
  this; no timezone math (`tech.md`), ISO-string/`Date` comparison only. `ctx.today` is injectable,
  so the staleness branch is testable.
- **No invention (3.3):** the view only reads fields; it never derives a fare, a departure, or a
  platform. There is no code path that computes any of these — enforced by construction (the
  renderer has no arithmetic over times/fares) and asserted in tests.

### Mode coverage (req 4)

`views/icons.js` `modeIcon(mode)` already maps walk, taxi, train, tram, bus, vaporetto, boat,
shuttle, and flight, and falls back to a neutral train glyph for unknown modes. Spec 02 confirms
coverage for every mode the data will contain (taxi, Leonardo Express appears only as a rejected
alternative inside a step so needs no icon, FrecciaBianca/Intercity/Regionale Veloce/Frecciarossa
and Cinque Terre regionals → train, hotel shuttle → shuttle, Rome/Florence buses → bus, vaporetto
and ACTV Aerobus → vaporetto/boat, private water taxi → boat, walking → walk). The fallback covers
anything unlisted (req 4 "unknown modes fall back to a neutral icon"). Icons are inline SVG, 1.9px
stroke, round caps, `aria-hidden` (`design-system.md`).

## Components and interfaces

- `renderLeg(leg, ctx)` (in `views/days.js`): now takes `ctx` (previously unused) so it can mount
  the lock affordance and read `ctx.today` for staleness. Returns the `li.leg` with the compact
  connector (expand control) and a collapsed expanded panel.
- `renderExpandedLeg(leg, ctx)` (new, `views/days.js`): builds the ordered detail block; returns the
  panel element. Calls `renderLockAffordance(leg, ctx)` when `hasSecret`.
- `modeIcon(mode)` (`views/icons.js`): unchanged; add `lockGlyph()` for the compact lock indicator.
- `daysSince(iso, today)` (`lib/dates.js`): whole days between an ISO date and `today` for the
  60-day staleness check.
- `renderLockAffordance(item, ctx)` (`views/lock.js`): consumed unchanged; the leg is the `item`.

## Data model

Consumes the leg shape from `data-model.md`: `{ kind:'leg', id, mode, summary, duration, distance?,
verified, source, steps[], operator?, line?, depart?, arrive?, buy?, cost?, validate?, platform?,
fallback?, hasSecret? }`. Required: `steps`, `duration`, `verified`, `source` (guarded). All others
render only when present. Money is a display string; the view never parses it as a number.

## Error handling

- **Missing optional fields:** each expanded row is rendered only when its field exists — a sparse
  leg shows a short expanded block, never placeholder rows.
- **Unknown `mode`:** neutral fallback icon; the duration/summary text still carries meaning.
- **Unparseable/absent `verified`:** if staleness can't be computed, render the provenance in dim
  (the safe default) rather than warn, and never throw.
- **`hasSecret` but no decrypted value** (e.g. before unlock, or id absent from the blob): handled
  entirely by spec 05's affordance (locked box, or "No reference on file"); spec 02 just mounts it.
- **Rapid taps:** the expand toggle is idempotent on state; double-tap collapses cleanly.

## Testing strategy

Written when implemented (repo policy), under the headless DOM shim from spec 01. No real booking
reference in any test — the lock affordance is exercised with a synthetic blob exactly as spec 05's
tests do.

- **Compact form:** a leg with `depart` renders `depart → arrive` in tabular numerals; a leg with
  `hasSecret` shows the lock glyph; `distance` never appears in the compact row.
- **Expand order (req 2.1):** render a fully-populated leg, assert the expanded children appear in
  the documented order and that absent fields produce no row.
- **Expand stability (req 2.3):** capture the bounding box of the stop above a leg, expand the leg,
  assert the stop's box is unchanged (mirrors spec 01's unbroken-thread check).
- **Staleness (3.2):** with an injected `ctx.today`, a `verified` > 60 days old renders warn
  `Checked <date>`; within 60 days renders dim.
- **No invention (3.3):** assert the renderer exposes no fare/time computation and shows values
  verbatim.
- **Leg unlock (moved acceptance):** with a synthetic blob, expand the Termini leg, unlock, and
  assert the reference reveals inline; refresh without Remember re-locks (drives the same
  `ctx.secrets` path spec 05 tests, now through a leg).
- **Acceptance, on device:** Saturday 19 Sep Termini leg expands to FB 8620, 13:57→17:44, platform
  rule, locked PNR → unlock reveals it; Friday 25 Sep vaporetto + Aerobus legs show fare and where
  to buy; `node tools/validate-data.mjs` passes.

## Design decisions and rationale

- **Legs stay in `views/days.js`.** They are part of the timeline the day view owns; a separate
  file would fracture the one-view-per-file rule (`structure.md`) and complicate the thread. The
  expanded panel is a function within that view, not a new view.
- **Expansion grows inside the leg `<li>`.** Guarantees req 2.3 (stops above don't move) and keeps
  the gutter thread continuous, reusing spec 01's "thread as background" decision rather than
  fighting it.
- **The compact connector is the expand control.** One 44px target, `aria-expanded`, no separate
  chevron button — fewer controls, clearer semantics, and the whole row is tappable on a phone.
- **Reuse spec 05's `renderLockAffordance` verbatim.** The affordance is item-shape-agnostic; a leg
  is just an `{ id, hasSecret }`. This is exactly the seam spec 05 left, so the leg reveal needs no
  new crypto or unlock UI — only a mount point, which is why the Termini reveal acceptance lives
  here.
- **One open leg at a time.** Keeps a dense day (up to ten legs) scannable and matches the "the day
  scans before it reads" principle from spec 01's note clamp. A view convenience, not a requirement.
- **Staleness read from `verified` vs `ctx.today`, ISO compare.** Matches `tech.md`'s no-timezone
  rule and spec 01's injectable-clock testing approach; re-verifying the data (a newer `verified`
  date) clears the warn with no code change.

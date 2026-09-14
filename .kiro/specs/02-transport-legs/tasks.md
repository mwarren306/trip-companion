# Transport legs — tasks

- [ ] 1. Compact form: `depart → arrive` (extend `renderLeg`)
  - When a leg has `depart`, render `depart → arrive` in the compact row in tabular numerals; keep
    the mode icon + bold `duration` + `summary` from spec 01. `distance` still never appears here.
  - _Requirements: 1.1, 1.2_

- [ ] 2. Compact form: lock glyph
  - When a leg has `hasSecret`, show a small inline lock glyph at the end of the compact row (new
    `lockGlyph()` in `views/icons.js`, inline SVG, 1.9px stroke, round caps, `aria-hidden`).
  - _Requirements: 1.3_

- [ ] 3. Make the compact connector the expand control
  - Turn `.leg-connector` into a ≥44px control with `aria-expanded`, toggling the expanded panel.
    Pass `ctx` into `renderLeg` (currently unused) so the expanded form can read `ctx.today` and
    mount the lock affordance.
  - _Requirements: 2.1, 2.3_

- [ ] 4. Expanded form: the instruction block (`renderExpandedLeg`)
  - Build the panel inside the leg `<li>`, rendering in this order and only when present: `line` and
    `operator`; `depart → arrive`; `steps` as a numbered `<ol>`; `buy`; `cost`; `validate`;
    `platform`; `fallback`; then `verified` and `source` in dim text. No placeholder copy.
  - _Requirements: 2.1_

- [ ] 5. Expand/collapse without shifting the stops above
  - Grow the panel inside the leg's own `<li>` so stops above keep their position; 160ms
    height/opacity reveal, disabled under `prefers-reduced-motion`; thread stays continuous. Only
    one leg open at a time.
  - _Requirements: 2.3_

- [ ] 6. Leg lock affordance (reuse spec 05)
  - When a leg has `hasSecret`, mount `renderLockAffordance(leg, ctx)` (from `views/lock.js`) at the
    foot of the expanded block; unlocking reveals the reference inline, one-tap once the session key
    is held. No new crypto/unlock code.
  - _Requirements: 2.2_

- [ ] 7. `verified` staleness (runtime)
  - Add `daysSince(iso, today)` to `lib/dates.js` (ISO/`Date` compare, no timezone math). When
    `verified` is more than 60 days before `ctx.today`, render `Checked <date>` in the warn colour
    instead of dim; otherwise dim.
  - _Requirements: 3.2_

- [ ] 8. Mode coverage
  - Confirm `modeIcon()` renders a distinct icon for every mode in the data (taxi, train family,
    shuttle, bus, vaporetto/boat, walk) and a neutral fallback for unknown modes. Add any missing
    glyph.
  - _Requirements: 4 (mode coverage)_

- [ ] 9. Correctness guards
  - Confirm `tools/validate-data.mjs` fails any leg missing `steps`/`duration`/`verified`/`source`
    (3.1). Ensure no render path computes or estimates a fare, time, or platform — values are shown
    verbatim (3.3).
  - _Requirements: 3.1, 3.3_

- [ ] 10. Styles
  - Add expanded-leg styles to `styles/app.css` (block layout, numbered steps, `depart → arrive`
    tabular numerals, dim/warn provenance, lock glyph, expand/collapse motion), colours from
    `styles/tokens.css` only.
  - _Requirements: 2.1, 3.2_

- [ ] 11. Tests (headless DOM shim; synthetic secrets only)
  - Compact: `depart → arrive` in tabular numerals; lock glyph when `hasSecret`; no `distance`.
  - Expand order (2.1): populated leg renders rows in the documented order; absent fields omitted.
  - Stability (2.3): the stop above a leg keeps its bounding box when the leg expands.
  - Staleness (3.2): injected `ctx.today` → warn `Checked <date>` past 60 days, dim within.
  - Leg unlock: with a synthetic blob, expanding the Termini leg and unlocking reveals the reference
    inline; refresh without Remember re-locks.
  - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 3.2_

- [ ] 12. Acceptance verification
  - Saturday 19 Sep: Termini leg expands to FB 8620, 13:57→17:44, the platform rule, and the locked
    PNR; **right passphrase reveals the PNR and seats; refresh without "Remember" re-locks** (moved
    here from spec 05). La Spezia leg shows the regional-to-Levanto instruction and the shuttle
    WhatsApp step.
  - Friday 25 Sep: vaporetto to Piazzale Roma and Aerobus to VCE, each with fare and where to buy.
  - `node tools/validate-data.mjs` passes; no leg fails validation.
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 4_

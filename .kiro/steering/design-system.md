---
inclusion: always
---

# Design system

Light mode only. Inter throughout. The direction was chosen deliberately against three
alternatives; do not drift toward dark surfaces, serif display type, or decorative gradients.

## Where it comes from

Wanderlog's structural ideas, not its skin: category colour as a system, numbered pins shared
between list and map so they read as one object, a map paired with every day rather than hidden,
rounded cards with icon tiles. Pushed away from Wanderlog by using jade as a supporting colour
rather than a brand teal, and by adding a vertical timeline thread — which Wanderlog lacks — so
transport legs read as part of the day rather than as metadata.

## Tokens — `styles/tokens.css` is the only place these are defined

```css
:root {
  /* surfaces */
  --page:   #F5F7F9;
  --card:   #FFFFFF;
  --line:   #E5EAF0;
  --line-2: #D4DCE5;

  /* text */
  --ink:    #101A27;
  --mid:    #576475;
  --dim:    #8894A4;

  /* action + lodging */
  --go:      #0B7A75;
  --go-tint: #E2F2F1;

  /* categories — fill, tint */
  --cat-sight:  #6D3BD4;  --cat-sight-tint:  #F0EAFC;
  --cat-food:   #C2540A;  --cat-food-tint:   #FCEEE2;
  --cat-stay:   #0B7A75;  --cat-stay-tint:   #E2F2F1;
  --cat-move:   #1D5FD0;  --cat-move-tint:   #E6EDFB;
  --cat-open:   #5A6673;  --cat-open-tint:   #EDEFF2;

  /* status — text, background */
  --ok:   #0F6B45;  --ok-bg:   #E4F3EB;
  --warn: #A8321C;  --warn-bg: #FBEAE6;
  --open: #8A5A00;  --open-bg: #FBF0DC;

  /* shape */
  --r-card: 16px;
  --r-ctrl: 11px;
  --r-tile: 11px;
  --r-pill: 999px;

  /* type */
  --font: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

## Type scale

| Role | Size / weight / tracking |
|---|---|
| Page title (day title) | 27px / 700 / -0.024em |
| Section heading | 19px / 600 / -0.014em |
| Stop name | 17px / 600 / -0.014em |
| Body, notes | 14.5px / 400 / 1.6 line-height, colour `--mid` |
| Time, meta | 13px / 600 / tabular numerals, colour `--dim` |
| Status chip | 12px / 500 |
| Connector text | 13px / 400, bold part 500 |

Always `font-variant-numeric: tabular-nums` on times, fares, and counts.
Never use weights above 700 or below 400. Sentence case everywhere. No all-caps labels.

## Layout primitives

- Page max width 600px, centred. On phones this is full width.
- Sticky top bar: day chips in a horizontal scroll, `--r-pill`, active chip `--go` on white text.
- Day header: eyebrow (`Day 2 of 10 — Rome`), title, then three fact tiles: stops, time on the
  move, first stop.
- Map card directly under the header, full width, `--r-card`, 6px padding.
- Timeline below: a 30px gutter on the left holding the numbered pin; a 2px thread (`--line-2`)
  connects consecutive pins through transport legs.

## Components

**Stop card** — white, 1px `--line`, `--r-card`, 14–15px padding. Row 1: 36px icon tile (category
tint background, category colour icon) beside time (13px dim) over name (17px). Then status chip
if any, note, alert block if any, lock affordance if `hasSecret`, then actions row.

**Numbered pin** — 28px circle, category fill, white 13px/600 number. Identical treatment on the
map marker so list and map match.

**Transport leg** — in the timeline between two stops. Compact form shows mode icon, bold
duration, and the one fact you need (`3 h 47 by train`, `€55 fixed fare`). Expanded form shows the
full instruction block: operator, where to buy, cost, validate or not, platform notes, fallback.
Legs with a booking reference show the lock affordance.

**Status chip** — `Booked` / `Check this` / `Not booked`, 12px, 4px 10px padding, 8px radius,
using the matching status text/background pair.

**Alert block** — `--warn-bg` background, `--warn` text, 11px radius, 10–12px padding. Used for
constraints that will bite: closures, tight connections, tail-of-service bookings.

**Actions row** — primary `Directions` (fill `--go`, white text), secondary `Copy coordinates`
(outline). 9px 14px padding, `--r-ctrl`. Minimum tap target 44px.

**Lock affordance** — dashed 1px `--line-2` box, 11px radius, dim text "Booking reference
hidden", `--go` text button "Unlock" right-aligned.

## Motion

Almost none. Expanding a transport leg or revealing a booking reference may animate height and
opacity over 160ms. Nothing animates on load. Respect `prefers-reduced-motion`.

## What not to do

- No dark mode. Not even as an option.
- No gradients, shadows heavier than `0 1px 2px rgba(16,26,39,.04)`, or blur.
- No emoji in the UI. Icons are inline SVG, 1.9px stroke, round caps.
- No middle-dot separators (`A · B · C`) in meta strings. Use commas or separate lines.
- No arrows appended to link text.
- No placeholder copy. If real content isn't available, the element isn't rendered.

# Transport legs — requirements

## Introduction
Transport instructions are the highest-stakes content in the app. A leg must be as easy to read
standing on a platform as a stop is to read standing outside a museum. Content comes only from
`itinerary.json`; this feature is about presentation and never about inventing facts.

## Requirements

### 1. Compact form (in the timeline)
1.1 THE SYSTEM SHALL render every leg between its two stops with: mode icon, bold `duration`, and
`summary`, connected to both stops by the thread.
1.2 WHEN a leg has `depart` THE SYSTEM SHALL show `depart → arrive` in tabular numerals.
1.3 WHEN a leg has `hasSecret` THE SYSTEM SHALL show a small lock glyph.

### 2. Expanded form
2.1 WHEN a leg is tapped THE SYSTEM SHALL expand in place to show, in this order and only when
present: `line` and `operator`; `depart → arrive`; `steps` as a numbered list; `buy`; `cost`;
`validate`; `platform`; `fallback`; `verified` and `source` in dim text.
2.2 WHEN a leg has `hasSecret` THE SYSTEM SHALL show the lock affordance inside the expanded form;
unlocking reveals the reference inline (see 05).
2.3 THE SYSTEM SHALL expand and collapse without shifting the stops above it.

### 3. Correctness guards
3.1 IF a leg lacks `steps`, `duration`, `verified`, or `source` THE SYSTEM SHALL fail the
`tools/validate-data.mjs` check and the build shall not be considered done.
3.2 IF a `verified` date is older than 60 days at runtime THE SYSTEM SHALL show `Checked <date>`
in the warn colour instead of dim.
3.3 THE SYSTEM SHALL never compute or estimate a fare, a departure time, or a platform.

### 4. Mode coverage
The data will contain at least: taxi (FCO fixed fare, Rome cross-town, Termini), Leonardo
Express (as a rejected alternative, in a step), Frecciabianca, Intercity, Regionale Veloce,
Frecciarossa, Cinque Terre regional trains, hotel shuttle with fixed timetable, Rome bus (as
what-not-to-take), Florence bus 12/13, vaporetto line 1, ACTV Aerobus line 5, private water taxi
(as option), and walking. Each needs an icon; unknown modes fall back to a neutral icon.

## Acceptance
- Saturday 19 Sep: Termini leg expands to show FB 8620, 13:57→17:44, the platform rule, and the
  locked PNR; La Spezia leg shows the regional-to-Levanto instruction and the shuttle WhatsApp step.
- Right passphrase in the expanded Termini leg reveals the PNR and seats; refresh without "Remember"
  re-locks. (Moved from spec 05: the leg lock affordance lives in the expanded leg, which this spec
  owns; spec 05 owns the unlock mechanism and the stop-card affordance.)
- Friday 25 Sep: two legs — vaporetto to Piazzale Roma, Aerobus to VCE — each with fare and where to buy.
- No leg in the data fails validation.

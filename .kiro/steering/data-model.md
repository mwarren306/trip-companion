---
inclusion: fileMatch
fileMatchPattern: "data/**|views/**|app.js|lib/**"
---

# Data model — `data/itinerary.json`

Single source of truth at runtime. Generated from `italy-2026.html`; never hand-edited in place.

```jsonc
{
  "trip": "Rome to Venice",
  "start": "2026-09-16",
  "end": "2026-09-25",
  "generated": "2026-09-14",          // date this file was produced from the HTML
  "days": [ Day ],
  "todo": [ Todo ]
}
```

## Day

```jsonc
{
  "n": 2,
  "iso": "2026-09-17",
  "date": "Thu 17 Sep",
  "title": "Ancient Rome",
  "place": "Rome",
  "items": [ Stop | Leg ]            // strictly in time order; legs sit between the stops they join
}
```

## Stop

```jsonc
{
  "kind": "stop",
  "id": "2c",                        // stable; used for checkmarks and secrets
  "t": "12:00",                      // display time or a word ("morning")
  "name": "Basilica di San Clemente",
  "la": 41.8893347, "lo": 12.4975757,
  "cat": "sight",                    // sight | food | stay | move | open
  "status": "set",                   // set | flag | open | plain
  "note": "…",                       // what it is and what to do there
  "alert": "…",                      // optional — a constraint that bites, rendered as alert block
  "window": { "from": "11:50", "to": "12:00" },   // optional timed-entry window
  "hasSecret": true,                 // optional; a booking reference exists in secrets.enc.json
  "directions": "w"                  // Apple Maps dirflg for the Directions button: w | r
}
```

## Leg — a transport instruction, first-class

```jsonc
{
  "kind": "leg",
  "id": "2c-2d",                     // "<from stop id>-<to stop id>"
  "mode": "walk",                    // walk | taxi | train | bus | tram | vaporetto | shuttle | boat | flight
  "summary": "€55 fixed fare",       // the one fact for the compact view
  "duration": "40 min",              // human string
  "distance": "1.3 km",              // optional; walking legs only
  "verified": "2026-09-13",          // date the facts below were checked against a primary source
  "source": "adr.it",                // where they were checked
  "steps": [                         // the full instruction block, in order, each one short
    "Use only the white municipal taxis at the Arrivals rank.",
    "Say \"cinquantacinque, tariffa fissa\" before the car moves.",
    "Fixed €55 to anywhere inside the Aurelian Walls; luggage included.",
    "Card payment is mandatory for the driver. Pay with notes under €50 if paying cash."
  ],
  "operator": "Roma Capitale licensed taxi",     // optional
  "line": "Leonardo Express",                    // optional
  "depart": "13:57", "arrive": "17:44",          // optional
  "buy": "Ticket machine or Trenitalia app",     // optional — where to buy
  "cost": "€9.50 each, valid 75 min",            // optional
  "validate": "Paper: stamp before boarding. App: do not.",   // optional
  "platform": "Posts 10–20 min out; watch the train NUMBER.", // optional
  "fallback": "Regionals Pisa→Firenze every ~30 min; a regional fare is valid on any.", // optional
  "hasSecret": true                  // PNR / seats live in secrets.enc.json under this id
}
```

Rules for legs:

- Every leg has `steps`, `duration`, `verified`, and `source`. No exceptions.
- `steps` are imperative, one action or fact each, ≤ 140 characters, in the order you'd do them.
- Fares are strings with the symbol, exactly as verified. Never "about €10". If a fare is banded,
  say so: `"€5–€10 by season band; confirm at the machine"`.
- Walking legs may be generated from coordinates (straight-line × 1.35 at 4.5 km/h) and marked
  `"source": "estimate"`. All other modes must come from the HTML or a primary source.
- A leg that crosses a day boundary does not exist; overnight is a Stop with `cat: "stay"`.

## Todo

```jsonc
{ "id": "t4", "label": "Call Belforte", "note": "…", "due": "2026-09-18" }   // due optional
```

## Trail data — `data/trails.geojson`

FeatureCollection. Each Feature has `properties: { "ref": "592-4", "name": "Monterosso –
Vernazza", "card": true, "kmDistance": 3.4, "minutes": 110 }`. Geometry from OSM, ODbL.

## Secrets — `secrets.json` (plaintext, never committed) → `data/secrets.enc.json`

```jsonc
{ "1a": "…", "4c": "…", "5a": "…" }
```

Keys are Stop or Leg ids. Values are short plain strings meant to be read aloud at a counter.

# Map — requirements

## Introduction
A real map, inside the app, that works offline. Leaflet with OpenStreetMap tiles precached for the
four trip areas, stop markers numbered to match the list, route lines per day, and the Cinque
Terre trail geometry as a toggleable layer.

## Requirements

### 1. Per-day map
1.1 THE SYSTEM SHALL render a map card under the day header showing that day's stops as numbered
pins in category colour, matching the timeline exactly.
1.2 THE SYSTEM SHALL draw a dashed line through the stops in order, except across legs whose
`mode` is train, flight, or boat, where it draws nothing.
1.3 THE SYSTEM SHALL fit bounds to the day's stops with 12% padding on load, and never below zoom 12.
1.4 WHEN a pin is tapped THE SYSTEM SHALL scroll the timeline to that stop and briefly highlight it.
1.5 WHEN a stop card's name is tapped THE SYSTEM SHALL pan the map to that pin.

### 2. Full-screen map
2.1 WHEN the map card is expanded THE SYSTEM SHALL fill the viewport with the map, keep the day
chips visible, and show a close control ≥ 44 px.
2.2 THE SYSTEM SHALL show the user's position when permission is granted, with a distinct marker.

### 3. Offline tiles
3.1 ON first load over Wi‑Fi THE SYSTEM SHALL precache OSM tiles for the four areas defined in
`data/areas.json` at zoom 13–16, with a visible progress indicator, and stop under ~2,000 tiles.
3.2 WHEN offline THE SYSTEM SHALL serve cached tiles and render a neutral placeholder for any tile
not cached, without errors in the UI.
3.3 THE SYSTEM SHALL display OSM attribution at all times.

### 4. Trail layer
4.1 WHEN the selected day is 20 Sep, or the user toggles it, THE SYSTEM SHALL render
`data/trails.geojson` with 591 in `--go`, card-required sections (592-3, 592-4) in `--cat-sight`,
and closed sections in `--warn`, dashed.
4.2 WHEN a trail is tapped THE SYSTEM SHALL show its `ref`, `name`, distance, time, and whether the
card is required.
4.3 THE SYSTEM SHALL mark the Via Corone entry point at Monterosso as a labelled pin while the
Via Servano closure is in effect (driven by data, not code).

## Acceptance
- Airplane mode after one Wi‑Fi load: every day's map renders with tiles for the trip areas.
- Day 5 shows the three trail sections with correct colours and the Via Corone pin.
- Pin numbers match list numbers on every day.

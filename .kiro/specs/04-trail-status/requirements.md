# Trail status — requirements

## Introduction
"Live trail map" is three layers: (a) trail geometry on the offline map (spec 03); (b) a live
status panel fed by a Supabase Edge Function that reads the park's public trail-network page; and
(c) one-tap handoff to the park's official GPS web map for the walk itself. The panel is
informative; the official map is authoritative.

## Requirements

### 1. Edge Function `trail-status`
1.1 THE FUNCTION SHALL fetch `https://www.parconazionale5terre.it/rete-sentieristica.php`, parse
the alert banner (the "Messaggio del … Nessuna allerta" line or its alert variant) and the status
of trails 591, 592-3, 592-4, and Via dell'Amore, and return
`{ fetchedAt, alert: { level, text, at }, trails: [ { ref, status, text } ] }`.
1.2 THE FUNCTION SHALL cache its result for 10 minutes and return the cached copy with
`stale: false` inside that window.
1.3 IF the page cannot be fetched or parsed THE FUNCTION SHALL return the last successful result
with `stale: true` and `error` set, never a 5xx to the client.
1.4 THE FUNCTION SHALL require no secrets and accept only GET.

### 2. Panel
2.1 WHEN the selected day is 20 Sep, or the trail layer is on, THE SYSTEM SHALL show a status
panel above the map card.
2.2 THE SYSTEM SHALL show the park alert level and text first, then one row per trail with status
in the matching status colour and a text label.
2.3 THE SYSTEM SHALL show `Checked <time>` and, if `stale`, `Couldn't refresh — showing <time>` in
the warn colour.
2.4 WHEN offline THE SYSTEM SHALL show the last result from `localStorage` with its timestamp, and
the manual-status fallback from `itinerary.json` (`trailStatusFallback`, dated) beneath it.
2.5 THE SYSTEM SHALL provide two actions: `Open the park's live map` →
`http://mappe.parconazionale5terre.it/mobile/` and `Trail list on parconazionale5terre.it` →
the rete-sentieristica page. Both open in the browser.
2.6 THE SYSTEM SHALL announce a refreshed status via an `aria-live="polite"` region.

### 3. Refresh
3.1 THE SYSTEM SHALL refresh on view, then at most every 10 minutes while the panel is visible.
3.2 THE SYSTEM SHALL provide a manual refresh control.

## Acceptance
- With the network on, the panel shows the park's current alert text and per-trail status within 3 s.
- Break the parser (change a selector): the panel shows stale data and the links still work.
- Airplane mode: the panel shows the last result and the dated fallback; no spinner hangs.

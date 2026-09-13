# Trip shell — requirements

## Introduction
The app shell: loads `data/itinerary.json`, renders the day navigation, the day header, and the
timeline of stops and transport legs, and opens to the right place. Every other feature mounts
inside this.

## Requirements

### 1. Loading
**User story:** As a traveller, I want the app to open instantly to today's plan so I don't tap.

1.1 WHEN the app loads THE SYSTEM SHALL read `data/itinerary.json` and render within 300 ms of
the file being available, with no network dependency.
1.2 WHEN the device date is between `start` and `end` inclusive THE SYSTEM SHALL open the Days
view on that day.
1.3 WHEN the device date is before `start` THE SYSTEM SHALL open the To-sort view and show the
number of days until `start`.
1.4 WHEN the device date is after `end` THE SYSTEM SHALL open the Days view on the last day.
1.5 IF `itinerary.json` fails to parse THE SYSTEM SHALL show a single readable error and the
`generated` date of the last good copy if one is cached.

### 2. Day navigation
2.1 THE SYSTEM SHALL render one chip per day in a horizontal scroll, sticky at the top.
2.2 WHEN a chip is tapped THE SYSTEM SHALL render that day and scroll the chip into view.
2.3 THE SYSTEM SHALL mark today's chip distinctly from the selected chip when they differ.

### 3. Day header
3.1 THE SYSTEM SHALL show `Day n of N — place`, the day title, and three facts: number of stops,
total time on the move (sum of leg durations), and the first stop's time.

### 4. Timeline
4.1 THE SYSTEM SHALL render `items` in order, stops as cards and legs as connectors, joined by a
continuous vertical thread in the gutter.
4.2 THE SYSTEM SHALL number stops sequentially within the day, on a category-coloured pin.
4.3 WHEN a stop has `status` THE SYSTEM SHALL show the matching chip with a text label.
4.4 WHEN a stop has `alert` THE SYSTEM SHALL render it as an alert block, never collapsed.
4.5 WHEN a stop has `window` THE SYSTEM SHALL show `from–to` beside the time.
4.6 THE SYSTEM SHALL show a `Directions` action opening `https://maps.apple.com/?daddr={la},{lo}&dirflg={directions}` and a `Copy coordinates` action with a `window.prompt` fallback when the clipboard API is unavailable.

### 5. Check-off
5.1 WHEN the tick on a stop is tapped THE SYSTEM SHALL mark it done, collapse the card to a
struck-through single line, and persist via the store (see 06).
5.2 WHEN a done stop is tapped again THE SYSTEM SHALL restore it.
5.3 THE SYSTEM SHALL show `k of n stops done` in the header while the trip is in progress.

## Acceptance
- Opens to the correct view for dates before, during, and after the trip (mock the clock).
- Thursday 17 Sep renders all items in order with the thread unbroken.
- Lighthouse performance ≥ 95 on a throttled mobile profile.

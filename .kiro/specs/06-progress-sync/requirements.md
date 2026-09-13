# Progress sync — requirements

## Introduction
Checkmarks (stops done, to-dos closed) are shared between two phones through Supabase, with
`localStorage` as the source of truth so the UI never waits on the network.

## Requirements
1.1 THE SYSTEM SHALL read progress from `localStorage` on load and render immediately.
1.2 WHEN a checkmark changes THE SYSTEM SHALL write `localStorage` first, then upsert
`trip_progress` for the configured `trip_id`.
1.3 IF the upsert fails THE SYSTEM SHALL queue it and retry on the next load and on `online`.
1.4 ON load with network THE SYSTEM SHALL fetch the remote row, merge per key by `updatedAt`
(last-write-wins), and write the merged result to both stores.
1.5 THE SYSTEM SHALL store `{ done: { id: ts }, todo: { id: ts } }` — timestamps, not booleans,
so merges are deterministic.
1.6 THE SYSTEM SHALL show a small, non-blocking `Synced <time>` / `Offline — will sync` line in the
To-sort view. No spinners anywhere in this feature.
1.7 THE SYSTEM SHALL use only the anon key and the schema in `supabase/schema.sql`.

## Acceptance
- Tick on phone A, reload phone B: appears.
- Tick on phone A in airplane mode, restore network, reload: appears on B.
- Conflicting ticks within a minute resolve the same way on both phones.

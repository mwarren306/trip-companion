# Italy 2026 — trip companion

Private, offline-capable trip app for one trip and two people. Static site on GitHub Pages.

Start by reading `.kiro/steering/` in this order: `product.md`, `security.md`, `tech.md`,
`structure.md`, `data-model.md`, `design-system.md`, `accessibility.md`. Then the specs in
`.kiro/specs/`, numbered in build order. Kiro's Design-First flow is the intended workflow: the
requirements are written; generate design and tasks from them.

## Before the first commit

1. `git init` and confirm `.gitignore` lists `secrets.json`.
2. `git config core.hooksPath tools/` and `ln -s precommit-secret-scan.sh tools/pre-commit`.
3. Put `secrets.json` **outside** the repo. Run `tools/encrypt.mjs` with the passphrase in an env var.
4. Only then make the repository public.

## Data

`data/itinerary.json` is generated from `italy-2026.html`, not hand-edited. Run
`node tools/validate-data.mjs` after any regeneration. Every transport leg carries a `verified`
date and `source` — see `data-model.md`. If it isn't verified, it isn't in the data.

## Development

No build step. Serve the folder over a static server so ES modules and `fetch` work, for example:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/`.

### Previewing a different date

Date-based routing (which view opens, days-until-start) reads `ctx.today` from the device clock.
For local preview only, append `?today=YYYY-MM-DD` to force that date:

- `http://localhost:8000/?today=2026-09-10` — before the trip: opens the To-sort view.
- `http://localhost:8000/?today=2026-09-17` — Thursday 17 September: opens the Days view on that day.

The override is a dev convenience; it is ignored when the value is missing or malformed, and there
is no UI for it. Tests cover routing directly (`node --test`).

## Tests

```
node --test
```

Pure logic (date routing, coordinate helpers) runs under Node's built-in test runner. No
dependencies, no build.

## Acceptance before it's "done"

Every spec has an acceptance section. The one that decides whether this works in Italy: install to
an iPhone Home Screen, enable airplane mode, force-quit, reopen, and walk through all ten days.

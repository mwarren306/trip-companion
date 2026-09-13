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

## Acceptance before it's "done"

Every spec has an acceptance section. The one that decides whether this works in Italy: install to
an iPhone Home Screen, enable airplane mode, force-quit, reopen, and walk through all ten days.

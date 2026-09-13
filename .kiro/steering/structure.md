---
inclusion: always
---

# Structure

```
/
  index.html                 app shell — nav, day header, list/map container, tracker, trail panel
  app.js                     entry: load data, route between views, wire storage
  views/
    days.js                  day chips, stop list, transport legs
    map.js                   Leaflet setup, stop markers, route lines, trail layer, tile precache
    tracker.js               "To sort" checklist
    trail.js                 Cinque Terre trail-status panel + official-map handoff
    lock.js                  passphrase prompt, decrypt, reveal booking refs
  lib/
    crypto.js                PBKDF2 + AES-GCM helpers (WebCrypto only)
    store.js                 localStorage + Supabase sync, offline queue
    geo.js                   distance/time estimates, bounds fitting
  data/
    itinerary.json           public data — see data-model.md
    secrets.enc.json         encrypted booking references (committed, ciphertext only)
    trails.geojson           OSM-derived trail geometry, ODbL
  styles/
    tokens.css               design tokens only — colours, type scale, spacing, radii
    app.css                  everything else
  fonts/                     Inter woff2, self-hosted
  vendor/                    leaflet.js, leaflet.css, supabase.js — pinned, self-hosted
  icons/                     192, 512, maskable, apple-touch
  manifest.webmanifest
  sw.js
  tools/
    encrypt.mjs              secrets.json -> data/secrets.enc.json (local only)
    precommit-secret-scan.sh git pre-commit hook: blocks commits containing known refs
  supabase/
    functions/trail-status/  Edge Function: fetches park status page, returns JSON
    schema.sql               trip_progress table + RLS
  .gitignore                 MUST list secrets.json and .env*
  README.md
```

## Rules

- One view per file. A view exports `mount(el, ctx)` and nothing else.
- `data/` is read-only at runtime.
- `secrets.json` (plaintext) lives **outside the repo** or is gitignored before the first commit.
  Never commit it. Never commit a passphrase.
- `styles/tokens.css` is the only file that defines a colour. If a hex appears anywhere else,
  that is a bug.
- Feature specs live in `.kiro/specs/<nn>-<feature>/` and are committed with the code.

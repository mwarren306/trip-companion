#!/usr/bin/env bash
# Blocks a commit that changes app code without bumping the service worker
# VERSION. App code (index.html, app.js, styles/*, views/*, lib/*) is precached
# cache-first by sw.js; without a VERSION bump, already-installed PWAs keep
# serving the old cached shell. Data under data/ is stale-while-revalidate and
# needs no bump.
#
# Install: git config core.hooksPath tools/  (run via tools/pre-commit).
set -euo pipefail

# Staged paths (Added/Copied/Modified/Renamed — not deletions).
staged=$(git diff --cached --name-only --diff-filter=ACMR)

# Does any staged path count as app code?
app_code_changed=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    index.html|app.js|styles/*|views/*|lib/*) app_code_changed=1 ;;
  esac
done <<< "$staged"

if [[ $app_code_changed -eq 0 ]]; then
  exit 0  # no app-code change → no bump needed (e.g. data/ or spec/doc edits)
fi

# App code changed. Require that sw.js's VERSION line is changed in this commit:
# the staged diff of sw.js must include an added `const VERSION = "..."` line.
version_bumped=0
if git diff --cached --name-only --diff-filter=ACMR | grep -qx "sw.js"; then
  if git diff --cached -U0 -- sw.js | grep -Eq '^\+const VERSION = "[^"]+"'; then
    version_bumped=1
  fi
fi

if [[ $version_bumped -eq 0 ]]; then
  echo "BLOCKED: app code is staged (index.html / app.js / styles / views / lib) but sw.js VERSION was not bumped in this commit." >&2
  echo "Bump the VERSION constant in sw.js so installed PWAs re-cache the new shell, then re-stage sw.js and commit." >&2
  echo "(Data-only changes under data/ do not need a bump.)" >&2
  exit 1
fi

echo "version check: clean"

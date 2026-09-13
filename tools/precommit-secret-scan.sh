#!/usr/bin/env bash
# Blocks commits containing known booking-reference shapes.
# Install: git config core.hooksPath tools/   (then this file must be named pre-commit or symlinked)
# Usage:   tools/precommit-secret-scan.sh            # scans staged diff
#          tools/precommit-secret-scan.sh --tree     # scans working tree
#
# This script contains SHAPE patterns only — never a literal booking reference. The specific
# live values live in tools/secret-patterns.local (gitignored), one regex per line, and are
# sourced below when present so the strict scan still runs on our machines.
set -euo pipefail

# Paths that legitimately contain reference shapes or ciphertext and must not be scanned:
#   data/secrets.enc.json          — encrypted blob, ciphertext only
#   tools/precommit-secret-scan.sh — this script, contains the shape patterns
#   tools/secret-patterns.local    — gitignored literal values, never committed
#   .kiro/steering/*.md            — steering docs that describe the patterns and schema
EXCLUDES=(
  ':(exclude)data/secrets.enc.json'
  ':(exclude)tools/precommit-secret-scan.sh'
  ':(exclude)tools/secret-patterns.local'
  ':(exclude).kiro/steering/*.md'
)

PATTERNS=(
  'PNR[[:space:]]*[A-Z0-9]{6}'                        # Trenitalia PNRs
  'record locator'
  'ticket code'
  'order[[:space:]]+[0-9]{8,10}'                      # order followed by 8–10 digits
  'voucher code'
  'wifi5terre'
  'TRIP_PASSPHRASE='
  'service_role'
  '\b[A-Z0-9]{6}\b.*(coach|carrozza|seat)'            # 6-char token on a line with coach/carrozza/seat
)

# Merge in local literal-value patterns if present (one regex per line, blanks/comments ignored).
LOCAL_PATTERNS="tools/secret-patterns.local"
if [[ -f "$LOCAL_PATTERNS" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    PATTERNS+=("$line")
  done < "$LOCAL_PATTERNS"
fi

if [[ "${1:-}" == "--tree" ]]; then
  SRC=$(git ls-files --cached --others --exclude-standard -- . "${EXCLUDES[@]}" | xargs -r cat -A 2>/dev/null || true)
else
  SRC=$(git diff --cached -U0 -- . "${EXCLUDES[@]}" | grep '^+' || true)
fi
hit=0
for p in "${PATTERNS[@]}"; do
  if printf '%s\n' "$SRC" | grep -Eiq -- "$p"; then
    echo "BLOCKED: matched pattern: $p" >&2; hit=1
  fi
done
if [[ $hit -eq 1 ]]; then
  echo "A booking reference or secret appears in the commit. Move it to secrets.json (gitignored) and re-encrypt." >&2
  exit 1
fi
echo "secret scan: clean"

#!/bin/sh
# Pull the latest CV (markdown + PDF) from the sibling resume repo into this site.
# Usage: ./sync.sh [path-to-resume-repo]   (default: ../resume)
set -e
cd "$(dirname "$0")"
SRC="${1:-../resume}"
MD=$(ls -t "$SRC"/cody-adams-*.md 2>/dev/null | grep -v cover-letter | head -1)
PDF=$(ls -t "$SRC"/cody-adams-*.pdf 2>/dev/null | grep -v cover-letter | head -1)
[ -n "$MD" ] && [ -n "$PDF" ] || { echo "could not find CV md/pdf in $SRC" >&2; exit 1; }
cp "$MD" README.md
cp "$PDF" assets/cody-adams-cv.pdf
echo "Synced: $MD -> README.md"
echo "Synced: $PDF -> assets/cody-adams-cv.pdf"
echo "Review with 'git diff', then commit and push to deploy."

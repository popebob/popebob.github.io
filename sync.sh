#!/bin/sh
# Pull the latest CV (markdown + PDF) from the sibling resume repo into this site.
# Usage: ./sync.sh [path-to-resume-repo]   (default: ../resume)
set -e
cd "$(dirname "$0")"
SRC="${1:-../resume}"

# find (not `ls | grep`) so filenames with spaces or dashes stay safe; `ls -t`
# on the filtered set picks the newest.
newest() {
	find "$SRC" -maxdepth 1 -type f -name "cody-adams-*.$1" \
		! -name "*cover-letter*" -exec ls -t {} + 2>/dev/null | head -n 1
}

MD=$(newest md)
PDF=$(newest pdf)

if [ -z "$MD" ] || [ -z "$PDF" ]; then
	echo "could not find CV md/pdf in $SRC" >&2
	exit 1
fi

cp "$MD" README.md
cp "$PDF" assets/cody-adams-cv.pdf
echo "Synced: $MD -> README.md"
echo "Synced: $PDF -> assets/cody-adams-cv.pdf"
echo "Review with 'git diff', then commit and push to deploy."

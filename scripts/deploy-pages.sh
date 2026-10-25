#!/usr/bin/env bash
# Build the static single-page version and publish it to the gh-pages branch (GitHub Pages).
# Usage: bash scripts/deploy-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_NAME=pulse-resident-hub
rm -rf .output
PAGES_BASE="/$REPO_NAME/" MSYS_NO_PATHCONV=1 npx vite build
OUT=.output/public
cp "$OUT/_shell.html" "$OUT/index.html"
cp "$OUT/_shell.html" "$OUT/404.html"   # GitHub Pages serves this for deep links like /staff
touch "$OUT/.nojekyll"
rm -f "$OUT/_headers"
REMOTE=$(git remote get-url origin)
cd "$OUT"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C ../.. config user.name)" -c user.email="$(git -C ../.. config user.email)" commit -qm "Deploy Pulse to GitHub Pages"
git push -qf "$REMOTE" gh-pages
rm -rf .git
echo "Deployed to gh-pages"

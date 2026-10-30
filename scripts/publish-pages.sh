#!/usr/bin/env bash
# Publish the built web bundle to the `gh-pages` branch (single-commit history).
# The Pages site is served from that branch root, so no build runs on GitHub's side.
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="${BRANCH:-gh-pages}"
DIST="${DIST:-dist}"

if [[ ! -f "$DIST/index.html" ]]; then
  echo "publish-pages: $DIST/index.html missing — run 'bun run build' first" >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -r "$DIST"/. "$WORK"/
# Jekyll would otherwise ignore paths starting with an underscore.
: > "$WORK/.nojekyll"

REMOTE="$(git remote get-url origin)"
cd "$WORK"
git init -q -b "$BRANCH"
git add -A
git -c user.name="LuaPlot rotation" -c user.email="rotation@luaplot.local" \
    commit -q -m "build: $(date -u +%Y-%m-%dT%H:%M:%SZ) (${GITHUB_SHA:-local})"
git push -q -f "$REMOTE" "$BRANCH"
SHA="$(git rev-parse --short HEAD)"
echo "PUBLISHED_BRANCH=$BRANCH"
echo "PUBLISHED_SHA=$SHA"

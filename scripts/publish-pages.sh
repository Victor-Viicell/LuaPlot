#!/usr/bin/env bash
# Publish the built web bundle to the `gh-pages` branch. The Pages site is served from that branch
# root, so no build runs on GitHub's side.
#
# **Why this continues the remote branch instead of starting a fresh root commit:** GitHub began
# rejecting the old flow (`git init` + a parentless commit + `push -f`) with
# `remote: fatal error in commit_refs_rules` — on `gh-pages`, and on a throwaway branch too, with the
# owner's verified identity as author. A parented, fast-forward commit pushes fine, so a publish now
# adds one commit per deploy. Force-pushing to squash that history is not worth guessing at a rule the
# server enforces without saying which one it is.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"

BRANCH="${BRANCH:-gh-pages}"
DIST="${DIST:-dist}"

if [[ ! -f "$DIST/index.html" ]]; then
  echo "publish-pages: $DIST/index.html missing — run 'bun run build' first" >&2
  exit 2
fi

# Jekyll would otherwise ignore paths starting with an underscore.
: > "$DIST/.nojekyll"

REMOTE="$(git remote get-url origin)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
git init -q -b "$BRANCH"
git remote add origin "$REMOTE"

if git fetch -q --depth=1 origin "$BRANCH" 2>/dev/null; then
  git reset -q --hard FETCH_HEAD
  git rm -rq --ignore-unmatch . >/dev/null
else
  # The very first publish has no remote branch to continue.
  echo "publish-pages: no remote $BRANCH yet, starting it" >&2
fi

cp -r "$REPO/$DIST"/. "$WORK"/
git add -A

if git rev-parse --verify -q HEAD >/dev/null && git diff --cached --quiet; then
  echo "PUBLISHED_BRANCH=$BRANCH"
  echo "PUBLISHED_SHA=$(git rev-parse --short HEAD)"
  echo "publish-pages: nothing changed"
  exit 0
fi

git -c user.name="LuaPlot rotation" -c user.email="rotation@luaplot.local" \
    commit -q -m "build: $(date -u +%Y-%m-%dT%H:%M:%SZ) (${GITHUB_SHA:-local})"
git push -q origin "$BRANCH"
SHA="$(git rev-parse --short HEAD)"
echo "PUBLISHED_BRANCH=$BRANCH"
echo "PUBLISHED_SHA=$SHA"

#!/usr/bin/env bash
# Build for the GitHub Pages base path, publish to gh-pages, wait until the live URL answers.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE="https://victor-viicell.github.io/LuaPlot/"

echo "== build (base=/LuaPlot/)"
LUAPLOT_BASE=/LuaPlot/ bun run build >/tmp/luaplot-publish-build.log 2>&1 || {
  tail -25 /tmp/luaplot-publish-build.log >&2
  echo "PUBLISH FAILED (build)" >&2
  exit 1
}

# Pages has no SPA rewrites: a copy of index.html as 404.html makes deep links resolve.
cp dist/index.html dist/404.html

echo "== publish"
./scripts/publish-pages.sh

echo "== verify"
for i in $(seq 1 18); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE" || true)
  if [[ "$code" == "200" ]]; then
    echo "LIVE=$SITE"
    exit 0
  fi
  sleep 10
done
echo "PUBLISH FAILED (site did not answer 200 at $SITE)" >&2
exit 1

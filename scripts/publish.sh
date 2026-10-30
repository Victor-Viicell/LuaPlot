#!/usr/bin/env bash
# Build for the GitHub Pages base path, publish to gh-pages, wait until the live URL serves
# *this* build. Pages answers 200 from its CDN for minutes after a push while still serving the
# previous deployment, so a 200 alone proves nothing: poll until the live index.html references the
# bundle hash we just built.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE="https://victor-viicell.github.io/LuaPlot/"
PROBE="/tmp/luaplot-live-index.html"

echo "== build (base=/LuaPlot/)"
LUAPLOT_BASE=/LuaPlot/ bun run build >/tmp/luaplot-publish-build.log 2>&1 || {
  tail -25 /tmp/luaplot-publish-build.log >&2
  echo "PUBLISH FAILED (build)" >&2
  exit 1
}

BUILT_JS="$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1)"
if [[ -z "$BUILT_JS" ]]; then
  echo "PUBLISH FAILED (no bundle reference in dist/index.html)" >&2
  exit 1
fi

# Pages has no SPA rewrites: a copy of index.html as 404.html makes deep links resolve.
cp dist/index.html dist/404.html

echo "== publish ($BUILT_JS)"
./scripts/publish-pages.sh

echo "== verify"
live_js=""
for i in $(seq 1 40); do
  code=$(curl -s -o "$PROBE" -w '%{http_code}' "$SITE?cb=$(date +%s%N)" || true)
  live_js=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$PROBE" 2>/dev/null | head -1 || true)
  if [[ "$code" == "200" && "$live_js" == "$BUILT_JS" ]]; then
    echo "LIVE=$SITE"
    echo "LIVE_JS=$live_js"
    exit 0
  fi
  sleep 10
done
echo "PUBLISH FAILED (live serves ${live_js:-nothing}, expected $BUILT_JS; Pages deploy lagged past 400s)" >&2
exit 1

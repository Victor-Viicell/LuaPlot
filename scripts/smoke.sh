#!/usr/bin/env bash
# T-38 — one command for the twenty-eight-journey walk: serve the build under test, walk it, tear down.
#
# `scripts/smoke.sh`            → the local production build (`bun run build` then `vite preview`)
# `scripts/smoke.sh --live`     → the published site, exactly what a reader loads
#
# Exit code is the walk's: 0 only when all twenty-eight rows pass.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-4321}"
LOG="/tmp/luaplot-smoke-preview.log"

if [[ "${1:-}" == "--live" ]]; then
  node scripts/smoke.mjs --url "https://victor-viicell.github.io/LuaPlot/"
  exit $?
fi

echo "== build"
if ! bun run build >/tmp/luaplot-smoke-build.log 2>&1; then
  tail -20 /tmp/luaplot-smoke-build.log >&2
  echo "SMOKE FAILED (build)" >&2
  exit 1
fi

echo "== preview :$PORT"
bun run preview --port "$PORT" --strictPort >"$LOG" 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT

for _ in $(seq 1 40); do
  if curl -s -o /dev/null "http://localhost:$PORT/"; then break; fi
  sleep 0.25
done

node scripts/smoke.mjs --url "http://localhost:$PORT/"
RC=$?
kill "$SERVER" 2>/dev/null
exit $RC

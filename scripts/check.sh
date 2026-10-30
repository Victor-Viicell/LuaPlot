#!/usr/bin/env bash
# The one gate. Prints GREEN only when typecheck, build and route sanity all pass.
set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0
say() { printf '%s\n' "$*"; }

# 1. Typecheck + production build (tsrx-tsc --noEmit && vite build)
say "== build"
if bun run build >/tmp/luaplot-build.log 2>&1; then
  say "   build ok"
else
  say "   BUILD FAILED — tail:"
  tail -25 /tmp/luaplot-build.log | sed 's/^/   /'
  FAIL=1
fi

# 2. Build output sanity
say "== output"
if [[ -f dist/index.html ]]; then
  if grep -q 'src="/assets/' dist/index.html; then
    say "   WARN index.html references /assets/ — fine for Tauri, broken on Pages unless base is set"
  fi
  say "   dist/index.html ok ($(du -sh dist | cut -f1))"
else
  say "   MISSING dist/index.html"
  FAIL=1
fi

# 3. Route table sanity against the spec index (skipped until the router exists)
say "== routes"
if [[ -f src/router.ts ]]; then
  if node scripts/spec-routes.mjs; then
    say "   routes ok"
  else
    say "   ROUTE TABLE MISMATCH"
    FAIL=1
  fi
else
  say "   SKIP (src/router.ts not created yet)"
fi

# 4. Preview host must stay public — Pages dies on a private repo
say "== host"
if out=$(gh repo view --json visibility -q .visibility 2>/dev/null); then
  if [[ "$out" == "PUBLIC" ]]; then say "   repo public ok"; else say "   WARN repo is $out — GitHub Pages preview is down"; fi
else
  say "   SKIP (gh unavailable)"
fi

if [[ $FAIL -eq 0 ]]; then
  say "GREEN"
  exit 0
fi
say "RED"
exit 1

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

# 3. Route table sanity — RETIRED. It compared `src/router.ts` against the route table in
#    `src/specs/luaplot-pages.md`, and that tree is gone for good (owner: development is guided by him
#    and DESIGN.md, and nothing is restored). A check that reads a deleted file can only ever be red, so
#    it is skipped by name instead of quietly passing on nothing.
say "== routes"
say "   SKIP (src/specs is retired; DESIGN.md is the design source)" 

# 4. Preview host must stay public — Pages dies on a private repo
say "== host"
if out=$(gh repo view --json visibility -q .visibility 2>/dev/null); then
  if [[ "$out" == "PUBLIC" ]]; then say "   repo public ok"; else say "   WARN repo is $out — GitHub Pages preview is down"; fi
else
  say "   SKIP (gh unavailable)"
fi

# 5. Schemas: every fixture parses, and the three negative cases fail (T-07B)
say "== schema"
if bun run schema:check >/tmp/luaplot-schema.log 2>&1; then
  grep -E '^\s+(ok|[0-9]+ rows)' /tmp/luaplot-schema.log | tail -4 | sed 's/^/   /'
  say "   schema ok"
else
  say "   SCHEMA FAILED — tail:"
  tail -20 /tmp/luaplot-schema.log | sed 's/^/   /'
  FAIL=1
fi

# 6. The desktop shell's window invariants (T-33) — the one config no other section reads
say "== tauri"
if [[ -f src-tauri/tauri.conf.json ]]; then
  if node scripts/tauri-config.mjs; then
    say "   tauri ok"
  else
    say "   TAURI CONFIG MISMATCH"
    FAIL=1
  fi
else
  say "   SKIP (no src-tauri/)"
fi

# 7. Every in-app anchor is a push, not a document load (T-46)
say "== links"
if node scripts/link-check.mjs; then
  say "   links ok"
else
  say "   BARE ANCHOR — a press would re-boot the app"
  FAIL=1
fi

# 8. The accent is a mark colour; it never paints text (T-48). Text takes --color-accent-text, a
# text hover --color-accent-hover-text. src/styles.css AND every .tsrx <style> block are scanned.
say "== tiers"
if node scripts/tier-check.mjs; then
  say "   tiers ok"
else
  say "   MARK PAINTING TEXT — text takes --color-accent-text / --color-accent-hover-text"
  FAIL=1
fi

# 9. A page never writes the address bar behind the router's back (T-66). The seam is
# commitQuery() — it writes history *and* moves the shell's mounted key. A raw write left the key on
# the pre-query location, so the next press on that route was a silent no-op (URL cleared, grid
# still filtered) and the narrowed view could not be shared from the address bar at all.
say "== history"
if node scripts/history-check.mjs; then
  say "   history ok"
else
  say "   WRITE BEHIND THE ROUTER — a page must commit its query through commitQuery()"
  FAIL=1
fi

# 10. A literal beside an inline element keeps its word break (T-70). Ripple trims a text node's
# boundary whitespace when its neighbour is an element, so `</a> if` renders `</a>if` — and an
# explicit {" "} is a text piece of its own that survives. Whether a site loses the break is decided
# by the compiler's bucketing, so this reads the BUILT bundle, which is why it sits after section 1.
say "== wordbreak"
if node scripts/wordbreak-check.mjs; then
  say "   wordbreak ok"
else
  say '   GLUED TEXT — write {" "} in the .tsrx, an explicit space survives the trim'
  FAIL=1
fi

if [[ $FAIL -eq 0 ]]; then
  say "GREEN"
  exit 0
fi
say "RED"
exit 1

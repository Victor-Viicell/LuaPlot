# Progress log

Append-only. Newest first. Every entry: ticket, what changed, what was verified and how, what
could not be verified.

## T-01 — router + shell skeleton (2026-10-30)

- **Changed:** `src/router.ts` (30-route table mirroring the spec index, specificity-ordered
  matcher, `navigate` / `currentRoute` / `onRouteChange` / `useQuery`, BASE-aware `href`),
  `src/App.tsrx` rewritten as the shell (top bar, five-destination bottom bar, `md` rail,
  `lg` 240px sidebar, skeleton / not-found / error outlet, overflow menu), `src/components/Icons.tsrx`
  (7 icons, one 20px / 1.5 stroke set), `src/components/PagePlaceholder.tsrx`, 30 page placeholders,
  `.ico` base rules in `src/styles.css`, `src/vite-env.d.ts`.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes match the spec); real Chromium pass
  at 360×740, 640, 900, 1280 — zero horizontal overflow at every width, tab bar swaps to the rail at
  900, rail widens to 240 at 1200, tab target 72×59, top bar 56, labels 12px; tab clicks, overflow
  menu, `history.back()`/`forward()` and deep links (`/character/<uuid>`, `/moderation/<uuid>`,
  `/user/<handle>`, `/user/a` → not found, `/nope` → not found) all resolve; Latte and Mocha both
  render from tokens (bg `#eff1f5` / `#1e1e2e`, accent `#8839ef` / `#cba6f7`).
- **Not verified:** no Tauri/Android build (T-33/T-35). `access` is declared on every route but
  nothing enforces it — that is T-04 (session) + T-30 (redirect matrix). No test runner exists, so
  the route check stays in `scripts/spec-routes.mjs`.
- **Publish:** the first `publish.sh` printed `LIVE` while Pages was still serving the *previous*
  build (its CDN answered 200 for ~4 minutes with the old `index-DNvyvbRv.js`; the site only flipped
  to the new bundle at 16:06, well after the 200). `publish.sh` now polls until the live
  `index.html` references the bundle hash it just built, and fails if that takes past 400s. The
  comparison path is verified (second run matched immediately); the stale-deploy wait itself was
  observed by hand, not inside the script.

## 2026-10-30 — setup (baseline, not a ticket)

- Baseline build verified: `bun run build` → 81 modules, 156ms, dist 13.3KB JS / 11.2KB CSS.
  Tree clean at commit `806d45b`.
- Preview host established: repo made public, `gh-pages` branch created, GitHub Pages enabled →
  **https://victor-viicell.github.io/LuaPlot/** (200). Vite `base` now reads `LUAPLOT_BASE`, set to
  `/LuaPlot/` by `scripts/publish.sh`, which also publishes `404.html` for deep links.
- Vercel path documented but not used: deploys succeed through the connector yet every deployment
  is SSO-protected and the project alias 404s (connector has no permission to change project
  settings). `scripts/deploy.py` stays as a fallback; Pages is the canonical preview.
- Rotation scaffolding: `docs/CONTRACT.md`, `docs/SHIP-PLAN.md` (39 tickets, 6 phases, failure
  bank), `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/NEXT.md`, `scripts/{check,publish,publish-pages,agent-lock}.sh`,
  `scripts/spec-routes.mjs`.
- Secrets: `DEEPSEEK_API_KEY` and `OPENROUTER_API_KEY` in `.env.local` (gitignored, mode 600),
  `.env.example` documents the shape. Both are read **only** by `supabase/functions/*` later.
- Not verified: nothing mobile yet — no Android SDK, NDK, `adb` or rust android targets on this
  box (T-35 covers it). Supabase connector cannot list projects (403), so the memory adapter is the
  data source until a project ref is supplied.

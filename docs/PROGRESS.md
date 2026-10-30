# Progress log

Append-only. Newest first. Every entry: ticket, what changed, what was verified and how, what
could not be verified.

## T-06 — `/authentification` (2026-10-30)

- **Changed:** `src/lib/auth.ts` (new seam: `Provider`, `PROVIDERS`, `PROVIDER_NAMES`,
  `AuthOutcome` = redirecting / cancelled / failed, `signInWithProvider` resolving `cancelled` after
  600ms, `?auth=cancelled|failed|redirecting` preview switch, no network, no `session.signIn()`);
  `src/pages/authentification.tsrx` rewritten as home's title page with three equal `secondary`
  providers, one `track<AuthStatus>` + five derived readings, a status row that reserves 20px
  (grows to 44 for the inline `Try again`), the preview line and the onboarding footer link;
  `src/components/Button.tsrx` now accepts `disabled: boolean | Derived<boolean>` and reads it
  through `read()` inside its own render. Docs: `DESIGN.md` gains an Auth section, `SHIP-PLAN.md`
  ticks T-06, `NEXT.md` rewritten for T-07.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes). Chromium at 360×740, 640×900,
  900×1000, 1280×900: `.screen` scrollHeight == clientHeight at every width (zero scroll in idle,
  redirecting, cancelled **and** failed), `scrollWidth ≤ innerWidth` everywhere, buttons 328×44 at
  360 and 420×44 from `sm`, gate 328/592/656/560 wide, wordmark 34→44 and lede 14→15 at `lg`, rail
  71px at 900 and the tab bar gone. States driven by real clicks and read back from the DOM:
  idle (`session ·` line empty, three enabled) → Google → all three `disabled` + `Redirecting to
  Google…` at 12px in `--color-text-muted` → `Google sign-in was cancelled.` with the buttons
  re-enabled; `?auth=failed` → `No callback arrived from GitHub.` in `--color-danger` (Latte
  `#d20f39`, Mocha `#f38ba8`) with a 111×44 `Try again` (`aria-label="Try again with GitHub"`)
  that returns to the redirecting state; `?auth=redirecting` holds the hand-off with all three
  disabled. `/`, `/dev/primitives` and `/dev/state` re-checked after the `Button` change (plain
  `disabled={true}` still disables).
- **Not verified:** no Supabase call exists to verify — the seam answers from a stub, so the real
  provider round-trip, the callback and the `redirected away` matrix are T-30. The 600ms resolve is
  throttled to ~1.4s in a background tab (a hidden Chromium clamps timers), so the state was read
  after a longer wait rather than at exactly 600ms. No screenshot-level check of the four Catppuccin
  flavours on this page (tokens only). The signed-out→auth redirect and the onboarding gate are
  absent by design and recorded in `DESIGN.md`.

## T-05 — `/` home (2026-10-30)

- **Changed:** `src/pages/home.tsrx` — `PagePlaceholder` replaced with the real title page
  (kicker, 34px wordmark / 44 at `lg`, one spec-grounded paragraph, hairline, a `session ·` reading,
  and the single entry control). Session mirrored into a page-local `track()` via `onSession`, with
  three derived readings (`reading`, `target`, `label`) so `User | null` narrows in one place. The
  control is a real `<a class="btn btn-primary">` (a button cannot carry `href`) targeting
  `/authentification` signed out and `/user/<handle>` signed in; no redirect for signed-in visitors,
  `router.ts` untouched. Docs: `DESIGN.md` gains a Home section (composition, measure, the
  `min-height` arithmetic), `SHIP-PLAN.md` ticks T-05, `NEXT.md` rewritten for T-06.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes); live
  `assets/index-*.js` matched by `publish.sh` on `https://victor-viicell.github.io/LuaPlot/` (200).
  Chromium at 360×740, 640×900, 900×800, 1280×900: `.content` scrollHeight == clientHeight at every
  width (**zero scroll on the 360×740 first screen**, which is what the `min-height` numbers are
  for), `scrollWidth` ≤ `innerWidth` everywhere, button 44px tall (328×44 full-width at 360, 136×44
  from `sm`), column 328/592/656/560 wide with the block optically centred in each frame. States,
  by driving the real store: signed in → `session · signed in as You` + `Open profile` →
  `/user/you`; sign out via the overflow menu → `session · signed out` + `Sign in` →
  `/authentification`, and the click lands on `/authentification` (title `Sign in — LuaPlot`); sign
  out on another route, then SPA-navigate home with the tab bar → the page renders the signed-out
  control (the mirror works, no stale snapshot after a reload-free navigation). Primary button
  paints `--color-accent` (`#8839ef` in Latte), no hard-coded colours.
- **Not verified:** no screenshot-level proof of the Mocha/Frappé/Macchiato flavours on this page
  (tokens only; T-02 verified them). No test runner exists, so the states above were asserted by
  reading the live DOM, not by an assertion in CI. The spec's "signed-in visitors redirected away"
  line lives on `/authentification`, not here; the redirect matrix is still T-30. Nothing persists
  across reload (memory adapter) and nothing pretends to.
- **Decision recorded:** the greeting names the display name, not the handle (`docs/NEXT.md` open
  decision); the handle appears only as the link target.

## T-04 — session + NSFW preference state (2026-10-30)

- **Changed:** `src/lib/state/session.ts` (new: `currentUser/isSignedIn/signIn/signOut/onSession`
  over a plain subscribe/notify store, mock `you` seeded signed in, `sessionNotifications()`),
  `src/lib/state/prefs.ts` (new: `nsfwPreference/setShowNsfw/setBlurNsfw/onPrefs/reloadPreferences`,
  clearing to off before every read, re-reading on `onSession`, refusing writes while signed out),
  `src/lib/data/types.ts` (`User`, `AccountPreferences`), `repo.ts` + `memory.ts`
  (`getPreferences(handle)` / `savePreferences(handle, patch)`, a map keyed by handle — not by
  device — with both off for an unknown handle), `src/App.tsrx` (profile tab points at
  `currentUser().handle` and falls back to `/` when signed out; overflow menu gains a *Preview only*
  block with the dev sign-in/out switch, a one-line NSFW readout and a `/dev/state` link),
  `src/pages/dev-state.tsrx` (new `/dev/state`, added to `ROUTES` only), `src/router.ts` (the route
  entry). Docs: `ARCHITECTURE.md` gains a Session section, the two preference methods and a
  corrected `lib/state/` layout line; `DESIGN.md` gains the state page and the dev menu block.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes match the spec with `/dev/*`
  excluded); live `assets/index-Dn8vd7UF.js` on `https://victor-viicell.github.io/LuaPlot/` (200,
  hash matched by `publish.sh`; the published `/dev/state` renders `State`, badges
  `session signed in / handle @you / admin no`). Chromium, local build and live: toggling Show moved
  Prefs-emits 0→1 and the count strip to `on`; toggling Blur made it `on · blur`; `Sign out` flipped
  the page to `handle —`, both toggles `aria-pressed=false` **and disabled**, and the note to
  *Signed out: nothing NSFW is shown…*; `Sign in as @you` restored `on · blur` from the adapter —
  that is the per-account proof, since the store had cleared to off. Shell: menu readout read
  `nsfw · listed, blurred`, the Profile tab was `/user/you` signed in and `/` signed out, and no tab
  read as active on `/dev/state`. Widths 360/640/900/1200: `scrollWidth` ≤ `innerWidth` at every
  one, no sub-12px text, rail appears at 900 and tab bar disappears there. `/dev/data`,
  `/dev/primitives` and `/character/catalog` still render after the change.
- **Not verified:** the ticket's acceptance — "toggling Blur in one place is reflected on a catalog
  after navigation" — has no catalog to land on until T-09; what is proven is the store plus the
  shell's readout plus the adapter round-trip. Preferences reset on reload (memory adapter, no
  Supabase project ref) and that is deliberate, not faked with `localStorage`. The memory adapter's
  `VIEWER` is still a constant, so signing out hides nothing in a listing — that is T-30, recorded
  in the baton so it is not "fixed" by importing the session into `memory.ts` (module cycle). No
  test runner exists; the stores are asserted by reading `/dev/state`, not by an assertion.

## T-03 — data contract + memory adapter (2026-10-30)

- **Changed:** `src/lib/data/types.ts` (every entity derived from the specs; `ratioOf()` derives the
  ratio from the vote counts, and personas carry no engagement and no NSFW flag), `repo.ts` (the
  seam: one list method per kind returning `{ items, hasMore }` at 24/page, lookups returning
  `null`, mutations returning the updated entity, `resolveRepo()`), `memory.ts` (deep-copied
  fixtures, derived `commentCount`/`replyCount`, one vote per viewer with a switch replacing the
  earlier vote, listings hiding what is not public and not the viewer's, `findSessionForCharacter`
  for Start/Continue), `src/lib/fixtures/{ids,characters,lorebooks,presets,personas,posts,social,sessions,index}.ts`
  (8 characters, 6 lorebooks, 5 presets, 3 personas, 12 posts, 18 comments, 6 alerts, 4 cases,
  2 sessions with transcripts; ids are real 36-char UUIDs or every detail link would 404), and
  `src/pages/dev-data.tsrx` (`/dev/data`, added to `ROUTES` only — not to the spec, not to the tab
  bar). `docs/ARCHITECTURE.md` records the seam shapes; `docs/DESIGN.md` notes the second dev page.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes match the spec with `/dev/*`
  excluded); live `index-BUfrGS6u.js` on `https://victor-viicell.github.io/LuaPlot/` (200, bundle
  hash matched by `publish.sh`). Chromium at 360×740: `scrollWidth` 360 = `innerWidth`, no
  horizontal scroll, counts grid 2-up. At 1280×900: 3 card columns, 4 count columns, `scrollWidth`
  1270 < 1280. Counts read 8/5/5/3/12/18/6/4 (5 lorebooks because one fixture is private, which is
  the point of the private one). "Vote like" logged `39/14 → 40/14` and the card ratio recomputed
  from the counts; the busiest thread reads 4 comments through `listComments` while the item's
  derived `commentCount` says 4 too.
- **Not verified:** no Supabase adapter, so the error envelope is still undesigned (recorded as an
  open decision). Nothing consumes `vote`/`isBookmarked`/`toggleBookmark` from a product page yet —
  they are proven only on `/dev/data`. No test runner exists; the derivations are checked by eye on
  the dev page, not by an assertion.

## T-02 — design primitives (2026-10-30)

- **Changed:** the eleven primitives `src/components/{Button,Field,Toggle,Card,Sheet,Toast,Tabs,
  EmptyState,Skeleton,Avatar,Icons}.tsrx` plus `src/lib/reactive.ts` (`read()` for live props) and
  `src/lib/toast.ts` (subscribe/notify queue, no module-scope `track()`); the whole look added to
  `src/styles.css` under "Primitives (T-02)" — one stylesheet, semantic tokens only, because a
  scoped `<style>` block can never reach into a child component; `src/pages/dev-primitives.tsrx`
  (`/dev/primitives`, 10 sections, theme switch on `data-theme`, stage width 360/640/900/1280);
  `/dev/*` filtered out of `scripts/spec-routes.mjs`; `<ToastHost />` mounted in `App.tsrx`.
  `docs/DESIGN.md` records the decisions (stylesheet location, toast placement, z ladder 8/9 ·
  40 · 41 · 60, Tabs does not own the query).
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes match the spec with `/dev/*`
  excluded); live bundle `index-CCEwLjsa.js` on `https://victor-viicell.github.io/LuaPlot/`, 200.
  Chromium pass at 360×740 and 1280×900: zero page-level horizontal overflow at both, shell swaps
  tab bar → rail at 900 and keeps 5 tabs, every tap target ≥ 44px, sheet is a bottom sheet at 360
  (`bottom: 0`, 6px top radius) and a 520px centred dialog at 1280, focus lands on the panel and Tab
  wraps last→first, Escape closes, toast renders in the polite live region with its message, tabs
  flip `aria-selected`, a field accepts typing. All four flavours read their own tokens
  (`--color-accent` #cba6f7 / #8839ef / #ca9ee6 / #c6a0f6; page bg #1e1e2e / #eff1f5 / #303446 /
  #24273a). `/dev/primitives` deep-links on Pages through `404.html` (HTTP 404, app boots — the
  usual Pages SPA behaviour; the root URL is the 200).
- **Not verified:** no Tauri/Android build (T-33/T-35); the toast's auto-dismiss timer and the
  sheet's 180ms motion were not timed by hand (the automation tab throttles animations, so painted
  `transition` values read as their start value — tokens, not paint, were used for the theme check).
  No test runner: the gallery is a manual proof, exactly like the shell in T-01.

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

# Baton — what the next session does

**Ticket: T-01 — Router + shell skeleton.**
Why first: every route in the plan depends on the shell and the route table; until it exists each
page ticket would invent its own navigation.

## Do

1. Create `src/router.ts`:
   - Export `ROUTES` — one entry per spec route, `{ path, page, access }`, with `page` as a lazy
     `() => import("./pages/...")` and `access: "public" | "signed-in" | "onboarding" | "admin"`.
   - Match fixed segments before params; params are UUID-shaped (`[0-9a-f-]{36}`); query string is
     left untouched for pages to read.
   - `navigate(path, { replace })`, `currentRoute()` signal, `useQuery()` reading
     `location.search`, and popstate handling.
   - Base path from `import.meta.env.BASE_URL` so `/LuaPlot/` works on Pages.
2. Create `src/pages/<route>.tsrx` placeholders for every route, each rendering the page title from
   the spec plus `data-route` for the smoke test. Keep them one-liners; real work comes later.
3. Rewrite `src/App.tsrx`: mobile top bar (back/title/overflow), bottom tab bar (Home, Thread,
   Catalog, Notifications, Profile), desktop sidebar at `md`+, `<main>` wiring `currentRoute()`,
   `100dvh` layout, safe-area padding.
4. Add `src/router.test.ts`-style assertions only if a runner exists — otherwise put the route
   check in `scripts/spec-routes.mjs` (already written) and make it pass.

## Traps

- `src/App.tsrx` currently hardcodes `.app { height: 100dvh }` with no outlet — replace, don't layer.
- Ripple `.tsrx` is not JSX: no `className`, use `class`; expressions use `{}`; control flow via
  `@if` / `@for` blocks. Read `.agents/skills/ripple-ts/SKILL.md` before writing components.
- `scripts/spec-routes.mjs` compares `path:` literals with the spec table — keep the exact spec
  paths (e.g. `/user/[user.username]`, `/moderation/[report.id]`), and route the param names the
  spec uses. It normalises params to `:p`, so param *names* are free.
- Do not add a router dependency. ~120 lines of match/navigate is enough and keeps the bundle small.

## Open decisions

- None blocking. Tag taxonomy still undecided (no tags row yet), Stripe surface still undefined.
- JEV's route is settled: `typesafe/jev-1.14` on the OpenRouter decisions endpoint, question set in
  `docs/JEV.md`. T-27 implements it; do not re-open the model choice.

## Found while working

(append discoveries that are out of scope instead of fixing them)

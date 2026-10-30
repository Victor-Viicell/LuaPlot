# LuaPlot — architecture

Decided once here so sessions do not re-litigate it. Changing a decision means editing this file
in the same commit.

## Stack (fixed)

| Layer | Choice | Note |
| --- | --- | --- |
| UI | Ripple `.tsrx` + `ripple` runtime | Already in the template. No React. |
| Build | Vite 8 + `tsrx-tsc` | `bun run build` = typecheck + bundle. |
| Shell | Tauri 2 (`src-tauri/`) | Desktop + Android/iOS wrapper. |
| Auth & data | Supabase (Postgres + RLS + Storage + Edge Functions) | Client SDK only in `lib/data/supabase.ts`. |
| LLM (chat turns) | DeepSeek `chat/completions` via Edge Function `chat` | Key server-side only. |
| LLM (JEV) | TypeSafe **Jev** `typesafe/jev-1.14` on `POST /api/alpha/decisions` | Calibrated judgments, not prose. Keys live in the `jev` Edge Function. Question set + thresholds: `docs/JEV.md`. |
| Hosting (preview) | GitHub Pages, `gh-pages` branch | `https://victor-viicell.github.io/LuaPlot/` |
| Billing | Stripe (later phase) | No spec exists yet — see open decisions. |

## Source layout

```
src/
  main.ts               mount
  App.tsrx              router outlet + shell
  styles.css            tokens + base (already exists)
  router.ts             route table + matcher + navigate()
  lib/
    data/               types.ts, repo.ts (interface), memory.ts, supabase.ts
    fixtures/           seed data shared by memory adapter and tests
    llm/                chat.ts, jev.ts, mock.ts
    native.ts           Tauri plugin bridge + browser fallback
    format.ts           relative time, ratio %, handles
  components/           Button.tsrx, Field.tsrx, Card.tsrx, Sheet.tsrx, Toast.tsrx,
                        Tabs.tsrx, EmptyState.tsrx, Skeleton.tsrx, Avatar.tsrx,
                        CommentThread.tsrx, ReportDialog.tsrx, NsfwToggle.tsrx, Icons.tsrx
  pages/                one file per route in src/specs/luaplot-pages.md
  state/                session.ts, prefs.ts (NSFW), toasts.ts
supabase/
  migrations/           SQL, ordered, idempotent
  functions/chat/       DeepSeek turn generation
  functions/jev/        moderation classifier
scripts/                check.sh, publish.sh, agent-lock.sh, deploy.py (Vercel fallback)
```

## Router

`src/router.ts` owns one table of `{ pattern, page, access }` built from the spec route index.
Matcher: fixed segments match before `[param]`, params are UUID-constrained, query string carries
filter/sort state. `base` comes from `import.meta.env.BASE_URL` so `/LuaPlot/` on Pages and `/` in
Tauri both work. No history rewriting beyond `pushState`; a `404.html` copy of `index.html` is
published so deep links resolve on Pages.

## Data

`lib/data/repo.ts` is the only surface pages call. Two implementations:

- `memory.ts` — seeded fixtures, synchronous-ish, used by the static preview and tests while
  Supabase is unprovisioned. This is what makes the preview URL worth opening every hour.
- `supabase.ts` — real client, RLS enforced, swapped in by `resolveRepo()` when
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist.

Every method returns typed results and never throws raw errors; failures come back as
`{ ok: false, error }` so pages can render the Error state.

## LLM boundary

The client never holds a key. `lib/llm/*` posts to `${SUPABASE_URL}/functions/v1/{chat|jev}`; when
that env is absent (preview build) it uses `mock.ts`, which returns deterministic, spec-shaped
responses. Mock output is labelled in the UI (`Preview mode` chip) so nobody mistakes it for a real
model turn.

## Native boundary

`lib/native.ts` exports async functions that dynamically `import()` Tauri plugins and fall back to
browser behaviour when `window.__TAURI_INTERNALS__` is missing: `haptic()`, `shareText()`,
`copy()`, `pickImage()`, `setBadge()`. Hardware features are added here, never called inline from a
page. Android/iOS builds must keep every web path working.

## Open decisions (do not silently resolve)

1. **Stripe / pricing** — the specs contain no payments. Decide the product surface (what is paid,
   at what price, what happens to existing accounts) before writing any Stripe code.
2. **Supabase project** — the connected Supabase token cannot list projects (403); a project ref +
   DB connection string is needed to run migrations. Until then the memory adapter is the truth.
3. **Tag taxonomy** — catalogs render no tags row until it exists.
4. **Moderation admin** — the operator grants admin by hand; there is no in-app grant.

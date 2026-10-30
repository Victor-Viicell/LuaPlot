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
    state/              session.ts, prefs.ts (NSFW) — plain subscribe/notify stores
    toast.ts            the toast queue, same store shape
  components/           Button.tsrx, Field.tsrx, Card.tsrx, Sheet.tsrx, Toast.tsrx,
                        Tabs.tsrx, EmptyState.tsrx, Skeleton.tsrx, Avatar.tsrx,
                        CommentThread.tsrx, ReportDialog.tsrx, NsfwToggle.tsrx, Icons.tsrx
  pages/                one file per route in src/specs/luaplot-pages.md
supabase/
  migrations/           SQL, ordered, idempotent
  functions/chat/       DeepSeek turn generation
  functions/jev/        moderation classifier
scripts/                check.sh, publish.sh, agent-lock.sh, deploy.py (Vercel fallback)
```

## Router

`src/router.ts` owns one table of `{ path, page, access }` built from the spec route index, with the
spec's own param spelling (`[character.id]`, `[user.username]`) so a diff against the spec is
mechanical. Matcher: fixed segments match before `[param]` (sorted by param count, then length);
ids are `[0-9a-f-]{36}`, usernames match the onboarding handle rule (`[A-Za-z0-9_]{3,24}`);
query string carries filter/sort state. `base` comes from `import.meta.env.BASE_URL` so `/LuaPlot/`
on Pages and `/` in Tauri both work (`href()` prefixes every in-app link). No history rewriting
beyond `pushState`; `publish.sh` copies `index.html` to `404.html` so deep links resolve on Pages.

State is a **plain subscribe/notify store** (`currentRoute()`, `onRouteChange()`, `useQuery()`),
not a tracked value: `track()` must be created inside a component in this Ripple version — a
module-scope tracked has no owning block and every write to it throws. `App.tsrx` mirrors the store
into its own `track()` and that is the signal renders read.

Pages live flat in `src/pages/` as `<type>-<view>.tsrx` (`character-catalog`, `lorebook-detail`,
`session-detail`, `moderation-queue`), each exporting a named component plus a default for the lazy
import. `src/components/PagePlaceholder.tsrx` is the scaffold every route renders until its ticket.

## Data

`lib/data/repo.ts` is the only surface pages call. Two implementations:

- `memory.ts` — seeded fixtures, synchronous-ish, used by the static preview and tests while
  Supabase is unprovisioned. This is what makes the preview URL worth opening every hour.
- `supabase.ts` — real client, RLS enforced, swapped in by `resolveRepo()` when
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist.

Shapes, decided in T-03 (change them here before changing them in the code):

- **Listings** take `{ query?, sort?, page }` and return `{ items, hasMore }` with a page size of
  24. `page` is 1-based and lives in component state; `query`/`sort` live in the query string.
- **Lookups** return the entity or `null`. A missing item is a *not-found state* the page renders,
  not an error — `getSession` returns `null` for "not a participant" too, because the spec gives
  that the same message.
- **Mutations** return the updated entity (`vote`, `toggleBookmark`), so a page never re-reads to
  show the new counts. One vote per viewer per item is the adapter's rule, not a page's.
- **No error envelope yet.** Every method is `async` from the first day, but nothing can fail in
  memory. The `{ ok: false, error }` shape arrives with `supabase.ts`, which is the first adapter
  that can actually fail — inventing it now would make every page pay for a transport it does not
  have. Whoever writes `supabase.ts` changes this line in the same commit.
- **Counts are derived** in the adapter, never authored in a fixture: `commentCount` and
  `replyCount` are recomputed from the thread on load, and `ratio` is a function (`ratioOf`), never
  a stored field.
- **Visibility** is the adapter's stand-in for RLS: a listing drops anything that is not public and
  not the viewer's own. A detail lookup still answers by id, because the owner and a moderator open
  exactly that page.
- **Preferences are per account, so they live here** (T-04): `getPreferences(handle)` and
  `savePreferences(handle, patch)` answer the NSFW pair, keyed by handle — never by device, which is
  what would let one account's Show flag follow another onto the same machine. An unknown handle
  answers both off (a new account's defaults). `savePreferences` returns the whole pair, so the
  caller never merges a partial into its own idea of the state. `lib/state/prefs.ts` is the only
  caller: it clears to off before reading, so a switch never renders the previous account's flags
  even for the microtask the adapter takes.

## Session

`lib/state/session.ts` is a plain subscribe/notify store holding `{ handle, displayName, isAdmin }`
— the client's whole idea of an account, deliberately without email, provider, or token, since
authentication is Supabase's and this shape never duplicates it. It is seeded **signed in** as
`you` (every fixture's owner, so the preview is worth opening) until T-30 wires real auth;
`signOut()` exists so the signed-out states pages must render are reachable, and it is exposed only
as a dev affordance (overflow menu, `/dev/state`). `access` on a route stays declarative: the
redirect matrix is T-30, and neither store redirects.

The memory adapter's `VIEWER` is still a constant. Wiring it to the session would make
`repo → memory → session → prefs → repo` a module cycle, and RLS-less memory data has no viewer to
protect — T-30 swaps both together.


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

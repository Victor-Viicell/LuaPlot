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
    schema.ts           every shape + its normalisation (Zod) — see Validation
    validate.ts         onboarding field readings over those schemas
    data/               types.ts (z.infer only), repo.ts (interface), memory.ts, supabase.ts
    fixtures/           seed data shared by memory adapter and tests
    llm/                chat.ts, jev.ts, jevPolicy.ts, mock.ts, provider.ts
    native.ts           Tauri plugin bridge + browser fallback
    viewport.ts         the on-screen keyboard → `--keyboard-inset` (one writer, installed by App)
    format.ts           percent() today; relativeTime when a card shows "2h"
    state/              session.ts, prefs.ts (NSFW) — plain subscribe/notify stores
    toast.ts            the toast queue, same store shape
  components/           Button.tsrx, Field.tsrx, Card.tsrx, CardGrid.tsrx, Sheet.tsrx,
                        Tabs.tsrx, EmptyState.tsrx, Skeleton.tsrx, Avatar.tsrx,
                        CommentThread.tsrx, ReportDialog.tsrx, NsfwToggle.tsrx, Icons.tsrx,
                        PostComposer.tsrx, CharacterForm.tsrx (create + edit, one form)
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

**Every in-app anchor is a push (T-46).** An `<a>` carries `href={href(path)}` — a real link, so
middle-click, back/forward, a crawler and a no-JS visit all work — **and** `onClick={follow(path)}`,
so a plain press is `pushState` and the running app survives it. A bare anchor is a *document load*:
the memory adapter re-seeds (half-written form state and the walk's own fixture writes vanish), the
shell repaints from scratch, and on Pages the reader sees a white flash. Three rules follow:

- **`follow()` takes the app path, never `href(path)`.** `navigate()` adds the base itself, so
  `follow(href(x))` doubles it (`/LuaPlot/LuaPlot/x`); the preview base `/` hides that completely and
  only the `--live` walk sees it.
- **A fragment link stays bare.** `follow()` drops the fragment, so `/terms#rule-2` (the contents
  list, `ReportDialog`'s *What this asserts*, `moderation-detail`'s rule links) keeps a real
  navigation and its in-page jump. A component that hands out a link (`EmptyState`) takes the
  **path** (`to=`), not a finished href, and owns the `href`+`follow` pair itself.
- **`scripts/link-check.mjs` enforces it** (gate section 7): any `<a>` whose href is dynamic or an
  internal path without `onClick=` fails the check, except one containing `#`, one with `target=`
  (a new tab is a document on purpose) and an external `http(s):` destination.

State is a **plain subscribe/notify store** (`currentRoute()`, `onRouteChange()`, `useQuery()`),
not a tracked value: `track()` must be created inside a component in this Ripple version — a
module-scope tracked has no owning block and every write to it throws. `App.tsrx` mirrors the store
into its own `track()` and that is the signal renders read.

**The router also owns the mounted key (T-66).** `getMountedKey()`/`setMountedKey()` hold the
`path + search` the shell has actually mounted; `App.tsrx`'s reload guard compares against it and
nothing else (`emit()` never touches it — a navigation must always reach the address bar). A page
that writes its own query calls **`commitQuery(search, mode)`**: `pushState`/`replaceState`, then
`state = readLocation()` and the mounted key moved to the new location, **without** `emit()`. Two
consequences, both spec'd, both walked (row 49):

- **No remount, so the caret survives.** This is why the settle does not go through `navigate()`: a
  remount hands the reader a fresh `<input>` with no focus, and a person who types four letters and
  pauses loses their place.
- **A press on the route you are already on still reloads.** The key moved, so `navigate` to that
  path is a different key — the address and the grid cannot disagree, and the narrowed view is
  shareable from the bar (T-66's bug: the key stayed on the pre-query location, the press was a
  silent no-op, the URL cleared and the grid kept the filter).

`commitQuery()` applies the query to `state.path` — the route the table already matched — so a page
cannot write onto a path it is not on. `scripts/history-check.mjs` (gate section 9) keeps every page
off `history` directly.

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
  `SortOrder` is `newest | oldest | ratio | name | discussed | liked` (T-13 added the last two): a
  sort is honoured only where the adapter's accessors carry the count, and **falls back to `newest`
  everywhere else**, so no listing has to know which orders are meaningful for it. `discussed` sorts
  on `commentCount`, `liked` on `likes`, both high first with `createdAt` as the tie-break — a feed of
  equal counts still reads as a feed.
- **Lookups** return the entity or `null`. A missing item is a *not-found state* the page renders,
  not an error — `getSession` returns `null` for "not a participant" too, because the spec gives
  that the same message.
- **Mutations** return the updated entity (`vote`, `toggleBookmark`), so a page never re-reads to
  show the new counts. One vote per viewer per item is the adapter's rule, not a page's.
- **No error envelope yet.** Every method is `async` from the first day, but nothing can fail in
  memory. The `{ ok: false, error }` shape arrives with `supabase.ts`, which is the first adapter
  that can actually fail — inventing it now would make every page pay for a transport it does not
  have. Whoever writes `supabase.ts` changes this line in the same commit.
- **Comment writes (T-11)** are `addComment(commentWriteSchema-shaped)` and `deleteComment(id)`. The
  write carries **no author** — the adapter writes the row for the signed-in account, the same way it
  owns one vote per viewer and one bookmark per item, so a page can never post as someone else. The
  adapter parses the write with `safeParse` before it stores, appends `crypto.randomUUID()` for the id,
  and **recomputes `replyCount` (the whole branch) and the item's `commentCount` after every write**;
  a delete by anyone but the author answers `null`, and a delete by the author returns the row as a
  `deleted` placeholder with its body gone and its branch intact.
- **Case writes (T-26B)** are `concludeReport`, `dismissReport` and `addCaseComment`, all
  `*Schema`-shaped and `safeParse`d at the adapter. A case carries a **flat `history`** of
  `caseEventSchema` rows (never a thread) and, once closed, a `caseDecisionSchema` record; the schema
  refines the pair, so a concluded case without its decision (or an open one with one) fails at
  parse. `concludeReport` applies the outcome the *target* allows — authored items go
  `public`/`private` (removal is refused: moderation never deletes authored content), a comment gets
  `status: "removed"` with its body gone and its replies intact, and a post gets
  `status: "removed"` with its whole thread deleted in cascade (T-28B, `removePost` — the same write
  JEV's immediate action makes, so the row stays, every listing drops it and `getPost` still answers
  it by id). It also writes the
  creator's moderation notification in the same step; the reporter is never written a row.
- **An immediate action's record (T-28)** is a `moderationNotice` row, not a case:
  `systems/jev.md` says a clear violation is applied at once **and opens no case**, while the owner must
  still see the reasons and the measure. So `addReport`'s immediate branch writes the creator's
  `moderation` notification (the inbox) **and** one `moderationNoticeSchema` row per measure (the
  record), and `repo.moderationNotice(kind, id)` answers the newest of that row and *the case that hid
  the item* as one shape — a dismissed case, or one concluded `public`, is no notice at all. The page
  asks once; the adapter owns which source answered. `requestRepublication(kind, id)` is the owner's
  one recovery: authored kinds only, the viewer must be the author (the adapter's check, because RLS
  will be the same check), the item must be private, and it runs `classify()` **at once** — `verified`
  + `isPublic` on a clean answer, `private` otherwise. `verified` never leaves the adapter.
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
- **The account's profile is the third per-account surface** (T-07): `currentProfile()` answers the
  signed-in account's saved `{ handle, displayName, isAdmin }` or `null` when onboarding has written
  nothing (the spec's *first visit*), `isHandleTaken(handle)` answers case-insensitively across
  accounts and **never** across the viewer's own current handle, and `saveProfile({ handle,
  displayName })` writes the whole form in one save and returns the saved account with the handle
  trimmed and lowercased. The adapter owns the handle rule for the same reason it owns one vote per
  viewer: the page that scans fixtures for a free handle has invented a second truth. `supabase.ts`
  must implement all three — the profile row is keyed by `auth.uid()`, uniqueness is a `citext`
  unique index, and `isHandleTaken` is advisory in front of it (the index is the guarantee).
  Onboarding calls `saveProfile` for its **draft** too, debounced, which is what makes the spec's
  *Resumed after abandonment* honest without `localStorage`.

## Validation

Zod is the **one** parser and the **one** normaliser (T-07B; `zod` 4.x, no `zod/v3` path and no
hand-rolled mini-validator anywhere). Read this before adding a shape, a form, or an LLM call.

- **`lib/schema.ts` owns every shape.** One `z.strictObject` per entity (an unknown key fails
  instead of being dropped), primitives for the rules that repeat (`isoSchema`, `handleSchema`,
  `displayNameSchema`, `avatarSchema`, `engagementSchema`), and the collection schemas
  (`seedSchemas`, `commentThreadSchema`) the adapter and the gate parse.
- **Types are `z.infer`.** `lib/data/types.ts` derives every entity (`export type Character =
  z.infer<typeof characterSchema>`), so a shape exists exactly once: never declare a hand type
  beside a schema. `z.infer` is the **output** type — what the app holds after a parse, handle
  already lowercased — so a value that came through `repo` is never re-normalised in a page.
- **`safeParse` at every edge**: form input (`lib/validate.ts` reads the `ZodError` issue code to
  say *required* or *format*), anything an adapter returns or accepts (`lib/data/memory.ts` parses
  each fixture collection at load and every write before it stores), and **every JEV/LLM payload
  before any code reads a field**. `parse` is only for an internal invariant — a bug, not a user.
- **Normalisation lives in the schema**: trim, lowercase a handle, collapse display-name whitespace,
  real ISO-8601 strings (`2026-13-01` fails, a length check would not). A saved row cannot differ
  from a validated one, because the same schema produced it.
- **Display formatting stays in `lib/format.ts`** (`percent`, `relativeTime`, handles) — Zod is
  shape and input, not presentation. `ratioOf()` derives the ratio; it is never stored.
- **Error copy comes from the schema** (`HANDLE_RULE` is the schema's message), so the inline error,
  the submit gate and the adapter cannot disagree.
- **A fixture that fails is fixed against the spec**, never by loosening the schema. A shape the
  specs forbid (a stored `ratio`, engagement on a persona, `updatedAt` on a post) does not exist in
  `schema.ts` at all.
- **The gate proves it**: `bun run schema:check` is section 5 of `scripts/check.sh` — every fixture
  collection parses, three negative cases (bad handle, missing `nsfw`, unknown key) must fail, and
  the recursive `commentBranchSchema` must be a real type, not `any`.
- **A third-party payload gets loose objects, a literal and a reader that returns `null`**
  (T-27, `jevPayloadSchema`): the provider adds fields we do not read, so the object is loose, but
  `provider` is `z.literal("TypeSafe")` because a chat fallback must fail the parse rather than
  answer, and every reader of an answer returns `undefined` when the field is missing — a missing
  answer becomes *unsure*, never a zero.

## Session

`lib/state/session.ts` is a plain subscribe/notify store holding `{ handle, displayName, isAdmin }`
— the client's whole idea of an account, deliberately without email, provider, or token, since
authentication is Supabase's and this shape never duplicates it. It is seeded **signed in** as
`you` (every fixture's owner, so the preview is worth opening) until T-30 wires real auth;
`signOut()` exists so the signed-out states pages must render are reachable, and it is exposed only
as a dev affordance (overflow menu, `/dev/state`). `setAccount({ handle, displayName })` (T-07) is
the mutator onboarding uses: the adapter holds the saved profile, and without this the claimed
display name would be replaced by `MOCK_USER.displayName` on every screen. It emits like `signIn`,
which is what re-reads the NSFW pair per handle. `access` on a route stays declarative: the
redirect matrix is T-30, and neither store redirects.

The memory adapter's `VIEWER` is still a constant. Wiring it to the session would make
`repo → memory → session → prefs → repo` a module cycle, and RLS-less memory data has no viewer to
protect — T-30 swaps both together.


## LLM boundary

The client never holds a key. `lib/llm/*` posts to `${SUPABASE_URL}/functions/v1/{chat|jev}`; when
that env is absent (preview build) it uses `mock.ts`, which returns deterministic, spec-shaped
responses. Mock output is labelled in the UI (`Preview mode` chip) so nobody mistakes it for a real
model turn.

## Viewport

`lib/viewport.ts` is the only writer of `--keyboard-inset`, the token a docked surface adds to its
`padding-bottom`. A phone keyboard shrinks `window.visualViewport`, never `window.innerHeight`, so the
inset is `innerHeight - vv.height - vv.offsetTop`, clamped to `0…400`, written once per animation
frame on `resize`/`scroll` **of the visual viewport** (a `window` resize never fires for a keyboard).
It is installed **once by the shell** (`App.tsrx`), because the token lives on `documentElement`: a
page that installed its own would be a second writer fighting over the last frame. No
`window.visualViewport` writes `0px` and stops — the CSS fallback is the same value, so an old
webview degrades honestly. Walk row 32 shadows `visualViewport.height` at 360×740 and reads the
composer's dock lifting by exactly the keyboard's height.

## Native boundary

`lib/native.ts` is the only place hardware is touched; a page never imports a Tauri module.

- **Capabilities** (T-34): `haptic(kind)`, `shareText(payload)`, `copy(text)`, `pickImage()`,
  `setBadge(count)`.
- **Every call answers `nativeResultSchema`** — `{ ok: true, value? } | { ok: false, reason }` with
  `reason` in `unsupported | cancelled | failed` — so a page renders *nothing happened* without a
  `try`, and a dismissed share sheet (`AbortError`) reads `cancelled`, never `failed`.
- **The ladder is plugin → web API → unsupported.** `isNative()` is a runtime read of
  `window.__TAURI_INTERNALS__`, never an `import.meta.env` flag (a build flag would make the Pages
  build pretend). All Tauri imports are dynamic and sit **inside** that branch, so Vite emits them
  as a separate chunk the browser never requests — measured on `/dev/native`: zero `core-*.js`
  requests, and `dist/assets/index-*.js` contains no `@tauri-apps` string.
- **Rung 1 is inert today**: `src-tauri` registers `opener` only, so the `plugin:haptics`,
  `plugin:badge`, `plugin:clipboard-manager` and `plugin:dialog` commands in `COMMANDS` are not
  compiled in. `invoke()` rejecting reads as *absent*, which is why the web road answers and the
  module could ship before the plugins exist. Installing one is `Cargo.toml` +
  `capabilities/default.json` + one string in `COMMANDS`; no caller changes.
- **The clipboard is a three-rung chain** (`plugin` → `navigator.clipboard` → hidden textarea +
  `execCommand`) because the middle rung needs a **user gesture in a secure context** — proven, not
  assumed: a synthetic click on `/dev/native` answers `unsupported`, a real one answers `ok`.
- **Nothing is wired to a control yet**: no spec asks for Share, the badge belongs to no page
  (`notifications.md` describes an unread *pill*), and T-31's uploader does not exist. `/dev/native`
  is the harness that exercises them; a ticket that adds a control calls the module.

## Open decisions (do not silently resolve)

1. **Stripe / pricing** — the specs contain no payments. Decide the product surface (what is paid,
   at what price, what happens to existing accounts) before writing any Stripe code.
2. **Supabase project** — the connected Supabase token cannot list projects (403); a project ref +
   DB connection string is needed to run migrations. Until then the memory adapter is the truth.
3. **Tag taxonomy** — catalogs render no tags row until it exists.
4. **Moderation admin** — the operator grants admin by hand; there is no in-app grant.

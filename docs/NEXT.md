# Baton — what the next session does

**Ticket: none is unblocked. The headless phase is finished.**

T-44 closed the last three pages a session on this box can exercise (`/dev/state`, `/dev/data`,
`/dev/primitives`) and the walk now measures a breakpoint: **27 rows**, 360×740 for the product
journeys and four emulated widths for the gallery. Every ticket still `[ ]` in `docs/SHIP-PLAN.md`
needs something this machine does not have — a Supabase project, a display and `cargo`, the Android
SDK, or a human palette decision. That register is below, and it is the whole of what is left.

## What a tick does when nothing is unblocked

1. **Prove the tree is still whole, then stop.** `./scripts/check.sh` must print `GREEN` and
   `bash scripts/smoke.sh --live` must print `27/27`. If either is red, *that* is the ticket: a
   failing row is the highest-value work available and needs no new ticket number. Fix it, publish,
   log it in `PROGRESS` as a repair entry, and say in the report which row was red.
2. **Do not invent product surface.** `src/specs/luaplot-pages.md` is the law; a spec that says
   *To be specified* stays unbuilt until a decision is recorded in `docs/DESIGN.md`.
3. **Do not resolve a blocker by faking it.** No offline Supabase stub pretending to be RLS, no
   `cargo`-less Tauri build claimed as verified, no hand-written palette "decision". `UNVERIFIED`
   in `PROGRESS` is the honest answer and has been used before.

If a human supplies one of the blockers mid-phase, the baton changes: take the first ticket the new
capability unblocks (T-29 before T-30/31/32; T-35 before T-36; T-33 once `cargo` + a display exist).

## Blocked — what a human must do

- **T-29/T-30/T-31/T-32 (Supabase):** create a project and export `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` (server key stays out of the client). Nothing about the data seam can move
  past the memory adapter until then. T-29's migration is the first thing to write after the ref
  lands — `docs/ARCHITECTURE.md` → *Data* lists every shape it must carry, including the relations
  the memory adapter derives (`commentCount`, `replyCount`, `ratio` as a function).
- **T-33 (Tauri desktop):** needs a display (`bun run tauri dev` opens a window) and `cargo`.
- **T-35/T-36/T-39 (Android):** install cmdline-tools + platform 35 + NDK, the four rust android
  targets, then `tauri android init`.
- **T-37B (palette):** a decision, not work — Latte's active tab label is 4.45:1 (`accent` on
  `bg-elevated`) and Latte has no darker mauve: pick a darker light-mode accent ramp or a lighter
  surface. `docs/DESIGN.md` → *Theme* records the three tokens T-37 already settled.

## Open decisions

- **`/dev/data`'s vote is order-dependent but not fragile.** The row votes on whatever the adapter's
  newest character is *at that moment* (earlier journeys re-save rows, so it is not always the same
  fixture), and it reads the name back from the log before comparing anything. Do not pin a
  character id here.
- **The breakpoint row owns a CDP override.** Anything added after it must assume the session is
  back at 360×740; the row asserts that it cleared (`window.innerWidth === restore`) rather than
  trusting the `finally`.
- **The shell still paints the previous page for one frame** before the outlet's `loading` skeleton
  (measured in T-40 at ~1 frame, ~13ms). Left alone; a later view transition must not make it
  visible.
- **A card's ratio rounds to whole percent**, so a one-vote change can leave the printed number
  identical (96% → 96%). Any future journey that proves an engagement write must read a count
  (the detail page's Likes/Dislikes cells), never a card's percentage.

## Found while working (carried forward — keep this list growing)

- **T-44 is done, and the walk is 27 rows.** New helpers worth reusing: `setToggle(label, want)` /
  `toggleState` (press a `button.toggle`, then **poll the rendered `aria-pressed`** — the store's
  emit is a microtask after the click), `storeCell(label)` (a `.count` cell by `.count-label`,
  compared **lowercased**), `coveredCards()` (`.card.is-covered` — the only DOM fact the Blur
  preference has), `measureAt(width)` (one `Emulation.setDeviceMetricsOverride` read) and the
  `BREAKPOINTS` table.
- **The card grid is 1 / 2 / 3 / 3, not 1 / 2 / 3 / 4.** `styles.css` stops at three columns at
  `lg` on purpose (the outlet is one A4 page wide, so a fourth column draws 163px cards);
  `docs/DESIGN.md` said "1 / 2 / 3 / 4" and was **stale** — corrected in T-44. The measured ladder
  live: `360:1col/field1/rail0/btn44/outlet340 · 640:2col/field2/rail0/btn44/outlet620 ·
  900:3col/field2/rail84/btn44/outlet794 · 1200:3col/field2/rail240/btn44/outlet794`, no
  document-level horizontal scroll at any width.
- **`.count-label` carries `text-transform: uppercase`**, and `innerText` returns the *rendered*
  text (`SHOW`, `LIKES`). A case-sensitive label match finds nothing and reads as a missing cell —
  the failure looks like a broken page, not a casing bug. `storeCell` lowercases both sides.
- **`Emulation.setDeviceMetricsOverride` is the only honest way to change width in this walk**, and
  a leak poisons every later row. `measureAt` is called inside `try`, the clear + 240ms settle is in
  `finally`, and the row re-asserts the restored `innerWidth`.
- **`/dev/state`'s NSFW pair is restored, not merely flipped.** The row records the seed pair on
  entry and drives it back, then proves the catalog drew 0 covers again — a journey that leaves
  Show+Blur on makes every later card-grid assertion read the wrong state.
- **The `--live` walk catches what the local one cannot.** T-41 lost three rows to an `^`-anchored
  path test; T-42 to a missing `/edit`. Suffix-match every path, and run
  `bash scripts/smoke.sh --live` before claiming any ticket. T-44's three new rows pass live under
  `/LuaPlot/` — the dev routes resolve.
- **A refusal row must carry the whole path.** T-42's first run failed all three rows because the
  `OTHER_*` constants omitted the trailing `/edit`: the routes answered the app's 404 and the
  failure reads like a copy bug.
- **A `<input type=file>` in headless Chromium hangs the press unless intercepted.** Enable
  `Page.setInterceptFileChooserDialog { enabled: true }` *before* the press, take `backendNodeId`
  from the event, and hand it a real file with `DOM.setFileInputFiles` — which fires `change`.
- **Do not pin an engine's answer.** `navigator.vibrate` answers truthy in this Chromium (155) and
  measured `false` in T-34: any row whose value comes from the browser asserts a **set** and says
  in its evidence which member it saw.
- **`document.title` on a non-root route is `<Title> — LuaPlot`** (`App.tsrx`), so the badge reads
  `(3) Native — LuaPlot`.
- **T-41 is done**: `/lorebook/…1/edit`, `/preset/…1/edit` and `/persona/…1/edit` all preload and
  save correctly. `retype()` (select-all + `Input.insertText`, read back) and `choose()` (native
  `<select>` by value + a real `change`, read back) are the helpers for a preloaded field; `type()`
  appends at wherever `focus()` left the caret.
- **T-40 is done**: the case page's *THE ITEM* chip reads the row, not the case; the edit-form half
  did not reproduce (`/character/[id]/edit` mounts `CharacterForm` only in its `ready` branch).
- **One stale frame on every route change** is the shell's: `navigate()` pushes and dispatches
  `popstate`, the route effect flips `status` to `loading` in the next batch, so a *synchronous*
  read right after `navigate()` still sees the old page. Do not "fix" it by clearing the page
  synchronously; the skeleton covers every painted frame.
- **T-34 is done**: `src/lib/native.ts` is the only module that touches hardware, and every call
  answers `nativeResultSchema`. `isNative()` reads `window.__TAURI_INTERNALS__` at runtime — never
  `import.meta.env`, which is baked at build time. A rejected `invoke()` is *absent*, not *failed*.
- **The Tauri chunk is `core-*.js` and no file in `dist` contains the literal `@tauri-apps`** — only
  the resource timing can prove it never loads (`noCoreChunk`).
- **A synthetic `.click()` cannot copy**: `navigator.clipboard.writeText` needs a trusted gesture.
- **T-38 is done**: `scripts/smoke.sh` builds + previews + walks + tears down; `--live` walks the
  Pages URL; `bun run smoke` is the alias. **It is not in `check.sh`** — the gate stays browser-free.
- **The report journey needs POST(8)**: the preview classifier buckets on `hash("jev:post:" + body) % 5`
  and only buckets 2/3/4 escalate; a report on a clean-pass post opens no case.
- **A shared Chromium profile makes the walk flake** — profiles are unique per run and removed on exit.
- **`go()` must resolve against the served base**; a leading slash drops the `/LuaPlot/` base.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS.
- **The light flavour still measures one failing pair**: Latte's active tab label is 4.45:1
  (`accent` on `bg-elevated`) and Latte has no darker mauve — T-37B needs a palette decision.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, four type pills,
  `overflow-x: auto`); the **document** does not scroll. The page-level rule holds, and the
  breakpoint row asserts `documentElement`, never a subtree that is allowed to overflow.
- **Tap targets**: 44px still fails for card-footer author links (inline text — WCAG 2.2 `2.5.8`
  exempts inline links) and avatar links at 36×36 (AA's 24×24 floor passes). A card redesign, not a
  padding tweak.
- **Bundle numbers**: `dist` 1.1 MB; JS 728 KB raw / ~187 KB gz; CSS 23.8 KB gz; largest asset the
  JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met. T-41…T-44 changed no app source,
  so the hash stayed `index-DpakDGV9.js`.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()` (status flipped, thread
  deleted in cascade), `livePost()` filters the lists, `getPost` still answers by id.
- **Counts now: characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12
  (11 listed, post 6 removed), reports 5 (3 open, 2 concluded), comments 22 (one removed placeholder),
  sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow edges 15.**
  The walk's own journeys add rows to this adapter as they run (a post, a comment, a lorebook entry,
  a report, a vote) — expect counts to move inside a session, and never assert a bare total.
  `/dev/data`'s *Characters* cell reads the **page** count (24 = `PAGE_SIZE`), not the fixture total.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

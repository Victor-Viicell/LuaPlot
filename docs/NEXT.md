# Baton — what the next session does

**Ticket: T-43 — `/dev/native` is the last page whose evidence is prose.**

Spec: none — `/dev/native` is a dev route, absent from `src/specs/luaplot-pages.md` (and
`scripts/spec-routes.mjs` drops `/dev/*` before comparing). The law it answers is
`docs/ARCHITECTURE.md` → *Native boundary*; the module is `src/lib/native.ts`; the page is
`src/pages/dev-native.tsrx`.

Why next: **every ticket left in `docs/SHIP-PLAN.md` is blocked on something this box does not have**
(T-33 needs a window + a `cargo` build, T-35/36/39 need the Android SDK, T-29…T-32 need a Supabase
project ref, T-37B needs a human palette decision). T-42 closed the refusal arm of the three authored
forms, so the walk now covers every product journey a headless session can reach. The one page left
is `/dev/native`: five capability buttons and a title badge, whose whole argument — *a browser gets a
fallback, a shell gets the plugin, a person never sees a thrown error* — has been asserted **by hand
in `docs/PROGRESS.md`** (T-34) and by no script. Its own page comment says why that is not enough: a
walk can press the buttons but a prose read cannot be re-run.

## Approach

1. **One journey per capability, not one journey for the page.** Five presses answer five different
   roads; if a single row proves all five, one broken road hides the other four. Suggested rows
   (each `go("/dev/native")`, then one press, then read the row the page prints for that capability):
   - **Vibrate** → `unsupported · this browser has no road` — headless Chromium *has*
     `navigator.vibrate` and it returns `false`, which the module reads as unsupported. Do not "fix"
     that into `failed`.
   - **Copy** → `ok · LuaPlot · the native bridge` — needs a **real** gesture (below).
   - **Share** → `ok · copied` — Chromium/Linux has no `navigator.share`, so the road falls through
     to `copy()`; the answer names the road it actually took.
   - **Pick** → `ok · <file name>` — a chooser must be intercepted and a real temp PNG handed to it
     (below).
   - **Badge 3** then **Clear badge** → `ok · (3) title` and `document.title === "(3) LuaPlot"`, then
     `ok · title cleared` and the title back to `LuaPlot`.
2. **Press with real mouse events.** `realClick()` already exists in `smoke.mjs` (T-41 uses it for a
   notification row). Use it here: per T-34's finding, a synthetic `.click()` gives
   `navigator.clipboard.writeText` an `unsupported` answer and only a real `Input.dispatchMouseEvent`
   at the button's centre gives `ok`. If the Copy row passes with `.click()`, the press was not the
   thing being proven.
3. **Assert the printed answer, not the button's label.** Each capability row prints
   `· last <b>{read}</b>` from `readOut(result)`, and the *Last answers* list repeats it newest-first.
   Read the `.cap` row for that capability (match `cap-name`), never the whole page's text — a page
   that logged the answer for the wrong capability would otherwise pass.
4. **Assert the chunk boundary in the same journeys.** `performance.getEntriesByType("resource")`
   must show **zero** `core-` requests after every press: `isNative()` is false in a browser, so
   `@tauri-apps/api/core` must never download. This is the one finding (T-34) that a `dist` grep
   cannot prove — the literal `@tauri-apps` appears in no built file, so grep would pass vacuously.
5. Row count and exit check move 19 → 24 (five capability journeys). Header comments in
   `smoke.mjs` / `smoke.sh` and the "19/19" in the newest `docs/PROGRESS.md` entry are not edited
   retroactively — the newest entry is the one that carries the live number.

## Traps

- **The file chooser hangs the page.** `pickImage()` builds a hidden `<input type=file>` and clicks
  it; in headless Chromium that opens a dialog nobody can close, so the press never settles and the
  row times out. Enable `Page.setInterceptFileChooserDialog {enabled: true}` **before** the press,
  listen for `Page.fileChooserOpened`, then set a real temp `.png` on that `backendNodeId` with
  `DOM.setFileInputFiles` — which fires `change`, so the page answers `ok · <basename>`. Write the
  PNG under the scratch dir (a byte-array PNG is enough; the module only reads `file.name`), and
  delete it on exit. Dismissing the chooser is the *cancel* road, not the success road — if you want
  both, that is a sixth journey and a new row count.
- A `.click()` on **Pick** also hangs, for the same reason — interception is about the chooser, not
  the gesture.
- **`/dev/native` must be reached with `go()`**, like every other route: `history.pushState` with a
  leading slash drops the `/LuaPlot/` base on Pages. The page is in the production route table
  (`src/router.ts`), so the live walk can open it.
- **The badge writes `document.title`**, and `setBadge` memoises the unbranded title in a module
  variable (`baseTitle`). Within one session the memo is correct; a row that presses Badge 3 twice
  would prove nothing about the second write. Press 3, read, Clear, read.
- **Do not reload between presses.** A reload re-seeds the memory adapter and re-runs `baseTitle`;
  everything after the first navigation is in-app.
- Keep `bun run smoke` and `./scripts/check.sh` green; the gate stays browser-free.
- **Run `--live` before claiming the walk.** Local 24/24 says nothing about Pages (T-41's lesson).

## Open decisions

- **One row per capability or one row for the page.** Five rows is the shape recommended above; the
  alternative is one journey that presses all five in order and asserts five answers. Pick the five:
  a single row cannot say *which* road broke, and the pick row is slow enough that bundling it hides
  the other four's timings.
- **`/dev/primitives`, `/dev/data`, `/dev/state` are still unwalked** too. They are lower value —
  no capability behind them — but if T-43 lands early, `/dev/state` is the cheapest honest check that
  the skeleton states still render.
- The shell still paints the previous page for one frame before the outlet's `loading` skeleton
  (measured in T-40 at ~1 frame, ~13ms). It is imperceptible and left alone; if a later ticket ever
  adds a view transition it must not make that frame visible.

## Found while working (carried forward — keep this list growing)

- **T-42 is done**: the three authored edit routes' refusal arms are walked — `/character/…0003/edit`
  and friends read `… isn't yours to edit.`, a dead id in the **same bucket** reads the form's own
  `… doesn't exist.`, and each refusal's `Back to catalog` resolves under the served base
  (`/LuaPlot/character/catalog` live). The walk is **19 rows**: three journeys of two hops, one per
  type, not six journeys — each hop is a fresh mount, so the second assertion is independent evidence
  and a row per hop would only lengthen the table. The new `refusal(message, catalogPath)` helper
  asserts three facts per hop (sentence, **no `<form>` mounted**, road out under the base); it is
  the shape any future refusal row should reuse.
- **A refusal row must carry the whole path.** The first run failed all three rows because the
  `OTHER_*` constants omitted the trailing `/edit`: the routes answered the app's 404, which is the
  bucket trap wearing the other hat — a path that is *almost* right proves nothing and the failure
  reads like a copy bug. `refusal()`'s error names the sentence it waited for and the path it was on,
  which is what made it a one-line fix.
- **T-41 is done**: `/lorebook/…1/edit`, `/preset/…1/edit` and `/persona/…1/edit` all preload and
  save correctly — **no defect reproduced**, so the ticket bought regression coverage, not a fix.
  The walk added a fifth entry block whose body the detail page prints, a preset
  `deepseek-chat → deepseek-reasoner` change that leaves the description intact, and a persona
  tagline that reaches the detail page *and* the collection card. Two helpers did the heavy lifting:
  `retype()` (select-all + `Input.insertText`, value read back and compared) and `choose()` (native
  `<select>` by value + a real `change`, read back) — use them rather than `type()` for any field
  that arrives preloaded, because `type()` appends at wherever `focus()` left the caret.
- **The `--live` walk caught what the local one could not**: T-41's steps asserted
  `^/lorebook/…` on `location.pathname` — true in preview, false on Pages, where the path is
  `/LuaPlot/lorebook/…`. Local 16/16, live 13/16, same bundle. The first `--live` run of any new
  step is not optional; suffix-match every path.
- **Pages' cold bundle costs ~2.4s more per save step** than the preview (persona 1273ms live vs
  1156ms local, preset 658 vs 542). The 8000ms waits are already enough; do not tighten them.
- **T-40 is done**: the case page's *THE ITEM* chip reads the row, not the case —
  `post.status` → `Visible` / `Removed`, plus `Removed — its whole comment thread went with it.`
  The edit-form half of that ticket did **not** reproduce: `/character/[id]/edit` mounts
  `CharacterForm` only in its `ready` branch. Both halves are walk steps now.
- **One stale frame on every route change** is the shell's, not a page's: `navigate()` pushes and
  dispatches `popstate`, but the route effect flips `status` to `loading` in the next batch, so a
  *synchronous* read right after `navigate()` still sees the old page. Measured frame by frame in
  T-40: t=1ms old value, t=2ms no input, t=13ms the new page. Do not "fix" this by clearing the
  page synchronously — the skeleton already covers every painted frame.
- **T-34 is done**: `src/lib/native.ts` is the only module that touches hardware, and every call
  answers `nativeResultSchema` (`{ok,value?}` / `{ok:false,reason}`). `isNative()` reads
  `window.__TAURI_INTERNALS__` at runtime — never `import.meta.env`, which is baked at build time
  and would make the Pages build pretend. `/dev/native` prints the parsed answer per press.
- **A rejected `invoke()` is *absent*, not *failed***: `src-tauri` registers only `opener`, so the
  `COMMANDS` table in `native.ts` names plugins this build does not compile in, the call rejects,
  and the web road runs. That is what let the module ship before the plugins. Installing one =
  `Cargo.toml` + `capabilities/default.json` + one string in `COMMANDS`.
- **The Tauri chunk is named `core-*.js`, and no file in `dist` contains the literal
  `@tauri-apps`** — a grep for the package name would "pass" even if the chunk were static. Assert
  on the chunk: it must be referenced only by a dynamic `import()` from the dev-native chunk, and
  `performance.getEntriesByType("resource")` must show zero `core-` requests after pressing every
  button.
- **A synthetic `.click()` cannot copy.** `navigator.clipboard.writeText` and
  `document.execCommand("copy")` both need a trusted gesture: through `Runtime.evaluate` the answer
  is `unsupported`, through `Input.dispatchMouseEvent` at the button's centre it is `ok`. Any
  future clipboard step in the walk must click for real.
- **`navigator.vibrate` exists in headless Chromium and returns `false`** — presence is not a road.
  `haptic()` answers `unsupported` there, which is correct; do not "fix" it into `failed`.
- **`<input type=file>` fires `cancel`** in current Chrome when the chooser is dismissed, so
  `pickImage()` settles without the window-focus probe; the probe stays for older engines.
- **A dev page that invents its own chrome stops being evidence**: `/dev/native` uses the
  `/dev/state` shape (kicker, 26px title, lede, badge row, 1px-gap rows, no page padding of its
  own). `--color-success` and `--color-warning` exist as tokens; do not reach for a hex.
- **T-38 is done**: `scripts/smoke.mjs` walks the primary journeys in one session at 360×740 and
  asserts on the DOM at every step (badge label, `aria-pressed`, a card leaving the grid, a case
  count 3 → 4 open, *Concluded · removed*, the item panel's own removal line).
  `scripts/smoke.sh` builds + previews + walks + tears down; `--live` walks the Pages URL;
  `bun run smoke` is the alias. **It is not in `check.sh`** — the gate stays browser-free, and a
  machine without Chromium must not fail a commit.
- **The report journey needs POST(8)**, not any post: the preview classifier buckets on
  `hash("jev:post:" + body) % 5`, and only buckets 2/3/4 escalate (unsure → a case). A report on a
  clean-pass post verifies the item and opens **no** case, so the journey would prove nothing.
- **A shared Chromium profile makes the walk flake** — profiles are unique per run (`tmpdir` + pid +
  clock, removed on exit); keep it that way.
- **`go()` must resolve against the served base.** `history.pushState("/bookmarks")` drops a
  `/LuaPlot/` base; the smoke resolves relative to `--url` so one script walks preview and Pages.
- **`?admin=1` survives an in-app hop but not a reload** — the queue's own filter links rewrite it.
- **The light flavour still measures one failing pair**: Latte's active tab label is 4.45:1
  (`accent` on `bg-elevated`) and Latte has no darker mauve — T-37B needs a palette decision.
- **T-37 is done**: `--color-text-subtle` equals `--color-text-muted`, muted steps to `subtext-1` on
  Frappé and Latte, `--color-accent-contrast` is `--ctp-base`, `--color-avatar-text` is the one new
  named token. Every value is a Catppuccin ramp step; a hex in a page is still a bug.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, four type pills, `overflow-x:
  auto`): two pills sit past the 360 viewport by design while the **document** does not scroll. The
  page-level rule holds; not a bug.
- **Tap targets**: 44px still fails for card-footer author links (inline text — WCAG 2.2 `2.5.8`
  exempts inline links) and avatar links at 36×36 (AA's 24×24 floor passes). A card redesign, not a
  padding tweak.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS.
- **T-37 bundle numbers**: `dist` 1.1 MB; JS 728 KB raw / ~187 KB gz; CSS 23.8 KB gz; largest asset
  the JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met. T-34 adds a `core-*.js` chunk
  that only a shell loads. T-41/T-42 changed no app source, so the hash stayed `index-DpakDGV9.js`.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()` (status flipped, thread
  deleted in cascade, vote dropped, row kept), `livePost()` filters `listPosts`/`profilePosts`,
  `getPost` still answers by id, `/post/[id]` draws *Removed by JEV* plus one finality line.
- **A post's removal keeps no placeholder** — the comment rule has nothing to hang on, so
  `removePost` deletes the comments (spec: *Privacy and republication*).
- **An immediate JEV action files no report row** (T-27/T-28); **`assets: []` is deliberate** — an
  image-only report escalates (`imageOnly`) instead of asking a text model to judge a picture.
- **A new case needs `history: []`** — build cases through `reportSchema.parse`.
- **`event` is a DOM global**: name history helpers `historyEvent`.
- **`@for` needs `const`**: `@for (const row of rows; key row.id)`; **an `@if` branch renders one
  node** — wrap header+body in `<>…</>`; **`effect()` is the only lifecycle hook**; **`{<Component />}`
  inside a fragment is a parse error**; a `<style>` block inside the root element scopes its rules
  to a class the root never gets — put it beside the root, in a fragment.
- **A gate named for the positive is a bug waiting**: `disabled={!canRequest.value}` is the shape
  that works with `Button`.
- **Counts now: characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12
  (11 listed, post 6 removed), reports 5 (3 open, 2 concluded), comments 22 (one removed placeholder),
  sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow edges 15.**

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

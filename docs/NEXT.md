# Baton — what the next session does

**Ticket: T-42 — the refusal states have never been walked.**

Spec: `src/specs/pages/character/edit.md`, `lorebook/edit.md`, `preset/edit.md` → *States*
(`Not the owner` → forbidden, `Not found` → that form's own sentence); `docs/CONTRACT.md` →
*Engineering law* (every async surface renders Loading / Empty / Error / Success);
`src/specs/luaplot-pages.md` (personas are personal: no "not yours" state exists for them).

Why next: **T-41 opened the last form nobody had opened.** Every ticket left in `docs/SHIP-PLAN.md`
is blocked on something this box does not have:

- **T-33** (`bun run tauri dev`) needs a window and a first `cargo` build of the shell.
- **T-35 / T-36 / T-39** need the Android SDK + NDK + rust android targets, none installed.
- **T-29…T-32** need a Supabase project ref; the connected token still cannot list projects (403).
- **T-37B** needs a human palette decision (Latte has no darker mauve), not a hex.

So the next provable work is again coverage. The walk now opens the `ready` arm of all four authored
edit forms and has still never rendered a single **refusal**: `character-edit.tsrx`,
`lorebook-edit.tsrx` and `preset-edit.tsrx` each declare `missing | forbidden`, and those two
sentences are the only thing a reader ever sees when a link goes wrong. They are four lines of copy
and four `EmptyState` actions that no session has ever read.

## Approach

1. **Four rows, appended after the persona step**, one hop and one sentence each:
   - `/character/<a character ada or bram owns>/edit` → `This character isn't yours to edit.`
   - `/lorebook/10eb00c5-0000-4000-8000-000000000002/edit` (*Ashmarket Gazetteer*, `ada`) →
     `This lorebook isn't yours to edit.`
   - `/preset/9e5e7000-0000-4000-8000-000000000002/edit` (*Long Table*, `ada`) →
     `This preset isn't yours to edit.`
   - dead ids in the right buckets → each page's **own** sentence (`This character doesn't exist.`,
     `This lorebook doesn't exist.`, `This preset doesn't exist.`). Read them off the pages first.
2. **Assert the road out, not only the sentence.** Every refusal is an `EmptyState` with an action
   (`Back to catalog`, `Back to personas`): a refusal that offers no destination is a dead end, and
   asserting only the copy would let that break silently. Check the action's `href` resolves under
   the served base.
3. **Personas are not part of this ticket.** T-41 already walks a persona's `missing` sentence; a
   persona has no `forbidden` arm because it is never addressed across accounts. Do not add a
   persona row that pretends otherwise.
4. Row count and exit check move 16 → 19 (three forbidden + three missing in three journeys, one per
   type) or 22 if you spend a row per hop — pick one and say which in the walk's comment. The header
   comments in `smoke.mjs` / `smoke.sh`, the exit check and every "16/16" in `docs/` move with it.

## Traps

- **Buckets**: characters `c0a1b2c3…`, lorebooks `10eb00c5…`, presets `9e5e7000…`, personas
  `9e45014a…`. An id in the *wrong* bucket lands on the app's 404, not the form's own sentence, and
  the step would prove nothing while passing.
- **A refusal page renders no `<form>`**, so `formName()` answers `""` and `retype()` throws. Assert
  the sentence and the action link; never a field.
- **Path assertions must be base-agnostic** — `/\/preset\/[0-9a-f-]{36}$/`, never `^\/`. T-41 lost
  three rows to exactly this on its first `--live` run: preview serves `/`, Pages serves `/LuaPlot/`.
- **Run `--live` before claiming the walk.** Local 16/16 said nothing about Pages.
- **A row owned by someone else must actually exist**: row 1 of every authored fixture is `you`, so
  the forbidden arm has to name row 2 (lorebook, preset) or a character whose `author` is `ada` /
  `bram` — read `src/lib/fixtures/characters.ts` rather than guessing.
- **The signed-out arm of these pages is `forbidden` too** (`handle === ""`): a journey that signs out
  first would walk that branch instead. Keep the refusal rows before the sign-out journey.
- Keep `bun run smoke` and `./scripts/check.sh` green; the gate stays browser-free.

## Open decisions

- **One row per type or one row per hop.** Three journeys of two hops (19) is the same evidence as
  six journeys (22) with less wall-clock; the walk's comment should say which and why.
- **`/dev/native` is still unwalked.** Its presses are asserted by hand in `PROGRESS` (T-34), not by
  a script. If the refusal work lands early, that page is the next cheapest proof — it needs real
  `Input.dispatchMouseEvent` for the clipboard, per the finding below.
- The shell still paints the previous page for one frame before the outlet's `loading` skeleton
  (measured in T-40 at ~1 frame, ~13ms). It is imperceptible and left alone; if a later ticket ever
  adds a view transition it must not make that frame visible.

## Found while working (carried forward — keep this list growing)

- **T-41 is done**: `/lorebook/…1/edit`, `/preset/…1/edit` and `/persona/…1/edit` all preload and
  save correctly — **no defect reproduced**, so the ticket bought regression coverage, not a fix.
  The walk is **16 rows**: a fifth entry block whose body the detail page prints, a preset
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
- **The walk is 16 rows** and its exit check is `rows.length === 16`; a new step must move that
  number, both header comments and the "16/16" in `docs/PROGRESS.md`'s newest entry in the same
  commit.
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
  that only a shell loads.
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

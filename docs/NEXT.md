# Baton — what the next session does

**Ticket: T-44 — the three remaining dev pages, and the first breakpoint the walk has ever measured.**

Spec: none — `/dev/state`, `/dev/data`, `/dev/primitives` are dev routes, absent from
`src/specs/luaplot-pages.md` (`scripts/spec-routes.mjs` drops `/dev/*` before comparing). The law
they answer is `docs/ARCHITECTURE.md` → *State* / *Data* / the primitive components, plus
`docs/DESIGN.md` for the breakpoint ladder.

Why next: **every product ticket left is blocked on something this box does not have** (T-29…T-32 a
Supabase project ref, T-33 a window + `cargo`, T-35/36/39 the Android SDK, T-37B a human palette
decision — the register is at the bottom of this file). T-43 closed `/dev/native`, which was the one
dev page with a capability behind it. The three left are the last pages a headless session can
exercise, and one of them is worth more than its size: `/dev/primitives` renders every primitive at
four widths, and **no row of the walk has ever measured a breakpoint** — the 24 rows all run at
360×740. The contract says desktop responsive is mandatory; nothing has ever checked it.

## Approach

1. **`/dev/state` first, and its two stores are the assertion.** The page prints the session store
   and the NSFW preference. The journey: `go("/dev/state")`, read the session row (signed in as
   `You`), flip the NSFW pair through the page's own control, read the preference row back, then
   `go("/bookmarks")` (or any card grid) and confirm the *same* preference is what the catalog
   behaves on — the store is module-scope, so a page that re-read it into local state would drift.
   Restore the preference before the journey ends: the rows after it assert cards.
2. **`/dev/data` is a mutation seam, so prove one round trip.** The page lists Characters and offers
   a mutation. Press it, read the row the page prints for the new count, then open
   `/character/catalog` and find the same change (or the same absence) there — a dev page that
   writes to its own copy of the adapter is the defect this row exists for.
3. **`/dev/primitives` is the breakpoint row, and it needs `Emulation.setDeviceMetricsOverride`.**
   The existing walk is pinned to 360×740 in one session and must stay that way: use
   `Emulation.setDeviceMetricsOverride { width, height, deviceScaleFactor: 1, mobile: false }` to
   read each width, then **reset it** (`Emulation.clearDeviceMetricsOverride`) before the next
   journey. Assert, at 360 / 640 / 900 / 1200: `document.documentElement.scrollWidth <=
   innerWidth` (no horizontal scroll), the Button row's height ≥ 44 at 360, the card grid's column
   count rising at `sm`/`md`/`lg` (read `getComputedStyle(grid).gridTemplateColumns` and count the
   tracks), and that `/dev/primitives` at 1200 is **not** the 360 layout stretched (the `.cap`-style
   row in `/dev/native` at ≥900 already proves one such reflow — do not duplicate it).
4. Row count and exit check 24 → 27 (one journey per page), header comments in `smoke.mjs` /
   `smoke.sh`. The constant to change is the literal `24` in the final `process.exit(...)`.

## Traps

- **A metrics override leaks.** If a journey throws after `setDeviceMetricsOverride` and before the
  reset, every later row runs at the wrong width and the failures look like layout bugs. Wrap the
  reads in `try/finally` and clear the override in the `finally`.
- **`--live` again.** T-41 lost three rows to an `^`-anchored path test; T-42 to a missing `/edit`.
  Suffix-match every path, and run `bash scripts/smoke.sh --live` before claiming the ticket: the
  Pages bundle is lazy-loaded per route, so a dev route that resolves locally can still 404 live
  (`go()` pushes state, so a 404 would surface as a *missing route*, not a network error).
- **Do not pin an engine's answer.** T-43's haptic row had to accept two legal verdicts because
  this Chromium's `navigator.vibrate` changed from `false` to truthy between T-34 and T-43. Any row
  whose value comes from the browser (not the app) asserts a **set**, and says in its evidence which
  member it saw.
- **`/dev/primitives` may already scroll at 360 on purpose** — it is a gallery. Assert on the
  *document* (`scrollWidth` of `documentElement`), never on a subtree that is allowed to overflow,
  and if a primitive genuinely overflows at 360 that is a finding: record it, do not add a fix in
  this ticket.
- Keep `bun run smoke` and `./scripts/check.sh` green; the gate stays browser-free.

## Open decisions

- **One row per page or one row for all three.** Three rows is the shape recommended above; the
  breakpoint row is the slow one (four widths × four assertions) and bundling it with the other two
  hides its timing, which is the number a future session wants when Pages' cold bundle makes it
  slow.
- **`/dev/data`'s mutation is not idempotent**: it appends a row to the memory adapter, and the walk
  shares one session, so a later row that counts characters would see it. Either assert a *delta*
  (count before → count after) or pick a mutation that toggles.
- The shell still paints the previous page for one frame before the outlet's `loading` skeleton
  (measured in T-40 at ~1 frame, ~13ms). Left alone; a later view transition must not make it
  visible.

## Blocked — what a human must do (T-44 is the last headless ticket)

- **T-29/T-30/T-31/T-32 (Supabase):** create a project and export `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` (server key stays out of the client). Nothing about the data seam can move
  past the memory adapter until then.
- **T-33 (Tauri desktop):** needs a display (`bun run tauri dev` opens a window) and `cargo`.
- **T-35/T-36/T-39 (Android):** install cmdline-tools + platform 35 + NDK, the four rust android
  targets, then `tauri android init`.
- **T-37B (palette):** a decision, not work — Latte's active tab label is 4.45:1 (`accent` on
  `bg-elevated`) and Latte has no darker mauve: pick a darker light-mode accent ramp or a lighter
  surface.

## Found while working (carried forward — keep this list growing)

- **T-43 is done**: `/dev/native`'s five presses are walked and the walk is **24 rows**. New
  helpers worth reusing: `pressCap(name)` (press by the row's `.cap-name`, never by index),
  `expectCap` / `expectCapOneOf` (poll for the **value**, not for "an answer" — the badge row is
  pressed twice in one journey), `noCoreChunk(label)` (zero `core-*.js` resource entries; a `dist`
  grep passes vacuously), `waitEvent(method)` (a **buffered** CDP event queue: `Page.fileChooserOpened`
  can land before the wait starts), and `mouseClickAt(box)` extracted from `realClick`.
- **A `<input type=file>` in headless Chromium hangs the press unless intercepted.** Enable
  `Page.setInterceptFileChooserDialog { enabled: true }` *before* the press, take `backendNodeId`
  from the event, and hand it a real file with `DOM.setFileInputFiles` — which fires `change`.
  Dismissing the chooser is the *cancel* road and would be a separate row.
- **`navigator.vibrate` answers truthy in Chromium 155** (T-34 measured `false`): presence *and*
  the return value are both engine facts. `haptic` prints `ok · medium` here; the row asserts either
  legal verdict, never `failed · a road existed and broke`.
- **`document.title` on a non-root route is `<Title> — LuaPlot`** (`App.tsrx`), so the badge reads
  `(3) Native — LuaPlot`. Derive the expected title from the page's own pre-press title; the
  literal `(3) LuaPlot` in the T-43 brief was wrong.
- **T-42 is done**: the three authored edit routes' refusal arms are walked — `/character/…0003/edit`
  and friends read `… isn't yours to edit.`, a dead id in the **same bucket** reads the form's own
  `… doesn't exist.`, and each refusal's `Back to catalog` resolves under the served base
  (`/LuaPlot/character/catalog` live). The three journeys are **two hops each**, not six rows — each
  hop is a fresh mount, so the second assertion is independent evidence. The `refusal(message,
  catalogPath)` helper asserts three facts per hop (sentence, **no `<form>` mounted**, road out
  under the base); reuse that shape for any future refusal row.
- **A refusal row must carry the whole path.** T-42's first run failed all three rows because the
  `OTHER_*` constants omitted the trailing `/edit`: the routes answered the app's 404, which is the
  bucket trap wearing the other hat — a path that is *almost* right proves nothing and the failure
  reads like a copy bug.
- **T-41 is done**: `/lorebook/…1/edit`, `/preset/…1/edit` and `/persona/…1/edit` all preload and
  save correctly — **no defect reproduced**. `retype()` (select-all + `Input.insertText`, read back)
  and `choose()` (native `<select>` by value + a real `change`, read back) are the helpers to use for
  a preloaded field; `type()` appends at wherever `focus()` left the caret.
- **The `--live` walk catches what the local one cannot**: T-41's steps asserted `^/lorebook/…` on
  `location.pathname` — true in preview, false on Pages, where the path is `/LuaPlot/lorebook/…`.
  The first `--live` run of any new step is not optional.
- **Pages' cold bundle costs ~2.4s more per save step** than the preview (persona 1273ms live vs
  1156ms local). The 8000ms waits are already enough; do not tighten them.
- **T-40 is done**: the case page's *THE ITEM* chip reads the row, not the case; the edit-form half
  did not reproduce (`/character/[id]/edit` mounts `CharacterForm` only in its `ready` branch).
- **One stale frame on every route change** is the shell's, not a page's — `navigate()` pushes and
  dispatches `popstate`, the route effect flips `status` to `loading` in the next batch, so a
  *synchronous* read right after `navigate()` still sees the old page (t=1ms old, t=13ms new). Do not
  "fix" this by clearing the page synchronously; the skeleton already covers every painted frame.
- **T-34 is done**: `src/lib/native.ts` is the only module that touches hardware, and every call
  answers `nativeResultSchema`. `isNative()` reads `window.__TAURI_INTERNALS__` at runtime — never
  `import.meta.env`, which is baked at build time.
- **A rejected `invoke()` is *absent*, not *failed***: `src-tauri` registers only `opener`, so the
  `COMMANDS` table names plugins this build does not compile in and the web road runs.
- **The Tauri chunk is `core-*.js` and no file in `dist` contains the literal `@tauri-apps`** — only
  the resource timing can prove it never loads.
- **A synthetic `.click()` cannot copy.** `navigator.clipboard.writeText` and
  `document.execCommand("copy")` need a trusted gesture: through `Runtime.evaluate` the answer is
  `unsupported`, through `Input.dispatchMouseEvent` at the button's centre it is `ok`.
- **`<input type=file>` fires `cancel`** in current Chrome when the chooser is dismissed, so
  `pickImage()` settles without the window-focus probe; the probe stays for older engines.
- **T-38 is done**: `scripts/smoke.sh` builds + previews + walks + tears down; `--live` walks the
  Pages URL; `bun run smoke` is the alias. **It is not in `check.sh`** — the gate stays browser-free.
- **The report journey needs POST(8)**: the preview classifier buckets on `hash("jev:post:" + body) % 5`
  and only buckets 2/3/4 escalate; a report on a clean-pass post opens no case.
- **A shared Chromium profile makes the walk flake** — profiles are unique per run and removed on exit.
- **`go()` must resolve against the served base**; a leading slash drops the `/LuaPlot/` base.
- **`?admin=1` survives an in-app hop but not a reload.**
- **The light flavour still measures one failing pair**: Latte's active tab label is 4.45:1
  (`accent` on `bg-elevated`) and Latte has no darker mauve — T-37B needs a palette decision.
- **T-37 is done**: `--color-text-subtle` equals `--color-text-muted`, `--color-accent-contrast` is
  `--ctp-base`, `--color-avatar-text` is the one new named token. A hex in a page is still a bug.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, four type pills,
  `overflow-x: auto`); the **document** does not scroll. The page-level rule holds.
- **Tap targets**: 44px still fails for card-footer author links (inline text — WCAG 2.2 `2.5.8`
  exempts inline links) and avatar links at 36×36 (AA's 24×24 floor passes). A card redesign, not a
  padding tweak.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS.
- **Bundle numbers**: `dist` 1.1 MB; JS 728 KB raw / ~187 KB gz; CSS 23.8 KB gz; largest asset the
  JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met. T-41/T-42/T-43 changed no app
  source, so the hash stayed `index-DpakDGV9.js`.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()` (status flipped, thread
  deleted in cascade), `livePost()` filters the lists, `getPost` still answers by id.
- **A post's removal keeps no placeholder** — `removePost` deletes the comments (spec: *Privacy and
  republication*).
- **An immediate JEV action files no report row**; **`assets: []` is deliberate** — an image-only
  report escalates instead of asking a text model to judge a picture.
- **A new case needs `history: []`** — build cases through `reportSchema.parse`.
- **`event` is a DOM global**: name history helpers `historyEvent`.
- **`@for` needs `const`**: `@for (const row of rows; key row.id)`; **an `@if` branch renders one
  node** — wrap header+body in `<>…</>`; **`effect()` is the only lifecycle hook**; **`{<Component />}`
  inside a fragment is a parse error**; a `<style>` block inside the root element scopes its rules to
  a class the root never gets — put it beside the root, in a fragment.
- **A gate named for the positive is a bug waiting**: `disabled={!canRequest.value}` is the shape
  that works with `Button`.
- **Counts now: characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12
  (11 listed, post 6 removed), reports 5 (3 open, 2 concluded), comments 22 (one removed placeholder),
  sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow edges 15.**
  The walk's own journeys add rows to this adapter as they run (a post, a comment, a lorebook entry,
  a report) — expect counts to move inside a session, and never assert a bare total.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

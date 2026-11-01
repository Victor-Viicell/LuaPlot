# Baton — what the next session does

**Ticket: T-40 — two stale renders the walk cannot see (the edit form and the case item panel).**

Spec: `src/specs/pages/character/edit.md` (the form is pre-filled from the row the URL names);
`src/specs/pages/moderation/detail.md` (*THE ITEM* panel shows the reported item and, once a case is
closed, what happened to it); `docs/CONTRACT.md` → *Engineering law* (an async surface renders
Loading / Empty / Error / Success; no spurious re-fetch).

Why next: **T-34 closed P5's only provable ticket** — `lib/native.ts` ships with a typed result on
every call, the plugin rung inert, and the browser chunk proven unrequested. What is left in the
plan is blocked on things this box does not have, in this order:

- **T-33** (`bun run tauri dev` opens the app) needs a window and a first `cargo` build of the shell;
  it cannot be *verified* from a headless session, and its `Ctrl/Cmd+K` half names a control no spec
  describes. Do not implement a command palette to fill the ticket.
- **T-35 / T-36 / T-39** need the Android SDK + NDK + rust android targets, none installed.
- **T-29…T-32** need a Supabase project ref; the connected token still cannot list projects (403).
- **T-37B** needs a human palette decision (Latte has no darker mauve), not a hex.

So the next provable work is the two defects already sitting in *Found while working*. Both are
small, both are visible in a browser this session can drive, and both are the kind of thing a
release should not carry: a form that shows the wrong row, and a panel that lies after an action.

## Approach

1. **Reproduce first, in the walk's own terms.** `scripts/smoke.mjs` is the harness; add a step per
   defect rather than a one-off probe, so the fix stays proven:
   - edit form: navigate to `/character/<id>/edit`, read every input **twice** — once immediately
     after the route resolves, once after ~1.5s — and assert both readings equal the fixture's
     name. The reported failure is a *first* read that sees the previously opened character's name.
   - case panel: open an open case, *Conclude* it (the walk already does: `Concluded · removed`),
     then assert the item panel prints the outcome instead of the old body, **without** a reload.
2. **Find the mechanism before touching the component.** Two candidates, both plausible:
   the form's inputs are uncontrolled (`defaultValue`-shaped) and capture their first value before
   the row resolves — then the fix is to render the fields only once the row is present (the
   Loading→Success boundary the contract already demands), not to fight the input; and the case
   page reads its item once into a local `track()` at mount — then the fix is to re-read it after
   `concludeReport()` returns, or to render from the entity the mutation returned.
3. **Zod stays the boundary.** If the fix reads the row again, it goes through `repo.getCharacter`
   / `repo.getReport` (already schema-parsed). Do not add a second shape, do not `as` a field, and
   do not re-trim a handle in the page.
4. Keep both steps inside the existing single-session walk: a hard reload re-seeds the memory
   adapter, so a step that reloads proves nothing about state.

## Traps

- **The edit-form defect is timing-shaped** — a fix that only widens a timeout will pass today and
  fail on a slow phone. Assert on *identity* (the name in the field equals the URL's character),
  never on elapsed time.
- **`effect()` is the only lifecycle hook** in this Ripple version, and a module-scope `track()`
  throws. A "re-read on mount" must live inside the component.
- **The case page's conclusion writes through `concludeReport`**, which returns the updated report;
  the panel should render from that returned entity, not from a re-fetch that can race the writer.
- **A post's removal deletes the thread** (T-28B) — the item panel must not render a thread for a
  removed post; the dead-card copy is the existing pattern.
- `/moderation/*` needs `?admin=1` in the URL, and the queue's filter links rewrite it; a step that
  reloads must re-add it.
- Keep `bun run smoke` (12/12 today) and `./scripts/check.sh` green; a new step joins the same
  twelve-row table as thirteen.

## Open decisions

- Whether the edit form should render inputs only after the row resolves (a skeleton for ~1 frame)
  or hold a keyed `<form>` that remounts when the id changes. The first matches the contract's
  *every async surface renders Loading*; the second avoids a flash. Pick one and write it into
  `docs/DESIGN.md` in the same commit.
- T-34's `setBadge()` currently answers through `document.title` in a browser. If a later ticket
  wires an unread count to it, the badge and the tab bar's `Alerts, N unread` label must agree —
  decide there, not here.

## Found while working (carried forward — keep this list growing)

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
- **T-38 is done**: `scripts/smoke.mjs` walks the twelve journeys in one session at 360×740 and
  asserts on the DOM at every step (badge label, `aria-pressed`, a card leaving the grid, a case
  count 3 → 4 open, *Concluded · removed*). `scripts/smoke.sh` builds + previews + walks + tears
  down; `--live` walks the Pages URL; `bun run smoke` is the alias. 12/12 in ~7s. **It is not in
  `check.sh`** — the gate stays browser-free, and a machine without Chromium must not fail a commit.
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
- **The case page's *THE ITEM* panel does not re-render after *Conclude*** — T-40.
- **`/character/[id]/edit` may render its inputs before the row resolves** — T-40.
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

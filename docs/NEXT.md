# Baton — what the next session does

**Ticket: T-34 — the native bridge, with a browser fallback for every capability.**

Spec: `src/specs/luaplot-pages.md` → *Conventions*; `docs/ARCHITECTURE.md` → *Tauri hardware*;
`docs/CONTRACT.md` → *Engineering law* (*Tauri hardware*: mobile-only capabilities go through
`src/lib/native.ts`, dynamically imported, with a browser fallback; the web build must never break).

Why next: **T-38 closed the last verification gap on the web build** — twelve primary journeys walk
green in one scripted session (`bun run smoke`, 12/12, ~7s) against the preview and, with `--live`,
against the published URL. P4 (T-29…T-32) stays blocked — no Supabase project ref, no `supabase`
CLI. T-37B (light-flavour contrast) is still a palette decision for a human, and T-35/T-36/T-39 need
an Android toolchain this box lacks. Of the two unblocked P5 tickets, **T-34 is the one that can be
finished and proven without a running Tauri shell**: `src/lib/native.ts` does not exist yet
(`grep -rn "@tauri-apps" src` finds nothing outside `package.json`), and its acceptance — browser
fallbacks proven, zero Tauri imports in the web bundle graph — is mechanically checkable here today.
T-33 needs a `src-tauri` scaffold and a display; it is the ticket that makes a *device* run possible,
not this one.

## Approach

1. **One module, one capability table.** `src/lib/native.ts` exports a small async API —
   `haptic(kind)`, `share({title, text, url})`, `copy(text)`, `pickImage()`, `setBadge(n)` — each of
   which: (a) checks `isNative()` (`"__TAURI_INTERNALS__" in window`, never a build-time env flag),
   (b) `await import("@tauri-apps/api/...")` **inside** that branch so the browser never loads it,
   (c) falls back: `navigator.vibrate`, `navigator.share` then `navigator.clipboard`,
   `navigator.clipboard.writeText`, `<input type="file" accept="image/*">`, `document.title`.
2. **Every capability answers a typed result, not `void | throw`** — `{ ok: true } | { ok: false,
   reason: "unsupported" | "cancelled" | "failed" }` as a Zod schema in `src/lib/schema.ts` (T-07B's
   rule: one shape, one home). A page must render *nothing happened* without a `try`.
3. **Wire only what a spec already asks for.** A post's *Share* is in no spec — do not add a control
   to a page in this ticket. If nothing calls a capability yet, ship the module and its fallbacks and
   leave the call site for the ticket that does.
4. **Prove the web path**: the built entry chunk must not statically import `@tauri-apps/*`
   (`grep -o "@tauri-apps" dist/assets/index-*.js` must be empty), and the fallbacks must be
   exercised — a temporary `/dev/native` route printing the last result of each call is the cheapest
   honest harness, and it is the pattern `/dev/state` and `/dev/data` already set.

## Traps

- **`isNative()` must be a runtime read.** An `import.meta.env` flag is baked at build time and makes
  the Pages build pretend; `__TAURI_INTERNALS__` is what the shell actually injects.
- **A dynamic import still gets bundled** — as its own chunk. The acceptance is that the web entry
  never *loads* it: calling a capability in the browser must issue zero requests for that chunk.
- **`navigator.share` rejects with `AbortError` on cancel** — that is `cancelled`, not `failed`; a
  toast on cancel is a bug.
- **Clipboard needs a user gesture**, and on Pages a secure context; write the fallback chain
  (`share` → `clipboard` → `execCommand` → `unsupported`) down in the module, because no headless
  walk can prove the gesture rule.
- **`haptic()` on a desktop browser does nothing** (`navigator.vibrate` is undefined) — answer
  `unsupported`, never throw.
- Keep `bun run smoke` and `./scripts/check.sh` green before the commit.

## Open decisions

- Whether the badge belongs in this ticket at all: `notifications.md` describes an unread *pill*, not
  an app badge. If no spec calls for it, ship it answering `unsupported` in the browser and note that
  in PROGRESS — or drop it.
- `pickImage()` presumes an uploader and there is none (T-31 is blocked). Ship the picker behind the
  result schema and wire **no** form to it this tick.

## Found while working (carried forward — keep this list growing)

- **T-38 is done**: `scripts/smoke.mjs` walks the twelve journeys in one session at 360×740 and
  asserts on the DOM at every step (badge label, `aria-pressed`, a card leaving the grid, a case
  count 3 → 4 open, *Concluded · removed*). `scripts/smoke.sh` builds + previews + walks + tears
  down; `--live` walks the Pages URL; `bun run smoke` is the alias. It ran 12/12 in ~7s, three times
  in a row. **It is not in `check.sh`** — the gate stays browser-free, and a machine without Chromium
  must not fail a commit.
- **The report journey needs POST(8)**, not any post: the preview classifier buckets on
  `hash("jev:post:" + body) % 5`, and only buckets 2/3/4 escalate (unsure → a case). A report on a
  clean-pass post verifies the item and opens **no** case, so the journey would prove nothing. If a
  fixture body changes, re-check the bucket before blaming the walk.
- **A shared Chromium profile makes the walk flake** — it cost one run 58s and five cascading
  failures. Profiles are unique per run (`tmpdir` + pid + clock, removed on exit); keep it that way,
  and a failing row quotes the page's `Runtime.exceptionThrown`.
- **`go()` must resolve against the served base.** `history.pushState("/bookmarks")` drops a
  `/LuaPlot/` base and takes the router somewhere it has no route; the smoke resolves relative to the
  `--url` base so one script walks preview and Pages.
- **`?admin=1` survives an in-app hop but not a reload** — the queue's own filter links rewrite it;
  any future walk step that reloads must re-add it (T-38's walk never reloads).
- **The light flavour still measures one failing pair**: Latte's active tab label is 4.45:1
  (`accent` on `bg-elevated`) and Latte has no darker mauve — T-37B needs a palette decision, not a
  swap. Do not close it with a hex.
- **T-37 is done**: `--color-text-subtle` equals `--color-text-muted`, muted steps to `subtext-1` on
  Frappé and Latte, `--color-accent-contrast` is `--ctp-base`, `--color-avatar-text` is the one new
  named token. Every value is a Catppuccin ramp step; a hex in a page is still a bug.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, four type pills, `overflow-x:
  auto`): two pills sit past the 360 viewport by design while the **document** does not scroll
  (`scrollWidth == clientWidth` across 35 width/route pairs). The page-level rule holds; not a bug.
- **Tap targets**: 44px still fails for card-footer author links (16–21px tall, inline text — WCAG
  2.2 `2.5.8` exempts inline links) and avatar links at 36×36 (AA's 24×24 floor passes). A fix is a
  card redesign, not a padding tweak.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS:
  the theme blocks resolve `--ctp-*` on `:root`, and a JS flip plus the nav's `transition: color`
  reads mid-flight values that look exactly like a broken palette.
- **T-37 bundle numbers, so nobody re-measures**: `dist` 1.1 MB; JS 728 KB raw / 186,716 B gz; CSS
  23,783 B gz; largest asset the JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met.
- **`/character/[id]/edit` may render its inputs before the row resolves** — one probe reading the
  form ~1.5s after navigation saw another character's name in the fields; a 1.8s read saw the right
  one. Worth a look in a ticket that touches the edit form (uncontrolled inputs capturing their first
  value?). Not reproduced since.
- **The case page's *THE ITEM* panel does not re-render after *Conclude*** — it still shows the
  target's body until reload. Not a spec violation; worth a look if a ticket touches that page.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()` (status flipped, thread
  deleted in cascade, vote dropped, row kept), `livePost()` filters `listPosts`/`profilePosts`,
  `getPost` still answers by id, the bookmarks tab reads a removed post as a dead card,
  `/post/[id]` draws the spec's *Removed by JEV* sentence plus one finality line for the author.
- **A post's removal keeps no placeholder** — the comment rule has nothing to hang on, so
  `removePost` deletes the comments (spec: *Privacy and republication*).
- **An immediate JEV action files no report row** (T-27/T-28): only the creator's notification and the
  notice row are stored. **`assets: []` is deliberate** — an image-only report escalates
  (`imageOnly`) instead of asking a text model to judge a picture.
- **A new case needs `history: []`** — build cases through `reportSchema.parse`.
- **`event` is a DOM global**: name history helpers `historyEvent`.
- **`@for` needs `const`**: `@for (const row of rows; key row.id)`; **an `@if` branch renders one
  node** — wrap header+body in `<>…</>`; **`effect()` is the only lifecycle hook**; **`{<Component />}`
  inside a fragment is a parse error**.
- **A gate named for the positive is a bug waiting**: `disabled={!canRequest.value}` is the shape that
  works with `Button`.
- **Counts now: characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12
  (11 listed, post 6 removed), reports 5 (3 open, 2 concluded), comments 22 (one removed placeholder),
  sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow edges 15.**

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

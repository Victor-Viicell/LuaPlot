# Baton — what the next session does

**Ticket: T-38 — end-to-end smoke: walk the twelve primary journeys against the published build.**

Spec: `src/specs/luaplot-pages.md` (every route's *Actions* and *States*); `docs/CONTRACT.md` →
*Report shape*; `docs/DESIGN.md` → *Contrast (measured in T-37)*.

Why next: **T-37 closed the measurement half of P6** — the dark flavours now walk at **0 failing
text pairs**, 0 unnamed focusables, 0 positive `tabindex`, 0 page-level horizontal scroll across seven
widths, no layout shift on fonts, and the bundle is 186,716 B gz against a 300 KB budget. What has
never been done is what T-38 asks: **one scripted walk of the twelve journeys against the published
build, in-app** (not by reload), because every write goes through the memory adapter and a `goto_url`
re-seed makes a passing write look like a failed one. P4 (T-29…T-32) stays blocked — no Supabase
project ref, no `supabase` CLI. T-37B (light-flavour contrast) is a palette decision, not a walk;
T-35/T-36/T-39 need a toolchain this box lacks.

## Approach

1. **Write the walk as a script, not as twelve browser sessions**: `scripts/smoke.mjs` (node, no new
   dependency) driving CDP against a running preview (`bun run preview --port 4321`). Deliverable:
   **twelve rows of {journey, started, ended, evidence}**, non-zero exit when a row fails.
2. **The twelve** (each ends where the next begins, so it is one session): sign in from `/`; publish a
   post from `/post/create`; comment on it; vote on it; save it and unsave it from `/bookmarks`;
   follow and unfollow a profile; open a character and start a session; edit an own character (which
   also unlocks *Request public again* while it is private); report a post and land on the case;
   conclude a case as `removed`; read a notification (the badge drops); sign out.
3. **Assert on the DOM, not on the adapter**: the sentence a page prints, the number in the tab
   badge, the card leaving the grid. A journey that only passes because the adapter said so is not a
   journey — the adapter is what the page is meant to be proving.
4. Record the twelve rows in `docs/PROGRESS.md`, and any journey that cannot be walked (no fixture,
   a control behind `?admin=1`) as a filed gap, never as a pass.

## Traps

- **A hard reload re-seeds the memory adapter.** Walk with `navigate()`/clicks, never `goto_url`
  between the steps of one journey; this cost T-28B a false "the removal did not stick" reading.
- **`?admin=1` and `?auth=` are preview switches** — a journey that needs a moderator must re-write
  `admin=1` after every `navigate()`, because the queue's own filter links do.
- **Smoke the build that ships**: `https://victor-viicell.github.io/LuaPlot/` or `bun run preview` of
  the same commit — not `bun run dev`, whose module graph differs from the published bundle.
- **A journey is not a click**: every step needs an assertion, or the script reports twelve greens for
  twelve no-ops.
- **Removed post 6** (`/post/90570000-0000-4000-8000-000000000006`) is the only seeded dead state; do
  not "fix" a journey by un-removing it.
- **Counts drift after a write**: concluding a case deletes comment rows, so a row that reads a count
  must read it before the write or take the adapter's answer to it.

## Open decisions

- If a journey has no fixture (a notification for a `comment` target, for instance), **file it** and
  walk the nearest one; do not seed fixtures inside a smoke ticket.
- The smoke script may join `check.sh` only if it runs in < 60s; a gate that needs a browser on every
  commit is a gate people learn to skip.

## Found while working (carried forward — keep this list growing)

- **T-37 is done**: `--color-text-subtle` now equals `--color-text-muted` (overlay-1 measured 4.44:1
  on the page, 3.40:1 on a card), muted steps to `subtext-1` on Frappé and Latte, `--color-accent-contrast`
  is `--ctp-base` (crust on mauve was 4.09:1 in light), and `--color-avatar-text` is the one new named
  token. Every value is a Catppuccin ramp step; a hex in a page is still a bug.
- **The default flavour measures clean**: 0 failing text pairs across `/`, `/post/thread`, `/post/<id>`,
  `/character/<id>`, `/bookmarks`, `/moderation?admin=1` at 360×740 in dark and in light (light leaves
  one pair, below).
- **Latte's active tab label is 4.45:1** (`accent` on `bg-elevated`) and Latte has no darker mauve —
  T-37B needs a palette decision, not a swap. Do not close it with a hex.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, four type pills, `overflow-x:
  auto`): two pills sit past the 360 viewport by design while the **document** does not scroll
  (`scrollWidth == clientWidth` in 35 width/route pairs). The page-level rule holds; not a bug.
- **Tap targets**: 44px still fails for card-footer author links (16–21px tall, inline text — WCAG 2.2
  `2.5.8` exempts inline links) and avatar links at 36×36 (AA's 24×24 floor passes). A fix is a card
  redesign, not a padding tweak — keep it out of a measurement ticket.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS:
  the theme blocks resolve `--ctp-*` on `:root`, and a JS flip plus the nav's `transition: color` reads
  mid-flight values that look exactly like a broken palette (it cost T-37 one false "Mocha is broken"
  reading).
- **T-37 bundle numbers, so nobody re-measures**: `dist` 1.1 MB; JS 728 KB raw / 186,716 B gz; CSS
  23,783 B gz; largest asset the JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()` (the one write both
  `applyJevAction` and `concludeReport` make: status flipped, thread deleted in cascade, vote dropped,
  row kept), `livePost()` filters `listPosts`/`profilePosts`, `getPost` still answers by id, the
  bookmarks tab reads a removed post as a dead card, `/post/[id]` draws the spec's *Removed by JEV*
  sentence plus one finality line for the author.
- **A post's removal keeps no placeholder.** The comment rule (*a placeholder keeps its replies*) has
  nothing to hang on when the item itself is gone, so `removePost` deletes the comments — the spec says
  so in *Privacy and republication*.
- **The ticket's copy lost to the spec.** T-28B proposed *This post was removed by moderation.*;
  `post/detail.md` → *Removed by JEV* fixes the same sentence as a deleted post, so that is what the
  page prints. Do not "improve" it back.
- **The case page's *THE ITEM* panel does not re-render after *Conclude*** — it still shows the
  target's body until reload. Not a spec violation; worth a look if a ticket touches that page.
- **T-28 is done**: `moderationNoticeSchema` + `republicationOutcomeSchema`; `repo.moderationNotice`
  answers one shape from two sources; `repo.requestRepublication` is owner-only, authored-only, runs
  `classify()` at once; `addReport`'s immediate branch writes the creator's notification **and** the
  notice row. A refused republication rewrites the gate clock (`noticeAt = outcome.at`) and sets
  `verified: false` — the next edit is what makes it eligible again.
- **An immediate action files no report row** (T-27/T-28): only the creator's notification and the
  notice row are stored. **`assets: []` is deliberate** (T-27) — an image-only report escalates
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

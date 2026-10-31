# Baton — what the next session does

**Ticket: T-13 — the public timeline at `/post/thread`.**

Spec: `src/specs/pages/post/thread.md` (the whole file — one column of post cards under a single
control row; sort in the URL; filter `All` only; the account's Show/Blur toggles; **Create** at the end
of the row; the card's own structure; attachment rendering with **Show more** for a cut; **Load more**
appends 24 and stays out of the URL; Loading / Empty / Error / End of feed) plus
`src/specs/luaplot-pages.md` → *Conventions* (the card structure posts use, paging, query-string state)
and `src/specs/systems/nsfw.md` (Show off ⇒ **NSFW posts are absent from the feed**, which is not the
blur). `docs/DESIGN.md` → *Card and grid*, *Catalog* and *Report dialog* are the laws already in force.

Why next: `/post/thread` is on the tab bar (a live destination) and still T-01's `PagePlaceholder`;
every other page in P1 that a reader can tap is built. It is also the first surface that needs a **post
card**, which T-14 (`/post/[id]`) and T-30's profile reuse.

## Approach

1. **`src/components/PostCard.tsrx`** — the structure the conventions fix for posts: `.card-head` (the
   poster's `Avatar` + `@handle` + `<time>`), `.card-middle` (the body, its inline images), `.card-foot`
   (likes, dislikes, comment count). **`Card` has no post branch and must not grow one**: a post has no
   `name`/`tagline`, and a card whose title slot is empty is a card that reads broken. Record the split
   in `docs/DESIGN.md` under *Card and grid* in this same commit.
2. **The comment count opens the permalink**, not a thread: the feed never renders a comment. Wrap the
   count in an anchor to `/post/[id]` (`href()`), 44px tap target.
3. **The attachment renders in the card**, under the body, from `postAttachmentSchema`'s two kinds: a
   `character` shows avatar + name + tagline; a `cut` shows its first messages with the rest folded
   behind **Show more**, which expands **in place** (a per-card `track()`, never a route change).
4. **Controls** — one row at 360, spread at `sm`: a `Select` for sort (`newest` / most discussed / most
   liked), a filter reading `All` only (a `Select` with one option, or a disabled-looking chip — pick one
   and say why in DESIGN), the two NSFW `Toggle`s (they write the **account**, `repo.savePreferences`),
   and **Create** as the row's last control → `/post/create` (still T-14's placeholder).
5. **Sort lives in the query string** (`?sort=…`), like the catalog's; page state stays in the component.
   `repo.listPosts({ sort, page })` already exists — `newest` sorts on `createdAt`, and the other two
   need a decision (see Open decisions).
6. **Load more** appends the next 24 (`hasMore` from the listing); paging never enters the URL. The
   bottom of the column reads **End of feed** when `hasMore` is false.

## Traps

- **`@empty` does not parse** in ripple 0.4.7 — write the explicit `@if (…length === 0) … @else`.
- **`@for (const row of …; key row.key)`** — `@for (row of …)` without `const` is a compiler crash.
- **`@else {` with two nodes needs a fragment** `<>…</>`, or the compile fails with *"A code block
  renders a single node"*. The same applies to **every** branch with two children, including a `@for`
  body's siblings — T-12 hit this five times in one file.
- **A standalone `<style>` block must be inside a fragment** with the markup it styles: `<><style>…</style><div>…</div></>`.
- **A `const`/`track()` below an `@if`/`@for`** rendered nothing in T-09 — declare the card's state at the
  top of the component and keep the branch on that track.
- **A page cannot style a primitive's `.btn`/`.field`** — the pattern for "full width at 360, inline from
  `sm`" is a page-owned wrapper that is `display: grid` (T-09's `.start`, the composer's `.post`).
- **`auto` grid/`flex` columns sized by a long caption starve their neighbours** (T-09's 26px search
  box). At 360 the control row wraps; do not put the filter caption inside a `flex: 1` cell.
- **A gallery/stage cannot prove a viewport media query.** Measure 360/640/900/1200 with CDP
  `Emulation.setDeviceMetricsOverride`, as T-09/T-10/T-11/T-12 did.
- **A base rule declared AFTER a `@media` block wins at every width.** Both selectors have the same
  specificity, and cascade order beats the query — T-13's `.head`-style grids will hit this. Declare
  base placement first, the `@media` override second, and measure at 640 before believing the split.
- **Show off removes NSFW posts from the feed**, it does not blur them (`thread.md` → URL). Blur is a
  *listing* preference for what stays visible. Read `nsfw.md` before wiring the pair: they are
  independent, and Show on + Blur on is legal.
- **The memory store resets on a hard reload** — a "the toggle sticks" claim has to be proven with in-app
  navigation (`history.back()` or a `pushState` + `popstate`), not a reload.
- **`repo.listPosts` pages 24 and the fixtures hold 12 posts**, so `hasMore` is false and **Load more**
  is unreachable until the fixtures grow. Either add ≥13 posts (and update the counts line in
  `docs/NEXT.md`'s *Found while working*) or land the control and record that its append path is
  unverified — do not pretend.
- **A post's `verified` flag and open cases leave no mark on a card** (`thread.md` → Data): a reported
  post renders exactly like any other. Do not add a badge.
- **The post body is `z.string().min(1)` and never edited** — no edit affordance on any card.

## Open decisions

- **Where "most discussed" / "most liked" sort.** `SortOrder` today is `newest | oldest | ratio | name`
  and `listPosts` maps two of them onto engagement. Either extend `SortOrder` (a repo change shared with
  every listing) or sort the page's rows in the page (wrong past page 1). Prefer the adapter, and record
  the new order names in `ARCHITECTURE.md` → Data in the same commit.
- **Where the NSFW exclusion happens.** Filtering the drawn page after a 24-row read makes `Load more`
  count the wrong things; the honest fix is a `listPosts` that reads the account's Show flag. Pick one,
  say why in `DESIGN.md` → *Catalog* or a new *Thread* section.
- **The filter control with one option.** A `Select` with `All` alone looks broken; a non-interactive
  chip labelled `All` is honest. Pick one and record it — do not invent tags the taxonomy has not
  decided (`repo.listTags("post")` answers `[]`, which is why the filter is `All` only).
- **Cut attachments in the feed**: how many messages before the fold? The spec says *its first messages*
  — pick 2 (one character turn, one user turn) and record it.

## Found while working (carried forward — keep this list growing)

- **Nothing of T-13 exists yet**: no `src/components/PostCard.tsrx`, no `src/pages/post/`. The tick that
  was handed T-13 found a killed session's half-landed cover edit on `/character/[id]` instead, finished
  it (T-12 follow-up, now committed and measured) and spent its budget there. Start T-13 at step 1.
- **A held report opens no case.** `report.md` says a report on already-verified content *starts no scan
  until the content changes*, so `addReport` records it for the viewer and opens nothing; `/moderation`
  therefore has **no view of held reports** yet. If a moderator needs them, that is a queue question
  (a third listing), not a write question. T-12.
- **A case opened at runtime carries `jev: { verdict: "unsure", confidence: 0.5, action: "none" }`** — the
  queue must render *not scanned yet* from that, not from a missing verdict. T-12.
- **`reportPartSchema` has no attachment value**, so a post's image can only be reported as text today:
  the dialog offers text-only for a `post` target. Adding a part is a **spec** question (`report.md` →
  *What can be reported*), decided in T-14 at the earliest.
- **The comment footer does not mark a row as already reported**; the dialog's record is the state.
  A per-row flag would cost one `myReport` read per row — do it only if a reader is actually confused.
- **T-12's `PARTS_BY_KIND` lives in `ReportDialog.tsrx`**, not in the schema: it is a *surface* rule, not
  a shape. If a second surface needs another part, widen the table there rather than in `schema.ts`.
- **A same-document `hashchange` is not handled by the comment thread** (T-11): the `#comment-[id]`
  anchor expands and scrolls only at mount. An in-app link to an anchor on the page already open does
  nothing. No surface produces such a link yet; when one does, add a listener **and** a way to remove
  it, or the handler outlives the page.
- **`status: "removed"` has no fixture.** The *removed by moderation* placeholder is the same code
  path as a deletion and is unreachable in the preview. A comment under `REPORT(5)`'s case would make
  it real; not invented because no spec names which comment is removed.
- **Comment attachments are not drawn** (`comment-thread.md` → *Attachments*: PNG/JPEG/WebP/GIF, four
  per comment, 10 MB each): `commentSchema` has no attachment field until an uploader exists.
- **`sessionSchema.personaId` is optional now** (T-10B): an account with no persona starts an
  unattributed session and the user's side reads `User`. T-15 must render a session without one.
- **`repo.createSession` always appends.** The one-session rule lives in the character page's primary
  control (`findSessionForCharacter`), not in the write. Do not "fix" it into the adapter.
- **Rows created at runtime take `crypto.randomUUID()`.** `src/lib/fixtures/ids.ts` buckets are for
  fixtures only.
- **The memory store resets on a hard reload.** Any "this survives" claim needs in-app navigation.
- **Continue and New session land on `/session/[id]`, still T-15's placeholder.**
- **`repo.forkCharacter` refuses a private source** and the page hides **Fork** for the same reason.
- **The adapter's listing filter is `isPublic` only**; owner visibility is the detail page's rule. The
  catalog is 27 public characters over two pages (24 + 3).
- **`repo.myVote(kind, id)` / `repo.myReport(kind, id)`** exist — every vote and report surface uses
  them, never a page-local flag that dies on a remount.
- **`router.ts` has `useParams()`.** Do not parse `location.pathname` in a page.
- **`listReports` filters open cases by default**; the owner's notice takes its own case out of
  `listReports({ status: "all" })`.
- **A page's scoped `<style>` cannot touch a primitive's elements** (T-09).
- **`Zod` costs +26.4 KB gzip on the boot chunk** (`router` imports `isHandle`). `zod/mini` or a lazy
  router import is the lever if a bundle budget is named.
- **`z.uuid()` is stricter than the router's `[0-9a-f-]{36}`.** They agree on every real id today.
- **`repo.saveProfile` + `session.setAccount` is the pair for any account write**; `savePreferences`
  is its sibling for the NSFW two.
- **`src/specs/components/` has only `comment-thread.md` and `report.md`** — a post card has no spec of
  its own, so `luaplot-pages.md` §Conventions plus `DESIGN.md` are the law for it (this is T-13's first
  decision).
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair. T-30 deletes both.
- **`publish.sh` compares the live bundle hash**; a Pages 200 alone can still be the previous deploy.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.** `COMMENTS` carries four replies under `COMMENT(13)` on `CHARACTER(1)` and
  `COMMENT(22)` is the NSFW body cover — keep both when a fixture moves.
- **`commentBodySchema` has no `min(1)`**; the required-text rule lives on `commentWriteSchema`.
- **The comment tree is not capped, only the drawing is.**
- **`Select` and `TagPicker` exist** (`src/components/`, styled in `styles.css`): reuse them rather than
  growing a segmented row or a custom dropdown — T-13's sort and filter should be a `Select`.
- **Tags are authored; characters carry ten** (`artisan, authority, creature, debt, family, ghost,
  harbor, ritual, sea, shopkeep`). Lorebooks, presets and posts have none.
- **`schema.ts` owns the report copy** (`REPORT_WHAT_REQUIRED`, `REPORT_SOURCE_REQUIRED`, …) so the
  dialog, the step gates and the adapter print the same sentence. Any new form's message belongs there.

## After this

**T-14** mounts `/post/[id]` + `/post/create` — the second caller of both `CommentThread` and
`ReportDialog`, and the first to decide whether a post's image is a reportable part.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

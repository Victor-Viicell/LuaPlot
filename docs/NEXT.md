# Baton — what the next session does

**Ticket: T-12 — the Report dialog, wired on `/character/[id]` and on a comment.**

Spec: `src/specs/components/report.md` (the whole file — what can be reported per surface, the copy
claim that names its source, one report per viewer per item, no withdrawal, the reporter never sees
an outcome) plus `src/specs/pages/character/detail.md` → *Actions* / *States* and
`src/specs/components/comment-thread.md` → *Actions* (**Report** a comment). `src/lib/schema.ts`
already owns `reportSchema` / `reportReasonSchema` / `reportPartSchema` / `reportReasonCodeSchema`;
`src/lib/data/memory.ts` → `listReports` is the only report read, and `REPORT(5)` is the private
`CHARACTER(28)` case. `docs/DESIGN.md` → *Character detail* and *Comments* are the page laws.

Why next: it is the last disabled control on a page that already works (the settings menu's
**Report** has been drawn and `disabled` since T-10), and a comment's footer is still missing its one
action — T-11's footer omits Report deliberately rather than drawing it dead. Both are the same
dialog pointed at two targets, so one ticket closes both.

## Approach

1. **`src/components/ReportDialog.tsrx`**, a `Sheet` sibling with a stepper: *what* (avatar/image vs
   text) → *reason* (filtered by that part) → *source* when the reason is a copy claim → *details*
   (optional) → submit. Cancel plus Submit, and it takes `{ target: { kind, id, label }, onClose }`.
2. **The reason list is the schema's** (`reportReasonCodeSchema`), so the dialog cannot offer a code
   the queue has no rendering for. The part → reason relationship belongs in one table in the dialog,
   keyed by `reportPartSchema`, not in markup.
3. **The adapter needs the write**: `repo.addReport({ target, part, reason, details, source? })`
   parsing with a new `reportWriteSchema` (`safeParse` at the edge) and computing
   `weight` / `lastReportAt` / `status` adapter-side, exactly as `memory.ts` derives every other
   count. **One report per viewer per item** is the adapter's rule (a `Set` keyed `kind:id:viewer`,
   the shape `votes` already uses) and it must **answer the existing report instead of appending** —
   that is what makes *Already reported* true on a remount. Add `myReport(kind, id)` for the same
   reason `myVote` exists.
4. **Wire the two call sites**: the character page's settings menu entry (remove `disabled`) and a
   comment's footer — behind `signedIn`; signed out draws no button at all (`report.md` → *States*).
5. **The confirmation is the spec's**: submitted → one line, no verdict, no queue position; already
   verified → *recorded and held; a review starts once the content changes*, never *we are looking at
   it now*.

## Traps

- **A comment's Report must not become a comment delete.** The row's Report control is drawn only when
  the row is live (never on a placeholder, which carries no actions at all) and only when signed in.
- **`@empty` does not parse** in ripple 0.4.7 — write the explicit `@if (…length === 0) … @else`.
- **A `const`/`track()` below an `@if`/`@for`** rendered nothing in T-09; declare the dialog's step
  state at the top of the body and keep the branch on that track.
- **`@else {` with two nodes needs a fragment** `<>…</>`, or the compile fails with *"A code block
  renders a single node"*.
- **`@for (row of …)` without `const` is a compiler crash** in 0.4.7 (`Cannot read properties of
  undefined`, followed by a page of bogus TS1005s). Always `@for (const row of …; key row.key)`.
- **A sheet is mounted inside `@if`** (no `open` prop) and portals to `document.body`; the z-ladder
  gives the scrim 40 / panel 41 — invent nothing.
- **The reporter never sees an outcome** — no verdict, no case id, no `jev` field in the dialog.
- **`listReports` filters open cases by default**, so a report the viewer already filed on a closed
  case is invisible there. `myReport` is the read, not a scan of that listing.
- **The page's owner notice already picks its case out of `listReports`** — do not make the dialog
  reuse that scan.

## Open decisions

- **Where the dialog gets its "already reported" answer**: an adapter read at open (recommended — it
  survives a remount) or the submit refusal. Pick the read and record it in `DESIGN.md`.
- **The source field for an internal copy claim**: a picker or a plain id? The adapter only needs the
  id; keep it a text field if a picker would change the product, and say so in `DESIGN.md`.
- **Report on a lorebook/preset/post detail page** is the same component; this ticket only lands two
  call sites (character + comment). Say so in `DESIGN.md` rather than mounting it four times.

## Found while working (carried forward — keep this list growing)

- **A same-document `hashchange` is not handled by the comment thread** (T-11): the `#comment-[id]`
  anchor expands and scrolls only at mount. An in-app link to an anchor on the page already open does
  nothing. No surface produces such a link yet; when one does, add a listener **and** a way to remove
  it, or the handler outlives the page.
- **`status: "removed"` has no fixture.** The *removed by moderation* placeholder is the same code
  path as a deletion and is unreachable in the preview. A comment under `REPORT(5)`'s case would make
  it real; not invented because no spec names which comment is removed.
- **Comment attachments are not drawn** (`comment-thread.md` → *Attachments*: PNG/JPEG/WebP/GIF, four
  per comment, 10 MB each): `commentSchema` has no attachment field until an uploader exists, so a
  body renders text only and the four-image rule has nowhere to land yet.
- **`sessionSchema.personaId` is optional now** (T-10B): an account with no persona starts an
  unattributed session and the user's side reads `User`. T-15 must render a session without one
  rather than assume the persona exists.
- **`repo.createSession` always appends.** The one-session rule lives in the character page's primary
  control (`findSessionForCharacter`), not in the write — a refusal in the adapter would make the
  settings menu's **New session** a dead entry. Do not "fix" it into the adapter.
- **Rows created at runtime take `crypto.randomUUID()`.** `src/lib/fixtures/ids.ts` buckets are for
  fixtures only; a hand-written id is the drift the schema check catches at load.
- **A page cannot style a primitive's `.btn`** — the pattern for "full width at 360, inline from
  `sm`" is a page-owned wrapper that is `display: grid; flex: 1 1 100%` and `flex: 0 0 auto` at `sm`
  (`.start` on the character page, `.post` in the comment composer).
- **The memory store resets on a hard reload.** Any "this survives" claim has to be proven with
  in-app navigation (`history.back()`), not by reloading — and `Continue`/`New session` cannot be
  shown surviving a reload in the preview until Supabase.
- **Continue and New session land on `/session/[id]`, still T-15's placeholder.** The session row,
  its copies and the link back are real; the transcript screen is not built.
- **`repo.forkCharacter` refuses a private source** and the page hides **Fork** for the same reason,
  in two places on purpose: `getCharacter` answers any id, so the page alone is not a guard.
- **The adapter's listing filter is `isPublic` only** (fixed in T-10); owner visibility is the detail
  page's rule. The catalog is 27 public characters over two pages (24 + 3).
- **`repo.myVote(kind, id)`** exists (T-10) — every vote surface uses it, never a page-local flag
  that dies on a remount. T-11 loads it per comment row too.
- **`router.ts` has `useParams()`.** Do not parse `location.pathname` in a page.
- **There is no "report for this target" adapter read.** The owner's notice takes `listReports`'
  first page and picks its own target; `myReport(kind, id)` is what T-12 adds.
- **The settings menu's Report entry is drawn and `disabled`** (T-10). This ticket wires it — do not
  leave a disabled entry behind once its target exists.
- **A page's scoped `<style>` cannot touch a primitive's elements.** `.toolbar .field`,
  `.prefs .toggle` and `.pager .btn` matched nothing — a real phone rendered a 26px search box and a
  two-line `Top rated`. Wrap the primitive in a page-owned element and place that. Found in T-09.
- **An `auto` grid column sized by a long caption starves its neighbour.** The "only filter" sentence
  took 331px of a 592px row and left the search field 26px; the caption is gone.
- **A gallery stage cannot prove a viewport media query.** CDP
  `Emulation.setDeviceMetricsOverride` is how T-09/T-10/T-11 measured 360/640/900/1200.
- **`/dev/data` passes `nsfw={character.nsfw}` only**, so with T-09's split it draws crisp — it needs
  `blur` to show a covered card. Its counts moved again with T-11.
- **Onboarding's uniqueness check sits inside `persistDraft`**, which returns early when the display
  name is empty. A handle-only visitor never gets `Username taken`. Not fixed.
- **Zod costs +26.4 KB gzip / +91 KB raw on the boot chunk** (router imports `isHandle`). `zod/mini`
  or a lazy router import is the lever if a bundle budget is named.
- **`z.uuid()` is stricter than the router's `[0-9a-f-]{36}`.** They agree on every real id today.
- **`repo.saveProfile` + `session.setAccount` is the pair for any account write**; `savePreferences`
  is its sibling for the NSFW two.
- **`src/specs/components/` has only `comment-thread.md` and `report.md`** — the card has no spec of
  its own, so `luaplot-pages.md` §Conventions plus `DESIGN.md` are the law for it.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. T-30 deletes both.
- **`publish.sh` compares the live bundle hash**; a Pages 200 alone can still be the previous deploy.
- **`Card` has no post branch.** A post has a body and no `name`/`tagline`; keep it out of `Card`
  until T-13.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.** `COMMENTS` now carries four replies under `COMMENT(13)` on
  `CHARACTER(1)` (the fold) and `COMMENT(22)` is the NSFW body cover — keep both when a fixture moves.
- **`commentBodySchema` has no `min(1)`.** The required-text rule lives on `commentWriteSchema` and
  the row's visible/empty invariant in a `superRefine`, so *a deleted comment has no body* is legal
  and *a visible empty one* is not. Any later comment write goes through the write schema.
- **The comment tree is not capped, only the drawing is.** A reply to a third-level reply lands a
  fourth level of data on the third indent — never "fix" this by refusing a reply at depth three.
- **`Select` and `TagPicker` exist now** (`src/components/`, styled in `styles.css`): a native
  `<select>` in the app's chrome, and the multi-select tag field the catalog uses. Any filter or
  enumeration a later page needs should reuse them rather than grow a segmented row or a custom
  dropdown.
- **Tags are authored, and the characters carry ten of them** (`artisan, authority, creature, debt,
  family, ghost, harbor, ritual, sea, shopkeep`). `repo.listTags(kind)` is the vocabulary a filter
  offers; lorebooks and presets still have none.

## After this

**T-13** mounts the public `/post/thread` (timeline, composer entry, Load more); then **T-14**
`/post/[id]` + `/post/create`, the second caller of both `CommentThread` and `ReportDialog`.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

# Baton — what the next session does

**Ticket: T-11 — the comment thread on `/character/[id]`.**

Spec: `src/specs/components/comment-thread.md` (the whole file — nesting, collapsing, the two
placeholders, anchors, ordering, counts) plus `src/specs/pages/character/detail.md` → *Comment on
this character* and *States*, and `docs/DESIGN.md` → *Character detail* (this page's laws) +
*Start / Continue and Fork* (T-10B, do not re-invent). Data: `src/lib/schema.ts` →
`commentSchema` / `commentThreadSchema`, `src/lib/data/memory.ts` → `listComments`, and
`src/lib/fixtures/social.ts` → `COMMENTS` (18 rows in 12 roots, depth 3 — the schema check already
proves the tree).

Why next: comments are the first engagement surface the page still lacks, and the four-cell counts
strip already draws a `Comments` number with nothing behind it. Landed comments also unblock
T-12 (Report acts on a comment) and T-13 (a post's thread is this component again).

## Approach

1. **A component, not page code**: `src/components/CommentThread.tsrx`, taking the item id and the
   viewer's handle. Four pages use it later, so nothing character-specific may leak into it.
2. **The tree is built in code, not in the template.** `listComments(itemId)` answers flat rows;
   group by `parentId`, sort oldest-first at every level, and **flatten anything deeper than the
   third level onto the third indent** (`comment-thread.md` → *Nesting*). Build a row model with a
   `depth` and a `placeholder` flag before the template sees it — the template renders a flat list
   and must never recurse.
3. **Placeholders keep the branch.** A deleted comment renders its header, its time and the footer
   with the line *This comment was deleted.* in place of the body; a moderation removal reads *This
   comment was removed by moderation.* Replies indent beneath exactly as under a live comment, and
   the placeholder carries **no actions** — no vote, no reply, no report. A comment with no replies
   disappears entirely, so a placeholder is only drawn when something hangs beneath it.
4. **Collapsing is display only**: a branch with more than three replies shows three and folds the
   rest behind `Show N more replies`; the folded replies still count toward the thread.
5. **Writes the adapter does not have yet.** `repo` needs `addComment({ itemId, parentId, body })`
   (own `nsfw` flag, SFW default) and `deleteComment(id)` (own row only; author = viewer). Voting a
   comment already works — `vote("comment", id, direction)` is in the adapter and `comment` is in
   `VotableKind`. Counts stay derived: `memory.ts` already recomputes `replyCount` and
   `commentCount` on load, and **must** recompute them on a write too, or the count-strip disagrees
   with the thread after a reply.
6. Mount it on the character page below the lorebooks (main column at `lg`, full width below), and
   make the `Comments` count cell live from the same answer.

## Traps

- **`@empty` does not parse** in ripple 0.4.7 — write the explicit `@if (…length === 0) … @else`.
- **A `const` or `track()` in a component body ahead of an `@if`/`@for` rendered nothing** under
  0.4.7 (T-09). Read props inline, or state everything the branch needs in a `track()` declared at
  the top of the body *and* keep the branch on that track.
- **A prop holding an array or a flag is frozen at the call.** `items`, `blur`, and any depth flag
  must be `Derived<…>` where the component needs to re-read it (`CardGrid` is the pattern).
- **A page's scoped `<style>` cannot touch a primitive's elements.** The composer's field and
  button are primitives: wrap them in page-owned elements and place those.
- **`@else {` with two nodes needs a fragment** `<>…</>`, or the compile fails with *"A code block
  renders a single node"*.
- **Signed out is read-only**: the composer is absent (or disabled with a sign-in link), never a
  form that fails on submit.
- **Anchors are fragments, not routes** (`#comment-[id]`): opening one expands that branch and
  scrolls to it. Do not add a `/comment/[id]` route.
- **Comments are unmoderated inside a session and never moderated on a persona** — this component
  is for shared items only; do not mount it anywhere else in this ticket.

## Open decisions

- **Where the composer sits on the character page**: `comment-thread.md` puts it at the top of the
  thread; the page has no section for it yet. Pick one (a `comments` section after the lorebooks
  with a 44px `Comment` entry in the action row pointing at it), measure at 360, and record it in
  `DESIGN.md`.
- **Whether the thread loads with the page or on demand.** 18 fixture rows are small, but the
  thread is its own Loading state per the spec; a section that loads after the page is fine as long
  as it has a skeleton rather than a spinner.
- **Reply affordance at depth 3**: the flatten rule means a *reply to a reply* still indents at 3,
  so the reply control must stay available there. Confirm what the third-level control reads.

## Found while working (carried forward — keep this list growing)

- **`sessionSchema.personaId` is optional now** (T-10B): an account with no persona starts an
  unattributed session and the user's side reads `User`. T-15 must render a session without one
  rather than assume the persona exists.
- **`repo.createSession` always appends.** The one-session rule lives in the character page's
  primary control (`findSessionForCharacter`), not in the write — a refusal in the adapter would
  make the settings menu's **New session** a dead entry. Do not "fix" it into the adapter.
- **Rows created at runtime take `crypto.randomUUID()`.** `src/lib/fixtures/ids.ts` buckets are for
  fixtures only; a hand-written id is the drift the schema check catches at load.
- **A page cannot style a primitive's `.btn`** — the pattern for "full width at 360, inline from
  `sm`" is a page-owned wrapper that is `display: grid; flex: 1 1 100%` and `flex: 0 0 auto` at
  `sm` (`.start` on the character page).
- **The memory store resets on a hard reload.** Any "this survives" claim has to be proven with
  in-app navigation (`history.back()`), not by reloading — and `Continue`/`New session` cannot be
  shown surviving a reload in the preview until Supabase.
- **Continue and New session land on `/session/[id]`, still T-15's placeholder.** The session row,
  its copies and the link back are real; the transcript screen is not built.
- **`repo.forkCharacter` refuses a private source** and the page hides **Fork** for the same
  reason, in two places on purpose: `getCharacter` answers any id, so the page alone is not a guard.
- **Fixed in T-10:** the adapter's listing filter was *public **or mine***, so a privated row came
  back to its author's catalog. Listings are now `isPublic` only; owner visibility is the detail
  page's rule. The catalog is 27 public characters over two pages (24 + 3).
- **`repo` gained `myVote(kind, id)`** in T-10 — the **Voted** state has to come from the adapter,
  never from a page-local flag that dies on a remount. Every later vote surface uses it.
- **`router.ts` gained `useParams()`.** Do not parse `location.pathname` in a page; the table already
  matched the id against `[0-9a-f-]{36}` and `[user.username]` against `isHandle`.
- **There is no "report for this target" adapter read.** The owner's notice takes `listReports`'
  first page and picks its own target; a `reportFor(kind, id)` belongs with T-12/T-29 rather than
  growing a scan in each page.
- **The settings menu's Report entry is drawn and `disabled`** (T-10). T-12 wires it — do not leave
  a disabled entry behind once its target exists.
- **A page's scoped `<style>` cannot touch a primitive's elements.** `.toolbar .field`,
  `.prefs .toggle` and `.pager .btn` matched nothing — a real phone rendered a 26px search box and a
  two-line `Top rated`. Wrap the primitive in a page-owned element and place that. Found in T-09.
- **An `auto` grid column sized by a long caption starves its neighbour.** The "only filter" sentence
  took 331px of a 592px row and left the search field 26px; the caption is gone.
- **`@empty` does not parse in ripple 0.4.7** although the skill doc shows it (`TS1144`/`TS1146` at
  the token). Write the explicit `@if (…length === 0) … @else` branch.
- **A gallery stage cannot prove a viewport media query.** Any breakpoint proof must resize the
  window; CDP `Emulation.setDeviceMetricsOverride` works and is how T-09 measured 1/2/3/4 columns
  and T-10/T-10B measured the 360/640/900/1200 layouts.
- **`/dev/data` passes `nsfw={character.nsfw}` only**, so with T-09's split it draws crisp — it needs
  `blur` to show a covered card. Its counts moved with T-10's fixtures (28 characters, 5 reports).
- **Onboarding's uniqueness check sits inside `persistDraft`, which returns early when the display
  name is empty.** A handle-only visitor never gets `Username taken` and `Finish` stays disabled with
  no explanation. Not fixed.
- **Zod costs +26.4 KB gzip / +91 KB raw on the boot chunk** (router imports `isHandle`). `zod/mini`
  or a lazy router import is the lever if a bundle budget is named.
- **`z.uuid()` is stricter than the router's `[0-9a-f-]{36}`.** They agree on every real id today.
- **`repo.saveProfile` + `session.setAccount` is the pair for any account write**; `savePreferences`
  is its sibling for the NSFW two.
- **`src/specs/components/` has only `comment-thread.md` and `report.md`** — the card has no spec of
  its own, so `luaplot-pages.md` §Conventions plus `DESIGN.md` are the law for it.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. T-30 deletes both.
- **`publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.**
- **`Card` has no post branch.** A post has a body and no `name`/`tagline`; keep it out of `Card`
  until T-13.
- **Characters are 28 now (27 public); lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 18, sessions 2.** A listing needs two pages of *public* rows to prove `Load more`; a
  private fixture does not count.
- **`Select` and `TagPicker` exist now** (`src/components/`, styled in `styles.css`): a native
  `<select>` in the app's chrome, and the multi-select tag field the catalog uses. Any filter or
  enumeration a later page needs should reuse them rather than grow a segmented row or a custom
  dropdown.
- **Tags are authored, and the characters carry ten of them** (`artisan, authority, creature, debt,
  family, ghost, harbor, ritual, sea, shopkeep`). `repo.listTags(kind)` is the vocabulary a filter
  offers; lorebooks and presets still have none.

## After this

**T-12** replaces the menu's disabled **Report** entry with the dialog from
`src/specs/components/report.md`; then **T-13** mounts the public `/post/thread`.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

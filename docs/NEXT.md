# Baton — what the next session does

**Ticket: T-14 — `/post/[id]` and `/post/create`.**

Specs: `src/specs/pages/post/detail.md` (the whole file — Layout is *To be specified*, so its layout
choices must be recorded in `docs/DESIGN.md` in the same commit) and
`src/specs/pages/post/create.md` (one column: body with inline images, attachment picker, NSFW toggle,
Publish / Cancel; sender attribution only once a cut is attached; the panel-over-the-page form too).
`src/specs/luaplot-pages.md` → *Conventions* (a post's parts, paging, query-string state) and
`docs/DESIGN.md` → *Thread* (T-13's post card) are the law already in force. T-14 is also the first
surface that must decide whether a post's image is a **reportable part** (`components/report.md` →
*What can be reported*; `reportPartSchema` has no attachment value today).

Why next: `/post/[id]` is the permalink `PostCard` already links to (the comment count and the
`<time>`), and it is the second caller of both `CommentThread` and `ReportDialog` — the two components
whose reuse T-14 proves. `/post/create` is the only way to make a post, and the thread's **Create**
control points at it today as a placeholder.

## Approach

1. **`/post/[id]` reuses `PostCard` for the body and adds only what a permalink adds**: the vote pair,
   bookmark, Report, Delete (author only, and it takes the whole comment thread with it), and
   `CommentThread` beneath. The cut renders **in full** here — no fold, no Show more — and a character
   attachment renders as its card with a link. A cut has **no link back** to its session: it is text.
2. **Engagement is the detail page's**: ratio percentage from `percent(ratioOf(post))` with the raw
   like and dislike counts beside it, plus the comment count — never a fraction.
3. **`/post/create` is one form**: body (a `Field`-style textarea, no image uploader until an
   uploader exists — say so in DESIGN rather than draw a button that does nothing), attachment picker
   over the author's own characters and cuts, NSFW toggle, Publish / Cancel. Empty body is the only
   hard gate today (`postWriteSchema` must be added to `schema.ts`, `safeParse`d at the form edge and
   again in `repo.addPost`).
4. **Attaching another author's item must be impossible** — that is T-14's accept line. The picker
   lists `repo.listCharacters()` filtered to `author === viewer`, and the *write* verifies it too
   (the adapter refuses an id the viewer does not own), so the picker cannot be the only guard.
5. **`postAttachmentSchema` has no image field and `reportPartSchema` has no attachment value.** Do not
   invent either: if the post's image is to be reportable, that is a spec change in `report.md`, and
   the honest interim is the text-only report the thread already offers.

## Traps

- **`@empty` does not parse** in ripple 0.4.7 — write the explicit `@if (…length === 0) … @else`.
- **`@for (const row of …; key row.key)`** — `@for (row of …)` without `const` is a compiler crash.
- **`@else {` with two nodes needs a fragment** `<>…</>`, or the compile fails with *"A code block
  renders a single node"* — every branch with two children, including a `@for` body's siblings.
- **A standalone `<style>` block must be inside a fragment** with the markup it styles.
- **A `const`/`track()` below an `@if`/`@for`** renders nothing — declare state at the top.
- **A prop expression is evaluated once.** T-13's card takes the whole `people` record because
  `character={people[id]}` froze on the `null` it saw before the lookup answered. Same trap as `blur`.
- **A discriminated union cannot be narrowed inside a template block**: T-13 flattened the attachment
  to a plain object with a `shown` flag in a derived. Do the same for the cut's messages.
- **A page cannot style a primitive's `.btn`/`.field`** — use a page-owned wrapper.
- **A base rule declared AFTER a `@media` block wins at every width.** Same specificity, cascade order
  beats the query. Declare base placement first, then measure at 640.
- **Measure 360/640/900/1200 with CDP `Emulation.setDeviceMetricsOverride`** — a screenshot cannot
  prove a media query.
- **The memory store resets on a hard reload** — any "it sticks" claim needs in-app navigation.
- **`publish.sh` compares the live bundle hash**; a Pages 200 alone can still be the previous deploy.
- **A post's `verified` flag and open cases leave no mark** (`thread.md` → Data): do not add a badge.
- **Delete takes the thread with it** — the adapter must drop the comments, not orphan them, and the
  feed/detail must then answer the not-found state.

## Open decisions

- **The composer's image/GIF insertion.** There is no uploader and no storage: either draw nothing and
  record it, or draw a disabled control. Prefer nothing, and say so in DESIGN → *Thread*.
- **Where the create form lives.** The spec wants the same form as a panel over the thread and over a
  session. Build the route first; a `Sheet` host is a second decision, and the session instance only
  exists once T-15 lands.
- **Cut attribution.** `cutMessageSchema` carries `attribution` per message, so the persona-vs-`User`
  choice is a **text written at publish time** — record how the composer stamps it.

## Found while working (carried forward — keep this list growing)

- **Load more is unverified on the thread**: 12 fixtures against a 24-row page. Growing `POSTS` past
  25 is the cheapest way to prove the append path, and it also gives T-14 a longer thread to sit in.
- **`PostCard` folds a cut at two messages** behind Show more; the permalink must draw **all** of them,
  so the card needs a `fold` prop (or the detail page its own drawing) — decide and record it.
- **A held report opens no case** (T-12): `/moderation` has no view of held reports. A queue question.
- **A case opened at runtime carries `jev: { verdict: "unsure", confidence: 0.5, action: "none" }`** —
  the queue renders *not scanned yet* from that.
- **`reportPartSchema` has no attachment value**, so a post's image can only be reported as text.
- **`status: "removed"` has no fixture**; the removed-by-moderation placeholder is unreachable.
- **Comment attachments are not drawn** — `commentSchema` has no attachment field until an uploader.
- **`sessionSchema.personaId` is optional** (T-10B): an account with no persona starts an unattributed
  session. T-15 must render a session without one.
- **`repo.createSession` always appends**; the one-session rule lives in the character page.
- **Rows created at runtime take `crypto.randomUUID()`**; fixture id buckets are fixtures only.
- **`repo.myVote(kind, id)` / `repo.myReport(kind, id)`** exist — never a page-local flag.
- **`router.ts` has `useParams()`.** Do not parse `location.pathname` in a page.
- **A page's scoped `<style>` cannot touch a primitive's elements.**
- **Zod costs +26.4 KB gzip on the boot chunk**; `zod/mini` is the lever if a budget is named.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.**
- **The item cover is `Avatar size="hero"`** — full content width and 1:1 on a phone, a 320px column
  from `sm`, monogram initials. Lorebook and preset detail pages are placeholders and inherit it.
- **`schema.ts` owns form copy** (`REPORT_WHAT_REQUIRED`, …) so gate, inline error and adapter print
  the same sentence. The composer's empty-body message belongs there.

## After this

**T-15** mounts `/session/[id]`: transcript, composer, awaiting state, and the publish-a-cut flow that
T-14's composer will be opened from.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

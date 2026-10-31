# Baton — what the next session does

**Ticket: T-15 — `/session/[session.id]`.**

Specs: `src/specs/pages/session/detail.md` (the whole file — *Layout* is **To be specified** beyond the
settings button, so every layout choice must be recorded in `docs/DESIGN.md` in the same commit),
`src/specs/components/comment-thread.md`-style conventions in `src/specs/luaplot-pages.md`, and
`docs/DESIGN.md` → *Post detail and composer* (T-14's composer, which this page opens as a panel) plus
*Thread* (the card the published cut becomes).

Why next: `/session/[id]` is the only route left in P1, it is where **Publish a cut** lives (T-14's
composer is built to be opened from it), and it is the last consumer of `Session` before P2. Its
fixtures already cover the two hard states — session 1 is fully linked, session 2 has an `edited`
character copy and an `unlinked` lorebook copy (its original is private).

## Approach

1. **The page is the transcript, not a dashboard.** Header: the character's in-session name, the
   persona in use, and the settings button at its top right. The transcript is append-only turns under
   the in-session name; the composer sits under it. No session list exists anywhere — the URL or the
   character's **Continue** is the only way in (`detail.md` → *Data*).
2. **The settings `Sheet` holds exactly two options** — **New Session** (first) and **Delete session**
   (with confirmation). The menu holds those two and nothing more; persona switching is its own
   control beside the persona, not a third menu item.
3. **Copies carry a state, and each state has one control:** *linked* → **Update from original**
   (confirms, overwrites the session's edits) and **Restore** only when `edited`; *unlinked* → no link
   actions at all, and the copy still runs. `characterCopySchema` / `lorebookCopySchema` /
   `presetCopySchema` already carry `version`, `edited`, `unlinked`.
4. **`send` appends a turn locally for now.** T-16 owns the LLM seam and the awaiting state; this
   ticket must leave a named seam (one function, `lib/llm/chat.ts` when it lands) rather than a page
   that calls a model. Do not fake a reply.
5. **Publish a cut opens T-14's composer in a `Sheet`** with the cut pre-attached — the range named by
   its first and last turn (`detail.md` → *Actions*), the persona/`User` attribution choice, and the
   post's own NSFW toggle deciding the flag (never the character's). `repo.addPost` already takes the
   cut as text; the composer's panel mode is the one thing T-14 deferred.
6. **Not-found and not-a-participant are one state** — "This session doesn't exist." — for the same
   reason the post permalink collapses them: `getSession` answers `null` for both.

## Traps

- **`useParams()` keys the param by its own segment**: `[session.id]` → `params.id`. T-14 lost a tick
  to reading `params["post.id"]` and rendering the not-found state on a live URL.
- **`@empty` does not parse** in ripple 0.4.7 — write the explicit `@if (…length === 0) … @else`.
- **`@for (const row of …; key row.key)`** — without `const` it is a compiler crash.
- **`@else {` with two nodes needs a fragment** `<>…</>`; every branch with two children, including a
  `@for` body's siblings.
- **A standalone `<style>` block must be inside a fragment** with the markup it styles.
- **A `const`/`track()` below an `@if`/`@for`** renders nothing — declare state at the top.
- **A prop expression is evaluated once** — hand a `track` over (not `track.value`) when a child must
  follow it, and read it through `read()` inside the child.
- **A discriminated union cannot be narrowed inside a template block** — flatten to plain fields in a
  derived (T-13's attachment, T-14's `copies` will need the same).
- **A page cannot style a primitive's `.btn`/`.field`** — use a page-owned wrapper.
- **A base rule declared AFTER a `@media` block wins at every width.** Declare base placement first.
- **Measure 360/640/900/1200 with CDP `Emulation.setDeviceMetricsOverride`** — a screenshot cannot
  prove a media query, and check `scrollWidth ≤ innerWidth`.
- **The memory store resets on a hard reload** — any "it sticks" claim needs in-app navigation.
- **`publish.sh` compares the live bundle hash**; a Pages 200 alone can still be the previous deploy.
- **Delete session removes the transcript and the copies; a published cut stays** (it is a post). The
  adapter needs a `deleteSession`, and the route must then answer not-found.
- **`schema.ts` owns form copy** (`POST_REQUIRED`, `COMMENT_REQUIRED`, …) so gate, inline error and
  adapter print the same sentence. A session-copy edit form's copy belongs there too.
- **Zod at every new boundary**: a session-copy edit is a write — give it a `*WriteSchema` in
  `schema.ts` and `safeParse` it in both the form and the adapter, never a page-local `trim()`.

## Open decisions

- **Where the transcript scrolls.** The shell already scrolls the page; a session wants the transcript
  pinned to the bottom with the composer in reach. Decide one (sticky composer, or a fixed-height
  transcript from `md`), measure it at 360 with the keyboard inset (`docs/DESIGN.md` → *Shell*), and
  record it — do not leave two scrollbars on a phone.
- **`Awaiting model response`** is a T-16 state. Draw the placeholder only if T-16 lands in the same
  tick; otherwise leave the seam and say so in DESIGN.
- **New Session** needs `repo.createSession(characterId)` (it exists) plus the current persona — check
  whether a persona switch has to be passed through, or whether the default is right.
- **`deleteSession` does not exist yet** on `Repo`; add it beside `deletePost` with the same
  author-only shape.

## Found while working (carried forward — keep this list growing)

- **Load more is unverified on the thread**: 12 fixtures against a 24-row page. Growing `POSTS` past
  25 is the cheapest way to prove the append path.
- **`PostCard` now takes `fold` / `foot`** (T-14): the permalink passes `fold={false}` / `foot={false}`,
  the feed passes neither. T-30's profile reuse passes neither.
- **`postWriteSchema` and `POST_REQUIRED` exist** — the composer's gate and `repo.addPost` share them;
  a panel instance must reuse the same schema, not a panel-local copy of the rules.
- **A cut with no messages is refused** (`postAttachmentSchema.messages.min(1)`): an empty session
  cannot publish a cut, and the composer keeps the draft when the write fails.
- **A new post is `verified: false`** — the queue's *not scanned yet* rendering applies to it.
- **`repo.addPost` starts post engagement at zero and dates it `nowIso()`**; a post created at runtime
  sorts to the top of `/post/thread` on `newest`.
- **`repo.listMySessions()` exists** (newest `updatedAt` first) — T-15 should not add a second way to
  list a session.
- **A held report opens no case** (T-12): `/moderation` has no view of held reports. A queue question.
- **`reportPartSchema` has no attachment value**, so a post's image could only be reported as text
  (`post/detail.md` offers the text-only report the thread already has).
- **`status: "removed"` has no fixture**; the removed-by-moderation placeholder is unreachable.
- **Comment attachments are not drawn** — `commentSchema` has no attachment field until an uploader.
- **`sessionSchema.personaId` is optional** (T-10B): an account with no persona starts an unattributed
  session, and the transcript's user side reads `User`.
- **`repo.createSession` always appends**; the one-session rule lives in the character page.
- **Rows created at runtime take `crypto.randomUUID()`**; fixture id buckets are fixtures only.
- **`repo.myVote(kind, id)` / `repo.myReport(kind, id)`** exist — never a page-local flag.
- **A page's scoped `<style>` cannot touch a primitive's elements.**
- **Zod costs +26.4 KB gzip on the boot chunk**; `zod/mini` is the lever if a budget is named.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.**
- **The item cover is `Avatar size="hero"`** — full content width and 1:1 on a phone, a 320px column
  from `sm`. Lorebook and preset detail pages are placeholders and inherit it.

## After this

**T-16** the LLM seam: `lib/llm/chat.ts` + `mock.ts` + a **Preview mode** chip, so a sent message
produces a deterministic reply after the awaiting state.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

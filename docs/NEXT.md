# Baton — what the next session does

**Ticket: T-26 — the moderation queue (`/moderation`). P3 continues.**

Spec: `src/specs/pages/moderation/queue.md` (whole file — *Purpose*, *Data*, *Actions*, *States*,
*Rules*); `src/specs/systems/jev.md` → what escalates and what JEV already did;
`src/specs/components/report.md` → what a report holds and why the reporter sees no outcome. Then
`src/specs/pages/moderation/detail.md` (read it, but only its *Data* list matters this tick: it is
what a case row must be able to name). `docs/DESIGN.md` → *Report dialog (T-12)* and
*Notifications (T-22)* for the row idiom already settled.

Why next: every write that feeds this page already exists — `repo.addReport` opens one cumulative
case per item (`weight`, `status`, `lastReportAt`, `jev.action`), `repo.listReports` answers
most-reported-first with a `status` filter, and `reportSchema` already carries the fields. What is
missing is the page: **today `/moderation` is a `PagePlaceholder`.** Until it exists, escalation has
no destination, and `systems/jev.md`'s whole "unsure → a human decides" half is a sentence with no
surface.

## Approach

1. **Read the adapter before drawing anything.** `reportSchema` (line ~861 of `schema.ts`) and
   `repo.listReports` are the contract; run `/dev/data` once and read the five fixture reports to see
   which are open, which concluded, and what `weight` they carry. If a field the queue's *Data*
   section names has no home on the row, that is a schema question for the baton — do not invent a
   page-local shape and do not add `z.any()`.
2. **The row is metadata only — this is the spec's one hard drawing rule.** Content type, JEV's
   classification, the report reason, the weight, the age of the last report, and the status. **No
   preview, no avatar of the reported item, no body excerpt.** A queue that shows the content is a
   queue that gets read in public.
3. **Weight is the order and the only order.** Most reports first; equal weight breaks on
   `lastReportAt`, newest first. No sort control, no claim/assign control, no moderator column. The
   spec says ordering is not a control.
4. **Filter is a query-string choice of three**: open (default), concluded, all. `Select` or a chip
   row — decide once and record it in DESIGN, because `/moderation` is the app's first admin page and
   the shape will be copied by the case page.
5. **Counts are one line above the list**, open versus concluded, read from the same listing answer
   (or a second `listReports` call with the other filter — never a number the adapter did not say).
6. **The admin gate is a state, not a redirect.** `currentUser()?.isAdmin` is `false` for the mock
   account, so draw the forbidden state (`Only a moderator can open the queue.` + a link home) rather
   than an empty list, and say in DESIGN how a reviewer reaches the page in the preview. No route
   blocking — `router.ts` keeps its declarative `access`, the redirect matrix is T-30.
7. **Empty, populated, loading, not-admin, and an error state** — five drawings, one phase union
   exactly as the catalogs do it (`loading | ready | forbidden | error`), no shoal of booleans.
8. **Zod is unchanged by this ticket** unless a field is missing: every row already comes out of
   `reportSchema`, and the page parses what it reads at the boundary like every other page.

## Traps

- **`/moderation` is in the overflow menu already** (`Bookmarks, Moderation, Terms`) and in
  `src/specs/luaplot-pages.md`; it is not a new route — replace the placeholder
  (`pages/moderation-queue.tsrx`) and keep the route entry as it is.
- **`listReports` answers `Listing<Report>`**, so paging is a real question: the spec's *States* do
  not mention **Load more**, but the adapter slices. Either page one (and say so) or add `Load more`
  — decide, record, and match `/notifications`' precedent (no paging) only if the fixtures justify
  it. There are five reports; the honest answer is probably page 1 with no control, plus a line in
  DESIGN.
- **A concluded case stays in the list forever** (Rules): the concluded filter is the only way back
  to one, so the default filter must not silently hide the fact that the page has history.
- **`Report` not anything else**: `weight` is the report count, never a stored score; do not compute
  a "severity".
- **Page CSS cannot reach a primitive** (T-09): wrap the `Select`/chip row in a page-owned element.
- **A keyed `@for` needs the row's own identity**: `key report.id`, and if a reveal-like per-row state
  ever appears, key it by a fetch epoch the way `CardGrid.revealEpoch` does (T-25).

## Open decisions

- **Filter control**: `Select` (three options) versus a chip row. The toolbars use `Select` for
  enumerations and a chip for a one-value fact; three real options are a `Select`.
- **Whether the queue carries per-row status words or a chip.** The spec lists status as data; a
  12px word in the row's meta line is cheaper than a badge and does not compete with the accent.
- **Paging**: page 1 only, or **Load more** when `hasMore`.

## After this

**T-26B `/moderation/[report.id]`** — the case itself: cumulative report list, the four actions
(conclude with a visibility outcome, remove avatar as part of concluding, set reason, comment,
dismiss after ticking every term), the flat chronological history, and the notification the
conclusion writes. It needs new repo writes (`caseCommentSchema`, conclude, dismiss) that T-26 does
not; splitting it is deliberate, and `docs/SHIP-PLAN.md` carries both.

**T-27 JEV adapter** waits behind it because the case page is where a verdict is displayed.

## Found while working (carried forward — keep this list growing)

- **T-25 is done**: `components/NsfwControl.tsrx` draws the Show/Blur pair signed in and one
  **Show NSFW content** control leading to `/authentification` signed out, on all three catalogs and
  `/post/thread` — never a page-local pair again. `lib/state/prefs.ts` holds the signed-out answer as
  one **pending intent** (`requestShowNsfw` / `showRequested`), applies it after the sign-in re-read,
  and drops it on sign-out; `/authentification` draws that single action under a 12px caption and
  nothing when signed in.
- **A reveal's lifetime is now a fetch epoch** (T-25): `CardGrid` takes `revealEpoch`, `/post/thread`
  keys its feed by `` `${post.id}#${epoch}` ``, `/bookmarks`' `cellOf(row, epoch)` and the profile
  grid's key do the same, and every `replace` fetch bumps the counter; an `append` does not. **Any new
  listing that can refetch must pass it**, or a revealed card survives the fetch that should cover it.
- **`/user/[username]`'s posts feed still keys on `post.id`** (T-25): a revealed post there survives
  a tab switch. One line to fix when that feed is next touched; not worth a ticket of its own.
- **The preview's sign-in switch is the only way into the signed-out states** — a hard reload seeds
  `session.ts` signed in again, so signed-out testing must be done by signing out *in-app* (overflow →
  **Sign out**), and the in-app sign-in button reads **Sign in as @you**.
- **`/terms` is done** (T-24): `TERMS_RULES` + `REPORT_REASON_RULE` in `schema.ts`, ids
  `#copied-content` / `#unmarked-nsfw` / `#illegal-content`, `ReportDialog`'s reason stop prints the
  rule each reason enforces, onboarding's **Finish** is the acceptance.
- **A hash in the URL needs a mount jump** (T-24): `effect()` → `scrollIntoView` plus
  `scroll-margin-top: 72px` on every target.
- **`<a>` and `<button>` do not nest**; **`{<Component />}` inside a fragment is a parse error**;
  **`effect()` is the only lifecycle hook** (T-24).
- **A component's root element cannot be styled** (T-19) and **a page's scoped block cannot reach a
  primitive's elements** (T-09): wrap primitives in page-owned elements.
- **`/user/[username]` and `/user/[username]/edit` are done** (T-23); `profileWriteSchema` is
  onboarding's two-field write; the NSFW pair lives in `repo.savePreferences`, not the profile row.
- **A rename moves the account** (T-23): the memory adapter's `VIEWER` constant and vote/bookmark keys
  still name the old handle; viewer wiring is T-30's.
- **`/notifications` is done** (T-22): `markNotificationRead`, `markAllNotificationsRead`,
  `unreadNotificationCount`, `lib/state/inbox.ts`, badge in both nav hosts.
- **The inbox fixture count is 6** (T-22): three unread, one `count: 2`, one `count: 3`.
- **`repo.myVote` / `repo.myReport` / `isBookmarked` exist** — never a page-local flag.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow
  edges 15.**
- **The memory adapter loses runtime rows on a hard reload** (T-18): navigation must stay in-app, and
  a signed-out or prefs-changed state cannot be tested by reloading.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

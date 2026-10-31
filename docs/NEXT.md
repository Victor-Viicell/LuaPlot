# Baton — what the next session does

**Ticket: T-24 — `/terms`.**

Spec: `src/specs/pages/terms.md` (whole file); `src/specs/components/report.md` → *Reasons* (every
reason maps back to one of the three prohibitions); `src/specs/systems/jev.md` and
`src/specs/systems/nsfw.md` (the two cross-links); `src/specs/pages/onboarding.md` → the acceptance
line beside **Finish**; `docs/DESIGN.md` → *Profile header and edit form (T-23)* for the prose-page
conventions this repo has settled so far.

Why next: it is the last page of P2 and the only one that is **pure copy** — no adapter call, no
state, no tab. It is also the page two other surfaces already point at: `/onboarding` says
*continuing accepts these terms* and links here, and `ReportDialog` files a reason that has to be one
of these three. So the work is not layout for its own sake: the three prohibitions must be anchored
so a report reason can point at the rule it enforces, and the page must not contradict what the
dialog implies.

## Approach

1. **One prose column, the shell's column.** `pages/terms.tsrx` already exists as a placeholder; it
   becomes the page. No `max-width` of its own — the A4 cap lives on the shell's outlet
   (`luaplot-pages.md` → *Conventions*), which is the rule every content page follows.
2. **The shape is the spec's own order**, not a redesign: title, the three prohibitions as an
   ordered list, then the notes (*Where the line sits*, *What the rules apply to*, *What the flag
   covers*, *Accepting the terms*, *How enforcement works*). Headings are the spec's own sentences,
   shortened only where a heading would otherwise be a paragraph.
3. **Anchors, because something links here.** Stable ids for the three prohibitions
   (`#copied-content`, `#unmarked-nsfw`, `#illegal-content`) and one per note. Then have
   `components/ReportDialog.tsrx` print the rule each reason code belongs to as a link to that
   anchor — `report.md` says every reason maps back to one of the three, so the mapping belongs in
   **one** place. If the dialog is too locked to change safely, put the mapping beside
   `reportReasonCodeSchema` in `lib/schema.ts` and record the decision in DESIGN; never three
   hand-written copies.
4. **No controls beyond navigation** (`terms.md` → *Layout*): no accept button, no checkbox, no
   version, no last-updated date. Acceptance is onboarding's **Finish**; this page is read-only. Do
   not add an "I accept" affordance — that invents a record the spec says is not kept.
5. **The two systems are links, not summaries**: the NSFW preference is named and linked where a
   route exists, JEV/report steps stay on the content's own page ("this page states only that fixing
   every reason opens it, and leaves the steps there"). Keep the sentences; shorten only for the
   screen, never the meaning.
6. **States**: *Static* is the only one. No skeleton, no error, no empty state — nothing is fetched.

## Traps

- **Copy is product law on this page.** Every rule sentence in `terms.md` must survive — "Realism is
  the dividing line", "one flag per item", "no per-image and no per-avatar flag", loli/shota are NSFW
  but not treated as literal CSAM. This is the one page where a confident rewrite changes what is
  enforced.
- **No `zod` shape is needed** for static copy. Do not invent a schema for prose.
- **`@for` needs `const` on the binding** (T-21) and `@if`/`@else` bodies with more than one node need
  a fragment `<>…</>` (T-20).
- **A nested `@if/@else` chain as the sole body of another `@if` branch crashed `tsrx-tsc`** (T-23):
  flatten the chain and compute the emptiness flags as `track()`ed derivables in the body.
- **`/terms` is a literal route and already registered** — check `src/router.ts` before touching it;
  fixed segments win over `[param]`.

## Open decisions

- **Whether the report dialog links each reason to its rule on this page** (approach 3) — decide,
  then write it into DESIGN under the terms section. If the link is added, `ReportDialog` and this
  page must cite the same ids.
- **Heading hierarchy for the notes** — `h2` under the page title is the obvious reading; record it
  once, since prose pages have no other page to copy from.

## Found while working (carried forward — keep this list growing)

- **`/user/[username]` and `/user/[username]/edit` are done** (T-23): `profileSeedSchema` /
  `profileSchema` / `profileEditSchema` / `followSeedSchema` / `profileTabSchema` /
  `profileCreationTypeSchema` in `schema.ts`, `fixtures/profiles.ts` (7 profiles, 15 follow edges),
  and nine new `repo` methods — `getProfile`, `profileCreations(handle, { type })`, `profilePosts`,
  `followersOf`, `followingOf`, `isFollowing`, `followUser`, `unfollowUser`, `saveProfileEdit`.
  Followers/following figures are read off the graph on every read, never stored.
- **`profileWriteSchema` is onboarding's write and stayed two fields** (T-23): the edit form has its
  own `profileEditSchema`, because a required bio there would have broken `/onboarding`. The NSFW
  pair is not in the profile row at all — `repo.savePreferences` carries it.
- **A rename moves the account** (T-23): `saveProfileEdit` rewrites `author` on the account's content
  rows, moves the follow edges and the claimed-handle set, and the old URL answers not-found with no
  alias. The memory adapter's `VIEWER` constant and the vote/bookmark keys still name the *old*
  handle after a rename — viewer wiring is T-30's.
- **Profile tabs carry no counts** (T-23), deliberately: no cheap derived count exists per tab and the
  spec asks for none; `/bookmarks` counts saved rows for a different reason.
- **A nested `@if/@else` chain as the sole body of another `@if` branch crashed `tsrx-tsc`** (T-23,
  `Cannot read properties of undefined (reading '0')`). Flatten the chain — that is how the profile's
  tab section is written now.
- **`/notifications` is done** (T-22): `repo.markNotificationRead(id)` /
  `markAllNotificationsRead()` / `unreadNotificationCount()`, `lib/state/inbox.ts` for the badge,
  `relativeTime()` + `badgeCount()` (`BADGE_CAP = 9`) in `lib/format.ts`, and the badge drawn in
  **both** nav hosts (tab bar `Alerts`, `lg` rail) with `aria-label="Alerts, N unread"`.
- **Opening a notification is reading** (T-22): the row's link marks read *then* navigates; the
  spec's **Mark read** is a button only where a target has no route (`comment`).
- **A `comment` notification target carries no parent post id** (T-22), so such a row cannot
  deep-link; a `postId` on that target is the fix when the adapter emits one.
- **The inbox fixture count is 6, not 8** (T-22): three unread, one `count: 2`, one `count: 3`. No
  fixture drives a **periodic summary**, so that state is unbuilt, not forgotten.
- **Aggregation is fixture data today** (T-22): the adapter stores already-folded rows and only
  writes `read`.
- **`/persona` exists and is the only unpaged listing** (T-20): one `listPersonas` call, page 1.
- **A keyed `@for` reuses its block** (T-20): a row that renders a flag the same page changes needs
  the flag in the key.
- **`Tabs` takes an optional live `counts`** (T-21): `counts={track}` prints `.tab-count` after the
  label. Do not build a second tab strip.
- **`repo.myVote` / `repo.myReport` / `isBookmarked` exist** — never a page-local flag.
- **The memory adapter loses runtime rows on a hard reload** (T-18): navigation must stay in-app.
- **`Request public again` has no write** (T-18/T-19): drawn disabled.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow
  edges 15.**

## After this

**T-25** (P3 opens) — read `docs/SHIP-PLAN.md` for its exact wording before writing the baton.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

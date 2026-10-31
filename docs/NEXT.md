# Baton — what the next session does

**Ticket: T-23 — `/user/[username]` and `/user/[username]/edit`.**

Specs: `src/specs/pages/user/profile.md` and `src/specs/pages/user/edit.md` (whole files);
`src/specs/onboarding.md` → the handle rules the edit form reuses; `src/specs/systems/nsfw.md`;
`src/specs/luaplot-pages.md` → *Conventions*; `docs/DESIGN.md` → *Catalog* (the listing frame),
*Bookmarks* (the tab strip with counts) and *Notifications* (T-22); `docs/ARCHITECTURE.md` → *Data*
and *Validation*.

Why next: it is the last content page of P2 and the first one that draws **somebody else's page**,
so it is where the app stops assuming the viewer is the author. Its hard part is not layout: **the
shape does not exist yet.** There is no profile entity, no bio, no join date, no follower graph and
no way to list one author's work — `userSchema` is only `{ handle, displayName, isAdmin }` and
`repo` has `currentProfile()` / `saveProfile()` and nothing else user-shaped. Budget the tick for
that data layer first; the page is the easy half.

## Approach

1. **Build the shape before the page.** `profileSchema` (a `strictObject`: `handle`,
   `displayName`, `bio`, `joinedAt` as `isoSchema`, `followers`, `following` as non-negative
   integers) + `profileWriteSchema` extended with `bio` and the two NSFW flags if the preference
   store cannot carry them; types via `z.infer` in `data/types.ts`. Fixtures for the handles that
   already author content (`you`, `ada`, `mira`, `quill`, `bram`, `sable`) — a profile is the one
   place an author finally has a face; do not invent accounts beyond the handles the fixtures use.
2. **The follow graph is adapter state, not a count on a row.** `followUser(handle)` /
   `unfollowUser(handle)` / `isFollowing(handle)` / `followersOf(handle)` / `followingOf(handle)`,
   keyed `follower:followee`, so a count can never disagree with the list it counts — the same rule
   as `bookmarkCounts()` and `unreadNotificationCount()`. Followers/following counts are derived
   from the graph, never stored.
3. **Listing an author's work.** Creations are characters + lorebooks + presets in one grid with a
   **type control row** (All / Characters / Lorebooks / Presets — a filter, never a tab), and posts
   use `PostCard`. That is a union row shape; build it once outside the template (T-21's `cellOf`
   rule) instead of a `Character | Lorebook | Preset` union inside an `@if`.
4. **Four tabs — Creations, Posts, Followers, Following** — in `?tab=`, with `?type=` read on the
   creations tab only, written straight through `history` (`navigate()` remounts and drops the
   rows). `Tabs` takes live `counts` already; do not build a second strip.
5. **The header is the page's identity**: avatar (`Avatar`, initials only), display name, `@handle`,
   bio, the follower/following figures as **plain text**, and one control — **Follow/Unfollow** on
   somebody else's page, **Edit profile** on your own. Signed out, Follow leads to
   `/authentification`. `Request public again` still has no write (T-18/T-19): draw it disabled.
6. **`/user/[username]/edit` is own-account only**: display name, avatar initials, bio, username,
   and the NSFW pair as two real `Toggle`s. No email, no provider, no delete — the spec's absence is
   the rule. `profileWriteSchema` gates; the adapter parses again. A changed username moves the URL
   and leaves no alias.
7. **States**: own profile, another user's, no content per tab (*and an empty type filter reads the
   same way*), not found (`This user doesn't exist.`), loading skeleton, error + Retry.

## Traps

- **`@for` needs `const` on the binding** (T-21): without it `tsrx-tsc` crashes with
  `Cannot read properties of undefined (reading '0')`.
- **A prop expression is evaluated once at the call** (T-22): an inline
  `disabled={busy || count.value === 0}` freezes at mount and a bare `busy` is a truthy object — hand
  `Button` a `track(() => …)` derived.
- **`@if`/`@else` bodies with more than one node need a fragment `<>…</>`** (T-20).
- **A component's root element cannot be styled from a scoped block** (T-19): shared chrome goes in
  `src/styles.css` or inside a wrapper the page owns.
- **`listed()` takes `{ isPublic: boolean }`** (T-21) and a post has no `isPublic`; narrow with
  `!("isPublic" in row)` before asking it.
- **Private and moderated rows are absent, not hidden**: a profile must not leak them through a tab
  count, a paging remainder or a title.
- **No persona appears anywhere on a profile** (`personas.md`: personal, never listed).
- **Navigation stays in-app** (T-18): the memory adapter loses runtime rows on a hard reload.

## Open decisions

- **Whether the profile header carries the counts as figures or in a footer strip** — the spec says
  plain figures, not links; pick the placement at 360 and record it in DESIGN.
- **Whether `?tab=` survives a Follow write** (a write must not remount the page). Record it.
- **What `/user/edit`'s Layout is** — the spec leaves it `_To be specified_`, so the answer is the
  create/edit form pattern from `T-17`/T-19 (kicker, title, fields, sticky footer actions) and it
  must be **written into DESIGN**, exactly as `authentification.md`'s Layout was in T-06.
- **Whether the viewer follows themselves** — Follow is never drawn on your own page; say so in
  DESIGN rather than special-casing the adapter.

## Found while working (carried forward — keep this list growing)

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
- **There is no profile entity yet** (found for T-23): `userSchema` is `{ handle, displayName,
  isAdmin }`, `repo` has only `currentProfile()` / `saveProfile()`, no fixture file holds a bio or a
  join date, and no follow graph exists. T-23 owns all of it.
- **`/persona` exists and is the only unpaged listing** (T-20): one `listPersonas` call, page 1.
- **A keyed `@for` reuses its block** (T-20): a row that renders a flag the same page changes needs
  the flag in the key.
- **`Tabs` takes an optional live `counts`** (T-21): `counts={track}` prints `.tab-count` after the
  label. Do not build a second tab strip.
- **`repo.myVote` / `repo.myReport` / `isBookmarked` exist** — never a page-local flag.
- **The memory adapter loses runtime rows on a hard reload** (T-18): navigation must stay in-app.
- **`Request public again` has no write** (T-18/T-19): drawn disabled.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread).**

## After this

**T-24** `/terms` — static legal copy from the spec, anchors, NSFW/JEV cross-links.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

# Baton — what the next session does

**Ticket: T-25 — the NSFW preference everywhere (P3 opens).**

Spec: `src/specs/systems/nsfw.md` (whole file — *Settings*, *Where it lives*, *Rules*, *States*);
`src/specs/pages/terms.md` → *What the rules apply to* (the one paragraph that promises what this
ticket delivers: with Show off flagged content stays out of listings, with Blur on it is listed but
covered); `src/specs/luaplot-pages.md` → the NSFW preference bullet and *Conventions*; then the
listing pages themselves — `character/catalog.md`, `lorebook/catalog.md`, `preset/catalog.md`,
`post/thread.md`, `user/profile.md`, `bookmarks.md`, `authentification.md`, and one detail page
(`character/detail.md`) for the Show-off route rule. `docs/DESIGN.md` → *Card and grid (T-08)* and
*Terms (T-24)* for what is already settled.

Why next: T-24 said on the record what the preference does, and half of it is already built — the
three catalogs and `/bookmarks` read `lib/state/prefs.ts`, hide flagged rows with Show off, and pass
`blurNsfw` to `CardGrid`. What is missing is the rest of `nsfw.md`: the **signed-out control** (a
single *Show NSFW content* action that leads to `/authentification`, where it is one action and not
the pair), the **Show-off detail route** (the item draws with its chrome and its body withheld
behind the same reveal a blurred item carries — no 404, no notice page), and **a reveal that lasts
one view** (per item, per fetch; never written to the account). Until those exist the terms page is
describing behaviour the app does not have.

## Approach

1. **Audit first, then fill the gaps.** Every surface in *Every listing honours the settings* — the
   three catalogs, `/post/thread`, `/user/[username]` tabs, `/bookmarks`, search — either reads the
   store or it does not; make a table of what each one does today (show-filter, blur, reveal) before
   touching a file. Whatever is already correct stays; T-25 is not a rewrite of four pages.
2. **The reveal is page state, not account state.** One set of revealed ids per listing, cleared on
   refetch and on remount — `nsfw.md` → *A reveal lasts one view*. It must not go through
   `repo.savePreferences`, and nothing about it may survive `navigate()`. If a shared helper is
   needed it belongs in `lib/state/`, not in a page-local boolean per card.
3. **Blur is structural** (`nsfw.md` → *Blur is structural*): the card's header (title) and footer
   (author + ratio) stay legible, the middle — avatar, tagline, tags — is what is covered. A post or
   comment keeps its header and its engagement footer; the body is covered. **The numbers are never
   hidden.**
4. **Signed out is a state with a control, not an absence of one.** The pair in a catalog toolbar
   becomes one *Show NSFW content* control whose activation goes to `/authentification`; that page
   then offers the same single action, because there is no account to hold Blur. `prefs.ts` already
   refuses writes when signed out — the page must not try.
5. **The Show-off detail route**: `getCharacter` etc. still resolve; the page draws the chrome
   (title, author, ratio, actions) and withholds the body behind the reveal. Decide once and record
   it in DESIGN; do not add a notice page, a 404, or an empty render.
6. **Zod is unchanged by this ticket** — the preference pair is already `accountPreferencesSchema`,
   and a reveal is not a shape because it never leaves the page.

## Traps

- **`prefs.ts` is a plain subscribe/notify store**, not reactive: a page mirrors it into its own
  `track()` and subscribes with `onPrefs`; a module-scope `track()` throws.
- **Show off wins over Blur** — the filter runs first, blur only sees what survived.
- **The viewer's own content is not exempt** (`nsfw.md` → *Rules*), including on `/user/[username]`.
- **A keyed `@for` reuses its block** (T-20): a row that renders a reveal the same page changes needs
  the reveal flag in the key, or the card repaints stale.
- **`@if`/`@else` bodies need braces and more than one node needs a fragment** (T-20); a nested
  `@if` chain as the sole body of another branch crashed `tsrx-tsc` (T-23) — flatten and compute a
  derived flag instead.
- **No new dependency**, and no page-local copy of the pair: one answer per account lives in
  `lib/state/prefs.ts`.
- **`/terms` now claims this behaviour** — if a surface ends up not honouring the preference, fix the
  surface, not the terms page.

## Open decisions

- **Where the listing control sits at 360**: the catalogs already draw the pair in their toolbar;
  signed out, one control is a smaller thing than two toggles — decide whether it replaces the pair
  in place or sits beside the filter row, and record it in DESIGN.
- **Whether `/authentification`'s signed-out action writes anything**: spec says the control is a
  single *Show NSFW content* action and the sign-in then follows the ordinary outcome. Decide
  whether that action only navigates, or also carries the intent through onboarding — record either
  way.
- **Reveal affordance wording** — *Reveal* / *Show this item*: pick one and use it on every surface.

## Found while working (carried forward — keep this list growing)

- **`/terms` is done** (T-24): `pages/terms.tsrx`, `TERMS_RULES` + `REPORT_REASON_RULE` in
  `schema.ts`, ids `#copied-content` / `#unmarked-nsfw` / `#illegal-content` plus one per note;
  `ReportDialog`'s reason stop prints *the rule each reason enforces* from that table; onboarding's
  **Finish** now says it is the acceptance and links to `/terms`; `lg` gains a sticky contents rail.
- **A hash in the URL needs a mount jump** (T-24): the shell renders after the browser abandons the
  fragment, so `/terms` runs `effect()` → `scrollIntoView` and every target carries
  `scroll-margin-top: 72px`. Any other page that publishes anchors needs the same.
- **`<a>` and `<button>` do not nest** (T-24): the reason choices are buttons, so the rule links sit
  in their own block under the list instead of inside each choice.
- **`{<Component />}` inside a fragment is a parse error** (T-24): put the element directly in the
  fragment.
- **`effect()` is the only lifecycle hook in this repo** (T-24) — `requestAnimationFrame`/`onMount`
  do not exist in Ripple; the effect runs after the DOM exists.
- **`/user/[username]` and `/user/[username]/edit` are done** (T-23): `profileSeedSchema` /
  `profileSchema` / `profileEditSchema` / `followSeedSchema` / `profileTabSchema` /
  `profileCreationTypeSchema` in `schema.ts`, `fixtures/profiles.ts` (7 profiles, 15 follow edges),
  and nine new `repo` methods — `getProfile`, `profileCreations(handle, { type })`, `profilePosts`,
  `followersOf`, `followingOf`, `isFollowing`, `followUser`, `unfollowUser`, `saveProfileEdit`.
  Followers/following figures are read off the graph on every read, never stored.
- **`profileWriteSchema` is onboarding's write and stayed two fields** (T-23); the NSFW pair is not
  in the profile row at all — `repo.savePreferences` carries it.
- **A rename moves the account** (T-23): the memory adapter's `VIEWER` constant and the
  vote/bookmark keys still name the *old* handle after a rename — viewer wiring is T-30's.
- **`/notifications` is done** (T-22): `repo.markNotificationRead(id)` / `markAllNotificationsRead()`
  / `unreadNotificationCount()`, `lib/state/inbox.ts` for the badge, `relativeTime()` +
  `badgeCount()` (`BADGE_CAP = 9`) in `lib/format.ts`, badge drawn in both nav hosts.
- **The inbox fixture count is 6, not 8** (T-22): three unread, one `count: 2`, one `count: 3`.
- **`/persona` exists and is the only unpaged listing** (T-20): one `listPersonas` call, page 1.
- **`Tabs` takes an optional live `counts`** (T-21): `counts={track}` prints `.tab-count`.
- **`repo.myVote` / `repo.myReport` / `isBookmarked` exist** — never a page-local flag.
- **The memory adapter loses runtime rows on a hard reload** (T-18): navigation must stay in-app.
  Note that most `<a href>` links in this app are *plain* links, so they do a full load — fine for
  `/terms` (static), a real constraint for a listing that holds a reveal in page state.
- **`Request public again` has no write** (T-18/T-19): drawn disabled.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow
  edges 15.**

## After this

**T-26** (`/moderation` queue + `/moderation/[id]`) — read `docs/SHIP-PLAN.md` for its exact wording
before writing the baton; the queue reads the same `report` rows `ReportDialog` writes.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

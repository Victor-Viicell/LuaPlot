# Baton — what the next session does

**Ticket: T-22 — `/notifications`, the quiet inbox.**

Specs: `src/specs/pages/notifications.md` (whole file, including **Badge**);
`src/specs/luaplot-pages.md` → *Conventions* (notifications are deliberately sparse); `docs/DESIGN.md`
→ *Shell* (where the badge goes) and *Catalog* (the listing frame); `docs/ARCHITECTURE.md` → *Data*
(`listNotifications`) and *Validation*.

Why next: it is the last page of P2, and the only listing that is **not** a catalog — no tabs, no
sort, no paging the user drives, and a row whose sentence the adapter already owns. Its hard part is
the opposite of T-21's: T-21 had to draw a card for something that does not exist, this one has to
draw **far fewer rows than there are events**, and the badge has to agree with the list without ever
incrementing per event.

## Approach

1. **Read first, then shape.** `Notification` already carries `kind` (`comment | new-content |
   follow | moderation`), `actor` (a handle), `target { kind, id, label }`, `count`, optional
   `measure` (a moderation row's measure), `read` and `createdAt` — 8 fixtures in `fixtures/social.ts`.
   Nothing new is needed in `schema.ts` unless a write appears; do not add a shape the spec does not
   describe.
2. **The three adapter writes the page needs** (`repo.ts` + `memory.ts`): `markNotificationRead(id)`,
   `markAllNotificationsRead()`, and an `unreadNotificationCount()` for the badge. All three answer
   from the adapter, never from a page-local flag — same rule as `myVote` / `isBookmarked`. The
   fixtures are already aggregated (`count`, newest actor), so **aggregation is fixture data today**:
   say so in PROGRESS rather than pretending the adapter folds events.
3. **The row.** One column, newest first: actor's `Avatar` (initials via `initialsOf`), one sentence,
   time at the end (`relativeTime`/`shortStamp` from `lib/format.ts`), whole row a link. Sentence
   shape per kind, with `count > 1` reading *"Ada and 2 others commented on your post"*
   (`notifications.md` → *Aggregate by target*: newest actor plus a count, never a list of actors). A `moderation` row
   names `measure` and links to the content; it never restates the reasons.
4. **Unread marking** is a left rule + weight, not a dot: a 2px `--color-accent` inset on the row's
   leading edge (the persona card's mark decision, reused). **Mark all read** sits at the top of the
   list, drawn disabled when nothing is unread.
5. **Badge in the shell** (`App.tsrx`): unread **rows**, `9+` above 9, hidden at zero, no animation,
   no toast. It does not clear on mount — reading a row drops it by one. Check whether the tab bar's
   `Alerts` item is the host; the rail on `lg` too.
6. **States**: loading (skeleton rows shaped like the list), empty, error. No no-results state — there
   is no query on this page.

## Traps

- **Do not build a paging control** unless the spec's *Loading* state demands it: the inbox is capped
  by the deferral rule (10 unread, then a summary), not by a **Load more** button. `listNotifications`
  takes `ListOptions`, so it will page at 24 if asked — ask once, page 1, like `/persona`.
- **Nothing notifies on mount.** No toast, no badge increment; opening the inbox clears nothing.
- **A summary row is deferred volume**, not an aggregate: it counts what it holds and sits at the top
  until read. If there is no summary fixture, draw the state only where the data supports it and log
  the gap — do not invent a summary row.
- **`measure` is optional** and only a moderation row has it; a sentence that reads `undefined` is the
  trap. Narrow once outside the template (T-21's `cellOf` pattern: ripple loses a union inside a block).
- **The target label is the sentence's name**, so a row never fetches the item — that is why
  `notificationTargetSchema` carries `label`. Do not add a `getPost` per row.
- **`@if`/`@else` bodies with more than one node need a fragment `<>…</>`** (T-20).
- **`@for` needs `const`** on the binding (T-21): without it `tsrx-tsc` crashes with
  `Cannot read properties of undefined (reading '0')` and prints bogus syntax errors.

## Open decisions

- **Where the badge lives** — the bottom tab bar's `Alerts` item, the `lg` rail, or both — decide at
  360 first, then check the rail, and record it in `docs/DESIGN.md`.
- **Whether an unread row marks itself read on open** or on an explicit control. The spec lists both
  **Mark read** and **Open**; the safe reading is *opening is reading*, with the row's own control for
  the case where the target is gone. Record whichever is chosen.
- **Empty copy** — the spec does not give a sentence; write one line and record it.

## Found while working (carried forward — keep this list growing)

- **`/bookmarks` is done** (T-21): `bookmarkRowSchema` + `listBookmarks` / `removeBookmark` /
  `bookmarkCounts` / `latestBookmarkKind`; the memory `bookmarks` is a `Map<kind:id, savedAt>`;
  **the four `delete*` methods no longer clear bookmark keys**, so a deleted item leaves a dead card
  (`item: null`) that still removes. Seeded: 8 rows, one with no item (a character), newest saved.
- **`Tabs` takes an optional live `counts`** (T-21): `counts={track}` prints `.tab-count` after the
  label. Do not build a second tab strip.
- **A saved card's remove control is a page-owned wrapper** (`.saved-card` in `styles.css`), not a
  `Card` prop (T-21) — recorded in DESIGN.
- **`@for` without `const` crashes the compiler** (T-21): `Cannot read properties of undefined
  (reading '0')` + a wall of `'{' or ';' expected` on the nearest `@{`. Check every `@for` binding.
- **`listed()` takes `{ isPublic: boolean }`** (T-21): a post has no `isPublic`, so narrow with
  `!("isPublic" in row)` before asking it — the union will not narrow by `kind` alone.
- **`/persona` exists and is the only unpaged listing** (T-20): one `listPersonas` call, page 1, no
  Load more, name-only search; `/persona/[id]` has no engagement, report, thread or settings sheet.
- **A persona card is `PersonaCard`, not `Card`** (T-20): avatar, name, tagline, a 2px accent top edge
  plus the word `default` when it holds the mark, and `Set as default` drawn **disabled** (`Default
  persona`) when it already does.
- **`DeleteRow` is the one delete confirmation for personas** (T-20): in-place, shared by detail and
  edit, `.delete-row*` in `styles.css`; detail lands on `/persona` after a delete.
- **`Start a session` from a persona offers only the viewer's own characters** (T-20) — a public
  character by another author is not offered, and `createSession` returns `null` when there is no
  preset to copy.
- **More than 24 personas has no answer yet** (T-20): the collection asks for page 1 only. A
  `listPersonas` with no page cap is the fix when an account can hold more.
- **A keyed `@for` reuses its block, so a prop expression does not re-evaluate** (T-20): a row that
  renders a flag the same page changes needs the flag in the key (`id:default`) or a `Derived` prop.
- **A native `disabled={tracked}` is a type error and `{tracked ? a : b}` always takes `a`** (T-20):
  read `.value`, or hand the `Derived` to `Button`, which reads it.
- **`@if`/`@else` bodies with more than one node need a fragment `<>…</>`** (T-20).
- **A component's root element cannot be styled from a scoped block** (T-19): put the rule in
  `src/styles.css` (that is where `.saved-card`, `.delete-row` and `.persona-card` live) or wrap it.
- **A schema that transforms must accept its own output** (T-18): `lorebookEntryWriteSchema.keywords`
  takes the typed line *or* the split list, because the form parses and then the adapter parses again.
- **A per-row error is a template paragraph, not a `Field.error` prop** (T-18).
- **`track(() => …)` makes a read-only derived** (T-18): build a reassignable list eagerly.
- **`PRESET_MODELS`** (T-19) lives beside `presetSettingsSchema`; a preset's detail shows its settings
  as a `<dl>` after the description, values as saved.
- **`repo.addPreset` / `updatePreset` / `deletePreset` / `forkPreset` exist** (T-19).
- **`personaWriteSchema` + `PERSONA_NAME_REQUIRED` and the four persona adapter methods exist** (T-20).
- **A lorebook authored by the form has `tagline: ""` and no tags**; a **persona's tagline is a real
  field** (T-20) and an empty one draws nothing on the card.
- **The memory adapter loses runtime rows on a hard reload** (T-18): navigation must stay in-app.
- **`Request public again` has no write** (T-18/T-19): drawn disabled.
- **Description and personality are one field** (T-17); a persona follows the same rule *and* carries
  its own tagline.
- **The avatar is initials only** (T-17): no uploader, so an empty control is filled from the name.
- **`Edit session copy` is not built** (T-15); **`Restore` has no version history** (T-15).
- **`repo.createSession(characterId, personaId?)`** carries the persona; **`repo.setSessionPersona`**
  re-attaches one without touching the transcript; **`repo.findSessionForCharacter`** is the
  Continue check.
- **`repo.listAttachableLorebooks()` / `attachableLorebook(id)` exist** (T-17).
- **`repo.myVote` / `repo.myReport` / `isBookmarked` exist** — never a page-local flag.
- **`chatReplySchema` is the one LLM payload shape**; a JEV call adds its own beside it and
  `safeParse`s it. **`repo.appendReply(id, text)`** is the model's write path.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2, bookmarks 8 (one dead), notifications 8.**

## After this

**T-23** `/user/[username]` + `/user/edit` — profile tabs (creations, posts, follows, followers),
account settings incl. the NSFW pair; no email/provider/delete controls.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

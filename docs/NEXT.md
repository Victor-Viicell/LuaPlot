# Baton — what the next session does

**Ticket: T-10B — fork + Start/Continue on the character page.**

Brief: `docs/tickets/T-10B-fork-and-session-control.md` (read it first — it carries the adapter
writes, the copy-rule question and the acceptance list). Spec: `src/specs/pages/character/detail.md`
→ *Actions* (Start a session / Continue / New Session / Fork) and `src/specs/pages/session/detail.md`
→ the participant copies. `docs/DESIGN.md` → *Character detail* is the settled page.

Why next: T-10 shipped the detail page with its settings menu drawn and **New session** disabled,
and with no primary control on the page at all — the accent on this screen has no user until Start/
Continue lands. Every card in the catalog links here, so this is the last thing between a listing
and a conversation.

## Approach

1. Read the T-10B brief, then `src/lib/data/memory.ts` (`findSessionForCharacter`, `vote`,
   `listPersonas`), `src/lib/data/repo.ts`, `src/lib/schema.ts` → `sessionSchema` / `sessionCopySchema`,
   and `src/specs/pages/session/detail.md`.
2. **The primary control goes in the page's action row**, beside Like/Dislike/Bookmark, and it is
   the one `btn-primary` on the screen (`docs/DESIGN.md`: the accent is the one primary action).
   Its label comes from `repo.findSessionForCharacter(characterId, viewer)` — `null` → *Start a
   session*, a row → *Continue*, and Continue opens that session's route.
3. **`forkCharacter(id)`** — copies the definition as `character/create.md` holds it, keeps
   `inSessionName`, carries `lorebookIds` as **references**, and drops an attachment the forker
   cannot see (a private lorebook by someone else). New id from the `CHARACTER` bucket, `author =
   VIEWER`, engagement zeroed, then navigate to the new detail route.
4. **`createSession(characterId)`** — write it to T-15's copy rule, not to a local guess: one
   session per character per user (`findSessionForCharacter` is the gate), participants are copies
   (character, every attached lorebook, the default preset), the user's side reads `User` when no
   persona is pinned, and publishing a cut is not in this ticket.
5. Wire the settings menu's **New session** entry to `createSession`; delete its `disabled` twin
   the moment the write exists.
6. Keep the parity rules T-10 established: a `track()` per drawn value (never a nullable entity in
   the template), a 44px target per control, the four-cell counts strip unchanged, the veil and the
   lorebook list untouched.

## Traps

- **A prop expression is evaluated once.** The new control's label and `disabled` must be live
  (a `track(...)`, or a `Derived` handed to `Button.disabled`). `disabled={!derived}` is always
  false — hand over the derived.
- **`memory.ts` owns one-vote-per-viewer and must own one-session-per-character too.** Never scan
  the sessions collection from the page; ask `findSessionForCharacter`.
- **A fork is a new item**: it must not carry the original's engagement, bookmarks or comments.
- **The forker's own private lorebooks may be attached; someone else's private ones may not.** The
  drop happens in the adapter, not the page.
- **`getCharacter` answers any row by id** and the page owns the private split, so a fork write must
  refuse another author's private row — otherwise fork becomes a way to read what moderation hid.
- **Nothing in a component body that can be inline.** A `const` (or a `track()`) declared ahead of an
  `@if`/`@for` silently rendered *nothing* in `CardGrid` under ripple 0.4.7.
- **A same-specificity media override in a scoped `<style>` does not win** — scope it with a
  descendant selector, as `.controls-filter .filter-note` does in the catalog page.
- **`@else {` with two nodes needs a fragment** `<>…</>`, or the compile fails with "A code block
  renders a single node".
- **No self-vote exemption** and **both raw counts and the percentage stay** on this page: settled in
  T-10, do not "simplify" them.
- Prove the layout at 360×740 first — the action row already carries three controls at 44px, so a
  fourth must wrap rather than shrink — then 640/900/1200 with `Emulation.setDeviceMetricsOverride`.

## Open decisions

- **Where Continue lands.** The session route `/session/[session.id]` exists and is a placeholder
  (T-15). If `createSession` can produce a row but the session page cannot draw it, Continue may
  still navigate — say so in the baton rather than shipping a button that goes nowhere silently.
- **Four controls at 360**: keep one wrapping row, or move the primary control above the counts
  strip. Pick, measure, record in `DESIGN.md`.
- **What fork does on a private row**: hide it, or draw it disabled. The trap above decides the
  write; this decides the control.

## Found while working (carried forward — keep this list growing)

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
- **The settings menu's New session and Report entries are drawn and `disabled`** (T-10). T-10B
  wires the first, T-12 the second — do not leave a disabled entry behind once its target exists.
- **A `const` (or `track()`) in a component body ahead of `@if`/`@for` rendered nothing** under
  ripple 0.4.7 — the whole branch vanished, no error. `CardGrid` works only because its props are
  read inline. Found in T-09.
- **A page's scoped `<style>` cannot touch a primitive's elements.** `.toolbar .field`,
  `.prefs .toggle` and `.pager .btn` matched nothing — a real phone rendered a 26px search box and a
  two-line `Top rated`. Wrap the primitive in a page-owned element and place that. Found in T-09,
  fixed the same day.
- **An `auto` grid column sized by a long caption starves its neighbour.** The "only filter" sentence
  took 331px of a 592px row and left the search field 26px; the caption is gone.
- **A prop holding an array or a flag is frozen at the call.** `CardGrid.items`, `CardGrid.blurNsfw`
  and `Card.blur` accept `Derived<…>` for exactly that reason; `Toggle.disabled` is still a plain
  boolean.
- **`@empty` does not parse in ripple 0.4.7** although the skill doc shows it (`TS1144`/`TS1146` at
  the token). Write the explicit `@if (…length === 0) … @else` branch.
- **A gallery stage cannot prove a viewport media query.** Any breakpoint proof must resize the
  window; CDP `Emulation.setDeviceMetricsOverride` works and is how T-09 measured 1/2/3/4 columns and
  T-10 measured the 360/1200 detail layout.
- **`/dev/data` passes `nsfw={character.nsfw}` only**, so with T-09's split it draws crisp — it needs
  `blur` to show a covered card. Its counts moved with T-10's fixtures (28 characters, 5 reports).
- **Onboarding's uniqueness check sits inside `persistDraft`, which returns early when the display
  name is empty.** A handle-only visitor never gets `Username taken` and `Finish` stays disabled with
  no explanation. Not fixed.
- **Zod costs +26.4 KB gzip / +91 KB raw on the boot chunk** (router imports `isHandle`). `zod/mini`
  or a lazy router import is the lever if a bundle budget is named.
- **`z.uuid()` is stricter than the router's `[0-9a-f-]{36}`.** They agree on every real id today.
- **A new fixture id bucket must go through `ids.ts`.** Hand-written ids are the drift the schema
  check catches at load.
- **`repo.saveProfile` + `session.setAccount` is the pair for any account write**; `savePreferences`
  is its sibling for the NSFW two.
- **`src/specs/components/` has only `comment-thread.md` and `report.md`** — the card has no spec of
  its own, so `luaplot-pages.md` §Conventions plus `DESIGN.md` are the law for it.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. T-30 deletes both.
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
- **`Card` has no post branch.** A post has a body and no `name`/`tagline`; keep it out of `Card`
  until T-13.
- **Characters are 28 now (27 public); lorebooks 6, presets 5, personas 3, posts 12, reports 5.** A
  listing needs two pages of *public* rows to prove `Load more`; a private fixture does not count.
- **`Select` and `TagPicker` exist now** (`src/components/`, styled in `styles.css`): a native
  `<select>` in the app's chrome, and the multi-select tag field the catalog uses. Any filter or
  enumeration a later page needs should reuse them rather than grow a segmented row or a custom
  dropdown — the catalog's segmented sort was replaced on the owner's call for exactly that reason.
- **Tags are authored, and the characters carry ten of them** (`artisan, authority, creature, debt,
  family, ghost, harbor, ritual, sea, shopkeep`). `repo.listTags(kind)` is the vocabulary a filter
  offers; lorebooks and presets still have none, so their filters would open empty until their
  fixtures are tagged.

## After this

**T-11** mounts the comment thread on `/character/[id]` (`src/specs/components/comment-thread.md`).
Then T-12's report dialog replaces the menu's disabled **Report** entry.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

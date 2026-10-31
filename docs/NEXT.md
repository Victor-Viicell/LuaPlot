# Baton — what the next session does

**Ticket: T-21 — `/bookmarks`, four tabs over saved items.**

Specs: `src/specs/pages/bookmarks.md` (whole file); `src/specs/luaplot-pages.md` → *Conventions*
(query-string state) and *Engagement is metadata on cards*; `docs/ARCHITECTURE.md` → *Data*
(listings, `toggleBookmark`, `isBookmarked`) and *Validation*; `docs/DESIGN.md` → *Catalog* (the
listing frame, the six states, the NSFW pair) and *Persona collection and detail (T-20)* — the last
ticket that built a toolbar, and the one that added the shared `DeleteRow`.

Why next: it is the last page family in P2 before the account surfaces, and it is the first page that
has to draw a card for an item that **no longer exists** — the spec's *A bookmark outlives the item*
rule. It also has no adapter behind it yet: `repo` can answer *is this one bookmarked* and toggle it,
but it cannot list what is saved, when it was saved, or what used to be there.

## Approach

1. **Schema first, in `src/lib/schema.ts`.** A saved row is `{ kind, id, savedAt }` plus the item when
   it still resolves; the dead case is a row whose item is gone, so the listing cannot be `AuthoredItem[]`
   (a post is not one either). One `bookmarkRowSchema` per tab: `kind` (`ItemKind | "post"`), `id`
   (uuid), `savedAt` (iso), `item` (the entity or `null`), and derive the type in `types.ts` with
   `z.infer`. `savedAt` is the *sort* — *newest saved first is the default* — so today's
   `Set<string>` in the memory adapter becomes a `Map<string, string>` (`key → savedAt`), and
   `toggleBookmark` stamps `nowIso()` on save and drops the key on remove.
2. **Adapter:** `listBookmarks(kind, { query, sort, page })` answering `Listing<BookmarkRow>`, with
   `sort` = `recent` (newest saved) | `oldest` | `name` (title A–Z). Search must be *the same matching
   the type's catalog uses*, restricted to saved rows — so reuse each listing's own fields, not a
   fourth matcher. Posts answer through the thread card, so their listing matches `body`.
3. **A dead card is a `bookmarkRow` with `item: null`**, drawn as the type's not-exist sentence in the
   title slot (`This character doesn't exist.`), non-linking, still carrying **Remove bookmark**. The
   memory adapter must be able to *produce* one: deleting a post or dropping a row through moderation
   must leave the bookmark key behind, so `deletePost` / `deleteCharacter` / `deleteLorebook` /
   `deletePreset` must stop clearing bookmarks, and the fixture set needs at least one saved-then-gone
   pair (a seeded orphan key is the cheap way; say so in PROGRESS if you seed it).
4. **Tabs.** Four tabs with counts, in the query string (`?type=`), defaulting to the type holding the
   **most recently saved** item. `components/Tabs.tsrx` already exists — read it before inventing one.
   Counts come from the adapter, never from the visible slice.
5. **The card.** Characters/lorebooks/presets use `Card` + `CardGrid` unchanged; posts use `PostCard`.
   Every card needs a **Remove bookmark** control *on the card* (the spec's *so unbookmarking never
   requires opening the item*), so this ticket either adds a slot/prop to `Card` (a footer action it
   does not have) or wraps each cell in the page — decide, and record it in `docs/DESIGN.md`.
6. **State lives in the URL**: `?type=character&q=&sort=recent&tag=`; `tag` is the reserved `All`-only
   filter, drawn as a disabled `Select` or omitted with a note (the catalogues wait on the same
   undecided taxonomy). NSFW is *not* in the URL: it is the account's pair.

## Traps

- **`repo.toggleBookmark` refuses a missing row** (`sharedRowFor`), so *Remove bookmark* on a **dead**
  card cannot go through it — the adapter needs a remove that works on the key alone, or
  `toggleBookmark` has to accept a saved-but-gone id. A dead bookmark that cannot be cleared is the
  one thing this page exists to avoid.
- **A post is not an `AuthoredItem`** and has no `tagline`, `author`-only card, or ratio. Do not widen
  `Card`'s union to make posts fit; `PostCard` exists.
- **Counts must survive the NSFW filter**: the tab count is *saved rows*, not *visible rows* — with
  Show off a tab can read `3` and draw `1`, which is correct and not a bug.
- **Bookmarks are silent** (`bookmarks.md` → *Purpose*): no toast that promises a notification, no
  notification write, nothing on a profile.
- **The published cut and the saved post are different objects** — removing a bookmark never touches
  the item, and deleting the item never removes the bookmark.
- **`@if`/`@else` bodies with more than one node need a fragment `<>…</>`** (found in T-20): a toolbar
  div followed by a phase `@if` in the same `@else` is two nodes and fails to compile.
- **A native `disabled={tracked}` is a type error, and `{tracked ? … : …}` always takes the first
  branch** (T-20): read `.value` at the call site or hand a `Derived` to `Button`, which already reads.
- **A component's root element cannot be styled**, and a page's scoped `<style>` cannot reach into a
  primitive — wrap (`.delete-slot`, `.layout`), never write a rule on the primitive's own class.
- **Paging**: this is a real catalog per tab, so it *does* take **Load more** and the 24-row page —
  unlike `/persona`, which is deliberately unpaged.

## Open decisions

- **Where the remove control sits on a `Card`** — a footer action beside the author, a corner control,
  or a page-owned wrapper per cell. Decide at 360, with a covered (blurred) card in view: the control
  must stay crisp, exactly as `Reveal` does.
- **How the seeded dead card is produced** — a fixture key with no row, or a fixture row that a
  `--seed` step deletes. Whichever, the preview must show one dead card without a manual delete.
- **The default tab when nothing is saved at all** — Characters (the spec's list order) is the safe
  reading; record it.

## Found while working (carried forward — keep this list growing)

- **`/persona` exists and is the only unpaged listing** (T-20): one `listPersonas` call, page 1, no
  Load more, name-only search; `/persona/[id]` has no engagement, report, thread or settings sheet.
- **A persona card is `PersonaCard`, not `Card`** (T-20): avatar, name, tagline, a 2px accent top edge
  plus the word `default` when it holds the mark, and `Set as default` drawn **disabled** (`Default
  persona`) when it already does.
- **`DeleteRow` is the one delete confirmation for personas** (T-20): in-place, shared by detail and
  edit, `.delete-row*` in `styles.css`; detail lands on `/persona` after a delete.
- **`Start a session` from a persona offers only the viewer's own characters** (T-20) — a public
  character by another author is not offered, and `createSession` returns `null` when there is no
  preset to copy. If the product wants any startable character, that is a picker change plus a spec
  reading, not a page patch.
- **More than 24 personas has no answer yet** (T-20): the collection asks for page 1 only. A `listPersonas`
  with no page cap (or a `page: 0` meaning unbounded) is the fix when an account can hold more.
- **A keyed `@for` reuses its block, so a prop expression does not re-evaluate** (T-20): the persona
  card kept the `isDefault` it was first drawn with and *Set as default* wrote through the adapter but
  repainted nothing. The collection's key is now `id:default` / `id:plain`, which remounts the one
  stateless card. Any list whose row **renders a flag that the same page changes** needs this or a
  `Derived` prop.
- **A native `disabled={tracked}` is a type error and `{tracked ? a : b}` always takes `a`** (T-20):
  read `.value`, or hand the `Derived` to `Button`, which reads it.
- **`@if`/`@else` bodies with more than one node need a fragment `<>…</>`** (T-20): a toolbar div plus
  a phase `@if` in one `@else` fails to compile (`A code block renders a single node`).
- **A component's root element cannot be styled** (T-19): Ripple 0.4.7 adds `tsrx-<hash>` only to the
  elements it emits below the root, so `.character-form` / `.lorebook-form` / `.preset-form` was
  dropped by the compiler; each form now puts its grid on a child `.layout`.
- **A schema that transforms must accept its own output** (T-18): `lorebookEntryWriteSchema.keywords`
  takes the typed line *or* the split list, because the form parses and then the adapter parses again.
- **A per-row error is a template paragraph, not a `Field.error` prop** (T-18).
- **`track(() => …)` makes a read-only derived** (T-18): build a reassignable list eagerly.
- **`PRESET_MODELS`** (T-19) lives beside `presetSettingsSchema`; a preset's detail shows its settings
  as a `<dl>` after the description, values as saved.
- **`repo.addPreset` / `updatePreset` / `deletePreset` / `forkPreset` exist** (T-19).
- **`personaWriteSchema` + `PERSONA_NAME_REQUIRED` and the four persona adapter methods exist** (T-20):
  `addPersona` (first one takes the mark), `updatePersona`, `deletePersona` (mark moves to the most
  recently created remaining row), `setDefaultPersona` (one write). `listPersonas` searches the name
  only.
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
  comments 22, sessions 2.** Bookmarks are a seeded `Set` today, so the first fixture pass for T-21
  must decide how many save rows exist.

## After this

**T-22** `/notifications` — aggregated rows (same kind + same target fold), read state.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

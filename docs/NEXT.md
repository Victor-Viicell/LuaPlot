# Baton — what the next session does

**Ticket: T-18 — `/lorebook/*`, all four routes.**

Specs: `src/specs/pages/lorebook/create.md`, `edit.md`, `detail.md`, `catalog.md` (whole files);
`src/specs/luaplot-pages.md` → *Conventions*; `docs/ARCHITECTURE.md` → *Validation*; `docs/DESIGN.md` →
*Character create and edit (T-17)* (the form convention this ticket copies) and *Character detail*
(the detail page it inherits).

Why next: T-17 landed the first authored write (`characterWriteSchema`, `repo.addCharacter`, and the
one-form-two-hosts pattern). T-18 is the same write for the second authored type, plus the app's first
**entries** editor — a list of rows inside a row — and the first detail page that draws a long list.
T-19 (presets) and T-20 (personas) copy whatever this ticket settles about row editing, and the
character form's picker has only one real lorebook to offer until this exists.

## Approach

1. **Schema first, in `src/lib/schema.ts`.** `lorebookWriteSchema` beside `characterWriteSchema`:
   `name` (the same collapse, with its own `LOREBOOK_NAME_REQUIRED`), `description`, `avatar`
   (`{initials}`, filled from the name when empty — reuse the T-17 transform, do not re-implement
   it), `nsfw`, `entries`. Entries already have a stored shape (`lorebookEntrySchema`: `id`,
   `keywords` min 1, `content` min 1); add an **entry write** schema for the form's input (keywords
   as typed text) and a transform into the stored entry — never a second copy of the row shape, and
   never a hand type beside either.
   `repo.addLorebook` / `updateLorebook` / `deleteLorebook` mirror `addCharacter` /
   `updateCharacter` / `deleteCharacter` one for one: the adapter owns id, author, `verified: false`,
   the clock, `tagline: ""`, no tags and zero engagement; update and delete are **author only** and
   answer `null` / `false`.
2. **`components/LorebookForm.tsrx`, two hosts**, exactly like `CharacterForm` (`lorebook: null` is
   create, a row is edit). `/lorebook/create` and `/lorebook/[lorebook.id]/edit` mount it; the edit
   page adds Delete in its own row at the **foot**, *set apart from the save controls so the two are
   never adjacent* (`edit.md` → Layout), confirmed in place as T-17 did.
3. **The entries editor is the new part.** One block per entry in one `<ul>`: keywords as one
   `Field`, content as a `textarea`, each block carrying its own **Remove**; **Add entry** appends an
   empty block below the list. *Reorder* is two 44px buttons per row (up / down) at 360, not a drag
   handle — a phone drag target is 20px. The entry `id` is the author's short label (`sa-1`), **not**
   a UUID: number it in the adapter at write time so the form cannot invent a collision.
4. **`/lorebook/[lorebook.id]` inherits the character detail page's decisions** (`docs/DESIGN.md` →
   *Character detail*): counts before the definition on a phone, settings `Sheet` with Fork / Bookmark
   / Report / Edit, the owner's moderation notice, two refusal states. Its differences: the avatar is
   the **square cover** at the top of the content column, and the **entry list** renders in the
   author's order with its keywords visible, no collapse and no paging (`detail.md` → Data/States).
5. **Mobile first**: 360×740 one column; the entry list *is* the page on a phone; `md` may put the
   metadata beside the first entry block; `lg` inherits the sidebar shell. Nothing stretched.

## Traps

- **`Request public again`** (`detail.md` → Actions, owner while private) has no write behind it.
  Draw it `disabled` as T-10 drew Report before T-12, or file it — never wire it to a fake success.
- **A lorebook has no tagline field** — the card's `tagline` stays `""`, as T-17 left characters.
- **`deleteLorebook` must not strip its id from every character's `lorebookIds`**: the spec keeps
  those attachments and shows them as *unavailable*. The cascade is the lorebook's own entries and
  thread.
- **The entries list will be long** — no `max-height`, no inner scroller: it scrolls with the page.
- **Never `split(",")` / `trim()` a keyword list in the page** and call it validation: the write
  schema owns it, so the inline error, the gate and the adapter cannot disagree.
- **`@if` with multiple children needs a fragment**; `@for` needs `const`; `@empty` does not parse in
  ripple 0.4.7 — an empty list is a sibling sentence, not a row.
- **A page's scoped `<style>` cannot touch a primitive's elements** — wrap, never reach in.
- **Cancel targets differ**: create → catalog, edit → detail (`edit.md` → Actions).
- **A prop expression is evaluated once** — pass the tracked box into the entries list, never
  `entries.value`.

## Open decisions

- **Keywords input**: one comma-separated field per entry, or the existing `TagPicker` chip list.
  Decide at 360 first and record it in `docs/DESIGN.md`.
- **Add entry appends or prepends** — append, and say so in `DESIGN.md`.
- **Does an entries block collapse in the *form*** when there are many? Detail may not collapse it;
  the form is a different page, so decide and record.

## Found while working (carried forward — keep this list growing)

- **Description and personality are one field** (T-17): `characterWriteSchema.description` is the one
  stored text, because `create.md` names one bullet and `characterSchema` carries one field. Splitting
  them is a schema change across the row, 28 fixtures, `characterCopySchema` and the detail page.
- **A character authored by the form has `tagline: ""` and no tags** (T-17): neither is a field in
  `create.md`, so its card shows no tagline.
- **The avatar is initials only** (T-17): there is no uploader, so an empty control is filled from the
  name by the schema. An image control needs storage, not a form.
- **`Edit session copy` is not built** (T-15): it needs `sessionCopyWriteSchema` in `schema.ts` and a
  session-scoped editor form; the copy rows draw state + link actions only.
- **`Restore` has no version history** (T-15): `restoreCopy` re-reads the original as it stands and
  keeps the copy's `version`; a stored snapshot is the fix and it is a schema change.
- **`components/PostComposer.tsrx` serves two hosts** — `/post/create` (picker) and the session's
  Publish-a-cut sheet (`cut` locked). A third host passes `cut` or not; never a second form.
- **`components/CharacterForm.tsrx` serves create + edit** — a third host passes `character` or not.
- **The publish-a-cut sheet is two steps** because a prop expression is evaluated once; a composer
  mounted beside live range selects keeps the range it was born with. *Change the range* is the one
  path that loses a draft.
- **`repo.createSession(characterId, personaId?)`** carries the current persona through **New
  session**; another account's persona is ignored, not attached.
- **A session's two-column layout is `lg`, not `md`** (T-15): at 900 the outlet is 656 and a 300px
  aside leaves a 324px reading column.
- **Load more is unverified on the thread**: 12 fixtures against a 24-row page. Growing `POSTS` past
  25 is the cheapest way to prove the append path.
- **`postWriteSchema` / `characterWriteSchema` + their `*_REQUIRED` constants are the pattern**: one
  schema, one normalisation, parsed by the form and again by the adapter.
- **`repo.listAttachableLorebooks()` / `repo.attachableLorebook(id)` exist** (T-17): the picker and
  the by-ID control resolve through the adapter, never through a page comparing author handles. The
  picker is *own + bookmarked*; the by-ID rule is *own + any public* — both are the spec's.
- **A character's attachments degrade, never vanish** (T-17): an id already on the row survives a
  re-save even when it no longer resolves, so saving cannot erase what the author never removed.
- **A cut with no messages is refused** (`postAttachmentSchema.messages.min(1)`).
- **`repo.listMySessions()` exists** (newest `updatedAt` first).
- **A held report opens no case** (T-12): `/moderation` has no view of held reports.
- **`reportPartSchema` has no attachment value**, so a post's image can only be reported as text.
- **`status: "removed"` has no fixture**; the removed-by-moderation placeholder is unreachable.
- **Comment attachments are not drawn** — `commentSchema` has no attachment field until an uploader.
- **`sessionSchema.personaId` is optional** — an unattributed session reads `User`.
- **Rows created at runtime take `crypto.randomUUID()`**; fixture ids come from `fixtures/ids.ts`.
- **`repo.myVote` / `repo.myReport` / `isBookmarked`** exist — never a page-local flag.
- **A page's scoped `<style>` cannot touch a primitive's elements** — use a page-owned wrapper.
- **A base rule declared AFTER a `@media` block wins at every width.**
- **Zod costs +26.4 KB gzip on the boot chunk**; `zod/mini` is the lever if a budget is named.
- **T-16's seam is proven only on its mock and its failure branch**: `VITE_CHAT_ENDPOINT` is unset, so
  no real model has answered yet. A deployed `supabase/functions/chat` is its own ticket.
- **`chatReplySchema` is the one LLM payload shape** — a JEV call must add its own schema beside it,
  and JEV payloads are `safeParse`d like this one. Never a `response.json()` read straight into code.
- **`repo.appendReply(id, text)` exists** — the model's write path; do not add a second one.
- **The `Preview mode` chip lives in the session's composer meta line**, because `/session/…` hides
  the shell's top bar. Any other surface that shows a mock answer needs its own marker.
- **The T-17 form is proven at 360 only** — the live build was driven in Chromium at 360×740 (save →
  detail, edit preload, bogus-ID error, in-place delete → catalog), but the 900/1200 layout and the
  *unavailable* attachment row were not measured.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.**

## After this

**T-19** `/preset/*` (catalog, create, detail, edit) — the same four routes with a generation-settings
form instead of an entries list, copying T-18's form convention.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

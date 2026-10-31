# Baton — what the next session does

**Ticket: T-19 — `/preset/*`, all four routes.**

Specs: `src/specs/pages/preset/create.md`, `edit.md`, `detail.md`, `catalog.md` (whole files);
`src/specs/luaplot-pages.md` → *Conventions*; `docs/ARCHITECTURE.md` → *Validation*;
`docs/DESIGN.md` → *Character create and edit (T-17)* and *Lorebook create and edit (T-18)* (the form
convention this ticket copies) and *Character detail* (the detail page it inherits).

Why next: T-17 landed the first authored write, T-18 the second and the first row list. T-19 is the
same four routes a third time, with a **generation-settings** block instead of an entries list — the
last authored type, after which every card in every catalog points at a real page. It should be the
cheapest of the three: copy `LorebookForm`'s frame, drop the entries editor, and carry
`presetSettingsSchema`'s one named field (`model`).

## Approach

1. **Schema first, in `src/lib/schema.ts`.** `presetWriteSchema` beside `lorebookWriteSchema`: `name`
   (same collapse, its own `PRESET_NAME_REQUIRED`), `description`, `avatar` (`{initials}`, filled from
   the name — reuse `withInitials`), `nsfw`, `settings` (`presetSettingsSchema`: `model` min 1 and
   **nothing else** — the provider is the app's, never a field). Read `preset/create.md` for the model
   control before choosing a `Field` or a `Select`.
   `repo.addPreset` / `updatePreset` / `deletePreset` / `forkPreset` mirror the lorebook four one for
   one — the adapter owns id, author, `verified: false`, the clock, `tagline: ""`, no tags and zero
   engagement; update and delete are **author only** and answer `null` / `false`.
2. **`components/PresetForm.tsrx`, two hosts** (`preset: null` is create). It is `LorebookForm` minus
   the entries section: one column at 360, `lg` two columns, Save/Cancel at the foot, and the model
   control its own section because it is the thing a preset exists to carry.
3. **Delete is the same foot row** as T-18's, set apart from Save/Cancel. Read `preset/edit.md`: if it
   does not name a cascade, the sentence says only that deletion is final — a preset has no entries,
   and a session keeps the copy it started from.
4. **`/preset/[preset.id]` inherits the character/lorebook detail page**: square cover, counts before
   the definition on a phone, settings `Sheet` with Fork / Bookmark / Report / Edit, the owner's
   moderation notice, two refusal states, and `Request public again` drawn **disabled** while no write
   exists. Its difference: a **generation settings** block where the lorebook draws its entries — a
   definition list (`model`), not prose.
5. **`/preset/catalog`** is `lorebook-catalog.tsrx` with `listPresets` and `listTags("preset")`.
   Check `preset/catalog.md` for anything a card adds; if it adds nothing, copy T-18's subtraction.

## Traps

- **A preset has no tagline and no entries** — `tagline` stays `""`, and detail must not grow an empty
  heading.
- **`settings.model` is the only named field**; do not invent temperature/tokens. If `create.md` names
  more, they go in `presetSettingsSchema` — and the 5 preset fixtures must still parse.
- **`Request public again`** has no write (as with the lorebook): disabled, never a fake success.
- **A block's validation error must be a template-owned paragraph**, not a `Field.error` prop — a prop
  expression is evaluated once and a keyed `@for` reuses its blocks (T-18).
- **A schema that transforms must accept its own output** (T-18): the adapter parses the write again,
  so a write whose output is not a valid input fails on the *second* parse and the form reports
  *Save failed* with no inline error at all.
- **`track(() => …)` is a read-only derived** (T-18): a list that will be reassigned must be built
  eagerly and passed as a value.
- **`@if` with multiple children needs a fragment**; `@for` needs `const`; `@empty` does not parse in
  ripple 0.4.7 — an empty list is a sibling sentence.
- **A page's scoped `<style>` cannot touch a primitive's elements** — wrap, never reach in.
- **Cancel targets differ**: create → catalog, edit → detail.
- **A lorebook or preset id is a UUID**, so a hard reload of a runtime-created row loses it (`memory`
  resets); navigation must stay in-app to test a created row.

## Open decisions

- **Model control**: free text with a hint, or a `Select` of the providers the app knows. Decide at
  360 first and record it in `docs/DESIGN.md`.
- **Does detail show the settings before or after the description?** The counts/definition order is
  inherited from character detail; the settings are the preset's payload, so argue for *after* the
  description and before the comments.
- **What the edit page's delete sentence can promise** — read `preset/edit.md` before writing it.

## Found while working (carried forward — keep this list growing)

- **A schema that transforms must accept its own output** (T-18): `lorebookEntryWriteSchema.keywords`
  takes the typed line *or* the split list, because the form parses and then the adapter parses again.
  A transform whose output is not a valid input surfaces as *Save failed* with no inline error.
- **A per-row error is a template paragraph, not a `Field.error` prop** (T-18): props are evaluated
  once and a keyed `@for` reuses its blocks, so the line would never appear.
- **`track(() => …)` makes a read-only derived** (T-18): build a reassignable list eagerly.
- **A lorebook authored by the form has `tagline: ""` and no tags**, and its entry ids are the
  adapter's `entry-1…n`, renumbered on every save and fork.
- **The memory adapter loses runtime rows on a hard reload** (T-18): a created row survives only SPA
  navigation, so a "paste this id" check has to happen in-app.
- **`Request public again` has no write** (T-18): drawn disabled on lorebook detail.
- **Description and personality are one field** (T-17): `characterWriteSchema.description` is the one
  stored text, because `create.md` names one bullet and `characterSchema` carries one field.
- **The avatar is initials only** (T-17): there is no uploader, so an empty control is filled from the
  name by the schema. An image control needs storage, not a form.
- **`Edit session copy` is not built** (T-15): it needs `sessionCopyWriteSchema` in `schema.ts` and a
  session-scoped editor form; the copy rows draw state + link actions only.
- **`Restore` has no version history** (T-15): a stored snapshot is the fix and it is a schema change.
- **`components/PostComposer.tsrx` serves two hosts** — `/post/create` (picker) and the session's
  Publish-a-cut sheet (`cut` locked). A third host passes `cut` or not; never a second form.
- **`components/CharacterForm.tsrx` serves create + edit**; so does `LorebookForm` (T-18), and
  `PresetForm` (T-19) will.
- **The publish-a-cut sheet is two steps** because a prop expression is evaluated once; *Change the
  range* is the one path that loses a draft.
- **`repo.createSession(characterId, personaId?)`** carries the current persona through **New
  session**; another account's persona is ignored, not attached.
- **A session's two-column layout is `lg`, not `md`** (T-15): at 900 the outlet is 656 and a 300px
  aside leaves a 324px reading column.
- **Load more is unverified on the thread**: 12 fixtures against a 24-row page. Growing `POSTS` past
  25 is the cheapest way to prove the append path.
- **`postWriteSchema` / `characterWriteSchema` / `lorebookWriteSchema` + their `*_REQUIRED` constants
  are the pattern**: one schema, one normalisation, parsed by the form and again by the adapter.
- **`repo.listAttachableLorebooks()` / `repo.attachableLorebook(id)` exist** (T-17): the picker is
  *own + bookmarked*, the by-ID rule is *own + any public* — both are the spec's.
- **A character's attachments degrade, never vanish** (T-17), and **`deleteLorebook` must not strip
  its id from every character's `lorebookIds`** (T-18): the attachment survives and reads as
  *unavailable*.
- **A cut with no messages is refused** (`postAttachmentSchema.messages.min(1)`).
- **`repo.listMySessions()` exists** (newest `updatedAt` first).
- **A held report opens no case** (T-12): `/moderation` has no view of held reports.
- **`reportPartSchema` has no attachment value**, so a post's image can only be reported as text.
- **`status: "removed"` has no fixture**; the removed-by-moderation placeholder is unreachable.
- **Comment attachments are not drawn** — `commentSchema` has no attachment field until an uploader.
- **`sessionSchema.personaId` is optional** — an unattributed session reads `User`.
- **Rows created at runtime take `crypto.randomUUID()`**; fixture ids come from `fixtures/ids.ts`.
- **`repo.myVote` / `repo.myReport` / `isBookmarked`** exist — never a page-local flag.
- **A base rule declared AFTER a `@media` block wins at every width.**
- **Zod costs +26.4 KB gzip on the boot chunk**; `zod/mini` is the lever if a budget is named.
- **T-16's seam is proven only on its mock and its failure branch**: `VITE_CHAT_ENDPOINT` is unset, so
  no real model has answered yet. A deployed `supabase/functions/chat` is its own ticket.
- **`chatReplySchema` is the one LLM payload shape** — a JEV call must add its own schema beside it,
  and JEV payloads are `safeParse`d like this one.
- **`repo.appendReply(id, text)` exists** — the model's write path; do not add a second one.
- **The `Preview mode` chip lives in the session's composer meta line**, because `/session/…` hides
  the shell's top bar. Any other surface that shows a mock answer needs its own marker.
- **T-17's form is proven at 360 only**; T-18 measured the lorebook pages at 360 and 1200 but not 640.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.**

## After this

**T-20** `/persona` collection + create/edit/detail — default-persona rules, delete moves the mark,
never shared, flagged or counted.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

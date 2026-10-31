# Baton — what the next session does

**Ticket: T-20 — `/persona`, all four routes.**

Specs: `src/specs/pages/persona/collection.md`, `create.md`, `detail.md`, `edit.md` (whole files);
`src/specs/luaplot-pages.md` → *Conventions* (personas: personal, never shared, never moderated,
never counted); `docs/ARCHITECTURE.md` → *Data* (personas are per-account) and *Validation*;
`docs/DESIGN.md` → *Preset create and edit (T-19)* — the form convention this ticket is the last to
copy — and the **root element cannot be styled** bullet, which applies to every `.tsrx` you write.

Why next: T-17, T-18 and T-19 built the three authored types and every catalog card now points at a
real page. Personas are the fourth collection and the **only** one that is not authored content: the
spec calls it `a smaller, distinct model rather than a character with sharing removed`, so this
ticket is where the copy-the-last-form habit has to stop and the differences get read properly. It is
also the last route family in P2 before `/bookmarks`.

## Approach

1. **Schema first, in `src/lib/schema.ts`.** `personaWriteSchema` beside `presetWriteSchema`: `name`
   (collapse, its own `PERSONA_NAME_REQUIRED`), `tagline` (a persona **has** one — the collection card
   draws it, unlike a character/lorebook/preset), `description`, `avatar` (`{initials}`, filled from
   the name — reuse `withInitials`). **No** `nsfw`, no `lorebookIds`, no preset, no in-session name,
   no engagement: `personaSchema` has none of them and `create.md` → *Absent by design* says why.
   The isDefault mark is **not** in the write — the adapter owns it (below).
2. **Four adapter methods, and the default rule is the adapter's**, not a page's:
   `addPersona` (first persona of the account takes `isDefault: true` in the same step —
   `create.md` → *States* → *First persona*), `updatePersona` (owner only, keeps `isDefault`,
   moves `updatedAt`, clears `verified`), `deletePersona` (owner only; **if it held the default, the
   mark moves to the most recently created remaining persona, and deleting the last leaves an empty
   collection with no default** — `edit.md` → *Delete confirmation*), and `setDefaultPersona(id)`
   (owner only, one write that clears the old mark and sets the new — a two-call sequence can be
   interrupted and leave two defaults or none). `listPersonas` and `getPersona` already exist;
   `getPersona` answers **only** the viewer's own and `null` otherwise, which is exactly the spec's
   *missing and unowned are one state*.
3. **`components/PersonaForm.tsrx`, two hosts** (`persona: null` is create) — `PresetForm` without
   the settings block and **with** a tagline field. Order is the spec's: name and tagline, then
   description/personality, then the avatar (initials). No NSFW toggle, no attachments section.
   Frame: one column at 360, `lg` two columns with the picture beside the definition, Save/Cancel at
   the foot, and the layout on a child `.layout` div (see the root-element bullet).
4. **`/persona` is a collection, not a catalog**: search (name only — the spec says *filters the grid
   by name*), sort, **Create**, one grid, **no paging and no Load more**. The `Card` primitive is the
   public card (author + ratio in the footer); a persona card is *avatar, name, tagline, default mark*
   and nothing else, so the collection needs either a persona card or `Card`'s "no footer" path —
   read `components/Card.tsrx` before deciding, and record the choice in `docs/DESIGN.md`.
   `Set as default` belongs on the **card** (the spec's *Actions* lists it for the collection) as
   well as on detail.
5. **`/persona/[id]` is personal detail**: header with avatar, name, tagline, the default mark and
   the four actions (**Set as default**, **Start a session**, **Edit**, **Delete**); description
   beneath, read-only. No engagement row, no report control, no comment thread, no owner notice, no
   `Sheet` menu. *Not found* and *another account's id* are the **same** sentence —
   `This persona doesn't exist in your collection.`
6. **Delete has two hosts**: detail (`detail.md` → *Delete with confirmation*) and edit
   (`edit.md` → *Delete with confirmation*). Decide once (a shared confirm row or a small dialog) and
   say so in DESIGN; after a delete from a persona that was not the last, land on the collection.

## Traps

- **A persona is not authored content.** No `nsfw`, no `isPublic`, no tags, no `tagline: ""`, no
  engagement, no fork, no bookmark, no report. If you find yourself writing `reportTarget` or
  `voteTarget` for a persona, stop — the spec forbids it four ways.
- **The default mark is a one-step invariant** (*the collection is never left with personas and no
  default*). Do it inside the adapter write, never as a page's second call, and test delete-of-default
  and create-first in one adapter probe.
- **No paging** on the collection: `listPersonas` pages at 24 in the adapter, and the page must still
  draw every row the spec says it draws. Either the page requests page 1 and the fixtures hold fewer
  than 24, or the adapter needs an unpaged answer — decide and record it; do not draw a Load more.
- **A card cannot show a ratio it does not have** — the persona card is the first card with no
  footer author and no ratio. Check `CardGrid`/`Card` props before adding a page-local card.
- **`repo.createSession(characterId, personaId?)`** already carries a persona through **New
  session**, and `session-detail.tsrx` calls it. **Start a session** from a persona asks for a
  character *first* (`detail.md`) — there is no character picker component on this page yet, so
  either build the smallest one the spec allows or link to `/character/catalog` and record the
  decision as a gap in `docs/NEXT.md`; never start a session with an arbitrary character.
- **`Set as default` is idempotent** and the button says so when this persona already holds it
  (drawn disabled, as `Request public again` is), rather than writing a no-op.
- **A block's validation error is a template-owned paragraph**, not a `Field.error` prop (T-18);
  **a schema that transforms must accept its own output** (T-18) — `withInitials` satisfies this,
  a new transform must too.
- **`track(() => …)` is a read-only derived** (T-18): a list that will be reassigned must be built
  eagerly and passed as a value.
- **`@if` with multiple children needs a fragment**; `@for` needs `const`; `@empty` does not parse in
  ripple 0.4.7 — an empty list is a sibling sentence.
- **A page's scoped `<style>` cannot touch a primitive's elements** — wrap, never reach in.
- **A component's root element carries no `tsrx-*` scope class**, so a rule written on it is dropped
  (T-19). Put every layout rule on a child element.
- **A persona id is a UUID**, so a hard reload of a runtime-created row loses it (`memory` resets);
  navigation must stay in-app to test a created row.

## Open decisions

- **Where the default mark lives on a card** — a corner badge, a line under the name, or the
  card's eyebrow — decided at 360 with two personas, one of them default.
- **How `Start a session` asks for a character** — the spec says it *asks for a character first*;
  whether that is a `Sheet` with a picker or a route to the catalog is this ticket's call, and it
  must not invent a "choose a preset" step (the preset travels with the character).
- **Whether the collection reuses `Card`** or grows a `PersonaCard` — whichever, the ratio and the
  author must not appear.

## Found while working (carried forward — keep this list growing)

- **A component's root element cannot be styled** (T-19): Ripple 0.4.7 adds `tsrx-<hash>` only to the
  elements it emits below the root, so `.character-form` / `.lorebook-form` / `.preset-form` was
  dropped by the compiler and all three forms were `display: block` — their `lg` two-column layout
  had never applied. Fixed in T-19 by moving each grid onto a child `.layout` div.
- **`PRESET_MODELS`** (T-19) lives beside `presetSettingsSchema` and is what the model `Select` and
  the fixtures agree on; `presetSettingsSchema.model` stays `min(1)` so a new model is a list change,
  not a migration.
- **A preset's detail shows its settings as a `<dl>` after the description** (T-19), the value as
  saved in `--font-mono`, with no default and no diff.
- **`repo.addPreset` / `updatePreset` / `deletePreset` / `forkPreset` exist** (T-19), mirroring the
  lorebook four; a preset has no entries, so delete has no cascade beyond its comment thread.
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
- **`Request public again` has no write** (T-18/T-19): drawn disabled on lorebook and preset detail.
- **Description and personality are one field** (T-17): `characterWriteSchema.description` is the one
  stored text; a persona's `description` follows the same rule *and* carries its own `tagline`.
- **The avatar is initials only** (T-17): there is no uploader, so an empty control is filled from the
  name by the schema. An image control needs storage, not a form.
- **`Edit session copy` is not built** (T-15): it needs `sessionCopyWriteSchema` in `schema.ts` and a
  session-scoped editor form; the copy rows draw state + link actions only.
- **`Restore` has no version history** (T-15): a stored snapshot is the fix and it is a schema change.
- **`components/PostComposer.tsrx` serves two hosts** — `/post/create` (picker) and the session's
  Publish-a-cut sheet (`cut` locked).
- **`components/CharacterForm.tsrx` serves create + edit**; so do `LorebookForm` (T-18) and
  `PresetForm` (T-19), and `PersonaForm` (T-20) will.
- **The publish-a-cut sheet is two steps** because a prop expression is evaluated once; *Change the
  range* is the one path that loses a draft.
- **`repo.createSession(characterId, personaId?)`** carries the current persona through **New
  session**; another account's persona is ignored, not attached.
- **A session's two-column layout is `lg`, not `md`** (T-15): at 900 the outlet is 656 and a 300px
  aside leaves a 324px reading column.
- **Load more is unverified on the thread**: 12 fixtures against a 24-row page.
- **`postWriteSchema` / `characterWriteSchema` / `lorebookWriteSchema` / `presetWriteSchema` + their
  `*_REQUIRED` constants are the pattern**: one schema, one normalisation, parsed by the form and
  again by the adapter.
- **`repo.listAttachableLorebooks()` / `repo.attachableLorebook(id)` exist** (T-17): the picker is
  *own + bookmarked*, the by-ID rule is *own + any public* — both are the spec's.
- **A character's attachments degrade, never vanish** (T-17), and **`deleteLorebook` must not strip
  its id from every character's `lorebookIds`** (T-18).
- **A cut with no messages is refused** (`postAttachmentSchema.messages.min(1)`).
- **`repo.listMySessions()` exists** (newest `updatedAt` first).
- **A held report opens no case** (T-12): `/moderation` has no view of held reports.
- **`reportPartSchema` has no attachment value**, so a post's image can only be reported as text.
- **`status: "removed"` has no fixture**; the removed-by-moderation placeholder is unreachable.
- **Comment attachments are not drawn** — `commentSchema` has no attachment field until an uploader.
- **`sessionSchema.personaId` is optional** — an unattributed session reads `User`.
- **Rows created at runtime take `crypto.randomUUID()`**; fixture ids come from `fixtures/ids.ts`.
- **`repo.myVote` / `repo.myReport` / `isBookmarked` exist** — never a page-local flag.
- **A base rule declared AFTER a `@media` block wins at every width.**
- **Zod costs +26.4 KB gzip on the boot chunk**; `zod/mini` is the lever if a budget is named.
- **T-16's seam is proven only on its mock and its failure branch**: `VITE_CHAT_ENDPOINT` is unset, so
  no real model has answered yet. A deployed `supabase/functions/chat` is its own ticket.
- **`chatReplySchema` is the one LLM payload shape** — a JEV call must add its own schema beside it,
  and JEV payloads are `safeParse`d like this one.
- **`repo.appendReply(id, text)` exists** — the model's write path; do not add a second one.
- **The `Preview mode` chip lives in the session's composer meta line**, because `/session/…` hides
  the shell's top bar. Any other surface that shows a mock answer needs its own marker.
- **T-17's form is proven at 360 only**; T-18 measured the lorebook pages at 360 and 1200; T-19
  measured the preset form at 360/640/1200 and detail at 360/640/1200, catalog at 360/1200.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.**

## After this

**T-21** `/bookmarks` — one catalog per type, dead cards for removed items, tabs in the query string.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

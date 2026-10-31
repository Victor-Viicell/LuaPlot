# Baton — what the next session does

**Ticket: T-17 — `/character/create` + `/character/[id]/edit`.**

Specs: `src/specs/pages/character/create.md` (whole file), `src/specs/pages/character/edit.md`
(whole file — *Layout* is *To be specified*, so record the choices in `docs/DESIGN.md`),
`src/specs/luaplot-pages.md` → *Conventions* for the cascade; `docs/ARCHITECTURE.md` → *Validation*
for the schema; `docs/DESIGN.md` → *Post detail and composer* for the one form layout already
adopted, and *Character detail* for what the saved row must satisfy.

Why next: T-16 closed P1 — the session now has a model behind the seam. T-17 opens P2 with the first
authoring form in the app, and it is the first write the rest of P2 copies: T-18/T-19/T-20 are the
same form with different fields, and T-21's bookmarks and T-22's notifications both reference rows
this ticket learns how to create. Doing it first means one write shape (`characterWriteSchema`) and
one `PostComposer`-style form convention instead of four.

## Approach

1. **Schema first, and it goes in `src/lib/schema.ts`.** `characterWriteSchema` — `name`
   (display-name collapse, non-empty), `inSessionName` optional (empty string normalises to
   `undefined`, *when left empty the Name is used*), `description`, `personality`, `avatar`,
   `nsfw` boolean (SFW by default), `lorebookIds: z.array(z.uuid())` (deduped in the transform, order
   kept). The edit schema is the same shape; do **not** declare a second one. `repo.addCharacter`
   turns the write into a stored `characterSchema` row: `id: crypto.randomUUID()`,
   `author: VIEWER`, `verified: false`, `createdAt: nowIso()`, engagement zero — the same rule
   `repo.addPost` follows.
2. **`repo` gains three methods, one path each**: `addCharacter(input)`, `updateCharacter(id, input)`,
   `deleteCharacter(id)`. `updateCharacter` and `deleteCharacter` are **author only** and answer
   `null`/`false` for anyone else (the page's *Not the owner* state is *forbidden*, not a redirect).
   `deleteCharacter` cascades its comments and its attachment references, never the lorebooks
   themselves.
3. **One form component, two hosts.** `components/CharacterForm.tsrx`, prop `character: Character |
   null` — `null` is create, a value is edit (preloaded). `/character/create` and
   `/character/[id]/edit` mount it and differ only in the header, the submit target and the Delete
   row (edit only). Same pattern as `PostComposer`'s `cut` prop, and the same reason: two copies of a
   form drift.
4. **The lorebook attachment list is three pieces**: an ID input + **Add by ID** (confirm resolves
   through `repo.getLorebook` and refuses what the author may not attach — *an ID that resolves to
   nothing the author may attach* is a validation error), a **Pick lorebook** picker, and the current
   rows beneath with one remove control each. An id that no longer resolves stays listed as
   *unavailable* — never silently dropped from the array, or saving would erase data the author
   never deleted.
5. **Mobile first**: 360×740 one column; `md` may split identity fields into two columns; `Save` and
   `Cancel` at the end of the form, Delete in the edit page's own row above them with an in-place
   confirmation (the session settings sheet's pattern, not a second dialog).

## Traps

- **`/character/create` vs `/character/[id]`**: fixed segments win over `[id]` params — check
  `src/router.ts` already routes them in that order before adding an edit route.
- **`repo.addCharacter` must not accept a hand-built row from the page.** The page hands the *write*
  shape; the adapter owns id, author, `verified`, `createdAt` and the empty engagement.
- **A page's scoped `<style>` cannot touch a primitive's elements** — wrap, never reach in.
- **Never `trim()` or `toLowerCase()` in the form.** Read the error off `characterWriteSchema`'s
  issues (the `lib/validate.ts` pattern) so the inline error, the submit gate and the adapter say the
  same sentence.
- **`@if` with multiple children needs a fragment**; the attachment list's rows are `<li>`s in one
  `<ul>`, and the empty state is a sibling of the list, not a child of a row.
- **`@for` needs `const`**; `@empty` does not parse in ripple 0.4.7.
- **A prop expression is evaluated once** — do not pass `lorebookIds.value` into the attachment list;
  pass the tracked box or re-derive from the box.
- **`localStorage`/memory adapter resets on a hard reload** — "the character saved" must be proven by
  navigating to `/character/catalog` in-app and opening the new row, not by a reload.
- **The avatar has no uploader.** `avatarSchema` is `{initials}`-shaped today: render the initials
  field honestly, or file a ticket — do not invent an upload control the specs do not describe.
- **Deleting a character leaves bookmarks that read *This character doesn't exist.*** — that state is
  T-21's to draw, so do not add a placeholder for it here.

## Open decisions

- **Does `/character/create` need a `verified` step?** The spec says *Save publishes* with no draft
  state, so no — but the row is `verified: false` until JEV or a moderator looks at it (as with
  posts). Say so in `docs/DESIGN.md` so T-18/T-19 reuse the answer.
- **NSFW toggle on the same row as the avatar** or its own row above the attachments: decide at 360
  first, record it.
- **Where *Delete* lives on `/character/[id]/edit`** — its own row above Save/Cancel, or inside an
  overflow sheet as the session does. The spec only says *with confirmation*.

## Found while working (carried forward — keep this list growing)

- **`Edit session copy` is not built** (T-15): it needs `sessionCopyWriteSchema` in `schema.ts` and a
  session-scoped editor form, and the copy rows currently draw state + link actions only.
- **`Restore` has no version history** (T-15): `restoreCopy` re-reads the original as it stands and
  keeps the copy's `version`; a stored snapshot is the fix and it is a schema change.
- **`components/PostComposer.tsrx` now serves two hosts** — `/post/create` (picker) and the session's
  Publish-a-cut sheet (`cut` locked). A third host passes `cut` or not; never a second form.
- **The publish-a-cut sheet is two steps** because a prop expression is evaluated once; a composer
  mounted beside live range selects keeps the range it was born with. *Change the range* is the one
  path that loses a draft.
- **`repo.createSession(characterId, personaId?)`** carries the current persona through **New
  session**; another account's persona is ignored, not attached.
- **A session's two-column layout is `lg`, not `md`** (T-15): at 900 the outlet is 656 and a 300px
  aside leaves a 324px reading column.
- **Load more is unverified on the thread**: 12 fixtures against a 24-row page. Growing `POSTS` past
  25 is the cheapest way to prove the append path.
- **`postWriteSchema` and `POST_REQUIRED` exist** — the composer's gate and `repo.addPost` share them.
  `characterWriteSchema` should follow that shape exactly (a `*_REQUIRED` constant + one schema).
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
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.**

## After this

**T-18** `/lorebook/*` — catalog, create, detail, edit — reusing T-17's form convention and adding the
first *entries* editor (a list of rows inside a row).

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

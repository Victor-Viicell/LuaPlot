# Baton — what the next session does

**Ticket: T-16 — the LLM seam and mock turns.**

Specs: `src/specs/pages/session/detail.md` → *States* (*Awaiting model response*, *Send failed*),
*Actions* → **Send message**; `src/specs/systems/jev.md` for how a model is addressed server-side;
`docs/DESIGN.md` → *Session* (T-15's page, which already calls the seam) and *Shell* (the chips
gesture); `docs/ARCHITECTURE.md` → *Validation* (every LLM payload is `safeParse`d before any code
reads a field).

Why next: T-15 built the page and left exactly one hole in it — `lib/llm/chat.ts → replyTo()` returns
`null`, so *Send* appends a turn and prints *No model is connected in the preview, so there is no
reply.* T-16 is the only ticket in P1 that closes that, and every later AI surface (JEV on posts,
character generation) reuses the same provider/client split.

## Approach

1. **Two files, one signature.** `replyTo(request): Promise<ChatReply | null>` stays as it is;
   `lib/llm/provider.ts` owns the transport (server-side key read, request shape) and
   `lib/llm/mock.ts` owns the deterministic preview reply. The page does not change at all — that is
   the whole point of the seam.
2. **Preview mode is a chip, not a hidden flag.** A `Preview mode` chip in the shell (12px
   `--color-text-subtle`, 1px border, non-focusable like the thread's filter chip) appears whenever
   the mock provider is the one answering. `skill`-style honesty: never a reply that looks real and
   is not.
3. **The awaiting state is real, not a delay.** The page shows the character's row as a
   two-line `Skeleton` under its in-session name while the call is in flight, and replaces it with
   the reply. `awaiting` is page state derived from `sending`, so a fast mock still renders it once
   (a microtask is enough to paint it — verify with a CDP screenshot-free DOM read, not by eye).
4. **The reply is appended through the adapter**, not in the page: `repo.appendTurn` gains a role, or
   a second method `appendReply(id, text)`. One write path, `turnWriteSchema` still the only
   trimming rule, `at` still the adapter's clock.
5. **Determinism.** The mock answers from the turn count and the in-session name only — no
   `Math.random`, no `Date.now` in the text — so the same transcript always produces the same
   sentence and a fixture-based check can assert it.

## Traps

- **`replyTo` must never be called from a page with a model key.** `DEEPSEEK_API_KEY` /
  `OPENROUTER_API_KEY` are server-side only (`.env.local`, gitignored); the static build calls the
  mock, and the provider file must not be imported by a `.tsrx` that ships in the client bundle.
- **`@if` with two children needs a fragment**; the awaiting row and the reply row are two nodes.
- **A `@for` body's siblings need a fragment too**; the transcript already wraps each turn in a
  single `<li>` — keep it that way rather than adding a second node in the loop body.
- **A prop expression is evaluated once** — do not hand `PostComposer` or a chip a `track.value`.
- **`repo.appendTurn` returns the whole session**; use `applySession(next)` (T-15's one writer) or the
  header, copies and transcript drift.
- **`localStorage` is not a queue**: nothing about an in-flight reply survives a reload, and the
  memory adapter reseeds on a hard reload anyway.
- **The memory store resets on a hard reload** — "it sticks" claims need in-app navigation.
- **`publish.sh` compares the live bundle hash**; a Pages 200 alone can still be the previous deploy.

## Open decisions

- **Does `Send` wait for the reply or fire and forget?** The spec lists *Awaiting model response* as
  a state, so the composer stays disabled until the reply lands; a draft typed during the wait is
  discarded by `draft.value = ""` only after the turn is stored, so the field is empty while waiting.
- **Where the chip lives.** The shell's top bar is 56px and already carries back + title + overflow;
  a third element at 360 needs measuring. An alternative is the session header's kicker line — decide
  and record it in `docs/DESIGN.md` → *Session*.
- **A failed reply** is the spec's *Send failed*: the turn is already stored (it is append-only), so
  the failure line belongs under the composer as `sendError`, not as a rollback.

## Found while working (carried forward — keep this list growing)

- **`Edit session copy` is not built** (T-15): it needs `sessionCopyWriteSchema` in `schema.ts` and a
  session-scoped editor form, and the copy rows currently draw state + link actions only.
- **`Restore` has no version history** (T-15): `restoreCopy` re-reads the original as it stands and
  keeps the copy's `version`; a stored snapshot is the fix and it is a schema change.
- **`components/PostComposer.tsrx` now serves two hosts** — `/post/create` (picker) and the session's
  Publish-a-cut sheet (`cut` locked). A third host passes `cut` or not; never a second form.
- **`PostComposer` drops its two-column `md` split when `cut` is set** (`.compose.is-locked`): a sheet
  has no second column to fill.
- **The publish-a-cut sheet is two steps** because a prop expression is evaluated once; a composer
  mounted beside live range selects keeps the range it was born with. *Change the range* is the one
  path that loses a draft.
- **`repo.createSession(characterId, personaId?)`** now carries the current persona through
  **New session**; another account's persona is ignored, not attached.
- **`repo.appendTurn` / `deleteSession` / `setSessionPersona` /
  `updateCopyFromOriginal` / `restoreCopy` exist** — do not add a second path to any of them.
- **A session's two-column layout is `lg`, not `md`** (T-15): at 900 the outlet is 656 and a 300px
  aside leaves a 324px reading column.
- **Load more is unverified on the thread**: 12 fixtures against a 24-row page. Growing `POSTS` past
  25 is the cheapest way to prove the append path.
- **`PostCard` takes `fold` / `foot`**: the permalink passes `fold={false}` / `foot={false}`.
- **`postWriteSchema` and `POST_REQUIRED` exist** — the composer's gate and `repo.addPost` share them.
- **A cut with no messages is refused** (`postAttachmentSchema.messages.min(1)`).
- **A new post is `verified: false`**, engagement zero, dated `nowIso()`.
- **`repo.listMySessions()` exists** (newest `updatedAt` first).
- **A held report opens no case** (T-12): `/moderation` has no view of held reports.
- **`reportPartSchema` has no attachment value**, so a post's image can only be reported as text.
- **`status: "removed"` has no fixture**; the removed-by-moderation placeholder is unreachable.
- **Comment attachments are not drawn** — `commentSchema` has no attachment field until an uploader.
- **`sessionSchema.personaId` is optional** — an unattributed session reads `User`.
- **Rows created at runtime take `crypto.randomUUID()`**.
- **`repo.myVote` / `repo.myReport` / `isBookmarked`** exist — never a page-local flag.
- **A page's scoped `<style>` cannot touch a primitive's elements** — use a page-owned wrapper.
- **A base rule declared AFTER a `@media` block wins at every width.**
- **`@for` needs `const`**; `@empty` does not parse in ripple 0.4.7.
- **Zod costs +26.4 KB gzip on the boot chunk**; `zod/mini` is the lever if a budget is named.
- **Counts now: characters 28 (27 public), lorebooks 6, presets 5, personas 3, posts 12, reports 5,
  comments 22, sessions 2.**

## After this

**T-17** `/character/create` + `/edit` — the first authoring form, and the first write that must
answer JEV (read `.agents/skills/typesafe-ai/SKILL.md` and the live docs before designing the call).

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

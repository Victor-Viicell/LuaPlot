# Baton — what the next session does

**Ticket: T-27 — the JEV adapter. P3 closes.**

Spec: `src/specs/systems/jev.md` (whole file — *Scope*, *Decisions*, *Actions*, *Privacy and
republication*, *Cumulative reports*, *Failure*); `src/specs/pages/moderation/detail.md` → *Data*
(the fields the case page prints); `src/specs/components/report.md` → *What happens next*. Skill:
`.agents/skills/typesafe-ai/SKILL.md`, then the live docs at <https://docs.typesafe.ai/llms.txt>
(2026-10-31) before designing the call. `docs/JEV.md` holds the question set and the state shape.

Why next: every surface JEV acts on is now drawn — `/moderation` lists the cases, `/moderation/<id>`
judges them, and the detail pages carry the owner's notice — but nothing classifies. `report.jev` is
still the placeholder `addReport` writes (`unsure`, `0.5`, `none`), so the queue's *why is this here*
line and the case page's ledger row both print a model that never ran. T-27 is the last piece of P3
and the one the whole moderation phase was built around.

## Approach

1. **`lib/llm/jev.ts` is transport only.** `POST https://openrouter.ai/api/alpha/decisions` — no
   `/v1`, never `chat/completions` (a `typesafe/*` id 400s there, and a router-style slug answers
   *anyway* through a general chat model). Body `{model, state, questions}` with
   `typesafe/jev-1.14`. **Require `provider: "TypeSafe"` in the response before trusting a single
   field**; anything else is a service failure, not an answer. Like `chat.ts`, the key is server-side:
   the client posts to `${SUPABASE_URL}/functions/v1/jev` and `lib/llm/mock.ts` answers deterministically
   in the preview. Read `references/openrouter-decisions-api.md` in the skill for the exact shapes.
2. **`lib/llm/jevPolicy.ts` holds the thresholds and the action table**, no coercion anything. The
   spec's mapping is code, the judgment is criteria: clear + confident → act (`made-private` for
   authored content, `removed` for a post or comment), unsure → `escalated` (stays public, opens no
   action), a copy claim with an internal source → compared by JEV, a copy claim with an external
   source or **any copied image** → never judged, straight to a moderator, and illegal content in a
   character/lorebook/preset body → moderator. `jevVerdictSchema` already carries
   `{verdict, confidence, action, note, at}` and `caseDecisionSchema` the moderator's half — nothing
   new is needed in `schema.ts` except, possibly, a `jevPayloadSchema` for the raw response (parse it
   before any code reads a field: **every LLM payload goes through `safeParse`**).
3. **One item, one scan.** `addReport` already answers `held` for verified content and joins an open
   case. The adapter's job is to call JEV once per item change and store the verdict on the open case
   (`report.jev`) — the queue and the case page already read it and must not change. Clear an item's
   `verified` flag on any edit (the schema note says so; check `updateCharacter`/`addComment`).
4. **A failure is `unsure`, never a silent pass.** `systems/jev.md` → *Failure*: the model failing
   answers *unsure*, the content stays as it was, and the case is still queued. A response without
   `provider: "TypeSafe"` is the same path.
5. **Mock first, wire second.** `mock.ts` already returns deterministic spec-shaped answers — extend
   it so the preview shows a plausible verdict for each fixture case rather than one canned string,
   then put the real call behind the env check `chat.ts` uses. The preview must keep working with no
   keys (`Secrets never enter the client bundle`).

## Traps

- **Never route a judgment through `chat/completions`**, and never accept prose where a verdict was
  asked for; `provider: "TypeSafe"` is the only proof the answer came from a decisions model.
- **Score/Choice fields are not strings**: read the skill's per-primitive field list before writing
  the payload; a `score` takes an ordered `criteria` array.
- **Do not recompute or "improve" a stored verdict.** `report.jev` is history (`jevVerdictSchema`
  says so); a new scan writes a new verdict on a new or still-open case.
- **The reporter still hears nothing.** JEV's action changes the content and the owner's notice; it
  never writes the reporter a row, and it never edits authored content beyond `isPublic`.
- **`post` has no status field** (see below): a JEV `removed` on a post can only be recorded on the
  case, exactly as the moderator's conclusion is today.
- **`/moderation/<id>`'s `?admin=1`** must survive any navigation the new code adds.
- **Ripple:** inline `try` in a `@{}` block breaks the compiler; use `.then/.catch` and put the LLM
  call in a plain `.ts` module anyway.

## Open decisions

- **Where the scan is triggered from**: the adapter at `addReport` (mock, automatic) or an Edge
  Function the client calls after a write. The static preview has no server, so the mock path must
  answer synchronously-ish either way.
- **One question per item or one per surface**: `REPORT_REASONS_BY_PART` lets a single report name
  an avatar and a text; a verdict per surface would need a field `jevVerdictSchema` does not have.
  Decide once and record it in `docs/DESIGN.md` / `ARCHITECTURE.md`.
- **The confidence cut-offs** — start from the spec's wording, then measure on the five fixtures; do
  not tune a threshold to a single case.

## Found while working (carried forward — keep this list growing)

- **T-26B is done**: `pages/moderation-detail.tsrx` is the case. `repo.concludeReport` /
  `dismissReport` / `addCaseComment` / `getComment`; `reportSchema` carries `history` +
  `decision` and refines the concluded/open pair; `caseConcludeSchema` / `caseDismissSchema` /
  `caseCommentSchema` / `caseEventSchema` / `caseDecisionSchema` / `reportIdSchema` /
  `termsRuleSchema` live in `schema.ts`; `TERMS_RULES_ORDER` is the checklist's order.
- **`postSchema` has no status, so a post cannot be marked removed** (T-26B): the conclusion is
  recorded on the case, the row stays where it is, and nothing hides it from a listing. **File this
  as its own ticket** before a post removal is claimed anywhere: adding `status: "visible" |
  "removed"` touches the fixtures, `ratioOf`, bookmarks (`item: null`), the feed and the composer's
  *my posts* view.
- **"Set reason" is folded into the decision** (T-26B): the case panel's one `Reason` field is the
  moderator's words, written by `concludeReport`/`dismissReport` as `decision.reason`. A standalone
  `reason-set` write was rejected — a concluded case is final, so there is no later moment to
  correct a reason that would not be a rewrite of history.
- **`event` is a DOM global**: a helper named `event(...)` in `memory.ts` resolves to `window.event`
  and `TS2349`s at build. Name history helpers `historyEvent`.
- **`@for` needs `const`**: `@for (row of rows)` crashes `tsrx-tsc` with *Cannot read properties of
  undefined (reading '0')*, which then reports dozens of bogus errors at the component's signature.
  Write `@for (const row of rows; key row.id)`.
- **An `@if` branch renders one node**: a branch with a `<span>` and an `<a>` is a compile error
  (*A code block renders a single node*). Wrap the pair in `<>…</>`, and wrap a phase arm that draws
  a header plus a body the same way.
- **A gate named for the positive is a bug waiting**: `disabled={canConclude}` disables the button
  exactly when the action *is* allowed, and the typecheck cannot see it. Name the flag for its
  effect (`concludeOff`) and check it in the browser.
- **The preview loses runtime rows on a hard reload** — every flow that writes (conclude, dismiss,
  note, notification) must be walked **in-app** to be verified; a `goto_url` re-seed looks like a
  bug in the write.
- **T-26 is done**: `pages/moderation-queue.tsrx` is the queue — page 1, `Select` filter in the URL
  (`?status=open|concluded|all`), counts from two `listReports` calls, `forbidden` as a phase,
  `?admin=1` the reviewer's switch. `reportFilterSchema` + `reportSourceIsExternal()` live in
  `schema.ts`; `relativeAge()` (`2d ago`, `on 13 Oct`) lives in `lib/format.ts`.
- **Open rows on `/moderation` are the escalated cases only**: `jev.action` is `escalated` on every
  open fixture, so the row prints an action word only for `made-private` / `removed` / `held`.
- **`navigate()` writes only what you give it** (T-26): any URL a moderation page writes must re-add
  `?admin=1`.
- **T-25 is done**: `components/NsfwControl.tsrx`; the signed-out answer is one pending intent in
  `lib/state/prefs.ts`; a reveal's lifetime is a fetch epoch (`CardGrid`'s `revealEpoch`), and any
  new listing that can refetch must pass it.
- **`/user/[username]`'s posts feed still keys on `post.id`** (T-25) — one line when that feed is
  next touched.
- **`/terms` is done** (T-24): `TERMS_RULES` + `REPORT_REASON_RULE` in `schema.ts`, ids
  `#copied-content` / `#unmarked-nsfw` / `#illegal-content`; a hash in the URL needs a mount jump.
- **`<a>` and `<button>` do not nest**; **`{<Component />}` inside a fragment is a parse error**;
  **`effect()` is the only lifecycle hook**; **a component's root element cannot be styled** and a
  page's scoped block cannot reach a primitive's elements (wrap them in page-owned elements).
- **`/notifications` is done** (T-22): `markNotificationRead`, `markAllNotificationsRead`,
  `unreadNotificationCount`, `lib/state/inbox.ts`, badge in both nav hosts — a moderation row with no
  `measure` reads *A moderation decision was made on your …*.
- **Counts now: characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12,
  reports 5 (3 open, 2 concluded), comments 22 (one removed placeholder), sessions 2, bookmarks 8
  (one dead), notifications 6 (3 unread), profiles 7, follow edges 15.**
- **The memory adapter loses runtime rows on a hard reload** (T-18): navigation must stay in-app.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

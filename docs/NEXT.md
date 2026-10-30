# Baton — what the next session does

**Ticket: T-07B — Zod as the one parser, at every boundary.**

Brief: this file. Nothing to read beyond the files named below.

Why next: validation is already a rule in this repo and it is scattered — `lib/validate.ts` hand-rolls
a regex for the handle, `memory.ts` trusts its fixtures, `repo.saveProfile` trusts its caller, and no
adapter output is checked at all. Every ticket left on the plan (T-08 card, T-09..T-24 pages, T-29
Supabase, the JEV/LLM seam) either reads a shape or writes one, so each one done first would either
repeat the hand-checks or grow a second, disagreeing validator. Land the schemas now, derive the types
from them, and every later ticket parses instead of guessing: no duplicated shape, no per-page regex,
no `as` cast to get past a parse, and a fixture that drifts from `src/specs/` fails the gate instead
of a phone screen.

## Do

1. `bun add zod` (4.x). This ticket names it, so the CONTRACT's no-new-dependency rule allows it.
   One validator in the repo; no `zod/v3` import path and no hand-rolled mini-validator.
2. Create `src/lib/schema.ts` — the one home:
   - primitives: `isoSchema` (a string that is really ISO-8601 — `2026-13-01` must fail, not pass a
     length check), `handleSchema` (trim → lowercase → 3–24 of `[a-z0-9_]`), `displayNameSchema`
     (trim + collapse whitespace runs), `avatarSchema`, `engagementSchema`;
   - entities: `characterSchema`, `lorebookSchema`, `presetSchema`, `personaSchema`, `postSchema`,
     `commentSchema`, `notificationSchema`, `reportSchema`, `sessionSchema` (+ `sessionCopySchema`),
     `accountPreferencesSchema`, `userSchema`. Use `z.strictObject` so an unknown key fails instead
     of being dropped; cite the spec line each group of fields comes from in a schema comment;
   - shapes the specs forbid do not exist here: no stored `ratio` (it is `ratioOf()`), no
     engagement/NSFW/public flag on a persona, no `updatedAt` on a post or a comment.
3. Invert `src/lib/data/types.ts` onto the schemas: `export type Character = z.infer<typeof
   characterSchema>` and so on, keeping the existing doc-comment block. `z.infer` is the **output**
   type — the one the app holds, after `handleSchema` has lowercased — so `saveProfile` accepts the
   output and no page re-normalises. Every hand-written entity type a schema now owns is deleted, not
   left beside it.
4. `src/lib/validate.ts` stops owning the rule and starts reporting it: `readHandle` and
   `readDisplayName` keep their exact signatures (`{handle, problem}` / `{name, problem}`) so
   `src/pages/onboarding.tsrx` does not change, and `HANDLE_RULE` becomes the schema's message so the
   inline error, the Finish gate and the saved row cannot disagree. Classify `problem`
   (`required` / `format`) from the `ZodError` issue code, not from a second regex.
5. Parse at the adapter's edges in `src/lib/data/memory.ts`: each fixture collection is parsed on load
   so a bad row throws with the fixture name and index in the message, and `saveProfile` /
   `savePreferences` parse their input before the write. `repo.ts` keeps taking the schematic types,
   so nothing downstream re-validates a value it was handed.
6. Add `scripts/schema-check.ts` (`bun run schema:check` in `package.json`): parse every fixture
   collection, print per-collection counts, and assert three negative cases fail — a bad handle, an
   entity missing `nsfw`, an unknown extra key. Wire it into `scripts/check.sh` as section 5 so the
   gate, not a page, is the guarantee. `check.sh` still prints `GREEN` only when all five sections
   pass.
7. `docs/ARCHITECTURE.md` gains a **Validation** section (the source of truth later sessions read):
   schemas live in `lib/schema.ts`; types are `z.infer`; `safeParse` at every UI and transport edge,
   `parse` only for an internal invariant; normalisation belongs in the schema (trim, lowercase,
   collapse, ISO strings) so a saved row cannot differ from a validated one; display formatting
   (`percent`, `relativeTime`) stays in `lib/format.ts` — Zod is shape and input, not presentation;
   every JEV/LLM payload gets a schema before any code reads a field; a fixture that fails is fixed
   against the spec, never by loosening the schema.
8. `docs/CONTRACT.md` → *Engineering law* gains one bullet pointing at that section, so every later
   session inherits it without having read this baton. `SHIP-PLAN.md` tick + `PROGRESS.md` entry.

Accept: `./scripts/check.sh` prints `GREEN` including the schema section; `bun run build` passes and
the report names the bundle delta (zod is ~14KB minified, accepted); `/onboarding` still blocks an
invalid and a taken handle with the same copy, checked in the DOM, not a screenshot; no `z.any()` in
`src/lib/`; no entity shape declared twice.

## Traps

- **Zod 4 syntax, not 3.** `z.strictObject({...})` is the current form (`.strict()` is deprecated);
  `z.infer` is the output type and `z.input` the input, and a `transform` (the lowercased handle)
  makes them differ — the app holds the output.
- **Never `z.coerce.date()`.** `Iso` is a string in the adapter and in every fixture; a `Date` would
  silently change every `*At` comparison and every sort. Validate the string.
- **The recursive reply tree needs `z.lazy`** (`Comment` replies, session copies). Check the emitted
  type is not `any` — a schema typed `any` hides exactly the drift this ticket exists to catch, and
  `tsrx-tsc --noEmit` will not complain.
- **Parsing fixtures at module load means one bad row kills `/dev/data` and the build.** That is the
  point, but the thrown message must name the fixture, the index and the failing path, or the next
  session spends its budget bisecting.
- **Never loosen a schema to keep a fixture green.** A fixture that breaks a spec rule is a broken
  fixture — the same rule as "do not change a fixture's NSFW flag to make a page look right".
- **`handleSchema` and `router.ts`'s segment rule are the same rule.** If the router keeps its own
  regex they will drift; extract one and import it in both.
- **`bun add zod` needs the network.** If the registry is unreachable, write `UNVERIFIED` in PROGRESS
  and file the ticket — do not hand-roll a validator to look finished.
- **This ticket touches `src/lib/`, not a page's layout.** Mobile-first, tokens and `.tsrx` rules are
  unchanged by it — do not restyle a page while you are in there.

## Open decisions

- **Where fixtures parse**: module load in `memory.ts` (fails the gate) vs per call in `resolveRepo()`.
  Recommended module load — a bad fixture should never ship, and the cost is one parse per collection.
- **`schema:check` runtime**: recommended `bun scripts/schema-check.ts` so it imports the TS schemas
  with no build step; a `.mjs` would need a compile of its own.
- **Do `readHandle`/`readDisplayName` keep their names?** Recommended yes — the page, its copy and the
  gate stay untouched, and the ticket stays inside the budget.
- **Zod for saved values, `lib/format.ts` for display**: recommended. Do not grow `lib/format.ts` in
  this ticket unless a line of it is needed to print the counts.
- **`zod/mini` for the client bundle**: not yet — it costs API surface and the delta is acceptable
  this early. Record the number; revisit only if a bundle budget is ever named.

## Found while working (carried forward — keep this list growing)

- **`Field.error` was frozen at mount until T-07** (`const invalid = read(error)`), so inline
  validation changed the message but not the border or `aria-invalid`. It is a `Derived` now —
  `Toggle.disabled` is still a plain boolean, same trap, unfixed until a page needs it.
- **`disabled={!derived}` is always false.** A prop expression is evaluated once, so the *derived*
  must be handed over (`disabled={blocked}` where `blocked = track(() => !canFinish.value)`). T-06 hit
  it on the provider buttons, T-07 nearly did again.
- **`repo.saveProfile` + `session.setAccount` is the pair for any account write.** The adapter owns
  the row, the session owns the screen; a page that only writes the adapter shows `You` everywhere.
- **A draft is not a claim.** T-07 writes the onboarding draft only for a handle the adapter has
  answered free — otherwise a typed-and-abandoned handle would be exempt from the uniqueness check it
  now holds. Any later "save as you type" feature inherits that ordering (check, then write).
- **`src/specs/components/` has only `comment-thread.md` and `report.md`** — the card has no spec file
  of its own, so `luaplot-pages.md` §Conventions plus `DESIGN.md` are the law for it.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. Neither is a product control (T-30
  deletes both).
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
- `lib/format.ts` does not exist yet though `ARCHITECTURE.md` lists it; ratio formatting is inline in
  `Card`. Create it when a ticket needs `relativeTime`/`percent`, not before.

## After this

Next baton: **T-08 — catalog card + grid**, whose brief already exists at
`docs/tickets/T-08-card.md` (moved out of this file on 2026-10-30 so the schema work could go first;
nothing in it changed). Point the next baton's `Brief:` line at that file instead of re-writing it.

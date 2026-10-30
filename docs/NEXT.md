# Baton — what the next session does

**Ticket: T-08 — catalog card + grid (NSFW blur, per-item Reveal).**

Brief: `docs/tickets/T-08-card.md` — read it instead of looking for a summary here. It was written
before T-07B and is unchanged; the schema work only added what the card now gets for free (below).

Why next: it is the first ticket where **the viewer's preference changes what a component draws**, and
five later tickets (T-09 catalog, T-13 thread, T-21 bookmarks, T-23 profiles, T-25 "NSFW everywhere")
are all the same component in a different list. `components/Card.tsrx` has structure (header / middle /
footer) but no content, no state and no blur, and nothing reads `nsfwPreference()` yet. Get the three
parts and the one-view Reveal right in isolation and those tickets become lists.

## Carried into T-08 (from T-07B)

- **Entities are `z.infer` of `src/lib/schema.ts`.** Import the type from `lib/data/types.ts` as
  before, but do not add a field to a type: add it to the schema. `Card` takes values, so it needs no
  parse of its own — `memory.ts` already parses everything it hands out, and the page/adapter that
  fetches is where `safeParse` belongs.
- **A card renders `ratioOf(item)`, never a stored ratio**, and the percent sign belongs in
  `lib/format.ts`, which still does not exist. T-08 is a fair moment to create it with `percent()`
  only — do not grow it to `relativeTime` until a ticket needs it.
- **Fixture ids are real UUIDs now** (`ids.ts` emits hex; decimal groups made every detail link a
  404). Detail routes resolve, so `Card` links with `href('/character/' + item.id)`.
- **`bun run schema:check` is gate section 5.** Adding a card field that comes from an entity means
  changing the schema and the fixture together, or the gate goes red — which is the point.

## Approach

Follow the brief's seven steps in order; the only sequencing that matters is card → grid → gallery,
because the gallery is how you see four breakpoints without a catalog page. Mobile first at 360×740,
then 640 / 900 / 1200. 1-up at 360, 2-up at `sm`, 3-up at `md`, 4-up at `lg`.

## Traps (beyond the brief's own list)

- **`filter: blur()` on the middle blurs the Reveal control too** if the control lives inside the
  blurred node — put the scrim + Reveal in a sibling overlay layer, and verify in the DOM that the
  button is clickable and ≥44px.
- **A prop expression is evaluated once.** Reveal state must be created *inside* the card
  (`const revealed = track(false)`), never passed in and frozen — the `Button.disabled` trap in a new
  costume.
- **Blur is not `backdrop-filter`**: cards are opaque `--color-bg-elevated`. Blur the content, then a
  `color-mix` scrim of `--color-bg`.
- **The footer stays crisp** and at full contrast; the ratio is the reason the footer sits outside the
  blur. No `opacity` on it.
- **Never hard-code a colour** — `--color-*` / `--ctp-*` only. `tags` stays absent, not empty.
- **Scope**: `components/` + `/dev/primitives` + `DESIGN.md`. The catalog page itself is T-09 — do not
  restyle a page while you are in there.

## Open decisions

- **Grid gesture**: 1px-gap grid on `--color-border` (the `/dev/data` count-strip look) **or** a
  gutter grid with 6px-radius cards. Pick one, record it in `DESIGN.md` → Cards; do not leave both.
- **Where the blur's radius and scrim values live**: tokens in `styles.css` (`--card-blur`,
  `--card-scrim`) if a second component needs them, otherwise local CSS in `Card.tsrx`. Either is
  fine; write down which.
- **Post cards**: a post has no `name`/`tagline` and does have a body. If the brief's four-entity
  signature makes the post branch ugly, keep the post out of `Card` until T-13 and say so in
  `DESIGN.md`.

## Found while working (carried forward — keep this list growing)

- **Onboarding's uniqueness check sits inside `persistDraft`, which returns early when the display
  name is empty.** A user who types only a handle never gets the spec's `Username taken` (or any
  answer) and `Finish` stays disabled with no explanation — found while driving `/onboarding` in the
  DOM for T-07B. The spec wants the answer inline on the field: move `checkHandle` out of the draft
  write (check on settle, write only when valid). Not fixed.
- **Zod costs +26.4 KB gzip / +91 KB raw on the JS bundle**, roughly twice the ticket's estimate,
  because `router.ts` imports `isHandle` from `schema.ts` and drags zod into the boot chunk. Accepted
  for now; `zod/mini` (or a lazy router import) is the lever if a bundle budget is ever named.
- **`z.uuid()` is stricter than the router's `[0-9a-f-]{36}`.** They agree on every real id today; if
  the router ever needs them to agree exactly, give the id segment a schema predicate the way
  `[user.username]` now uses `isHandle`.
- **A new fixture id bucket must go through `ids.ts`.** Hand-written ids are exactly the drift the
  schema check now catches at load.
- **`Field.error` was frozen at mount until T-07** (`const invalid = read(error)`), so inline
  validation changed the message but not the border or `aria-invalid`. It is a `Derived` now —
  `Toggle.disabled` is still a plain boolean, same trap, unfixed until a page needs it.
- **`disabled={!derived}` is always false.** A prop expression is evaluated once, so the *derived*
  must be handed over (`disabled={blocked}` where `blocked = track(() => !canFinish.value)`).
- **`repo.saveProfile` + `session.setAccount` is the pair for any account write.** The adapter owns
  the row, the session owns the screen; a page that only writes the adapter shows `You` everywhere.
- **A draft is not a claim.** T-07 writes the onboarding draft only for a handle the adapter has
  answered free, so a typed-and-abandoned handle is never exempt from the uniqueness check. Any later
  "save as you type" feature inherits that ordering (check, then write).
- **`src/specs/components/` has only `comment-thread.md` and `report.md`** — the card has no spec file
  of its own, so `luaplot-pages.md` §Conventions plus `DESIGN.md` are the law for it.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. Neither is a product control (T-30
  deletes both).
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
- `lib/format.ts` does not exist yet though `ARCHITECTURE.md` lists it; ratio formatting is inline in
  `Card`. Create it when a ticket needs `relativeTime`/`percent`, not before.

## After this

T-09 `/character/catalog` — the first real host of the grid: toolbar (search debounced 250ms, `All`
filter, sort, NSFW toggles), `Load more` (+24, hidden at the end), query-string state, all six states.

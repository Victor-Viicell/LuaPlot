# Baton — what the next session does

**Ticket: T-08 — catalog card + grid (NSFW blur, per-item Reveal).**

Why next: it is the first ticket where **the viewer's preference changes what a component draws**, and
five later tickets (T-09 catalog, T-13 thread, T-21 bookmarks, T-23 profiles, T-25 "NSFW everywhere")
are all the same component in a different list. `components/Card.tsrx` already has the structure
(header / middle / footer) but no content, no state and no blur; `nsfwPreference()` exists and nothing
reads it yet. Get the card's three parts and the one-view Reveal right here, in isolation, and the
catalog tickets become lists.

## Do

1. Read `src/specs/systems/nsfw.md` and `src/specs/pages/character/catalog.md` (the card's first
   real host), plus `docs/DESIGN.md` → *Cards*, *Primitives* and *States* ("NSFW blur = middle
   covered, footer numbers visible, per-item Reveal").
2. Grow `Card` from structure to a real item card: it takes the entity (`Character | Lorebook |
   Preset | Post`) or the six fields it needs, plus `nsfw: boolean`. Keep the three parts separate —
   the blur is `filter: blur(...)` + a scrim on `.card-middle` **only**, with the tagline/avatar
   inside it. Header and footer must stay crisp, and the ratio must keep reading as a number over the
   blur (it lives in the footer, not on the scrim).
3. **Reveal is per item and local to the mount.** A `track(false)` inside the card, a
   `ghost`/`secondary` 44px `Reveal` control in the blurred middle, and it forgets on navigation —
   that is the *one-view* rule, not a bug. Do **not** put Reveal state in `lib/state/prefs.ts`: the
   preference is the account's, the reveal is the glance.
4. Show off means the card is **absent from the listing**, not blurred, and it never affects a detail
   route. The listing decides that (`nsfwPreference().show`), the card only draws what it is handed —
   so `Card` needs the flag, not the store. Keep the store read out of the component; T-09 owns it.
5. Build `src/components/CardGrid.tsrx`: 1-up at 360, 2-up at `sm`, 3-up at `md`, 4-up at `lg`, and a
   `1px` gap grid on `--color-border` (the `/dev/data` count-strip gesture) or a gutter grid with
   cards at 6px radius — pick one and record it in `DESIGN.md` → Cards. Card opens its detail route
   (`/character/[id]`, `/lorebook/[id]`, `/preset/[id]`, `/post/[id]` via `href()`), title link plus
   `onOpen`, never a bare `<div onClick>`.
6. Prove it on `/dev/primitives` — the gallery is already the second renderer of every primitive
   (`DESIGN.md` → Dev gallery). Add a card section with a SFW card, a blurred card (pre-reveal), the
   same card revealed, one long tagline and one long title at 360 and 1280. It is not a product
   route; it stays out of the spec index.
7. `DESIGN.md` gains a "Card (decided in T-08)" section in the same commit: the blur's radius and
   scrim opacity, where `Reveal` sits, the grid gaps per breakpoint, and how a blurred card's focus
   order runs (the Reveal must be focusable before the title link inside the covered middle).
   `SHIP-PLAN.md` tick + `PROGRESS.md`.

## Traps

- **`filter: blur()` on `.card-middle` blurs the Reveal button too** if it sits inside the blurred
  element. Put the scrim + `Reveal` in a sibling layer (absolute over the middle, unblurred) or blur
  an inner `.card-veil` and keep the control outside it. Check it in the DOM: `Reveal` must be
  clickable and ≥44px.
- **Blur is not `backdrop-filter` here** — cards are opaque `--color-bg-elevated`, so a backdrop blur
  shows nothing. Blur the content, then a `color-mix` scrim of `--color-bg`.
- **No hard-coded colours and no `opacity` on the footer.** The ratio is the whole point of leaving
  the footer out: it must render at full contrast on a blurred card (design law: "footer numbers
  visible").
- **`Card` props are values, evaluated once.** If the card grows a live state (reveal), that state
  must be created **inside** the card, not passed in and frozen — the `Button.disabled` trap in a
  different costume.
- **`tags` stays absent, not empty** while the taxonomy is undecided (`ARCHITECTURE.md` → open
  decision 3). Do not invent tags to make the card look finished.
- **`lib/format.ts` does not exist**, though `ARCHITECTURE.md` lists it. Ratio formatting is inline in
  `Card` today (`Math.round(ratio * 100) + '%'`). If the card needs relative time ("2h"), create
  `lib/format.ts` with `relativeTime(iso)` and `percent(ratio)` and note it in `ARCHITECTURE.md` — do
  not scatter date maths across cards. `ratioOf()` lives in `lib/data/types.ts`.
- **Fixture NSFW rows exist**: at least one character and one post carry `isNsfw: true`. Use them;
  do not invent a fixture for the demo, and do not change a fixture's flag to make a page look right.
- Headless Chromium freezes entrance animations at opacity 0 — read the DOM (`getComputedStyle`,
  `filter`, `textContent`), not a screenshot.
- A hidden tab clamps timers to ~1.2s (measured T-07): never conclude "state never arrived" from a
  short wait.

## Open decisions

- **Blur strength and scrim**: recommended `blur(6px)` + `color-mix(in srgb, var(--color-bg) 55%,
  transparent)`; strong enough that a tagline is unreadable at 360, light enough that the card still
  reads as a card. Record it, do not tune it twice.
- **Where `Reveal` sits**: recommended bottom-left of the covered middle, 44px, `btn-ghost` on the
  scrim — the title link above it stays reachable by keyboard.
- **Grid vs list at `lg`**: the design law says a 4-up grid at `lg`; detail pages are the two-column
  surface. Keep the card compact enough for 250px.
- **Does a revealed card stay revealed while the list re-sorts?** Recommended no: keyed `@for` keeps
  the component, so a re-sort remounts and re-blurs — acceptable and honest for one-view.
- Tag taxonomy still undecided (keep `tags` empty); Stripe surface still undefined.

## Found while working

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

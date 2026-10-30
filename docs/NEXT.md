# Baton — what the next session does

**Ticket: T-09 — `/character/catalog`, the first real host of the grid.**

Brief: none yet; this file is the brief. `src/specs/pages/character/catalog.md` and
`src/specs/systems/nsfw.md` are the law, plus `docs/DESIGN.md` → *Card and grid* (T-08) and
*Primitives*.

Why next: T-08 built the card and the grid in isolation; nothing yet reads `nsfwPreference()` and no
listing exists. T-09 is the first page that **hides or covers** content by the account's preference,
and T-10/T-13/T-21/T-23 all reuse the toolbar → grid → `Load more` shape it establishes.

## Approach

1. Read the two specs, then `src/lib/state/prefs.ts`, `src/lib/data/repo.ts` (what the adapter already
   offers for paging/filtering — do not invent a second query path) and `src/lib/reactive.ts`.
2. Toolbar: search (debounced **250ms**, no per-keystroke fetch), `All` filter (only option; the
   parameter is reserved), sort, and the two NSFW `Toggle`s wired to `setShowNsfw` / `setBlurNsfw`.
   Filter + sort live in the **query string** (shareable, back/forward); paging does not.
3. Listing = `@if (show)` filter (`item.nsfw` dropped when Show is off) → `CardGrid
   items={visible} blurNsfw={blur}` → `Load more` (+24, absent at the end).
4. Render all six states: Loading (skeleton matching the grid), Empty (one line + `Create`),
   No-results (query echoed + `Clear`), Loading more (the button busy, not a spinner), End of list
   (no control), Error (what failed + `Retry`).
5. Mobile first 360×740, then 640/900/1200. No horizontal scroll at any width. Do not restyle the
   card or the grid — they are settled.

## Traps

- **Show off wins over Blur.** A flagged item is *absent* from the listing when Show is off, whatever
  Blur says (`nsfw.md` → States). The pair is independent in the store, so the filter is
  `show ? items : items.filter(i => !i.nsfw)` and then `blurNsfw={blur}`.
- **`Card` takes the entity and the effective flag** — pass `blurNsfw` to `CardGrid` and let it AND
  the item's own flag; do not pass `nsfw={false}` to "keep it simple".
- **A reveal does not survive a re-fetch.** It is per mount by design; paging in keeps earlier cards
  (keyed `@for`), but a new fetch that replaces `items` re-blurs. That is the spec's one-view rule.
- **The prefs store is read, not copied.** Read the pair through the store (a `track(...)` over it or
  the existing subscribe shape) so flipping a toggle re-renders the grid without a re-fetch.
- **NSFW is not access control**: `/character/<id>` still resolves (T-10). No redirect, no 404.
- **Signed out**, the control leads to `/authentification` (`nsfw.md`); `session.ts` still ships the
  seeded account, so the signed-out branch is only reachable through the overflow menu's preview
  switch.
- Debounce the search, keep the loading skeleton's shape equal to the grid's (1/2/3/4 cells).

## Open decisions

- Where the six states live: one `AsyncState` union in the page (Loading / Ready / Empty / Error) or a
  `@try` boundary. Pick one and record it in `DESIGN.md` → *States*.
- Sort options: the spec says `Sort` without naming options — propose `Newest` / `Top rated` and
  record the choice in `DESIGN.md` before implementing, since every later catalog inherits it.
- Whether the toolbar is sticky above the grid at 360 (two rows of controls plus toggles is ~120px of
  chrome). Recommended: not sticky — the shell already has a 56px top bar.

## Found while working (carried forward — keep this list growing)

- **`@empty` does not parse in ripple 0.4.7** although the skill doc shows it: it fails with
  `TS1144`/`TS1146` at the `@empty` token. `CardGrid` uses `@if (items.length === 0) … @else` instead.
  Until a version bump is proven, write the explicit branch.
- **A gallery stage cannot prove a viewport media query.** The `/dev/primitives` width chip resizes a
  fixed-width stage, so `.card-grid` always reported the columns of the *real* viewport; the grid
  section now sits outside the stage and says so. Any future breakpoint proof must resize the window.
- **`/dev/data` renders the NSFW fixture covered now** (`nsfw={character.nsfw}`): it hands the flag
  itself, with no Blur preference in play. A page that copies that line without the `&& blur` AND will
  cover flagged items even when the account turned Blur off.
- **Onboarding's uniqueness check sits inside `persistDraft`, which returns early when the display
  name is empty.** A user who types only a handle never gets the spec's `Username taken` (or any
  answer) and `Finish` stays disabled with no explanation — found while driving `/onboarding` in the
  DOM for T-07B. The spec wants the answer inline on the field: move `checkHandle` out of the draft
  write (check on settle, write only when valid). Not fixed.
- **Zod costs +26.4 KB gzip / +91 KB raw on the JS bundle**, because `router.ts` imports `isHandle`
  from `schema.ts` and drags zod into the boot chunk. `zod/mini` (or a lazy router import) is the
  lever if a bundle budget is ever named.
- **`z.uuid()` is stricter than the router's `[0-9a-f-]{36}`.** They agree on every real id today; if
  the router ever needs them to agree exactly, give the id segment a schema predicate the way
  `[user.username]` now uses `isHandle`.
- **A new fixture id bucket must go through `ids.ts`.** Hand-written ids are exactly the drift the
  schema check now catches at load.
- **`Toggle.disabled` is a plain boolean** (`Field.error` and `Button.disabled` are `Derived` now):
  same frozen-prop trap, unfixed until a page needs a live one.
- **`disabled={!derived}` is always false.** A prop expression is evaluated once, so the *derived*
  must be handed over (`disabled={blocked}` where `blocked = track(() => !canFinish.value)`).
- **`repo.saveProfile` + `session.setAccount` is the pair for any account write.** The adapter owns
  the row, the session owns the screen; `savePreferences` is the pair's sibling for the NSFW two.
- **`src/specs/components/` has only `comment-thread.md` and `report.md`** — the card has no spec file
  of its own, so `luaplot-pages.md` §Conventions plus `DESIGN.md` are the law for it.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. Neither is a product control (T-30
  deletes both).
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
- **`Card` has no post branch.** A post has a body and no `name`/`tagline`; keep it out of `Card` until
  T-13 rather than bending the authored union.

## After this

T-10 `/character/[id]` — identity, attached lorebooks (including unavailable ones), counts + ratio,
the vote/bookmark actions and the report entry.

# Baton — what the next session does

**Ticket: T-10 — `/character/[id]`, the read/vote surface.**

Brief: this file. Spec: `src/specs/pages/character/detail.md` (it carries the settings menu, the
in-session name, the lorebook list and the Start/Continue wording), `systems/nsfw.md` →
*With Show off, a detail route still resolves*, `components/report.md` (the dialog itself is T-12).
`docs/DESIGN.md` → *Card and grid* + *Catalog* are the settled look.

**Scope, deliberately narrow.** This ticket is identity + attached lorebooks + counts and ratio +
vote + bookmark + the owner's moderation notice + the settings menu shell (**Bookmark**, **Edit**,
and the entries whose targets land later). **Fork and Start/Continue are T-10B** — they need adapter
writes (`forkCharacter`, `createSession`) that do not exist yet, and `createSession` must be written
to T-15's copy rule rather than guessed here. Do not build them in T-10.

Why next: every card in the catalog links here, and this page is where the product's engagement rules
live (one vote per viewer, counts on detail, ratio shared with the card). T-11 (comment thread) and
T-12 (report dialog) both mount on this page, so it has to exist first.

## Approach

1. Read the spec, then `src/lib/data/memory.ts` → `getCharacter`, `vote`, `isBookmarked`,
   `toggleBookmark`, and `src/lib/data/types.ts` → `ratioOf`, `EntityOf`.
2. **The id.** The page needs its route param, and the router does not expose one to pages yet
   (`useQuery()` only). Add `useParams()` to `src/router.ts` if `currentRoute().params` is not
   enough — do not parse `location.pathname` in the page.
3. **Reveal on a Show-off detail route:** the body is withheld behind the same per-item `Reveal` the
   card uses, while the header (name, author, ratio) stays. Do **not** reuse `Card` — a detail page
   is not a card; reuse the *pattern* (`revealed = track(false)`, a scrim sibling, a 44px button) and
   keep the numbers crisp.
4. **Vote and bookmark are adapter calls**: `repo.vote(kind, id, direction)` returns the updated
   entity, `repo.toggleBookmark` returns `{ bookmarked }`. Render what the adapter returned rather
   than recomputing counts in the page.
5. **Attached lorebooks:** `item.lorebookIds` → `repo.getLorebook` each; a `null` answer stays in the
   list as an unavailable row (the spec: *an attachment that no longer resolves stays listed as
   unavailable rather than disappearing*).
6. **Non-owner on a private row:** `memory.ts`'s `getCharacter` returns any row by id, so the page
   owns the rule — if `!item.isPublic && item.author !== viewer`, render the "unavailable" state; the
   owner sees the moderation notice instead. That split is the one visibility rule the adapter
   deliberately leaves to the page.
7. Mobile first at 360×740, then 640 / 900 / 1200. At `lg` a detail page becomes two columns
   (main + 320px aside) per `docs/DESIGN.md` → *Layout law*.

## Traps

- **A prop expression is evaluated once.** Anything that changes while the page is open (a vote
  count, the bookmark state, the reveal) must be a `track(...)` read inside the template, or handed
  to a primitive as a `Derived` — `Button.disabled`, `Field.error`, `CardGrid.items`, `Card.blur` all
  already carry that fix. Do not invent a fourth shape for it.
- **Nothing in a component body that can be inline.** A `const` (or a `track()`) declared ahead of an
  `@if`/`@for` silently rendered *nothing* in `CardGrid` under ripple 0.4.7; read `read(prop)` in the
  template instead.
- **A same-specificity media override in a scoped `<style>` did not win.** Scope it with a
  descendant selector, as `.controls-filter .filter-note` does in the catalog page.
- **`@else {` with two nodes needs a fragment** `<>…</>`, or the compile fails with "A code block
  renders a single node".
- **No self-vote exemption**: the author votes like anyone and the vote counts in the ratio
  (`detail.md`, settled in the spec pass).
- **This page shows both raw counts and the percentage**; a card keeps only the percentage. Do not
  "simplify" it back to one number.
- **NSFW is not access control**: a Show-off visitor still gets the route, never a 404.
- The owner's **Request public again** has no adapter method yet — if it stays unbuilt, say so in a
  comment and leave the button out rather than faking a write.

## Open decisions

- **Where the settings menu lives.** The spec puts a settings button in the page header (New Session,
  Bookmark, Report, Edit) and the shell already owns a top-bar overflow (Bookmarks, Moderation, Terms,
  the preview switch), so this is a *second* menu on one screen. Keep it inside the page's own header
  row, not the shell, and record the placement in `DESIGN.md`.
- **Counts layout at 360**: one row (like / dislike / ratio / comments) or two. Pick, record, keep the
  44px targets.
- **Whether the `lg` aside carries the lorebooks** or they stay in the main column. Choose, record,
  and make it the rule for every detail page.
- **No private character fixture owned by `you` exists**, so the owner's moderation notice cannot be
  rendered at all. Add one through `ids.ts` and check the catalog does not list it — see the first
  item under *Found while working*.

## Found while working (carried forward — keep this list growing)

- **`visible()` in `memory.ts` is "public **or mine**", so a private character owned by the viewer
  would appear in the public catalog.** A listing should see public rows only; owner visibility is
  the detail page's rule. Not fixed — settle it with T-10's private fixture (it changes what the
  catalog returns, so it needs a check at the same time).
- **A `const` (or `track()`) in a component body ahead of `@if`/`@for` rendered nothing** under
  ripple 0.4.7 — the whole branch vanished, no error. `CardGrid` works only because its props are
  read inline. Found in T-09.
- **A page's scoped `<style>` cannot touch a primitive's elements.** `.toolbar .field`,
  `.prefs .toggle` and `.pager .btn` matched nothing — a real phone rendered a 26px search box and a
  two-line `Top rated`. Wrap the primitive in a page-owned element and place that. Found in T-09,
  fixed the same day.
- **An `auto` grid column sized by a long caption starves its neighbour.** The "only filter" sentence
  took 331px of a 592px row and left the search field 26px; the caption is gone.
- **A prop holding an array or a flag is frozen at the call.** `CardGrid.items`, `CardGrid.blurNsfw`
  and `Card.blur` accept `Derived<…>` for exactly that reason; `Toggle.disabled` is still a plain
  boolean.
- **`@empty` does not parse in ripple 0.4.7** although the skill doc shows it (`TS1144`/`TS1146` at
  the token). Write the explicit `@if (…length === 0) … @else` branch.
- **A gallery stage cannot prove a viewport media query.** Any breakpoint proof must resize the
  window; CDP `Emulation.setDeviceMetricsOverride` works and is how T-09 measured 1/2/3/4 columns.
- **`/dev/data` passes `nsfw={character.nsfw}` only**, so with T-09's split it draws crisp — it needs
  `blur` to show a covered card.
- **Onboarding's uniqueness check sits inside `persistDraft`, which returns early when the display
  name is empty.** A handle-only visitor never gets `Username taken` and `Finish` stays disabled with
  no explanation. Not fixed.
- **Zod costs +26.4 KB gzip / +91 KB raw on the boot chunk** (router imports `isHandle`). `zod/mini`
  or a lazy router import is the lever if a bundle budget is named.
- **`z.uuid()` is stricter than the router's `[0-9a-f-]{36}`.** They agree on every real id today.
- **A new fixture id bucket must go through `ids.ts`.** Hand-written ids are the drift the schema
  check catches at load.
- **`disabled={!derived}` is always false.** Hand over the derived (`disabled={blocked}`).
- **`repo.saveProfile` + `session.setAccount` is the pair for any account write**; `savePreferences`
  is its sibling for the NSFW two.
- **`src/specs/components/` has only `comment-thread.md` and `report.md`** — the card has no spec of
  its own, so `luaplot-pages.md` §Conventions plus `DESIGN.md` are the law for it.
- `session.ts` still seeds `you` signed in and the overflow menu still carries the *Preview only*
  switch; `/dev/state` shows the pair and the emit counters. T-30 deletes both.
- `publish.sh` compares the live bundle hash; a Pages 200 alone can still be the previous deploy.
- **`Card` has no post branch.** A post has a body and no `name`/`tagline`; keep it out of `Card`
  until T-13.
- **Characters are 27 now; lorebooks 6, presets 5, personas 3, posts 12.** The other listings cannot
  show `Load more` or the end-of-list note until they have a second page — grow them when their
  ticket needs the proof, the way T-09 grew characters.

- **`Select` and `TagPicker` exist now** (`src/components/`, styled in `styles.css`): a native
  `<select>` in the app's chrome, and the multi-select tag field the catalog uses. Any filter or
  enumeration a later page needs should reuse them rather than grow a segmented row or a custom
  dropdown — the catalog's segmented sort was replaced on the owner's call for exactly that reason.
- **Tags are authored, and the 27 characters now carry ten of them** (`artisan, authority, creature,
  debt, family, ghost, harbor, ritual, sea, shopkeep`). `repo.listTags(kind)` is the vocabulary a
  filter offers; lorebooks and presets still have none, so their filters would open empty until their
  fixtures are tagged.

## After this

**T-10B** — fork + Start/Continue, brief in `docs/tickets/T-10B-fork-and-session-control.md`. Then
T-11 mounts the comment thread on the detail page.

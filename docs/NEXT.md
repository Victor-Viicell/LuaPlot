# Baton — what the next session does

**Ticket: T-37 — accessibility and performance pass, measured rather than asserted.**

Spec: `docs/CONTRACT.md` → *Engineering law* (mobile first, tap targets ≥ 44px, no horizontal scroll at
any width); `docs/DESIGN.md` → *Tokens (never hard-code a colour)*, *Type*, *States*, *Motion*;
`src/specs/luaplot-pages.md` → *Conventions* (the parts every page shares).

Why next: **P3 is closed** — T-26, T-26B, T-27, T-28 and T-28B all landed, and the last one removed the
only known lie left in the app (a post could not be removed while the spec said it is the only
enforcement a post has). P4 (T-29…T-32) is **blocked on this machine**: no Supabase project ref and no
`supabase` CLI (`which supabase` → nothing, no `supabase/` directory), so its migrations, RLS and edge
functions cannot be applied or verified — writing SQL nobody can run would be a ticket that ships an
UNVERIFIED claim. T-37 is the first ticket that is both unblocked and honestly verifiable here.

## Approach

1. **Measure first, then fix — the perf half is mostly done, so record it.** The published build is
   `dist` 1.1 MB, every JS chunk 728 KB raw / **186,716 B gz**, CSS **23,783 B gz** across 236 KB raw,
   and the only asset over 40 KB is one woff2 subset (JetBrains Mono Latin, 40,404 B; the Cyrillic,
   Greek, Vietnamese and Latin-ext subsets are 7.5–15 KB each). The ticket's `< 300 KB gz` budget is
   already met; the job is to **write the number down** in PROGRESS and stop chasing it.
2. **What is genuinely unproven is the accessibility half.** Walk a handful of pages — `/` (home),
   `/post/thread`, `/post/[id]`, `/character/[id]`, `/bookmarks`, `/moderation?admin=1` — at 360×740
   and at ≥1280, and check four things per page:
   - **focusables have names**: `cdp('Accessibility.getFullAXTree')`, filter to `role` in
     `button|link|textbox|combobox|radio|checkbox|tab`, and list every node with an empty `name`;
   - **focus order is DOM order**: tab through with `js` + `document.activeElement` and confirm the
     sequence visits the header, the content and the aside in reading order (no positive `tabindex`);
   - **contrast ≥ 4.5:1 for body copy**: compute WCAG ratios for the **token pairs actually used**
     (`--color-text` / `--color-text-subtle` on `--color-surface`, `--color-bg`, the accent on the
     surface, the success/danger pairs) straight out of `src/styles.css`, in one throwaway script —
     no new dependency, no axe;
   - **no layout shift on fonts**: confirm `font-display` on the `@fontsource-variable` faces (swap,
     not block) and that the shell's header height does not change when the woff2 lands.
3. **Fix only what fails, with a token, never a hex.** A failing pair is corrected at the token in
   `src/styles.css` (Catppuccin's own ramp already has the next step) and the page that reads it
   inherits the fix — a `#fff` on a page is a bug even when it passes.
4. **Record every measurement** in `docs/PROGRESS.md` (numbers, not adjectives) and any decision that
   is not obvious in `docs/DESIGN.md`.

## Traps

- **No new dependency** for this ticket: not axe-core, not lighthouse. `cdp` + a 20-line contrast
  function covers both claims, and a dependency added for an audit is a dependency shipped forever.
- **A repo-root command is not a page walk.** `scripts/check.sh` proves the build, nothing about
  focus order; the accessibility claims need the browser, and the preview's runtime rows die on a hard
  reload — walk in-app.
- **`--color-text-subtle` is the usual suspect** on `--color-surface` (it is used for 12px labels and
  the back links) — measure it before changing it, and remember `docs/DESIGN.md` fixes its job, so a
  darker step must keep the hierarchy.
- **An icon-only control needs a name in the DOM**, not in a comment: `aria-label` on the button, and
  `<a>`/`<button>` still cannot nest.
- **A component's root element cannot be styled** and an `@if` branch is one node — a focus fix lands
  inside the component or not at all.
- **The tap-target rule is 44px, not 44 CSS px of text**: the hit area is the `min-height`/
  `min-width` of the control, and the nav hosts already carry 44px rows — do not shrink one to fix
  spacing.

## Open decisions

- If a token pair fails at 4.5:1 and the next Catppuccin step changes the visual weight of a whole
  surface, **fix the pair locally with a named semantic token** (e.g. a `--color-text-subtle-strong`)
  rather than stepping the shared token and re-painting every page.
- Bundle budget met means the perf work is *recording*, not optimising: do not start code-splitting
  routes that already lazy-load.

## Found while working (carried forward — keep this list growing)

- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()` (the one write both
  `applyJevAction` and `concludeReport` make: status flipped, thread deleted in cascade, vote dropped,
  row kept), `livePost()` filters `listPosts`/`profilePosts`, `getPost` still answers by id, the
  bookmarks tab reads a removed post as a dead card, `/post/[id]` draws the spec's *Removed by JEV*
  sentence plus one finality line for the author. Post 6 is seeded `removed`; walk it at
  `/post/90570000-0000-4000-8000-000000000006`.
- **A post's removal keeps no placeholder.** The comment rule (*a placeholder keeps its replies*) has
  nothing to hang on when the item itself is gone, so `removePost` deletes the comments — the spec says
  so in *Privacy and republication*.
- **The ticket's copy lost to the spec.** T-28B proposed *This post was removed by moderation.*;
  `post/detail.md` → *Removed by JEV* fixes the same sentence as a deleted post, so that is what the
  page prints. Do not "improve" it back.
- **`counts` drift after a removal**: concluding a post's case deletes its comment rows, so the
  fixture counts in this file (22 comments) describe the **seed**, not a walked session.
- **The case page's *THE ITEM* panel does not re-render after *Conclude*** — it still shows the
  target's body until reload. Not a spec violation, worth a look if T-37 touches that page.
- **T-28 is done**: `moderationNoticeSchema` + `republicationOutcomeSchema`; `repo.moderationNotice`
  answers one shape from two sources; `repo.requestRepublication` is owner-only, authored-only, runs
  `classify()` at once; `addReport`'s immediate branch writes the creator's notification **and** the
  notice row. The three authored detail pages draw the notice, the gate (`updatedAt > notice.at`) and
  the three states.
- **A refused republication rewrites the gate clock** (`noticeAt = outcome.at`) and sets
  `verified: false` — the next edit is what makes it eligible again.
- **An immediate action files no report row** (T-27/T-28): only the creator's notification and the
  notice row are stored.
- **`assets: []` is deliberate** (T-27): no vision pass, so an image-only report escalates
  (`imageOnly`) instead of asking a text model to judge a picture (T-32).
- **A new case needs `history: []`** — build cases through `reportSchema.parse`.
- **`event` is a DOM global**: name history helpers `historyEvent`.
- **`@for` needs `const`**: `@for (const row of rows; key row.id)`; **an `@if` branch renders one
  node** — wrap header+body in `<>…</>`; **`effect()` is the only lifecycle hook**; **`{<Component />}`
  inside a fragment is a parse error**.
- **A gate named for the positive is a bug waiting**: `disabled={!canRequest.value}` is the shape that
  works with `Button`.
- **The preview loses runtime rows on a hard reload** — every flow that writes must be walked
  **in-app**; a `goto_url` re-seed looks like a bug in the write (it cost this session one false
  "removal did not stick" reading).
- **Counts now: characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12
  (11 listed, post 6 removed), reports 5 (3 open, 2 concluded), comments 22 (one removed placeholder),
  sessions 2, bookmarks 8 (one dead), notifications 6 (3 unread), profiles 7, follow edges 15.**

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

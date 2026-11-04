# Progress log

Append-only. Newest first. Every entry: ticket, what changed, what was verified and how, what
could not be verified.

## 2026-11-03 — T-82: `/onboarding`'s `sm 640` form measure and action row are rendered in both directions

- **Changed:** `src/pages/onboarding.tsrx` + row 44 of `scripts/smoke.mjs` (**extended, no new row** —
  `EXPECTED_ROWS` stays **55**) + `docs/DESIGN.md`. The `sm` block's `.actions .btn { width: auto;
  min-width: 200px }` was **dead**: a page's scoped `<style>` cannot reach the `Button` primitive's own
  element, and the rule did not even survive compilation (the built `onboarding-*.css` carries no
  `.actions … .btn` selector at all). The page now wraps the `Button` in a page-owned `.primary` (the
  shape `.search` / `.prefs` / `.pager-action` already use), sizes *that* at `sm`, and `btn-block`'s
  100% fills it — so 360's full-width submit is untouched. The row's ladder runs on its **second**
  visit, inside the restore's `try`, after `resumed` is read and **before** the restore's
  retype/Finish pair: `640×740`, `900×740`, `360×740`, one `readSetup()` per width into
  `assertSetup(r, width)`, nothing pressed (a settle here would fire the draft write and claim the
  borrowed handle). Measured: at 640 `max-width 520px`, `.setup` **520** in an outlet whose content
  box is **572** (620 box), `.actions` row/centre/gap 16px, `.primary` `24→224` **200** `min-width
  200px`, `.btn` `200`, note `240→456` **216** cap `216.002px`; at 900 the same 520 inside **730**
  (794 box), `.primary` `122→322`, note `338→554`; at 360 `max-width none`, `.setup` **308** = the
  outlet's 308 content box, `.actions` column/gap 10 (308), `.primary` and `.btn` at the column's full
  width with no 200px floor.
- **Verified:** red first. Deleting `.setup { max-width: 520px }` from the `sm` block put row 44 red at
  *"/onboarding at 640px: .setup measures 572 in an outlet whose content box is 572 (620 box) — the sm
  block caps it at 520"*. Putting the rule **back on the primitive** (wrapper unsized) put it red at
  *".primary measures 85.25, not the 200px its floor asks for"* — 85.25 is the button's own content
  width, which is the dead rule proved. Bytes restored (`cp` + `cmp` identical), `check.sh` **GREEN**,
  `./scripts/smoke.sh` **55/55** local, `publish.sh` → `LIVE`, `curl` **200**, `./scripts/smoke.sh
  --live` **55/55**.
- **Not verified / next:** a throw anywhere in row 44 after the claim still cascades into row 45 (the
  row's own `catch` leaves the account as `@onboarding_walk`), so a red run reads 53 PASS / 2 FAIL
  rather than 54/1 — expected, not a second bug. The outlet is a **content** box fact: its box is 620
  at 640 and its content 572 (24px of padding each side), 794/730 at 900 — a row that compares
  `.setup` to the outlet's border box is red on a right page (this tick's first run, 308 vs 340).
  `.note`'s `30ch` resolves to `216.002px` on this tree, so assert it is a finite length inside the
  row, never a constant. Next: **T-83** — `/authentification`'s `sm 640` 420 measure, the other entry
  screen, whose `.providers` / `.nsfw` / `.status` caps have never been rendered (row 1 mounts it at
  the walk's own ~500px). No new dependency, no schema/adapter/JEV change, no store write.

## 2026-11-03 — T-81: `/persona`'s `sm 640` and `lg 900` toolbars are rendered in both directions

- **Changed:** `scripts/smoke.mjs` only — **row 51 extended, no new row** (`EXPECTED_ROWS` stays
  **55**). The T-68 journey's new **§D** runs after its last press (`sortPass`), mounts `/persona`
  once, then takes `640×740`, `900×740` and `360×740` in that ladder, one `readBar()` per width into
  `assertBar(r, width)`. 640 asserts the `sm` block: a `grid`, **exactly two** tracks, both fluid and
  **equal within 1px** (a `minmax(0, 1fr)` pair, so neither is sized against a constant), `.search`
  spanning **both** of `.toolbar`'s edges, `.sort` and `.create` below the field (`top >
  search.bottom − 1`) sharing row 2 by their **bottoms** (`align-items: end`), `sort.left <
  create.left`, `.create .btn`'s `min-width: 120px`, and the button filling its column. 900 asserts
  the `lg` rewrite: **three** tracks with the middle one `200 ± 1`, all three children on one line
  (`search.left < sort.left < create.left`) sharing a bottom, and `.create .btn` at exactly
  **120px** — the `auto` track is the one place the sm block's floor binds. 360 asserts the base:
  `display: flex` (not a grid, so `tracks` is `[]`, T-73), the three children stacked in DOM order,
  and `.create .btn` at the column's full width with `min-width` no longer `120px`. One `finally`
  clears the override and `innerWidth` is asserted back. Measured at 640 `["283px","283px"]` gap
  `16px`, search `24→606` (the whole bar), sort `24→307`, create `323→606`, both bottoms `283.58`,
  `.btn` `283px` / `min-width 120px`; at 900 `["378px","200px","120px"]`, search `122→500`, sort
  `516→716`, create `732→852`, three bottoms `205.98`, `.btn` `120px`; at 360 `flex`, `[]`, search
  `16→324` top `127.59`, sort top `209.19`, create top `290.78`, `.btn` `308px` / `min-width 0px`.
- **Verified:** red first — deleting `.search { grid-column: 1 / span 2 }` from
  `persona-collection.tsrx`'s `sm` block put **row 51 alone** red (54 PASS / 1 FAIL) reading
  *"/persona at 640px: .search spans 24→307 in a toolbar 24→606 — the sm block pins it across both
  columns (grid-column 1 / span 2)"*: the page, the width and both edges, as the accept line asked.
  Bytes restored (`cp` + `cmp` identical; `git status` shows only `scripts/smoke.mjs`), `check.sh`
  **GREEN** (all ten sections), `./scripts/smoke.sh` **55/55**, `publish.sh` → `LIVE` (asset
  `index-DPoxP2Sr.js`, unchanged: no built source moved), `curl` **200**, `./scripts/smoke.sh --live`
  **55/55**.
- **Not verified / next:** the ticket's own sketch of `.create .btn` was wrong — **`width: auto` on a
  block-level flex container is the fill, not the content**, so at 640 the button measures the whole
  283px column and the 120px floor cannot bind there; the assertion records the fill plus the floor
  and proves the floor at 900, where the `auto` track sizes to it. `getComputedStyle().width` is
  always a used length, so no row can assert the keyword `auto` at all. `.sort`'s 1fr column is
  fluid here (283px), unlike `/bookmarks`' fixed 220px column — the two `sm` toolbars look alike and
  are not. No press, no store row, no preference, no schema/adapter/JEV change, no new dependency.
  `/onboarding`'s `sm` block is the next copy of this class — filed as **T-82**.

## 2026-11-03 — T-80: `/post/thread`'s `sm 640` controls are rendered in both directions

- **Changed:** `scripts/smoke.mjs` only — **row 39 extended** (no new row; `EXPECTED_ROWS` stays
  **55**). The T-55 journey's new **§7** runs after its paging half (where no read follows, and
  nothing is pressed — a `go()` there would drop the appended page), takes `640×740` then `900×740`,
  reads one `readControls()` at each and hands it to `assertControls(r, width)`. At 640 it asserts
  `.controls` computes a `grid`, **exactly three** tracks with the **first `200 ± 1`**, `.sort` and
  `.create` sharing row 1 by their **bottoms** (`|create.bottom − sort.bottom| ≤ 2`, `align-items:
  end`), `.prefs` **below both** (the `640–899` block's `grid-row: 2`), `.prefs` starting at the
  controls' left edge and running on **past the sort column** (its own box is content-sized —
  `justify-self: start` — so the right edge is the pair's, not the band's), `flex-direction: row`,
  `.feed` gap `16px` and `.pager-action`'s 200px minimum **only while the pager is drawn**. At 900 it
  asserts the opposite direction: **four** tracks with the **first `220 ± 1`** (the `md` block), and
  `.prefs` back on row 1 between the sort and Create. Both overrides clear in one `finally` and
  `innerWidth` is asserted back. Measured at 640: `["200px","238.75px","85.25px"]`, gap `24px`, sort
  `24→224` bottom `180.39`, prefs `24→445.63` top `204.39` (row), create `510.75→596` bottom
  `180.39`, pager min-width `200px`; at 900 `["220px","421.625px","16.375px","0px"]`, sort
  `117→337`, prefs `361→782.63`, create `737.75→823`.
- **Verified:** red first — deleting `.prefs`' `grid-column: 1 / -1` from the range block put **row 39
  alone** red (54 PASS / 1 FAIL) reading *"/post/thread at 640px: .prefs starts at 248 in a controls
  box starting at 24 — the range block puts the pair across the width …, not in the middle column it
  squeezed to 115px"* — the page, the width and both lefts, as the accept line asked. Bytes restored
  (`cp` + `cmp` identical; `git status` shows only `scripts/smoke.mjs`), `check.sh` **GREEN** (all ten
  sections), `./scripts/smoke.sh` **55/55**, `publish.sh` → `LIVE` (asset `index-DPoxP2Sr.js`,
  unchanged: no built source moved), `curl` **200**, `./scripts/smoke.sh --live` **55/55**.
- **Not verified / next:** the baton's own red proof (`grid-row: 2`) **walks green** — the pair spans
  all three columns, so auto-placement cannot fit it on row 1 beside `.sort` and `.create` and puts
  it on row 2 anyway; recorded in `docs/NEXT.md`. `.feed`'s 12px base gap and the 360 stacking are
  unread (row 39 runs at the session's ~500px and asserts nothing there). At 900 the `md` block
  declares four tracks but `.create` stays in column 3, so **track 4 resolves `0px`** and the button
  still ends the row — measured, not a bug. No new dependency, no schema/adapter/JEV change.

## 2026-11-03 — T-79: `/bookmarks`' `sm 640` toolbar is rendered in both directions

- **Changed:** `scripts/smoke.mjs` only — **row 50 extended** (no new row; `EXPECTED_ROWS` stays
  **55**). The T-67 journey's new **§9** runs after its last tab press (where no read follows) and
  takes `640×740` then `360×740`, reading one `readToolbar()` at each and handing it to
  `assertToolbar(r, width)`. At 640 it asserts `.toolbar` computes a `grid`, **exactly two** tracks
  with the **second `220 ± 1`** (count *and* size — T-77's lesson), `.search` spans the toolbar
  (`left`/`right` within 1px), `.sort` is below the search (row 2), **`|sort.bottom − meta.bottom| ≤
  2`** (one row, bottom-aligned by `align-items: end` — the saved count *beside* the sort, which is
  the whole `sm` fact), `meta.left < sort.left − 1`, `sort.left` inside the 220px column plus its
  16px gap, and `.pager > div`'s 200px minimum **only when a pager is drawn**. At 360 it asserts the
  opposite: **one** track, `sort.top > search.bottom − 1`, `meta.top > sort.bottom − 1` (stacked, one
  per row). Both overrides are cleared in one `finally` and `innerWidth` is asserted back. Measured
  at 640: `["336px","220px"]`, gap `12px 16px`, search `24→596` of toolbar `24→596` bottom `276.98`,
  sort `376→596` bottom `354.58`, meta `24→360` bottom `354.58` (`2 saved`); at 360 `["308px"]`,
  gap `10px`, search bottom `268.19`, sort top `278.19` bottom `343.78`, meta top `353.78`.
- **Verified:** red first — deleting `.meta { grid-column: 1; grid-row: 2 }` from `bookmarks.tsrx`'s
  `sm 640` block put **row 50 alone** red (54 PASS / 1 FAIL) reading *"/bookmarks at 640px: .sort
  ends at 354.58 and .meta at 385.77 — the sm block puts them on one row (grid-row: 2), so the saved
  count sits beside the sort, not under it"* — the page, the width and both bottoms, as the accept
  line asked. Bytes restored (`cp` + `cmp` identical; `git status` shows only `scripts/smoke.mjs`),
  `check.sh` **GREEN** (all ten sections), `./scripts/smoke.sh` **55/55**, `publish.sh` →
  `LIVE=https://victor-viicell.github.io/LuaPlot/` (asset `index-DPoxP2Sr.js`, unchanged: no built
  source moved), `curl` **200**, `./scripts/smoke.sh --live` **55/55**, same evidence line.
- **Not verified / next:** the ticket's own `|sort.top − meta.top| ≤ 2` was **wrong on a right page**
  (tops read `288.98` vs `335.39`: the two boxes are bottom-aligned and their heights differ), so the
  row asserts the **bottoms** — recorded in `docs/NEXT.md`. `.pager > div`'s 200px and `.pager {
  align-items: center }` are still unwalked here (the lorebook tab draws no pager); 32 page files
  still carry a `sm 640` block no row has ever rendered, and the next one is `/post/thread`'s
  `.controls` (**T-80**), which has **two** stacked media blocks. No new dependency, no
  schema/adapter/JEV change this tick.

## 2026-11-03 — T-78: `/user/[handle]`'s `sm 640` head is rendered in both directions

- **Changed:** `scripts/smoke.mjs` only — **row 46 extended** (no new row; `EXPECTED_ROWS` stays
  **55**). The T-63 journey's `§5` takes a `640×740` and then a `360×740` override after the Cancel
  assertions, reads the same `readHeadAt()` on each and hands both readings to `assertHead(r, width)`,
  which asserts the breakpoint **in both directions**: at 640 `.profile-head` is a `grid` of exactly
  **three** tracks with the first `72 ± 1`, avatar/who tops within 2px, `who.left ≥ avatar.right`,
  **`|head-action.top − head-avatar.top| ≤ 2`** (the action on the avatar's own row — the whole `sm`
  fact), and `.name` **26px**; at 360 **two** tracks with the first `56 ± 1`, `head-action.top >
  head-avatar.top + 1` (its own row) and `.name` **22px**. `.pager > div`'s `min-width: 200px` is read
  **only when the listing draws a pager** (it does not on this tree) so the row never asserts one into
  being. Both overrides are cleared in one `finally` and `innerWidth` is asserted back afterwards.
  Measured at 640: `["72px","225.188px","238.812px"]`, gap `18px`, avatar/who/action tops **80/80/80**,
  `who.left 114`, `.name` **26px**; at 360: `["56px","238px"]`, gap `14px`, tops **76/76**, action top
  **218.95**, `.name` **22px**.
- **Verified:** red first — deleting `grid-template-areas: "avatar who action";` from
  `user-profile.tsrx`'s `sm 640` block put **row 46 alone** red (54 PASS / 1 FAIL) reading
  *"/user/you at 640px: .head-action sits at top 208.66 and the avatar at 80 — the sm block puts the
  action on the avatar's own row (grid-template-areas \"avatar who action\"), and the base block
  drops it to row 2"* — the page, the width and both tops, as the accept line asked. Bytes restored
  (`cp` + `cmp` identical; `git status` shows only `scripts/smoke.mjs`), `check.sh` **GREEN** (all
  sections), `./scripts/smoke.sh` **55/55**, `publish.sh` → `LIVE=https://victor-viicell.github.io/LuaPlot/`
  (asset `index-DPoxP2Sr.js`, unchanged: no built source moved), `curl` **200**, `./scripts/smoke.sh
  --live` **55/55** with the identical two-arm evidence line.
- **Not verified / next:** `.pager > div`'s 200px minimum and `.pager { align-items: center }` are still
  unwalked — the profile's creations tab draws no pager on this fixture — and 32 other page files
  still carry a `sm 640` block no row has ever rendered; the next one is `/bookmarks`' toolbar
  (**T-79** in `docs/NEXT.md`), whose two-column rewrite has a documented near-bug behind it. No new
  dependency, no schema/adapter/JEV change this tick.

## 2026-11-03 — T-77: the three detail pages' `sm 640` arm is rendered, and row 54 is width-major

- **Changed:** `scripts/smoke.mjs` only — **row 54 extended a third time** (no new row;
  `EXPECTED_ROWS` stays **55**). The row's page-major phases (`360 → 1200 → pair 360 → pair 1200`,
  four overrides) became **width-major**: `SPLIT_WIDTHS = [360, 640, 1200]` takes **one** override
  per width and mounts `SPLIT_PAGES` (character, lorebook, preset) inside it, so nine readings cost
  **three** overrides and a fourth width is one array entry. `assertPhone()` became
  `assertSplit(r, { label, path, width, counts })`, which answers all three widths: 360/640 keep the
  phone `.cols` facts (`flex`/`column`, no grid tracks, `aside.top < main.top − 1`, one width for
  both halves), 640 adds the `sm` block (`.head` a grid of **exactly three** tracks with the first
  `320 ± 1`, the portrait beside the identity rather than over it, `h1.title` **34px**, `.prose`
  **15px**, lorebook's `.entry-text` **15px** when drawn, `.vote`/`.save` `min-width: 132px` with
  `flex-grow: 0` — the last four read as **computed strings**, since a rect cannot prove a
  `min-width` the row never has to fill), and 1200 keeps the two-track `lg` grid. The single `read()`
  grew `headDisplay`/`headTracks`/`portrait`/`identity`/`titleFont`/`proseFont`/`entryFont`/
  `vote`/`save`/`start` rather than forking a second reader, and `evidence()` prints per width.
  Measured at 640, identical on all three pages: `.head` `grid → ["320px","168px","44px"]`, portrait
  right **344** ≤ identity left **364**, tops **80/80**, title **34px**, prose **15px** (lorebook
  entry **15px**), vote/save **132px grow 0**, `.cols` still `flex column` (aside top **469** < main
  **594.8**, both **572** inside the 620px outlet), `scrollWidth 630/640`. At 360 the same pages read
  title `26px`, prose `14px`, vote/save `96px grow 1`; at 1200 `["362px","320px"]`.
- **Verified:** red first — deleting `grid-template-columns: 320px minmax(0, 1fr) auto;` from
  `preset-detail.tsrx`'s `sm 640` block put **row 54 alone** red (54 PASS / 1 FAIL) reading *"preset
  at 640px: the head's first track resolves to \"290.797px\" (tracks [\"290.797px\",\"197.203px\",\"44px\"]),
  not the 320px cover column the sm block declares"* — the page, the width and the track list, as
  the accept line asked. Bytes restored (`cp` + `cmp` identical; `git status` shows only
  `scripts/smoke.mjs`), `check.sh` **GREEN** (all sections), `./scripts/smoke.sh` **55/55**,
  `publish.sh` → `LIVE=https://victor-viicell.github.io/LuaPlot/` (asset `index-DPoxP2Sr.js`, the
  same file as the previous publish because this ticket touches no built source), `curl` **200**,
  `./scripts/smoke.sh --live` **55/55**.
- **Not verified / next:** the facts this row asserts are still hand-written in **three** separate
  `<style>` blocks — nothing makes the three detail pages agree except this row — and the
  profile page's own `sm 640` head (`72px | name | action`, one row) has never been rendered either →
  **T-78** in `docs/NEXT.md`. No new dependency, no schema/adapter/JEV change this tick.

## 2026-11-03 — T-76: the lorebook and preset detail pages' phone arm is rendered

- **Changed:** `scripts/smoke.mjs` — **row 54 extended again** (no new row; `EXPECTED_ROWS` stays
  **55**). The row's character-only phone block became one shared `assertPhone(r, { label, path,
  counts })`, and `phoneEvidence()` prints the same three facts for all three pages. Phase order is
  **character 360 → character 1200 → the lorebook+preset pair at 360 → the pair at 1200**: the
  override is browser-level and survives `go()`, so each phase re-takes it (4 overrides, not 6) and
  every reading asserts `innerWidth` instead of assuming the width carried over. Per page at 360:
  `.cols` computes `flex`/`column` with **no** grid tracks (the display is read first — a flex box's
  `gridTemplateColumns` is the literal `none`), `aside.top < main.top − 1`, `|aside.width −
  main.width| ≤ 1`, both inside the outlet, and — only when drawn — four `.count` cells. Measured:
  lorebook *Ashmarket Gazetteer* aside **545.58** < main **723.38**, preset *Long Table* **515.69** <
  **641.48**, character **572.38** < **802.17**, all three 308px inside the 340px outlet, 4 count
  cells each, `scrollWidth 350/360`. The 1200 arm is unchanged (lorebook and preset both
  `["362px","320px"]`, aside left 747 ≥ main right 715, tops 477/477). No page file touched: both
  pages were right — this ticket is the missing measurement, which is why the red proof is a
  deletion.
- **Verified:** red first, and the ticket's own edit worked this time (T-75's did not): deleting
  `order: -1` from `preset-detail.tsrx`'s base `.aside` block put **row 54 alone** red — 54 PASS /
  1 FAIL — reading *"preset at 360px: .aside sits at top 1102.64 and .main at top 515.69 — the aside
  is not above the description, so a reader scrolls the whole prose to find Like (order: -1 is the
  mobile argument)"*; the other 54 rows and the row's own 1200 arm stayed green. Bytes restored
  (`cp` + `cmp` + `sha256sum -c`, identical; `git status` shows only `scripts/smoke.mjs`),
  `check.sh` **GREEN** (all 8 sections), `./scripts/smoke.sh` **55/55**, `publish.sh` →
  `LIVE=https://victor-viicell.github.io/LuaPlot/` (branch `gh-pages`, sha `1c41276`, asset
  `index-DPoxP2Sr.js`), `curl` **200**, `./scripts/smoke.sh --live` **55/55**.
- **Not verified:** nothing on a real device — the 360/1200 measurements are Chromium's
  `Emulation.setDeviceMetricsOverride`; a physical phone's WebKit layout is still T-36's blocked arm.

## 2026-11-03 — T-75: the lorebook and preset detail pages' own copies of the `lg` split are rendered

- **Changed:** `scripts/smoke.mjs` — **row 54 extended** (no new row; `EXPECTED_ROWS` stays **55**).
  `lorebook-detail.tsrx` and `preset-detail.tsrx` each carry their own `<style>` copy of the three
  `lg` rules T-73 measured on `character-detail` (`.cols` = `minmax(0, 1fr) 320px`, `.aside`
  `grid-column: 2; grid-row: 1; order: 0`, `.main` `grid-column: 1; grid-row: 1`), and no row had ever
  rendered either. After the character page's 1200 read the row mounts
  `/lorebook/10eb00c5-…0002` then `/preset/9e5e7000-…0002` (`…0001` is rows 42/43's refusal road) with
  `go()`, waits for `.cols .main` **and** a non-empty `h1.title` (a skeleton or not-found arm cannot
  pass), and asserts per page: `.cols` is a grid of exactly two tracks, the second resolves to
  320px ± 1, `.aside.left ≥ .main.right`, `|aside.top − main.top| ≤ 2`, no horizontal scroll, and —
  only when the page draws one — four `.count` cells. Measured: lorebook *Ashmarket Gazetteer* and
  preset *Long Table* both `["362px","320px"]`, aside left **747** ≥ main right **715**, tops
  **477/477**, 4 count cells, `scrollWidth 1190/1200`. The override stays live across both mounts,
  the same `finally` clears it, and `innerWidth` is asserted back.
- **Verified:** red first — but **not** the edit the ticket named. Deleting `grid-column: 2;` from
  the lorebook `lg` block walks **GREEN**: `.main` is explicitly placed at `grid-column: 1; grid-row:
  1`, so `.aside`'s own `grid-row: 1` auto-places it into the first free cell of row 1 — column 2 —
  and `grid-column: 2` never binds. The red proof that works is aiming at the aside's placement,
  `grid-column: 2` → `grid-column: 1`: **row 54 alone** red (54/55) reading *"lorebook: at 1200px
  .aside spans 353–715 and .main ends at 715 — the aside is not beside the description, it is under
  it (this file's own grid-column: 2 is the rule that places it)"*. Bytes restored (`cp` + `cmp`,
  identical; `git status` shows only `scripts/smoke.mjs`), `check.sh` **GREEN**, `./scripts/smoke.sh`
  **55/55**, `publish.sh` → `LIVE=…/LuaPlot/` (asset `index-DPoxP2Sr.js`), `curl` **200**,
  `./scripts/smoke.sh --live` **55/55**.
- **Not verified:** nothing on a device. The row's own vocabulary (titles, count cell values) is read
  from the page, never pinned. `lorebook-detail` / `preset-detail` are still free to drift from
  `character-detail` in ways the row does not measure (their phone-arm `order: -1`, their `sm`/`md`
  blocks) — this row only fixes the facts all three share at 1200.

## 2026-11-03 — T-74: the moderation case's split (a `md 900` flex row) is rendered by a walk

- **Changed:** `scripts/smoke.mjs` — **row 55** (`EXPECTED_ROWS` 54 → 55, read-only). `moderation-detail`
  is the fourth detail page and the only one whose composition differs: `.cols` is a flex column on a
  phone and a flex **row from 900** (not 1200), `.aside` is `flex: 0 0 340px` with
  `position: sticky; top: 24px`, and nothing sets `order` — the panel sits *below* the description.
  The row opens `/moderation/4e90047a-0000-4000-8000-000000000002?admin=1` (row 20's road; row 20 has
  already concluded that case, so the aside draws the decision record — the composition is identical),
  reads the title and `case · post` kicker off the page, takes its own `900×740` and `1200×740`
  overrides, settles two frames each, clears them in a `finally`, then **asserts** `innerWidth` came
  back. At 360: `.cols` `flex`/`column`, no grid tracks, aside **below** main (931.02 > 234.39), both
  308px inside the 340px outlet, computed `position: static`, no horizontal scroll. At 900: `.cols`
  `flex`/`row`, aside **340** beside the main (left 507 ≥ main right 475), tops equal (218.39/218.39),
  `sticky` / `top: 24px`, no horizontal scroll. At 1200 the same facts.
- **Verified:** red first — deleting `flex: 0 0 340px` from the `md` block put **row 55 alone** red
  (54/55) reading *"at 900px .aside measures 111.05px, not the 340px the md block fixes (flex: 0 0
  340px) — main 586.95px, .cols 730px"*. Bytes restored (`git checkout --` + `cmp`, identical),
  `check.sh` GREEN, `./scripts/smoke.sh` **55/55**, `publish.sh` → `LIVE`, `curl` **200**,
  `./scripts/smoke.sh --live` **55/55**.
- **Not verified:** nothing on a device (no Android toolchain); `position: sticky` is asserted by the
  computed `position`/`top`, never by a scrolled offset — a real scroll would need a taller case page
  than the fixtures hold. The tag-vocabulary press is still un-walkable (owner decision, unchanged).

## 2026-11-03 — T-73: the detail pages' `.main` + `.aside` split is rendered by a walk

- **Changed:** `scripts/smoke.mjs` — **row 54** (`EXPECTED_ROWS` 53 → 54, read-only). Four detail pages
  share one `lg` composition (`.cols`: a column of `.main` + `.aside` on a phone, a two-column grid from
  1200 with a 320px aside) and no row had ever taken an override on it. The row opens
  `/character/c0a1b2c3-0000-4000-8000-000000000002` (the page rows 6/32/40 already use, one Like left
  behind by row 40), reads the name off the page, takes its **own** `360×740` and `1200×740` overrides,
  settles two frames each, clears them in a `finally`, then **asserts** `innerWidth` came back. At 360:
  `.cols` is `flex` `column` with **no** grid tracks (a flex box's `gridTemplateColumns` is `none`, so
  tracks are only read when the display is a grid), `.aside` is **above** `.main` (`order: -1`), both
  are 308px inside the 340px outlet, four `.count` cells, no horizontal scroll. At 1200: `.cols` is a
  grid of `["362px","320px"]`, `.aside` sits at `left 747 ≥ main right 715`, both columns start at
  `top 477`, four count cells, no horizontal scroll.
- **Verified:** red first — deleting the mobile `.aside { order: -1 }` from `character-detail.tsrx` put
  **row 54 alone** red (53/54) reading *"at 360px .aside sits at top 1276.13 and .main at top 572.38 —
  the aside is not above the description, so a reader scrolls the whole prose to find Like"*; bytes
  restored (`git checkout --` + `cmp` against `HEAD`, `git status` showing only `scripts/smoke.mjs`).
  `check.sh` **GREEN**, `publish.sh` → `LIVE` (`assets/index-DPoxP2Sr.js`), `curl` **200**, **54/54**
  local and **54/54** `--live`. Row 54's evidence: `"Sonic the Hedgehog" · at 360: .cols "flex" "column"
  → 0 track(s), aside top 572.38 < main top 802.17, both 308px inside the outlet 0–340, 4 count cells,
  scrollWidth 350/360 · at 1200: .cols grid → ["362px","320px"] (aside 320px), aside left 747 ≥ main
  right 715, tops 477/477, 4 count cells, scrollWidth 1190/1200`.
- **Not verified / found:** `lorebook-detail` and `preset-detail` carry the same three `lg` rules and are
  read by no row either — the row proves the shared shape on one page, so a divergence introduced in the
  other two would need its own row. `moderation-detail` is a **different** composition (a flex row from
  `md 900`, `flex: 0 0 340px` sticky aside, no `order` at all) and is filed as **T-74**. Also found:
  `scrollWidth` is 350/360 and 1190/1200 on a right page (`scrollbar-gutter: stable`), so the row asserts
  `scrollWidth > innerWidth`. Lessons are in `docs/NEXT.md` → *Found while working*.

## 2026-11-03 — T-72: `/terms`' desktop rail is rendered by a walk for the first time

- **Changed:** `scripts/smoke.mjs` — **row 53** (`EXPECTED_ROWS` 52 → 53, read-only). `/terms` is the
  only page with a page-level desktop composition (`.contents`: 200px, sticky, `display: none` below
  1200) and no row had ever taken an override on it: row 52 proves the copy at the walk's own 500×653.
  The row takes its **own** `360×740` and `1200×740` overrides (`measureAt()` is `/dev/primitives`-only),
  settles two frames each, clears them in a `finally`, then **asserts** `innerWidth` came back (T-32).
  At 360: `.contents` computes `none`, `.doc` is one track (flex, read through `gridTemplateColumns`'
  own `none`, which is why the display is printed beside the count), `.lede` and every `.note-body` fit
  inside `.outlet`, no horizontal scroll. At 1200: `.contents` computes `flex`, measures 200px and is
  `sticky`, `.doc` is a grid of exactly two tracks whose prose column is ≤ 720 (`minmax(0, 720px)`),
  the rail's `.contents-link` **fragments equal the page's heading ids in the page's own order** (read
  from `.rule[id]`/`.note[id]`, never pinned to eight anchors), every fragment resolves to an element,
  no horizontal scroll.
- **Verified:** `check.sh` **GREEN** (section 10 on the rebuilt bundle: `62 asset(s), 620 KB, 233
  inline tag(s)`), `publish.sh` → `LIVE`, `curl` **200**, **53/53** local and **53/53** `--live`. Row
  53's evidence: `at 360: .contents "none" (0px), .doc "flex" → 1 track, widest paragraph 308 inside
  the 340px outlet, scrollWidth 350/360 · at 1200: .contents "flex" 200px sticky, .doc grid →
  ["200px","458px"] (prose 458px ≤ 720), 8 rail link(s) matching the 8 heading id(s) … every fragment
  in the DOM, scrollWidth 1190/1200`. Red first: removing the `lg` block's `display: flex` from
  `.contents` (the rule the ticket says may "never turn on") put **row 53 alone** red (52/53) reading
  *"at 1200px .contents computes to \"none\" and measures 0px — the lg rail never turns on above 1200,
  so the page is a stretched phone with a hidden nav"*. Bytes restored (`cp` back, `cmp` clean, `git
  status` showing only `scripts/smoke.mjs`).
- **Not verified / found:** the ticket's own red proof — `.doc`'s `lg` rule changed to
  `grid-template-columns: 200px minmax(0, 1fr)` — walks **GREEN, 53/53**. The prose track resolves to
  458px either way: the shell's 794px A4 outlet (minus 40px padding each side, minus the 200px rail and
  its 56px gap) caps it long before 720 binds, so the `≤ 720` assertion is a guard for a wider outlet,
  not a measurement of the measure rule today. Also found: `scrollWidth === innerWidth` is false on a
  right page here (`html { scrollbar-gutter: stable }` → 350 at 360, 1190 at 1200), so the row asserts
  `scrollWidth > innerWidth` like rows 30/31/32. Both lessons are in `docs/NEXT.md` → *Found while
  working*.

## 2026-11-03 — T-71: `/terms` is mounted by a row, and its one clause is proved twice

- **Changed:** `scripts/smoke.mjs` — **row 52** (`EXPECTED_ROWS` 51 → 52), the last route in
  `src/router.ts` that no row named. It mounts `go("/terms")` and asserts the page by its own marks
  (`.kicker` *content rules*, `h1.title` *Three prohibitions*, a non-empty `.lede`, **no `.detail`**),
  the five `section.note` ids **in the page's own order** each with a `.note-title`, the three
  `.rule-title`s read from `TERMS_RULES` (count + distinctness, never pinned text), and the
  accepting-the-terms paragraph's words (`Finishing onboarding is the acceptance` / `beside Finish`,
  with `Finishingonboarding` / `besideFinish` named as the failure). Whitespace is collapsed **in
  Node**, so the page expression carries no regex and the T-49 double-escaping trap cannot reach it.
  Then a document mark (`markDocument`), a press on the sentence's own link
  (`#accepting-the-terms p a`), the landing read as `/onboarding`'s heading, `expectNoReload`, and
  `history.back()` polling back to the terms heading with the mark intact. Read-only: no override, no
  store write, no preference, no query. `docs/NEXT.md` rewritten for T-72, `SHIP-PLAN.md` ticked.
- **Verified:** red first, aimed at the copy clause — dropping the `{" "}` before *is* in
  `terms.tsrx` gave **51/52** with **row 52 alone** failing: *"/terms' accepting-the-terms paragraph
  reads \"Finishing onboardingis the acceptance: …\" — it is missing [\"Finishing onboarding is the
  acceptance\"]"*; bytes restored with `git checkout -- src/pages/terms.tsrx` (the `{" "}` greps back
  at line 400). Then **52/52** local (`./scripts/smoke.sh`) and **52/52** `--live`,
  `./scripts/check.sh` → **GREEN** (section 10 on the rebuilt bundle: `62 asset(s), 620 KB, 233
  inline tag(s); no literal is glued to an inline element`), `publish.sh` → `LIVE` with
  `assets/index-DPoxP2Sr.js`, and `curl` the site root → **200**.
- **Not verified:** the dynamic half of the word break (`{n}<strong>followers</strong>` — a value with
  no trailing space glues exactly like a literal, and no scan can see it) is still unguarded; the
  fragment link on `/terms` is asserted only as *the id exists in the DOM*, because a fragment press
  is a document load by design (`ARCHITECTURE.md` → Router). `/terms` at `lg` (its 200px contents
  rail) has still never been rendered by a walk — filed as **T-72**.

## 2026-11-03 — T-70: the word break has a gate section, and the gate found an eighth site

- **Changed:** new `scripts/wordbreak-check.mjs` (node stdlib only): scans `dist/assets/*.js` for a
  letter/digit/dot/paren glued to an inline opening tag (the inline set is one constant —
  `a|b|span|strong|em|code|i|small`; block tags are exempt because whitespace beside a `div` carries
  no word break) and for a closing tag glued to the following word. Zero hits is green, each hit
  prints ~60 chars either side, and file arguments let the red proof run on a copy. Two drift guards:
  no assets, or no inline tag at all, is a red. `scripts/check.sh` gained **section 10** (`==
  wordbreak`), placed after the build because the compiled bundle is the truth. `dev-native.tsrx`'s
  lede writes `never needs a{" "}` (it rendered *"needs atry"* on `/dev/native`, the sweep's eighth
  site) and its note writes `read{" "}<b>cancelled</b>`; `docs/ARCHITECTURE.md` gained *Copy and
  markup*; `PagePlaceholder`'s stale "every route renders" sentence corrected (no route imports it);
  `SHIP-PLAN.md` T-70 ticked, `NEXT.md` rewritten for T-71.
- **Verified:** `node --check scripts/wordbreak-check.mjs`; `check.sh` → **GREEN** with `62 asset(s),
  620 KB, 233 inline tag(s); no literal is glued to an inline element` on section 10; red proof from
  **one** injected copy (`$TMPDIR/red-wordbreak.js`, injected by `$TMPDIR/inject-wordbreak.mjs`) —
  `2 literal(s) are glued to an inline element:` naming *"…page never needs a<code>try</code>…"* (an
  opening tag) and *"…</a>if to render “nothing happened”…"* (a closing tag), exit 1, tree untouched;
  the seven T-69 sites pass unchanged (their `{" "}` is a separate piece, so no glue); `publish.sh`
  printed `LIVE=https://victor-viicell.github.io/LuaPlot/` and `curl` answered **200** on the first
  attempt; `smoke: 51/51 journeys` local and `51/51 --live`.
- **Not verified:** the scan's dynamic blind spot — `{n}<strong>followers</strong>` produces no letter
  in the source and glues just the same if the value has no trailing space; nothing gates that half
  (recorded in `ARCHITECTURE.md`, filed as a note for T-71's brief, not a row). `EXPECTED_ROWS` is
  unchanged at 51 by design.

## 2026-11-03 — T-69: a sentence that lost its word break, and the class behind it

- **Changed:** `src/pages/persona-collection.tsrx` — the no-match sentence writes `</a>{" "}if it is not
  here yet.` (an explicit space node, not a literal), so Ripple's trimming of a literal that follows an
  element cannot eat the word break. The **same edit swept the whole class** in the built bundle:
  `terms.tsrx` (both sides of the *onboarding* link — `Finishing<a>onboarding</a>is` — and *beside*
  before *Finish*), `onboarding.tsrx` (*accept the* / *terms of use*), `persona-detail.tsrx`'s picker
  sentence (*No characters yet.* / *Create one*), `user-profile.tsrx`'s two figures
  (`</strong> followers` / `following`), and the dev pages' badge rows (`dev-data` adapter/viewer/page,
  `dev-state` session/handle/admin, `dev-native` shell/chunk/title/last/never/through plus its own
  code samples, `dev-primitives` *author and ratio* / *Press Reveal on it*). `scripts/smoke.mjs` — row
  **51** gained one clause (no row added; `EXPECTED_ROWS` stays 51): the sentence must contain
  `Create one if` and must not contain `oneif`, and its evidence line now reads *with its word break*.
  Docs: `SHIP-PLAN.md` (T-69 ticked), `NEXT.md` (T-70 baton + three new notes).
- **Verified:** red first, aimed at the one site — the literal put back (bytes otherwise identical) →
  **50/51**, row 51 alone: *"/persona: the no-match sentence reads \"No persona matches that name.
  Create oneif it is not here yet.\" — it runs the words either side of the link together (the DOM
  drops a literal's leading space after </a>; the source needs an explicit {\" \"})"*. Bytes restored
  (the file's diff is one word), then **51/51** locally and **51/51 `--live`** against
  https://victor-viicell.github.io/LuaPlot/ (curl **200**; `publish.sh` printed
  `LIVE_JS=assets/index-CswUCCHj.js`). The live row reads `?q=zzqx-nothing-matches` →
  `"No persona matches that name. Create one if it is not here yet."`. The sweep itself was checked
  against the **compiled** bundle, not the source: `grep -oE
  "[A-Za-z0-9.)]<(a|b|span|strong|em|code|i|small)[ >][^\"\`]{0,50}"` and the mirror
  `"</(a|b|span|strong|em|code|i|small)>[A-Za-z]…"` listed **6** real breakages before the edits
  (`/terms`, `/user`, `/dev/native` ×3, `/dev/primitives`) and read **zero** after the build — which
  is why the seven `{" "}` sites above are exactly the ones the bundle needed.
- **Not verified:** the sweep's mechanism is **not** in the gate — row 51 proves `/persona` only, and
  the other six sites are proved by a hand grep over `dist` (recorded above so T-70 can make it a
  section). `/terms`' own sentence has no row, and the `/dev/*` pages have none either. Also open:
  the tag vocabulary for lorebooks/presets is still the owner's decision (row 51's press branch waits
  on it, unchanged from T-68).

## 2026-11-03 — T-68: the other three toolbars, one press each

- **Changed:** `scripts/smoke.mjs` — new walk **row 51**, `EXPECTED_ROWS` 50 → 51, read-only: a
  `TOOLBAR_PAGES` table of the three query-committing pages T-66 moved and no row had typed into
  (`/lorebook/catalog`, `/preset/catalog`, `/persona`) with one shared reader, and three passes per
  catalogue — a fresh mount (no `?q=`/`?tags=`/`?sort=`, empty field, Newest selected, the grid's own
  label), the silent search (a word from the first row's own name, `?q=` committed **with the caret
  still in the field**, then a mount from that URL preloading the field and drawing the same rows),
  the tag field, and the sort (`?sort=ratio` / **Top rated**; `/persona`'s `?sort=name` / **Name**
  with the names ascending). `/persona` also asserts the no-match state is its own sentence and
  offers **no** Retry. No product code changed. Docs: `SHIP-PLAN.md` (T-68 ticked), `NEXT.md` (T-69
  baton + three new "found while working" notes).
- **Verified:** red first — `lorebook-catalog.tsrx`'s `writeQuery()` swapped to
  `navigate(path, { replace })` (with `void commitQuery;` to keep it type-clean) → **50/51**, row 51
  alone: *"/lorebook/catalog: the search field lost the caret the moment it settled
  (document.activeElement is BODY., the field reads "Cartographer's", URL "?q=Cartographer%27s") —
  a query write that emits remounts the page mid-typing"*; bytes restored (`git status` clean of the
  page). Then **51/51** locally and **51/51 `--live`** against
  https://victor-viicell.github.io/LuaPlot/ (curl 200; `publish.sh` printed
  `LIVE_JS=assets/index-BWZZlNKL.js`). Row 51 evidence: `/lorebook/catalog` reads `""` with **5**
  cards, `?q=Cartographer's` narrows to **1** and keeps the caret, `?sort=ratio` reads **Top rated**;
  `/preset/catalog` reads `""` with **4** cards, `?q=Two-Hander` narrows to **1**, same sort;
  `/persona` reads `""` with **2** persona cards, `?q=Ash` narrows to **1**, `?sort=name` reads
  **Name** with `["Ash","The Correspondent"]`.
- **Not verified:** the **tag chip's press** — every lorebook and preset fixture ships `tags: []`
  (`src/lib/fixtures/lorebooks.ts`, `presets.ts`), so the picker's menu is legitimately empty and its
  vocabulary (`listTags`) has nothing to offer. Row 51 asserts that empty state (the picker's own *"No
  other tags yet."*) **and** the URL→field→adapter road a pasted `?tags=archive` still proves (chip
  prints, 0 cards, *"Nothing matches those filters."*, Clear filters restores the listing), and its
  press branch is written and will run the day a fixture carries a tag. Filed as **T-69**. Also
  unverified: the ticket's `recent`/`oldest` sort vocabulary was wrong — both catalogues are
  `newest`/`ratio` (`SORT_OPTIONS`), only `/persona` has `oldest`/`name`; row 51 reads the pages'
  own values.

## 2026-11-03 — T-67: the saved page's tabs are the query, and a tab pressed on itself leaves the search

- **Changed:** `src/pages/bookmarks.tsrx` — `chooseTab()` no longer returns early when the pressed tab
  is the one already selected: a same-tab press is *this tab, unfiltered*, so it clears `draft` and
  `applied`, cancels a settle timer that has not fired, and (only when there was a search to clear)
  commits `?type=<same>` with a `push` and reloads. `scripts/smoke.mjs` — new walk **row 50**,
  `EXPECTED_ROWS` 49 → 50. Docs: `DESIGN.md` → *Bookmarks* (the press rule and why the search
  survives a *different* tab), `SHIP-PLAN.md` (T-67 ticked), `NEXT.md` (T-68 baton + four new
  "found while working" notes).
- **Verified:** `./scripts/check.sh` GREEN (30 routes, schema, 52 links, tiers, history *4 write(s),
  all in src/router.ts*). Walk **50/50** locally and **50/50 `--live`** against
  https://victor-viicell.github.io/LuaPlot/ (200; `publish.sh` printed
  `LIVE_JS=assets/index-BWZZlNKL.js`, and the live `index.html` already referenced that bundle when the
  walk started). Row 50's evidence: *a fresh /bookmarks writes "?type=character" (the default tab
  "character", counts [3,2,1,2]) · pressing "Lorebooks" pushed "?type=lorebook" and drew 2 row(s) of
  "Saved lorebooks" · a mount from ?type=lorebook draws the same ["The Salt Archive","Ashmarket
  Gazetteer"] · ?sort=name reads "Title A–Z" at "?type=lorebook&sort=name" with the titles ["Ashmarket
  Gazetteer","The Salt Archive"] ascending, and Back returns "?type=lorebook" with 2 row(s) · typing
  "Archive" committed "?type=lorebook&q=Archive" with 1 of 2 row(s) and **kept the caret** (activeElement
  INPUT.field-input) · a mount from ?type=lorebook remounted the whole tab (2 row(s), field "") · a sort
  under the search reads "?type=lorebook&q=Archive&sort=name" and Back returns
  "?type=lorebook&q=Archive" with the field holding "Archive" · the Lorebooks tab, pressed on itself,
  cleared the search to "?type=lorebook" with 2 row(s) and an empty field*.
- **Red first, twice, aimed separately** (the first edit aborted row 50 *before* its seam clause, so
  the second edit was aimed at that clause alone): (1) dropping `mountedKey = …` from `commitQuery()`
  → 47/50, row 50 at *"Back to return the unsorted tab — read {"search":"?type=lorebook",…,
  "titles":["Ashmarket Gazetteer","The Salt Archive"],…}"* with `sortValue` still `name` (the URL
  dropped `?sort=` and the select kept it); (2) `if (mode === "push") mountedKey = …` — a **replace**
  commit leaves the key stale, which is T-66's own shape — → 47/50, row 50 alone at the seam:
  *"a mount from ?type=lorebook (the URL the page wrote before the search) to remount the whole tab —
  read {"search":"?type=lorebook",…,"count":1,"titles":["The Salt Archive"],"field":"Archive",
  "focused":true}"*. Rows 48 and 49 went red with it both times (they walk the same seam from the
  catalog's side). `src/router.ts` restored from a copy taken before the first edit — `git diff
  src/router.ts` is empty, so the tree that passed is the tree that was measured.
- **Not verified:** nothing new. The row is read-only (no store write, no preference), it does not
  touch `/dev/*`, and it takes no CDP override.

## 2026-11-03 — T-66: the router owns the mounted key, and a page's query write reaches it

- **Changed:** `src/router.ts` — new `getMountedKey()`/`setMountedKey()` (the `path + search` the shell
  has actually mounted; `emit()` never touches it) and the new **`commitQuery(search, mode)`**: writes
  history, refreshes `state`, moves the mounted key, **no `emit()`** (an emit remounts the page and the
  settled search field loses the caret). `src/App.tsrx` — the private `lastKey` is gone, the effect's
  guard reads `getMountedKey()` and records the key it mounts. Seven pages' `writeQuery()`/`writeSort()`
  now call `commitQuery()` instead of `history.pushState`/`replaceState`
  (`character-catalog`, `lorebook-catalog`, `preset-catalog`, `persona-collection`, `bookmarks`,
  `post-thread`, `user-profile`), and their header comments say so. **Gate section 9** is new:
  `scripts/history-check.mjs` fails the build if any file but `src/router.ts` mentions
  `history.pushState`/`replaceState` (proved red with a one-line probe file, then removed).
  `scripts/smoke.mjs` — new walk **row 49**, `EXPECTED_ROWS` 48 → 49, and **row 48's `go("/")`
  workaround is deleted** (its bare-route hop now remounts, and the row asserts that instead of
  assuming it). Docs: `DESIGN.md` → *Catalog* (the commit seam and its two consequences),
  `ARCHITECTURE.md` → *Router* (mounted key + `commitQuery`), `SHIP-PLAN.md` (T-66 ticked),
  `NEXT.md` (T-67 baton + three new "found while working" notes).
- **Verified:** `./scripts/check.sh` GREEN (30 routes, schema, 52 links, tiers, new history section:
  *4 history write(s), all in src/router.ts*). Walk **49/49** locally and **49/49 `--live`** against
  https://victor-viicell.github.io/LuaPlot/ (200; `publish.sh` printed `LIVE`). Row 49's evidence:
  *typing "Lamplighter's" committed "?q=Lamplighter%27s" with 1 of 20 card(s) and kept the caret in the
  field (activeElement INPUT.field-input) · the switcher's Characters tab cleared the query, the field
  and the grid (20 card(s), "") · a second settle then the bottom bar's Catalog tab did the same
  (20 card(s), "", crumb "/character/catalog")*. The first `--live` run walked
  `assets/index-0WXkfKKh.js`; the commit's comment-only edits changed the bundle hash, so `publish.sh`
  was re-run (`assets/index-B3OaSzoU.js`) and the walk re-run against **that**: the first attempt read
  **46/49** — three `/dev/state` rows timed out on their own toggles, the recorded mid-propagation chunk
  404 — and the re-run 60s later was **49/49**. No row was touched between them.
- **Red first, twice, aimed separately** (a full revert red-lit two rows and the earlier aborted the
  later, so the caret clause never got its run): (1) dropping `mountedKey = …` from `commitQuery()` →
  47/49, row 48 *"the bare catalog to remount after the settle's commit — read
  {…,"count":1,"field":"Lamplighter's"}"* and row 49 *"the settle to commit q="Lamplighter's" — read
  {…,"count":1,"field":"Lamplighter's"}"*; (2) `character-catalog`'s `writeQuery()` calling
  `navigate(path, {replace})` instead → **48/49, row 49 alone in 729ms**: *"the search field lost the
  caret the moment it settled (document.activeElement is BODY., the field reads "Lamplighter's", URL
  "?q=Lamplighter%27s") — a query write that emits remounts the page mid-typing"*. Bytes restored
  (only the intended diff is in `git diff`).
- **Not verified:** the other six pages' own query writes are **unwalked** — row 49 proves the seam on
  `/character/catalog` only (`/bookmarks`' `push` tabs, the preset/lorebook catalogs and `/persona` are
  filed as T-67/T-68). No iOS/Android pass (no toolchain, T-35); the walk's Chromium is the only
  engine. Nothing about Supabase moved (still the memory adapter, T-29 blocked).

## 2026-11-03 — T-65: the catalog's search, tags and sort, and the 250ms settle

- **Changed:** `scripts/smoke.mjs` only — new walk **row 48**, `EXPECTED_ROWS` 47 → 48, after row 47
  and before `sign out` (**read-only**: no store write, no preference touched). It reads the
  vocabulary off the page it is about (the first card's own title, one of its tags, and a tag on a
  card that does **not** carry the first), then: (1) types that title into `input[name="q"]` one
  character at a time and reads `location.search` between keystrokes — **13 samples inside the 250ms
  window, none carrying `q=`** — and after the settle reads the **whole** word and the narrowed grid
  (1 of 20 cards, its own card still present); (2) leaves the catalog and comes back to
  `?q=<word>` and proves the field is **preloaded** from the URL and the listing is the same one;
  (3) `?q=zzqx-nothing-matches` reads *Nothing matches those filters.* with 0 cards, **no Retry** and
  a **Clear filters** control; (4) `?sort=ratio` puts **Top rated** on the control and draws 22 ratios
  that never rise, **Newest** drops the param and restores the order, `history.back()` returns both
  the listing and the control; (5) `?tags=ghost` narrows to 5 cards that all carry it (the hidden
  `is-measure` mirror is what makes a card's own tags readable), its chip's own remove control
  rewrites the URL to `""` and the grid back to 20; (6) `?tags=ghost,artisan` draws **4 ghost-only +
  7 artisan-only** (either, not both) and removing `artisan` leaves `?tags=ghost`; (7) at 360 the
  first card folds `+2` behind its `+N` chip, the floating list holds exactly those two tags and closes
  on the scrim — the override cleared in `finally` with `innerWidth` asserted back.
- **Verified:** `./scripts/check.sh` GREEN (30 routes, schema, links, tiers), walk **48/48** locally
  and **48/48 `--live`** against https://victor-viicell.github.io/LuaPlot/ (200). Red first, aimed at
  the clause the debounce assertion exists for: `onSearchInput` calling `applySearch(next)` on every
  keystroke → *"the search wrote the URL 13 time(s) while \"Lamplighter's\" was still being typed
  (read [{\"typed\":\"L\",\"search\":\"?q=L\",\"elapsed\":75},{\"typed\":\"La\",\"search\":\"?q=La\",…}]) — a
  per-keystroke writer, not the 250ms settle"* (47/48, failing in 1.2s). The bytes restored
  (`git checkout -- src/pages/character-catalog.tsrx`, `git status` clean for it), so the green run is
  the proof.
- **Not verified / found:** two. (a) **A page's own query write never reaches the router.** The
  settle commits with `replaceState`, so `router.state.search` and `App.tsrx`'s `lastKey` still say
  `/character/catalog`; a `go()` back to that URL therefore does **not** remount (the row's first run
  read `{"search":"","count":1,"field":"Lamplighter's"}` for twelve seconds on a page that was
  right), and a reader who presses the **Catalog** tab in that state keeps the narrowed grid while the
  address drops the query. The row routes through `go("/")` and back as a workaround; the defect is
  filed as **T-66** with the fix, the rejected `navigate()` route (it would blur the search field on
  every settle) and the red proof. (b) `catalog.md`'s *"an item with none renders no row and no
  placeholder"* has **no page to read**: all 28 fixture characters carry at least one tag and this row
  is read-only, so the empty-tags case stays untested until a tagless fixture exists.
- **Publish:** `publish.sh` printed `LIVE` (the commit touches `scripts/` and `docs/`, so the bundle
  hash is unchanged), `curl` 200, and the live walk re-read all 48 rows against the published build.


## 2026-11-03 — T-64: the profile's four tabs, the type filter and the follower card

- **Changed:** `scripts/smoke.mjs` — new walk **row 47**, `EXPECTED_ROWS` 46 → 47, after row 46 and
  before `sign out` (**read-only**: no store write, no preference touched). It reads the session's
  own handle from `/`'s *Open profile* link (never pinning `you`), opens `/user/<own>` and asserts
  the head — name, `@handle`, bio, the two figures as `N followers` / `N following`, and the four
  tab labels in the spec's order — then marks the mounted `.profile-head` with a `data-walk-head`
  expando and presses each tab: `?tab=posts` / `followers` / `following`, the body swapped (the
  posts' `.feed .card.post`, the people's `.card-handle` cards, the creations' `.card-author`
  cards), `aria-selected` on the pressed pill, and **the marker survived** (a remount is the only
  honest proof the page was not re-booted). On creations it presses `Characters` (every card's
  title links `/character/`, the count matches the card count), `All` (`type` leaves the URL, the
  grid grows back), and proves a pasted `?tab=posts&type=preset` settles to `?tab=posts` with no
  type control. On followers it reads the first card's anatomy (title, `@handle`, the bio as
  `.card-tagline`, a two-figure footer, **no** `.card-author`, **no** `.card-ratio`), presses its
  title, asserts the landing's name **and bio** equal the card's (the bio lands in the tagline's
  slot), `history.back()`, and polls the search *and* the body back at `tab=followers`.
- **Verified:** `./scripts/check.sh` GREEN (30 routes, schema, links, tiers); walk **47/47** locally
  and **47/47 `--live`** against https://victor-viicell.github.io/LuaPlot/ (200). Red first, twice,
  each aimed at one clause the row exists for: `chooseTab`'s `load(1, "replace")` swapped for
  `loadCreations(1, "replace")` (a tab that renders another tab's body) → *"posts tab to draw its own
  body at tab=posts — read {"search":"?tab=posts","tab":"posts","typeRow":false,"posts":0,
  "empty":"No posts yet.","marked":true}"* (46/47); `UserCard`'s footer given a `.card-author` and a
  `.card-ratio` → *"the follower card grew [".card-author",".card-ratio"] (read {"title":"Ada
  Whitlock","handle":"@ada","tagline":"Slow-burn fantasy…","foot":["@ada","96%","4
  followers","3 following"],"author":true,"ratio":true}) — a person's card carries followers and
  following, never an author and a ratio"* (46/47). Both bytes restored (`git diff
  src/pages/user-profile.tsrx src/components/UserCard.tsrx` empty), so the green run is the proof.
- **Not verified / found:** the baton predicted the creations default would write **no** `tab`;
  the page writes `?tab=creations` on every boot (`writeQuery()` always sets it), so the row asserts
  the URL the page actually produces — the ticket's parenthetical was a hypothesis, the page is the
  fact. Rows 36-38's NSFW pair and row 38's extra flagged post are read dynamically here (the
  row counts `.card-author` cards and people cards, never a pinned total), so no seed came in
  contact with them. Row 47 presses **no Load more**: on this account's numbers (5 creations, 4
  followers, 2 following) every tab fits page 1, and a pager that does not exist cannot be pressed.
- **Publish:** `publish.sh` printed `LIVE` (`assets/index-AwPh3k_B.js` — unchanged, the commit only
  touches `scripts/`), `curl` 200, and the live walk re-read all 47 rows against the published build.

## 2026-11-02 — T-63: the edit page's forbidden state, taken handle and format error

- **Changed:** `scripts/smoke.mjs` — new walk **row 46**, `EXPECTED_ROWS` 45 → 46, after row 45 and
  before `sign out` (**read-only**: it presses **Cancel**, never **Save**). It reads the session's
  own handle from `/`'s *Open profile* link rather than pinning `you`, then `go("/user/ada/edit")`
  (a fixture account the walk does not hold) and asserts the spec's *Not the owner → forbidden*
  state: the URL **stays** at `/user/ada/edit` (no redirect), `.empty-copy` reads *You can't edit
  this account.*, there is no `input[name="username"]`, no display-name field and no **Save**, and
  *Back to your profile* points at the session's own `/user/<own>`. Then `/user/<own>/edit`: the
  form prefills the URL's handle with the row's name and bio and Save enabled; retyping the username
  to `ada` prints **`Username taken`** with Save disabled and no help line; `"ab"` prints the
  page's own rule sentence (captured from `.field-help` while the form was valid, never pinned) as
  its inline error with Save disabled and no duplicate help; the own handle again → error gone, the
  rule back as help, Save enabled. **Cancel** → `/user/<own>`, whose name, handle and bio are
  re-read and compared with the head taken before the form.
- **Verified:** `./scripts/check.sh` GREEN (30 routes, schema, links, tiers); walk **46/46** locally
  and **46/46 `--live`** against https://victor-viicell.github.io/LuaPlot/ (200). Red first, twice,
  each aimed at one clause the row exists for: deleting `|| myHandle !== urlHandle` from
  `boot()` → *"/user/ada/edit mounted the account form for a stranger (read
  {\"path\":\"/user/ada/edit\",\"copy\":\"\",\"username\":true,\"displayName\":true,
  \"save\":false,…}) — the gate is the route's, not the entry point's"* (45/46); dropping
  `&& !taken.value` from `canSave` → *"Save stayed enabled on @ada, a fixture handle (read
  {…\"error\":\"Username taken\",\"help\":\"\",\"saveDisabled\":false}) — a taken username must
  block the write"* (45/46). Bytes restored (`git diff src/pages/user-edit.tsrx` empty), so the
  green run is the proof.
- **Not verified:** the page's **Saving…** and **Save failed** states — the memory adapter's writes
  never fail and a Save is a write, so a read-only row cannot reach them without inventing a fault
  the product does not have (a ticket would need a fault hook in `repo`). The row also proves the
  error and help **agree**, not that either equals the spec's words independently: the sentence is
  read from the page, so a schema message that changed wrongly would still pass.
- **Publish:** `publish.sh` printed `LIVE` (`assets/index-AwPh3k_B.js`), `curl` 200, and the live
  walk re-read all 46 rows against the published build.

## 2026-11-02 — T-62: a rename out of /user/you/edit moves the row, the content and the graph

- **Changed:** `scripts/smoke.mjs` — new walk **row 45**, `EXPECTED_ROWS` 44 → 45, after row 44 and
  before `sign out` (mutating: it renames the walk's account out and back). It reads `/user/you`'s
  name, handle, bio, both follow figures and creations count from the page, mounts
  `/user/you/edit` and asserts the prefill (the URL's handle, the row's name and bio, **Save**
  enabled), retypes `input[name="username"]` to `edit_walk`, presses **Save**, and re-reads the
  landing: the same name, bio, figures and creations count, with the new handle; then `/user/you`
  answers *This user doesn't exist.* with no profile, the account's own comment reads `@edit_walk`,
  `/` reads `signed in as You` with *Open profile* at the new handle, and the way back (rename to
  `you`, Save) restores the whole pair with `/` read again.
- **Fixed:** `src/lib/data/memory.ts` → `renameAccount()` now moves `store.comments`' `author` with
  the authored collections, the follow edges, the claim set and the profile row. A comment is signed
  by its author's handle, so a rename that skipped it left every comment the account wrote reading
  `@you` on a profile that now answered not-found — `user/edit.md`'s *the account keeps its content*,
  broken while 44/44 rows stayed green.
- **Verified:** `./scripts/check.sh` GREEN (30 routes, schema, links, tiers); walk **45/45** locally
  and **45/45 `--live`** against https://victor-viicell.github.io/LuaPlot/ (200). Red first, twice,
  each aimed at one half of `renameAccount`: deleting the comment loop → *"the comment the account
  wrote reads \"@you\" after the rename, not @edit_walk — a comment is signed by its author, and the
  account keeps its content"* (44/45); deleting the authored-row loop → *"the renamed profile draws
  0 creation card(s), not 5 — the authored rows did not follow the handle"* (44/45). Bytes restored
  (`git checkout -- src/lib/data/memory.ts`, tree clean) so the green run stays the proof.
- **Not verified:** `joinedAt` (the adapter keeps it from the old row, but no page prints it, so the
  walk cannot read it); the persona dialog after a rename — it still lists because personas are
  owned by the constant `VIEWER`, not by the moving handle, which is a shape question for T-30
  (recorded in `docs/NEXT.md` → *Open decisions*).

## 2026-11-02 — T-61: claiming a handle on /onboarding is a gate, a refusal and one draft write

- **Changed:** `scripts/smoke.mjs` — new walk **row 44**, `EXPECTED_ROWS` 43 → 44, after row 43 and
  before `sign out` (mutating: the draft is a real `repo.saveProfile` write). It borrows `@you` from
  `/user/you`, asserts a **first visit is blank** (both fields, the rule as the handle's help line,
  the Show/Blur pair, Finish disabled, no error before a settle), reads `"ab"` → `HANDLE_RULE` with
  Finish disabled and the help gone, types the display name and proves a name alone opens nothing,
  reads `"Ada"` → **`Username taken`** with Finish disabled and no alternative named, claims
  `onboarding_walk` → `/user/onboarding_walk` (`Walk Through` / `@onboarding_walk`) and `/` reading
  `signed in as Walk Through` with *Open profile* at the new handle, revisits `/onboarding` (the pair
  **restored**), and hands `@you` back with `/` read again. Two product fixes found by the row:
  `src/lib/data/memory.ts` → new `renameAccount()` is the one body for a claim *and* a rename (profile
  row, every authored `author`, both sides of the follow graph, `CLAIMED_HANDLES`; a claim with no row
  creates one), shared by `saveProfile` and `saveProfileEdit`; `src/pages/onboarding.tsrx` → the
  uniqueness ask moved out of the draft to `askUniqueness()`, on the handle's own settle.
- **Verified:** `./scripts/check.sh` GREEN (build, 30 routes, schema, tauri, 52 anchors, 5822
  declarations); `./scripts/smoke.sh` **44/44** locally — row 44's evidence names `@you ("You")`, the
  blank form, both refusals with Finish disabled, the claim (`/user/onboarding_walk`,
  `signed in as Walk Through`, `Open profile` at the new handle) and the restore (`/user/you`,
  `signed in as You`); **red first** by dropping `&& !taken.value` from `canFinish` → *"Finish stayed
  enabled on a taken handle — @ada is a fixture handle and \"Ada\" must read taken case-insensitively"*
  (43/44), and (before that) by `blocked = track(() => false)` → *"Finish is enabled with both
  required fields blank"*; the bytes restored and `sha256sum -c` clean; `publish.sh` printed `LIVE`
  (`assets/index-CJXWGVpG.js`) and `curl` is **200**; `./scripts/smoke.sh --live` **44/44**.
- **Not verified:** nothing on this ticket — no Android/desktop half to it. The rename that
  `renameAccount` now serves from `/user/edit` is **written but not walked** (row 45 / T-62), and
  personas' `owner` is deliberately not moved by it (raised in the baton as T-62's likeliest find).

## 2026-11-02 — T-60: deleting a session takes its transcript and copies, and a published cut outlives it

- **Changed:** `scripts/smoke.mjs` — new walk **row 43**, `EXPECTED_ROWS` 42 → 43, placed after
  T-59's row 42 and before `sign out` (it deletes session 1 out of the memory store, so it is
  mutating and final). It finds row 42's cut as `/post/thread?sort=newest`'s first **`.card.post`** by
  its **body** (`ownCut`, no pinned post id), takes the card's `.post-time` permalink, and reads the
  whole cut on its own page (the thread card folds after two messages, so `.cut-turn` there is 2 of
  8). Then it opens the seed character (`…0001`) and presses its **own Continue** (no pinned session
  id), asserts the primary control was `Continue`, reads the transcript (8 `.turn-text`) and the copies
  disclosure (`4 copies`, no ` · N edited`), and deletes through the settings menu: `Session settings`
  → `.menu-row.is-danger` (`Delete session`) → the confirmation's sentence (*"This removes the
  transcript and every copy in it. A cut you already published stays, because a post is a snapshot of
  what was said."*) → the confirmation's `Delete session` **scoped to `.menu-actions button`**, because
  the opener carries the same label and an unscoped match would press it again.
- **Verified:** `./scripts/check.sh` GREEN (typecheck, build, 30 routes, schema, tauri, links, tiers);
  `./scripts/smoke.sh` **43/43** locally — row 43's evidence names the cut's id, the session's 8 turns
  and 4 copies, the menu's two rows, the landing (`/character/…0001`, `Aurelia of the Second Tide`,
  `Start a session`), the Not-found route with its `/character/catalog` road, and the cut still reading
  8 messages; **red first** by deleting `store.sessions.splice(index, 1)` from `deleteSession()` in
  `src/lib/data/memory.ts` → row 43 read *"the session survived the delete: /character/…0001 reads
  \"Aurelia of the Second Tide\" with its primary control at \"Continue\", not \"Start a session\" — the
  store still resolves a session for 5e551000-…0001 (8 turn(s), 4 copies)"* (42/43); the exact bytes
  restored from `$TMPDIR/memory.ts.bak` and `sha256sum -c` clean; `publish.sh` printed `LIVE` and
  `curl` is **200**; `./scripts/smoke.sh --live` **43/43** against the published bundle
  (`assets/index-BoTUzpAc.js`).
- **Not verified:** the copies half of the cascade is only visible *through* the deleted session
  (there is no copy list anywhere else), so the row proves it by the session becoming unresolvable,
  not by counting copies in a store — an adapter that leaked copies without the session would still
  read green (nothing can observe them). The delete's desktop/webview behaviour (a real Tauri window)
  was not re-driven this tick; every other ticket in `SHIP-PLAN.md` is blocked on Supabase, the
  Android toolchain or an owner decision, so `docs/NEXT.md` now points at the first **unwalked** page,
  `/onboarding`.

## 2026-11-02 — T-59: an author's edit never reaches a running session, and a cut is a snapshot

- **Changed:** `scripts/smoke.mjs` — new walk **row 42**, `EXPECTED_ROWS` 41 → 42, placed after
  T-58's row 41 and before `sign out` (it renames a live character twice and publishes a post, so it
  is mutating and final). The row opens the seed's **character** (`…0001`, Aurelia) and presses its
  own **Continue**, so no session id is pinned; reads the session's Character copy (`Aurelia`,
  `untouched`, `From Aurelia of the Tides · version 4`, one link, *Update from original*), then walks
  to the original **through the copy's own `a.copy-link`**, renames the **live** character on
  `/character/<id>/edit` — **both** its `name` and its in-session name, because the copy row prints
  `inSessionName || name` — saves, asserts the detail reads the new name, then `go()`s back to the
  session and asserts the copy's name, state, line of fact, controls and the disclosure's sentence
  are **unchanged**. Then publishes a **cut**: dock's `Publish a cut` → range → `Continue` → the
  composer's locked note (*published as text, not a link to the session*) → `Publish`, and reads the
  post's own page (8 messages, the transcript's first turn verbatim, the first line stamped
  `Aurelia · character`). Last: a **second** rename of the live character, then the post again — body
  and cut identical, and the post's HTML carries neither new name.
- **Verified:** `./scripts/check.sh` GREEN (typecheck, build, 30 routes, schema, tauri, links, tiers);
  `./scripts/smoke.sh` **42/42** locally, row 42's evidence naming the copy before/after, all 8
  messages and the post path; **red first** by making `load()` in `session-detail.tsrx` join the live
  character (`getCharacter(sourceId)` then overwrite the copy) → row 42 read *"the copy followed the
  author's edit: the Character copy read \"Aurelia\" before … and \"Aurelia Rebuilt\" after … character
  detail \"From Aurelia of the Long Tide · version 4\""* (41/42); the exact bytes restored and
  `sha256sum -c` clean. The **`--live` run then caught a second, real trap**: the row navigated back
  with `go(await url())`, and `location.pathname` carries the `/LuaPlot/` base on Pages, so the base
  was doubled and the row read *"timed out waiting for the copies disclosure (after the edit)"* — the
  row now keeps the id and rebuilds `/session/<id>` / `/post/<id>`. After that: 42/42 local, 42/42
  `--live`, `publish.sh` printed `LIVE` and the URL answers 200.
- **Not verified:** nothing on the Supabase side (T-29/T-30) — the copy rule is proven in the memory
  adapter only; the DB half is the same row's rerun once the project ref exists.

## 2026-11-02 — T-58: deleting the default persona hands the mark to one heir, in one step

- **Changed:** `scripts/smoke.mjs` — new walk **row 41**, `EXPECTED_ROWS` 40 → 41, placed after
  T-56's row 40 and before `sign out` (it is mutating and final: `deletePersona()` splices the memory
  store, so every later row sees two personas). The row reads `/persona` as data after
  `.skel-card` is **gone** (**3** `.persona-card`, exactly one `.is-default`, exactly one
  `.persona-card-mark` reading `default` in `textContent` — the mark is uppercased in CSS, so
  `innerText` would defeat it), names the seed's default (**Nell**, `PERSONA(1)`) and its own
  `/persona/<uuid>` link, opens **that card's** name link (**not `nth 0`**, so the row still proves
  the *default* was opened if the grid order moves), asserts the detail's `h1.name` (a character's is
  `h1.title`) and its `.mark`, then deletes in **two presses**: `Delete` inside `.delete-row`, then
  `Confirm delete` scoped to `.delete-actions` — a `startsWith("Delete")` match hits the opener (the
  T-49 trap) — reading the confirmation sentence in between. The landing is read **in one pass**:
  path `/persona`, **2** cards, Nell absent, exactly one default mark, and it is **Ash** — the heir is
  the **newest remaining** by `createdAt` (`PERSONA(3)`, `at(16,4,10)`), while The Correspondent is
  the second card but the *oldest* (`at(8,…)`), so a row pinning "the first remaining card" would be
  red on a right page. Last half: `go()` back to the deleted id must mount the spec's **Not found**
  sentence (`This persona doesn't exist in your collection.`) with its `/persona` road out — no
  heading, no `<form>`. `docs/SHIP-PLAN.md` ticks T-58 and marks failure bank 8 walked; `NEXT.md`
  carries T-59.
- **Verified how:** `./scripts/check.sh` → **GREEN** (build ok, 30 routes, schema, tauri, links, tiers
  5822 declarations). `./scripts/smoke.sh` → **41/41** locally, evidence: *"before: 3 cards, one
  .is-default reading \"Nell\" (the seed's default) · opened that card → /persona/9e45014a-…0001 with
  its mark · Delete → \"Delete this persona? This cannot be undone.\"… → Confirm delete · after: 2
  cards [\"Ash\",\"The Correspondent\"], \"Nell\" gone, the one mark on \"Ash\" (newest remaining; The
  Correspondent is the oldest and is not the heir) · /persona/9e45014a-…0001 → Not found, sentence +
  road /persona"*. Proved **red** first on `src/lib/data/memory.ts` — the hand-off disabled
  (`if (false && row.isDefault)`) read *"2 card(s) [\"Ash\",\"The Correspondent\"] at \"/persona\", 0
  .is-default [], mark text [\"\",\"\"] — the collection was left with 2 persona(s) and 0 default(s); a
  persona delete hands the mark on in the same step and never leaves personas with no default"*
  (40/41); bytes restored and `sha256sum -c` clean (`f768bb74…`). `publish.sh` printed
  `LIVE=https://victor-viicell.github.io/LuaPlot/` with `assets/index-BoTUzpAc.js`; `curl` 200;
  `smoke.mjs --live` → **41/41**.
- **Not verified:** nothing outstanding for this ticket. The row does **not** walk the refusal half
  (`deletePersona` answering `false` for a non-owner) — that law is a different one and stays covered
  by the item-delete refusals. The persona **edit** page's own delete row is the same component and is
  not pressed here.

## 2026-11-02 — T-57: a real second page, and Load more writes no URL

- **Changed:** `src/lib/fixtures/posts.ts` is **30 posts** — `POST(1..12)` byte-untouched (walk rows
  21, 30, 38, 39 name their ids; post 6 stays `removed`, post 7 the only `nsfw`), plus
  `SEEDED_POSTS`: 18 generated rows (`POST(13..30)`) from an 18-line body list, authors cycling
  through the seven existing handles, **a distinct October day each** (`at(1..18)`, i.e. older than
  the twelve) because `newest` sort over an equal clock would make the listing non-deterministic.
  29 listed against `PAGE_SIZE` 24 ⇒ page 1 = 24, page 2 = 5. **Walk row 39 extended, no row 41**
  (`EXPECTED_ROWS` still 40): it polls `.pager-action button` **not disabled** (`appending` disables
  it during the await), presses it, and asserts the count grows, the first page's **stamps and order
  survive**, `location.search` is still `""`, the pager reads `End of feed.` once page 2 is in
  (29 cards — page 2 *was* the remainder, so there is no second press to make and the message says
  so), then `history.back()` **leaves the thread** (paging pushed no entry) and returning re-reads
  page 1 (23 cards again, 0 stamps, Load more back). `docs/DESIGN.md` → *Thread* and
  `SHIP-PLAN.md` (T-57 entry + failure bank 3) carry the new seed count in this commit.
- **Verified how:** `./scripts/check.sh` → **GREEN**; `./scripts/smoke.sh` → **40/40** locally; row 39
  evidence: *"Load more: 23 → 29 card(s), first page's 23 stamp(s) and order kept, search still "" ·
  page 2 was the whole remainder, so the pager read End of feed at 29 card(s) · Back from a loaded
  page left the thread (23 card(s) at ?sort=discussed), returning re-read page 1 (23 card(s), 0
  stamps, Load more back)"*. Proved **red twice** on `src/pages/post-thread.tsrx`, bytes restored and
  `sha256sum -c` clean (`840fc9b6…`): (a) `loadMore()` writing
  `?page=${nextPage}` → *"Load more wrote \"?page=2\" into the address — paging stays out of the URL
  (thread.md → Layout) and component state owns the page"* (39/40); (b) the append inverted to
  `[...listing.items, ...items.value]` → *"Load more reordered the first page — wanted
  [95d85e7b…, …000c, …000b]…, read […0012, …0011, …0010]… (29 post card(s), 23 still stamped)"*
  (39/40). **The inversion kept all 23 stamps**, so node identity alone would have run green — the
  order half is the assertion that carries this row.
- **Not verified:** the append's behaviour against a **server** page (the adapter answers from one
  array; Supabase paging is T-29's), and a second press when page 2 is *not* the whole remainder —
  the fixture is 30 by design, so that branch exists in the row but has never been taken.

## 2026-11-02 — T-56: a repeat is not a vote, a switch moves one count

- **Changed:** walk row **40** in `scripts/smoke.mjs` (`EXPECTED_ROWS` 39 → 40) for failure-bank
  entry 5 — *Voting allows multiple votes per viewer → uniqueness in adapter and DB* — and
  `character/detail.md` → *Actions*: *"one vote per viewer; switching replaces the previous vote"*,
  with *States* → **Voted** as the state that survives. Nothing had ever read a count around a vote:
  row 8 presses a brand-new post's **Like** and asserts `aria-pressed="true"`, a page-local boolean a
  doubled count leaves exactly where it was. The row opens Sonic
  (`/character/c0a1b2c3-…0002`, opened by rows 6/32/35/36/37 and **never voted on**), waits for
  `.detail .counts[aria-label="Engagement"]` plus both `button.vote`, and reads the four cells **per
  label** from `textContent` (`.count-label` is uppercased in CSS; the **Ratio** cell is a percent,
  so "every value is a number" is false on a right page). It records the seed (`412/61`, neither vote
  pressed) and asserts **deltas**: Like → `413/61`; Like **again** → still `413/61`, re-read 300 ms
  later; Dislike → `412/62` with exactly **one** `.vote` pressed (the like is *replaced*, not
  stacked); a remount through `/character/catalog` → `412/62` with Dislike still pressed; finally
  pressed back onto **Like** → `413/61`, one vote, not two. Every read is the `.count-value` cell, so
  a page that recomputed locally would still be caught.
- **Verified:** `./scripts/check.sh` GREEN (build, 30 routes, schema, tauri, 52 anchors, 5822
  declarations across 46 regions); local walk **40/40**; live walk **40/40 `--live`**; `curl` **200**;
  published `assets/index-CPVMPrcv.js` (unchanged — this ticket touches only the walk, not `src/`).
  **Red proof, and a correction to the ticket:** deleting only `if (previous === direction) return
  row` leaves the walk **green** — the decrement/increment pair is symmetric, so a repeat nets zero
  and the guard only saves a write. The honest red is **both** removed (no uniqueness, no
  replacement), which read `pressing Like a second time: a repeated Like moved Likes to 414; one vote
  per viewer means it stays at the seed's 412 + 1 — read Likes "414", Dislikes "61", Ratio "87%",
  … .vote ["Like:true","Dislike:false"]`, 39/40. The switch half is proved separately by removing
  only the two decrements: `switching to Dislike: Likes read 413 after the switch; the Like was
  replaced, so it must be back at the seed's 412`. `memory.ts` was restored byte-for-byte
  (`sha256 f768bb74e50b644770c670be4f921b199ab0a5dec1a79da2dcda9a4de97ba248`, `sha256sum -c` OK).
- **Not verified / filed:** a viewer who arrives with **no** vote cannot be returned to none — the
  spec fixes the pair and has no *unvote* — so the row leaves one **Like** behind on Sonic and says
  so in its evidence; `sign out` follows and each run starts a fresh memory adapter. No layout
  changed, so no width was measured. The paging half of failure bank 3 is still **T-57** (needs a
  25+ post seed).

## 2026-11-02 — T-55: the thread's sort is a URL fact, and Back is the proof

- **Changed:** walk row **39** in `scripts/smoke.mjs` (`EXPECTED_ROWS` 38 → 39) for failure-bank
  entry 3 — *`Load more` state lost on back → paging in component state, filters in URL* — and
  `post/thread.md` → *URL*: *"Sorting and filtering live in the query string, per the conventions, so
  a filtered thread is shareable"*, with *"paging stays out of the URL"* in *Layout*.
  `post-thread.tsrx` already implemented both (`writeSort()` pushes `?sort=`, `newest` writes **no**
  param, `loadMore()` never touches the address) and no gate could see it: nothing had read
  `location.search` on the thread and nothing had ever called `history.back()` (row 4 hops with `go()`
  — the forward direction only). The row reads **all three** — `location.search`, the
  `select.select-input`'s own value, and the cards — and asserts the **exact** search string at every
  step, never a substring: `?sort=discussed` **by address** (shareable: the control already reads
  `discussed` and the address keeps the param, 11 cards); `go("/post/thread")` reads `""` with
  `newest` (the default is the *absence* of the param, never `?sort=newest`); press `discussed` →
  `?sort=discussed`; press `liked` → `?sort=liked`; `history.back()` → `?sort=discussed` with the
  control **and** the listing following; a second `history.back()` → `""` + `newest`. The refetch is
  proved by **nodes**, not the address: each card is stamped with an expando before a gesture and the
  stamp must be gone after it, because the fetch's `epoch` rides in every row's key, so a new listing
  remounts every card — an assertion "the address changed" cannot make (`choose()` returns the value
  it read, so it proves the control and never the page).
- **The suspicion, settled — not assumed.** `sort = track(readSort(useQuery()))` is a **one-time
  read** with `chooseSort()` as its only writer, so a Back that merely repainted the address could
  leave the listing sorted the old way with the `Select` — reading the same frozen track — agreeing
  with the listing and disagreeing with the URL. It does not: `App.tsrx`'s effect keys on
  `path + search`, so a Back remounts the page and the read is honest. Row 39 is what keeps that true.
  **Order in the row is deliberate:** the shareable half runs *first* by address, then the two
  presses, so the walk's own entries line up one-for-one with the two `history.back()` steps — a
  `go()` to `?sort=discussed` between the presses would leave two entries with the same URL
  underneath and the second back would land on `?sort=discussed` again, red on a page that is right.
- **Verified:** `./scripts/check.sh` GREEN (build, 30 routes, schema, tauri, 52 anchors, 5822
  declarations across 46 regions); local walk **39/39**; **red proof first** — a module-level
  `frozenSort` (the first read in a document wins) made the row read `the thread opened at
  ?sort=discussed: wanted search "?sort=discussed" with the control on "discussed" — read search
  "?sort=discussed", sort control "newest", 11 post card(s), 0 skeleton(s) … at /post/thread`, and
  `post-thread.tsrx` was restored to sha256 `840fc9b6d236480dcc8a38a995b5017a0fb46b896e20e73de85e6d399c6aa2b7` — the exact bytes that ran green,
  `sha256sum -c` OK. Published `assets/index-CPVMPrcv.js`; `curl` **200**; live walk **39/39**.
- **Not verified / filed:** the **paging half** of failure bank 3 cannot be walked — 11 listed posts
  against `PAGE_SIZE` 24, so the feed legitimately draws no `.pager-action`. The row asserts that
  absence **and** the pager's `End of feed.` note (so an absent Load more is the pager's end, not a
  missing pager) instead of pretending to press a control that is not there. Seeding 25+ posts
  changes every post count in the walk (row 36's feed, row 38's composed post), so it is **T-57**,
  not a side-edit. The mobile/desktop ladder is untouched by this ticket (no layout change) — no new
  width was measured.

## 2026-11-02 — T-54: a cover keeps the chrome and the numbers outside it

- **Changed:** walk row **38** in `scripts/smoke.mjs` (`EXPECTED_ROWS` 37 → 38) for failure-bank
  entry 1 — *Card blur hides the numbers → footer stays outside the blur* — and `nsfw.md` → *Rules*
  → *Blur is structural*: *"the top header is the title and the bottom footer is a single row holding
  the author beside the ratio as a percentage … The blurred area is exactly what sits between them …
  **The numbers are never hidden** — only the body is covered."* No gate had ever rendered a
  **covered** card (row 36 measures counts with Blur off, row 25 counts `.is-covered` and stops, row
  37 covers a *detail* page), so `.card-foot` moved one indentation inside `.card-veil` stayed green
  everywhere. The row records the seed pair from `/dev/state`, turns **Show and Blur on**, and reads
  every covered catalogue card as data: `.card-head` / `.card-foot` / `.card-ratio` present and
  `veil.contains(...) === false` for all three, ratio **inside** the footer, `aria-hidden="true"` on
  the veil, `Reveal` inside `.card-cover` and **outside** the veil, zero
  `.card-ratio`/`.card-author`/`.count` inside it. One press of the **first covered card's** Reveal
  (scoped to `.card.is-covered .card-cover button`, `exact`) must drop the covered count by exactly
  one, uncover that card, remove its control, and leave every other covered card covered **in the
  same order** — *revealing one item never reveals the rest*. The feed half repeats the split on
  `.card.post.is-covered`: `.post-head`, two `.post-count` cells and `.post-comments` outside
  `.post-veil`, `aria-hidden="true"` on the veil, no count inside it. The pair is re-read after the
  Reveals (a reveal writes no preference) and then restored to the recorded seed with the listing
  asserted against it.
- **Found while working (the ticket's fixture was gone):** case 2 targets **post 7**, the only
  `nsfw: true` post, and row 21 concludes that case as *removed* — so by row 38 the feed drew **11
  post cards and none `17/6`**. The row now **composes its own flagged post** (composer + **NSFW**
  toggle on, which `nsfw.md` covers like anyone else's content) rather than passing on an empty set;
  the false start is recorded in `docs/NEXT.md`.
- **Verified how:** `./scripts/check.sh` GREEN (build, 30 routes, schema, 52 anchors, tauri, tiers —
  5822 declarations); walk **38/38** locally, evidence `catalog: 4/24 card(s) covered, chrome + "77%"
  ratio outside the veil (veil filter "blur(6px)"), 0 numbers inside; Reveal on "Auntie Sorrow" → 3
  covered, the order kept · thread: 1/12 post card(s) covered, two counts ["0","0"] + a comment link
  outside .post-veil, 0 numbers inside · restored Show false / Blur false · 20 card(s), "Hollow Saint"
  absent, 0 covered`; walk **38/38 `--live`** against `https://victor-viicell.github.io/LuaPlot/`
  (curl 200) after `publish.sh` printed `LIVE`. **Proved red first:** `.card-foot` moved inside
  `.card-veil` in `Card.tsrx` read `the covered card "Auntie Sorrow" does not keep its chrome outside
  the veil: head true (title outside the veil true), footer true (outside the veil false), ratio true
  (in the footer true, outside the veil false), author outside the veil false … numbers inside the
  veil [".card-author",".card-ratio"] — 4/4 covered card(s) fail`; the file was restored from a copy
  and `sha256sum -c` confirmed the exact bytes (`f210f3fe…6e5dd8`).
- **Not verified:** the paging half of the thread (`Load more` never pressed — 12 listed posts against
  `PAGE_SIZE` 24); no Tauri/Android build on this box.

## 2026-11-02 — T-53: a viewer's NSFW filter hides a listing, never a route

- **Changed:** walk row **37** in `scripts/smoke.mjs` (`EXPECTED_ROWS` 36 → 37) for the product law
  *NSFW is a boolean on content + a per-account preference (Show / Blur). It never blocks a route*
  (`src/specs/systems/nsfw.md` → *Rules*: *"It is not access control. No route is blocked, no 404, no
  redirect: a direct link still resolves"* / *"With Show off, a detail route still resolves … no
  separate notice page and no empty render"*). That is failure-bank entry 4, and row 25 only ever
  proved the **listing** obeyed the pair — no row had opened a detail route with Show off. The row
  records the seed pair from `/dev/state` (never `true/true`), flips **Show** off and reads both
  halves: the catalogue prints *Hollow Saint* with Show on (24 cards) and drops it with Show off (20
  cards, not zero — an absence over an empty grid proves nothing), then
  `/character/…0004` is opened **by address** (no press: the law is about a direct link) and must
  mount `.detail` + `h1.title` *Hollow Saint* + `.veiled.is-covered` + `aria-hidden="true"` + a
  **Reveal** control inside `.detail` + its four engagement cells still printing numbers (*the
  numbers are never hidden*). Pressing Reveal must clear `is-covered`, restore `aria-hidden="false"`,
  remove the control, keep the name, and leave Show reading off (a reveal is one view and writes
  nothing to the account). The restore runs **even when a half failed**, restores the seed pair, reads
  it back, and re-reads the catalogue against `seedShow`; a restore failure is reported **with** the
  body failure instead of masking it.
- **Verified how:** `./scripts/check.sh` GREEN (build, 30 routes, schema, 52 anchors, tauri, tiers —
  5822 declarations); walk **37/37** locally, evidence `Show off: 24 card(s) with Show on incl.
  "Hollow Saint" → 20 with Show off, absent · 000004 → .detail + "Hollow Saint", .veiled.is-covered +
  aria-hidden, Reveal inside .detail, 4 count cell(s) ["51","22","70%","0"] → Reveal clears the cover,
  name survives · restored Show false / Blur false · catalogue 20 card(s), "Hollow Saint" absent`;
  walk **37/37 `--live`** against `https://victor-viicell.github.io/LuaPlot/` (curl 200) after
  `publish.sh` printed `LIVE` for `assets/index-CPVMPrcv.js`.
  Proved **red** first: an `@else if (nsfw.value && !show.value) { <p class="prose"></p> }` arm in
  `character-detail.tsrx` (the forbidden empty render) made the row report `resolved nothing with Show
  off — title "Character — LuaPlot", path /character/…0004, roots {".detail":1,".catalog":0,
  ".card-grid":0,".alert":0}, headings [], body "Character Home Thread Catalog Alerts 3 Profile";
  nsfw.md → Rules says a detail route always resolves` and **36/37** — the other 36 rows stayed green,
  so the row names the route and what mounted, not a poll timeout. The file was restored from a
  sha256-verified copy (`2d11f91c…b164`) before the green run, and `git diff` on it is empty.
- **Not verified:** nothing mobile — no Android toolchain on this box (T-35). The reveal's *"returns
  to covered on reload"* arm is not asserted: a document reload re-seeds the memory adapter, so the
  row proves the one-view reveal by the control and the class, not by reloading. The account this walk
  signs in with seeds Show **off** / Blur **off**, so the restore assertion ran against that seed —
  the row reads the seed rather than assuming it, which is what makes it safe on a re-seeded account.

## 2026-11-01 — T-52: engagement is a ratio on a card, and counts on the detail page

- **Changed:** walk row **36** in `scripts/smoke.mjs` (`EXPECTED_ROWS` 35 → 36) for the product law
  *Engagement is metadata on cards (ratio only) and actions on detail pages (counts live there)* — a
  rule about **where a number lives**, which no gate could see: `tier-check.mjs` reads colours,
  `link-check.mjs` reads anchors, row 30 measures a card's links, row 31 a token's contrast. The row
  reads every card on `/character/catalog` as data (one `.card-ratio`, whole percent, a `SPAN` outside
  any control, zero `.count`/`.counts`/`.count-label`/`.count-value`/`.comments` inside it), opens
  `/character/…0002` for the other half (four engagement cells, both `.vote` controls, `.save`), and
  measures `/post/thread` as the **other** card on purpose: two `.post-count` cells plus one
  `.post-comments` link and no ratio, because `thread.md` → *Layout* fixes that footer.
- **Verified how:** `./scripts/check.sh` GREEN (build, 30 routes, schema, tauri, links, tiers — 5822
  declarations); walk **36/36** locally and **36/36 `--live`** against
  `https://victor-viicell.github.io/LuaPlot/` (curl 200), evidence `catalog: 20/20 cards, one ratio
  each (["96%","83%","89%"]), 0 counts, ratio a SPAN outside any control · 000002:
  ["likes","dislikes","ratio","comments"] = ["412","61","87%","0"], votes ["like","dislike"] + .save
  ×1 · thread: 11 post card(s) × 2 counts + 1 comment link, 0 ratio`. Proved **red** first: a
  `<span class="count">{item.likes}</span>` in `Card.tsrx`'s footer made the row fail with
  `the card for "The Lamplighter's Widow" … in a control: no, with ["count"] inside it — 20/20
  card(s) fail`; `git checkout -- src/components/Card.tsrx` restored the bytes before the green run.
- **Not verified:** nothing mobile — no Android toolchain on this box (T-35). The row reads the
  memory adapter's fixture (T-29/T-30 still blocked on a Supabase project ref), and the ratio is
  asserted by **shape**, never by a value: it rounds to whole percent, so a vote can leave it
  identical (`96% → 96%`).

## 2026-11-01 — T-51: a fixed segment wins over an id param

- **Changed:** walk row **35** in `scripts/smoke.mjs` (`EXPECTED_ROWS` 34 → 35) for the product law
  *IDs carry identity, names never do. Fixed segments (`catalog`, `create`, `thread`) win over `[id]`
  params*, the one law in `CONTRACT.md` that is a **precedence** rule and therefore invisible to every
  existing gate. The row walks the nine literal siblings **as addresses** (no card press: the address
  is the thing under test) — `/character/catalog`, `/character/create`, `/lorebook/catalog`,
  `/lorebook/create`, `/preset/catalog`, `/preset/create`, `/persona/create`, `/post/thread`,
  `/post/create` — and polls four landmarks read from the page files: its own root class
  (`.catalog` / `.create-page` / `.thread` / `.compose-page`), its `.kicker` sentence
  (`character catalog`, `new preset`, …), `document.title` = `<Title> — LuaPlot`, and on a create page
  a mounted `<form>` (polled, not asserted on the first frame). Each poll also requires `.detail` to be
  **absent**, which is the half that a shared root class cannot fake. The control half runs the other
  direction — a real character uuid at the same depth must still reach the detail page — because a
  router that made every segment literal would pass all nine lines and fail that one.
  `/moderation` is absent from the list on purpose: `/moderation/[report.id]` is its only child, so it
  has no fixed sibling at depth 2 to walk.
- **Verified how:** `./scripts/check.sh` GREEN (build, 30 routes, schema, tauri, links, tiers — 5822
  declarations, no text takes the mark). Walk **35/35** locally and **35/35 `--live`** against
  `https://victor-viicell.github.io/LuaPlot/` (curl 200), evidence: `9 fixed segments each mount their
  own page (/character/catalog, … /post/create) · control 000000000002 → .detail ×1 + "Sonic the
  Hedgehog"`. Proved **red** first: with `ID` widened to `/^[0-9a-z-]{1,36}$/i` **and** `TABLE`'s sort
  inverted to params-first, the row failed with `/character/catalog did not mount its own page — read
  title "Character — LuaPlot", roots {".catalog":0,…,".detail":1}` and eight later rows fell with it;
  `git checkout -- src/router.ts` restored the bytes (`git diff --stat src/router.ts` empty) before the
  green runs.
- **Not verified:** nothing mobile *on device* — headless Chromium at the walk's default 500×653 only;
  the row measures nothing, so it takes no `Emulation.setDeviceMetricsOverride`. The id predicate itself
  is still a literal regex in `src/router.ts` with no static gate over it: row 35 catches a router that
  *routes wrongly*, not one that merely widened the predicate while the sort still saved it.

## 2026-11-01 — T-50: a persona carries none of the shared-item chrome

- **Changed:** walk row **34** in `scripts/smoke.mjs` (`EXPECTED_ROWS` 33 → 34) for the law *personas
  are personal (never shared, never moderated, never counted)*, which no gate could see because every
  gate reads what a page **has**. The row opens an own persona (`.detail h1.name` → `Nell`), reads its
  four own controls (**Start a session**, the default pair, **Edit**) so the absences are not vacuous,
  then counts inside `.detail`: 0 report controls, 0 save/bookmark controls, 0
  `.counts/.count/.ratio/.engagement`, 0 `.comments/.comment-thread/.comment`, 0 `<form>`. It then
  opens `/persona` (waiting for the three skeleton cells to go — the loading grid draws `.card-cell`s
  too), asserts one `.persona-card` per `.card-cell`, and that every card links under the served base
  to a **seeded** persona id, none twice. Finally an unowned id reads the single sentence *This
  persona doesn't exist in your collection.*, mounts no `<form>`, and its road out resolves to
  `/persona` (missing and unowned are one state on purpose).
- **Verified how:** `./scripts/check.sh` GREEN. Walk **34/34** locally and **34/34 `--live`** against
  `https://victor-viicell.github.io/LuaPlot/` (200). Row 34's evidence: `Nell: 0 report / 0 save / 0
  counts / 0 comment / 0 form in .detail, 4 own controls · collection: 3/3 cards, ids 03/02/01 under
  /LuaPlot · unowned → the one sentence, no form, road out /LuaPlot/persona`. Proved **red** first: a
  `<button class="act">Report</button>` injected into the identity block dropped the walk to 33/34 and
  the row failed with `the persona page draws a report control: ["Report"]`; the exact bytes were
  restored (`sha256sum` matched `082dedb7…`) and the green runs above are the proof.
- **Not verified:** nothing mobile *on device* — desktop Chromium at 360×740 only. The row asserts
  absence by class/name, so a control drawn with a class and a name the sweep does not know (e.g. an
  icon-only `…` menu with no accessible name) would not be seen; that is the honest limit of a
  DOM-reading walk. Nothing about persistence.

## 2026-11-01 — T-49: the session's copies become a walk row

- **Changed:** walk row **33** in `scripts/smoke.mjs` (`EXPECTED_ROWS` 32 → 33) — the product law
  *sessions read copies, never live items* had no row at all. It opens
  `/session/5e551000-…-000000000002`, reads the **closed** disclosure (`aria-expanded="false"`, no
  `.copies-body`, header `3 copies · 1 edited`), presses the toggle, and reads all three copy rows:
  the character `edited`, the lorebook `unlinked` (0 `a.copy-link`, 0 `.copy-action`, its *out of
  reach* line), the preset `untouched` (only **Update from original**; **Restore** appears only on
  the edited copy). Then it presses the edited row's **Restore**, asserts the confirmation sentence
  verbatim, presses the confirming **Restore copy**, and reads back both halves of the snapshot —
  the row's `.copy-state` flips to `untouched` and the header's tracked sentence drops to `3 copies`.
  Mutating journey: it runs after row 32 and before `sign out`, and nothing later reads the copies.
- **Verified how:** `./scripts/check.sh` GREEN. Walk **33/33** locally and **33/33 `--live`** against
  `https://victor-viicell.github.io/LuaPlot/` (200). Row 33's evidence: `closed: "3 copies · 1 edited"
  · Ninth edited / Unfiled Notes on the Ninth unlinked / Cold Open untouched · unlinked offers 0 links
  / 0 controls · restored → "3 copies"`. Proved **red** first: the post-restore expectation was set
  back to the pre-restore sentence, the walk dropped to 32/33 and the row failed with `after the
  restore the character copy reads "untouched" and the header reads "3 copies"`; the exact bytes
  (`cp` of the green file) were restored and the green run above is the proof.
- **Ticket premises corrected, not the page:** session 2 holds **three** copies (character, one
  lorebook, preset), so the header reads `3 copies · 1 edited`, not `4 copies · 1 edited` — four is
  session 1's two-lorebook shape, which is what `DESIGN.md` → *Session* quotes. After the only edited
  copy goes back the summary is `3 copies`: `summary` appends ` · N edited` only while `N > 0`, so
  there is no `0 edited` state to assert. The **Restore** opener is labelled `Restore`; `Restore copy`
  is only the confirming button. The row was written against the DOM, and the walk asserts the
  sentence whole so a wording change is red.
- **Not verified:** nothing mobile — this is desktop Chromium at 360×740. The row does not measure
  the aside's geometry (row 30 owns the 44px bands) and does not re-read the copies after a reload:
  the memory adapter reseeds on a full document load, so persistence stays with T-29.

## 2026-11-01 — T-36(a): `--keyboard-inset` is written, from the visual viewport

- **Changed:** `src/lib/viewport.ts` — `installKeyboardInset()` is the token's **one writer**:
  `Math.max(0, Math.min(400, Math.round(innerHeight - visualViewport.height - visualViewport.offsetTop)))`
  written to `documentElement` as `--keyboard-inset`, coalesced through `requestAnimationFrame` (never
  a debounce — the dock must not lag the keyboard), subscribed to `resize` **and** `scroll` on the
  visual viewport, one eager write at install, returns a teardown. No `window.visualViewport` → `0px`
  once and no subscription (the CSS fallback is the same value). Installed **once** in `App.tsrx`
  beside `refreshInbox()`, not in the session page: the token is a document property and two writers
  fight over the last frame. Walk row **32** (`scripts/smoke.mjs`, `EXPECTED_ROWS` 31 → 32) opens a
  session at **360×740** under its own device-metrics override, shadows `visualViewport.height` with
  a configurable own value, dispatches `resize` **on the visual viewport**, and reads the token and
  the dock's computed `padding-bottom` back. `ARCHITECTURE.md` → *Viewport* carries the rule.
- **Verified how:** `./scripts/check.sh` GREEN. Walk **32/32** locally and **32/32 `--live`** against
  `https://victor-viicell.github.io/LuaPlot/` (200). Row 32's evidence: `--keyboard-inset 0px → 320px
  under a 320px shadowed viewport at 360; dock padding 8 → 328, scrollWidth 350/360 — and back`. It was
  proved **red** first: `schedule()` made a no-op in `viewport.ts`, the walk dropped to 31/32 and the
  row failed with `--keyboard-inset stayed "0px" and the dock's bottom padding stayed 8px under a
  320px shadowed viewport — nothing wrote the token`; the exact bytes were restored and the green run
  above is the proof. The row restores the shadow (`delete vv.height`), dispatches again, asserts the
  token is back to `0px` and the padding to 8px, and clears the metrics override in an outer
  `finally`, asserting `innerWidth` returned.
- **Not verified:** a real on-screen keyboard — the walk shadows the viewport, so the measurement is
  the writer against Chromium's own object, not Android's (the device half stays with T-35/T-36).
  Also unmeasured: whether the dock lags a keyboard that animates in over ~250ms (the rAF coalescing
  is per-frame, but nothing here can time a real keyboard), and iOS's `visualViewport` quirks (no
  iOS toolchain on this box). Note for the next session: the session page's `documentElement`
  `scrollWidth` is 350 at 360 — no overflow, so the row's "no wider page" assertion has room.

## 2026-11-01 — T-48: the tier becomes a gate, and it immediately found 26 sites

- **Changed:** `scripts/tier-check.mjs` (node stdlib only) is **section 8** of `scripts/check.sh`. It
  strips `/* … */`, extracts the `<style>` blocks of every `src/**/*.tsrx` (masking everything else
  with spaces so offsets and line numbers survive), then walks `{`→`}` counting depth; a declaration
  whose property is exactly `color` (split at the first colon, never a substring `color:` test) fails
  on `var(--color-accent)` / `var(--color-accent-hover)`. Custom properties and the
  `--color-accent-contrast` exemption pass by construction; it prints `file:line — <selector> paints
  text with <token>` and exits 1. It accepts file arguments so the red proof runs against copies.
  **The ticket's premise was wrong:** the tree was not byte-identical to what passed row 31 — T-37C
  swept `src/styles.css` only, and section 8's first run named **26** declarations in 15 `.tsrx`
  files. Closed them: links/static accent text → `--color-accent-text`, `:hover` →
  `--color-accent-hover-text`, `dev-native`'s dead `var(--color-success, …)` fallback →
  `--color-accent-text`, the report dialog's `::after` "✓" on a surface → `--color-text` (the accent
  border carries the state), and the three `.vote`/`.save` `[aria-pressed="true"]` pills — whose own
  `background-color` is `--color-surface`, where no static accent tier clears AA in Latte — became an
  accent **fill** with `--color-accent-contrast`. `src/styles.css` was not touched; `DESIGN.md` →
  *Contrast* carries both rules, `SHIP-PLAN` records the corrected premise.
- **Verified how:** `./scripts/check.sh` GREEN with `== tiers` printing `5822 declarations across 46
  stylesheet region(s); no text takes the mark`. Scanner proved **red and green** from four fixtures:
  a `styles.css` copy + `a:hover { color: var(--color-accent); }` exits 1 naming `a.css:2026`; a copy
  with a fill + `--color-accent-contrast` + both text tiers + the banned value in prose exits 0; a
  `.tsrx` copy with a wrapped selector list inside its own `<style>` exits 1 naming
  `.probe-title:hover, .probe-sub:hover`; a copy that only *defines* the tokens exits 0. Walk
  **31/31** after the colour changes, row 31 unmoved (`Mocha 8.64 → 9.81 · Latte 4.83 → 5.91 (4.66 on
  surface)`, rail 4.83 no fill). `publish.sh` printed `LIVE`, `curl` 200 on the page and on
  `assets/index-CoLZ-Hl6.js`.
- **Not verified:** the new sites' contrast is arithmetic, not a browser measurement — no walk row
  reads `.fold-btn`, `.pmark.is-on`, `.chip.is-on`, `.signin a` or the pressed pills. Every static one
  sits on `--color-bg-elevated`/`--color-bg` (4.83/5.20 in Latte) and the fills reuse the primary
  button's documented 4.79+ pair, but a row that measures them does not exist. Session-detail's
  `var(--keyboard-inset)` is read by the composer and written by nothing — that is T-36(a), next.

## 2026-11-01 — T-37C: the rest of the accent's text joins the tier, and the rail stops filling

- **Changed:** `--color-accent-hover-text` is a new token in all six blocks of `src/styles.css`
  (dark default + Frappé/Macchiato/Mocha = `--ctp-lavender`; the light media block and `latte` =
  `color-mix(in srgb, var(--ctp-mauve) 40%, var(--ctp-text))` = `#64469f`). `a` and every text hover
  that painted the accent moved onto the two tiers (`a`, `a:hover`, `a.card-title:hover`,
  `a.card-author:hover`, `a.post-time:hover`, `a.persona-card-name:hover`, `a.persona-card-open:hover`,
  `.post-comments:hover`, `.persona-card-mark`, `.tab-pill[aria-selected="true"] .tab-count`); every
  fill, stroke, the tab tick, the rail bar and the focus ring kept `--color-accent`. `App.tsrx`'s
  `md` rail no longer paints `--color-surface` on the active or hovered row — the active indicator is
  the 2px accent bar `lg` already drew, and hover steps the label to `--color-text`. `DESIGN.md` →
  *Contrast*, *Layout law*, *Shell* carry the numbers and both decisions; `SHIP-PLAN` records the
  ticket under T-37B's entry; `scripts/smoke.mjs` row 31 grew in place (`EXPECTED_ROWS` stays 31).
- **Verified how:** `./scripts/check.sh` GREEN. Walk **31/31** locally and **31/31 `--live`**
  (`https://victor-viicell.github.io/LuaPlot/`, serving `index-C5UZDJib.js`, `curl` 200); row 31 prints
  `Mocha … tab 8.64:1, @author hover 9.81:1, bare link 8.64:1 / hover 9.81:1 (#b4befe), rail 8.64:1
  on #181825 (bar #cba6f7, no fill) · Latte … tab 4.83:1, @author hover 5.91:1, bare link 4.83:1 /
  hover 5.91:1 (#64469f, 4.66:1 on surface), rail 4.83:1 on #e6e9ef (bar #8839ef, no fill)`. Proved
  **red twice** from the committed tree: with the base rule set back to `var(--color-accent)` the row
  failed `Latte's a bare link on a card measures 4.45:1` (the mark's own number, measured on a real
  card), and with the `md` rail's fill restored it failed `the md rail's active row paints
  rgb(49, 50, 68) behind its label — the fill is back`; both were reverted with `git checkout -- .`
  so the green run measures the shipped bytes. The mix was chosen from a computed table, not by eye:
  55/45 lands 4.38 on `--color-surface` and 60/40 lands 4.29 (both under the 4.6 the tier exists for),
  40/60 lands 4.66 — the hue is kept, only the chroma drops. The bare-link half installs one classless
  `<a>` in the first card, because no page prints one there, and removes it in the `finally`; its
  colour, backplate and `:hover` all come from the real stylesheet.
- **Not verified:** nothing on this ticket — `check.sh` GREEN, local walk 31/31, live walk 31/31, live
  build 200. T-39 (signed APK + AppImage + tag) is the last open item in P6 and is blocked on the
  Android toolchain and a signing key, not on this ticket.

## 2026-11-01 — T-37B: the accent gets a text tier, and the light flavour clears AA

- **Changed:** `--color-accent-text` is declared in all six blocks of `src/styles.css` (the dark
  default, Frappé, Macchiato, Mocha = the mark; the `prefers-color-scheme: light` block and `latte`
  = `color-mix(in srgb, var(--ctp-mauve) 85%, var(--ctp-text))`, `#7f3cdb`). The active nav **label**
  (`.tab.is-active`, `.rail-item.is-active` in `App.tsrx`) and three text hovers
  (`a.card-author:hover`, `.post-author:hover`, `a.post-time:hover`) use it; every mark — the tab
  tick, the rail bar, `.btn-primary`'s fill, the focus ring — keeps `--color-accent`. `DESIGN.md` →
  *Tokens* + *Contrast* carry the token and the measured pairs, `SHIP-PLAN` ticks T-37B,
  `scripts/smoke.mjs` grows row 31 (`EXPECTED_ROWS = 31`).
- **Verified how:** `./scripts/check.sh` GREEN. Local walk **31/31**; row 31 prints
  `Mocha #1e1e2e "Catalog" 8.64:1 (label #cba6f7, tick #cba6f7), hovered @author 8.64:1 · Latte
  #eff1f5 "Catalog" 4.83:1 (label #7f3cdb, tick #8839ef), hovered @author 4.83:1`. Proved **red**
  first: with the tier set back to `var(--ctp-mauve)` the row failed `Latte's active tab label
  "Catalog" measures 4.45:1 (rgb(136, 57, 239) on rgb(230, 233, 239)), under AA 4.5` — the ticket's
  own number, reproduced from the page. The mix was chosen against a computed table, not by eye:
  88/12 gives 4.74 and 85/15 gives 4.83, while **mixing toward `--ctp-crust` lightens** a light
  flavour (3.82) and would have made it worse.
- **Not verified:** two pairs in the same tier stay short and are recorded, not fixed — the `md` rail
  label on `--color-surface` (3.81:1 on Latte; needs a filled-row decision) and the base
  `a { color: var(--color-accent) }` rule (4.45:1, `a:hover` 2.62:1) — filed as T-37C. The
  `color(srgb …)` form Chromium reports for a `color-mix()` value is parsed explicitly in
  `CONTRAST_FN`; reading it as bytes produced a fake **17.23:1** on the first run and that is why the
  row asserts the unrounded ratio from the page, not a table.

## 2026-11-01 — T-47: every target inside a card reaches 44px

- **Changed:** `.card-foot` is a 44px band (`min-height`, `padding-top` removed — the band *is* the
  gap under the rule) and `a.card-author` stretches (`flex: 1 1 auto`, `line-height: 44px`) so the
  whole left of the row is the author's target and the ratio stays plain text; `PostCard`'s
  `.post-avatar` is a 44×44 box with `margin: -4px` around the unchanged 36px `Avatar` drawing, and
  `.post-author`/`.post-time` carry the same band; `UserCard`'s `.card-handle` is a `<p>`, not a
  second link to the profile. `docs/DESIGN.md` → *Card* records the rule and the numbers, `SHIP-PLAN`
  gets T-47, `scripts/smoke.mjs` grows row 30 (`EXPECTED_ROWS = 30`).
- **Verified how:** `./scripts/check.sh` GREEN (7 sections, `52 internal anchors are pushes` — one
  fewer, the person card's duplicate). `bash scripts/smoke.sh` **30/30**, `--live` **30/30** on Pages
  after `publish.sh` printed `LIVE=` and `curl` answered 200. Row 30 prints `catalog author 244×44 in
  a 45px foot, ratio 96% plain · thread avatar link 44×44 around a 36px drawing, @handle 44px — no
  horizontal scroll`; the breakpoint row still measures 1/2/3/3 tracks. Proved **red** first: with
  `line-height` back at 1.3 the row failed `the card's author link is 16px tall at 360`.
- **Not verified / found:** the first honest run failed at *width* — a 2-letter handle in a 44px-tall
  band is a 36px-wide target, which is why the link stretches rather than hugs its text. Nothing else
  in the card's box moved; the taller footer did not leak into the grid's track math.

## 2026-11-01 — T-46: every in-app anchor is a push, not a document load

- **Changed:** all 53 internal anchors now carry `onClick={follow(path)}` beside their real
  `href={href(path)}` (`Card` author, `UserCard` name/handle, `PersonaCard` name/Open, `PostCard`
  avatar/author/time/comments/attachment, `user-profile`'s *Edit profile* and *Sign in to follow*,
  the four catalogs' *Create*, the create/edit pages' back rows, `CommentThread`, `persona-collection`,
  `bookmarks`, `onboarding`, `authentification`, `terms`, the dev pages, `session-detail`'s speaker and
  copy rows). `EmptyState` now takes the **app path** (`to=`) and owns the `href`+`follow` pair, so its
  39 call sites cannot regress; `PostCard` keeps `permalinkPath`/`attach.path` as paths. The three
  page-local `openLink()` copies of `follow()`'s modifier check are deleted. New
  `scripts/link-check.mjs` is `check.sh` section 7; `docs/ARCHITECTURE.md` → Router records the rule
  (app path, never `href(...)`; fragments stay bare; `target=`/external exempt). `EXPECTED_ROWS` 29.
- **Verified how:** `./scripts/check.sh` GREEN (7 sections, `53 internal anchors are pushes`); the new
  section was **proved red** first — a scratch `src/pages/fake.tsrx` with one single-line and one
  multi-line bare anchor exited 1 naming both, while its fragment link and its paired anchor passed.
  `bash scripts/smoke.sh` **29/29** and `bash scripts/smoke.sh --live` **29/29** on Pages, row 29
  printing `document kept profile-edit (…, nav navigate)`; `publish.sh` printed `LIVE=`, `curl` 200.
- **Not verified / found:** row 29's first run failed on `document.querySelector("form")` — the account
  page draws `.form` as a `div` of `Field`s, not a `<form>` — so the row asserts the `Display name`
  input by `name`. The walk still cannot see a bare anchor on a page it never visits: `link-check` is
  the static half and the two together are the guard.

## 2026-11-01 — T-45: home's entry control pushes instead of re-booting the app

- **Changed:** `src/router.ts` now exports **`follow(to)`** — the one click seam — and `App.tsrx`
  (which had a private copy) and `CatalogSwitch.tsrx` (which had a second, differently-shaped copy)
  both import it; `src/pages/home.tsrx` pairs the entry anchor's real `href` with
  `onClick={follow(target.value)}` and `target` became an **app path** (`/authentification` or
  `/user/{handle}`) with `href()` applied in the markup. `scripts/smoke.mjs` grew the document-identity
  pair (`markDocument` / `expectNoReload`), an exact-path waiter (`expectPath`), the signed-in arm as
  row **28** ("profile from /"), an anchor/href assertion in row 1, and an explicit `EXPECTED_ROWS = 28`.
- **Verified how:** `./scripts/check.sh` GREEN. `bash scripts/smoke.sh` **28/28** and
  `bash scripts/smoke.sh --live` **28/28** on Pages; both T-45 rows print the document they kept
  (`document kept home-sign-in (timeOrigin …, nav navigate)`). The assertion was proved **against a
  red case**, not assumed: with `onClick` removed and the build rebuilt, row 1 failed with
  `home's Sign in re-booted the app: the document went from {"mark":"home-sign-in","origin":…177} to
  {"mark":"","origin":…943,"nav":"navigate"}` (and 18 rows after it cascaded red — a document load
  also drops the walk's session), then passed again once restored.
- **Not verified / found:** the first `--live` run after the naive fix failed **only** where it could:
  `follow()` takes an app path and `navigate()` adds the base, so `follow(href(x))` pushed
  `/LuaPlot/LuaPlot/authentification` — the app's own not-found page — while every local row stayed
  green (base `/`). `expectPath` now compares the whole pathname, because `waitUrl`'s substring match
  is exactly what hid it. The rest of the app still carries ~30 bare `<a href>` links (see
  `docs/NEXT.md` → T-46); home's was the primary one.

## 2026-11-01 — T-33B(a), webview half: the desktop window remembers the account

- **Changed:** nothing in `src/` — this tick is the desktop proof T-33B(a) left `UNVERIFIED`. The only
  edits are the register (`docs/NEXT.md`, `docs/SHIP-PLAN.md`) and this entry.
- **Verified how:** `./scripts/check.sh` GREEN, `bash scripts/smoke.sh --live` **27/27** on Pages.
  Then a real `bun run tauri dev` window on Victor's Hyprland session (WebKitGTK webview, origin
  `http://localhost:1420`), driven **keyboard-only** with `wtype` (`Tab`/`Return`) and read back with
  `grim -g "<at> <size>"` + `vision_analyze`, because `computer_use` returns **zero windows** in the
  cron env and Hyprland 0.56 has no click dispatch. Sequence proven twice over a process restart:
  *Sign out* → session line reads `SESSION · signed out` → `pkill -x luaplot`, relaunch → still
  `signed out`; *Sign in as @you* → `SESSION · signed in as You` → quit, relaunch → still
  `signed in as You`. Ground truth beside every screenshot, read straight out of WebKit's own store:
  `sqlite3 ~/.local/share/com.viicell.luaplot/localstorage/http_localhost_1420.localstorage
  "select key, quote(value) from ItemTable"` → `luaplot.session` = UTF-16LE `null` when signed out,
  `{"handle":"you","displayName":"You"}` when signed in — **no `isAdmin` field**, exactly the shape
  `storedSessionSchema` allows.
- **Not verified:** nothing outstanding for T-33B(a). (b) deep link and (c) `Ctrl/Cmd+K` remain
  blocked on a dependency and a product decision. `docs/NEXT.md` carries the driving recipe so the
  next session does not rediscover it.

## 2026-11-01 — T-33B(a): the session survives a restart

- **Changed:** `src/lib/state/session.ts` keeps the account in `localStorage` under `luaplot.session`,
  read **once at module load** and written only by `signIn` / `signOut` / `setAccount` (now through one
  `commit()`), so the restore happens before the first component exists and every `track()` consumer
  sees exactly the notifications it always did. `src/lib/schema.ts` grew `storedSessionSchema`, which
  parses the **stored string** — three states, and the difference between the last two is the ticket:
  no key = fresh install (seed the mock), `"null"` = signed out on purpose (survives a reload), a row =
  that account. Removing the key on sign-out would have made *sign out* last until the next launch.
  The row is `{handle, displayName}` via `profileWriteSchema`, so a restored handle is normalised by the
  same schema the onboarding form writes; **`isAdmin` is never persisted** (a client-writable store must
  not grant the admin mark) — the store re-attaches the seed's flag.
- **Verified how:** `bun run schema:check` grew **section 4** (normalises a row, reads an explicit null,
  refuses a client-written `isAdmin`, refuses corrupt/stale rows) and `./scripts/check.sh` prints GREEN.
  A CDP pass over a fresh Chromium profile on the **live** site: sign out → `localStorage` = `"null"` →
  reload → menu still reads *Sign in as @you* / *nsfw · off (signed out)*; sign in → row stored →
  reload → still signed in; a corrupt row (`{`) falls back to the seed with 0 page exceptions.
  `bash scripts/smoke.sh` 27/27 locally and `--live` 27/27.
- **Row 1 of the walk was lying, and is fixed.** `home.tsrx`'s entry control is an `<a>` with no
  `follow()`, so pressing *Sign in* hard-reloaded the app and the boot re-seeded the mock — the row's
  `/user/you` assertion was the **seed bug this ticket removes**, not a sign-in (`lib/auth.ts` writes no
  session until T-30). The row now asserts what ships: the provider button answers *cancelled* and
  signs nobody in, then the menu's own switch signs in as `you`. It is still 27 rows.
- **Not verified:** nothing about the Tauri webview. The proof ran in Chromium on the preview and on
  Pages; `bun run tauri dev` was **not** re-launched this tick, so the persistence is proven for the web
  bundle the shell loads, not for a mapping webview (same code, same `localStorage` origin). Left as
  `UNVERIFIED` for the desktop half until a tick opens the window and signs out/back in.

## 2026-11-01 — T-33 (part one): the desktop shell opens, and the gate now reads its config

- **The blocker was stale.** `docs/NEXT.md` had T-33 filed under *a display and `cargo`*. Measured
  this tick: `cargo`/`rustc` 1.99.0 present, `src-tauri/` already scaffolded with a `target/` of
  4.6G, the four Tauri system libs present (`webkit2gtk-4.1` 2.54.1, `javascriptcoregtk-4.1` 2.54.1,
  `libsoup-3.0` 3.8.0, `gtk+-3.0` 3.24.52), and a live session to open a window on (Hyprland 0.56.2
  on `wayland-1`, `/run/user/1000`). Only `DISPLAY`/`WAYLAND_DISPLAY` were unset, which is the cron
  env, not the machine. The register is corrected in `NEXT.md`.
- **Changed:** `src-tauri/tauri.conf.json` — the window opens at **1200×900** (`lg`, where the shell
  becomes a sidebar) instead of 800×600 (below `md`), floors at **360×740** — the width and height
  every page is designed at — is explicitly `"label": "main"` (the label the capability grants
  permissions to), centres, and is resizable. `scripts/tauri-config.mjs` (new) asserts those three
  decisions plus `frontendDist`, and `scripts/check.sh` grew **section 6** to run it: the one config
  no other gate section ever read.
- **Verified how:** `bun run tauri dev` launched against the live Hyprland session — `hyprctl clients
  -j` reported `{class:"luaplot", title:"LuaPlot", mapped:true}` and a `grim` capture of that window
  shows the app rendered (Mocha shell, `lg` sidebar with Home/Thread/Catalog/Alerts/Profile, the
  `Alerts` badge at 3, home hero, `SESSION · signed in as You`, `Open profile`). This is the
  ticket's accept criterion, measured, and it is the first time the desktop app has ever been run on
  this box. `./scripts/check.sh` **GREEN** including `tauri ok`; the new check was proven to bite by
  mutating the config to 800×600 / 320 floor (both FAIL lines printed, config restored);
  `./scripts/publish.sh` → `LIVE_JS=assets/index-DpakDGV9.js`, live root 200.
- **Not verified / deferred to T-33B:** `persistent session` (nothing to persist yet — `lib/state/
  session.ts` seeds `you` and T-30 will replace it with Supabase auth, so persisting a mock would be
  thrown away; still worth doing for the desktop reload), `deep-link handling` (needs
  `tauri-plugin-deep-link`, a dependency this ticket does not name), and `Ctrl/Cmd+K` (**no spec
  describes a command palette** — `grep -rn 'palette\|ctrl+k' src/specs/` finds nothing, and
  `luaplot-pages.md` is the product law, so a palette needs a recorded decision first). T-33's own
  four listed deliverables are therefore only its first one; the other three carry over.
- **Trap for the next desktop tick:** a plain `cargo build` debug binary loads `devUrl`, not
  `frontendDist`, so it opens a window that says *Could not connect to localhost: Connection
  refused* — that is not a broken app, it is a missing vite. Run `bun run tauri dev`; and build
  `dist` **without** `LUAPLOT_BASE` for Tauri (the app is served from `tauri://localhost`).

## 2026-11-01 — verify-only tick: no unblocked ticket, the tree is whole

- **Changed:** `docs/NEXT.md` only — the *verify-only tick* recipe under *What a tick does when
  nothing is unblocked* and the pipe trap at the top of *Found while working*. No app source, no
  scripts, no new ticket; the bundle is byte-identical to T-44's (`assets/index-DpakDGV9.js`).
- **Verified how:** `./scripts/check.sh` **GREEN** (build ok, `30 routes match the spec`, repo
  public, schema ok with all 22 comments in 12 roots); `bash scripts/smoke.sh --live` → **27/27
  journeys**, exit 0, against https://victor-viicell.github.io/LuaPlot/;
  `LUAPLOT_BASE=/LuaPlot/ bun run build` emits `assets/index-DpakDGV9.js`, exactly what the live
  `index.html` references — the deploy is `HEAD`, not a stale one; the live URL answers 200.
- **Not verified / found:** every remaining `[ ]` ticket still needs something this box lacks
  (Supabase project, a display + `cargo`, the Android SDK) or a human palette call (T-37B) — the
  register at the bottom of `docs/NEXT.md` is unchanged. Trap that cost this tick two runs:
  `bash scripts/smoke.sh --live | tail -50` prints no count and exits 0 because the pipe returns
  `tail`'s status; the walk was green both times, but only the unpiped run proves it.

## T-44 — the three dev pages walked, and the first breakpoint measured: 27 rows (2026-11-01)

- **Changed:** `scripts/smoke.mjs` — three journeys (one per dev page) plus helpers `toggleSource` /
  `toggleState` / `setToggle` (press the page's own `button.toggle`, then poll the rendered
  `aria-pressed` for the value), `storeCell` (a `.count` cell by its `.count-label`),
  `coveredCards`, `measureAt` (one `Emulation.setDeviceMetricsOverride` read) and the `BREAKPOINTS`
  table. Row count and exit check 24 → 27; header comments in `smoke.mjs` / `smoke.sh`.
  `/dev/state` flips Show+Blur through the page, reads the store back as `on · blur`, then proves
  the *catalog* obeys it (4 `.card.is-covered`, then 0 after restoring the seed pair it recorded on
  entry). `/dev/data` votes like on the first character and finds the write on
  `/character/catalog` (the card ratio equals the adapter's answer) and on the character page's
  Likes cell. `/dev/primitives` measures 360/640/900/1200 in a `try/finally` that clears the
  override, asserting no document-level horizontal scroll, Button ≥ 44 at every width, the card
  grid's track count, the Field gallery's columns, the rail/tab-bar swap at `md` and a 794px
  reading column at 1200 (not the 360 layout stretched).
- **Verified how:** `bash scripts/smoke.sh` **27/27** against the preview build and **27/27** with
  `--live` against https://victor-viicell.github.io/LuaPlot/ (the dev routes resolve under
  `/LuaPlot/`). Measured ladder, from the live row: `360:1col/field1/rail0/btn44/outlet340 ·
  640:2col/field2/rail0/btn44/outlet620 · 900:3col/field2/rail84/btn44/outlet794 ·
  1200:3col/field2/rail240/btn44/outlet794 — no horizontal scroll at any width`.
  `./scripts/check.sh` **GREEN**; `scripts/publish.sh` → live 200, `assets/index-DpakDGV9.js`
  (unchanged hash: scripts and docs only, no app source).
- **Not verified / found:** (1) **the card grid is 1 / 2 / 3 / 3, not 1 / 2 / 3 / 4** — `styles.css`
  stops at three columns at `lg` on purpose (a fourth would draw 163px cards in the 794px column),
  so `docs/DESIGN.md`'s "1 / 2 / 3 / 4" was stale and is corrected in this commit; the row asserts
  the stylesheet, not the old doc. (2) `.count-label` carries `text-transform: uppercase`, so
  `innerText` returns `SHOW`/`LIKES` — a case-sensitive label match finds nothing and reads as a
  missing cell; `storeCell` compares lowercased. (3) A vote on this fixture set moved the ratio
  **96% → 96%** (rounding), which is why the `/dev/data` row also reads the character page's Likes
  cell (97) instead of trusting the percentage alone. Not verified at all: the **bundled** Tauri
  road and every Android/desktop ticket — still blocked (register at the bottom of `docs/NEXT.md`).

## T-43 — `/dev/native`'s five presses are walked, and the walk is twenty-four rows (2026-11-01)

- **Changed:** `scripts/smoke.mjs` — five journeys, one per capability, each starting with
  `go("/dev/native")` so no row inherits another's state. New helpers: `capRowSource` /
  `pressCap` (finds the `.cap` row by its own `.cap-name` and presses through
  `Input.dispatchMouseEvent`, never `.click()`), `capAnswer` / `expectCap` / `expectCapOneOf` (read
  and require the exact sentence that row prints under `· last`, polling for the **value** so the
  badge row's second press cannot be satisfied by its first answer), `noCoreChunk` (zero `core-*.js`
  resource entries, asserted inside every journey), `openNative`, `mouseClickAt` (extracted from
  `realClick`), and a buffered CDP event queue plus `waitEvent` for `Page.fileChooserOpened`.
  The Pick journey enables `Page.setInterceptFileChooserDialog`, hands a real one-pixel PNG
  (`luaplot-pick.png`, written under `tmpdir()` and removed on exit) to the opened node with
  `DOM.setFileInputFiles`, and reads `ok · luaplot-pick.png`. Row count and exit check 19 → 24;
  header comments in `smoke.mjs` / `smoke.sh`.
- **Verified how:** `bash scripts/smoke.sh` **24/24** at 360×740 against the preview build and
  **24/24** against https://victor-viicell.github.io/LuaPlot/ — live rows read
  `copy reads "ok · LuaPlot · the native bridge"`, `shareText reads "ok · copied"`,
  `the chooser took luaplot-pick.png from disk and the row reads "ok · luaplot-pick.png"`,
  `"Native — LuaPlot" → "(3) Native — LuaPlot" → "Native — LuaPlot"`, each followed by
  `0 core- requests`. `./scripts/check.sh` **GREEN**; `scripts/publish.sh` → live 200,
  `assets/index-DpakDGV9.js` (unchanged hash: scripts and docs only, no app source).
- **Not verified:** the *bundled* road (a Tauri shell answering the plugin rung) — `src-tauri`
  still registers only `opener`, so every row here is the web fallback. The **two surprises**:
  (1) `navigator.vibrate` now answers truthy in this Chromium (155) — T-34 measured `false` — so
  the haptic row prints `ok · medium`, and the walk asserts *one of the two legal verdicts* rather
  than a literal (pinning it would turn a Chromium update red); (2) the baton's expected
  `(3) LuaPlot` was wrong: `App.tsrx` titles every non-root route `<Title> — LuaPlot`, so the badge
  reads `(3) Native — LuaPlot` and the journey derives the expected title from the pre-press value.
  Pick's *cancel* road (dismiss the chooser) is deliberately not walked — it would be a sixth row.

## T-42 — the six refusals walked, and the walk is nineteen rows (2026-11-01)

- **Changed:** `scripts/smoke.mjs` — a `refusal(message, catalogPath)` helper and three journeys
  after the persona step, each **two hops**: `/character/…0003/edit` (`ada`) →
  `This character isn't yours to edit.`, then `/character/…00ff/edit` → `This character doesn't
  exist.`; the same pair for `/lorebook/…0002/edit` (*Ashmarket Gazetteer*) and `/preset/…0002/edit`
  (*Long Table*), each against a dead id in its **own** bucket. `refusal()` asserts three facts per
  hop — the page's own sentence, that **no `<form>` mounted** (a refusal that still drew the editor
  would be a worse defect than wrong copy), and that the `Back to catalog` action resolves **under
  the served base** to that type's catalog. No persona row: a persona has no `forbidden` arm.
  Row count and exit check 16 → 19, header comments in `smoke.mjs` / `smoke.sh`, `docs/NEXT.md`
  rewritten for T-43, `docs/SHIP-PLAN.md` T-42 ticked + T-43 filed.
- **Verified how:** `bash scripts/smoke.sh` **19/19** at 360×740 against the preview build and
  **19/19** against https://victor-viicell.github.io/LuaPlot/ — the live rows print
  `ada's row → This character isn't yours to edit. → /LuaPlot/character/catalog | a dead id in the
  same bucket → This character doesn't exist. → /LuaPlot/character/catalog` (and the lorebook /
  preset pairs), which is the base-agnostic proof the ticket wanted. `./scripts/check.sh` **GREEN**;
  `scripts/publish.sh` → live 200, `assets/index-DpakDGV9.js` (unchanged hash: this ticket touched no
  app source).
- **Not verified:** no product defect found — all three pages already printed the right sentence and
  offered the right road out, so this bought regression coverage, not a fix. The `error` arm of the
  three phase unions is still unwalked (the memory adapter has no failing method to trigger it).
  **A defect that was mine:** the three `OTHER_*` constants first shipped without the trailing
  `/edit`, so the routes answered the app's 404 and all three rows failed on the first run — the
  bucket trap in reverse; the helper's message named the sentence and the path, so it cost one line.
  No Tauri/Android build.

## T-41 — the last three authored forms walked, and the walk is sixteen rows (2026-10-31)

- **Changed:** `scripts/smoke.mjs` — three journeys after the character edit-form step.
  `/lorebook/…1/edit`: preload read twice, a fifth entry block added and typed, **Save changes**, then
  the detail page prints that entry's body and its keyword (`repo.updateLorebook` proven). `/preset/…1/edit`:
  the stored model read *before* the change, `deepseek-chat → deepseek-reasoner` through a real
  `change` event, and the description asserted unchanged after the write (a sibling-dropping save is
  the defect a name-only assertion misses). `/persona/…1/edit`: the tagline replaced, printed by the
  detail page **and** by the collection card, then an unused id in the persona bucket asserts
  `This persona doesn't exist in your collection.` — the sentence that replaces `forbidden` for a
  personal type. Helpers: `retype()` (select-all + `Input.insertText`, value read back and compared),
  `choose()` (native `<select>` by value + real `change`, read back), `settingValue()` (a preset
  detail settings row by term). Row count and exit check 13 → 16, header comments in `smoke.mjs` /
  `smoke.sh`. `docs/NEXT.md` rewritten for T-42, `docs/SHIP-PLAN.md` T-41 ticked + T-42 filed.
- **Verified how:** `bash scripts/smoke.sh` **16/16** at 360×740 against the preview build and
  **16/16** against https://victor-viicell.github.io/LuaPlot/ (rows print their own evidence:
  `the list grew 4 → 5 and the detail page prints the entry and its keyword`, `model deepseek-chat →
  deepseek-reasoner, and the description survived the same write`, `the tagline reached the detail
  page and the collection; an unowned id reads "doesn't exist in your collection"`). `./scripts/check.sh`
  **GREEN**; `scripts/publish.sh` → live 200, `assets/index-DpakDGV9.js`.
- **Not verified:** no product defect found — all three forms preloaded and saved correctly on the
  first pass, so this ticket bought regression coverage, not a fix. The `error` arm of the four phase
  unions is still unwalked (the memory adapter has no failing method to trigger it). No Tauri/Android
  build. **One defect was mine and the live walk caught it**: the three new steps asserted
  `^/lorebook/…` on `location.pathname`, which is true in preview and false on Pages
  (`/LuaPlot/lorebook/…`) — local 16/16, live 13/16 on the same bundle. Fixed to a suffix match (the
  `go()` rule); the lesson is in `docs/NEXT.md`.

## T-40 — the case panel stops lying, and the edit form's identity is proven (2026-10-31)

- **Changed:** `src/pages/moderation-detail.tsrx` — `itemViewOf()`'s post arm read a hard-coded
  `No visibility`; it now reads the row's own `post.status` (`postStatusSchema`) and answers
  `Visible` / `Removed`, with `Removed — its whole comment thread went with it.` as the detail line.
  `scripts/smoke.mjs` — a thirteenth journey (*open a second edit form*) hops between two own
  characters' edit routes and asserts the name field equals the URL's character on two reads, and
  the *conclude* journey now reads THE ITEM panel before and after and requires the removal to
  appear in place. `docs/DESIGN.md` — the "mount only once the row resolved" decision and the
  "the visibility chip is the row's fact" rule, both recorded.
- **Verified how:** `./scripts/check.sh` **GREEN** (build ok, 30 routes, schema ok);
  `node scripts/smoke.mjs --url https://victor-viicell.github.io/LuaPlot/` **13/13**. The case step
  prints its own evidence: panel `"…SA @sable No attachme…"` → `"…SA @sable Removed — its whole
  com…"` with no reload. The edit step prints `both reads on /character/…1c/edit printed "Iolande,
  Second Ledger"`. Published: `scripts/publish.sh` → `gh-pages` @ `4f7ec35`, live 200.
- **Not verified:** the edit-form half of the ticket did **not** reproduce — a probe that reads the
  first input at 1ms, 2ms and every frame after an in-app hop saw the previous name for exactly one
  frame, before the outlet's own `loading` skeleton replaced it, and both post-settle reads were
  correct. That stale frame is the shell's transition (`status` flips in a batched effect after
  `navigate()`), not the form; it is left as is. The walk's new step is therefore a regression guard,
  not a fix. No slower device was available to reproduce the original 1.5s report.

## T-34 — the native bridge, with the web road proven and the plugin rung inert (2026-10-31)

- **Changed:** `src/lib/native.ts` — five capabilities (`haptic`, `shareText`, `copy`, `pickImage`,
  `setBadge`) over one ladder: `invoke("plugin:<name>|<command>")` → the web API → `unsupported`.
  `isNative()` reads `window.__TAURI_INTERNALS__` at runtime; every Tauri import is dynamic inside
  that branch, memoised, and a rejected `invoke` is *absent* rather than *failed*, so the web road
  runs even though `src-tauri` registers no haptics/badge/clipboard/dialog plugin yet (installing
  one is one string in `COMMANDS`). Added `nativeResultSchema` (`{ok,value?}|{ok:false,reason}`,
  `reason` = `unsupported|cancelled|failed`), `hapticKindSchema`, `sharePayloadSchema`,
  `clipboardTextSchema`, `badgeCountSchema` to `schema.ts`, and `/dev/native` — five rows whose
  "road" column is imported from the module, a 44px button each, and a six-deep log of the parsed
  answers.
- **Verified how:** `./scripts/check.sh` GREEN (30 routes, schema ok, build ok); `bun run smoke`
  **12/12** after the router change. In Chromium against `preview :4321`: `copy` on a *synthetic*
  click answered `unsupported` (clipboard needs a trusted gesture, and `execCommand` needs one too)
  and on a **real CDP click** answered `ok · LuaPlot · the native bridge` — the gesture rule is now
  measured, not asserted; `shareText` answered `ok · copied` (no `navigator.share` here, so it fell
  to the clipboard); `haptic` answered `unsupported` (`navigator.vibrate` exists but returns false —
  no motor); `setBadge(3)` wrote `(3) 🐴 Native — LuaPlot` and `setBadge(0)` restored the title
  with no double prefix; dismissing the picker answered `cancelled` and removed its input. Bundle:
  `dist/assets/index-*.js` has **zero** `@tauri-apps` strings and `performance.getEntries` shows
  **zero** `core-*.js` requests in the browser — the chunk exists (`core-CwBWH9_g.js`) and is only
  referenced by a dynamic `import()` in the dev-native chunk. Widths 360/640/900/1200: no
  horizontal overflow, buttons 44px.
- **Not verified:** the shell side — `bun run tauri dev` was not run (no window in this session), so
  rung 1 is untested by construction; the badge on a real home screen and haptics on a device are
  T-36's acceptance, not this ticket's.

## Profile cards, personas as a component, and the scoped-CSS bug behind the missing gap (2026-10-31)

- **Found the cause of "no gap for the creation tabs":** `user-profile.tsrx` had its `<style>` block
  *inside* the root `<div class="profile">`. Ripple scoped the rules to `.profile.tsrx-…`, the root never
  got the hash class, and **the whole page's CSS was inert** — no flex column, no gap, no grid. Moving the
  style out (root becomes a fragment) fixed it: `.profile` is `display:flex; gap:18px` again, measured 18px
  between the tab strip and the cards.
- **User cards:** new `UserCard` — the catalog card with the bio in the tagline slot and the footer
  carrying *N followers · N following*, handle under the title. The Followers/Following tabs now draw a
  `card-grid` of them (4 cards, avatar 102 on a 338 card, title/handle/bio/footer all measured).
- **Personas as a component:** new `PersonaSheet` (list with the Default mark, **Edit** per row, inline
  editor for name/tagline/description/initials gated by `personaWriteSchema`, Delete behind a confirm,
  `New persona`), and `Sheet` gained `full` — **full screen on a phone, centred dialog from `md`** (measured
  380×844 at 390 and 560×344 centred at 1280; a full sheet fades instead of sliding). Mounted from the
  profile's **Personas** button, which now sits beside **Edit profile**, and from the session's header in
  chooser mode (`Use` + *No persona*), replacing the old bare menu list.
- **Verified:** editing *Ash* → *Ash Renamed* saved, returned to the list, toast *Persona saved*; the
  session sheet shows 3 rows, one marked *In use*, `Use` on each, and the *No persona* line; closing works.
- **Not verified:** `/persona/collection|create|edit|detail` still render their own forms — the deep links
  were left as they are (the sheet is what the app uses), so the create/edit forms exist twice until they
  are folded into the sheet.

## Card middle: tags get their own row (2026-10-31)

- **Changed:** on the owner's call the card's middle split in two — `avatar | tagline` on the first row, the
  **tag row across the full card width** on the second, directly above the footer's separator (the
  separation before the author and the ratio). The veil wraps both rows so a Blur still covers the tags,
  the tagline's clamp went 2 → 3 lines, and `.card-top .card-body` is the only child that grows.
- **Verified:** live at 390 the tag row is 308 wide and *The Lamplighter's Widow* shows all five tags with
  no counter; at 1280 (card 225, row 195) it shows `ghost · harbor · +3`, still one 26px line, always above
  the footer, inside `.card-veil`, tagline 62px (three lines). No horizontal scroll either width.
- **Note:** the change was swept into the rotation's commit `ee171af` (it was in the tree when that tick
  committed); this entry and the spec/DESIGN lines are the documentation half.

## T-38 — the twelve journeys, walked in one scripted session (2026-10-31)

- **Changed:** `scripts/smoke.mjs` — a dependency-free CDP walk (Node's global `WebSocket` plus
  `/json/new`) of the twelve primary journeys **in one session**, one Chromium at 360×740, twelve
  rows of `{journey, started, ended, evidence}`, exit 1 unless all twelve pass. Every step asserts on
  the DOM (the sentence a page prints, the badge label, the card leaving the grid, the button's
  `aria-pressed`), never on the adapter. `scripts/smoke.sh` serves the build under test
  (`bun run build` + `vite preview :4321`), walks it, tears the server down; `--live` walks
  `https://victor-viicell.github.io/LuaPlot/`; `bun run smoke` is the alias. In-app hops push the
  route and dispatch `popstate` — the router's own listener — so the memory adapter is never
  re-seeded mid-journey, and every path resolves against the served base (`/`, `/LuaPlot/`).
- **Verified (12/12, ~7s per walk, three consecutive runs + one through the wrapper):**
  1. sign in from `/` — sign out in the menu, "Sign in" → `/authentification` → Google → home prints
     *signed in as You*, tab bar back to Profile `/user/you`.
  2. publish from `/post/create` — types a body, Publish lands on `/post/<uuid>` printing it back.
  3. comment — the reply appears in the thread.
  4. vote — Like reports `aria-pressed=true` (was `false` on a brand-new post).
  5. save and unsave — the card is in `/bookmarks?type=post` and *Remove bookmark* takes it out.
  6. follow and unfollow — mira's control walks Follow → Unfollow → Follow (the seed starts followed,
     so the walk normalises first).
  7. start a session — Sonic's page → *Start a session* → `/session/<uuid>` with a turn composer.
  8. edit an own character — Iolande's *Request public again* is **disabled** before the edit and
     **enabled** after *Save changes*.
  9. report a post — the dialog's five steps submit and `/moderation?admin=1` goes **3 open → 4 open**.
  10. conclude as removed — the post case prints *Concluded · removed*.
  11. read a notification — 4 unread rows → 3, the tab bar goes "Alerts, 4 unread" → "Alerts, 3 unread".
  12. sign out — home reads *signed out*, the Profile tab points at the site root.
- **Live walk:** the same twelve rows pass against **https://victor-viicell.github.io/LuaPlot/**
  (`node scripts/smoke.mjs --url https://victor-viicell.github.io/LuaPlot/`, 12/12 in 7s) after one
  fix the live run found: journey 1 waited for `href === "/user/you"` and Pages prefixes the base
  (`/LuaPlot/user/you`), so the assertion matches the suffix — the fact is "the Profile tab follows
  the session", not the base path. `go()` resolves every hop against the served base for the same
  reason.
- **Not verified / notes:** pages other than these twelve (personas, presets, lorebooks, `/user/edit`,
  `/terms`, `/onboarding`) are outside the present walk; the walk is not in `check.sh` because it
  needs a browser + a preview server (the gate stays browser-free; a laptop without Chromium must not
  fail a commit) — `bun run smoke` is the command. A journey's post is **POST(8)** on purpose: the
  preview classifier's FNV bucket for its body is an *escalation*, which is the only way a report
  lands on a case instead of an immediate verdict (`mock.ts`). The walk flaked once on a **reused**
  Chromium profile (58s, five cascading failures); profiles are now unique per run (`mkdtemp`) and the
  page's own `Runtime.exceptionThrown` is quoted on a failing row.

## Card tags on one line, the rest behind +N (2026-10-31)

- **Changed:** the owner reported the card tag rows breaking lines. `Card` now measures which whole tags
  fit the row (reserving ~42px for the counter), renders only those, and puts the rest behind a `+N`
  chip; tapping it opens a floating `.card-menu` listing exactly the hidden tags (fixed positioning so a
  card cannot clip it, z-index 20, Escape and an outside tap close it, a `ResizeObserver` re-measures and
  closes it on reflow). The measurement reads a hidden twin of the row (`.card-tags.is-measure`) so
  every chip keeps its real width even after the visible ones change. `luaplot-pages.md`, the character
  catalog spec and DESIGN carry the rule; two fixtures gained tags (Lamplighter's Widow 5, Hollow Saint 5)
  so the path is visible in the preview rather than only in tests.
- **Verified:** at 390 the widow's card shows `ghost · harbor · +3` in one 25px row with no overflow, and
  the menu opens under the chip with `ritual, family, debt`, clamped into a 390 viewport (chip left 264 →
  menu left 182); scrim tap closes it, `Escape` closes it, and reopening works. At 1280 the same card is
  225px with a 118px tag row showing `ghost · +4`, still one line, no overflow. Cards with two tags show
  no counter.
- **Not verified:** the menu over a *covered* (blurred) card — the trigger sits inside the veiled middle,
  so it is unreadable until Reveal; judged acceptable (the tags are content, and the cover hides content),
  but not walked on a device.

## Desktop audit — the A4 cap that never applied (2026-10-31)

- **Root cause:** the owner reported the NSFW rows looking compressed and misaligned on desktop. The
  switches were part of it, but the real fault was `App.tsrx`'s `@media (min-width: 1200px) .outlet
  { max-width: 1120px }`, which overrode the A4 cap added in T-15 — every desktop page was laid out
  940 wide instead of 794, so controls designed for a 794 column were stretched or squeezed at random.
- **Changed:** the 1120 override is gone (794 is the cap at every width, one owner); the three catalogs'
  toolbars are `220px + 1fr` with the switches sharing the wide column (332px each at 1280, was 139);
  between 640–899 the switch pair drops to its own full-width row (270 each at 640, was 148 and both
  labels wrapped); the thread's controls lost the inert `Filter: All` chip and went to `200px + 1fr +
  auto` (199 each, no wrap); bookmarks' toolbar finally places its sort in its own column instead of
  spanning a row of its own (it inherited `grid-column: 1 / -1`); character/lorebook/preset detail
  heads top-align the identity (`align-self: start`) and the settings button lost its `-10px` margins
  that hanging it above the head; the session's wide layout is centred on a 794 column; post detail's
  aside is 240px (was 300, leaving a 382px body); the card grid stops at three columns (was four at
  1200 → 163px cards).
- **Verified:** build clean; measured at 640/700/900/1280 on the three catalogs and the thread: switches
  270/270 at 640 and 219–227 above 900, labels single-line everywhere, no horizontal scroll, outlet
  exactly 794 above `sm` on every page walked (catalog, thread, bookmarks, notifications, all three
  detail pages, forms, session, moderation, profile, persona, terms, onboarding, auth), card grid 2/3/3
  with cards 278/233/225. The report sheet is 520 wide centred with 478px choices.
- **Not verified:** real desktop browsers (Firefox/Safari) — Chromium at 1× only; the `md` rail's
  interaction with the 794 column was measured but not compared against a designed target.

## Copy pass — the interface stops explaining itself (2026-10-31)

- **Changed:** on the owner's call (*too much text on the users' faces … no one will read*), the copy law is
  now written twice — `luaplot-pages.md` → Conventions and `docs/DESIGN.md` → *Copy law* — and applied
  across the app: **21 page ledes gone** (catalogs, forms, home, bookmarks, notifications, moderation, the
  thread, auth, persona collection, post create), every per-field `help` line in `CharacterForm`,
  `LorebookForm`, `PresetForm`, `PersonaForm`, `user-edit`, `moderation-detail` and `ReportDialog`, the
  `hint` under every NSFW switch (forms, `NsfwControl`, onboarding), the "Pick one, or both / Pick as many
  as apply" instructions, every `.section-note` / `.field-note` (references-not-copies, persona-stamp,
  preset-provider, entry-injection), the session's cut-range note and persona explainer, and the persona
  picker's paragraph. Dead `.lede` CSS removed with them. **429 lines deleted, 3 added.**
- **Kept on purpose**, per the law: delete confirmations ("Delete this character and its whole comment
  thread? This cannot be undone."), the terms page, moderation outcomes, and one-line states — *Nothing
  has been said yet*, *This lorebook has no entries yet*, *No characters yet. Create one*, *Sign in to keep
  flagged characters in listings*, *Preview — no provider is contacted*.
- **Verified:** build clean at every step; a browser sweep at 390 found zero `.lede` / `.section-note` /
  `.field-note` / `.range-note` / `hint`-derived lines on `/character/catalog`, `/character/[id]`,
  `/post/thread`, `/character/create`, `/preset/create`, `/bookmarks`, `/notifications`, `/persona/[id]`
  and `/moderation?admin=1`, no horizontal scroll, and the forms still open on their first control at 122px.
  A lowercase-fragment scan over every `.tsrx` found no sentence cut in half.
- **Not verified:** touch-device pass; the empty-state lines kept on purpose were not re-read on every page.

## T-09 follow-up — the catalogs link to each other (2026-10-31)

- **Changed:** the owner could only reach the character catalog: lorebooks and presets had pages but no
  way in from the navigation. Every catalog now opens with a **catalog switcher** (`CatalogSwitch`) —
  Characters · Lorebooks · Presets as three anchors, `aria-current="page"` on the current one, the accent
  underline as the mark, 44px targets, styled next to `.tabs` in `styles.css`. Placement is above the
  header so it is visible without scrolling.
- **Verified:** build clean. On the dev server: all three routes draw the strip with the right tab marked
  (20 character cards, 5 lorebook, 4 preset), 45px tall, full width 308 in a 360 viewport with no
  horizontal scroll; clicking **Presets** from the character catalog navigates in-app to
  `/preset/catalog` and the page swaps its kicker (*preset catalog*) and its button (*New preset*).
- **Not verified:** no click-through on a touch device; the bottom tab bar still marks *Catalog* active
  only under `/character` (its prefix is one route, and it was not part of this change).


## T-37 — contrast fixed at the token, and the rest measured (2026-10-31)

- **Changed:** `src/styles.css` only — no component, no page, no dependency. `--color-text-subtle`
  is now **the muted tier's value** (overlay-1 measured 4.44:1 on the page and 3.40:1 on a card;
  a 12px label cannot take that), so the label tier is carried by size and `.08em` tracking instead
  of a dimmer tone. `--color-text-muted` steps to `subtext-1` on **Frappé and Latte** (subtext-0
  measured 4.26 / 3.20:1 on their card surface). `--color-accent-contrast` is now `--ctp-base`
  (crust on mauve was 4.09:1 on Latte, the primary button's own label). One new named token,
  `--color-avatar-text` (muted in dark, `--ctp-text` in light — initials sat at 4.05:1 on Latte's
  surface). Every value is a Catppuccin ramp step; no hex entered app code.
- **Verified:** `scripts/check.sh` GREEN; live 200. Measured in the browser at 360×740 over `/`
  `/post/thread` `/post/<id>` `/character/<id>` `/bookmarks` `/moderation?admin=1`, walking every
  element with a text node, resolving its effective background through the ancestor chain and
  computing WCAG ratios on the computed colours: **dark (Mocha) 0 failing text pairs — was 20+
  (subtle at 2.83–3.40:1, the primary button at 4.09:1 in light)**; light (Latte) 4, all one pair
  (below). Also measured: **0 unnamed focusables** across the six routes at 360 and 1280 (AX tree,
  roles button/link/textbox/combobox/tab/checkbox), **0 positive `tabindex`** anywhere and a
  55-stop tab sequence that follows DOM order, **no page-level horizontal scroll** in 35
  width/route pairs (320/360/400/640/900/1200/1280), and **no layout shift on fonts**: all six
  `@font-face` rules carry `font-display: swap`, and the header measures **56px with the woff2
  loaded and 56px with `*woff2*` blocked** (`body` 740 in both).
- **Bundle, recorded so nobody hunts it again:** `dist` 1.1 MB; every JS chunk 728 KB raw /
  **186,716 B gz**; CSS **23,783 B gz** (236 KB raw); the only asset over 40 KB is the JetBrains
  Mono Latin woff2 at 40,404 B. The ticket's < 300 KB gz budget is met with ~113 KB to spare.
- **Not verified / known fail:** Latte's **active tab label** is `--color-accent` on
  `--color-bg-elevated` = **4.45:1**, 0.05 short, and Catppuccin Latte has no darker mauve step —
  closing it means inventing a colour or moving the tab bar's surface, i.e. a design decision, filed
  as **T-37B**. Frappé and Macchiato were computed token-by-token, not walked in the browser.
  Tap targets: the project's 44px rule still fails for **card-footer author links (16–21px tall,
  inline text so WCAG 2.2 `2.5.8` exempts them)** and **avatar links at 36×36** (AA's 24×24 floor
  passes) — recorded, not redesigned inside a measurement ticket.

## T-28B — a post can be removed (2026-10-31)

- **Changed:** `postSchema` grew `status: z.enum(["visible","removed"])` (one new `postStatusSchema`,
  type by `z.infer`); fixtures give every post a status and seed **post 6 as `removed`**;
  `clearAction("post")` in `jevPolicy.ts` answers `removed` again (the escalation branch and its
  sentence are gone, `docs/JEV.md` → *Limits* updated); `removePost()` in the adapter is the one write
  both `applyJevAction` and `concludeReport` make — status flipped, thread deleted in cascade, vote
  dropped, row kept; `livePost()` filters `listPosts` and `profilePosts`, the bookmarks tab draws a
  removed post as a dead card, and `getPost` still answers it by id; `/post/[id]` gained the
  *Removed by JEV* state (spec sentence *This post doesn't exist anymore.*, no counts/actions/thread,
  plus one finality line for the author). `deletePost`'s cascade is unchanged.
- **Verified:** `scripts/check.sh` GREEN (build, 30 routes, schema: 22 comments); live `200` on the
  published build; in the browser `/post/90570000-…-0006` draws the removed state and the feed does
  not list it; in-app a moderator concluded open case `REPORT(2)` as **removed** and the case closed
  with *Concluded · removed*. Headless walks against the memory adapter: post 6 absent from the feed
  and from orin's timeline, 11 visible posts on the feed; concluding REPORT(2) removed post 7, took
  its comment with it, dropped it from the feed and sable's timeline, and refused a second
  conclusion; a saved removed post is `item: null`; and a post the preview reads as a certain
  violation is **removed at once** by `addReport` (no case opened, notification names `removed`, no
  republication notice).
- **Not verified:** the bookmarks tab was checked at the adapter (`item: null`) but not walked in the
  browser; and the case page's *THE ITEM* panel still prints a removed post's body until it is
  reloaded (there is no re-render after *Conclude*), which the specs neither require nor forbid.


## T-28 — the owner's side of a moderation outcome (2026-10-31)

- **Changed:** `moderationNoticeSchema` + `republicationOutcomeSchema` in `schema.ts` (types via
  `z.infer`); an immediate action now writes **one notice row per measure** beside the creator's
  notification, so T-27's case-less hide finally has a record; `repo.moderationNotice(kind,id)` answers
  the newest of that row and the case that hid the item (one call, two sources, decided in the
  adapter); `repo.requestRepublication(kind,id)` runs `classify()` at once, owner-only, authored kinds
  only, and sets `verified`+`isPublic` only on a clean answer. `character-detail`, `lorebook-detail`
  and `preset-detail` replaced their `listReports` scan with that one call and gained *Request public
  again* (gated on `updatedAt > notice.at`, with a sentence saying why it is closed), *Awaiting
  re-verification* (skeleton lines, never a spinner) and *Verified and public again* (clears itself
  after 3.6s). Decisions written in `docs/DESIGN.md` + `docs/ARCHITECTURE.md`.
- **Verified:** `scripts/check.sh` GREEN (build, 30 routes, schema section); live `200` on the
  published build, and the whole loop walked in the browser at
  `/character/c0a1b2c3-0000-4000-8000-00000000001c` (owner + private fixture): notice with reasons and
  JEV's note; the button **disabled** with its sentence while `updatedAt` was older than the measure;
  **Edit → save** in-app reopened the gate without a reload; **Request public again** showed
  *Awaiting re-verification* with the mock verdict, closed the gate again on the refusal; a second
  edit then returned *Verified and public again*, and the confirmation cleared itself into the public
  view (Fork/Start back, no notice).
- **Not verified:** the same three states on `/lorebook/[id]` and `/preset/[id]` — the block is the
  same code in the same shape, typechecked and built, but only the character page was walked; and a
  real (non-mock) JEV answer, since the preview has no key.

## T-27 — the JEV adapter, and a queue that now means something (2026-10-31)

- **Changed:** `lib/llm/jev.ts` is transport only — `POST https://openrouter.ai/api/alpha/decisions`,
  `typesafe/jev-1.14`, `{model,state,questions}`, `jevRequestSchema` before the fetch and
  `jevPayloadSchema` after it with `provider: "TypeSafe"` a literal, so a chat-model fallback fails
  the parse instead of answering; `null` on any failure and a second `same_text` request only when
  an internal copy claim's source was fetched. `lib/llm/jevPolicy.ts` holds the four thresholds (each
  cited), `claimOf()` (the report names its claim, so the model is not asked a fact the payload has),
  `decide()` and the action table; a post's certain violation escalates because `postSchema` has no
  status. `schema.ts` gained the answer/request shapes; `mock.ts` gained deterministic
  `mockJevAnswers`/`mockSameText`; `addReport` runs **one scan per item change** — act + notify the
  creator with no case, clean + set `verified`, or escalate with the verdict stored on the case — and
  a new case now carries `history: []`. Queue and case page print a `Preview mode` chip from
  `previewMode()`.
- **Verified:** `scripts/check.sh` GREEN (build, 30 routes, schema section). Policy exercised by a
  probe over 13 cases (failure→unsure, clear→removed/made-private, post→escalated, borderline→
  escalated, clean→none, image/external→escalated, internal same→violation, internal different→
  clean, internal unfetched→unsure, minor→escalated, image-only→escalated) plus the payload gate
  (extra fields parse, `provider: "OpenAI"` rejected, `criteria` map rejected). Adapter exercised
  against the memory store: a held report on verified content scans nothing, a report that opens a
  case stores `unsure/escalated`, a second report joins it (weight 6→7, verdict untouched), a
  self-referencing internal copy claim on a comment **removed** it (placeholder body, no case,
  creator notified `removed`), the same on a character made it **private** (`made-private`), and a
  copy claim without a source is refused. Live `200` on the published build.
- **Not verified:** no real OpenRouter call from this box — `VITE_JEV_ENDPOINT` is unset, so every
  tick above took the mock path; the decisions response was checked against the shape recorded in
  `references/openrouter-decisions-api.md`, not against a live key. No vision pass exists, so image
  surfaces escalate by design.

## T-26B — the case itself, and the decision it closes with (2026-10-31)

- **Changed:** `pages/moderation-detail.tsrx` replaces the placeholder — the case is drawn as
  evidence (JEV ledger with its confidence, the item read-only in full, every filing with its reason,
  surface, details and source split by `reportSourceIsExternal`) above a decide panel that is one
  operation (outcome the target allows, `Remove avatar` inside it, one `Reason` field) and a dismiss
  block gated on the three `TERMS_RULES` ticks. Adapter: `concludeReport` (applies public/private to
  authored items, `removed` to a comment, writes status + clock + `concluded`/`avatar-removed` events
  + decision + the creator's moderation notification), `dismissReport` (no visibility change, notifies
  nobody), `addCaseComment`, `getComment`. Schema: `caseEventSchema`, `caseDecisionSchema`,
  `caseOutcomeSchema`, `caseConcludeSchema`, `caseDismissSchema`, `caseCommentSchema`,
  `reportIdSchema`, `termsRuleSchema`; `reportSchema` gained `history` + `decision` and refines the
  concluded/open pair. Fixtures: history on all five cases, decisions on the two concluded ones, and
  `COMMENT(12)` is now the removed placeholder that case decided.
- **Verified how:** `scripts/check.sh` GREEN (build, 30 routes, schema check); in a browser against
  `vite preview` — conclude with avatar removal flipped the case to `CONCLUDED` with the decision
  block, the history rows and a new `Your character had its avatar removed — Hollow Saint / now` row
  in the inbox (3 → 4 unread, reached in-app); dismiss on case 5 closed it as `Dismissed — no
  violation`, kept the badge at 3 and logged the note first; report dialog-free states checked:
  post target offers only `Removed` with *No avatar to remove*, comment case read-only, `notfound`
  and `forbidden` copies, no horizontal overflow at 360 and a two-column layout at 1000/1280.
- **Not verified:** nothing on a real Supabase adapter (memory only), and a **post removal has
  nowhere to land** — `postSchema` has no status, so the decision is recorded on the case and the
  post row stays. Logged in `docs/NEXT.md` as a gap to file.


## T-26 — the moderation queue, weight first and metadata only (2026-10-31)

- **Changed:** `pages/moderation-queue.tsrx` is no longer a `PagePlaceholder` — it draws the queue on
  the spec's one order (`weight` desc, then newest report, both the adapter's), page 1 with no
  `Load more`, a `Select` filter (open / concluded / all) in the query string, and one counts line
  (`3 open · 2 concluded`) read from two `listReports` calls made on every mount. A row carries the
  content type and status, the clamped `target.label`, the reason spread with `jev.verdict` leading
  (`JEV unsure · NSFW flag · copied text`), the weight as a tabular numeral under a `weight / case`
  header, `last report 2d ago`, and what JEV already did when it acted — no preview of the content
  anywhere. `forbidden` is a phase, not a redirect (mock `isAdmin` is false; `?admin=1` is the
  reviewer's switch and survives a filter change). Schema side: `reportFilterSchema` (the URL and
  `listReports` now share one vocabulary, `ReportFilter` is its `z.infer`), `reportSourceIsExternal()`
  (internal id vs outside link, one home), and `relativeAge()` in `lib/format.ts` for *2d ago* /
  *on 13 Oct*. `docs/DESIGN.md` → *Moderation queue (decided in T-26)*.
- **Verified:** `scripts/check.sh` GREEN (build, 30 routes, schema check). Against the dev build at
  360×740: `/moderation` draws *Only a moderator can open the queue.* + **Go home**; `?admin=1` draws
  weights `6, 3, 2` (open) and `9, 2` (concluded), `?status=all` re-asks the adapter and draws
  `9, 6, 3, 2, 2`; the filter writes `?status=concluded&admin=1` and the counts line stays
  `3 open · 2 concluded`; the post case reads `JEV unsure · NSFW flag · copied image`, the newest
  concluded one `JEV unsure · copied text from outside` (*that* is the internal/external split
  working), and the privatised character `JEV violation · copied text` + `JEV made it private`.
  `scrollWidth - clientWidth` is `0` at 360 and at 640 / 900 / 1280, where the weight moves to 26px
  and the lede appears; clicking a row lands on `/moderation/<id>` in-app (the case placeholder).
- **Unverified:** the `error` arm is drawn but not provoked (the memory adapter cannot fail), and
  nothing here is a real role — `isAdmin` stays the mock's `false` until T-30, so `?admin=1` is the
  only route to the queue. Paging is untested beyond five fixtures: `hasMore` would print `24+` and
  still draw no control, which is the deliberate gap recorded in NEXT.

## T-25 — the NSFW preference on every listing, in both signed states (2026-10-31)

- **Changed:** new `components/NsfwControl.tsrx` — the Show/Blur pair signed in, one `Show NSFW
  content` control leading to `/authentification` signed out — now used by the three catalogs and
  `/post/thread`; those pages lost their `Toggle` pair, their two handlers and their signed-out
  navigate branch. `lib/state/prefs.ts` gained the signed-out **intent** (`requestShowNsfw`,
  `showRequested`, applied after the sign-in re-read, dropped on sign-out), and
  `/authentification` draws that one action under a 12px `nsfw content` caption. A reveal now dies
  with its fetch: `CardGrid` takes `revealEpoch`, `/post/thread` keys its feed by
  `id#epoch`, `/bookmarks`' `cellOf` and the profile grid do the same, and every `replace` fetch
  bumps the counter (an `append` does not). `docs/DESIGN.md` → *NSFW preference everywhere*.
- **Verified:** `scripts/check.sh` GREEN (build, 30 routes, schema check). Against the live build at
  360×740 (`scrollWidth 360` on `/authentification`, `/character/catalog`, `/post/thread`): signed in
  both catalogs draw the pair with their own noun in the hint; Show on + Blur on → 24 cards, 4
  `.is-covered`, each veil `filter: blur(6px)` and each `.card-foot` `filter: none` (*the numbers are
  never hidden*); Reveal takes that one card to covered 3; a sort change and back re-covers it
  (4 again). Signed out (preview switch): catalogs/thread draw one `.btn` and zero `.toggle`, feed
  down to 11 posts, control lands on `/authentification`, whose `.nsfw` row reads
  `Show NSFW content · Applies to the account you sign in with.`; pressing it sets
  `aria-pressed="true"`, signing in removes the row, and the shell's dev line then reads
  `nsfw · listed, uncovered` — the intent reached the account.
- **Unverified:** the auth page's intent path is only exercised through the preview's memory
  adapter and its sign-in switch (a real provider redirect is T-30). The profile posts feed still
  keys on `post.id`, so a revealed post there survives a tab switch — filed below. No automated
  browser test exists; the pass above was driven by script against the live URL.


## T-24 — the terms page, its anchors, and the report reason that points at one (2026-10-31)

- **Changed:** `pages/terms.tsrx` is the page, not a placeholder — kicker/title/lede, the three
  prohibitions as a numbered list (`#copied-content`, `#unmarked-nsfw`, `#illegal-content` from
  `TERMS_RULES`), then the five notes (`#where-the-line-sits`, `#what-the-rules-apply-to`,
  `#what-the-flag-covers`, `#accepting-the-terms`, `#how-enforcement-works`), spec copy kept whole.
  `schema.ts` gained `TERMS_RULES` (anchor + title per prohibition, typed `TermsRule`) and
  `REPORT_REASON_RULE` (reason code → rule), so the page's ids and the dialog's links come from one
  table. `ReportDialog`'s reason stop now prints "the rule each reason enforces" — one link per
  offered reason into the matching anchor. `/onboarding` finally carries the line `terms.md` says it
  carries: **Finish** is the acceptance, with a link to `/terms`.
- **Verified:** `scripts/check.sh` GREEN (build, 30 routes, schema check). In the browser against
  `vite preview`: at 360×740 no horizontal scroll (`scrollWidth 360`), rules/notes present with the
  expected ids; at 1280 the shell is a sidebar layout, the outlet reads 200px contents rail + 684px
  column, hairlines at the measure; the report dialog's four reason links resolve to
  `/terms#unmarked-nsfw`, `#illegal-content`, `#copied-content` ×2 and a click lands 128px from the
  top (below the 56px bar); last paragraph clears the tab bar by 100px. Published: root **200**.
- **Not verified:** no touch-device pass (no phone on this box) and no screen-reader pass; the
  contents rail is a jump list only — no scroll-spy highlighting, which the spec does not ask for.

## T-23 — the profile that is somebody else's page, and the account behind it (2026-10-31)

- **Changed:** the account finally has a **profile entity**. `schema.ts` gained `profileSeedSchema`
  (handle, display name, avatar, bio — trimmed, `joinedAt` ISO), `profileSchema` (the same shape plus
  `followers` / `following`, **derived at read**, never stored), `profileEditSchema` (the edit form's
  one write — no NSFW pair, no email, no provider), `followSeedSchema` and `profileTabSchema` /
  `profileCreationTypeSchema`; `seedSchemas` now carries `profiles` and `follows`, so the gate parses
  them. New `fixtures/profiles.ts`: seven rows (the handles that already author content — `you, ada,
  mira, quill, bram, sable, orin`) and **15 follow edges**. `repo` gained `getProfile`,
  `profileCreations(handle, { type })`, `profilePosts`, `followersOf`, `followingOf`, `isFollowing`,
  `followUser`, `unfollowUser`, `saveProfileEdit` — the graph is a `Set` keyed `follower:followee`
  in the memory adapter, so a count is the length of a list; follow writes answer with the updated
  profile; `isHandleTaken` now also checks profile rows. A rename in `saveProfileEdit` moves the
  profile row, rewrites every content row's `author`, moves the follow edges and the claimed-handle
  set, and leaves the old handle **not-found with no alias**. Both pages replace their placeholders:
  `user-profile.tsrx` (header with avatar/name/handle/bio/plain figures and one control, four tabs in
  `?tab=`, type chips in `?type=` on creations only, CardGrid for creations, PostCard feed, profile
  rows for followers/following, Load more per tab, NSFW Show/Blur honoured) and `user-edit.tsrx`
  (own account only, display name / avatar initials / bio / username / NSFW pair, sticky footer at
  360, forbidden state for another handle).
- **Verified how:** `scripts/check.sh` → GREEN (typecheck, production build, 30 routes, schema check
  with the two new fixture collections). Plus a direct harness against the memory adapter:
  `getProfile("ada")` = 4 followers / 3 following, creations 8 across character+lorebook+preset,
  `type: "lorebook"` = 2 and all lorebooks, `profilePosts("mira")` = 2, `followersOf("you")` = ada,
  bram, mira, orin (4), unfollow→follow of `quill` moved his figure 3→2→3, `isHandleTaken` true for
  `sable` and false for `zzz`, `saveProfileEdit` renamed `you`→`tester`, collapsed the display name,
  trimmed the bio, kept 5 creations (author rewritten) and 3 following edges, and left `you` null.
- **Not verified:** nothing on a real phone — the 360/640/900 columns were reasoned from the shell's
  existing pages, not screenshotted. The adapter's `VIEWER` constant still names the follow/persona
  subject after a rename, so a renamed account keeps its content but the preview's *viewer* keys
  (votes, `VIEWER`) do not follow the new handle; T-30 owns wiring the adapter to the session.
- **Found while working:** the ticket asked for `profileWriteSchema` to be extended with the bio, but
  that schema is **onboarding's** write and adding a required bio would break `/onboarding`; the edit
  form therefore has its own `profileEditSchema`. Likewise the NSFW flags stayed out of the profile
  row entirely — the preference store already carries them, and a second copy could disagree.

## T-22 — `/notifications`, a quiet inbox and a badge that counts rows (2026-10-31)

- **Changed:** `schema.ts` gained **`unreadNotificationCountSchema`** (the badge's number crosses the
  adapter boundary, so it is a shape: integer, `min(0)`); `lib/format.ts` gained **`relativeTime()`**
  (`now` / `12m` / `5h` / `3d` / `19 Oct` — the inbox's reading, where the thread keeps `shortStamp`)
  and **`badgeCount()`** with `BADGE_CAP = 9` (`9+` above nine, empty string at zero). `repo` gained
  **`markNotificationRead(id)`** (returns the parsed row, idempotent), **`markAllNotificationsRead()`**
  (returns how many rows actually changed) and **`unreadNotificationCount()`**; the memory adapter
  implements all three against `store.notifications`, parsing every answer. New
  **`lib/state/inbox.ts`**: a subscribe/notify store in the `session`/`prefs` mould that only ever
  *asks* the adapter — no `+1` anywhere — clearing on sign-out and re-reading on sign-in. New
  `pages/notifications.tsrx` replaces the placeholder: one sentence per row (six shapes, `count - 1`
  others, `measure` named and reasons never restated), unread = 2px accent inset + 600 weight, the
  age at the row's end, a stretched row-covering link that marks read *then* navigates (modified
  clicks fall through to the browser), a `Mark all read` toolbar drawn disabled at zero, the one
  **Mark read** button for a target with no route of its own (`comment`), and loading / empty /
  error / list states with skeleton rows. `App.tsrx` draws the **badge** in both hosts (tab bar's
  `Alerts`, the `lg` rail), `aria-label="Alerts, 3 unread"`, capped text, hidden at zero; `9+` and
  the cap live in `format.ts`, never in the shell. `docs/DESIGN.md` → *Notifications (T-22)* records
  the eleven decisions.
- **Verified:** `scripts/check.sh` → **GREEN** (build ok, 30 routes, schema ok). Browser pass against
  the dev server at 360×740, 640, 900 and 1200 in a real Chromium: six rows newest first
  (`2d` moderation down to `13 Oct`), `3 unread`, `scrollWidth === clientWidth` at every width, the
  toolbar button 44px, the rows column capped at 720 from `md`, the `lede` hidden at 360 and shown
  from `sm`. Interactions: clicking an unread row **navigated in-app** to `/post/…` and the badge went
  `3 → 2`; `Mark all read` took the note to *All read*, the badge to none, and the button to
  `disabled: true` (it was `false` before the click, and only after handing `Button` a derived —
  see the trap below).
- **Not verified:** the live published build (this tick's publish is claimed only if
  `scripts/publish.sh` printed `LIVE=`; see the commit). `9+` is code-only — six fixtures cannot hold
  ten unread rows. The **periodic summary** state and the per-row **Mark read** button have no fixture
  (no deferred summary exists; no row targets a `comment`), so both are drawn by the same code path
  but were not seen. Nothing was checked in the Latte flavour or at a 1200px height under 700.

## T-21 — `/bookmarks`, four tabs over saved rows and the card that outlives its item (2026-10-31)

- **Changed:** `schema.ts` gained `bookmarkKindSchema`, **`bookmarkRowSchema`** (a discriminated
  union of four `{ kind, id, savedAt, item }` rows — `item` is the type's entity or `null`, so the
  item can never disagree with its tab), `bookmarkCountsSchema` and `bookmarkSeedSchema`; `types.ts`
  derives `BookmarkKind` / `BookmarkRow` / `BookmarkCounts` from them. `repo` gained
  `listBookmarks(kind, { query, sort, page })`, **`removeBookmark(kind, id)`** (key-only, because
  `toggleBookmark` refuses a missing row), `bookmarkCounts()` and `latestBookmarkKind()`. The memory
  adapter's `bookmarks` is now a **`Map<key, savedAt>`** keyed `kind:id` (no viewer suffix) seeded
  from the new `fixtures/bookmarks.ts` — **eight saved rows including one key with no item behind it**
  (a saved-then-deleted character), so the preview draws a dead card with no manual delete; the four
  `delete*` methods **stop clearing bookmark keys** (votes still go), and `listBookmarks` reuses each
  type's own matcher, drops rows moderation made private to `item: null`, and sorts on the save clock.
  `components/Tabs.tsrx` gained an optional live `counts` prop (a 11px muted `span`, accent when
  selected) — no second strip was invented. New `pages/bookmarks.tsrx` replaces the placeholder:
  four tabs with adapter counts, the tab resolved from the most recently saved row (Characters when
  nothing is saved), search + sort (Newest saved / Oldest saved / Title A–Z) + the reserved
  `Filter: All` note + the saved count, `Card`/`PostCard` per type with saved-post attachments resolved
  through `getCharacter`, a **page-owned `.saved-card` wrapper** carrying **Remove bookmark** on every
  card, the **dead card** (type's not-exist sentence in the title slot, no link, no Reveal, dashed
  border, still removable), 24-row **Load more**, and all six states. `src/styles.css` carries
  `.tab-count`, `.saved-card*` and `.card.is-missing`; `docs/DESIGN.md` → *Bookmarks (T-21)* records
  the six decisions.
- **Verified:** `scripts/check.sh` → **GREEN** (build, 30 routes, schema: 8 seeded bookmark keys parse
  through `bookmarkSeedSchema`, every fixture collection still parses). `scripts/publish.sh` →
  `gh-pages` `f0ed2b0`, **live 200** at the URL. The **live** build in Chromium: `/bookmarks` opened on
  **Characters** (the tab holding the newest saved row), counts `3 / 2 / 1 / 2`, the first card the
  dead one reading *This character doesn't exist.*, two live cards under it; **clicking Remove
  bookmark on the dead card** dropped the grid to 2 cards, the control row to `2 saved` and the
  Characters tab to `2` while the other three counts stayed put, and a live character took its place.
  `?type=post` drew both saved posts with the character attachment resolved (*Aurelia of the Tides*)
  and their like/dislike/comment footers; `?type=preset` drew the `Card` with title and ratio.
- **Not verified:** nothing was measured at 640/900/1200 in a browser this tick — the toolbar's
  `sm`/`md` placements follow the catalog's proven grid, but the `md` three-column line has not been
  seen at 900. Removal, tab switching and paging were exercised on the live build at 360 only; a
  dead card on the **Posts** tab has no fixture (the dead fixture row is a character), so that
  sentence is drawn by the same code path but was not seen end-to-end.

## T-20 — `/persona`, the fourth collection, and the default mark that is the adapter's (2026-10-31)

- **Changed:** `personaWriteSchema` (+ `PERSONA_NAME_REQUIRED`) beside `personaSchema` — name,
  tagline, description, avatar; **no** nsfw/isPublic/tags/lorebooks/preset/in-session name/engagement,
  and `isDefault` is not a write value. `PersonaWrite` in `types.ts`; `repo.addPersona` (the first
  persona of an account takes the default mark in the same write), `updatePersona` (owner only, keeps
  the mark and `createdAt`, clears `verified`), `deletePersona` (owner only; if it held the default the
  **most recently created remaining** persona takes it, and deleting the last leaves an empty
  collection with no default), `setDefaultPersona` (one write that clears the old mark and sets the
  new). `listPersonas` now searches **the name only** — the spec's *filters the grid by name*, owned by
  the adapter so no page can widen it. New `components/PersonaForm.tsrx` (one form, two hosts; name and
  tagline → description → avatar; no NSFW, no settings) and `components/PersonaCard.tsrx` (avatar,
  name, tagline, default line — **not** `Card`, which draws an author and a ratio), plus the shared
  `components/DeleteRow.tsrx` (one in-place confirmation for detail and edit; the stylesheet carries
  `.persona-card*` and `.delete-row*`). `/persona` is a collection: search + sort (Newest/Oldest/Name)
  + Create over one unpaged grid, `Set as default` on each card; `/persona/[id]` is personal detail —
  cover, name, tagline, the mark, four actions, description read-only, **no** engagement, report,
  thread or owner notice, and `Start a session` opens a `Sheet` picker of the viewer's own characters
  (an existing session with that character is reopened with this persona attached instead of
  duplicated).
- **Verified:** `scripts/check.sh` → GREEN (build, 30 routes, schema). A bun probe of the memory
  adapter printed the whole default invariant: 3 fixtures with exactly 1 default; `setDefaultPersona`
  left exactly one; deleting the default handed it to *Ash* (most recently created); deleting every
  row left 0 rows and 0 defaults; the next `addPersona` on the empty collection came back
  `isDefault: true` with initials `SO` derived from the name; a blank name and an `nsfw` key both came
  back `null` from the schema. The **live** build then in Chromium at 360×740: the collection drew
  three cards in one 328px column, one carrying `default`, `scrollWidth` 360; **Set as default on a
  card moved the mark** (Ash took it, Nell's row flipped to *Set as default*, the held one disabled);
  detail drew name, tagline, the four-action column, the description, a live delete row and a **320×320**
  cover with no engagement row and `scrollWidth` 360; **Start a session** opened *Choose a character*
  with the viewer's three characters. `create` rendered Name / Tagline / Who this persona is /
  Initials in the spec's order with Save blocked while empty, saved `  Court   Scribe ` as *Court
  Scribe* with initials `CO` and landed on the new id's detail; `edit` preloaded all four values and
  its Delete opened the in-place confirmation; confirming **Delete on the default** landed on
  `/persona` with the mark moved to *Ash* and the row gone. Grid measured 1-up at 360 (328px), 2-up at
  640 (288px), 3-up at 900 (232px) and 4-up at 1280 (222px); the toolbar is one line at 900
  (378/200/120); the form is one 328px column at 360 and `590px 320px` at 1280; no horizontal scroll
  at any width.
- **Not verified:** the signed-out collection state and the *not found* sentence were not exercised on
  the live build (the adapter answers `null` and the pages render one branch of two comparisons — but
  a human click through them is still owed). The create → collection round trip was checked with a
  hard reload, which resets the memory adapter, so the new row was correctly absent: **SPA navigation
  is still the only way to see a runtime row**, as T-18 recorded. The picker offers only the viewer's
  **own** characters (a public character from another author is not offered) — recorded as a gap in
  `docs/NEXT.md`. More than 24 personas still needs an unpaged adapter answer.

## T-19 — the four preset routes, and the form's dead root rule (2026-10-31)

- **Changed:** `presetWriteSchema` (+ `PRESET_NAME_REQUIRED`) and `PRESET_MODELS` beside
  `presetSettingsSchema` in `schema.ts`; `PresetWrite` in `types.ts`; `repo.addPreset` /
  `updatePreset` / `deletePreset` / `forkPreset` mirroring the lorebook four (author-only update and
  delete, fork refuses a private source). One form, `components/PresetForm.tsrx` (`preset: null` is
  create) — `LorebookForm` minus the entries editor, plus a **Model `Select`** over `PRESET_MODELS`
  in its own labelled block, with the provider named as the app's and never drawn as a field —
  mounted by `/preset/create` and `/preset/[id]/edit` (Delete at the foot, confirming in place; the
  sentence says the thread goes and a running session keeps its copy). `/preset/[id]` inherits the
  character/lorebook detail page and swaps the entry list for a `<dl>` of generation settings, read
  **as saved**, placed after the description and before the comments; `Request public again` is drawn
  disabled. `/preset/catalog` is the lorebook catalog with `listPresets` / `listTags("preset")` and
  no model or provider facet. Also fixed: **a component's root element never receives Ripple's
  `tsrx-*` scope class**, so the `.character-form` / `.lorebook-form` / `.preset-form` grid rule was
  dropped by the compiler and all three forms were silently `display: block` — the `lg` two-column
  layout had never applied in T-17 or T-18. Each form now puts its grid on a child `.layout` div.
- **Verified:** `scripts/check.sh` → GREEN (build, 30 routes, schema). The **live** build in Chromium
  at **360×740**: the catalog listed five presets with ratios; a seed preset's detail drew *Two-Hander*,
  its description, `GENERATION SETTINGS / MODEL / deepseek-chat`, then comments, with the counts row
  above the definition and `scrollWidth` 360; the create form blocked Save while the name was empty,
  collapsed `  Late   Night Draft ` to *Late Night Draft*, filled initials to `LA` from the name,
  saved `deepseek-reasoner` and landed on detail with it; edit preloaded all four values, Save changes
  persisted `deepseek-chat`, Fork produced a `@you` copy carrying the settings, and Delete confirmed in
  place and landed on the catalog. Search narrowed the grid (URL `?q=…`, *Nothing matches those
  filters*); a random id gave `This preset doesn't exist.` Measured the form at 360 (one 328px
  column, 44px `Select` and Save), 640 (single column, image row split) and 1200/1280
  (`510px 320px`, then `590px 320px` at 1280) with no horizontal scroll; the same pass confirmed
  `CharacterForm` and `LorebookForm` now split at `lg` too (`540px 360px`, `580px 320px`).
- **Not verified:** the signed-out create state and the edit refusals were not exercised on the live
  build (same components as T-17/T-18, and the adapter refuses the writes); the moderation notice for
  a private preset is unreachable — no preset fixture is private. 640 was measured on the form only,
  not on detail or catalog.

## T-18 — the four lorebook routes, and the first entries editor (2026-10-31)

- **Changed:** `lorebookWriteSchema` + `lorebookEntryWriteSchema` (+ `LOREBOOK_NAME_REQUIRED`,
  `ENTRY_KEYWORD_REQUIRED`, `ENTRY_CONTENT_REQUIRED`, `splitKeywords`) in `schema.ts`, sharing T-17's
  `initialsInputSchema`/`withInitials` rather than re-implementing them; `LorebookWrite` /
  `LorebookEntryWrite` in `types.ts`; `repo.addLorebook` / `updateLorebook` / `deleteLorebook` /
  `forkLorebook` with `numberEntries` numbering `entry-1…n` in the adapter. One form,
  `components/LorebookForm.tsrx` (`lorebook: null` is create) with the entries editor — comma-separated
  keywords, content, per-block Up/Down/Remove, **Add entry** appending — mounted by `/lorebook/create`
  and `/lorebook/[id]/edit`; the edit page puts Delete at the foot, set apart. `/lorebook/[id]` inherits
  the character detail page (square cover, counts, sheet with Fork/Bookmark/Report/Edit, owner notice,
  two refusals) and renders the entry list in author order with keywords visible, no collapse or
  paging; `Request public again` is drawn disabled. `/lorebook/catalog` is the character catalog with
  the lorebook listing, and a card that adds nothing.
- **Verified:** `scripts/check.sh` → GREEN (build, 30 routes, schema). Adapter exercised under `bun`
  (scratch probe, not committed): `addLorebook` stored `author: you`, initials filled from the name,
  `verified: false`, `isPublic: true`, entries `entry-1`/`entry-2` with keywords split. Then the
  **live** build in Chromium at **360×740**: the catalog listed five lorebooks, *The Salt Archive*
  detail drew 4 entries + 12 keyword chips at `scrollWidth` 360; the create form blocked Save while
  the name was empty, printed `An entry needs at least one keyword.` under the empty block, then saved
  *The Glass Orchard* and landed on its detail with both entries and `['orchard','glass','harvest','bell']`;
  edit of a fixture preloaded four keyword lines and moved entry 2 above entry 1, and Save persisted
  that order to detail. At **1200** the detail page is a 508px + 320px grid with a 320px cover,
  `scrollWidth` 1190.
- **Not verified:** delete was not clicked on the live build (the adapter path is T-17's, minus the
  character attachments); fork, the owner's moderation notice on a private lorebook and the disabled
  `Request public again` were not exercised — no owned-private lorebook fixture exists. `sm` (640)
  was not measured on this page.

## T-17 — the character form, and the first authored write (2026-10-31)

- **Changed:** `characterWriteSchema` (+ `CHARACTER_NAME_REQUIRED`, `LOREBOOK_NOT_ATTACHABLE`,
  `LOREBOOK_ID_INVALID`, `LOREBOOK_ALREADY_ATTACHED`, `lorebookIdSchema`) in `schema.ts`; `CharacterWrite`
  in `types.ts`. `repo` gains exactly the writes the two pages call — `addCharacter`,
  `updateCharacter` (author only), `deleteCharacter` (author only, cascading its thread, votes and
  bookmarks, never the lorebooks), plus the attachment seam `listAttachableLorebooks` and
  `attachableLorebook`. One form, `components/CharacterForm.tsrx` (`character: null` is create),
  mounted by `/character/create` and `/character/[character.id]/edit`; the edit page adds the
  in-place-confirmed Delete row and the three refusal states. `scripts/schema-check.ts` grew a T-17
  section (whitespace name, collapse, empty in-session → absent, initials upper-cased and filled from
  the name, dedupe, pasted id trimmed).
- **Verified:** `scripts/check.sh` → GREEN (build, 30 routes, schema with the new cases). The adapter
  was exercised directly under `bun` (scratch probe, not committed): create with a duplicate
  attachment and no initials → `Test Hero`, initials `TE`, one attachment, `author: you`,
  `verified: false`, `isPublic: true`, zero engagement; the row appears in `listCharacters({query})`;
  update → renamed, in-session name `Tess`, initials `TH`, `createdAt` kept, `verified` cleared;
  a private book by `quill` refused by both the write and `attachableLorebook`; updating/deleting
  another author's character answers `null`/`false`; delete cascades the row and leaves the lorebook.
  Then the **live** build in a real Chromium at **360×740**: `/character/create` renders the form
  (5 fields, picker offering *The Salt Archive*), `requestSubmit` with Name "Probe Two" saved and
  landed on `/character/<new id>` as *Probe Two / @you / PR*, `scrollWidth` 360 (no horizontal
  scroll); an in-app push to `/character/<id>/edit` preloaded Name, initials and definition; a bogus
  lorebook id printed the schema's sentence (`A lorebook ID is a 36-character code…`) and attached
  nothing; Delete swapped to the in-place sentence → *Confirm delete* → `/character/catalog` with the
  row gone. Published: `LIVE=https://victor-viicell.github.io/LuaPlot/` → 200 (asset 200 too).
- **Not verified:** the **900 / 1200** layout was not measured this tick (the pass was 360 only), and
  no fixture exercises the *unavailable* attachment row in a browser — the rule is proven by the
  adapter probe (an id already on the row survives a re-save), not by a screenshot. A separate
  `personality` field is not stored (one description field, per the spec's single bullet) — filed in
  `NEXT.md`.

## T-16 — the model seam answers, and says that it is a preview (2026-10-31)

- **Changed:** `lib/llm/chat.ts` now routes — `provider.ts` posts to `VITE_CHAT_ENDPOINT` (a URL; the
  key stays in `supabase/functions/chat/`) and `mock.ts` answers deterministically from the transcript
  length and the in-session name, after a fixed 180ms so the awaiting state paints. Every payload goes
  through the new `chatReplySchema` (`safeParse`, strictObject, trimmed, `TURN_MAX`). The reply is
  written by `repo.appendReply(id, text)` — same `turnWriteSchema`, same adapter clock, role
  `character` — so there is still one write path. The session page draws *Awaiting model response* as
  a two-line `Skeleton` under the in-session name (`aria-busy` on the list, Send disabled) and
  *Send failed* as a line under the composer; `null` from the seam now means the provider failed, not
  "no model". A `Preview mode` chip (12px subtle, 1px border, a span) sits in the composer's meta line.
- **Verified:** `scripts/check.sh` → GREEN (build, 30 routes, schema). On a real Chromium at
  **360×740** against `vite preview`: the chip renders, the transcript's 8 fixture turns show, no
  horizontal scroll. Typing and clicking Send produced `turns 8→11`, an `.is-awaiting` row with **2
  skeleton lines** and `aria-busy=true` while in flight, then a `character` turn appended and the
  skeleton gone. With `VITE_CHAT_ENDPOINT` pointed at a dead port the chip disappeared, the user turn
  was still stored and the alert read *The model didn't answer. Your message is saved.* At 1200 the
  dock/meta sit at 198–992 (the A4 cap) with no overflow.
- **Not verified:** a real DeepSeek/OpenRouter reply end to end — no `supabase/functions/chat` is
  deployed and `VITE_CHAT_ENDPOINT` is unset, so the provider path was proven only by its failure
  branch. Determinism is proven by construction (no clock, no `Math.random`), not by a fixture test —
  `schema:check` does not assert a mock sentence yet.

## T-15 follow-up — the session gets its own chrome (2026-10-31)

- **Changed:** on the owner's call, `/session/[id]` is no longer a page inside the shell: one predicate in
  `App.tsrx` (`/^\/session\//`) adds `is-immersive`, which hides the top bar, the tab bar and the rail and
  hands the page the viewport. The page is now a three-row column — a new header (44px back, 32px square
  character avatar, in-session name, the persona line as the switch control, settings), a scrolling
  transcript, and a docked modern composer: one growing pill field, a round accent Send with an up-arrow,
  `Enter` to send, `Shift+Enter` for a new line, *Publish a cut* demoted to 11px text beneath. The reading
  column became **A4 on a desktop (794px)** and the screen width on a phone, set once on the shell's
  outlet.
- **Verified:** build clean. On the dev server at 390 and 1280: `.topbar`/`.tabbar`/`.rail` compute
  `display:none`, header 57px with a 32px avatar, name and the persona sub-line, transcript scrolled
  (clientHeight 744 vs scrollHeight 880) with the composer docked at the bottom edge, `.main` 338 wide at
  390 and **794** at 1280, no horizontal scroll, no page-level scroll (`docH == viewportH`). Typing grows
  the field (46→87px) and enables Send; `Enter` appended the turn (9 rows), cleared the field and reset it
  to 46px; settings opens the two-option sheet; the persona sub-line opens the persona picker.
- **Not verified:** the on-screen keyboard path (`--keyboard-inset` is read but a desktop browser has no
  IME inset to prove it); `Publish a cut` still opens the T-13 composer, unchanged.

## T-15 — `/session/[id]` (2026-10-31)

- **Changed:** `src/components/PostComposer.tsrx` (new — T-14's form, extracted with a `cut` prop so
  a session can open it locked in a `Sheet`); `src/pages/post-create.tsrx` now renders it;
  `src/pages/session-detail.tsrx` (header with the in-session name + persona control, append-only
  transcript, in-flow composer, settings `Sheet` with exactly New Session / Delete session and an
  in-place confirmation, copies disclosure with `untouched` / `edited` / `unlinked` rows and one
  control per state, two-step Publish-a-cut sheet, not-found + signed-out states); `src/lib/schema.ts`
  gains `turnWriteSchema` + `TURN_REQUIRED`; `src/lib/data/{repo,memory}.ts` gain `appendTurn`,
  `deleteSession`, `updateCopyFromOriginal`, `restoreCopy`, `setSessionPersona`, and
  `createSession(characterId, personaId?)`; `src/lib/llm/chat.ts` (new seam, `replyTo()` → `null`);
  `src/lib/format.ts` gains `clockTime`; `docs/DESIGN.md` → *Session*.
- **Verified:** `./scripts/check.sh` GREEN (build, 30/30 routes, schema). Dev server + CDP
  `Emulation.setDeviceMetricsOverride`: 360/640/900/1200 with `scrollWidth ≤ innerWidth` at every
  width, single column at 900 (656 outlet) and `528px + 300px sticky aside` at 1200; session 1 renders
  8 turns, `4 copies`; Send appends a 9th turn and prints the no-model line; settings sheet holds
  exactly `New Session` / `Delete session`; session 2 shows `3 copies · 1 edited`, the edited
  character copy offering Update + Restore, the unlinked lorebook offering neither; **Update from
  original** → version 2→3, state `untouched`; **Restore** → state `untouched`, version stays 2;
  Publish a cut over turns 3–6 → a real post whose cut reads `AURELIA … NELL …` for four messages;
  persona switch `Ash → The Correspondent` relabels every user turn and leaves the transcript alone;
  **Delete session** → `/character/<sourceId>` and the deleted id then answers
  `This session doesn't exist.` **in-app** (popstate, no reload); unknown id → the same line.
- **Not verified:** `Edit session copy` is not built (needs `sessionCopyWriteSchema` + a form);
  *Awaiting model response* is not drawn (T-16's state, nothing pending); the composer's own panel
  path was only exercised through the session sheet (not from a second host); Tauri packaging and
  the native shell were untouched this tick.

## T-14 — `/post/[id]` and `/post/create` (2026-10-30)

- **Changed:** `src/pages/post-detail.tsrx` (permalink: `PostCard` with `fold={false}` /
  `foot={false}`, ratio + raw like/dislike/comment counts in an aside that goes sticky beside the
  reading column from `md`, vote pair from `repo.myVote`, bookmark, `ReportDialog` on
  `kind: "post"`, two-step **Delete post** for the author, `CommentThread` beneath, not-found
  state); `src/pages/post-create.tsrx` (body `Field` gated by `postWriteSchema`, attachment picker
  over the viewer's own characters and the viewer's own sessions as cuts with the persona/`User`
  attribution choice once a cut is attached, NSFW `Toggle`, Publish / Cancel); `src/lib/schema.ts`
  gains `postWriteSchema` + `POST_REQUIRED`; `src/lib/data/{repo,memory}.ts` gain `addPost`
  (`safeParse`, **character attachment must be the viewer's**, `verified: false`, zero counts),
  `deletePost` (author only, **comments cascade** with their votes), `listMySessions`;
  `PostCard` gains `fold` / `foot`; `docs/DESIGN.md` → *Post detail and composer*.
- **Verified:** `./scripts/check.sh` GREEN (build, 30/30 routes, schema). Dev server via CDP
  `Emulation.setDeviceMetricsOverride`: `/post/90570000-…-0003` at 360 → 4 cut turns and **no Show
  more**, RATIO 99% / LIKES 133 / DISLIKES 2 / COMMENTS 3, thread rows with their own actions; at
  900/1200/1440 the aside sits beside the card (x=510 / 840 / 1050) and no width overflows
  (`scrollWidth ≤ innerWidth` at 360/640/900/1200/1440, both pages). Publish flow walked end to end at
  360: typed body → picked *Rook Venner* → Publish → `/post/d17a0e56-…` with the character card and
  **Delete post**; one comment posted (counts 0/0/0/1, one `.row-body`); Confirm delete → back on
  `/post/thread` with the post gone. `post-create` lists 5 attachment choices (none + own items) with
  the body 328px at 360 and 284px at 900 beside the 340px attachment column.
- **Not verified:** the image/GIF embed (no uploader, no media field — deliberately not drawn); the
  panel-over-the-page composer (`Sheet` host waits for T-15); Load more on the thread (still 12
  fixtures against a 24-row page); no Tauri/Android build.

## T-13 — the public timeline at `/post/thread` (2026-10-30)

- **Changed:** `src/components/PostCard.tsrx` (new primitive: `.post-head` poster + `<time>`, `.post-middle`
  body + attachment behind the card's blur, `.post-foot` likes / dislikes / comment count) and
  `src/pages/post-thread.tsrx` (control row → sort, `All` chip, Show/Blur pair, **Create**; one column of
  cards; Loading / Empty / Error / End of feed; Load more appended from `hasMore`). `SortOrder` gained
  `discussed` and `liked` (`commentCount`, `likes`, `createdAt` tie-break) with a `newest` fallback for
  every other listing; `docs/ARCHITECTURE.md` → *Data* and a new `docs/DESIGN.md` → *Thread* section
  record the decisions, plus the *Card and grid* rule that `Card` never grows a post branch.
- **Verified:** `./scripts/check.sh` GREEN (build, 30/30 routes, schema). Dev server at 360/640/900/1280:
  11 of 12 rows with Show off (the flagged post absent, nothing covered even with Blur on), 12 rows with
  Show on + Blur on and exactly one `.is-covered` whose `.post-veil` computes `blur(6px)` while
  `.post-foot` stays `filter: none`; sort writes `?sort=discussed` / `?sort=liked` and reorders (top card
  4 comments / 133 likes respectively); the cut shows 2 turns and **Show more** expands to 4 in place
  without touching the URL; the comment count is 44px tall and both attachment characters resolve
  (Sonic the Hedgehog, Aurelia of the Tides); no horizontal overflow at any width; control row is three
  rows at 360 and one from `sm`. Published build re-checked on the live URL at 390: 11 cards, both
  attachments, one cut, `All` chip, End of feed.
- **Not verified:** **Load more** — 12 fixtures against a 24-row page means `hasMore` is false, so the
  append path is mounted but unreachable. A post's image is not drawn (`postSchema` has no image field).
  No Tauri/Android build.

## T-12 follow-up — the item avatar is a square cover (2026-10-30)

- **Changed:** on the owner's call, an item's avatar is no longer a 56px thumbnail: `Avatar` gained
  `size="hero"` (no inline box, `.avatar.is-hero` in `styles.css` owns it) and `/character/[id]` now lays
  its head out as a grid whose first row is the cover — **full content width and 1:1** with the name and
  the settings button beneath it on a phone, a fixed 320px column with both beside it from `sm`. The
  initials are drawn as a **monogram** (`clamp(56px, 24vw, 112px)`, weight 500) on a two-stop surface
  gradient, because a 13px label in a 320px square reads as an image that failed to load. The rule is
  written into the character, lorebook and preset detail specs, so the two pages still to be built
  inherit it instead of re-deciding.
- **Verified:** `./scripts/check.sh` GREEN (build, 30/30 routes, schema). Measured with real Chromium at
  360/640/900/1280 on the dev server: cover **328×328** at 360 (inside the 16px page padding) and
  **320×320** at 640/900/1280 — ratio 1.000 at every width; the name sits **beneath** the cover at 360
  (title y 437 against a cover bottom of 404) and **beside** it from `sm` (title x 364 / 494 / 620 against
  cover right edges 344 / 474 / 600); settings stays 44×44 at the row's right edge; initials compute to
  86.4px at 360 and 112px at 1280; `scrollWidth` never exceeds the viewport.
- **Corrected:** the first version of this entry measured a 308×308 cover with 56px initials and claimed
  the name sat beside the cover from `sm`. That code never committed, and its ≥640 layout was **broken**:
  the base `.identity-text` rule was declared *after* the `@media` block, and at equal specificity a base
  rule written after the query wins at every width, so the name rendered under the cover on desktop. Base
  placement now comes before the query, and DESIGN.md carries the trap.
- **Not verified:** `/lorebook/[id]` and `/preset/[id]` are still placeholders, so their covers exist as a
  spec rule and a primitive variant, not as a rendered page. No Tauri/Android build.

## T-12 follow-up — one report can cover image + text, and several reasons (2026-10-30)

- **Changed:** the owner reported that the dialog forced one choice at each stop. Both stops are toggles
  now: *what* takes one or more surfaces the item carries (a character's image **and** text), *why*
  takes one or more reasons, and the list is the **union** of what the chosen surfaces allow. Dropping a
  surface drops the reasons that no longer fit it. The stored row follows the same shape —
  `reportEntrySchema` is `{ parts, reasons, details?, source?, at }` (was one `part` + one `reason`), the
  write takes `parts`/`reasons` arrays with a `superRefine` that refuses a reason fitting nothing chosen,
  and the source is required when *any* chosen reason is a copy claim. One report is still **one
  weight**. The 22 fixture entries, the owner's moderation notice and the dialog's record line moved to
  the array shape (`reasonFitsPart` is the shared pair rule).
- **Verified:** build clean. In the app at 390: both surfaces press and stay pressed through Back; the
  reason list is four (missing-nsfw, illegal, copied text, copied image) with both chosen and three with
  the text surface dropped; a copy claim reaches the source stop; submitting stores
  `parts: [avatar, text], reasons: [missing-nsfw, copied-image]` with the source and the note, answers
  *Report recorded and held* (the fixture is already verified), and reopening draws
  `Avatar or image + Text · Missing NSFW flag, Copied image · filed 30 Oct · 22:00` with no form.
- **Not verified:** the owner's moderation notice (`/character/[id]`, `.notice .reason`) still renders
  nothing in this session — the fixture case belongs to a character this viewer does not own, so the
  array→text mapping there is compile-checked only. No Tauri/Android build.

## T-12 — the Report dialog, on `/character/[id]` and on a comment (2026-10-30)

- **Changed:** `src/components/ReportDialog.tsrx` (new): one `Sheet` with a four-stop stepper — *what*
  → *reason* → *source* (copy claims only) → *details* (optional) → **Submit report** — mounted by the
  character page's settings menu and by every live comment footer. The reason list is
  `REPORT_REASONS_BY_PART` in `schema.ts`, so the window cannot offer a code the queue has no
  rendering for and the part→reason pairing is validated as well as drawn; `PARTS_BY_KIND` decides
  what a surface can report (a comment: text only). `schema.ts` gained `reportTargetSchema`,
  `reportWriteSchema` (trimmed, source required for every copy claim, part/reason pair checked) and
  `reportOutcomeSchema`; `reportSchema.target` now reuses the extracted target shape, so it exists
  once. `repo.addReport(write)` and `repo.myReport(kind, id)` are new: the adapter owns **one report
  per viewer per item** (`myReports`, keyed `kind:id:viewer`, answering the report on file instead of
  appending), **cumulative cases** (an open case takes the reason, `weight + 1` and a new
  `lastReportAt`; otherwise a case opens at weight 1 with `verdict: unsure / action: none` because
  nothing has been judged), and **already verified** — a target whose `verified` flag is set records
  the report and opens no case, which is the spec's *held*. The adapter answers a `ReportOutcome`
  (`submitted | held | already`), never the case: no verdict, no queue position. The character
  menu's **Report** is wired (the `disabled` twin is gone) and is absent, not disabled, while signed
  out; the menu closes and the dialog mounts as its sibling. A comment's footer gained **Report**
  after Reply and after Delete's pair — signed in and live rows only. `docs/DESIGN.md` gained
  *Report dialog*, and `scripts/schema-check.ts` gained the two negative cases the write relies on.
- **Verified:** `./scripts/check.sh` → GREEN (build, 30 routes, fixtures, and the two new negatives:
  a copy claim with no source and a part/reason mismatch both refused with the schema's own copy).
  Live at https://victor-viicell.github.io/LuaPlot/ at 360×740 through CDP metrics: the menu reads
  `New session / Bookmark / Fork / Report`; Continue with nothing chosen prints *Choose what is being
  reported.*, then the reason stop lists exactly the text codes; *Copied text* routes through the
  source stop and refuses an empty one with *Name the source…*; a report on a **verified** character
  (Sonic) confirms *Report recorded and held. / A review starts once the content changes.*, and
  reopening the dialog shows the record (`Text · Missing NSFW flag · filed 30 Oct · …`, the note,
  *One report per item, and a report cannot be withdrawn.*) with **no submit** — one report per
  viewer, surviving the reopen. On an **unverified** character (The Cartographer) the confirmation is
  *Report submitted.*, and an in-app navigation to `/dev/data` (no reload, so the store survives)
  moves `CASES` from 5/3-open to 6/4-open: the write really opened a case. A comment's footer Report
  opens *REPORTING A COMMENT* with **Text** only and confirms *Report submitted.*; a placeholder row
  draws zero `.act` buttons; signed out, the settings menu loses Report (and Edit) and every comment
  footer loses Reply and Report while the composer gates with *Sign in*. At 900 the sheet is a 520px
  centred dialog with a single 44px footer row; no horizontal scroll at 360 (`scrollWidth ==
  clientWidth`).
- **Not verified:** a case opened at runtime cannot be read back after a **hard reload** — the memory
  store resets, so the new case is only observable inside the same page load (checked via in-app
  navigation, as above). A **held** report opens no case at all, so `/moderation` has no view of it
  yet; that follows the spec (*starts no scan*) but the queue has nothing to render it with. A
  comment's footer does not mark a row as already reported — the dialog's record is the state, and a
  per-row flag would cost one `myReport` read per row.

## T-11 — the comment thread on `/character/[id]` (2026-10-30)

- **Changed:** `src/components/CommentThread.tsrx` (new): the flat adapter rows become a drawn list
  in code — grouped by `parentId`, oldest first at every level, anything below the third level folded
  onto the third indent, a placeholder with no surviving branch dropped entirely — so the template
  renders one flat `@for` and never recurses. Deleted/removed rows keep header, time and footer with
  one sentence in place of the body and **no actions**; a reply list longer than three folds behind
  `Show N more replies`; the one composer at the top is retargeted by any row's **Reply** (depth
  three included); NSFW covers a comment's own body only, behind a per-comment Reveal. Writes:
  `repo.addComment` (author = the adapter's account, counts recomputed) and `repo.deleteComment`
  (author only, branch kept). `commentBodySchema` / `commentWriteSchema` in `schema.ts` — the body is
  trimmed there, the required-text rule belongs to the write, and a `superRefine` keeps *a visible
  comment has text / a placeholder has none* true of the row. `memory.ts` now counts `replyCount` as
  the **whole branch** and recounts on every write; the character page mounts the thread under the
  lorebooks and its `Comments` cell is live from the thread's own answer. Fixtures grew to 22
  comments (four replies under `COMMENT(13)`, an NSFW reply at depth three) so the fold, the third
  indent and the cover are all reachable at the preview URL.
- **Verified:** `./scripts/check.sh` → GREEN (build, 30 routes, 22 comments in 12 roots, type not
  `any`); live at 360 through CDP `setDeviceMetricsOverride` — depths 0/16/32px, `Show 1 more reply`
  expands to the fourth, the deleted row draws *This comment was deleted.* with zero `.act`
  buttons while its NSFW reply stays covered beneath it, `Delete → Confirm delete` turns the author's
  own row into that placeholder with the count cell unchanged at 8, posting appends a ninth row and
  moves the cell to 9 with the draft cleared, `#comment-[id]` on a fresh load expands the branch and
  scrolls to it (shell `.content` scrolled to 1633, row at y=212, `is-target` applied). At 640/900
  (thread 656px) and 1200 (grid `508px 320px`, thread in `.main`, indents 24px) there is no
  horizontal scroll.
- **Not verified:** a same-document `hashchange` (in-app navigation to an anchor on the page already
  open) is not handled — only the fragment at mount is; and a *removed by moderation* placeholder is
  code-identical to a deletion but unreachable in the preview, because no fixture carries
  `status: "removed"`. Attachment images on comments have no uploader yet, so the body renders text
  only.

## T-10B — fork + Start/Continue on the character page (2026-10-30)

- **Changed:** `repo.createSession(characterId)` and `repo.forkCharacter(id)` exist in memory, both
  parsing what they store (`sessionSchema` / `characterSchema`) — a session is **copies** (the
  character, each attached lorebook the viewer can see, the preset), each copy keeping `sourceId`
  as the link, `version` 1, `edited`/`unlinked` false, the persona a live reference and *absent*
  when the account has none (`sessionSchema.personaId` is now optional — the spec's unattributed
  start); a fork is a new item: new id, `author` = viewer, `lorebookIds` still **references**
  filtered to what the forker can see, engagement zeroed, `verified` false, published
  (`character/create.md` has no draft). A fork of a private row is refused in the adapter. The
  detail page's action row gains its one `btn-primary`, **Start a session / Continue**, labelled
  from `findSessionForCharacter` and live (one `track()` for the session id); the settings menu's
  **New session** is wired (the disabled twin is gone) and **Fork** joins the menu, absent while
  the row is private. `docs/DESIGN.md` gained *Start / Continue and Fork*.
- **Verified:** `./scripts/check.sh` GREEN (build, 30/30 routes, fixtures + schema). Driven in
  Chromium at 360×740 / 640 / 900 / 1200 against the dev build: CHARACTER(2) reads *Start a
  session* → click → landed on `/session/<new uuid>` → `history.back()` → reads *Continue* →
  Continue opened that same session, with no reload and no tree scan. **New session** produced a
  *different* uuid and left the first session alone. **Fork** on CHARACTER(2) landed on a new
  `/character/<uuid>` reading `Sonic the Hedgehog / Called "Sonic" inside a session.`, counts
  `0 | 0 | 0% | 0`, its lorebook carried as a reference, byline `@you`. CHARACTER(28) (private,
  owned by `you`) shows the notice, `Edit`, no **Fork**, and `scrollWidth == clientWidth` at 360.
  At 360 the primary control is 328×44 on its own row with Like/Dislike/Bookmark at 44px beneath;
  from `sm` it joins them (162 + 3×132 + gaps = the row's 582px).
- **Not verified:** Continue and New session land on `/session/[id]`, which is still T-15's
  placeholder — the row is written and reachable, the transcript screen does not exist yet. The
  memory store resets on a hard reload (no persistence until Supabase), so Start/Continue across a
  reload cannot be shown in the preview. No Tauri/Android build.

## T-10 — `/character/[id]`, the read/vote surface (2026-10-30)

- **Changed:** the detail page exists: identity (avatar, name, the in-session line only when it
  differs), byline, attached lorebooks resolved through the adapter with an *unavailable* row kept
  in the list, the four-cell counts strip (likes / dislikes / ratio / comments), vote (one per
  viewer, switching replaces), bookmark, the owner's moderation notice, and the page's own settings
  sheet (New session, Bookmark, Report, Edit — the two that need T-10B/T-12 are drawn and
  `disabled`). `router.ts` gained `useParams()`; `repo` gained `myVote(kind, id)` so the **Voted**
  state comes from the adapter instead of a page-local guess. **The adapter's listing filter is now
  `isPublic` only** — the old "public **or mine**" put a privated row back in the catalog (the
  carried-forward bug from T-09); owner visibility is the detail page's rule. Fixtures: `CHARACTER(28)`
  (Iolande, private, owned by `you`) + `REPORT(5)` (open, JEV `made-private`) so the notice is
  reachable at all; characters 27 → 28, reports 4 → 5. `docs/DESIGN.md` gained *Character detail*.
- **Verified:** `./scripts/check.sh` GREEN (build, 30 routes, fixture+schema check). In the live dev
  build: Aurelia renders 128/9/93%/4 comments; `Like` → 129/9 with `aria-pressed="true"`, then
  `Dislike` → 128/10 and the like press clears (the switch replaces rather than stacks); bookmark
  toggles and toasts; the settings sheet lists New session / Bookmark / Report / Edit for the owner.
  `CHARACTER(28)` as its owner shows the notice with both reasons and JEV's measure, and signing out
  in place switches the same route to *This character isn't available*; a random uuid renders *This
  character doesn't exist*; a signed-out vote navigates to `/authentification`. NSFW: Hollow Saint
  with Show off draws the chrome crisp with `filter: blur(6px)` on the veil (counts `filter: none`)
  and Reveal removes the cover. Measured at 360/640/900/1200: `scrollWidth == clientWidth` at every
  width, the four count cells share one `top` at 360, targets 44px, and at 1200 the aside is right of
  main at the same y.
- **Not verified:** no Tauri/Android build (no SDK on this box, T-35). The catalog is 27 public
  characters over two pages (24 + 3); the private fixture is deliberately absent, which is the
  point. A vote made while signed out cannot be tested without the dev switch (session.ts seeds
  signed in; T-30). Publish verified: live 200 and serving the bundle hash this run built
  (`assets/index-DGwguzXV.js`), and the deep link `/character/<id>` resolves on Pages.

## T-09 follow-up — the toolbar, on the owner's call (2026-10-30)

- **Changed:** three product changes asked for after looking at the phone: the search field now spans
  the full column (its own row), the sort is a **`Select`** primitive (a native `<select>` in the app's
  chrome, not a segmented row), and tags became a real filter — a new **`TagPicker`** primitive: a
  multi-select field whose chosen tags sit inside it as chips, whose dropdown is filtered by what the
  reader types, and whose options come from `repo.listTags(kind)` (the tags in use), never from an
  invented taxonomy. `ListOptions` gained `tags` (any-of), `memory.ts` gained `listTags`, the 27
  character fixtures gained 10 tags between them, and the `All` chip is gone — an empty tag field is
  `All`. The URL became `?q=…&tags=a,b&sort=ratio`. The card thumbnail is now a **third of the card's
  width at 1:1** (`Avatar` gained `size="fluid"`, the box lives in `styles.css` so it scales with the
  card), and the tag row sits under the tagline where it always did — it only looked absent because
  the deployed build still had `tags: []` on every fixture.
- **Verified:** at 360/390/640/900/1280 the search, the tag field and (below `sm`) the sort all measure
  the full column width (308/338/572), no horizontal scroll, columns still 1/2/3/4. Picker: click opens
  ten options; typing `h` narrows to authority/ghost/harbor/shopkeep; `Enter` adds a chip, clears the
  input and refetches (`?tags=harbor`, 6 cards); a second tag makes two chips and ten cards (either-of);
  the chip's × drops it (5 cards); `Back` restores URL, chips, sort and grid. Sort: choosing `Top rated`
  keeps the tags (`?tags=harbor,ghost&sort=ratio`) and reorders (10 cards, best ratio first). Cards now
  render their tag rows (37 chips across the first page).
- **Not verified:** no Tauri/Android build; the dropdown is not tested with a real phone keyboard open
  (the fixed overlay could sit under the IME — `mobile-webview-ui` covers the pattern if it does).

## T-09 follow-up — the phone screenshot (2026-10-30)

- **Changed:** two defects a 390px screenshot caught, one cause. A page's scoped `<style>` cannot
  match a **primitive's** elements, so `.toolbar .field`, `.prefs .toggle` and `.pager .btn` did
  nothing: the search box fell into the grid's narrow `auto` column (338 → 26px at 640) and the
  segmented control squeezed `Top rated` onto two lines. The page now wraps each primitive in a
  page-owned element — `.search`, `.prefs`, `.pager-action` — and places that; `.seg-btn` got
  `white-space: nowrap`. The `filter-note` sentence was removed: at ≥640 it sized the `auto` column to
  331px and starved the search field, and a caption explaining an inert control is not worth a row.
- **Verified:** dev build at 390/360/640/900/1280: search field equals the card width at 360/390
  (308/338), is 327/411/695 at 640/900/1280, the seg is a single 44px line everywhere, the placeholder
  no longer clips, the pager button is 200px from `sm`, columns still 1/2/3/4, no horizontal scroll.
  Functional re-check unchanged: 20 → 23 after `Load more`, Show on 27, Blur on 4 covered.
- **Not verified:** no Tauri/Android build; the fix is CSS only, so the layout matrix is the proof.

## T-09 — `/character/catalog` (2026-10-30)

- **Changed:** `src/pages/character-catalog.tsrx` is the real page — toolbar (search settled at
  250ms, the `All` chip, a `Newest`/`Top rated` segmented sort, the two NSFW `Toggle`s), the grid,
  `Load more`, and all six states. It writes its own URL through `history` (`filter=all`, `q`,
  `sort`) and never `navigate()`, because the shell remounts on a changed query (DESIGN → *Catalog*).
  `CardGrid` now takes `items`/`blurNsfw` as `Derived<…>` read inside the template, and `Card` gained
  a live `blur` prop it ANDs with its own flag — an amendment to T-08, recorded in DESIGN because a
  per-item derived inside the keyed loop rendered nothing in ripple 0.4.7. Fixtures grew 8 → 27
  characters (4 flagged) so paging and the Show/Blur pair are exercisable at all; ids still come from
  `ids.ts`.
- **Verified:** gate GREEN (build 548K, routes 30, schema). In Chromium at 360×740 / 640 / 900 /
  1280: 1/2/3/4 columns, `scrollWidth − clientWidth` = −10 at every width, grid top 435/436/384/375
  with the first card wholly above the tab bar. Paging: 20 → 23 cards after `Load more`, the control
  gone, `End of the list.` shown. NSFW: Show off → 20 (the 4 flagged absent), Show on → 27, Blur on →
  exactly those 4 covered, each with a crisp footer carrying its `%` and its own `Reveal`; revealing
  one took 4 → 3; a re-sort put the cover back. Search `salt` → 1 card and
  `?filter=all&q=salt&sort=ratio`; `zzzz` → no-results with the query echoed and `Clear search`;
  clearing restored the full page. Sort `Top rated` → descending ratios, first 96%,
  `?filter=all&sort=ratio`. Loading skeleton captured by a `MutationObserver` injected through CDP
  before navigation (`.card-grid[aria-busy="true"]` plus 6 `.skel-card`). Error state forced by
  patching `memoryRepo.listCharacters` to reject → `role="alert"` + `Retry`, which loaded 20 rows
  once restored; an append failure (reject only when `page > 1`) → inline `The next page didn't
  load.` keeping the 20 rows, and its `Retry` completed to 23. Signed out (overflow → Sign out), the
  Show toggle navigated to `/authentification` and stayed off.
- **Not verified:** no Tauri/Android build. The other four listings still seed fewer than 24 rows, so
  their `Load more` remains unproven until they have data. Nothing exercises a Supabase adapter.

## T-08 — catalog card + grid (2026-10-30)

- **Changed:** `Card` takes the entity (`AuthoredItem` = `z.infer` of `authoredItemSchema`, added to
  `lib/data/types.ts`) plus an `nsfw` **effective cover flag**; it renders `ratioOf(item)` and
  `percent()` from the new `lib/format.ts`. Blur is `.card-veil` (`filter: blur(6px)`) with a
  sibling `.card-cover` scrim (`color-mix … 55%`) holding the 44px `ghost` `Reveal`; `revealed =
  track(false)` lives inside the card. New `components/CardGrid.tsrx` + `.card-grid` CSS: gutter
  grid, 1/2/3/4-up at 360/640/900/1200, `blurNsfw` ANDed with `item.nsfw`. `/dev/primitives` gained
  the real-fixture card set (covered, revealed, long title, long tagline) and a grid section outside
  the fixed stage; `/dev/data` now passes `item` and uses `percent()`. `DESIGN.md` → *Card and grid*.
- **Verified:** gate GREEN (build, routes 30, schema); in Chromium at 360/640/900/1200 the grid
  rendered 1/2/3/4 columns with no horizontal scroll, a covered card's veil read `blur(6px)`, its
  footer `filter: none` with the ratio `70%` readable, `Reveal` measured 77×44 and clickable, and
  clicking it uncovered **only that card** (covered 2 → 1, the survivor being the grid's own card).
  `/dev/data` cards still resolve real detail links (`/character/<uuid>`) after the signature change.
- **Unverified:** nothing on a physical device; the dev stage width chip does not move the grid's
  breakpoints (they are viewport media queries) — the gallery says so instead of faking it.

## T-07B — Zod at every boundary (2026-10-30)

- **Changed:** `bun add zod` (4.6.7, the only new dependency; the ticket named it). New
  `src/lib/schema.ts` holds every shape: primitives (`isoSchema` — a real calendar check, so
  `2026-13-01` and `2026-02-30` fail; `handleSchema` — trim → lowercase → 3–24 `[a-z0-9_]`;
  `displayNameSchema` — trim + collapse; `avatarSchema`; `engagementSchema`), every entity as a
  `z.strictObject` (character, lorebook, preset, persona, post, comment, notification, report,
  session + `sessionCopySchema`, `accountPreferencesSchema`, `userSchema`), the collection schemas
  (`seedSchemas`, `commentThreadSchema`) and `commentBranchSchema` (`z.lazy`). `src/lib/data/types.ts`
  is now `z.infer` only — every hand-written entity type deleted, `ratioOf` kept. `lib/validate.ts`
  keeps `readHandle`/`readDisplayName` and `HANDLE_RULE` (now the schema's own message) and derives
  *required* vs *format* from the `ZodError` issue code. `memory.ts` parses all nine fixture
  collections at module load (a bad row throws naming collection, index and path), parses
  `saveProfile` (through `profileWriteSchema`) and `savePreferences` (patch + merged pair), and uses
  the schema's `normaliseHandle` instead of its own copy. `router.ts` matches `[user.username]` with
  the schema's `isHandle` (the `Segment.test` is a predicate now, so there is no second regex).
  `scripts/schema-check.ts` + `bun run schema:check` + section 5 of `scripts/check.sh`.
  `docs/ARCHITECTURE.md` → **Validation**, `docs/CONTRACT.md` → one bullet pointing at it,
  `SHIP-PLAN.md` ticks T-07B, `NEXT.md` rewritten for T-08.
- **Verified:** `./scripts/check.sh` GREEN with five sections (build ok, output ok, 30/30 routes,
  repo public, schema ok — 64 rows across 9 collections, negative cases rejected, comment tree
  18 rows / 12 roots / depth 3 / type not any). Bundle delta measured against a `git worktree` of
  HEAD: JS raw 145.2 → 236.3 KB, gzip 56.5 → 82.8 KB (**+26.4 KB gzip**, above the ticket's ~14 KB
  estimate — see the baton). Published and confirmed live 200 on the new asset
  (`assets/index-SfEO0tBm.js`). Driven in Chromium against the **published** build: `/onboarding`
  with `ab` shows the schema's copy in `.field-error` + `aria-invalid=true` + Finish disabled; `ada`
  with a display name shows `Username taken`, Finish disabled; a free handle clears the error and
  enables Finish. `handleSchema` probed directly: `Avis_2`/`  avis_2  `/`AVIS_2` → `avis_2`, 24 ok /
  25 rejected, `avis-2` rejected, empty → *required*. Live `/character/c0a1b2c3-…-0001` resolves
  through the shell and `/dev/data` renders the fixture counts, which is the adapter's load-time
  parse succeeding in the shipped bundle.
- **Not verified:** nothing on a real mobile device (no Android toolchain on this box); the
  `supabase.ts` adapter does not exist, so its parse points are still unwritten. The `bun add zod`
  network step was fine (registry reachable).

## T-07 — `/onboarding` (2026-10-30)

- **Changed:** data contract + adapter gain the profile trio — `repo.currentProfile(): Promise<User |
  null>`, `repo.isHandleTaken(handle)` (case-insensitive across accounts, never across the viewer's
  own handle; fixture authors `bram/ada/sable/quill/orin/mira` are claimed accounts) and
  `repo.saveProfile({ handle, displayName })` (normalises, returns the saved user, never touches
  `isAdmin`), implemented in `memory.ts`; `src/lib/validate.ts` is the one pure reading
  (`readHandle` → `{handle, problem: required|format}`, `readDisplayName` + `HANDLE_RULE`);
  `session.setAccount({handle, displayName})` emits so a saved name reaches every screen;
  `src/pages/onboarding.tsrx` replaces the placeholder with the form page (kicker, 26/34 title, 52ch
  lede, hairline, two `Field`s, a hairline + caption, two `Toggle`s through `lib/state/prefs.ts`, a
  `btn-primary` Finish gated on a `Derived`), a 250ms settle that checks uniqueness *and* writes the
  draft, Loading/failed states, and `navigate('/user/' + handle)` on submit; `Field.error` is now a
  live `Derived` (`track(() => !!read(error))`) instead of a mount-time snapshot. Docs: `DESIGN.md`
  gains "Onboarding (decided in T-07)", `ARCHITECTURE.md` the profile bullet + `setAccount`,
  `SHIP-PLAN.md` ticks T-07, `NEXT.md` rewritten for T-08.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes). Driven in Chromium against the
  built preview: first visit renders empty with `Finish` disabled and both toggles `false`; `ab` →
  format error after the settle, `field-input is-invalid` + `aria-invalid="true"`, help line
  replaced; `ada` → `Username taken` inline (328px wide at 360), Finish disabled; no draft row is
  written for a taken or incomplete handle (reloading the page kept it empty). `Ada_Lovelace` +
  `  Ada   Lovelace ` → Finish enables, submit lands on `/user/ada_lovelace` (lowercased) and
  `/dev/state` reads `handle @ada_lovelace`, `display name Ada Lovelace`, prefs `true,false` — the
  pair written under the saved handle before `setAccount`, so Show survived the handle switch.
  In-app back to `/onboarding` restores both fields and the toggle from the adapter with Finish
  enabled (own handle is not "taken"). Geometry: 360×740 / 640×800 / 900×800 / 1200×900 all
  `scrollWidth == innerWidth`; at 360 the scroller scrolls 277px and Finish sits at y 477–521 with
  the tab bar at 680 (never hidden); at `lg` the 560px column is centred in the 940px outlet.
- **Not verified:** nothing persists across a full reload — the memory adapter is rebuilt on boot, so
  a reload legitimately returns to the first-visit state (no `localStorage` fake). No Supabase row,
  so the real unique index is T-29/T-30. The 250ms settle measures ~1.2s in a hidden headless tab
  (timers are clamped), so states were read after the clamp, not at exactly 250ms. `Toggle.disabled`
  is still a mount-time boolean (unused on this page). No screenshot-level check of the four
  flavours.

## T-06 — `/authentification` (2026-10-30)

- **Changed:** `src/lib/auth.ts` (new seam: `Provider`, `PROVIDERS`, `PROVIDER_NAMES`,
  `AuthOutcome` = redirecting / cancelled / failed, `signInWithProvider` resolving `cancelled` after
  600ms, `?auth=cancelled|failed|redirecting` preview switch, no network, no `session.signIn()`);
  `src/pages/authentification.tsrx` rewritten as home's title page with three equal `secondary`
  providers, one `track<AuthStatus>` + five derived readings, a status row that reserves 20px
  (grows to 44 for the inline `Try again`), the preview line and the onboarding footer link;
  `src/components/Button.tsrx` now accepts `disabled: boolean | Derived<boolean>` and reads it
  through `read()` inside its own render. Docs: `DESIGN.md` gains an Auth section, `SHIP-PLAN.md`
  ticks T-06, `NEXT.md` rewritten for T-07.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes). Chromium at 360×740, 640×900,
  900×1000, 1280×900: `.screen` scrollHeight == clientHeight at every width (zero scroll in idle,
  redirecting, cancelled **and** failed), `scrollWidth ≤ innerWidth` everywhere, buttons 328×44 at
  360 and 420×44 from `sm`, gate 328/592/656/560 wide, wordmark 34→44 and lede 14→15 at `lg`, rail
  71px at 900 and the tab bar gone. States driven by real clicks and read back from the DOM:
  idle (`session ·` line empty, three enabled) → Google → all three `disabled` + `Redirecting to
  Google…` at 12px in `--color-text-muted` → `Google sign-in was cancelled.` with the buttons
  re-enabled; `?auth=failed` → `No callback arrived from GitHub.` in `--color-danger` (Latte
  `#d20f39`, Mocha `#f38ba8`) with a 111×44 `Try again` (`aria-label="Try again with GitHub"`)
  that returns to the redirecting state; `?auth=redirecting` holds the hand-off with all three
  disabled. `/`, `/dev/primitives` and `/dev/state` re-checked after the `Button` change (plain
  `disabled={true}` still disables).
- **Not verified:** no Supabase call exists to verify — the seam answers from a stub, so the real
  provider round-trip, the callback and the `redirected away` matrix are T-30. The 600ms resolve is
  throttled to ~1.4s in a background tab (a hidden Chromium clamps timers), so the state was read
  after a longer wait rather than at exactly 600ms. No screenshot-level check of the four Catppuccin
  flavours on this page (tokens only). The signed-out→auth redirect and the onboarding gate are
  absent by design and recorded in `DESIGN.md`.

## T-05 — `/` home (2026-10-30)

- **Changed:** `src/pages/home.tsrx` — `PagePlaceholder` replaced with the real title page
  (kicker, 34px wordmark / 44 at `lg`, one spec-grounded paragraph, hairline, a `session ·` reading,
  and the single entry control). Session mirrored into a page-local `track()` via `onSession`, with
  three derived readings (`reading`, `target`, `label`) so `User | null` narrows in one place. The
  control is a real `<a class="btn btn-primary">` (a button cannot carry `href`) targeting
  `/authentification` signed out and `/user/<handle>` signed in; no redirect for signed-in visitors,
  `router.ts` untouched. Docs: `DESIGN.md` gains a Home section (composition, measure, the
  `min-height` arithmetic), `SHIP-PLAN.md` ticks T-05, `NEXT.md` rewritten for T-06.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes); live
  `assets/index-*.js` matched by `publish.sh` on `https://victor-viicell.github.io/LuaPlot/` (200).
  Chromium at 360×740, 640×900, 900×800, 1280×900: `.content` scrollHeight == clientHeight at every
  width (**zero scroll on the 360×740 first screen**, which is what the `min-height` numbers are
  for), `scrollWidth` ≤ `innerWidth` everywhere, button 44px tall (328×44 full-width at 360, 136×44
  from `sm`), column 328/592/656/560 wide with the block optically centred in each frame. States,
  by driving the real store: signed in → `session · signed in as You` + `Open profile` →
  `/user/you`; sign out via the overflow menu → `session · signed out` + `Sign in` →
  `/authentification`, and the click lands on `/authentification` (title `Sign in — LuaPlot`); sign
  out on another route, then SPA-navigate home with the tab bar → the page renders the signed-out
  control (the mirror works, no stale snapshot after a reload-free navigation). Primary button
  paints `--color-accent` (`#8839ef` in Latte), no hard-coded colours.
- **Not verified:** no screenshot-level proof of the Mocha/Frappé/Macchiato flavours on this page
  (tokens only; T-02 verified them). No test runner exists, so the states above were asserted by
  reading the live DOM, not by an assertion in CI. The spec's "signed-in visitors redirected away"
  line lives on `/authentification`, not here; the redirect matrix is still T-30. Nothing persists
  across reload (memory adapter) and nothing pretends to.
- **Decision recorded:** the greeting names the display name, not the handle (`docs/NEXT.md` open
  decision); the handle appears only as the link target.

## T-04 — session + NSFW preference state (2026-10-30)

- **Changed:** `src/lib/state/session.ts` (new: `currentUser/isSignedIn/signIn/signOut/onSession`
  over a plain subscribe/notify store, mock `you` seeded signed in, `sessionNotifications()`),
  `src/lib/state/prefs.ts` (new: `nsfwPreference/setShowNsfw/setBlurNsfw/onPrefs/reloadPreferences`,
  clearing to off before every read, re-reading on `onSession`, refusing writes while signed out),
  `src/lib/data/types.ts` (`User`, `AccountPreferences`), `repo.ts` + `memory.ts`
  (`getPreferences(handle)` / `savePreferences(handle, patch)`, a map keyed by handle — not by
  device — with both off for an unknown handle), `src/App.tsrx` (profile tab points at
  `currentUser().handle` and falls back to `/` when signed out; overflow menu gains a *Preview only*
  block with the dev sign-in/out switch, a one-line NSFW readout and a `/dev/state` link),
  `src/pages/dev-state.tsrx` (new `/dev/state`, added to `ROUTES` only), `src/router.ts` (the route
  entry). Docs: `ARCHITECTURE.md` gains a Session section, the two preference methods and a
  corrected `lib/state/` layout line; `DESIGN.md` gains the state page and the dev menu block.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes match the spec with `/dev/*`
  excluded); live `assets/index-Dn8vd7UF.js` on `https://victor-viicell.github.io/LuaPlot/` (200,
  hash matched by `publish.sh`; the published `/dev/state` renders `State`, badges
  `session signed in / handle @you / admin no`). Chromium, local build and live: toggling Show moved
  Prefs-emits 0→1 and the count strip to `on`; toggling Blur made it `on · blur`; `Sign out` flipped
  the page to `handle —`, both toggles `aria-pressed=false` **and disabled**, and the note to
  *Signed out: nothing NSFW is shown…*; `Sign in as @you` restored `on · blur` from the adapter —
  that is the per-account proof, since the store had cleared to off. Shell: menu readout read
  `nsfw · listed, blurred`, the Profile tab was `/user/you` signed in and `/` signed out, and no tab
  read as active on `/dev/state`. Widths 360/640/900/1200: `scrollWidth` ≤ `innerWidth` at every
  one, no sub-12px text, rail appears at 900 and tab bar disappears there. `/dev/data`,
  `/dev/primitives` and `/character/catalog` still render after the change.
- **Not verified:** the ticket's acceptance — "toggling Blur in one place is reflected on a catalog
  after navigation" — has no catalog to land on until T-09; what is proven is the store plus the
  shell's readout plus the adapter round-trip. Preferences reset on reload (memory adapter, no
  Supabase project ref) and that is deliberate, not faked with `localStorage`. The memory adapter's
  `VIEWER` is still a constant, so signing out hides nothing in a listing — that is T-30, recorded
  in the baton so it is not "fixed" by importing the session into `memory.ts` (module cycle). No
  test runner exists; the stores are asserted by reading `/dev/state`, not by an assertion.

## T-03 — data contract + memory adapter (2026-10-30)

- **Changed:** `src/lib/data/types.ts` (every entity derived from the specs; `ratioOf()` derives the
  ratio from the vote counts, and personas carry no engagement and no NSFW flag), `repo.ts` (the
  seam: one list method per kind returning `{ items, hasMore }` at 24/page, lookups returning
  `null`, mutations returning the updated entity, `resolveRepo()`), `memory.ts` (deep-copied
  fixtures, derived `commentCount`/`replyCount`, one vote per viewer with a switch replacing the
  earlier vote, listings hiding what is not public and not the viewer's, `findSessionForCharacter`
  for Start/Continue), `src/lib/fixtures/{ids,characters,lorebooks,presets,personas,posts,social,sessions,index}.ts`
  (8 characters, 6 lorebooks, 5 presets, 3 personas, 12 posts, 18 comments, 6 alerts, 4 cases,
  2 sessions with transcripts; ids are real 36-char UUIDs or every detail link would 404), and
  `src/pages/dev-data.tsrx` (`/dev/data`, added to `ROUTES` only — not to the spec, not to the tab
  bar). `docs/ARCHITECTURE.md` records the seam shapes; `docs/DESIGN.md` notes the second dev page.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes match the spec with `/dev/*`
  excluded); live `index-BUfrGS6u.js` on `https://victor-viicell.github.io/LuaPlot/` (200, bundle
  hash matched by `publish.sh`). Chromium at 360×740: `scrollWidth` 360 = `innerWidth`, no
  horizontal scroll, counts grid 2-up. At 1280×900: 3 card columns, 4 count columns, `scrollWidth`
  1270 < 1280. Counts read 8/5/5/3/12/18/6/4 (5 lorebooks because one fixture is private, which is
  the point of the private one). "Vote like" logged `39/14 → 40/14` and the card ratio recomputed
  from the counts; the busiest thread reads 4 comments through `listComments` while the item's
  derived `commentCount` says 4 too.
- **Not verified:** no Supabase adapter, so the error envelope is still undesigned (recorded as an
  open decision). Nothing consumes `vote`/`isBookmarked`/`toggleBookmark` from a product page yet —
  they are proven only on `/dev/data`. No test runner exists; the derivations are checked by eye on
  the dev page, not by an assertion.

## T-02 — design primitives (2026-10-30)

- **Changed:** the eleven primitives `src/components/{Button,Field,Toggle,Card,Sheet,Toast,Tabs,
  EmptyState,Skeleton,Avatar,Icons}.tsrx` plus `src/lib/reactive.ts` (`read()` for live props) and
  `src/lib/toast.ts` (subscribe/notify queue, no module-scope `track()`); the whole look added to
  `src/styles.css` under "Primitives (T-02)" — one stylesheet, semantic tokens only, because a
  scoped `<style>` block can never reach into a child component; `src/pages/dev-primitives.tsrx`
  (`/dev/primitives`, 10 sections, theme switch on `data-theme`, stage width 360/640/900/1280);
  `/dev/*` filtered out of `scripts/spec-routes.mjs`; `<ToastHost />` mounted in `App.tsrx`.
  `docs/DESIGN.md` records the decisions (stylesheet location, toast placement, z ladder 8/9 ·
  40 · 41 · 60, Tabs does not own the query).
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes match the spec with `/dev/*`
  excluded); live bundle `index-CCEwLjsa.js` on `https://victor-viicell.github.io/LuaPlot/`, 200.
  Chromium pass at 360×740 and 1280×900: zero page-level horizontal overflow at both, shell swaps
  tab bar → rail at 900 and keeps 5 tabs, every tap target ≥ 44px, sheet is a bottom sheet at 360
  (`bottom: 0`, 6px top radius) and a 520px centred dialog at 1280, focus lands on the panel and Tab
  wraps last→first, Escape closes, toast renders in the polite live region with its message, tabs
  flip `aria-selected`, a field accepts typing. All four flavours read their own tokens
  (`--color-accent` #cba6f7 / #8839ef / #ca9ee6 / #c6a0f6; page bg #1e1e2e / #eff1f5 / #303446 /
  #24273a). `/dev/primitives` deep-links on Pages through `404.html` (HTTP 404, app boots — the
  usual Pages SPA behaviour; the root URL is the 200).
- **Not verified:** no Tauri/Android build (T-33/T-35); the toast's auto-dismiss timer and the
  sheet's 180ms motion were not timed by hand (the automation tab throttles animations, so painted
  `transition` values read as their start value — tokens, not paint, were used for the theme check).
  No test runner: the gallery is a manual proof, exactly like the shell in T-01.

## T-01 — router + shell skeleton (2026-10-30)

- **Changed:** `src/router.ts` (30-route table mirroring the spec index, specificity-ordered
  matcher, `navigate` / `currentRoute` / `onRouteChange` / `useQuery`, BASE-aware `href`),
  `src/App.tsrx` rewritten as the shell (top bar, five-destination bottom bar, `md` rail,
  `lg` 240px sidebar, skeleton / not-found / error outlet, overflow menu), `src/components/Icons.tsrx`
  (7 icons, one 20px / 1.5 stroke set), `src/components/PagePlaceholder.tsrx`, 30 page placeholders,
  `.ico` base rules in `src/styles.css`, `src/vite-env.d.ts`.
- **Verified:** `scripts/check.sh` GREEN (build ok, 30/30 routes match the spec); real Chromium pass
  at 360×740, 640, 900, 1280 — zero horizontal overflow at every width, tab bar swaps to the rail at
  900, rail widens to 240 at 1200, tab target 72×59, top bar 56, labels 12px; tab clicks, overflow
  menu, `history.back()`/`forward()` and deep links (`/character/<uuid>`, `/moderation/<uuid>`,
  `/user/<handle>`, `/user/a` → not found, `/nope` → not found) all resolve; Latte and Mocha both
  render from tokens (bg `#eff1f5` / `#1e1e2e`, accent `#8839ef` / `#cba6f7`).
- **Not verified:** no Tauri/Android build (T-33/T-35). `access` is declared on every route but
  nothing enforces it — that is T-04 (session) + T-30 (redirect matrix). No test runner exists, so
  the route check stays in `scripts/spec-routes.mjs`.
- **Publish:** the first `publish.sh` printed `LIVE` while Pages was still serving the *previous*
  build (its CDN answered 200 for ~4 minutes with the old `index-DNvyvbRv.js`; the site only flipped
  to the new bundle at 16:06, well after the 200). `publish.sh` now polls until the live
  `index.html` references the bundle hash it just built, and fails if that takes past 400s. The
  comparison path is verified (second run matched immediately); the stale-deploy wait itself was
  observed by hand, not inside the script.

## 2026-10-30 — setup (baseline, not a ticket)

- Baseline build verified: `bun run build` → 81 modules, 156ms, dist 13.3KB JS / 11.2KB CSS.
  Tree clean at commit `806d45b`.
- Preview host established: repo made public, `gh-pages` branch created, GitHub Pages enabled →
  **https://victor-viicell.github.io/LuaPlot/** (200). Vite `base` now reads `LUAPLOT_BASE`, set to
  `/LuaPlot/` by `scripts/publish.sh`, which also publishes `404.html` for deep links.
- Vercel path documented but not used: deploys succeed through the connector yet every deployment
  is SSO-protected and the project alias 404s (connector has no permission to change project
  settings). `scripts/deploy.py` stays as a fallback; Pages is the canonical preview.
- Rotation scaffolding: `docs/CONTRACT.md`, `docs/SHIP-PLAN.md` (39 tickets, 6 phases, failure
  bank), `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/NEXT.md`, `scripts/{check,publish,publish-pages,agent-lock}.sh`,
  `scripts/spec-routes.mjs`.
- Secrets: `DEEPSEEK_API_KEY` and `OPENROUTER_API_KEY` in `.env.local` (gitignored, mode 600),
  `.env.example` documents the shape. Both are read **only** by `supabase/functions/*` later.
- Not verified: nothing mobile yet — no Android SDK, NDK, `adb` or rust android targets on this
  box (T-35 covers it). Supabase connector cannot list projects (403), so the memory adapter is the
  data source until a project ref is supplied.

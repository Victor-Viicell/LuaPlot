# Progress log

Append-only. Newest first. Every entry: ticket, what changed, what was verified and how, what
could not be verified.

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

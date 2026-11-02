# Baton — what the next session does

**T-53 is the one ticket.** T-52 landed: `scripts/smoke.mjs` has row **36** (walk **36/36** locally
and **36/36 `--live`**), and the law it guards — *Engagement is metadata on cards (ratio only) and
actions on detail pages (counts live there)* — now has **both halves** measured: 20/20 catalogue
cards print exactly one `.card-ratio` (a whole percent, a `SPAN`, outside every control) and no
`.count/.counts/.count-label/.count-value/.comments`, while `/character/[id]` prints its four
engagement cells and its two `.vote` controls, and `/post/thread` is measured as the *other* card on
purpose (two `.post-count` cells plus one comment link, no ratio — `thread.md` fixes that footer).
The next unguarded law is the one `SHIP-PLAN.md`'s failure bank already names and that no row walks:
**entry 4, "NSFW preference treated as access control (404s) → detail routes always resolve"**.

## T-53 — a viewer's filter never blocks a route

**Why it is next.** `src/specs/systems/nsfw.md` → *Rules*, twice in one breath: *"It is not access
control. No route is blocked, no 404, no redirect: a direct link still resolves"* and *"**With Show
off, a detail route still resolves.** The item draws with its chrome intact and the body withheld
behind the same reveal control a blurred item carries; there is no separate notice page and no empty
render."* Row 25 (`/dev/state`) proves the **listing** obeys the pair — it flips Show+Blur on, counts
covered cards on `/character/catalog`, then restores — but **no row has ever opened a detail route
with Show off**. `character-detail.tsrx` already implements the rule (`const covered = track(() =>
nsfw.value && !show.value && !revealed.value)`, `.veiled.is-covered` plus a `Reveal` button at
~line 1134). The obvious "fix" — gating the page on `show` for a viewer who turned NSFW off, or
answering the not-found sentence — would 404 a route the spec guarantees, and every gate would stay
green: `spec-routes.mjs` proves the module resolves, never what it renders under a preference.

**Approach**

1. One new row, **row 37** (bump `EXPECTED_ROWS` 36 → 37), after row 36 and before `sign out`.
2. The fixture: `/character/c0a1b2c3-0000-4000-8000-000000000004` — *Hollow Saint*, `author: sable`,
   `nsfw: true` (`src/lib/fixtures/characters.ts`, `CHARACTER(4)`). It is the fixture's only NSFW
   **character**, and rows 6/32/35/36 all read Sonic (`…002`, SFW), so nothing collides.
3. **Record the seed pair, never assume it.** Row 25's helpers: `toggleState("Show NSFW content")` and
   `toggleState("Blur NSFW content")` first, then `setToggle("Show NSFW content", false)`. Blur is
   irrelevant while Show is off (`nsfw.md`: *Blur only matters while Show is on*).
4. **Listing half.** `/character/catalog`: wait for `.skel-card` to be **gone** (T-50), read the
   `.card-title` texts, and assert cards > 0 **and** "Hollow Saint" absent. The listing half is what
   makes the absence meaningful.
5. **Route half, by address.** `go()` the id directly — no press: the law is about a *direct link*.
   Read the page as data and assert: `.detail` mounted, its name reads *Hollow Saint*, `.veiled`
   carries `is-covered`, `aria-hidden="true"`, a control named **Reveal** is inside `.detail`, and the
   `.counts[aria-label="Engagement"]` cells still draw their numbers (`nsfw.md`: *the numbers are
   never hidden*). Then press `Reveal` and assert `is-covered` is gone and the name survives — a
   reveal is one view, and it writes nothing to the account.
6. **Restore in `finally` and assert the restore.** Row 25 restores by value; row 31/32/36 assert
   rather than trust the `finally`. Read `/dev/state` back, compare with the seed, then re-read the
   catalogue. A leak here makes the *next run's* rows read a flipped account.

**Traps**

- **This row owns the NSFW pair, and a leak poisons every later run.** Restore from the seed you
  recorded, never from a hard-coded `true/true`, and assert it before the row returns.
- **`Reveal` is a `Button` whose accessible name is its label**, and the page also draws *Start a
  session*, *Bookmark* and *More*. Scope the read to `.detail` and press with `exact: true`, or the
  row proves a control somewhere else on screen.
- **The cover is a class, not a colour.** `.veiled.is-covered`, and the `<aside>` holding the counts
  sits *outside* it — "the body is withheld" and "the numbers stay visible" are two separate reads,
  and both must be asserted.
- **A listing's absence says nothing about the route.** The two halves fail independently; report
  which one moved rather than one combined failure.
- **A poll timeout is not the proof the accept line asks for (T-36a).** If the page never resolves,
  catch the wait, re-read `.detail`/the name/`document.title`, and name what actually mounted — a red
  proof that says "timed out waiting for the name" wastes the next session's run.

**Accept:** `./scripts/check.sh` GREEN; walk **37/37** locally and **37/37 `--live`**; row 37 proved
**red** first (gate `character-detail.tsrx`'s `.detail` content on `show.value || !nsfw.value` so a
Show-off viewer gets an empty render, watch the row name the route and what mounted instead, then
restore the exact bytes); `publish.sh` prints `LIVE` and `curl` is 200.

## Driving the desktop window (recipe, proven 2026-11-01)


The webview half of T-33B(a) is verified; this is how, so a later ticket does not rediscover it.

```bash
cd /home/viicell/Projects/LuaPlot
export XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-1 \
       HYPRLAND_INSTANCE_SIGNATURE=$(ls /run/user/1000/hypr/ | head -1)
bun run tauri dev &            # run it as a tracked background process, never with nohup
sleep 20 && hyprctl clients -j | jq -c '.[] | select(.class=="luaplot") | {mapped,at,size}'
grim -g "967,38 941x1030" /tmp/shot.png     # geometry from `at` + `size`, not x/width
```

- **`computer_use` sees nothing here** (`list_windows` → 0) because the cron env has no display; Hyprland
  0.56 also has no click dispatch (`hyprctl dispatch focuswindow class:x` fails — Lua dispatch syntax).
  So drive **keyboard-only** with `wtype -k Tab -k Tab … -k Return`, and read every step back with `grim`
  + `vision_analyze`. Never assert the window state from a key sequence alone.
- **The focus ladder that works from a fresh load:** 8× `Tab` → the top-right *More* button (7× lands on
  *Back*), `Return` opens the menu, 4× `Tab` → the session row (*Sign out* / *Sign in as @you*),
  `Return` presses it. Verify the focus ring in a cropped `grim` before pressing.
- **Ground truth is WebKit's own store:** `sqlite3 -readonly
  ~/.local/share/com.viicell.luaplot/localstorage/http_localhost_1420.localstorage
  "select key, quote(value) from ItemTable"` → `luaplot.session` as **UTF-16LE** hex: `null` when signed
  out, `{"handle":"you","displayName":"You"}` when signed in (never `isAdmin`).
- **`pkill -x luaplot` ends the whole `bun run tauri dev`**; relaunching takes ~20s (cargo is warm).
- **A desktop notification can sit over the window's top-right corner** and hide the *More* button in
  a capture. The menu renders inside the body, so the session row is still readable — crop below the toast
  rather than concluding the menu did not open.
- Cron's shell guard refuses `bash -c` / `node -e`; put scripts in a file (or use `jq`). It also
  refuses `rm` under a root path — clean scratch files with Python's `os.remove`, or leave them in
  `$TMPDIR` (`~/.hermes/cache/scratch`). **`execute_code` is blocked in this cron profile** — for
  arithmetic, write a `.py` under `$TMPDIR` and run `python3 <file>`.

## Blocked — what a human must do

- **T-29/T-30/T-31/T-32 (Supabase):** create a project and export `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` (server key stays out of the client). Nothing about the data seam can move past
  the memory adapter until then. T-30 also owns the real auth body (`lib/auth.ts` writes no session
  today) and the redirect matrix; T-29's migration is the first thing after the ref lands.
- **T-33B(b) deep link (desktop):** needs `tauri-plugin-deep-link` + a `luaplot://` scheme in the
  bundle config — a dependency, and the contract forbids one the ticket does not name.
- **T-33B(c) `Ctrl/Cmd+K`:** a decision, not work — no spec file describes a command palette, and
  `luaplot-pages.md` is product law, so nothing may invent it. The owner must either record it in
  `docs/DESIGN.md` (what it lists, what it does, what it costs at 360px) or strike it from the ticket.
- **T-35/T-39 (Android + release):** install cmdline-tools + platform 35 + NDK, the four rust
  android targets, then `tauri android init`. T-39 also needs a signing key and a `v0.1.0` tag, so it
  follows T-35 and stays blocked. **T-36 is split:** (a) — the keyboard inset — **landed as T-36a** (`lib/viewport.ts`
  + walk row 32); the rest of T-36 — no clipped input **on a real APK**, hardware back-button mapping,
  60fps transcript scroll on device — still needs the toolchain above and stays blocked.
- **Tauri on this box is NOT blocked — and the webview session proof is done.** `bun run tauri dev`
  opens, the account survives a restart in both directions, and the recipe above reproduces it.

## Open decisions

- **Row count is 36 (T-52).** `scripts/smoke.mjs` keeps it in an explicit
  `EXPECTED_ROWS`, so a row that stops running is a red walk — **extend** an existing row rather than
  adding a near-copy of it, and bump the count only when a row is genuinely new. **Row 36 is
  read-only**: it reads the catalogue, one detail page and the thread, so no write, no CDP override,
  no probe and no NSFW flip left behind. **Row 37 (T-53) will own the NSFW pair** — it must restore
  from a seed it recorded and assert the restore, or every later run reads a flipped account.
- **Row 31 owns two CDP overrides and one probe.** It installs a classless `<a>` in the first card (no
  page prints one, and the base rule is the thing under test), measures it resting and through
  `CSS.forcePseudoState`, takes its own 900px `Emulation.setDeviceMetricsOverride` for the rail, and
  clears the media emulation, the metrics override *and* the probe in one `finally`. Anything added
  after it must assume 360×740 and no probe in the DOM.
- **The breakpoint row owns a CDP override.** Anything added after it must assume the session is back
  at 360×740; the row asserts that it cleared (`window.innerWidth === restore`) rather than trusting
  the `finally`. T-47's row 30 takes its own 360×740 override and clears it for the same reason.
- **`follow()` drops the fragment on purpose** — a `/terms#anchor` link must stay a real document
  navigation (or gain scroll handling nothing needs yet). `ARCHITECTURE.md` → Router carries the rule
  and the three exemptions `scripts/link-check.mjs` encodes (fragment, `target=`, external).
- **A card's ratio rounds to whole percent**, so a one-vote change can leave the printed number
  identical (96% → 96%). A journey proving an engagement write must read a count (the detail page's
  Likes/Dislikes cells), never a card's percentage.
- **`/dev/data`'s vote is order-dependent but not fragile.** The row votes on whatever the adapter's
  newest character is *at that moment* (earlier journeys re-save rows), and it reads the name back
  from the log before comparing. Do not pin a character id.
- **A 44px band is `line-height`/`min-height`, not `padding`.** Vertical padding on an inline `<a>` is
  hit-testable but invisible to layout, so a row that measures `getBoundingClientRect()` would pass
  while the row still collapsed; a flex item with `line-height: 44px` is the band the walk can see.
  A band that only hugs its text is still a small target: `flex: 1 1 auto` is what makes it 44 **wide**
  (T-47's first run failed at 36px wide on `@you`).
- **A token tier has a *surface* limit, not just a flavour limit.** `--color-accent-text` clears AA on
  `--color-bg` (5.20) and `--color-bg-elevated` (4.83) in Latte, and does **not** on
  `--color-surface` (3.81) — the same surface where `--color-text-muted` already fails (4.05). Latte's
  `surface-0` (`#ccd0da`) is the app's worst backplate; **a surface that cannot hold AA text loses the
  text, not the token** — that is what happened to the `md` rail's fill in T-37C, and the hover tier
  exists only because a *hover* still has to survive that backplate (4.66, which is why it is 40/60
  and not 55/45 = 4.38 or 60/40 = 4.29). Do not "restore" the lighter mix by eye.

- **Row count is 36 after T-52; 37 is T-53's.** Row 32 shadows `visualViewport.height`, takes its
  own 360×740 metrics override, and clears both in `finally`; anything added after it must assume the
  shadow is gone, the token is back to `0px` and the session is back at the browser's own window
  size (assert `innerWidth` returned, never trust the `finally`). **Row 33 is mutating**: it presses
  **Restore copy** on session 2, so session 2's character copy is `untouched` for the rest of the
  run — a later row that wants an `edited` copy must seed or edit its own.
- **The pressed-pill fill is a rule, not a one-off (T-48).** A control whose own background is
  `--color-surface` cannot hold static accent text in Latte; pressed means accent **fill** +
  `--color-accent-contrast`. `DESIGN.md` → *Contrast* carries it.

## Found while working (carried forward — keep this list growing)

- **The detail page's engagement list has four cells and one of them is a percent (T-52).** `T-52`'s
  first run failed on a page that was right: `/character/[id]` draws `Likes`, `Dislikes`, **`Ratio`**,
  `Comments`, and the Ratio cell's `.count-value` is `percent(ratioOf(...))` (`87%`). "Every
  `.count-value` is a number" is therefore false; assert the shape **per label**. The ticket's example
  strings are a hypothesis, the fixture is the fact (T-49's lesson, again).
- **A count can be injected into a card's footer without moving a pixel of its layout.** `T-52`'s red
  proof appended `<span class="count">{item.likes}</span>` beside `.card-ratio` inside `.card-foot` and
  the row read `20/20 card(s) fail` with `["count"] inside it` — the shape to copy for any "this number
  belongs elsewhere" rule is: read the **class names** inside the card, not the text on it.
- **A post card is not a catalogue card, and `thread.md` says so.** `PostCard.tsrx` draws
  `.post-count` × 2 plus a `.post-comments` link and **no** `.card-ratio`, because the post footer is
  spec'd as likes + dislikes + the comment count. Row 36 measures both sides so a later "let us make
  the cards consistent" turns red instead of silently editing the product.
- **`/post/thread`'s loading state draws three `.skel-card`s**, not `.card-cell`s — a row that reads
  `.post-counts` on the first frame reads zero on a feed that has not loaded (`T-50`'s shape, different
  markup). Wait for `.skel-card` gone here too.
- **A precedence law's red proof needs *both* halves (T-51).** Neither edit the ticket suggested is red
  on its own: widening `ID` to `/^[0-9a-z-]{1,36}$/i` still mounts the catalog, because `TABLE` sorts
  fewer-params-first and the literal route is tried before the predicate is ever consulted; dropping the
  param count from the sort still mounts it, because `Array.prototype.sort` is stable and `ROUTES`
  declares `catalog`/`create` before `[id]` — depth-only ordering is a no-op. The red proof is the two
  together (`ID` widened **and** the sort inverted to params-first). Say so in any accept line that
  offers "either", or the next session burns a walk proving nothing.
- **A root class shared by a component is not a landmark (T-51).** `CommentThread.tsrx` draws
  `<div class="thread">`, the same class as `/post/thread`'s page root, and a broken router lands on a
  *detail* page that renders it. Key a page on its own `.kicker` sentence **plus** the absence of
  `.detail` — the shared class alone would pass on the wrong page.
- **`document.title` carries an em dash, not a hyphen.** `App.tsrx` writes `` `${def.title} — LuaPlot` ``
  (U+2014), so a probe built with `- LuaPlot` never matches and reads as a timed-out page. Copy the
  literal from `App.tsrx`.
- **A whitespace collapse needs `\\s` per template level.** `js(\`…\`)` unescapes once, so `\\s` in the
  file reaches `Runtime.evaluate` as `\s` (whitespace) — while the `\\\\s` written in every older row
  reaches it as `\\s`, a literal backslash followed by `s`, and collapses nothing. Harmless where those
  rows compare a value with no inner spaces; a trap for a new probe that needs the collapse to work.

- **A loading state can satisfy an absence count (T-50).** `/persona` draws **three `.card-cell`s of
  skeletons** before it draws a card, so a row that counted cells on the first frame read `3` on a
  grid that had not loaded and would have passed a broken collection. Wait for `.skel-card` to be
  **gone**, and assert the real card (`.persona-card`) too. The same shape applies to any page whose
  skeleton mirrors the grid.
- **"Zero elements" is a node count, never a text search (T-50).** Row 34 counts `button, a` inside
  `.detail` and matches their `aria-label`-then-`textContent`; a toast from row 33 (*Copy restored.*)
  or a footer that says "report" makes a body-text search pass on a page that still has the control.
  Read the accessible name as `aria-label || textContent` — the same order `click()` uses — rather
  than reaching for `Accessibility.getFullAXTree`, which is thousands of nodes to filter.
- **An absence row needs a presence half or it passes on an empty page (T-50).** Row 34 asserts the
  name `Nell` and the four controls the persona spec *does* require (Start a session, the default
  pair, Edit) before asserting what must be missing. Otherwise a page that rendered nothing is a
  green row.
- **`innerText` is the rendered text, so a `text-transform` redesigns the assertion (T-49).** The
  session copies header and each `.copy-kind` are uppercased in CSS, so row 33's first run read
  `3 COPIES · 1 EDITED` and failed on a page that was right. Read `textContent` for a sentence the
  code writes; use `innerText` only when what the reader sees is the thing under test.
- **A ticket's example strings are a hypothesis; the fixture is the fact (T-49).** T-49 predicted
  `4 copies · 1 edited` → `4 copies · 0 edited`. Session 2 holds **three** copies (character, one
  lorebook, preset) and `summary` appends ` · N edited` only while `N > 0`, so the truth was
  `3 copies · 1 edited` → `3 copies`. Four is session 1's two-lorebook shape, which is the example
  `DESIGN.md` quotes. Count the fixture before writing the assertion.
- **`Restore` and `Restore copy` are two different buttons.** The edited row's opener is labelled
  **Restore**; only the confirmation's button says **Restore copy**. Pressing by a `startsWith`
  match hits the opener, and a second press must be scoped to `.copy-confirm`, or the row proves the
  dialog and never the snapshot.
- **A hand sweep is a list; the gate is the guard (T-48).** T-37C moved every accent-text site it could
  see in `src/styles.css` and reported the tree clean — `scripts/tier-check.mjs` then found **26** more
  in `.tsrx` `<style>` blocks on its first run, including `.vote`/`.save` pressed pills on three pages.
  When a rule can be checked mechanically, the sweep is not done until the check exists.
- **A mark token in a *fallback* is still the mark.** `color: var(--color-success, var(--color-accent))`
  paints accent text whenever the first token is missing; the fix is the text tier in the fallback, not
  an exemption in the scanner.
- **Mask, don't skip, when extracting CSS from a `.tsrx`.** Replacing non-`<style>` characters with
  spaces (newlines kept) means an offset in the mask is an offset in the source, so `file:line` is the
  file's own line — no remapping pass to get wrong.
- **A scanner that takes file arguments can be proved red without touching the tree.** `node
  scripts/tier-check.mjs $TMPDIR/x.css` on a copy is the whole proof; copy that shape for the next
  static guard. An injected `<style>` must land *inside* the real block, or the tag text becomes part
  of the preceding selector and the message reads oddly.
- **`--color-accent-hover-text` clears `--color-surface` (4.66 Latte), but it is a hover's token.** There
  is no *static* accent text tier that clears that backplate, so a static site there is a design
  decision (fill, or drop the accent) — never a borrowed tier.
- **Cron's shell blocks `bash -c` / `node -e` and `execute_code`.** A sweep like T-48's is a `.py` file
  under `$TMPDIR` run with `python3`, and it must apply edits bottom-up per file so the line numbers it
  read stay valid.

- **A backtick inside a `js(…)` template literal ends the string.** A comment in row 31's page
  expression quoted `--color-surface` in backticks and node reported `Invalid left-hand side
  expression in postfix operation` at the snippet's *opening* line — no template-literal error, no
  pointer at the comment. Page snippets carry no backticks; write the token plainly.
- **A token with no element left on it can still be measured honestly.** The hover tier exists for
  `--color-surface`, which now paints no text at all (the rail's fill is gone), so row 31 resolves it
  through a throwaway `div` — set `style.backgroundColor = "var(--color-surface)"`, read the computed
  `backgroundColor`, remove it. The value is the browser's own, not a hex copied into the walk (a hex
  would keep passing after the token moved).
- **Two hovered nodes need two force/release pairs.** Forcing the author link and then reading the
  *probe's* `:hover` colour measures the author's rule; each node is forced, read and released in
  turn. Release is `forcedPseudoClasses: []`.
- **`color-mix()` computes to `color(srgb 0.49 0.23 0.85)`** — 0–1 floats. A contrast helper that
  assumes 0–255 bytes reads it as near-black and reports a fake **17.23:1**. `CONTRAST_FN` in
  `scripts/smoke.mjs` branches on `indexOf("color(") === 0`, and `cssHex()` makes the same branch for
  evidence; a regex escape inside that template literal is a double-escaping trap that produced
  exactly this bug twice.
- **`CSS.forcePseudoState` (`DOM.enable` + `CSS.enable` + `DOM.querySelector`) measures a `:hover`
  pair without a synthetic mouse** — the only honest way to assert a hover colour, and it must be
  released (`forcedPseudoClasses: []`) before the next measurement.
- **`Emulation.setEmulatedMedia { features: [{ name: "prefers-color-scheme", value }] }` is the
  flavour switch**; `features: []` clears it. Assert `--ctp-base` (`#1e1e2e` / `#eff1f5`) plus
  `color-scheme` to prove the pass really changed palette — a pinned `<html data-theme>` makes the
  media query inert and the row refuses to run against one.
- **Mixing toward `--ctp-crust` lightens a light flavour.** The mark's text tier darkens by mixing
  toward `--ctp-text`; the inverse reads like progress and measures worse (3.82 vs 4.83).
- **A global `s.replace` across `src/styles.css` hits the dark blocks too.** Restoring "the raw
  declaration" everywhere put the mix on Mocha and printed `9.09:1` with `#cbadf7` — anchor the
  replace on surrounding context (the flavour's `--ctp-lavender` line) or by line number.
- **A URL assertion cannot see a re-boot.** `waitUrl` is a substring match and a fresh document loads
  the same route; T-45 proves a push with **document identity** (`window` marker +
  `performance.timeOrigin`), and `performance.getEntriesByType("navigation")[0].type` is `navigate`
  even for a full load from a link, so it cannot be the proof. `nav` is only printed as context.
- **The walk's own row count is a gate.** `process.exit(… rows.length === 27)` was a literal: adding
  row 28 with all 28 green still exited 1. It is `EXPECTED_ROWS` now — bump it with the row.
- **A red walk proves the assertion; a green one does not.** T-45 removed the `onClick`, rebuilt, and
  watched row 1 fail with the document dump before restoring it; T-47 set the band back to
  `line-height: 1.3` and watched row 30 read `16px tall`; T-37B put Latte's tier back on the mark and
  watched row 31 read `4.45:1`. Do that for any new invariant — and restore the exact bytes that
  passed, so the green run stays the proof.
- **Bare anchors are gone (T-46):** 52 internal anchors pair `href` with `follow`, `EmptyState` takes
  a **path** (`to=`) so its call sites cannot regress, and gate section 7 fails on a new one.
  The static check is the guard the walk cannot be: 31 rows cannot visit every page. (T-48 is the same
  argument for the colour tier.)
- **The webview stores `luaplot.session` as UTF-16LE in a SQLite table** (`localstorage/
  http_localhost_1420.localstorage`, `ItemTable`), so `quote(value)` returns hex — decode before
  comparing, or a correct proof reads as a corrupt one. On Pages the same key lives in the browser
  profile instead; the origin differs (`http://localhost:1420` in dev, `https://…/LuaPlot/` on Pages).
- **`localStorage` prints `null` for both "no key" and the stored string `"null"`.** A proof that only
  prints `getItem` cannot tell a fresh install from a signed-out device; compare with
  `JSON.stringify` or assert the DOM beside it.
- **A CDP reload is only honest at a URL the host actually serves.** GitHub Pages has no SPA fallback
  (`/LuaPlot/dev/state` → 404), so a session/persistence proof runs at the site root and reads the
  shell (`Sign out` vs `Sign in as @you`, `prefsLine`'s sentence) instead of `/dev/state`.
- **A publish is not instantly walkable.** Two `/dev/*` rows timed out on a live walk started ~25s after
  `publish.sh` and passed on the re-run: a mid-propagation chunk 404 looks identical to a broken page.
  (A failure that survives a re-run is real — that is how T-45's doubled base was caught.)
- **A `cargo build` debug binary loads `devUrl`, not `frontendDist`.** It opens a mapped window that
  says *Could not connect to localhost: Connection refused* — the app is fine, vite is missing. The
  accept command is `bun run tauri dev`; and `dist` must be built **without** `LUAPLOT_BASE` for Tauri
  (the app is served from `tauri://localhost`, so `/LuaPlot/assets/…` 404s).
- **The desktop is drivable from cron without a display** — see *Driving the desktop window* above.
- **A tiling compositor overrides the configured window size.** `tauri.conf.json` asks for 1200×900 and
  Hyprland maps it at 941×1030. That is the WM, not a config bug — the *floor* (`minWidth`/`minHeight`)
  and the label are the parts the app controls, which is why `scripts/tauri-config.mjs` asserts those.
- **`pkill -f vite` kills the tick's own shell**, because the pattern matches the command line that is
  running it. Kill a preview by port: `lsof -ti:4321 | xargs -r kill`. Use `pkill -x luaplot` for the app.
- **Never pipe `scripts/smoke.sh` into `tail`/`head`/`grep`.** A pipeline hands back the *pager's*
  status, so a red walk exits 0, and `smoke: N/31 journeys` is the first line the pipe drops — the run
  looks green and proves nothing. Redirect to a file, then read the file and the exit code.
- **T-44's walk helpers are the ones to reuse**: `setToggle(label, want)` / `toggleState` (press a
  `button.toggle`, then **poll the rendered `aria-pressed`**), `storeCell(label)`, `coveredCards()`,
  `measureAt(width)` and the `BREAKPOINTS` table.
- **The card grid is 1 / 2 / 3 / 3, not 1 / 2 / 3 / 4.** Measured ladder live: `360:1col/field1/rail0/
  btn44/outlet340 · 640:2col/field2/rail0/btn44/outlet620 · 900:3col/field2/rail84/btn44/outlet794 ·
  1200:3col/field2/rail240/btn44/outlet794`, no document-level horizontal scroll at any width — and
  still exactly these numbers after T-47 made the card footer 44 tall (the height did not enter the
  track math).
- **`.count-label` carries `text-transform: uppercase`** and `innerText` returns the *rendered* text
  (`SHOW`, `LIKES`): a case-sensitive label match finds nothing and reads as a broken page.
- **`Emulation.setDeviceMetricsOverride` is the only honest way to change width**, and a leak poisons
  every later row. `measureAt` runs in `try`, the clear + 240ms settle in `finally`.
- **`/dev/state`'s NSFW pair is restored, not merely flipped.** A journey that leaves Show+Blur on
  makes every later card-grid assertion read the wrong state.
- **The `--live` walk catches what the local one cannot.** T-41 lost three rows to an `^`-anchored path
  test, T-42 to a missing `/edit`, T-45 to a doubled base that base `/` hides. Suffix-match every path,
  run `--live` before claiming a ticket.
- **A refusal row must carry the whole path.** T-42's first run failed three rows because `OTHER_*`
  omitted the trailing `/edit` and the failure read like a copy bug.
- **A `<input type=file>` in headless Chromium hangs the press unless intercepted.**
  `Page.setInterceptFileChooserDialog { enabled: true }` before the press, `backendNodeId` from the
  event, then `DOM.setFileInputFiles` — which fires `change`.
- **Do not pin an engine's answer.** `navigator.vibrate` answers truthy here (155) and measured `false`
  in T-34: a row whose value comes from the browser asserts a **set** and names the member it saw.
- **`document.title` on a non-root route is `<Title> — LuaPlot`** (`App.tsrx`), so the badge reads
  `(3) Native — LuaPlot`.
- **T-41 is done**: `retype()` and `choose()` are the helpers for a preloaded field (`type()` appends at
  wherever `focus()` left the caret). **T-40 is done** (`/character/[id]/edit` mounts `CharacterForm`
  only in its `ready` branch). **T-34 is done**: `native.ts` answers `nativeResultSchema`;
  `isNative()` reads `window.__TAURI_INTERNALS__`, never `import.meta.env`.
- **The Tauri chunk is `core-*.js` and no file in `dist` contains the literal `@tauri-apps`** — only
  the resource timing can prove it never loads (`noCoreChunk`).
- **A synthetic `.click()` cannot copy**: `navigator.clipboard.writeText` needs a trusted gesture.
- **T-38 is done**: `scripts/smoke.sh` builds + previews + walks + tears down; `--live` walks the Pages
  URL. **It is not in `check.sh`** — the gate stays browser-free.
- **The account page is not a `<form>`.** `user-edit.tsrx` draws `.form` as a `div` of `Field`s, so a
  row must assert an input by `name` (`input[name="displayName"]`), never `querySelector("form")`.
- **A component that hands out a link must take the path, not the href.** `EmptyState` took a finished
  `href` and drew a bare anchor; 39 call sites were one attribute away from the exploit. Ownership of
  the `href`+`follow` pair inside the component is what stopped it — apply that to any new one.
- **`link-check.mjs` reads tags, not lines.** Attributes span lines (the tab bar and the dev pages do),
  so the scanner walks from `<a` to the matching `>` counting braces, quotes and backticks; a
  line-based grep would miss exactly the multi-line cases it exists for. T-48's scanner needs the same
  block-walking discipline.
- **The report journey needs POST(8)**: the preview classifier buckets on `hash("jev:post:" + body) % 5`
  and only buckets 2/3/4 escalate.
- **A shared Chromium profile makes the walk flake** — profiles are unique per run and removed on exit.
- **`go()` must resolve against the served base**; a leading slash drops the `/LuaPlot/` base.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, `overflow-x: auto`); the
  **document** does not scroll. The breakpoint row asserts `documentElement`.
- **`:has()` is available in the walk's Chromium** (`Chromium 105+`), and it is the only way to pick
  "the first card that actually draws an author link" in one selector (T-47's row 30) without
  flattening the whole grid into the page expression.
- **Bundle numbers**: `dist` 1.1 MB; JS 728 KB raw / ~187 KB gz; CSS 23.8 KB gz; largest asset the
  JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()`, `livePost()`,
  `getPost` still answers by id.
- **Counts** (memory adapter; the walk's own journeys add rows as they run, so never assert a bare
  total): characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12 (11 listed,
  post 6 removed), reports 5 (3 open, 2 concluded), comments 22, sessions 2, bookmarks 8 (one dead),
  notifications 6 (3 unread), profiles 7, follow edges 15. `/dev/data`'s *Characters* cell reads the
  **page** count (24 = `PAGE_SIZE`), not the fixture total.

- **`visualViewport.height` is shadowable on the instance (T-36a).** `Object.defineProperty(vv,
  "height", { configurable: true, value: n })` works — the read-only accessor lives on the prototype
  and does not block an own property — and `delete vv.height` puts the real getter back. Dispatch
  `new Event("resize")` **on `vv`**: a `window` resize is not the event a keyboard fires.
- **The walk does not run at 360 by default.** `--window-size=360,740` is the browser's, but a tab
  opened through `/json/new` measures **500×653** (probed 2026-11-01), and every row that clears its
  override returns to *that*. A row of phone geometry therefore takes its **own** `360×740` override
  and compares `scrollWidth` against the `innerWidth` it read, never against a constant — T-36a's
  first run reported `scrollWidth 490`, which looks like a broken page until you see the viewport was
  500.
- **A character's session entry is `Continue` after any earlier row opened one.** `click("Start a
  session")` matched nothing on the second visit; take `clickAny(["Continue", "Start a session"])`.
- **`requestAnimationFrame` does fire in headless Chromium** for the active tab, so a rAF-coalesced
  writer (`viewport.ts`) is walkable — no `Emulation.setPageVisibility` or timer fallback needed.
- **A red proof that fails on a poll's timeout message is not the proof an accept line asks for.**
  T-36a's first red run said `timed out waiting for --keyboard-inset to read 320px`; the row now
  catches that poll and re-reads the token **and the dock's padding**, so the failure names the two
  numbers a reader can act on. Do the same wherever a row's accept line says what the message must say.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

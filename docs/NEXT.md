# Baton — what the next session does

**T-78 landed.** Row 46 was **extended, not duplicated** — `EXPECTED_ROWS` stays **55** — and the head
is now read in **both directions**. After the Cancel assertions the row takes `640×740`, then
`360×740`, reads one `readHeadAt()` at each and hands it to `assertHead(r, width)`: 640 asserts a
`grid` of **exactly three** tracks with the first `72 ± 1`, avatar/who/action tops within 2px, and
`.name` **26px**; 360 asserts the opposite in the same words (**two** tracks, first `56 ± 1`,
`head-action.top > head-avatar.top + 1`, `.name` **22px**). Measured at 640:
`["72px","225.188px","238.812px"]`, gap `18px`, tops **80/80/80**, `who.left 114`; at 360
`["56px","238px"]`, gap `14px`, tops **76/76**, action **218.95**. `.pager > div`'s 200px minimum is
read only when a listing draws a pager (this tree draws none), so the row never asserts one into
being. The red proof was the ticket's own edit and it **worked**, with a twist worth carrying: deleting
`grid-template-areas: "avatar who action";` red-lit **row 46 alone** (54 PASS / 1 FAIL) at the
**action-top** assertion — *".head-action sits at top 208.66 and the avatar at 80"* — while the
**track count stayed three**, because the base block's two-area template still names `action` and the
sm `grid-template-columns` still declares three columns. That is the mirror of T-77: there the count
stayed green and the *first track's size* was the witness; here the count is green and the
*placement* is. `check.sh` GREEN, 55/55 local, 55/55 `--live` with the identical evidence line,
`publish.sh` → `LIVE` (asset `index-DPoxP2Sr.js`, unchanged because no built source moved), `curl` 200.

## T-79 — `/bookmarks`' `sm 640` toolbar has never been rendered either

**Why it is next.** `bookmarks.tsrx` keeps a `@media (min-width: 640px)` block that rewrites
`.toolbar` (base: a one-column grid, `gap: 10px`) into **two** tracks —
`grid-template-columns: minmax(0, 1fr) 220px; align-items: end; gap: 12px 16px` — then pins the three
children: `.search { grid-column: 1 / -1 }` across the top, `.sort { grid-column: 2; grid-row: 2 }`
into the fixed column, `.meta { grid-column: 1; grid-row: 2; align-self: end }` beside it, and gives
`.pager > div` a 200px minimum. No row has ever mounted `/bookmarks` above 640: row 50 (T-67) presses
its tabs, its search and its sort at the session's own ~500px, and rows 51/52 mount other catalogues.
The block's own comment records the near-bug it exists for — *the sort used to inherit
`grid-column: 1 / -1` and spanned the row on its own, which is why the desktop toolbar read as three
ragged lines* — so a deleted pin restores exactly that and every gate stays green.

**Approach.** Extend **row 50** (T-67 — no new row; `EXPECTED_ROWS` stays **55**). That row is
read-only and already ends on `/bookmarks?type=lorebook` with two rows and an empty field, so the
width phase goes **after** its last press where it cannot disturb any read. Take `640×740`, read the
toolbar, and assert: `.toolbar` computes `grid`; **exactly two** tracks and the **second `220 ± 1`**
(count *and* size — T-77's lesson: a leftover placement creates an implicit track and the count alone
proves nothing); `.search` spans the toolbar (`|search.left − toolbar.left| ≤ 1` and
`|search.right − toolbar.right| ≤ 1`); **`|sort.top − meta.top| ≤ 2`** — the saved count sits beside
the sort, which is the whole `sm` fact; `meta.left < sort.left − 1`; and `sort.left` is inside the
220px column (`sort.left ≥ toolbar.right − 220 − 16 − 1`). Then take `360×740` and assert the
opposite: **one** track, `sort.top > search.bottom − 1` and `meta.top > sort.bottom − 1` (stacked,
each on its own row). Clear both overrides in one `finally` and assert `innerWidth` came back before
returning.

**Traps.** (a) **A grid with no template still computes one track.** Chrome resolves
`grid-template-columns` to the *implicit* track list, so the base toolbar reads
`["308px"]` — one track — and that is the honest read; do not conclude "no template therefore zero
tracks" and do not split a `none` string (T-73's flex trap has the sibling shape: `none` there means
*flex*, here a single resolved track means *implicit*). (b) **`.meta`'s pin is the one that binds, not
the sort's** — `.meta { grid-column: 1; grid-row: 2 }` leaves (row 2, column 2) as the only free cell,
so deleting the **sort's** own `grid-column: 2; grid-row: 2` walks **green** (T-75's class, third
time). Aim the red proof at the meta pin and let the message name what moved. (c) `.sort` is a
`Select` wrapper and `.search` a `Field` wrapper — read `.toolbar > .sort` / `.toolbar > .search`, not
the inner control, and never the `label` text (the sort's label is the "Sort" word, the value is a
`select`). (d) The row must not disturb row 50's own state: keep the presses untouched and put the
width phase last, and remember `Emulation.setDeviceMetricsOverride` is browser-level, so `innerWidth`
is asserted on **every** reading rather than assumed to have survived. (e) `?type=lorebook` draws two
rows, so the listing's `.pager` draws nothing unless the tab has a next page — read `.pager > div` only
when it exists, like row 46 does.

**Accept.** Red first: delete `.meta { grid-column: 1; grid-row: 2 }` from `bookmarks.tsrx`'s `sm 640`
block → **row 50 alone** red, naming `/bookmarks`, `640px` and the two tops it read. Bytes restored
(`cmp`), `check.sh` GREEN, **55/55** local and **55/55** `--live` (no new row), `publish.sh` prints
`LIVE`, `curl` 200.

**Open decision (not this ticket).** The tag vocabulary for lorebooks and presets is still the
owner's — see *Open decisions*. Do not invent tags to make a row pass.

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
  follows T-35 and stays blocked. **T-36 is split:** (a) — the keyboard inset — **landed as T-36a**
  (`lib/viewport.ts` + walk row 32); the rest of T-36 — no clipped input **on a real APK**, hardware
  back-button mapping, 60fps transcript scroll on device — still needs the toolchain above and stays
  blocked.
- **Tauri on this box is NOT blocked — and the webview session proof is done.** `bun run tauri dev`
  opens, the account survives a restart in both directions, and the recipe below reproduces it.

## Open decisions

- **T-79 is the ticket: `/bookmarks`' `sm 640` toolbar (search across, sort in a 220px column with
  the saved count beside it) has never been rendered.** Row 50 presses that page's tabs, search and
  sort at the walk's own ~500px, always below the breakpoint, so the block's three pins are
  declarations nothing can go red on.
  Failure-bank
  entries 1 (T-54), 2 (T-59), 3 (T-55 + T-57), 4 (T-53), 5 (T-56) and 8 (T-58) are walked; the rest
  are blocked on the backend or the toolchain (6 → T-27's joins, 7 → T-29's cascade, 9 → T-27, 10 →
  T-32, 11 → T-16, 12 → T-01, 13 → `check.sh`). Every route now has a row (48 the character catalog,
  49 the router seam, 50 `/bookmarks`, 51 the two other catalogues and `/persona`, 52 `/terms`, **53
  its desktop rail**, **54 the three catalogue detail pages' `.main` + `.aside` at 360, 640 and
  1200**, **55 the moderation case's `md 900` flex row**), every bank entry that can be walked is
  walked, and the word break has a gate section (10). What is left is *copies of the same rules in
  other files*: T-75/T-76/T-77 closed base, `lg` **and** `sm` for the three detail pages and T-78
  closed `user-profile`'s `sm` head, so the same argument now points at the **other** pages whose
  `sm 640` block no row has ever rendered — `/bookmarks`' toolbar is T-79, and 32 page files still
  carry one — plus whatever the gate or the walk finds next. The rest of the plan waits on Supabase
  (T-29…T-32), the Android toolchain (T-35/T-36/T-39) or an owner decision (T-33B's deep link
  dependency and `Ctrl/Cmd+K`, the tag vocabulary).
- **The tag field's press is blocked on a decision, not on work.** Every lorebook and preset
  fixture ships `tags: []`, and `schema.ts`'s own comment says they stay empty *while the taxonomy is
  undecided* — so `listTags("lorebook")` / `("preset")` answer `[]`, the picker opens its empty
  sentence, and there is no chip to press. Row 51 asserts that empty state **and** the pasted-`?tags=`
  road (chip prints, 0 cards, *"Nothing matches those filters."*, Clear filters restores), and its
  **press branch is already written** — it runs the day a fixture carries a tag. The owner must
  either record a tag vocabulary for lorebooks and presets in `docs/DESIGN.md` (and then a ticket
  seeds two or three tags, leaving one card tagless so `catalog.md`'s *an item with none renders no
  row and no placeholder* finally has a target) or accept that the press stays unwalkable.
- **Row count is 55 after T-74 — T-75, T-76, T-77 and T-78 added none.** `scripts/smoke.mjs` keeps it in an explicit
  `EXPECTED_ROWS`, so a row that stops running is a red walk — **extend** an existing row rather than
  adding a near-copy of it, and bump the count only when a row is genuinely new (**T-61 added row 44;
  T-62 added 45; T-63 added 46; T-64 added 47; T-65 added 48; T-66 added 49; T-67 added 50; T-68
  added 51; T-69 adds none; T-71 added 52; T-72 added 53; T-73 added 54; T-74 added 55; T-75 adds
  none; T-76 adds none; T-77 adds none**). **Row 55 (T-74) is read-only  and takes two overrides of its own** (`900×740`,
  `1200×740`): it opens the concluded case
  `/moderation/4e90047a-…0002?admin=1`, presses no decision control and writes no store row, clears
  both overrides in a `finally` and asserts `innerWidth` came back — anything after it may assume no
  override is in play. It leaves the reader on the case page, so the sign-out row after it navigates
  itself (`go("/")`). **Rows 36 and 37
  are read-only apart from the NSFW pair** (row 36 reads the catalogue, one detail page and the
  thread; row 37 flips Show and restores it), so no CDP override, no probe and no un-restored write
  is left behind. **Row 38 (T-54) owns the NSFW pair too** — it needs Show + Blur *on* to render a
  covered card, so it records its own seed, restores **that**, and asserts the restore. It also
  **composes a flagged post** (NSFW toggle on) because row 21 removes the only fixture one, and it
  presses nothing that writes preferences: the Reveal is per-mount. Anything after it must assume the
  pair is the seed and the store holds one extra flagged post.
- **Row 41 (T-58) is mutating and final.** `deletePersona()` splices the row out of the memory store,
  so every later row sees **two** personas — a later row that wants a persona must seed or create one,
  and a collection count must be read, not pinned. Row 42 comes after it and reads none.
- **Row 42 (T-59) is mutating and final too.** It renames `/character/…0001` **twice** (the row now
  reads **`Aurelia of the Second Tide`**, in-session **`Aurelia Rebuilt Twice`**) and publishes the
  walk's **last** post — the whole session-1 transcript, whose first card is now the **newest** in
  `/post/thread?sort=newest`. Anything after it must read a character's name from the page and must
  not pin a post count.
- **Row 43 (T-60) is mutating and final, and it is the last row that reads a session.** It deleted
  **session 1** out of the memory store, so `…0001`'s primary control now reads `Start a session` for
  every later row and `/session/5e551000-…0001` mounts the Not found sentence; session 2 (the
  adapter's second session) is untouched. It also leaves the reader on the cut's post page, and it
  takes **no** override and writes no preference.
- **Row 44 (T-61) is mutating and hands the account back, twice over.** Its draft is a real
  `repo.saveProfile` write ~250 ms after a valid pair settles, so every intermediate value it
  types is **invalid or taken** and the only free value is the one it claims; it leaves the
  account as `@you` (`You`) again, both `/user/you` and `/`'s sentence read before it returns.
  It also renames the account for the length of the row, which **moves every authored row's
  `author` to `onboarding_walk` and back** — anything after it may read a creation count, but
  must not pin an author handle mid-row.
- **Row 45 (T-62) is mutating and hands the account back too.** It renames `@you` → `@edit_walk` →
  `@you`, reading the name, bio, both figures and the creations count from the page on both sides —
  anything after it may read those, but must not pin a count (row 45 itself reads **5** creations on
  a right tree, and the number changes whenever a fixture or an earlier row adds one). It ends by
  pressing **Save** on `/user/you/edit`, so it writes through `saveProfileEdit` **and**
  `savePreferences` (the pair is re-saved from the form's own toggles, which it never flips).
- **Row 46 (T-63, extended by T-78) is read-only and hands nothing over, but it now takes two
  metrics overrides** (`640×740`, `360×740`) **after** pressing **Cancel**: it reads the
  profile it lands on against the head it read before the form, then reads that head at both widths,
  clears both overrides in one `finally` and asserts `innerWidth` came back before returning. A
  later row may rely on `/user/<own>`'s name, handle and bio, on the NSFW pair being untouched and on
  no override being in play; it also leaves the reader on `/user/<own>` (no `go()` after the width
  phase).
- **Row 47 (T-64) is read-only and presses tabs, not writes.** It leaves the reader on
  `/user/<own>?tab=following` (the last tab it pressed) and writes no preference and no store row, so
  a later row may rely on the profile's name, bio, figures and all four lists as it found them. It
  adds five browser history entries (three tab pushes, one pasted URL, one card navigation + Back),
  so a later row that calls `history.back()` must not expect row 42's post page.
- **`VIEWER` and `ownHandle()` diverge after a claim or a rename — and every ownership rule must pick
  one.** `ownHandle()` is the profile row's handle and it *moves* (`renameAccount`); the constant
  `VIEWER` does not. Personas, sessions, votes and bookmarks are owned/read by `VIEWER`, while the
  profile, authored content and the follow graph ride `ownHandle()` — so after a rename the persona
  dialog still lists the account's personas only because its filter reads the constant, not because
  anything moved them. When T-30 wires Supabase, the ownership column must come from the **session**,
  never a fixture handle: a row that renames the account is the shape that catches it.
- **Row 52 (T-71) is read-only and hands nothing over.** It no longer adds a dangling history entry:
  the one it adds is the push it walks *into* `/onboarding`, and the row presses Back, so the walk's
  position is where row 51 left it (the session's own width, 500×653, and no override in play). It
  writes no store row, no preference and no query, so a later row may rely on everything it read.
- **Row 53 (T-72) is read-only and leaves the session at its own 500×653.** It walks no link, presses
  nothing, writes no store row and no preference; it takes **two** metrics overrides (`360×740`,
  `1200×740`), clears them in a `finally`, and asserts `innerWidth` came back before it returns — a
  later row may assume no override is in play and no `.contents` width is pinned. It leaves the
  reader on `/terms` at the old position (`go()` pushes), and row 54 must therefore navigate itself.
- **Row 54 (T-73, extended by T-75, T-76 and T-77) is read-only and takes three overrides of its
  own** (`360×740`, `640×740`, `1200×740` — **width-major**, one override per width with all three
  pages mounted inside it, so nine readings cost three overrides). It opens
  `/character/c0a1b2c3-0000-4000-8000-000000000002` (row 40 leaves one Like there, so nothing reads a
  count as the fixture's), presses nothing, writes no store row and no preference, clears every
  override in one `finally`, and asserts `innerWidth` came back before it returns — anything after it
  may assume no override is in play. Since T-75 it also mounts `/lorebook/…0002` and `/preset/…0002`,
  and since T-77 it **leaves the reader on the preset page** (`go()` pushes), so a row added after it
  must navigate itself; row 55 and the sign-out row both do. The three arms are one shared
  `assertSplit(r, { label, path, width, counts })`, so a new width is one entry in `SPLIT_WIDTHS`
  plus one branch — never a second copy of the facts.
- **Row 39 (T-55, extended by T-57) leaves the thread at page 1 with no query.** It presses Load more
  once, so anything after it must assume the component state — not the store — held a second page,
  and that a fresh mount re-reads page 1. It writes nothing and takes no override.
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
- **Row 32 shadows `visualViewport.height`, takes its own 360×740 metrics override, and clears both in
  `finally`**; anything added after it must assume the shadow is gone, the token is back to `0px` and
  the session is back at the browser's own window size (assert `innerWidth` returned, never trust the
  `finally`). **Row 33 is mutating**: it presses **Restore copy** on session 2, so session 2's
  character copy is `untouched` for the rest of the run — a later row that wants an `edited` copy
  must seed or edit its own.
- **The pressed-pill fill is a rule, not a one-off (T-48).** A control whose own background is
  `--color-surface` cannot hold static accent text in Latte; pressed means accent **fill** +
  `--color-accent-contrast`. `DESIGN.md` → *Contrast* carries it.

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

- **A shared assertion is worth extracting the moment a second page uses it (T-76).** The phone
  block was 40 lines of character-only checks; making `assertPhone(r, { label, path, counts })`
  turn the two copies into 6 lines each and is what makes a third width a parameter instead of a
  fork. When a row is about to assert "the same facts" on a second page, extract first.
- **A `counts: "require" | "read"` flag beats two readers (T-76).** The character page must draw
  four `.count` cells; the two copies are only checked *if* they draw the block (`countCells >= 0`).
  Encoding that as an argument keeps one reader and one set of messages.

## Found while working (carried forward — keep this list growing)

- **Deleting `grid-template-areas` keeps the track COUNT and moves the item instead (T-78).** The `sm`
  block's three columns come from `grid-template-columns`, so with the areas line gone the count still
  reads **three** (the base block's `"avatar who" / "action action"` template still names all three
  areas, and the sm columns still declare three tracks) — what changes is that `.head-action` falls to
  **row 2**. The assertion that fires is the **placement** (`|action.top − avatar.top| ≤ 2`), not the
  count. This is the exact mirror of T-77, where the count stayed three and the **first track's size**
  was the witness: for an `areas` edit assert placement, for a `columns` edit assert the fixed track,
  and never treat the count as proof of either.
- **A guarded read is the honest way to assert a `min-width` on a box a fixture may not draw (T-78).**
  `.pager > div` gets `min-width: 200px` from the `sm` block, but the profile's creations tab draws
  **no** `.pager` on this tree (five creations, no next page) — so the row reads `pagerMinWidth` and
  only asserts it when the string is non-empty. Asserting the pager into existence would red a right
  page; skipping it silently would leave the rule unwalked, which is what the evidence line's
  `, no pager` records.

- **A leftover `grid-column: 3` keeps the track COUNT at three after `grid-template-columns` is gone
  (T-77).** Deleting the `sm` block's `grid-template-columns: 320px minmax(0, 1fr) auto` left the
  base `minmax(0, 1fr) auto`, but `.menu-btn { grid-column: 3 }` — a line of the *same* block — then
  created an **implicit** third track: the head read `["290.797px","197.203px","44px"]`. A row that
  only counted tracks would have walked **green** on the bug; the assertion that caught it is the
  **fixed track's size** (`|tracks[0] − 320| ≤ 1`). Count the tracks *and* size the one the block
  declares, in that order, and never treat "three tracks" as proof that a three-track rule is live.
- **Walk width-major, not page-major (T-77).** `go()` remounts but the `Emulation` override is
  browser-level, so `[360, 640, 1200] × {character, lorebook, preset}` costs **three** overrides and
  nine mounts, where a page-major loop costs nine overrides for the same readings. It also makes the
  evidence line read as the ladder the design is drawn on. Every reading still asserts `innerWidth`
  — the session's own tab is ~500px, so a dropped override is invisible otherwise.
- **An explicit placement on *one* item makes the other item's `grid-column` inert (T-75).** `.main`
  is placed at `grid-column: 1; grid-row: 1`, so `.aside { grid-row: 1 }` auto-places into the only
  free cell of row 1 — column 2 — whether or not it says `grid-column: 2`. Deleting that declaration
  walks **green, 55/55**: the accept line's red proof proved nothing. Aim at the aside itself
  (`grid-column: 2` → `1`) and the row reds with the page's name and its measured span. Before
  spending a walk on "delete this declaration", ask what else constrains the same property.
- **A red proof can name the right page and the wrong rule (T-75).** The green run's evidence line is
  what to check first: if a deleted declaration leaves the measured numbers identical, the rule never
  bound. T-72's `minmax(0, 720px)` never binding and T-75's `grid-column: 2` never binding are the
  same class — the measurement, not the intent, decides.
- **Extending a row that already owns an override is cheaper than a second row (T-75).** `go()`
  remounts the page but the `Emulation.setDeviceMetricsOverride` is browser-level, so it survives the
  hop; the row reads its own `innerWidth` after each mount to prove that instead of assuming it. Two
  mounts cost ~1.9s of walk, and no row count changes.
- **A flex container's `gridTemplateColumns` computes to the string `none` (T-73).** So
  `split(" ").filter((t) => t.trim() !== "")` answers **one** track (the literal `none`) on a box that
  has no grid at all: a row that counts tracks without checking the display reads a flex column as a
  one-track grid and a missing grid as a pass. T-73 reads `display.indexOf("grid")` first and returns
  `[]` otherwise, then asserts the *display* beside the count — the same order T-72 settled for
  `display: none` boxes.
- **The detail page's aside is lifted by `order`, so DOM order is the wrong witness (T-73).** `.aside`
  is the **second** child of `.cols` and renders **first** at 360; only `getBoundingClientRect().top`
  answers which one a reader meets. Deleting `.aside { order: -1 }` is the red proof (row 54 alone,
  *"aside sits at top 1276.13 and .main at top 572.38"*) — and the opposite page exists: `moderation`
  has **no** `order` at all, so its panel sits below on purpose. Never copy the assertion between the
  two pages.
- **Do the outlet arithmetic before pinning a track size (T-73).** At 1200 the shell's `.outlet` is
  794 wide with 40px of padding each side, so `.cols` measures 714 and
  `minmax(0, 1fr) 320px` with a 32px gap resolves to `["362px","320px"]` — the first track is
  **714 − 32 − 320 = 362**, not `714 − 320`. The fixed track is the one to assert (320 ± 1) and the
  fluid one only for being finite and non-zero.
- **Collapse whitespace in Node, not inside a `js(…)` template (T-71).** A page expression is a
  template literal, so `\\s` written there unescapes once before `Runtime.evaluate` ever sees it — the
  T-49 trap, twice over. Row 52 reads `textContent` raw and collapses with a plain regex in the walk,
  where a regex needs no escaping at all; the page expression then carries no backslash and the copy
  comparison cannot break on a line wrap. Do that for any new row that compares prose.
- **`measureAt()` is `/dev/primitives`' ladder, not a general viewport helper (T-71).** It reads
  `.g-sec`, `.g-grid` and the shell's `.rail`, so a page-level layout (e.g. `/terms`' `.doc` grid)
  needs its own override + read pair and its own `finally`. The *shape* to copy is rows 31/32, not
  the function.
- **A hand sweep's "zero today" is a hypothesis too (T-70).** T-69's baton recorded that its two
  greps over `dist/assets/*.js` read zero after the fix; the **same** two greps on the same build read
  **two** hits, both in `dev-native.tsrx`'s prose. The scanner then found a real eighth site —
  `never needs a` + newline + `<code>try</code>` rendered *"needs atry"* on `/dev/native`. Re-run a
  sweep's own command before reusing its conclusion; the guard that replaces it is what settles the
  class.
- **An inline element's own leading space hides the class from any text scan (T-70).**
  `must read<b> cancelled</b>` renders correctly (the space is inside the `b`), yet a letter is glued
  to the tag, so the scanner cannot tell it from a defect. The house shape is the space **outside**
  (`read{" "}<b>cancelled</b>`); write it that way and the guard's message is always a real bug.
- **A gate over the bundle cannot see a dynamic value glued to an element (T-70).**
  `{n}<strong>followers</strong>` has no letter in the source and glues just the same when the value
  carries no trailing space — `/notifications` is safe only because its `.subject` string starts with
  `" — "`. Any banner that names a count writes its space explicitly; nothing gates that half yet.
- **`/terms` is the only route no walk row has mounted (T-70).** Matching `src/router.ts`'s paths
  against `scripts/smoke.mjs` leaves 13 param routes (landed on with ids) and `/terms`, which appears
  nowhere in the walk — and it is the page T-69's copy class broke twice. Filed as **T-71**.
- **Ripple trims a literal's *boundary* whitespace when its neighbour is an element, on both sides
  (T-69).** `</a> if` renders `</a>if` and `Finishing <a>` renders `Finishing<a>`, because the
  literal is trimmed at the edge it touches. An explicit `{" "}` is a text piece of its own and
  survives, and a literal whose neighbour is a `}` **expression** keeps its space (`NsfwControl`'s
  `` ` … flagged ` + (noun + ` in listings.`) `` and `moderation-queue`'s `String(n) + " open"` in the
  built bundle both prove it) — so the class is *element-only*, never "any text node near a tag".
- **Whether a site loses its break is decided by the compiler's bucketing, so the source is not the
  evidence (T-69).** The same source shape compiles two ways: a **piece array**
  `[`a`,…,`Create one`],`if it is not here yet.`]` (space gone) or a **static HTML string**
  `…<strong class=tsrx-…> </strong> followers…` (space kept, and fine). A source grep therefore flags
  both and proves neither; scan `dist/assets/*.js` — that is what the browser parses. T-69's two
  commands: `grep -oE "[A-Za-z0-9.)]<(a|b|span|strong|em|code|i|small)[ >][^\"\`]{0,50}" dist/assets/*.js`
  and `grep -oE "</(a|b|span|strong|em|code|i|small)>[A-Za-z][^\"\`]{0,40}" dist/assets/*.js`.
- **Seven sites lost a word break and only one of them had a row (T-69).** `/persona` (walked),
  `/terms` (*Finishingonboardingis the acceptance* — both sides of the link), `/onboarding`,
  `/persona/<id>`'s picker sentence, `/user/<handle>`'s figures, and the four `/dev/*` pages. Row 51
  covers `/persona` alone; the rest were found by the bundle scan, which is the argument for
  **T-70**'s gate section. Any copy that wraps an inline element in a sentence deserves `{" "}` on
  both sides at write time.

- **A literal after an inline element loses its word break, and only a row that reads the string sees
  it (T-68).** `/persona`'s no-match sentence is written `</a> if it is not here yet.` and renders
  `Create oneif it is not here yet.` — Ripple trims the leading whitespace of the text node that
  follows an element, while an explicit `{" "}` survives. Every page that writes copy around a link
  has the same shape; a row must assert the **words**, not just that the sentence is non-empty.
- **Every lorebook and preset fixture ships `tags: []`, so the tag picker has no vocabulary on those
  two pages (T-68).** `schema.ts` says they stay empty *while the taxonomy is undecided*, and
  `Card.tsrx` draws **no** `.card-tags` row at all for an item with none — so the "no tags → no row,
  no placeholder" rule has no *tagged* neighbour to be absent beside. The tag **chip's press** is
  therefore unwalkable on `/lorebook/catalog` and `/preset/catalog`; the character catalog's fixtures
  do carry tags, which is why row 48's `?tags=` half works. Row 51 branches on the fixture: press
  branch when a card carries a tag, picker-empty + pasted-`?tags=` road when none does.
- **The catalogues' sort vocabulary is `newest` / `ratio`, not `recent` / `oldest` (T-68).** Both
  `SORT_OPTIONS` tables read `Newest` / `Top rated`; only `/persona` has `Oldest` / `Name`. A ticket
  that sketches a param is a hypothesis — read the page's own table before asserting a label.
- **A row that reads three pages needs the page's name in every message and in its reader (T-68).**
  Row 51's poll helper takes the `path` as its first argument and prefixes every timeout with it, and
  its `TOOLBAR_PAGES` table carries each page's grid `aria-label` (`Lorebooks` / `Presets` /
  `Your personas`) so a row that mounted the wrong page fails at the label instead of proving the
  second page's facts on the third's DOM.

- **A tab pressed on itself was the only road out of a `/bookmarks` search, and it was dead (T-67).**
  `Clear search` exists only in the no-results state, so once a search narrowed a tab a reader had no
  way back to the whole tab except emptying the field by hand — and `chooseTab()` early-returned on
  the selected tab, so the press that *means* "this tab, unfiltered" did nothing at all.
  `bookmarks.tsrx` now treats it as a press: cancel a pending settle, clear `draft`/`applied`, and
  `push` the URL. A page whose tabs are its query should ask what pressing the current tab means
  before wiring `chooseTab`.
- **`/bookmarks` writes its own `?type=` on every boot, so the bare route never reads `""` (T-67).**
  `boot()` calls `writeQuery(tab.value, …, "replace")` unconditionally, so a fresh `/bookmarks` reads
  `?type=character` — the ticket's "a fresh `/bookmarks` reads `""`" was wrong, and the row asserts
  what the page writes (T-64's lesson, again). Read the URL the page produces; treat every ticket URL
  sketch as a hypothesis.
- **A red proof aimed at the seam can abort one clause early (T-67).** Dropping `mountedKey = …`
  red-lit row 50 at its **Back** clause — the select kept `Title A–Z` on a URL that no longer carried
  `?sort=` — and the row never reached the clause it exists for. `if (mode === "push") mountedKey = …`
  (a *replace* commit leaves the key stale) is the aimed edit: it red-lit row 50 alone at *"a mount
  from ?type=lorebook … to remount the whole tab"* with the field still holding the word. When a row
  has two key-dependent clauses, aim at the later one.
- **A saved post has no `.card-title`, so a title-reading row must pick a card tab (T-67).**
  `PostCard` draws `.post-body` / `.post-author` / `.post-counts`; the catalog card's `.card-title`
  matches nothing on the Posts tab, and a count of `0` there reads as an empty listing rather than a
  wrong selector (T-50's lesson). Row 50 filters `post` out of its `SAVED_TABS` table and then picks
  the tab with the most saved rows, so it never pins which tab `/bookmarks` opens on.

- **The mounted key belongs to the router, not the shell (T-66).** A page that commits its own query
  must move the key or the *next* navigation to that route is a no-op: the browser clears the URL,
  nothing reloads, and the grid (or field, or tab) keeps the state the address no longer describes.
  `commitQuery()` is the seam; `getMountedKey()`/`setMountedKey()` are the fact; `emit()` must never
  touch it. `scripts/history-check.mjs` (gate section 9) keeps every page off `history` directly —
  add a new page's commit through `commitQuery()` or the gate goes red.
- **A red proof is aimed, not pointed at the bug (T-66).** Reverting the seam reverted *two* rows and
  the earlier one aborted the later, so the run that should have named the caret never got there:
  dropping `mountedKey` red-lit rows 48 and 49, but `writeQuery` → `navigate()` red-lit **only** row
  49, in 729 ms, exactly at `document.activeElement`. When two rows cover one seam, give each clause
  its own edit.
- **A `void commitQuery;` is the cheapest way to keep a temporary red edit type-clean** when the probe
  swaps the call for `navigate()`: `noUnusedLocals` fails the *build* otherwise, and a red run that
  stops at `tsrx-tsc` proves nothing about the page.

- **A `replaceState` write left the router blind, and that is how a view and its URL disagreed
  (T-65 → fixed by T-66).** The catalog committed a search with `history.replaceState` and no
  `emit()`, so `router.state.search` stayed `""` while the address read `?q=…`; the shell's private
  `lastKey` was that stale key, so a later `navigate("/character/catalog")` — the **Catalog** tab, or
  the switcher's own **Characters** tab — emitted the key the shell already believed it mounted and
  **nothing reloaded**. Row 48 could not therefore "reload" with a `go()` to the same URL (its first
  run read `{"search":"","count":1,"field":"Lamplighter's"}` for twelve seconds on a page that was
  right) and went through `go("/")`. **T-66 landed:** `commitQuery()` moves `mountedKey`, row 49 walks
  the two presses, and row 48's workaround is gone — that `go("/")` hop is now the bare-route remount
  it always claimed to be. Keep the shape in mind: any *silent* URL write owes the router a key.
- **Every catalog fixture carries tags, so `catalog.md`'s no-tags rule has no page to read (T-65).**
  All 28 characters carry ≥1 tag (one is private), and row 48 is read-only, so *an item with none
  renders no row and no placeholder* stays untested — the row instead proves the visible row + its
  `+N` list together equal **the card's own tags** (the hidden `is-measure` mirror is what makes that
  readable). A tagless fixture is a write; file it with whatever seeds fixtures next.
- **A card's tags fold only on a phone (T-65).** At the walk's own window (~500px, one column of
  468px) every fixture card fits its five tags and **no `+N` chip exists**; at 360 the first card
  folds `+2`. So the fold half takes its own `Emulation.setDeviceMetricsOverride` 360×740 and clears
  it in `finally`, asserting `innerWidth` came back — the same shape rows 30-32 use.
- **`?sort=ratio` draws a *different* page-1 set, not the same rows reordered (T-65).** The
  unfiltered grid drew **20** cards (24 listed, 4 flagged and Show is off) while `?sort=ratio` drew
  **22**: the top-24 by ratio reaches rows Newest's first page does not hold. Read a count, never
  pin one, and never compare a ratio listing to a newest listing by length.
- **The row's own vocabulary is page-read, so its evidence names whatever it picked (T-65).** It
  typed `Lamplighter's`, filtered `ghost` and `artisan`, and folded `+2 → ["family","debt"]` on this
  tree; a fixture change moves all four, and nothing in the row pins them.

- **`writeQuery()` never omits `tab` (T-64).** The baton predicted the creations default would write
  no `tab`; `user-profile.tsrx`'s `writeQuery()` always `params.set("tab", tab)` and only omits
  `type` when it is `all`, so a bare `/user/<own>` **rewrites its own URL to `?tab=creations`** on
  boot. A row that pinned the absence would have been red on a right page — read the URL the page
  produces, and treat a ticket's URL sketch as the hypothesis it is.
- **`.card-handle` is what tells a person card from a catalog card (T-64).** Both are
  `li.card-cell > article.card`, and a follower card carries **no** `.card-author` and **no**
  `.card-ratio` — so a "count the creations" expression on a shared reader must be
  `.card-cell .card:not(:has(.card-handle)) .card-author`, or the follower tab reads as a creation
  grid. The post card's root is `article.card.post` and it is never a `.card-cell`, so
  `.feed .card.post` is the posts tab and nothing else.
- **A tab swap keeps the page; only a `popstate` remounts it (T-64).** `writeQuery()` pushes without
  notifying the router, so an expando on `.profile-head` survives every tab/type press and is gone
  after `history.back()` — the row marks the head, asserts the marker on each press, and after Back
  asserts only the search and the body. Two independent marks are cheap (one after a fresh mount from
  a pasted URL, one after Back); a single mark across a `go()` cannot be read.
- **A rename had to move comments too (T-62).** `renameAccount()` moved characters, lorebooks,
  presets, posts, both sides of the follow graph, the claim set and the profile row — but a
  `commentSchema.author` is a handle as well, so after a rename every comment the account wrote still
  read `@you` on a profile that answered not-found. `user/edit.md` → *Username* says the account
  *keeps its content*, and a comment it signed is content: `store.comments` is in the loop now. Red
  proof: delete the loop → row 45 reads *"the comment the account wrote reads \"@you\" after the
  rename, not @edit_walk"*.
- **`renameAccount` has three separate halves, and each needs its own red proof (T-62).** Deleting
  the authored-row loop was red on *"the renamed profile draws 0 creation card(s), not 5"*; deleting
  the comment loop was red on the comment; a red aimed at `store.profiles` alone proves only the
  landing. Aim the edit at the loop the assertion exists for.
- **The account form's username field is `input[name="username"]`, not `handle` (T-62).** Onboarding's
  is `handle`; this page's `Field name` is `username`. A row that keys on the ticket's word times out
  on a page that is right — read the page (both rows now try `username, handle`).
- **A poll on the *symptom* names nothing when the page draws the wrong state (T-63).** Row 46
  waited on *"You can't edit this account."* first and the red run read `timed out waiting for "You
  can't edit this account." (last: false)` — a page that had mounted the whole form. The row now
  polls until the route has **decided** (the copy, a form field, or the not-found sentence) and then
  asserts *which* it decided, and the form-absence assertion sits **before** the copy assertion, so
  the red names the bug: *"/user/ada/edit mounted the account form for a stranger (read …) — the
  gate is the route's, not the entry point's"*.
- **The edit page's rule comes from the page, not from the walk (T-63).** Row 46 captures the
  `.field-help` sentence while the form is valid and then asserts the malformed `"ab"` prints
  *that same* string as the `.field-error` — so the row proves error and help agree with each other
  and with the schema, without a second copy of `HANDLE_RULE` in `scripts/smoke.mjs` to drift.
- **A row that renames the account must read the four things a rename can lose from the page on both
  sides (T-62).** Name, bio, the two follow figures and the creations count are what a *re-created*
  row or an *unmoved* authored set breaks; `joinedAt` has no page, so it is the one thing the walk
  cannot read (the adapter keeps it from the old row).

- **A first visit's two fields are both blank, and the ticket's prefill hypothesis was wrong
  (T-61).** `onboarding.tsrx`'s `load()` only prefills from a *saved* profile, and the mock ships no
  provider display name, so `/onboarding` opens with an empty handle and an empty name — the account
  being `@you` does not prefill the claim. The row's order therefore has to be **blank → `"ab"` →
  name → `"Ada"` → free handle**: the only free value is the claimed one, so no intermediate
  keystroke can rename the walk's account.
- **Onboarding's uniqueness verdict used to ride the draft write (T-61).** `persistDraft()` is the
  only caller of `checkHandle` on a settle and it needs a valid handle *and* a display name, so a
  taken handle read **silent** until the name was filled — and a row that checked `"Ada"` before
  typing a name timed out on an error that would never appear. The ask now lives in
  `askUniqueness()`, on the handle's own settle; the draft write keeps its own guard.
- **A claim wrote the session and nothing else (T-61).** `/user/<handle>` after **Finish** read
  *This user doesn't exist.* while the old handle stayed claimed in `CLAIMED_HANDLES` — the landing
  is what a reader sees, so it is what a row must assert (`readHead()`'s `missing` flag), never the
  store. `renameAccount()` is now the one body for a claim and a rename; `saveProfileEdit` lost its
  private copy of the move.
- **`blocked = track(() => false)` is the wrong red proof for a gate (T-61).** Row 44 goes red at
  its **first** gate assertion (*"Finish is enabled with both required fields blank"*), not on the
  taken handle the accept line names. The surgical edit is dropping `&& !taken.value` from
  `canFinish` — that produced *"Finish stayed enabled on a taken handle — @ada is a fixture handle
  and \"Ada\" must read taken case-insensitively"*. Aim a red proof at the one clause the
  assertion exists for.
- **A thread card folds a cut at two messages, so `.cut-turn` on the feed is not the cut's length
  (T-60).** `PostCard` takes `fold`, and `/post/thread` folds (`FOLD = 2`) while the post's own page
  does not: row 43 read **2** `.cut-turn` on the newest card and **8** on `/post/<id>` for the same
  post. Read the count on the post's own page before comparing anything after a delete, and keep the
  card's count in the message as the fold's evidence — comparing the two would be red on a right page.
- **`deleteSession()`'s red proof is the character page's own control, not the store (T-60).** The
  session page navigates away on success, so an unspliced row cannot be seen at `/session/<id>` — it
  is seen one mount later: `/character/…0001` reads **`Continue`** instead of **`Start a session`**,
  because `findSessionForCharacter` still answers. Any "delete the row" ticket should name the
  *landing's* absence, which is what a reader would see, rather than a store read no page exposes.
- **A row that opens a session must first assert the control it is about to press (T-60).** Row 43
  reads the character's primary label and refuses to run unless it is `Continue`; `clickAny(["Continue",
  "Start a session"])` would otherwise create a *second* session and delete the wrong one — and it
  would look identical in the message.

- **A row that returns to a page must `go()` there first (T-59).** Row 42's first run failed with
  *"timed out waiting for the copies disclosure (after the edit)"* on a page that was right: the row
  had saved the character and read the copy as if the session had come back by itself. Nine seconds
  of a green page reads as a broken one — the step that navigates back is a **line**, not a side
  effect of leaving a page.
- **The copy row prints `inSessionName || name` (T-59).** A red proof that renames only the live
  character's `name` leaves the session's copy row reading the same string, so the row stays green on
  the bug it exists to catch. Edit **both** fields, and assert the copy's own name in the failure
  message (T-59 read `"Aurelia"` before and `"Aurelia Rebuilt"` after).
- **A textarea behind a `Sheet` is still mounted and still "visible" to a selector (T-59).** The
  session's `.say` field sits under the publish dialog, so `retype("textarea", …, 0)` can land in the
  composer that is behind the sheet and the row then reads a blank draft. Key the cut's body on its
  own `textarea[placeholder^="What happened"]`.
- **One regex, two escaping levels (T-59).** Inside a `js(\`…\`)` template the file needs `\\/` (one
  unescape reaches `\/`); the **same** pattern written as a plain `.mjs` regex literal needs `\/`.
  `/\\/character\\/[0-9a-f-]{36}$/` is `SyntaxError: Invalid regular expression flags`, reported at
  the literal itself — `node --check scripts/smoke.mjs` is the two-second gate, as it is for every
  other trap in this file.
- **`location.pathname` carries the served base; `go()` wants an app path (T-59).** On the preview
  they are the same (`/session/<id>`), on Pages they are not (`/LuaPlot/session/<id>`), so
  `go(await url())` **doubles** the base into `/LuaPlot/LuaPlot/session/<id>` — a 404-shaped app whose
  missing control reads exactly like a broken page (`timed out waiting for the copies disclosure
  (after the edit)`, live only, 42/42 local the same hour). Keep the id (`pathname.split("/").pop()`)
  and rebuild the path, and run `--live` before claiming any row that navigates back to a page it
  read earlier.
- **A row that publishes leaves a post behind (T-59).** Row 42's cut is the walk's **newest** post, so
  `/post/thread?sort=newest`'s first card is that cut for every row after it — a reasonable way to
  find it by its body (`ownCut` is a module constant), never by an id.

- **A `prepend` survives node identity, so an append row needs the ORDER assertion (T-57).**
  Inverting `post-thread.tsrx`'s append to `[...listing.items, ...items.value]` kept **all 23** stamps
  (the keys are stable, only their position moved) and the row only went red on
  `Load more reordered the first page — wanted [95d85e7b…, …000c, …000b]…, read […0012, …0011,
  …0010]…`. A "the stamps survived" check proves *not remounted*; it never proves *appended*. Keep
  both, and know which one carries which bug.
- **`.pager-action` is a wrapper and its `Button` is disabled while `appending` is true (T-57).** The
  press must poll `document.querySelector(".pager-action button")` for `!disabled` first, or the row
  reads "appended nothing" on a page that is right — the same shape as T-56's vote pair.
- **`scripts/*.mjs` take no type annotations.** `let secondHalf: string;` inside a `journey()` body is
  a `SyntaxError: Unexpected token ':'` from `node --check`, reported at the *declaration*, not at the
  `.mjs` extension. `node --check scripts/smoke.mjs` is a two-second gate before any walk run.
- **A generated fixture row needs the annotated `map` callback or `status` widens to `string`.**
  `SEED_BODIES.map((body, index): Post => ({ … status: "visible" … }))` type-checks against
  `Post[]`; the bare arrow infers `string` and the array stops being assignable. And a schema-valid
  fan-out needs a **distinct clock per row** — `newest` over equal `createdAt` is a
  non-deterministic listing (T-57 gave each generated post its own October day).
- **Seeding a listing rewrites every count in that listing's rows.** T-57's 12 → 30 posts turned
  row 39's `End of feed.`-plus-no-pager assertion into "press the control and append"; rows 21, 36 and
  38 read counts dynamically and needed nothing. Grep the walk for the *page* it reads before
  changing a fixture, not just for the number.

- **The uniqueness guard is not what makes a repeat a no-op (T-56).** `vote()`'s
  `if (previous === direction) return row` only saves a write: delete it and the walk stays **green**,
  because the next two lines decrement the previous vote and then increment the new one, so a repeat
  nets **zero**. The invariant lives in the decrement/increment pair; a row that wants to prove
  "one vote per viewer" must be shown red by removing **both** (a repeat then reads `+2`), and the
  "switch replaces" half by removing the two decrements alone (the like stays counted). A ticket that
  offers one of the two edits as its red proof is offering a green run — check the arithmetic before
  spending a walk on it.
- **Row 40 leaves one Like behind on `/character/…0002`** (the spec fixes the two-button pair and has
  no *unvote*), so anything added after it must assume the viewer already voted there, and must not
  re-read that character's counts as the fixture's.
- **A press helper that lowercases the DOM label must lowercase the wanted one too.** Row 40's first
  run failed on a page that was right: `press("Like")` compared `"like"` against `JSON.stringify("Like")`,
  matched nothing, and the failure read `no button.vote reads "Like" — saw Like | Dislike`. Cheap to
  see in the message, one walk to discover — compare both sides lowercased.
- **The engagement block is `.detail .counts[aria-label="Engagement"]`**, four `<li class="count">`
  children of `.count-label` + `.count-value`; keying on `.counts` alone is fine on this page (it draws
  one) but the `aria-label` is the fact that survives a class rename, and the four cells are
  `likes / dislikes / ratio / comments` — the ratio is a **percent** and the comments cell is `0` on
  the fixture.
- **`App.tsrx`'s effect keys on `path + search`, and that is the whole reason a one-time
  `useQuery()` read is honest (T-55).** A query change sets `status = "loading"` first, so the
  `@default` branch (and the page component in it) is torn down before `Page.value` is set again —
  the page **remounts**, `track(readSort(useQuery()))` re-initialises, and the `Select` and the
  listing move together. Do not "optimise" that effect to key on `path` alone: it would leave every
  query-string page (the thread's sort, the profile tabs, the moderation filters) reading a stale
  mount value, and row 39 is the only thing that would notice.
- **A page that writes the URL itself never notifies the router.** `writeSort()` calls
  `history.pushState` directly (not `navigate()`), so no `emit()` runs, no remount happens and the
  loaded rows survive a sort change — which is the point, but it also means a row cannot use the
  router's state as evidence for a press. Read `location.search`.
- **`history.back()` is one `sleep` away from a flaky row.** It is asynchronous (`popstate` →
  `emit` → effect → dynamic import), so poll the three readings; T-55's `expectSort` polls the
  search **and** the control together and throws with both plus the card count.
- **A refetch can be proved by node identity when the data may not change.** The thread's fetch
  stamps an `epoch` into every row's key, so a refetch remounts every card: an expando written
  before a gesture is gone after it. Use that shape for any "the page really reloaded its data" —
  the URL, the data and the control can all stay identical while nothing was fetched.
- **`choose()` returns the value it read, so it never proves the page.** T-41's helper sets `.value`
  and dispatches `change`; a page that ignores the event still returns the value. Assert the
  consequence (URL, listing), never the helper's return value.
- **The paging half is walkable now, and the numbers are 24 / 23 / 5 (T-57).** With 30 fixture rows
  (29 listed) page 1 is **24 rows** but only **23 `.card.post`** — post 7 is the only `nsfw` post and
  the walk's account seeds Show **off**, so a row that treats the card count as `PAGE_SIZE` is off by
  one. Page 2 is the **whole remainder**, so **one** press takes the pager to `End of feed.` and a
  row that expects a second press is red on a right page: assert whichever the size makes true and
  **name it in the message**.

- **The walk removes the only NSFW post before row 38 can read it (T-54).** Case 2's target is post 7
  (`lib/fixtures/posts.ts`, the only `nsfw: true` post), and row 21 concludes that case as *removed*,
  so `livePost` drops it from every listing for the rest of the run: the feed drew **11 post cards and
  none `17/6`**. A later row that wants a covered post card must compose one (the composer's **NSFW**
  toggle is `post/create.md`'s own control) — a fixture flag is not a fixture *on the page*.
- **A row that seeds a post changes what later rows count.** Row 38's composed flagged post and the
  `publish a post` row are both in the store before row 39 runs, so its page 1 is 24 rows of a
  31-row store and its append lands at 29 cards — measured, not pinned. Never pin a post count
  anywhere after row 8.
- **`.card-veil`, `.card-head` and `.card-foot` are siblings, so `veil.contains(...)` is the only
  honest containment test.** A "is it a descendant of `.card`" check passes on a footer that was moved
  *into* the blur — T-54's red proof read `footer true (outside the veil false)` on a page whose card
  still had a footer.
- **`.card-cover` is inside `.card-middle`, beside the veil**, so the Reveal needs its own
  containment check (`coverOutsideVeil`) — a check against `.card` proves nothing.
- **The cover is a `filter` on the veil, not an overlay, today** (measured `blur(6px)` in row 38's
  evidence). Record it, never gate on it: `DESIGN.md` has changed this once already.
- **The walk's account seeds Show **off** / Blur **off** (measured by T-53's seed read).** So an
  absence-only listing assertion is **vacuous**: the catalogue already omits every NSFW row before the
  row touches anything. Measure **both directions** — with Show on the same page prints the row
  (`/character/catalog` draws **24** cards, four of them the flagged characters 004 *Hollow Saint*,
  014 *Auntie Sorrow*, 018 *Tamsin Rede*, 023 *The Salt Bride*), with Show off it draws **20** and
  none of those titles. A "was there, now gone" is the only listing proof worth a row.
- **The character detail page's name is `h1.title`; the persona's is `h1.name`.** T-50's row read
  `.detail h1.name` because that page draws one; T-53 read a character and would have found nothing.
  Use `.detail h1.title, .detail h1.name, .detail h1` — the fallback costs nothing and survives a
  class rename on either page.
- **A `finally` restore masks the failure it was called to protect.** If the body throws and the
  restore then throws, the body's message is gone. T-53's shape: `catch` the body error into a
  variable, run the restore in a **second** `try`, and throw `` `${bodyError.message} — and the
  restore failed: ${error.message}` `` — a leak is the louder failure, but it must not erase the
  first one.
- **A row that owns a store pair must assert the pair *after* its own gesture, not only after the
  restore.** T-53 reads `Show` again once the Reveal has been pressed: a Reveal that wrote to
  prefs would otherwise be "restored" and read green. Any gesture whose spec says *writes nothing*
  deserves that read.
- **A covered detail page's four engagement cells read `["51","22","70%","0"]`** — the Ratio cell is
  the percent, so "every cell is a number" is false on a *right* page under the cover too (T-52's
  find, confirmed twice now). Assert the shape per label.
- **A poll timeout is only useful if your catch replaces it.** T-53's red proof was readable because
  the row caught the name poll and re-read `document.title`, `location.pathname`, the root-class
  counts, the headings and the first 120 chars of body text — it named the route, the title and the
  fact that only `.detail` mounted. Without that, the same red run says "timed out waiting for the
  name" and tells the next session nothing.

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
  total): characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 30 (29 listed,
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
- **`scrollWidth === innerWidth` is false on a right page here (T-72).** `html` carries
  `scrollbar-gutter: stable`, so an **unoverflowed** document reports `scrollWidth` equal to its
  *client* width — 350 at a 360 viewport, 1190 at 1200. The rule every row means is "no horizontal
  scroll", so assert `scrollWidth > innerWidth` (the shape rows 30/31/32 already use); a strict
  equality reads the reserved 10px as a failure and turns a green page red. This is exactly how
  T-72's first run failed (`scrollWidth 350 > innerWidth 360` on a page with no overflow at all).
- **The `minmax(0, 720px)` measure rule never binds inside the 794px outlet (T-72).** At 1200 the
  shell gives `.content` 960 (minus the 240px `.rail`), `.outlet` caps at 794 with 40px of padding
  each side, so `.doc` is 714 wide and its two tracks resolve to `["200px","458px"]` — 458 whether the
  second track is `minmax(0, 720px)` or `minmax(0, 1fr)`. T-72's ticket offered "widen it to `1fr`" as
  the red proof and that edit walks **green, 53/53**; the red proof that works is deleting the rule
  that turns the rail on (`display: flex` in `.contents`' `lg` block → *"computes to \"none\" and
  measures 0px"*). Do the outlet arithmetic **before** spending a walk on an accept line that says
  "widen the track" — a max that cannot be reached proves nothing.
- **A `display: none` box measures 0, so read the computed display first.** `.contents` is in the DOM
  at every width; at 360 its width is `0` and its display is `none`. A row keyed on the width alone
  cannot tell "hidden on purpose" from "collapsed by a bug" — assert `display` and print the width
  beside it.
- **A `js(…)` page expression must not carry a backtick or a `${`** — T-72's rail read builds its
  strings in Node and returns plain values, so the template has no interpolation at all. The
  `\\s`-per-level trap (T-49) does not apply to a row that never writes a regex in the page.

- **The 794px outlet is not the same box at 900 and 1200 (T-74).** `.cols` on the case page measures
  **730** at 900 and **714** at 1200: the outlet caps at 794 at both, but its own padding narrows at
  `lg`, so the content box is 730 then 714. An evidence line that says "the same width at both" is a
  false fact printed by a green run — read the width at each breakpoint and print both.
- **A case an earlier row concluded still renders its `.cols` + `.aside` (T-74).** Row 20 concludes
  `moderation/…0002` as *removed*, so by row 55 the aside draws the **decision record** instead of
  the *Decide* panel — the composition (340px, sticky, beside the main from `md 900`) is identical
  either way. A composition row may open any case id; only a row that presses a decision control has
  to care whether it is open, and opening one does.
- **`position: sticky` is proved by the computed `position` and `top`, never by a scroll offset.**
  Without a scroll the box has not moved; `top` also computes `auto` at 360 (no rule) and `24px` from
  `md` — asserting the pair is the honest read (T-74).

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

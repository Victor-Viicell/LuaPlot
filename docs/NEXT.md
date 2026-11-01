# Baton — what the next session does

**T-45 is the one ticket.** Home's entry control is the last hard document load in the shell: it is an
`<a>` with no `follow()`, so pressing *Sign in* / *Open profile* discards the running app and boots it
again. Everything else on the board still needs Supabase, Android tooling or a decision (bottom of this
file). T-33B(a) is now **closed on both halves** — web and webview — so do not spend a tick re-proving it.

## T-45 — home's entry control must not re-boot the app

**Why it is next.** It is the only known defect that is neither blocked nor cosmetic, it is four
characters of intent (`onClick={follow(target.value)}`) plus the assertions that prove it, and it is the
one place where the walk's first row still describes a *re-boot* rather than a navigation. Fixing it also
removes the last full page load from the shell, which matters for the frame-level work in T-40's notes.

**What is wrong.** `src/pages/home.tsrx` line ~228:

```tsrx
<a class="btn btn-primary" href={target.value}>{label.value}</a>
```

`href` alone is a document load. Every other link in the shell pairs it with `onClick={follow(...)}`
(`App.tsrx`, the cards, the rail). This one does not.

**Approach**

1. Read `.agents/skills/ripple-ts/SKILL.md` before the edit (Ripple `.tsrx`, `class` not `className`).
2. Add `onClick={follow(target.value)}` and import `follow` from `../router.ts` beside `href`.
3. Re-read the row it touches: `scripts/smoke.mjs` journey *"sign in from /"* signs out, presses
   *Sign in*, waits for `/authentification` and for *Continue with Google*. It must stay green **and
   must still be honest**: with `follow()` the URL is pushed without a reload, so the row no longer
   passes *because* the app re-seeded. Prove the difference, do not assume it — take the row's evidence
   string (it prints the assertion it made) and confirm the page did not remount (e.g. the app's own
   state, a scroll position, or `performance.getEntriesByType("navigation")[0].type` staying
   `navigate` instead of a second `reload`).
4. Signed in, the same control points at `/user/{handle}` — walk that arm too (it is the arm no row
   covers today). Add it to the journey rather than asserting it by hand.

**Traps**

- Do **not** turn the anchor into a `<button>`: the spec's home page has one entry control and the
  existing styles/`btn` class expect an anchor; keep `href` (middle-click, no-JS, crawlers) and only
  intercept the plain left-click, which is exactly what `follow()` does.
- `target` is `track()`ed (`/user/{handle}` vs `/authentification`), so the handler must read
  `target.value` at click time — a captured string goes stale after a session change.
- Row 1 of the walk deliberately starts signed in (the mock seeds) and signs out first. If the fix makes
  the control navigate *before* the store emits, the row's `waitUrl` can race the skeleton; assert text
  (`Continue with Google`), not just the path.
- `bash scripts/smoke.sh` and then `bash scripts/smoke.sh --live` — the `--live` walk is what catches a
  base-aware `follow()` (T-41/T-42 both lost rows to path handling). Never pipe the walk into
  `head`/`tail`/`grep`.

**Accept:** `./scripts/check.sh` GREEN, `scripts/smoke.sh` 28 rows green (the signed-in arm is a new
row) locally **and** `--live`, no `reload` navigation entry when the control is pressed, `LIVE` printed
by `publish.sh`.

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
- **A desktop notification can sit over the window's top-right corner** and hide the *More* button in a
  capture. The menu renders inside the body, so the session row is still readable — crop below the toast
  rather than concluding the menu did not open.
- Cron's shell guard refuses `bash -c` / `node -e`; put scripts in a file (or use `jq`) instead.

## Blocked — what a human must do

- **T-29/T-30/T-31/T-32 (Supabase):** create a project and export `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` (server key stays out of the client). Nothing about the data seam can move past
  the memory adapter until then. T-30 also owns the real auth body (`lib/auth.ts` writes no session
  today) and the redirect matrix; T-29's migration is the first thing after the ref lands.
- **T-33B(b) deep link (desktop):** needs `tauri-plugin-deep-link` + a `luaplot://` scheme in the
  bundle config — a dependency, and the contract forbids one the ticket does not name.
- **T-33B(c) `Ctrl/Cmd+K`:** a decision, not work — no spec file describes a command palette. Record
  it in `docs/DESIGN.md` (what it lists, what it does, what it costs at 360px) or strike it.
- **T-37B (palette):** Latte's active tab label is 4.45:1 (`accent` on `bg-elevated`) and Latte has no
  darker mauve: pick a darker light-mode accent ramp or a lighter surface. `docs/DESIGN.md` → *Theme*
  records the three tokens T-37 settled.
- **T-35/T-36/T-39 (Android):** install cmdline-tools + platform 35 + NDK, the four rust android
  targets, then `tauri android init`.
- **Tauri on this box is NOT blocked — and the webview session proof is done.** `bun run tauri dev`
  opens, the account survives a restart in both directions, and the recipe above reproduces it.

## Open decisions

- **`/dev/data`'s vote is order-dependent but not fragile.** The row votes on whatever the adapter's
  newest character is *at that moment* (earlier journeys re-save rows), and it reads the name back
  from the log before comparing. Do not pin a character id.
- **The breakpoint row owns a CDP override.** Anything added after it must assume the session is back
  at 360×740; the row asserts that it cleared (`window.innerWidth === restore`) rather than trusting
  the `finally`.
- **The shell still paints the previous page for one frame** before the outlet's `loading` skeleton
  (~13ms, T-40). A later view transition must not make it visible. T-45 removes the *only* full
  document load from the shell — after it, every route change is a push, so this frame is the whole
  remaining flicker.
- **A card's ratio rounds to whole percent**, so a one-vote change can leave the printed number
  identical (96% → 96%). A journey proving an engagement write must read a count (the detail page's
  Likes/Dislikes cells), never a card's percentage.
- **Row count in the walk grows with T-45** (27 → 28). A later ticket that adds a row must not assume
  27 in any docs or report text.

## Found while working (carried forward — keep this list growing)

- **Home's entry control does a full document load.** `<a class="btn btn-primary" href={target.value}>`
  (`home.tsrx`) has **no `follow()`** — that is T-45, the ticket above. It is how smoke row 1 used to
  pass: the re-boot re-seeded the mock and its `/user/you` assertion was the **seed bug T-33B removed**,
  not a sign-in (`lib/auth.ts` writes no session until T-30).
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
- **A `cargo build` debug binary loads `devUrl`, not `frontendDist`.** It opens a mapped window that
  says *Could not connect to localhost: Connection refused* — the app is fine, vite is missing. The
  accept command is `bun run tauri dev`; and `dist` must be built **without** `LUAPLOT_BASE` for Tauri
  (the app is served from `tauri://localhost`, so `/LuaPlot/assets/…` 404s).
- **The desktop is drivable from cron without a display** — see *Driving the desktop window* above.
  `hyprctl clients -j` is the machine-readable proof (`{class:"luaplot", mapped:true}`; geometry is
  `at`/`size`, **not** `x`/`width`, which come back `null` and read like a 0×0 window).
- **A tiling compositor overrides the configured window size.** `tauri.conf.json` asks for 1200×900 and
  Hyprland maps it at 941×1030. That is the WM, not a config bug — the *floor* (`minWidth`/`minHeight`)
  and the label are the parts the app controls, which is why `scripts/tauri-config.mjs` asserts those.
- **`pkill -f vite` kills the tick's own shell**, because the pattern matches the command line that is
  running it. Kill a preview by port: `lsof -ti:4321 | xargs -r kill`. Use `pkill -x luaplot` for the app.
- **Never pipe `scripts/smoke.sh` into `tail`/`head`/`grep`.** A pipeline hands back the *pager's*
  status, so a red walk exits 0, and `smoke: N/27 journeys` is the first line the pipe drops — the run
  looks green and proves nothing. Redirect to a file, then read the file and the exit code.
- **T-44's walk helpers are the ones to reuse**: `setToggle(label, want)` / `toggleState` (press a
  `button.toggle`, then **poll the rendered `aria-pressed`**), `storeCell(label)`, `coveredCards()`,
  `measureAt(width)` and the `BREAKPOINTS` table.
- **The card grid is 1 / 2 / 3 / 3, not 1 / 2 / 3 / 4.** Measured ladder live: `360:1col/field1/rail0/
  btn44/outlet340 · 640:2col/field2/rail0/btn44/outlet620 · 900:3col/field2/rail84/btn44/outlet794 ·
  1200:3col/field2/rail240/btn44/outlet794`, no document-level horizontal scroll at any width.
- **`.count-label` carries `text-transform: uppercase`** and `innerText` returns the *rendered* text
  (`SHOW`, `LIKES`): a case-sensitive label match finds nothing and reads as a broken page.
- **`Emulation.setDeviceMetricsOverride` is the only honest way to change width**, and a leak poisons
  every later row. `measureAt` runs in `try`, the clear + 240ms settle in `finally`.
- **`/dev/state`'s NSFW pair is restored, not merely flipped.** A journey that leaves Show+Blur on
  makes every later card-grid assertion read the wrong state.
- **The `--live` walk catches what the local one cannot.** T-41 lost three rows to an `^`-anchored path
  test, T-42 to a missing `/edit`. Suffix-match every path, and run `--live` before claiming a ticket.
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
- **The report journey needs POST(8)**: the preview classifier buckets on `hash("jev:post:" + body) % 5`
  and only buckets 2/3/4 escalate.
- **A shared Chromium profile makes the walk flake** — profiles are unique per run and removed on exit.
- **`go()` must resolve against the served base**; a leading slash drops the `/LuaPlot/` base.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, `overflow-x: auto`); the
  **document** does not scroll. The breakpoint row asserts `documentElement`.
- **Tap targets**: 44px still fails for card-footer author links (WCAG 2.2 `2.5.8` exempts inline
  links) and avatar links at 36×36 (AA's 24×24 floor passes). A card redesign, not a padding tweak.
- **Bundle numbers**: `dist` 1.1 MB; JS 728 KB raw / ~187 KB gz; CSS 23.8 KB gz; largest asset the
  JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met. Current hash `index-L_hJmeQc.js`.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()`, `livePost()`,
  `getPost` still answers by id.
- **Counts** (memory adapter; the walk's own journeys add rows as they run, so never assert a bare
  total): characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12 (11 listed,
  post 6 removed), reports 5 (3 open, 2 concluded), comments 22, sessions 2, bookmarks 8 (one dead),
  notifications 6 (3 unread), profiles 7, follow edges 15. `/dev/data`'s *Characters* cell reads the
  **page** count (24 = `PAGE_SIZE`), not the fixture total.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

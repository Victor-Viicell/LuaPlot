# Baton — what the next session does

**No unblocked ticket. This is a verify-only register.** T-33B(a) landed this tick: the session now
survives a restart, proven on the live site. T-33B(b) and (c) are still blocked on a human (below),
and everything else in the phase needs Supabase, Android tooling or a palette decision. The next
session's job is *proof, not product*: re-measure the register, then stop.

## What T-33B(a) settled, so nobody undoes it

- The account lives in `localStorage` under **`luaplot.session`**, read **once** at module load in
  `src/lib/state/session.ts` — before the first component exists, so a restore needs no notify (the
  old ticket's trap 2 is answered by construction, not by wiring `App.tsrx`).
- `storedSessionSchema` (`schema.ts`) parses the **stored string**, so the store calls `safeParse`
  instead of `try/catch JSON.parse`. Three states: **no key** = fresh install → seed the mock;
  **`"null"`** = signed out on purpose → survives a reload; **a row** = that account. Do not
  "simplify" sign-out to `removeItem`: an absent key is indistinguishable from a fresh install, so
  *sign out* would last exactly until the next launch.
- The row is `{handle, displayName}` through `profileWriteSchema`. **`isAdmin` is never persisted** —
  a client-writable store must not grant the admin mark, so restore re-attaches the seed's flag.
  `schema:check` section 4 fails if a stored row carries `isAdmin`, if `null` stops being readable,
  or if a corrupt/stale row is accepted.
- Writes go through one `commit()` (set → persist → emit), called only by `signIn` / `signOut` /
  `setAccount` — the ticket called it `updateProfile`; `setAccount` is its real name. NSFW state and
  the adapter stay out of storage; `prefs.ts` still re-reads the pair from the adapter per session change.

## Verify-only tick, in order

1. `./scripts/check.sh` must print `GREEN`, and `bash scripts/smoke.sh --live` must print `27/27`.
   **Let the publish settle before walking live** — this tick saw two red rows (`/dev/data`,
   `/dev/primitives`: "timed out waiting for … cards") on a walk started ~25s after `publish.sh`, and
   `27/27` on the immediate re-run. A chunk 404 during CDN propagation reads exactly like a broken page.
2. Re-run the persistence proof (scratch script, or row 28 if a later tick wants it in the walk):
   fresh profile → menu says *Sign out*; sign out → reload → *Sign in as @you* and `localStorage` is
   the string `"null"`; sign in → reload → still signed in; a corrupt row (`{`) falls back to the seed
   with zero page exceptions. **On Pages the proof must run at the site root** — there is no SPA
   fallback, so `/LuaPlot/dev/state` is a 404 and a reload there proves nothing.
3. Record the pass in `docs/PROGRESS.md` and change nothing else.

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
- **Tauri on this box is NOT blocked.** `cargo`/`rustc` 1.99.0, the four system libs and a live
  Hyprland session are present; only the cron env lacks `DISPLAY`. To open the app:
  `XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-1` +
  `HYPRLAND_INSTANCE_SIGNATURE=$(ls /run/user/1000/hypr/ | head -1)`, then `bun run tauri dev`, then
  `hyprctl clients -j | jq '.[] | select(.class=="luaplot")'` to read the window, `grim -g` to see it.
  **This is the cheapest open item on the board**: T-33B(a) is proven in Chromium but **not** in the
  webview (sign out, quit, relaunch, still signed out). One tick, and close it (`pkill -x luaplot`).

## Open decisions

- **`/dev/data`'s vote is order-dependent but not fragile.** The row votes on whatever the adapter's
  newest character is *at that moment* (earlier journeys re-save rows), and it reads the name back
  from the log before comparing. Do not pin a character id.
- **The breakpoint row owns a CDP override.** Anything added after it must assume the session is back
  at 360×740; the row asserts that it cleared (`window.innerWidth === restore`) rather than trusting
  the `finally`.
- **The shell still paints the previous page for one frame** before the outlet's `loading` skeleton
  (~13ms, T-40). A later view transition must not make it visible.
- **A card's ratio rounds to whole percent**, so a one-vote change can leave the printed number
  identical (96% → 96%). A journey proving an engagement write must read a count (the detail page's
  Likes/Dislikes cells), never a card's percentage.
- **`home.tsrx`'s entry anchor is still a hard page load.** See the first item under *Found while
  working* — fixing it changes what several walk rows see, so it wants its own ticket.

## Found while working (carried forward — keep this list growing)

- **Home's entry control does a full document load.** `<a class="btn btn-primary" href={target.value}>`
  (`home.tsrx`) has **no `follow()`**, so pressing *Sign in* / *Open profile* leaves the SPA and
  re-boots the app. That is how smoke row 1 used to pass: the re-boot re-seeded the mock and its
  `/user/you` assertion was the **seed bug T-33B removes**, not a sign-in (`lib/auth.ts` writes no
  session until T-30). The row now asserts the real outcome (*cancelled*, nobody signed in) and then
  signs in through the menu's switch. The anchor itself is unchanged and still a real defect.
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
- **The desktop is verifyable from cron without a display.** There is no Xvfb/weston/cage on this box,
  but there *is* a live Hyprland session: set `XDG_RUNTIME_DIR=/run/user/1000`,
  `WAYLAND_DISPLAY=wayland-1`, `HYPRLAND_INSTANCE_SIGNATURE=$(ls /run/user/1000/hypr/ | head -1)` and
  the app opens on Victor's real desktop. `hyprctl clients -j` is the machine-readable proof
  (`{class:"luaplot", title:"LuaPlot", mapped:true}`; geometry is under `at`/`size`, **not**
  `x`/`width` — those keys come back `null` and read like a 0×0 window), and `grim -g "x,y wxh"` plus
  `vision_analyze` proves the webview actually painted. Kill it with `pkill -x luaplot`.
- **A tiling compositor overrides the configured window size.** `tauri.conf.json` asked for 1200×900
  and Hyprland mapped it at 941×1030. That is the WM, not a config bug — the *floor*
  (`minWidth`/`minHeight`) and the label are the parts the app controls, which is why
  `scripts/tauri-config.mjs` asserts those and not the observed geometry.
- **`pkill -f vite` kills the tick's own shell**, because the pattern matches the command line that is
  running it. Kill a preview by port: `lsof -ti:4321 | xargs -r kill`.
- **Never pipe `scripts/smoke.sh` into `tail`/`head`/`grep`.** A pipeline hands back the *pager's*
  status, so a red walk exits 0, and `smoke: N/27 journeys` is the first line the pipe drops — the run
  looks green and proves nothing. Redirect to a file, then read the file and the exit code.
- **T-44's walk helpers are the ones to reuse**: `setToggle(label, want)` / `toggleState` (press a
  `button.toggle`, then **poll the rendered `aria-pressed`** — the store's emit is a microtask after
  the click), `storeCell(label)` (a `.count` cell by `.count-label`, compared **lowercased**),
  `coveredCards()` (`.card.is-covered`), `measureAt(width)` (one `Emulation.setDeviceMetricsOverride`
  read) and the `BREAKPOINTS` table.
- **The card grid is 1 / 2 / 3 / 3, not 1 / 2 / 3 / 4.** `styles.css` stops at three columns at `lg`
  on purpose (the outlet is one A4 page wide, so a fourth column draws 163px cards); `docs/DESIGN.md`
  said otherwise and was corrected in T-44. Measured ladder live: `360:1col/field1/rail0/btn44/
  outlet340 · 640:2col/field2/rail0/btn44/outlet620 · 900:3col/field2/rail84/btn44/outlet794 ·
  1200:3col/field2/rail240/btn44/outlet794`, no document-level horizontal scroll at any width.
- **`.count-label` carries `text-transform: uppercase`** and `innerText` returns the *rendered* text
  (`SHOW`, `LIKES`): a case-sensitive label match finds nothing and reads as a broken page.
  `storeCell` lowercases both sides.
- **`Emulation.setDeviceMetricsOverride` is the only honest way to change width**, and a leak poisons
  every later row. `measureAt` runs in `try`, the clear + 240ms settle in `finally`, and the row
  re-asserts the restored `innerWidth`.
- **`/dev/state`'s NSFW pair is restored, not merely flipped.** A journey that leaves Show+Blur on
  makes every later card-grid assertion read the wrong state.
- **The `--live` walk catches what the local one cannot.** T-41 lost three rows to an `^`-anchored path
  test, T-42 to a missing `/edit`. Suffix-match every path, and run `--live` before claiming a ticket.
- **A refusal row must carry the whole path.** T-42's first run failed three rows because `OTHER_*`
  omitted the trailing `/edit` and the failure read like a copy bug.
- **A `<input type=file>` in headless Chromium hangs the press unless intercepted.** Enable
  `Page.setInterceptFileChooserDialog { enabled: true }` *before* the press, take `backendNodeId` from
  the event, and hand it a real file with `DOM.setFileInputFiles` — which fires `change`.
- **Do not pin an engine's answer.** `navigator.vibrate` answers truthy here (155) and measured `false`
  in T-34: a row whose value comes from the browser asserts a **set** and names the member it saw.
- **`document.title` on a non-root route is `<Title> — LuaPlot`** (`App.tsrx`), so the badge reads
  `(3) Native — LuaPlot`.
- **T-41 is done**: the three edit routes preload and save. `retype()` (select-all + `Input.insertText`,
  read back) and `choose()` (native `<select>` by value + a real `change`, read back) are the helpers
  for a preloaded field; `type()` appends at wherever `focus()` left the caret.
- **T-40 is done**: the case page's *THE ITEM* chip reads the row, not the case; the edit-form half did
  not reproduce (`/character/[id]/edit` mounts `CharacterForm` only in its `ready` branch).
- **One stale frame on every route change** is the shell's: `navigate()` pushes and dispatches
  `popstate`, the route effect flips `status` to `loading` in the next batch, so a *synchronous* read
  right after `navigate()` still sees the old page. The skeleton covers every painted frame.
- **T-34 is done**: `src/lib/native.ts` is the only module that touches hardware and every call answers
  `nativeResultSchema`. `isNative()` reads `window.__TAURI_INTERNALS__` at runtime — never
  `import.meta.env`, which is baked at build time. A rejected `invoke()` is *absent*, not *failed*.
- **The Tauri chunk is `core-*.js` and no file in `dist` contains the literal `@tauri-apps`** — only
  the resource timing can prove it never loads (`noCoreChunk`).
- **A synthetic `.click()` cannot copy**: `navigator.clipboard.writeText` needs a trusted gesture.
- **T-38 is done**: `scripts/smoke.sh` builds + previews + walks + tears down; `--live` walks the Pages
  URL; `bun run smoke` is the alias. **It is not in `check.sh`** — the gate stays browser-free.
- **The report journey needs POST(8)**: the preview classifier buckets on `hash("jev:post:" + body) % 5`
  and only buckets 2/3/4 escalate; a report on a clean-pass post opens no case.
- **A shared Chromium profile makes the walk flake** — profiles are unique per run and removed on exit.
- **`go()` must resolve against the served base**; a leading slash drops the `/LuaPlot/` base.
- **Measure a flavour through `Emulation.setEmulatedMedia`**, never by flipping `data-theme` from JS.
- **`/bookmarks` carries an internal horizontal scroller** (`.tabs`, four type pills,
  `overflow-x: auto`); the **document** does not scroll. The breakpoint row asserts `documentElement`,
  never a subtree that is allowed to overflow.
- **Tap targets**: 44px still fails for card-footer author links (inline text — WCAG 2.2 `2.5.8`
  exempts inline links) and avatar links at 36×36 (AA's 24×24 floor passes). A card redesign, not a
  padding tweak.
- **Bundle numbers**: `dist` 1.1 MB; JS 728 KB raw / ~187 KB gz; CSS 23.8 KB gz; largest asset the
  JetBrains Mono Latin woff2 at 40,404 B. Budget 300 KB gz — met. T-33B's hash is
  `index-L_hJmeQc.js`.
- **T-28B is done**: `postStatusSchema` (`visible | removed`), `removePost()` (status flipped, thread
  deleted in cascade), `livePost()` filters the lists, `getPost` still answers by id.
- **Counts** (memory adapter; the walk's own journeys add rows as they run, so never assert a bare
  total): characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12 (11 listed,
  post 6 removed), reports 5 (3 open, 2 concluded), comments 22, sessions 2, bookmarks 8 (one dead),
  notifications 6 (3 unread), profiles 7, follow edges 15. `/dev/data`'s *Characters* cell reads the
  **page** count (24 = `PAGE_SIZE`), not the fixture total.

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

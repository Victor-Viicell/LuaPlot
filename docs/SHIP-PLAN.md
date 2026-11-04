# LuaPlot — ship plan

Ordered phases → tickets. One ticket per session unless the baton says otherwise. Acceptance is
always mechanically checkable. `[X]` = done (PROGRESS.md has the proof).

Design law: `docs/DESIGN.md`. Stack law: `docs/ARCHITECTURE.md`. Rules: `docs/CONTRACT.md`.

## P0 — Foundation (nothing else is worth doing first)

- [x] **T-01 Router + shell skeleton.** `src/router.ts` with the full route table from
      `src/specs/luaplot-pages.md`, `App.tsrx` rendering `<RouterOutlet>`, mobile top bar + bottom
      tab bar + desktop sidebar, base-path aware. Accept: every route renders a titled placeholder;
      deep link `/character/catalog` works after reload on the Pages URL.
- [x] **T-02 Design primitives.** `Button, Field, Toggle, Card, Sheet, Toast, Tabs, EmptyState,
      Skeleton, Avatar, Icons` on the Catppuccin tokens, keyboard + `:focus-visible` states,
      44px targets. Accept: a `/dev/primitives` route renders every variant in both themes at
      360px and 1280px with no overflow.
- [x] **T-03 Data contract + memory adapter.** `lib/data/types.ts`, `repo.ts`, `memory.ts`,
      `lib/fixtures/*` (≥8 characters, 6 lorebooks, 5 presets, 3 personas, 12 posts with comments,
      notifications, reports, 2 sessions with transcripts). Accept: a `/dev/data` route lists
      counts per entity from `resolveRepo()`.
- [x] **T-04 Session + NSFW preference state.** `lib/state/session.ts` (mock signed-in user,
      switchable signed-out), `lib/state/prefs.ts` (Show/Blur, persisted per account in the adapter).
      Accept: toggling Blur in one place is reflected on a catalog after navigation.
      — `/dev/state` flips both stores; the adapter keeps the pair keyed by handle, so sign-out →
      sign-in restores it. A listing reading `nsfwPreference()` follows without a page-local copy.

## P1 — The pages that define the product

- [x] **T-05 `/` home.** One screen: name, one paragraph, entry control (sign-in or profile).
      Accept: renders signed-out and signed-in; matches spec states exactly.
      — `src/pages/home.tsrx` is a title page, not a landing page: kicker, wordmark, 44ch paragraph,
      hairline, `session ·` reading, one control. Zero scroll at 360×740; the control follows the
      session live (`/authentification` / `/user/you`) and a signed-in visitor is never redirected.
- [x] **T-06 `/authentification`.** Three provider buttons, redirecting/cancelled/failed states.
      Accept: buttons call the auth seam; mobile layout has no scroll at 360×740.
      — `src/lib/auth.ts` is the seam (`signInWithProvider` → redirecting / cancelled / failed, no
      `ok`, no session write, `?auth=` preview switch); `src/pages/authentification.tsrx` is home's
      title page with three equal secondary providers in a 420 measure, one `track<AuthStatus>`, and
      a status row that reserves 20px so no state re-centres the page. Zero scroll in all four states.
      `Button.disabled` now takes `Derived<boolean>` — a live disable needs the derived, not the value.
- [x] **T-07 `/onboarding`.** Username (3–24, `[a-z0-9_]`, case-insensitive uniqueness), display
      name, NSFW toggles; inline errors; Finish gated. Accept: invalid handle and taken handle both
      block Finish with the spec's copy; valid submit lands on profile.
      — The repo's first form page: kicker, 26/34 title, hairline, two `Field`s, two `Toggle`s
      (through `lib/state/prefs.ts`), `Finish`. `lib/validate.ts` is the one reading both the inline
      error and the gate use; `repo.currentProfile` / `isHandleTaken` / `saveProfile` are the three
      profile methods the adapter now owns, and the debounced draft write is what makes *resumed
      after abandonment* true. `session.setAccount` is how a saved display name reaches the store.
      `Field.error` is live now (T-02 froze it at mount).
- [x] **T-07B Zod at every boundary.** `bun add zod`; `src/lib/schema.ts` holds one schema per entity
      and per input; `lib/data/types.ts` becomes `z.infer` of those schemas; `lib/validate.ts` reports
      the schema's issues instead of owning a regex; fixtures parse on load and every adapter write
      parses its input; `scripts/schema-check.ts` + a fifth `check.sh` section make the gate the
      guarantee; `ARCHITECTURE.md` → **Validation** and one CONTRACT bullet record it for every later
      ticket. Accept: `check.sh` GREEN with the schema section, onboarding copy unchanged, no
      duplicated entity shape, no `z.any()`.
      — `src/lib/schema.ts` (~380 lines, every shape + its normalisation, `z.strictObject` throughout,
      spec cited per group) is the one home; `types.ts` is now nothing but `z.infer`; `validate.ts`
      classifies the `ZodError` issue code instead of running a regex; `memory.ts` parses all nine
      fixture collections at load (64 rows, message names collection + row + path) and both profile
      writes; `router.ts` matches `[user.username]` with `isHandle()` from the schema. Section 5 of
      the gate (`bun run schema:check`) proves 64 rows parse, three negative cases fail, and the
      `z.lazy` reply tree is not `any`. It also caught a real bug: fixture ids were decimal strings
      (37–38 chars, not UUIDs), so **every seeded detail link was a 404** — `ids.ts` now emits hex.
- [x] **T-08 Catalog card + grid.** `Card` takes the `AuthoredItem` entity + the effective cover
      flag; veil blurred 6px, scrim sibling layer, per-item `Reveal` (44px, outside the filter), footer
      crisp. `CardGrid` 1/2/3/4-up, gutter grid. Accept: verified in the DOM at 360/640/900/1200.
- [x] **T-09 `/character/catalog`.** Toolbar (search debounced 250ms, `All` filter, sort, NSFW
      toggles), grid, `Load more` (+24, hidden at end), query-string state, all six states.
      Accept: filter+sort survive reload; empty/no-results/end-of-list each render. Landed with the
      grid/card props made live, and fixtures grown to 27 characters so paging has a second page.
- [x] **T-10 `/character/[id]`.** Identity, attached lorebooks (incl. unavailable), counts + ratio,
      bookmark, vote, settings menu shell, owner moderation notice. **Report is T-12's dialog and
      Start/Continue + fork are T-10B** — those menu entries are drawn and disabled rather than
      faked. Accept: vote/bookmark mutate the adapter and the UI shows its answer; the private
      fixture shows the notice to its owner and *unavailable* to everyone else. Landed with
      `useParams()`, `repo.myVote`, listings filtered to `isPublic` only, and `CHARACTER(28)` +
      `REPORT(5)` as the private case.
- [x] **T-10B Fork + Start/Continue.** `repo.forkCharacter` and `repo.createSession` (copies with
      `sourceId` links, a live persona reference, `personaId` optional for the unattributed start);
      the detail page's one `btn-primary` reads Start or Continue from `findSessionForCharacter` and
      a second session comes only from **New Session**. Landed with **Fork** in the settings menu
      (absent while private; the adapter refuses a private source) and DESIGN's *Start / Continue
      and Fork*. Brief: `docs/tickets/T-10B-fork-and-session-control.md`.
- [x] **T-11 Comment thread component.** `CommentThread.tsrx` builds the tree in code (oldest first
      at every level, deeper than three folded onto the third indent, an orphan placeholder dropped),
      renders placeholders with no actions but with their branch, folds a reply list past three
      behind `Show N more replies`, retargets its one composer from any row's **Reply**, covers an
      NSFW comment's own body, and honours `#comment-[id]` at mount. Adapter gained `addComment` /
      `deleteComment` (author only, counts recomputed on every write, `replyCount` now the whole
      branch) and `schema.ts` gained `commentBodySchema` / `commentWriteSchema` plus the row's
      visible-has-text refinement. Mounted under the lorebooks on `/character/[id]` with a live
      `Comments` cell. Accept: verified at 360/640/900/1200 via CDP metrics — deleting a parent keeps
      its replies, posting moves the count.
- [x] **T-12 Report dialog.** `ReportDialog.tsrx` — a `Sheet` stepper (what → reason → source for a
      copy claim → optional details → submit) mounted by the character settings menu and by every
      live comment footer. Reasons come from `REPORT_REASONS_BY_PART` in `schema.ts`, `reportWriteSchema`
      is the one gate (source required for a copy claim, part/reason pair checked), and the adapter
      owns one report per viewer per item, cumulative cases (`weight + 1`, `lastReportAt`) and
      already-verified *held*. Accept met: a report opens/joins a case in the adapter with cumulative
      weight (5/3-open → 6/4-open on `/dev/data` without a reload).
- [x] **T-13 `/post/thread`.** Public timeline, composer entry, NSFW handling, Load more. Landed: post
      card (own primitive), sort in the URL (`newest | discussed | liked`), `All` chip, Show/Blur pair,
      Load more mounted from `hasMore`. Load more's append path is unverified — 12 fixtures, page 24.
- [x] **T-14 `/post/[id]` + `/post/create`.** Body + at most one attachment (own character or cut),
      image/GIF embed, no edit route. Landed: permalink reuses `PostCard` (`fold={false}`,
      `foot={false}`) + ratio/counts aside + vote/bookmark/report/delete + `CommentThread`;
      composer with body gate (`postWriteSchema`), own-characters / own-session-cut picker,
      attribution for a cut, NSFW toggle. `repo.addPost` / `deletePost` (cascade) / `listMySessions`.
      Accept met: the adapter refuses a character the viewer does not author, and the picker only
      lists the viewer's own. Image/GIF embed deliberately not drawn — no uploader, no media field.
- [x] **T-15 `/session/[id]`.** Transcript, composer, awaiting-response state, settings menu
      (New Session, Delete with confirmation), Switch persona, publish-a-cut flow, participant
      copies with Edited/Updated/Restore/Unlinked states. Landed: header with in-session name +
      persona control, append-only transcript (`repo.appendTurn`), in-flow composer with a
      `lib/llm/chat.ts` reply seam (`replyTo()` → `null`, nothing faked), settings sheet with exactly
      New Session / Delete session (confirmation + `repo.deleteSession`), `repo.setSessionPersona`,
      copies disclosure with `updateCopyFromOriginal` / `restoreCopy` and an unlinked state that keeps
      the copy running, publish-a-cut via a two-step sheet around the extracted
      `components/PostComposer.tsrx`. **Not done:** `Edit session copy` (needs a copy write schema +
      form) and the *Awaiting model response* state (T-16's, nothing to draw it for yet).
- [x] **T-16 LLM seam + mock turns.** `lib/llm/chat.ts` + `mock.ts` + `Preview mode` chip; a turn
      appends to the transcript with the character's in-session name. Accept: in preview mode a
      sent message produces a deterministic reply after the awaiting state. Landed: `chat.ts` splits
      into `provider.ts` (a `VITE_CHAT_ENDPOINT` URL and no key — the function holds it) and a pure
      `mock.ts` (reply = f(transcript length, in-session name), fixed 180ms so the state paints);
      `repo.appendReply` is the one model write path, through `turnWriteSchema`; `chatReplySchema`
      is the one payload shape, `safeParse`d on both transports. The page draws *Awaiting model
      response* as a two-line skeleton under the in-session name and *Send failed* under the
      composer (`null` now means the provider failed, never "no model"). The `Preview mode` chip
      sits in the composer's meta line, because the session route hides the shell's top bar.

## P2 — Authoring, collections, people

- [x] **T-17 `/character/create` + `/edit`.** One-column form, avatar pick, SFW/NSFW toggle,
      lorebook attachments by ID and picker, unavailable rows kept. Accept: save publishes and
      lands on detail; invalid lorebook ID blocks with the spec's error.
- [x] **T-18 `/lorebook/*` (catalog, create, detail, edit).** Entries list, body editor. Accept: a
      lorebook saves with its entries, edit preloads them, reorder persists, and delete removes the row
      without touching a character's attachment.
- [x] **T-19 `/preset/*` (catalog, create, detail, edit).** Generation settings form.
- [x] **T-20 `/persona` collection + create/edit/detail.** Default persona rules, delete moves the
      mark, never shared/flagged. Accept: deleting the default reassigns in one step.
- [x] **T-21 `/bookmarks`.** One catalog per type, dead cards for removed items, tabs in query.
- [x] **T-22 `/notifications`.** Aggregated rows (same kind + same target fold), read state.
- [x] **T-23 `/user/[username]` + `/user/edit`.** Profile tabs (creations, posts, follows,
      followers), account settings incl. NSFW prefs, no email/provider/delete controls.
- [x] **T-24 `/terms`.** Static legal copy from the spec, anchors, NSFW/JEV cross-links. Three
      prohibitions as a numbered list, five notes, `TERMS_RULES` / `REPORT_REASON_RULE` in
      `schema.ts` shared with `ReportDialog`, `lg` contents rail; onboarding's **Finish** now says
      it is the acceptance and links here.

## P3 — Moderation and JEV

- [x] **T-25 NSFW preference everywhere.** `NsfwControl` on the three catalogs and the thread
      (pair signed in, one sign-in control signed out); the same single action on
      `/authentification`, held as an intent in `prefs.ts` and applied at sign-in; reveals keyed by
      a per-fetch epoch so a refetch re-covers them. Detail routes already drew the Show-off veil.
- [x] **T-26 `/moderation` queue.** Weight-ordered, cumulative report list, open/concluded filter,
      counts, admin gate. Row is metadata only — no preview of the reported content.
      — `pages/moderation-queue.tsrx` draws the list on page 1 (`Select` filter in the URL, counts
      from two `listReports` calls), the `forbidden` state for the mock account, and `?admin=1` as
      the reviewer's switch. JEV's verdict is read from the row, never recomputed.
- [x] **T-26B `/moderation/[report.id]`.** The case itself: cumulative reports, conclude with a
      visibility outcome (remove avatar as part of it), dismiss after the full term checklist, set
      reason, internal comments, flat history, and the notification the conclusion writes. Needs its
      own writes (`caseCommentSchema`, conclude, dismiss) — split out of T-26 on purpose.
      — `pages/moderation-detail.tsrx` draws the case read-only above its paperwork; `repo` gained
      `concludeReport` / `dismissReport` / `addCaseComment` / `getComment`, `reportSchema` gained
      `history` + `decision`, and the conclusion writes the creator's moderation row.
- [x] **T-27 JEV adapter.** `lib/llm/jev.ts` posting `{model,state,questions}` to
      `POST https://openrouter.ai/api/alpha/decisions` with `typesafe/jev-1.14` (docs/JEV.md has the
      exact question set and state shape); `lib/llm/jevPolicy.ts` holding the thresholds and the
      action table from `systems/jev.md`; clear→act, unsure→escalate, copy claims→moderator; cached
      verification flag cleared on edit. Accept: a real verdict returns for a sample item, the
      policy maps it to the spec's action, and a model failure falls through to "unsure".
      — `lib/llm/jev.ts` (decisions transport, `provider: "TypeSafe"` required, `null` on every
      failure), `lib/llm/jevPolicy.ts` (thresholds + claim reading + action table, no I/O),
      `jevPayloadSchema`/`jevRequestSchema` in `schema.ts`, `mockJevAnswers` for the preview, and
      `addReport` now scans once per item change: act + notify with no case, or escale with the
      verdict on the case. T-28B gave a post a status, so a certain violation now removes it.
- [x] **T-28 Moderation surfaces on detail pages.** Owner notice (report, reasons, measures),
      Awaiting re-verification, Request public again. — `moderationNoticeSchema` (one row per measure,
      keyed by target) + `repo.moderationNotice(kind,id)` (newest of that row and the case that hid the
      item) + `repo.requestRepublication(kind,id)` (runs `classify()` at once, owner-only); the three
      authored detail pages draw the notice, the gate (`updatedAt > notice.at`) and the three states.
- [x] **T-28B A post can be removed.** `postSchema` grew `status: "visible" | "removed"` (T-28B) —
      fixtures (post 6 seeded `removed`), `clearAction("post")` answers `removed`, `applyJevAction` and
      `concludeReport` share `removePost` (row kept, thread deleted in cascade, vote dropped), every
      listing drops the row (`livePost`) while `getPost` still answers it by id, the bookmarks tab reads
      it as a dead card, and `/post/[id]` draws the spec's *Removed by JEV* sentence plus one
      consequence line for the author.

## P4 — Real backend

- [ ] **T-29 Supabase schema.** `supabase/migrations/0001_init.sql`: every entity, FKs, cascades
      (delete item → thread), vote uniqueness, cumulative report joins, verified flags, RLS
      policies per role. Accept: migrations apply cleanly on a scratch DB and `repo.supabase.ts`
      passes the same contract test as `memory.ts`.
- [ ] **T-30 Auth wiring.** Google/GitHub/Discord via Supabase, onboarding gate, redirect matrix.
- [ ] **T-31 Storage.** Avatars, post images/GIFs, size/type limits, NSFW-flag metadata.
- [ ] **T-32 Edge Functions.** `chat` (DeepSeek) + `jev` (OpenRouter), streaming off, strict JSON,
      secrets set with `supabase secrets`, no key in the bundle. Accept: a real turn and a real JEV
      verdict return from the deployed function, and the client falls back to mock without env.

## P5 — Tauri (desktop + mobile hardware)

- [x] **T-33 Tauri shell hardening.** Window sizing per breakpoint, persistent session, deep-link
      handling, `Ctrl/Cmd+K`. Accept: `bun run tauri dev` opens the app on desktop.
      — **The window half.** Opens at 1200×900 (`lg`) instead of 800×600, floors at 360×740, label
      `main` matching the capability, and `scripts/tauri-config.mjs` puts all of it in the gate
      (section 6). Accept measured on this box: `bun run tauri dev` under the live Hyprland session,
      `hyprctl clients` → `{class:"luaplot", title:"LuaPlot", mapped:true}`, `grim` shows the rendered
      `lg` shell. The other three deliverables moved to **T-33B** — they were not done, and two of
      them cannot be done as written.
- [ ] **T-33B Tauri shell, part two: the session, the deep link, the key.** (a) *Persistent session* —
      the app must remember signed-in / signed-out across a restart; `lib/state/session.ts` is
      memory-only today. Persist through `schema.ts` (a `handleSchema.safeParse` on read), never a raw
      `JSON.parse`. (b) *Deep-link handling* — needs `tauri-plugin-deep-link` + a `luaplot://` scheme
      registered in the bundle config; the ticket must name that dependency before it lands.
      (c) *`Ctrl/Cmd+K`* — **blocked on a decision**: no spec file describes a command palette
      (`src/specs/` has no `palette`, no `ctrl+k`), and `luaplot-pages.md` is product law. Either a
      human records the palette in `docs/DESIGN.md` or (c) is struck from the ticket.
      — **(a) is done (T-33B(a)):** `session.ts` keeps `{handle, displayName}` in `localStorage` under
      `luaplot.session` through `storedSessionSchema` (no `JSON.parse` at the store, `isAdmin` never
      persisted), proven on the live site by sign-out → reload → still signed out and sign in → reload →
      still signed in, plus `schema:check` section 4. **The webview half is also proven** (same day):
      a `bun run tauri dev` window on Hyprland, signed out and signed back in, then relaunched on both
      states — `SESSION · signed out` survived one restart and `SESSION · signed in as You` the next,
      with WebKit's own store holding UTF-16 `null` / `{"handle":"you","displayName":"You"}` and no
      `isAdmin`. **(b) and (c) stay blocked** exactly as below: one needs a named
      dependency, the other a product decision. `docs/NEXT.md` carries the keyboard-only drive recipe.
- [x] **T-34 Native bridge.** `lib/native.ts` with haptics, share, clipboard, image picker, badge;
      browser fallbacks proven. Accept: web build has zero Tauri imports in the bundle graph.
      — `nativeResultSchema` on every call, ladder plugin → web API → `unsupported`, dynamic
      `@tauri-apps/api/core` chunk (`core-*.js`) that the browser never requests (measured), and
      `/dev/native` exercising all five. Rung 1 is inert: no plugin is compiled into `src-tauri`.
- [ ] **T-35 Android toolchain.** Install cmdline-tools + platform 35 + NDK, rust targets
      `aarch64-linux-android`/`armv7`/`i686`/`x86_64`, `tauri android init`. Accept: debug APK
      builds; note the exact commands in PROGRESS.
- [ ] **T-36 Mobile polish.** Safe areas, keyboard-avoiding composer, pull-to-refresh off,
      hardware back button mapping, 60fps transcript scroll. Accept: APK runs on device/emulator
      with no clipped input and haptics fire on send.
      — **T-36(a) done:** `src/lib/viewport.ts` writes `--keyboard-inset` from
      `innerHeight - visualViewport.height - offsetTop` (clamped 0…400, rAF-coalesced, `resize` +
      `scroll` on the visual viewport), installed once in `App.tsrx`; walk row 32 shadows
      `vv.height` at 360×740 and reads the session dock's bottom padding 8 → 328px. The rest of
      T-36 (a real APK, keyboard on device, hardware back, 60fps scroll) still needs T-35's
      Android toolchain.

## P6 — Release

- [x] **T-37 Accessibility + perf pass.** Focus order, labels, contrast ≥ 4.5, bundle < 300KB gz,
      no layout shift on fonts.
- [x] **T-37B Light-flavour contrast.** `--color-accent-text` is the accent's text tier — the mark on
      dark flavours, `color-mix(… 85%, --ctp-text)` on Latte (`#7f3cdb`) — used by the active nav
      label and three link hovers; marks keep `--color-accent`. Smoke row 31 measures the tab pair in
      the page per flavour via media emulation: Mocha 8.64:1, Latte 4.83:1 (was 4.45).
      — **Done** (T-37C): the rest of the accent's text joined the tier and the hover got a tier of
      its own (`--color-accent-hover-text`: lavender on dark, `color-mix(… 40%, --ctp-text)` = `#64469f`
      on Latte, 5.91:1 on a card and 4.66:1 on `--color-surface`). `a`, `a:hover`, `a.card-title:hover`,
      `a.persona-card-name:hover`, `a.persona-card-open:hover`, `.post-comments:hover`,
      `.persona-card-mark` and the selected tab's count moved; every fill kept `--color-accent`. The
      `md` rail stopped filling — its active indicator is now the 2px bar `lg` drew (DESIGN → *Layout
      law*). Row 31 grew, `EXPECTED_ROWS` stayed 31: bare link 4.83 / hover 5.91 (Latte), rail 4.83
      on the rail's own plate with no fill.
- [x] **T-38 End-to-end smoke.** Scripted walk of the 12 primary journeys against the Pages build.
      — `scripts/smoke.mjs` (+ `scripts/smoke.sh`, `bun run smoke`) walks all twelve in one session at
      360×740 and asserts on the DOM at every step; 12/12, ~7s; `--live` walks the published URL.
- [ ] **T-39 Release.** Signed Android APK, desktop AppImage, README with links, tag `v0.1.0`.
- [x] **T-40 Two stale renders the walk cannot see.** `/character/[id]/edit` can show another
      character's name in its fields when read ~1.5s after navigation (a 1.8s read sees the right
      one), and `/moderation/[case.id]`'s *THE ITEM* panel keeps the old body after *Conclude* until
      a reload. Accept: an edit form's inputs always hold the character named in the URL, and the
      item panel re-renders the outcome in place; both proven by a `scripts/smoke.mjs` step.
      — The edit half did not reproduce: the form mounts only in the page's `ready` branch, so it is
      created from the row the URL names (measured: the only stale frame is the shell's own
      transition, ~1 frame before the outlet's skeleton). The case half was real and is fixed: the
      post chip read a hard-coded `No visibility`, so a concluded *Removed* case still said nothing
      had happened. Both are now steps in the walk (13 rows then; 16 after T-41).
- [x] **T-41 Walk the other three authored forms.** `/persona/[id]/edit`, `/preset/[id]/edit` and
      `/lorebook/[id]/edit` mount the same phase-union → skeleton → form pattern as the character
      editor and no session has ever opened one. Accept: three new `scripts/smoke.mjs` journeys
      (16 rows) each proving preload identity twice, a real save, and the saved value on the detail
      page. Why next: it is the only work left that a headless session can verify.
      — All three walked clean; no defect reproduced. The walk is 16 rows: a fifth lorebook entry
      block that the detail page then prints, a preset model change that leaves the description
      intact, and a persona tagline that reaches both the detail page and the collection card (plus
      the *missing* sentence that replaces `forbidden` for a persona). Two read-back helpers
      (`retype`, `choose`) now make every field edit a two-read proof.
- [x] **T-42 The refusal states have never been walked.** Every authored edit route declares a
      `missing` / `forbidden` / `error` union and the walk only ever opens the `ready` arm: a
      fixture owned by someone else must read *isn't yours to edit* and an unused id in the right
      bucket must read the form's own *doesn't exist* sentence. Accept: four new journeys (20 rows)
      over `/character`, `/lorebook`, `/preset` on a row owned by `ada` (forbidden) and on a dead id
      (missing), each asserting the exact sentence and that the refusal offers the main action's
      destination. Why next: read-only, fixture-backed, and the only remaining coverage a headless
      session can prove.
      — Landed as **three journeys, 19 rows** (the baton allowed 19 or 22; one row per type with two
      hops, because each hop is a fresh mount and a fresh page read, so the second assertion is
      independent evidence). Personas are excluded: a persona has no `forbidden` arm (T-41 walks its
      `missing` sentence). Each hop asserts three facts through a new `refusal()` helper — the exact
      sentence, that **no `<form>` mounted**, and that `Back to catalog` resolves under the served
      base to that type's own catalog (`/LuaPlot/…` live). No defect reproduced. The first run failed
      all three rows because my `OTHER_*` constants omitted the trailing `/edit` — the routes then
      answered the app's 404, which is exactly the mistake the baton's bucket trap warns about; the
      failure message named the sentence and the path, so it was a one-line fix.
- [x] **T-43 Walk `/dev/native`'s presses.** The one dev page whose evidence is still hand-asserted in
      `PROGRESS` (T-34): the four `native.ts` calls, the clipboard road and the Tauri chunk boundary
      are proven by prose, not by a script. Accept: new `scripts/smoke.mjs` journeys that press each
      control with a **real** `Input.dispatchMouseEvent` (a synthetic `.click()` cannot copy — see the
      finding in `docs/NEXT.md`) and assert the parsed `nativeResultSchema` answer each press prints,
      plus zero `core-*` resource entries after every press. Why next: the only page with behaviour
      behind it that no script has ever exercised.
      — Landed as **five journeys, 24 rows**: one per capability, because one row pressing all five
      would prove something answered, never which road ran. Pick intercepts the chooser and hands a
      real temp PNG to the opened node; Badge presses 3, reads, clears, reads (the title is derived
      from the page's own pre-press title — `(3) Native — LuaPlot`, not the `(3) LuaPlot` the brief
      guessed, because `App.tsrx` titles every non-root route). Two engine facts recorded: this
      Chromium answers `navigator.vibrate` truthy (T-34 measured `false`), so that row asserts one of
      the two legal verdicts instead of a literal.
- [x] **T-44 Walk the three remaining dev pages, and measure a breakpoint.** `/dev/state`,
      `/dev/data` and `/dev/primitives` are the last pages a headless session can reach. Accept:
      three `scripts/smoke.mjs` journeys (27 rows) — the NSFW/session stores read back through a
      product page, one `/dev/data` mutation found again in `/character/catalog`, and `/dev/primitives`
      read at 360/640/900/1200 through `Emulation.setDeviceMetricsOverride` (no document-level
      horizontal scroll, a grid that gains columns, 44px targets at 360), cleared in a `finally`.
      Why next: the 24 rows all run at 360×740 — the contract's mandatory desktop responsiveness has
      never been measured by anything. Every other open ticket is blocked on hardware or a project ref
      (register in `docs/NEXT.md`).
      — Landed as **27 rows**. The ladder as measured, live:
      `360:1col/field1/rail0/btn44/outlet340 · 640:2col/field2/rail0/btn44/outlet620 ·
      900:3col/field2/rail84/btn44/outlet794 · 1200:3col/field2/rail240/btn44/outlet794`.
      The accept line's "a grid that gains columns" holds at `sm`/`md` and **stops at `lg`**: the
      stylesheet keeps three columns because the reading column is 794px, so `DESIGN.md`'s
      "1 / 2 / 3 / 4" was stale and was corrected here. `/dev/data` is proved by a round trip to
      `/character/catalog` *and* the character page's Likes cell, because the card's ratio rounds
      (96% → 96% on this fixture set).
- [x] **T-45 Home's entry control must stop re-booting the app.** The landing page's one control is
      `<a class="btn btn-primary" href={target.value}>` with **no `follow()`**, so *Sign in* / *Open
      profile* discards the running app and boots it again — the last full document load in the shell,
      and the reason walk row 1 used to pass on a seed bug instead of a sign-in. Accept: the anchor keeps
      `href` but navigates in-app (`onClick={follow(target.value)}`), no second `reload` navigation entry
      appears when it is pressed, the **signed-in arm** (`/user/{handle}`) joins the walk as row 28, and
      `check.sh` GREEN + `smoke.sh` 28/28 locally and `--live`. Why next: the only open defect that is
      neither blocked nor cosmetic; the fix is one attribute and the proof is the work.
      **Done** (T-45): `follow()` now lives in `router.ts` (one seam, `App.tsrx` and `CatalogSwitch.tsrx`
      use it too), the walk proves document identity rather than a URL, and the live walk caught the
      ticket's real trap — `follow(href(x))` doubled the base on Pages. `EXPECTED_ROWS` is now explicit so
      a vanished row is a red walk instead of a green one.
- [x] **T-46 Every in-app link is a push, not a load.** T-45 gave the app one seam (`follow()` in
      `router.ts`) and converted home; ~30 anchors remain bare — *Edit profile* on your own profile,
      the catalogs' *Create* buttons, the signed-out *Sign in* buttons on the create pages, and the
      card title/handle/author links. Each is a document load: the mock re-seeds and the shell
      repaints from scratch. Accept: every internal anchor pairs `href={href(path)}` with
      `onClick={follow(path)}` (a **path**, never `href(...)` — that doubles the base on Pages),
      hash links stay bare, `scripts/link-check.mjs` enforces the rule as a `check.sh` section and is
      proved red against a broken copy, and walk row 29 presses *Edit profile* and proves no reload.
      Why next: it is the same defect class T-45 just made cheap to fix, and the work is mechanical.
      Brief: `docs/NEXT.md` → T-46.
      — **Done** (T-46): 53 internal anchors now pair `href={href(path)}` with `onClick={follow(path)}`;
      `EmptyState` takes the **path** (`to=`) and owns the pair itself, so its 39 call sites cannot
      regress; the three page-local `openLink()` copies of `follow()`'s modifier check are gone.
      `scripts/link-check.mjs` is gate section 7 and was proved red on a broken copy (single-line and
      multi-line tags, fragment and `target="_blank"` exempt). Row 29 presses *Edit profile* and proves
      document identity; 29/29 local and `--live`.
- [x] **T-47 The card's links reach the 44px floor.** Measured in T-44 and carried in the failure
      bank: `.card-foot`'s author link was a ~16px text run, `PostCard`'s avatar link was 36×36, and
      `UserCard` put two links on one destination. Accept: `.card-foot` is a 44px band whose only
      interactive child is the stretched author link (the ratio stays plain text), `.post-avatar` is a
      44×44 box *around* the 36px drawing, the person card's handle is not a link, `DESIGN.md` → *Card*
      carries the rule and the numbers, and walk row 30 measures both at 360×740 with no horizontal
      scroll. No new class, no colour, no dependency.
      — **Done** (T-47): `line-height: 44px` is the band (type unchanged), `flex: 1 1 auto` is what
      makes it a 44px *wide* target — the first run failed for a 36px-wide box around a 2-letter
      handle. `.post-avatar` grew by `margin: -4px` so the drawing did not move. Row 30 prints
      `catalog author 244×44 in a 45px foot … thread avatar link 44×44 around a 36px drawing`, and was
      proved red (16px) with the band removed. 30/30 local and `--live`.
- [x] **T-48 A static guard for the accent's text tier.** `--color-accent` / `--color-accent-hover` may
      paint `background-color`, `border-*`, `outline`, `box-shadow`, `fill`, `stroke` and
      `accent-color` — never the `color` property. Accept: `scripts/tier-check.mjs` scans
      `src/styles.css` and every `src/**/*.tsrx` `<style>` block, `check.sh` grows section 8 and still
      prints `GREEN`, the scanner is proved red on an injected `a:hover { color: var(--color-accent) }`
      (naming `file:line`), and no colour changes in the commit. Why next: it is the only way the tier
      survives a page nobody walked — T-37C's sweep is a list in a doc today. Brief: `docs/NEXT.md`.
      **Done, with one premise corrected:** the tree was *not* byte-identical to what passed row 31 —
      T-37C's sweep reached `src/styles.css` only, and the `.tsrx` `<style>` blocks still had **26**
      declarations painting text with the mark. Section 8 found them on its first run; they took the
      text/hover tiers, and the three `.vote`/`.save` pressed pills (own `--color-surface`, where no
      static accent tier clears AA in Latte) became an accent fill with `--color-accent-contrast`. The
      walk stayed 31/31 with row 31 unmoved, so `styles.css` was not touched at all.
- [x] **T-49 The session's copies become a walk row.** The product law *sessions read copies, never
      live items* had no row: nothing had opened the **Session copies** disclosure, read a copy's
      state or pressed **Restore**. Row **33** (33/33 local and `--live`) reads the closed header, the
      three states (`edited` / `unlinked` / `untouched`), the per-state controls, and the restore's
      effect on both the row and the tracked sentence. Proved red first. Two ticket premises were
      wrong and the DOM won: session 2 holds three copies (not four) and the summary drops the suffix
      rather than printing `0 edited`.
- [x] **T-50 A persona carries none of the shared-item chrome.** The law *personas are personal
      (never shared, never moderated, never counted)* is a law about **absences**, so no gate that
      reads what a page has can see it break. Row **34** (34/34 local and `--live`) opens an own
      persona and counts, inside `.detail` only: 0 report controls, 0 save/bookmark controls, 0
      engagement elements, 0 comment elements, 0 forms — after reading the name and the four controls
      the spec does require, so an empty page cannot pass. Then `/persona` is own-only (one
      `.persona-card` per `.card-cell`, every card under the served base to a seeded persona id), and
      an unowned id reads the one sentence with no form and a road back to `/persona`. Proved red
      first by injecting a `Report` button. Brief: `docs/NEXT.md`.
- [x] **T-51 A fixed segment wins over an id param.** The law *IDs carry identity, names never do.
      Fixed segments (`catalog`, `create`, `thread`) win over `[id]` params* is a **precedence** rule
      — `spec-routes.mjs` proves every route's page module resolves, never which row of the table
      wins a path, so no gate could see it break. Row **35** (35/35 local and `--live`) walks the
      nine literal siblings as addresses (`/character/catalog`, `/character/create`,
      `/lorebook/catalog`, `/lorebook/create`, `/preset/catalog`, `/preset/create`,
      `/persona/create`, `/post/thread`, `/post/create`) and reads four landmarks per page: its own
      root class (`.catalog` / `.create-page` / `.thread` / `.compose-page`), its `.kicker`
      sentence, `document.title`, and on a create page a mounted `<form>` — with `.detail`'s
      **absence** as the other half. The control half opens a real uuid at the same depth and must
      still reach the detail page. Proved red first: `/character/catalog` mounted the detail page
      (`.detail ×1`, title `Character — LuaPlot`) and the row named it. Brief: `docs/NEXT.md`.
- [x] **T-52 Engagement is a ratio on a card, and counts live on the detail page.** The law *Engagement
      is metadata on cards (ratio only) and actions on detail pages (counts live there)* is a rule
      about **where a number lives**, and every existing gate reads presence — `tier-check.mjs` reads
      colours, `link-check.mjs` reads anchors, row 30 measures a card's links, row 31 a token's
      contrast. Row **36** (36/36 local and `--live`) reads the engagement surface of every card on
      `/character/catalog` as data: one `.card-ratio` each, text a whole percent, a `SPAN` outside any
      `a`/`button`/`[role=button]`, and zero `.count`/`.counts`/`.count-label`/`.count-value`/
      `.comments` inside it (20/20 cards). The other half opens `/character/[id]` and asserts the four
      engagement cells and both `.vote` controls, and `/post/thread` is measured as the **other** card
      on purpose — two `.post-count` cells and one comment link, no ratio, which is what `thread.md`
      fixes for posts. Proved **red** first: a `<span class="count">{item.likes}</span>` in the card
      footer made the row report `the card for "The Lamplighter's Widow" … with ["count"] inside it —
      20/20 card(s) fail`. Brief: `docs/NEXT.md`.
- [x] **T-53 A viewer's filter never blocks a route.** Failure-bank entry 4: *NSFW preference treated
      as access control (404s) → detail routes always resolve*. `nsfw.md` → *Rules* says it twice —
      *"It is not access control. No route is blocked, no 404, no redirect: a direct link still
      resolves"* and *"With Show off, a detail route still resolves … no separate notice page and no
      empty render"* — and row 25 only ever proved the **listing** half. Row **37** (37/37 local and
      `--live`) records the seed pair from `/dev/state`, flips **Show** off, and reads both halves as
      data: the catalogue prints *Hollow Saint* with Show on (24 cards) and drops it with Show off
      (20 cards), then `/character/…0004` is opened **by address** and must mount `.detail` + its
      `h1.title` + `.veiled.is-covered` + `aria-hidden="true"` + a **Reveal** control inside
      `.detail` + four engagement cells still printing numbers; pressing Reveal clears the cover,
      removes the control, keeps the name, and leaves Show reading off. The restore runs even when a
      half failed and asserts the seed pair plus the catalogue. Proved **red** first: an
      `@else if (nsfw.value && !show.value) { <p class="prose"></p> }` arm in `character-detail.tsrx`
      made the row report `resolved nothing with Show off — title "Character — LuaPlot", roots
      {".detail":1,…}, headings []` at 36/37. Brief: `docs/NEXT.md`.
- [x] **T-54 A cover is structural: the chrome and the numbers stay outside it.** Failure-bank entry 1:
      *Card blur hides the numbers → footer stays outside the blur*. `nsfw.md` → *Blur is structural*
      says the top header is the title, the bottom footer is author + ratio, the blurred area is
      exactly what sits between them, and *the numbers are never hidden*. No gate had ever rendered a
      **covered** card — row 36 measures the counts with Blur off, row 25 counts `.is-covered` and
      stops, row 37 covers a *detail* page — so moving `.card-foot` one indentation inside
      `.card-veil` would have stayed green. Row **38** (38/38 local and `--live`) records the seed
      pair, turns Show **and** Blur on, and reads every covered catalogue card as data (4/24):
      `veil.contains(...)` false for `.card-head`, `.card-foot` and `.card-ratio`, ratio inside the
      footer, `aria-hidden="true"` on the veil, Reveal inside `.card-cover` **and** outside the veil,
      zero numbers inside it; then presses the **first covered card's** Reveal (scoped, exact) and
      asserts the covered count falls by exactly one, that card uncovers, and the rest keep their
      order. The feed half repeats the split on a post card the row **composes with NSFW on**, because
      row 21's concluded case removes the only flagged fixture post. Proved **red** first: `.card-foot`
      moved inside `.card-veil` read `footer true (outside the veil false), ratio true (in the footer
      true, outside the veil false) … 4/4 covered card(s) fail`. Brief: `docs/NEXT.md`.

- [x] **T-55 The thread's sort is a URL fact, and Back is the proof.** Failure-bank entry 3: *`Load more`
      state lost on back → paging in component state, filters in URL*. `post/thread.md` → *URL* says
      *"Sorting and filtering live in the query string, per the conventions, so a filtered thread is
      shareable"*, and *Layout* says *"paging stays out of the URL"*. `post-thread.tsrx` already did
      both (`writeSort()` pushes `?sort=`, `newest` writes **no** param, `loadMore()` never touches the
      address) and nothing could see it: no row read `location.search` on the thread and no row had
      ever called `history.back()` (row 4 hops with `go()`, forward only). Row **39** (39/39 local and
      `--live`) reads **all three** — the address, the `select.select-input`'s own value, and the
      cards — and asserts the **exact** `location.search` at every step: `?sort=discussed` **by
      address** (shareable, 11 cards), no query ⇒ `""` + `newest` (the default is the *absence* of the
      param), press `discussed` ⇒ `?sort=discussed`, press `liked` ⇒ `?sort=liked`, `history.back()` ⇒
      `?sort=discussed` with the control **and** the listing following, a second `history.back()` ⇒
      `""` + `newest`. The refetch is proved by **nodes** (each card is stamped before a gesture and
      the stamp must be gone after it — the fetch's `epoch` rides in every row's key), because
      "the address changed" cannot claim the page re-read it, and `choose()` returns the value it read
      so it proves the control only. Proved **red** first: a module-level `frozenSort` (first read in a
      document wins) read `wanted search "?sort=discussed" with the control on "discussed" — read
      search "?sort=discussed", sort control "newest", 11 post card(s) … at /post/thread`. Brief:
      `docs/NEXT.md`. **Paging half not walked:** needs 25+ posts (filed as T-57).

- [x] **T-57 Seed a real second page, then press Load more and prove paging stays out of the URL.**
      Failure-bank entry 3's other half and `post/thread.md` → *Layout*: *"paging stays out of the
      URL"*. `lib/fixtures/posts.ts` was **12 rows** against `PAGE_SIZE` 24, so `hasMore` was false,
      `/post/thread` drew no `.pager-action`, and row 39 asserted that *absence* plus `End of feed.`
      — a pager that wrote `?page=2`, or an append that replaced the listing, stayed green in every
      gate and every row. The fixture is now **30 rows** (`POST(1..12)` untouched; `POST(13..18…30)`
      generated in a loop, `POST(13..30)`, with a distinct October day each, so `newest` is
      deterministic) = 24 on page 1, 5 on page 2. Row **39 extends** (no row 41, `EXPECTED_ROWS` stays 40): it presses
      `.pager-action button` after polling it *not disabled* (`appending` disables it), asserts the
      count grows, the first page's **order and node stamps survive** (an append extends, a replace
      drops every node), `location.search` is still `""`, page 2 was the whole remainder so the pager
      reads `End of feed.` at 29 cards, then `history.back()` **leaves the thread** (paging pushed no
      entry) and a return re-reads page 1 (same card count, 0 stamps, Load more back). Proved **red**
      twice, bytes restored and `sha256sum -c` clean: `loadMore()` writing `?page=2` → *"Load more
      wrote \"?page=2\" into the address — paging stays out of the URL"*; the append inverted to
      `[...listing.items, ...items.value]` → *"Load more reordered the first page"* (note: the 23
      stamps **survived** that inversion, so node identity alone would have been green — the order
      half is what caught it). 40/40 local and 40/40 `--live`. Brief: `docs/NEXT.md` (T-57).

- [x] **T-60 Deleting a session takes its transcript and its copies, and a published cut outlives it.**
      `session/detail.md` → *Actions* → **Delete session**: *"the settings menu's only other option,
      with confirmation: it removes the transcript and the session's copies, while a cut already
      published stays as it was"*. Three rows read a session (33, 42) and row 42 published a cut, but
      **no row had ever pressed the settings menu's dangerous row** — a `deleteSession()` that left the
      session resolvable, forgot the copies, or cascaded into the post the cut became was green in
      every gate and all 42 rows. Row **43** (`EXPECTED_ROWS` 43) finds row 42's cut as
      `/post/thread?sort=newest`'s first `.card.post` **by its body** (`ownCut`, no pinned post id), takes
      its `.post-time` permalink, reads the whole cut on its own page (the thread card folds after two
      messages), opens the seed character and presses its own **Continue**, reads the transcript count
      and the four-copy disclosure (`4 copies`, no ` · N edited`), then deletes in the settings menu:
      `Session settings` → `.menu-row.is-danger` (*Delete session*) → the confirmation's own sentence
      (*removes the transcript and every copy in it. A cut you already published stays …*) → the
      confirmation's `Delete session` **scoped to `.menu-actions button`** (the opener carries the same
      label). Landing: `/character/…0001` reading **`Start a session`**, the character named
      `Aurelia of the Second Tide` (row 42's second rename) — read, never pinned. Then
      `go("/session/<id>")` mounts *This session doesn't exist.* with its `/character/catalog` road and
      **no** `.turn-text`, and the post still reads the same body, lines and count. Proved **red**
      first by removing `store.sessions.splice(index, 1)` from `deleteSession()` → *"the session
      survived the delete: /character/…0001 reads \"Aurelia of the Second Tide\" with its primary
      control at \"Continue\", not \"Start a session\" — the store still resolves a session for
      5e551000-…0001 (8 turn(s), 4 copies)"* (42/43); bytes restored, `sha256sum -c` clean. 43/43 local
      and 43/43 `--live`. Brief: `docs/NEXT.md` (T-60).

- [x] **T-63 The edit page's gate, its `Username taken` refusal and its format error are read.**
      `user/edit.md` → *States* names five, and rows 3 and 45 only ever read **Owner**: nothing had
      visited a **stranger's** edit URL (a pasted `/user/ada/edit`), the walk's only `Username taken`
      assertion belonged to onboarding (row 44), and the schema's rule had never been read as this
      page's **inline** error. Row **46** (`EXPECTED_ROWS` 46, read-only — **Cancel**, never
      **Save**) reads the session's own handle from `/`'s *Open profile* link, asserts the forbidden
      state is a **state** (the URL stays at `/user/ada/edit`, `.empty-copy` is *You can't edit this
      account.*, no username or display-name field, no **Save**, *Back to your profile* at
      `/user/<own>`), then walks the owner's form: prefill, `ada` → **`Username taken`** with Save
      disabled and no help line, `"ab"` → the page's own rule sentence as the inline error with Save
      disabled, the own handle again → error gone, rule back as help, Save enabled; **Cancel** →
      `/user/<own>` with name, handle and bio unchanged. Red first, twice: deleting
      `|| myHandle !== urlHandle` from `boot()` → *"/user/ada/edit mounted the account form for a
      stranger … the gate is the route's, not the entry point's"*; dropping `&& !taken.value` from
      `canSave` → *"Save stayed enabled on @ada, a fixture handle … a taken username must block the
      write"* (45/46 both times). Bytes restored, `git diff` empty. 46/46 local and 46/46 `--live`.
      Brief: `docs/NEXT.md` (T-63).

- [x] **T-65 The catalog's search, tags and sort are three URL facts, and the search settles.**
      `character/catalog.md` → *URL*: *"The search, the tags, and the sort live in the query string —
      `?q=…&tags=blue,haunted&sort=ratio` — so a narrowed view can be shared, bookmarked, and restored
      by back/forward"*, and `CONTRACT.md` → *Engineering law*: *"No per-keystroke network calls;
      debounce search at 250ms."* Rows 30, 36-38 and 53 read this grid, its footer and the NSFW pair;
      **no row had ever typed into the search, picked a tag, pressed the sort control or opened
      `?q=&tags=&sort=` by address** — a per-keystroke writer, a `q` that died on reload, a chip that
      never reached the adapter and a `sort=ratio` that left the control on Newest were green in every
      gate and all 47 rows. Row **48** (`EXPECTED_ROWS` 48, **read-only**) reads the vocabulary off the
      page (the first card's own title, one tag on it and one on a card that does not carry it), types
      the title one character at a time and reads `location.search` between keystrokes (**13 in-window
      samples, none carrying `q=`**), then the settle's **whole** word and the narrowed grid; a mount
      from `?q=…` preloads the field and draws the same cards; `?q=zzqx-nothing-matches` reads *Nothing
      matches those filters.* with 0 cards, no Retry and a Clear filters control; `?sort=ratio` draws
      **22 ratios never rising** with **Top rated** on the control, Newest drops the param, Back
      returns the listing **and** the control; `?tags=ghost` narrows to 5 cards all carrying it and its
      chip's remove control rewrites the URL to `""`; `?tags=ghost,artisan` draws **4 ghost-only + 7
      artisan-only** (either, not both) and removing `artisan` leaves `?tags=ghost`; at 360 the first
      card folds `+2` behind its `+N` chip and the list opens and closes (override cleared, `innerWidth`
      asserted back). Red first: `onSearchInput` calling `applySearch(next)` on every keystroke →
      *"the search wrote the URL 13 time(s) while \"Lamplighter's\" was still being typed (read
      [{\"typed\":\"L\",\"search\":\"?q=L\",\"elapsed\":75},…]) — a per-keystroke writer, not the 250ms
      settle"* (47/48). Bytes restored. 48/48 local and 48/48 `--live`. Brief: `docs/NEXT.md` (T-65).
      Found: a page's own `replaceState` query write never notifies the router, so the view and its URL
      can disagree — filed as **T-66**.

- [x] **T-66 A page that writes its own query leaves the router believing something else.**
      `character/catalog.md` → *URL*: *"The search, the tags, and the sort live in the query string — …
      so a narrowed view can be shared, bookmarked, and restored by back/forward"*, plus
      `CONTRACT.md` → *Engineering law* (a phone-first app must not throw the caret away). Found while
      writing row 48: the page wrote `history.pushState`/`replaceState` itself, so `router.state` and
      the shell's private `lastKey` stayed on the **pre-query** location — press the **Catalog** tab (or
      the switcher's **Characters** tab) on a narrowed catalog and `navigate("/character/catalog")`
      emitted the key the shell already believed it mounted: nothing reloaded, the URL dropped the
      query and the grid kept it. The spec's shareable narrowed view was broken in the one state a
      reader narrows by hand, and no gate and no row of 48 could see it. Fix: **the router owns the
      mounted key** (`getMountedKey()`/`setMountedKey()`; `emit()` never touches it), and the new
      **`commitQuery(search, mode)`** writes history, refreshes `state` and moves the key **without**
      emitting — so the settle keeps the caret and the next press on the same route is a real remount.
      All seven pages that wrote history directly now go through it (`character-catalog`,
      `lorebook-catalog`, `preset-catalog`, `persona-collection`, `bookmarks`, `post-thread`,
      `user-profile`), and **gate section 9** (`scripts/history-check.mjs`) fails the build if any file
      but `router.ts` touches history. Row **49** (`EXPECTED_ROWS` 49) types a word into the catalog's
      search and asserts the **field still has focus** after the settle, then presses **Characters**
      (`.cat-switch`) and the bottom bar's **Catalog** tab in a narrowed state — search cleared, field
      empty, `location.search === ""`, the full grid and the crumb's path — and row 48's `go("/")`
      workaround is gone (its bare-route hop now remounts and the row asserts it). Red first, twice:
      dropping `mountedKey` from `commitQuery()` → *"the bare catalog to remount after the settle's
      commit … {"count":1,"field":"Lamplighter's"}"* (47/49); `character-catalog`'s `writeQuery()`
      calling `navigate()` → **row 49 alone** in 729ms: *"the search field lost the caret the moment it
      settled (document.activeElement is BODY., the field reads "Lamplighter's", URL
      "?q=Lamplighter%27s") — a query write that emits remounts the page mid-typing"* (48/49). Bytes
      restored. 49/49 local and 49/49 `--live`. Brief: `docs/NEXT.md` (T-66).
      Found: six pages commit a query the walk never reads (`/bookmarks`, the two other catalogs,
      `/persona`) — filed as **T-67**.

- [x] **T-67 The saved page's tabs are the query, and a tab pressed on itself leaves the search.**
      `bookmarks.md` → *URL*: *"Type, search, sort, and filter all live in the query string —
      `?type=character&q=&sort=recent&tag=` — … so a narrowed view can be shared, bookmarked, and
      restored by back/forward."* T-66 changed **seven** pages' `writeQuery()` in one commit and
      walked one of them (`/character/catalog`, row 49), so `/bookmarks` — the only page whose tab
      write is a `push` and whose search write is a `replace` — had no row at all. Row **50**
      (`EXPECTED_ROWS` 49 → 50, **read-only**) reads eight facts on the page's own vocabulary: a
      fresh `/bookmarks` writes `?type=character` on boot (the default tab is the most recently saved
      kind, counts `[3,2,1,2]` = saved rows); pressing **Lorebooks** pushes `?type=lorebook` and draws
      `Saved lorebooks`; a mount from that URL draws the same two titles; `?sort=name` reads **Title
      A–Z** and orders the titles ascending, and Back returns `?type=lorebook` with the control back
      on Newest saved; typing `Archive` commits `?type=lorebook&q=Archive` with 1 of 2 rows **and keeps
      the caret** (`INPUT.field-input`); a mount from `?type=lorebook` — the URL the page wrote
      *before* the search — remounts the whole tab (2 rows, empty field); a sort pressed under the
      search reads `?type=lorebook&q=Archive&sort=name` and Back returns
      `?type=lorebook&q=Archive` **with the field holding `Archive`**; and pressing **Lorebooks** while
      it is already selected clears the search to `?type=lorebook` with an empty field. That last
      clause needed a page fix: `chooseTab()` returned early on the selected tab, so the one road back
      to a tab's whole list from a narrowed view (there is no `Clear search` outside the no-results
      state) was dead. `bookmarks.tsrx` now treats a same-tab press as *this tab, unfiltered* — it
      clears the search and a pending settle, pushes the URL, and is a no-op when there is nothing to
      clear; `DESIGN.md` → *Bookmarks* carries the rule. Red first, twice: (1) dropping
      `mountedKey = …` from `commitQuery()` → 47/50, row 50 *"Back to return the unsorted tab — read
      {"search":"?type=lorebook",…,"titles":["Ashmarket Gazetteer","The Salt Archive"]…} — the select
      kept Title A–Z on a URL that no longer carries it"* (`sortValue` still `name`); (2) the aimed
      edit `if (mode === "push") mountedKey = …` (a replace commit leaves the key stale, T-66's own
      shape) → 47/50, row 50 alone at the seam: *"a mount from ?type=lorebook (the URL the page wrote
      before the search) to remount the whole tab — read {"search":"?type=lorebook",…,"count":1,
      "titles":["The Salt Archive"],"field":"Archive","focused":true}"* — the address dropped the
      query and the field kept the word. Bytes restored (`git diff src/router.ts` empty). 50/50 local
      and 50/50 `--live`. Brief: `docs/NEXT.md` (T-67).
      Found: the three catalog copies (`/preset/catalog`, `/lorebook/catalog`, `/persona`) still
      write their own query with no row reading them — filed as **T-68**.

- [x] **T-81 `/persona`'s `sm 640` toolbar had never been rendered.** `persona-collection.tsrx` keeps a
      `@media (min-width: 640px)` block that rewrites `.toolbar` from a flex column into
      `minmax(0, 1fr) minmax(0, 1fr)` with `.search` spanning both columns (`grid-column: 1 / span 2`)
      and sort + Create auto-placed on the line beneath, and widens `.create .btn` from the base
      `width: 100%` to `width: auto; min-width: 120px` — and row 51 mounts that page only at the
      session's own ~500px, below the breakpoint. Brief: `docs/NEXT.md` (T-81).
      Landed: row 51 extended (no new row, 55 stays) reading the bar at 640 / 900 / 360; measured
      640 `["283px","283px"]`, 900 `["378px","200px","120px"]`, 360 flex. Red proof: deleting the sm
      block's `.search { grid-column: 1 / span 2 }` red-lit row 51 alone at *".search spans 24→307 in
      a toolbar 24→606"*.

- [x] **T-82 `/onboarding`'s `sm 640` form measure and action row have never been rendered.** The
      page's `@media (min-width: 640px)` block sets `.setup { max-width: 520px }` (*"A form is not a
      poster"*), turns `.actions` from a stack into a row (`flex-direction: row; align-items: center;
      gap: 16px`), gives `.actions .btn { width: auto; min-width: 200px }` and lets `.actions .note`
      take `flex: 1 1 auto; max-width: 30ch`. Row 44 mounts `/onboarding` only at the session's ~500px,
      so none of it has ever run — **and `.actions .btn` targets the `Button` primitive's own element,
      which `DESIGN.md` says a scoped page `<style>` cannot reach** (`.toolbar .field`, `.prefs
      .toggle`, `.pager .btn` all matched nothing), so the ticket may be a *dead rule* plus the
      page-owned-wrapper fix the design already prescribes. Brief: `docs/NEXT.md` (T-82).
      **Landed:** the rule *was* dead (pruned from the compiled CSS); the page now wraps `Button` in a
      page-owned `.primary`, row 44 reads the ladder at 640/900/360.

- [x] **T-83 `/authentification`'s `sm 640` 420 measure has never been rendered.** The entry screen's
      `@media (min-width: 640px)` block caps `.providers`, `.nsfw` and `.status` at `max-width: 420px`
      (*"A 420 measure for the controls, not three buttons stretched across 640"*) and steps `.screen`'s
      `min-height` from `100dvh - 228px` to `100dvh - 240px`. Row 1 is the only row that mounts
      `/authentification`, and it does so at the walk's own ~500px, below the breakpoint — so neither
      declaration has ever run, on the app's other entry screen. Extend row 1's width phase between its
      push proof and its provider press. Brief: `docs/NEXT.md` (T-83).
      **Landed:** row 1 extended (no new row, 55 stays) reading 640 / 900 / 360; the caps are **live** —
      420 in an outlet content box of 582 at 640 and 730 at 900, `none` at 360 where all three fill 318.
      Red proofs: deleting the rule red-lit row 1 at *".providers measures 582 in an outlet whose content
      box is 582 (630 box)"*; dropping only `.status` from the list red-lit it at *".status measures 582"*.

- [x] **T-80 `/post/thread`'s `sm 640` controls had never been rendered.** `post-thread.tsrx` stacks
      **two** media blocks over `.controls`: `sm` turns the base two-track stack into
      `200px minmax(0, 1fr) auto` (sort | pair | Create on one row, `align-items: end`, gap 24px,
      `.prefs` as a **row**), and `640–899` then lifts `.prefs` to `grid-column: 1 / -1; grid-row: 2`
      and `.create` to `grid-row: 1` — the comment records the near-bug it exists for (*"Under `md`
      the four-across row squeezed both switches to 115px"*). Row 39 mounted that page only at the
      session's ~500px and pressed Load more, so both blocks were declarations nothing could go red
      on. Row **39 extended** (no new row; `EXPECTED_ROWS` stays **55**): after the paging half it
      takes `640×740` then `900×740`, one `readControls()` each into `assertControls(r, width)` — 640
      asserts a `grid` of **exactly three** tracks with the first `200 ± 1`, sort and Create sharing
      row 1 by their **bottoms**, `.prefs` below both, starting at the controls' left edge and running
      past the sort column, computing `flex-direction: row`, `.feed` gap `16px` and the pager's 200px
      minimum only while drawn; 900 asserts **four** tracks with the first `220 ± 1` and `.prefs` back
      on row 1 between the sort and Create. Measured 640: `["200px","238.75px","85.25px"]` gap `24px`,
      sort `24→224` bottom `180.39`, prefs `24→445.63` top `204.39`, create `510.75→596` bottom
      `180.39`; 900 `["220px","421.625px","16.375px","0px"]`, sort `117→337`, prefs `361→782.63`,
      create `737.75→823`. Red first: deleting `.prefs`' `grid-column: 1 / -1` from the range block
      put **row 39 alone** red reading *".prefs starts at 248 in a controls box starting at 24"*.
      Bytes restored (`cp` + `cmp` identical), `check.sh` **GREEN**, 55/55 local, 55/55 `--live`,
      `publish.sh` → `LIVE` (asset `index-DPoxP2Sr.js`, unchanged), `curl` **200**. Brief:
      `docs/NEXT.md` (T-80).
      Found: the baton's own red proof (`grid-row: 2`) **walks green, 55/55** — dropping it changes
      nothing, because the pair spans all three columns and cannot share row 1 with `.sort` and
      `.create`, so auto-placement puts it on row 2 regardless (T-75's class, fifth time). The
      declaration that binds is `grid-column: 1 / -1`. And `.prefs`' box is **content-sized** at 640
      (`justify-self: start`), so the ticket's `|prefs.right − controls.right| ≤ 1` was wrong on a
      right page; the witness is the left edge plus crossing the sort column.

- [x] **T-79 `/bookmarks`' `sm 640` toolbar had never been rendered.** `bookmarks.tsrx` keeps a
      `@media (min-width: 640px)` block that rewrites `.toolbar` from one column into `minmax(0, 1fr)
      220px`, pins `.search` across both columns, and puts `.sort` in the fixed column with `.meta`
      beside it on row 2 — and row 50 mounted that page only at the session's own ~500px, below the
      breakpoint, so a deleted pin restored the ragged three-line toolbar the block's own comment
      records and every gate stayed green. Row **50 extended** (no new row; `EXPECTED_ROWS` stays
      **55**): after its last tab press the row takes `640×740` then `360×740`, reads one
      `readToolbar()` at each and hands it to `assertToolbar(r, width)` — 640 asserts a `grid` of
      **exactly two** tracks with the second `220 ± 1`, `.search` spanning the toolbar, `.sort` on
      row 2 under the search, **`|sort.bottom − meta.bottom| ≤ 2`** (the count beside the sort),
      `meta.left < sort.left − 1`, `sort.left` inside the 220px column + 16px gap, and the pager's
      200px minimum only where a pager is drawn; 360 asserts **one** track and the three children
      stacked. Measured 640: `["336px","220px"]` gap `12px 16px`, search `24→596` bottom `276.98`,
      sort `376→596` bottom `354.58`, meta `24→360` bottom `354.58`; 360 `["308px"]`, search bottom
      `268.19`, sort `278.19→343.78`, meta `353.78→372.97`. Red first: deleting `.meta {
      grid-column: 1; grid-row: 2 }` put **row 50 alone** red reading *".sort ends at 354.58 and
      .meta at 385.77 — the sm block puts them on one row (grid-row: 2), so the saved count sits
      beside the sort, not under it"*. Bytes restored (`cp` + `cmp` identical), `check.sh` **GREEN**,
      55/55 local, 55/55 `--live`, `publish.sh` → `LIVE` (asset `index-DPoxP2Sr.js`, unchanged: no
      page file moved), `curl` **200**. Brief: `docs/NEXT.md` (T-79).
      Found: the ticket's `|sort.top − meta.top| ≤ 2` was **wrong on a right page** — the two boxes
      are bottom-aligned (`align-items: end`) and their heights differ, so the tops read `288.98`
      vs `335.39`; the assertion that carries the fact is the **bottoms**.

- [x] **T-78 `/user/[handle]`'s `sm 640` head had never been rendered.** `user-profile.tsrx` keeps a
      `@media (min-width: 640px)` block that turns `.profile-head` from **two** tracks with the action
      on a second row into **three** tracks on **one** row (`72px minmax(0, 1fr) auto`, areas
      `"avatar who action"`) and raises `.name` 22 → 26px — and rows 45–47 mount that page only at the
      session's own ~500px, below the breakpoint, reading names and lists rather than geometry. So
      deleting `grid-template-areas: "avatar who action";` dropped the Save/Edit pair back under the
      name at the width that exists to put it beside, and every gate stayed green. Row **46 extended**
      (no new row; `EXPECTED_ROWS` stays **55**): after the Cancel assertions the row takes `640×740`
      then `360×740`, reads one `readHeadAt()` at each and hands it to `assertHead(r, width)` — 640
      asserts **three** tracks with the first `72 ± 1`, avatar/who/action tops within 2px of each other,
      `who.left ≥ avatar.right − 0.5` and `.name` **26px**; 360 asserts the opposite in the same words
      (**two** tracks, first `56 ± 1`, `head-action.top > head-avatar.top + 1`, `.name` **22px**). A
      one-direction read cannot show a breakpoint, which is why both are read. Measured 640:
      `["72px","225.188px","238.812px"]` gap `18px`, tops `80/80/80`, `who.left 114`; 360:
      `["56px","238px"]` gap `14px`, tops `76/76`, action `218.95`. Red first: deleting the areas line
      put **row 46 alone** red reading *".head-action sits at top 208.66 and the avatar at 80"*. Bytes
      restored (`cp` + `cmp` identical), `check.sh` **GREEN**, 55/55 local, 55/55 `--live`,
      `publish.sh` → `LIVE` (asset `index-DPoxP2Sr.js`, unchanged: no page file moved), `curl` **200**.
      Brief: `docs/NEXT.md` (T-78).
      Found: the deletion leaves the **track count at three** (the base block's two-area template still
      names `action`, and the sm `grid-template-columns` still declares three columns), so the count is
      green and the **tops** are what fires — the mirror of T-77, where the count stayed three and the
      first track was the witness.

- [x] **T-77 the three catalogue detail pages' `sm 640` arm had never been rendered.** Each keeps its
      own `@media (min-width: 640px)` block that rewrites `.head` from two tracks to `320px
      minmax(0, 1fr) auto` (the portrait moving out of `grid-column: 1 / -1` into column 1 **beside**
      the identity, `.identity-text` into column 2 of row 1, `.menu-btn` into column 3), sets
      `.title` 26 → **34px**, `.prose` 14 → **15px** (lorebook also `.entry-text`), and turns
      `.vote`/`.save` from `flex: 1 1 auto; min-width: 96px` into `flex: 0 0 auto; min-width: 132px` —
      and row 54 measured 360 and 1200 only, so deleting `grid-template-columns` from
      `preset-detail`'s `sm` block left the portrait over the name at the one width the design ladder
      puts it beside and `check.sh`, all 55 rows and the live walk stayed green. Row **54 extended a
      third time** (no new row; `EXPECTED_ROWS` stays **55**) and reshaped **width-major**:
      `SPLIT_WIDTHS = [360, 640, 1200]` takes one override per width and mounts character, lorebook and
      preset inside it, so nine readings cost **three** overrides where the old page-major shape cost
      four, and `assertPhone()` became `assertSplit(r, { label, path, width, counts })` answering all
      three widths. At 640, on all three pages identically: `.head` `grid → ["320px","168px","44px"]`,
      portrait right **344** ≤ identity left **364**, tops **80/80**, title **34px**, prose **15px**
      (lorebook entry **15px**), vote/save **132px grow 0**, and `.cols` still the phone
      `flex column` (aside top **469** < main **594.8**, both **572** inside the 620px outlet) — the
      `sm` block touches `.head` and the type, never `.cols`. At 360 the same pages read title `26px`,
      vote/save `96px grow 1`; at 1200 `["362px","320px"]`. Red first: deleting
      `grid-template-columns: 320px minmax(0, 1fr) auto;` from `preset-detail.tsrx`'s `sm` block put
      **row 54 alone** red reading *"preset at 640px: the head's first track resolves to
      \"290.797px\" (tracks [\"290.797px\",\"197.203px\",\"44px\"]), not the 320px cover column the sm block
      declares"*. Bytes restored (`cp` + `cmp` identical), `check.sh` **GREEN**, 55/55 local, 55/55
      `--live`, `publish.sh` → `LIVE` (asset `index-DPoxP2Sr.js`, unchanged: no page file moved),
      `curl` **200**. Brief: `docs/NEXT.md` (T-77).
      Found: the deletion leaves the **track count at three** (an implicit third column appears for
      `.menu-btn`), so the count assertion never fires — the **first-track** assertion is what catches
      it. And the profile page's own `sm` head has never been rendered either — filed as **T-78**.

- [x] **T-76 the two pages T-75 mounted still had an unrendered *phone* arm.** Each of the three
      catalogue detail pages carries its own copy of the base block (`.cols { display: flex;
      flex-direction: column; gap: 20px }`, `.aside { order: -1 }`) and only `character-detail`'s had
      ever been measured — so deleting `order: -1` from `preset-detail.tsrx` dropped the engagement
      row below a 60-line description on a phone while `check.sh`, the other 54 rows and the live walk
      all stayed green. Row **54 was extended** again (no new row; `EXPECTED_ROWS` stays **55**): the
      character-only phone assertions became one shared `assertPhone(r, { label, path, counts })` plus
      a `phoneEvidence()` printer, and the row's phases are character 360 → character 1200 → the
      lorebook+preset pair at 360 → the pair at 1200. The override is browser-level and survives
      `go()`, so each phase re-takes it (four overrides, not six) and every reading asserts
      `innerWidth` rather than assuming the width carried over. Per page at 360: `.cols` computes
      `flex`/`column` with **no** grid tracks (the display is read first — a flex box's
      `gridTemplateColumns` is the literal `none`), `aside.top < main.top − 1`, `|aside.width −
      main.width| ≤ 1`, both inside the outlet, and — only where drawn — four `.count` cells. Measured:
      lorebook *Ashmarket Gazetteer* aside **545.58** < main **723.38**, preset *Long Table* **515.69**
      < **641.48**, character **572.38** < **802.17**, all three 308px inside the 340px outlet, 4 count
      cells, `scrollWidth 350/360`. Red first: deleting `.aside { order: -1 }` from `preset-detail.tsrx`'s
      base block put **row 54 alone** red (54/55) reading *"preset at 360px: .aside sits at top 1102.64
      and .main at top 515.69 — the aside is not above the description…"*. Bytes restored (`cp` + `cmp`
      + `sha256sum -c`), `check.sh` **GREEN**, 55/55 local, `publish.sh` → `LIVE` (asset
      `index-DPoxP2Sr.js`), `curl` **200**, 55/55 `--live`. Brief: `docs/NEXT.md` (T-76).
      Found: the same three pages' **`sm 640`** block (`title` 34px, `prose` 15px, `.vote`/`.save`
      `min-width: 132px`, plus lorebook's `.entry-text` and character's `.start`) has still never been
      rendered — filed as **T-77**.

- [x] **T-75 the three catalogue detail pages each keep their *own copy* of the `lg` rules, and only one
      copy had ever been rendered.** `lorebook-detail.tsrx` and `preset-detail.tsrx` carry the same three
      declarations as `character-detail` (`.cols` = `minmax(0, 1fr) 320px`, `.aside`
      `grid-column: 2; grid-row: 1; order: 0`, `.main` `grid-column: 1; grid-row: 1`) but each inside its
      own `<style>` block, so nothing made the three agree: a deleted `grid-column: 2` on the lorebook page
      put the aside under the description at 1200 on a page no row measures — green in `check.sh`, in 54
      rows and on the live walk. Row **54 was extended** (no new row; `EXPECTED_ROWS` stays **55**): after
      its 1200 read it `go()`es to `/lorebook/10eb00c5-…0002` then `/preset/9e5e7000-…0002` (`…0001` is
      rows 42/43's refusal road), waits on `.cols .main` **and** a non-empty `h1.title`, and asserts per
      page: two grid tracks, the second `320` ±1, `.aside.left ≥ .main.right`, `|aside.top − main.top| ≤ 2`,
      no horizontal scroll, and — only where drawn — four `.count` cells. Measured: *Ashmarket Gazetteer*
      and *Long Table* both `["362px","320px"]`, aside left **747** ≥ main right **715**, tops **477/477**.
      The override stays live across both mounts (read back each time, not assumed), the same `finally`
      clears it and `innerWidth` is asserted back. Red first: the ticket's own edit — deleting
      `grid-column: 2;` — walks **GREEN**, because `.main`'s explicit placement plus `.aside`'s
      `grid-row: 1` auto-places column 2 anyway. Aimed at the aside (`grid-column: 2` → `1`), **row 54
      alone** went red (54/55) naming the lorebook page and its span (`353–715` against main's `715`).
      Bytes restored (`cp` + `cmp`), `check.sh` **GREEN**, `publish.sh` → `LIVE`, `curl` **200**, 55/55
      local and 55/55 `--live`. Brief: `docs/NEXT.md` (T-75).
      Found: the two pages' **phone** arm (`.cols` flex column + `.aside { order: -1 }`) still has no row
      — only `character-detail`'s 360 phase measures it — filed as **T-76**.

- [x] **T-74 `moderation-detail`'s split is a *different* composition and no row had rendered it.**
      The fourth detail page is the only one that is not the `lg` grid: its `.cols` is a flex column on a
      phone that becomes a **flex row at `md 900`** (not 1200), its aside is `flex: 0 0 340px` with
      `position: sticky; top: 24px`, and it sets **no `order`** — the decision panel deliberately sits
      *below* the description, the opposite of the three catalogue detail pages. No row had taken an
      override on it, so a row that copied row 54's assertions would have been red on a right page, and a
      collapsed 340px panel, a sticky box that never became static again, or an aside under the main was
      green in `check.sh`, in 54 rows and on the live walk. Row **55** (`EXPECTED_ROWS` 54 → 55,
      **read-only**) opens `/moderation/4e90047a-…0002?admin=1` (row 20's road; row 20 has already
      concluded that case, so the aside draws the decision record — same composition), reads the title and
      the `case · post` kicker off the page, takes its own `900×740` and `1200×740` overrides, settles two
      frames each, clears them in a `finally` and **asserts** `innerWidth` came back (T-32). At 360:
      `.cols` `flex`/`column`, no grid tracks, aside **below** main (`931.02 > 234.39`), both 308px inside
      the 340px outlet, computed `position: static`, no horizontal scroll. At 900: `.cols`
      `flex`/`row`, aside **340** beside the main (`left 507 ≥ main right 475`), tops equal, `sticky` /
      `top: 24px`, no horizontal scroll. At 1200 the same facts (`.cols` 714 there vs 730 at 900 — the
      outlet's padding narrows at `lg`, so the two are not the same box and the evidence says so). Red
      first: deleting `flex: 0 0 340px` from the `md` block put **row 55 alone** red (54/55) reading *"at
      900px .aside measures 111.05px, not the 340px the md block fixes"*. Bytes restored (`cmp`),
      `check.sh` **GREEN**, `publish.sh` → `LIVE`, `curl` **200**, 55/55 local and 55/55 `--live`. Brief:
      `docs/NEXT.md` (T-74).
      Found: the three catalogue detail pages each keep their **own copy** of the `lg` rules and only
      `character-detail`'s has ever been rendered — filed as **T-75**.

- [x] **T-73 the detail pages' `lg` two-column composition had never been rendered.**
      Four detail pages share one `.cols` of `.main` + `.aside` — a column on a phone with the aside
      lifted by `order: -1`, a two-column grid from `lg` with a 320px aside (and `moderation-detail`
      different: a flex row from `md 900`, 340px sticky). No row had ever taken an override on it, so a
      grid that collapsed, an aside under a 60-line description, or a 320px column past the 794px outlet
      was green in `check.sh`, in all 53 rows and on the live walk. Row **54** (`EXPECTED_ROWS` 53 → 54,
      **read-only**) opens `/character/…0002`, reads the name off the page (row 42 renames a character),
      takes its own `360×740` and `1200×740` overrides, settles two frames each, clears them in a
      `finally` and **asserts** `innerWidth` came back (T-32). At 360: `.cols` `flex`/`column`, **no**
      grid tracks (a flex box's `gridTemplateColumns` is `none` — the read is guarded on the display),
      aside above main, both 308px inside the 340px outlet, four `.count` cells, no horizontal scroll. At
      1200: grid of `["362px","320px"]`, aside `left 747 ≥ main right 715`, tops equal, four count cells,
      no horizontal scroll. Red first: deleting the mobile `.aside { order: -1 }` put **row 54 alone** red
      (53/54) reading *"at 360px .aside sits at top 1276.13 and .main at top 572.38 — the aside is not
      above the description"*. `check.sh` **GREEN**, `publish.sh` → `LIVE`, `curl` **200**, 54/54 local
      and 54/54 `--live`. Brief: `docs/NEXT.md` (T-73).
      Found: the fourth page's split is a *different* composition (a `md 900` flex row with a 340px
      sticky aside and no `order`), so a copied row would be red on a right page — filed as **T-74**.

- [x] **T-72 `/terms`' desktop rail had never been rendered by a walk.**
      Row 52 proves the page's copy at the walk's own 500×653; `/terms` is the only page with a
      page-level desktop composition (`.contents`: 200px, sticky, `display: none` below 1200) and no
      row had ever taken an override on it — a rail that overflowed the 794px outlet, a prose column
      that grew past its measure, or a `display: none` that never turned on was green in every gate, in
      all 52 rows and on the live walk. Row **53** (`EXPECTED_ROWS` 52 → 53, **read-only**) takes its
      own `360×740` and `1200×740` overrides, settles two frames each, clears them in a `finally` and
      then **asserts** `innerWidth` came back (T-32). At 360: `.contents` computes `none`, `.doc` is
      one track, `.lede` and every `.note-body` fit inside `.outlet`, no horizontal scroll. At 1200:
      `.contents` computes `flex`, 200px, `sticky`; `.doc` is a grid of two tracks whose prose column
      is ≤ 720; the rail's fragments **equal** the page's heading ids in the page's own order (read off
      `.rule[id]`/`.note[id]`, never pinned to eight anchors) and every fragment resolves. Red first:
      the ticket's own edit (`minmax(0, 1fr)`) walks **green** — the prose track is 458px either way,
      because the 794px A4 outlet caps it before 720 can bind — so the red proof is deleting the `lg`
      block's `display: flex` on `.contents`, which put **row 53 alone** red (52/53) reading *"at
      1200px .contents computes to \"none\" and measures 0px"*. `check.sh` **GREEN**, `publish.sh` →
      `LIVE`, `curl` **200**, 53/53 local and 53/53 `--live`. Brief: `docs/NEXT.md` (T-72).
      Found: the same `scrollWidth === innerWidth` trap in the accept line (the gutter makes a right
      page read 350/360 — the rule is an inequality); and the four detail pages' `.main` + `.aside`
      split has never been rendered either — filed as **T-73**.

- [x] **T-71 /terms is the one route no row had ever mounted.**
      `pages/terms.md` is pure copy — three prohibitions and five notes — and it is the page T-69's
      word-break class broke twice by hand (*Finishingonboardingis the acceptance*, *beside Finish*),
      yet `grep -n "terms" scripts/smoke.mjs` was empty: `/terms` was the last route in
      `src/router.ts` no row named. Gate section 10 proves the **bundle** carries no literal glued to
      an inline tag; a row proves the **sentence**, the half every walk row exists for. Row **52**
      (`EXPECTED_ROWS` 51 → 52, **read-only**) mounts `go("/terms")` and asserts the page by its own
      marks (`.kicker` *content rules* + `h1.title` *Three prohibitions* + a non-empty `.lede` +
      **no `.detail`**, so a page sharing a root class cannot pass), the five `section.note` ids in
      the page's own order with a `.note-title` on each, the three `.rule-title`s (read from
      `TERMS_RULES`, asserted only for count and distinctness), and the accepting-the-terms
      paragraph's words — `Finishing onboarding is the acceptance` / `beside Finish`, with
      `Finishingonboarding` and `besideFinish` named as the failure. Whitespace is collapsed **in
      Node**, never inside the `js(…)` template, so the page expression carries no regex and the T-49
      double-escaping trap cannot reach it. Last half: a document-identity mark, a press on the
      sentence's own link, the landing read as `/onboarding`'s heading (*Claim your handle*),
      `expectNoReload` (a URL match cannot see a re-boot), then `history.back()` polling back to the
      terms heading with the mark intact. Red first, aimed at the copy clause: dropping the `{" "}`
      before *is* put **row 52 alone** red (51/52) reading *"/terms' accepting-the-terms paragraph
      reads \"Finishing onboardingis the acceptance: …\" — it is missing [\"Finishing onboarding is the
      acceptance\"]"*. Bytes restored, `check.sh` **GREEN** (section 10 on the rebuilt bundle: `62
      asset(s), 620 KB, 233 inline tag(s); no literal is glued to an inline element`), `publish.sh` →
      `LIVE`, `curl` **200**, 52/52 local and 52/52 `--live`. Brief: `docs/NEXT.md` (T-71).
      Found: `/terms` is the only page with a page-level desktop composition (a 200px contents rail
      beside a 720px prose column, `lg` only) and no row has ever taken an override on it — filed as
      **T-72**.

- [x] **T-70 The word break between a literal and an element had no guard.**
      T-69 fixed seven sites by hand and only `/persona` had a row that would notice the bug coming
      back; the argument this repo has answered twice (T-46's `link-check.mjs`, T-48's
      `tier-check.mjs`) is that a hand sweep is a list and the gate is the guard. `scripts/wordbreak-check.mjs`
      is **gate section 10**, after the build because it reads `dist/assets/*.js` — the compiled
      template is the truth, since the same source line keeps or loses its space depending on whether
      the compiler buckets it into a piece array or a static HTML string (T-69's own find). Both
      directions, over every asset: a letter/digit/dot/paren glued to an inline `OPENING` tag
      (`[ >]` demands the tag's own shape, so minified `a<b` comparisons and `class=` stay out) and a
      closing tag glued to the following word. Zero hits is green; each hit prints ~60 chars either
      side of the glue; file arguments make the red proof run on a copy, never an edit to the tree
      (T-48's scanner shape). Inline set in one constant (`a|b|span|strong|em|code|i|small`), block
      tags exempt on purpose — whitespace beside a `div` carries no word break. Drift guards: no
      asset or no inline tag at all is a red, not a green. **The guard earned its keep on its first
      run**: besides the seven T-69 sites (green, unchanged), it read **two** hits in
      `dev-native.tsrx`'s prose — `…never needs a` + newline + `<code>try</code>`, which really
      rendered *"needs atry"* on `/dev/native` (`{" "}` added), and `must read` + `<b> cancelled</b>`,
      which rendered correctly only because of the space *inside* the element and now writes the
      house shape `read{" "}<b>cancelled</b>`. Red proof from **one** injected copy, both directions
      named: *(an opening tag): …page never needs a&lt;code&gt;try&lt;/code&gt;…* and *(a closing tag):
      …&lt;/a&gt;if to render “nothing happened”…* — then 51/51 local and 51/51 `--live`. No row added;
      `EXPECTED_ROWS` stays **51**. Docs: `ARCHITECTURE.md` → *Copy and markup* (the rule, the
      compiled-bucketing reason, and the dynamic half this scan cannot see).
      Found: **`/terms` is the one route no row has ever mounted** — and it is the page where T-69
      found this class twice by hand — filed as **T-71**.

- [x] **T-69 The persona no-match sentence ran two words together, and the class was everywhere.**
      Row 51 read `/persona`'s no-match state and it came back `No persona matches that name. Create
      oneif it is not here yet.` — Ripple trims a **literal's boundary whitespace when its neighbour is
      an element**, so the source's `</a> if` rendered `</a>if` (an explicit `{" "}` survives; a
      literal next to a `}` *expression* keeps its space — `NsfwControl`'s `` ` … flagged ` +
      (noun + ` in listings.`) `` in the built bundle proves it, so the sweep is element-only).
      `persona-collection.tsrx` writes the explicit space now, and the same edit was applied to
      **every** site the class touched in the built bundle: `/terms` (`Finishingonboardingis the
      acceptance` — both sides of the link), `/onboarding` (*the* / *terms of use*), `/persona/<id>`'s
      picker sentence, `/user/<handle>`'s two figures (`3followers`), and `/dev/{data,state,native,
      primitives}`' badge rows. Row **51** gained one clause (no row added, `EXPECTED_ROWS` stays 51):
      the sentence must contain `Create one if` and must not contain `oneif`, and its evidence line
      reads **with its word break**. Red proof: the literal restored, bytes otherwise identical →
      **50/51**, row 51 alone: *"/persona: the no-match sentence reads \"No persona matches that name.
      Create oneif it is not here yet.\" — it runs the words either side of the link together …"*.
      Bytes restored, then 51/51 local and 51/51 `--live`. Brief: `docs/tickets/T-69-no-results-copy.md`.
      Found: **the hand sweep is still the only check for this class** — the walk visits a page per
      row, and the mechanism is mechanical over the built bundle (two greps over `dist/assets/*.js`
      found every site and then read zero after the fix) — filed as **T-70**.

- [x] **T-68 The other three pages that commit a query, one press each.**
      T-66 moved seven pages onto `commitQuery()` and one row walked each half of that: row 49 the
      character catalog, row 50 `/bookmarks`. `/lorebook/catalog`, `/preset/catalog` and `/persona`
      were the same toolbar over another entity and **no row had ever typed into any of them** — a
      `writeQuery()` reverted to `navigate()` (a caret lost mid-typing), a sort vocabulary copied
      wrong, or a persona search that dies on a pasted URL was green in every gate and all 50 rows.
      Row **51** (`EXPECTED_ROWS` 50 → 51, **read-only**) reads three pages with one shared reader
      and a `TOOLBAR_PAGES` table carrying each page's own grid label: `/lorebook/catalog` (5 cards,
      `?q=Cartographer's` → 1 of 5, caret `INPUT.field-input`, `?sort=ratio` = **Top rated**),
      `/preset/catalog` (4 cards, `?q=Two-Hander` → 1, same sort), and `/persona` (2 `.persona-card`s
      after row 41; `?q=Ash` → 1, `?sort=name` = **Name** with `["Ash","The Correspondent"]`, and
      `?q=zzqx-nothing-matches` is its own *"No persona matches that name."* state with **no** Retry).
      Every failure message names the page it was on. Red first, aimed at the seam:
      `lorebook-catalog.tsrx`'s `writeQuery()` → `navigate(path, { replace })` (plus `void
      commitQuery;` to keep the build clean) gave **50/51** and row 51 alone: *"/lorebook/catalog: the
      search field lost the caret the moment it settled (document.activeElement is BODY., the field
      reads "Cartographer's", URL "?q=Cartographer%27s") — a query write that emits remounts the page
      mid-typing"*. Bytes restored, then 51/51 local and 51/51 `--live`. Brief: `docs/NEXT.md` (T-68).
      Found: **every lorebook and preset fixture ships `tags: []`**, so the tag picker's vocabulary
      (`listTags`) is empty on both pages and a **chip's press** cannot be walked — the row asserts
      the picker's own *"No other tags yet."* and the pasted-`?tags=` road instead, and its press
      branch waits on a fixture — filed as **T-69**.

- [x] **T-64 The profile's four tabs are a URL fact, and a follower is drawn as a catalog card.**
      `user/profile.md` → *Layout* / *Actions* / *URL*: four tabs in `?tab=`, the creations filter in
      `?type=` (**read on that tab only**), and *"Followers and Following are drawn with the catalog
      card … the bio in the tagline's slot, and a footer carrying followers and following instead of
      an author and a ratio"*. Rows 2, 45 and 46 read only `.profile-head`, so **no row had ever
      pressed a tab**: a tab drawing another tab's body, a `type` leaking onto posts, a header that
      remounted on a swap and a follower card that grew `.card-author` + `.card-ratio` were green in
      every gate and all 46 rows. Row **47** (`EXPECTED_ROWS` 47, read-only — no store write, no
      preference) reads the session's own handle from `/`'s *Open profile* link, asserts the head
      (name, `@handle`, bio, two figures, the four tab labels in order), marks the mounted
      `.profile-head` with an expando, then presses each tab and asserts the search (`tab=posts` /
      `followers` / `following`), the body (`.feed .card.post` vs `.card-handle` people cards vs the
      creations grid), `aria-selected`, and that **the marker survived** — a remount is the only proof
      a tab swap kept the page. On creations it presses `Characters` (every card's title links
      `/character/`), then `All` (`type` leaves the URL), and proves `?tab=posts&type=preset` settles
      to `?tab=posts` with no type control. On followers it reads the card's anatomy (title, `@handle`,
      the bio as `.card-tagline`, a two-figure footer, no author, no ratio), presses a card, asserts
      the landing's name **and bio** match the card, `history.back()`, and polls the search and the body
      back. Red first, twice: `chooseTab`'s `load()` swapped for `loadCreations()` → *"posts tab to draw
      its own body at tab=posts — read {…"posts":0,…"empty":"No posts yet.","marked":true}"*;
      `UserCard`'s footer given `.card-author` + `.card-ratio` → *"the follower card grew
      [".card-author",".card-ratio"] … a person's card carries followers and following, never an
      author and a ratio"*. 47/47 local and 47/47 `--live`. Brief: `docs/NEXT.md` (T-64).

- [x] **T-62 A rename out of `/user/[user.username]/edit` moves the row, the content and the graph.**
      `user/edit.md` is law in four places nothing had executed: the handle rule, *"Changing it moves
      the profile URL and no alias is kept, so a link to the previous handle reports not-found rather
      than redirecting; the account keeps its content, follows, and bookmarks"*, and *Handle changed*
      — *the profile loads at the new URL*. Row 3 mounted the form and stopped at the push proof, so
      `saveProfileEdit()` had never been pressed. Row **45** (`EXPECTED_ROWS` 45) reads `/user/you`'s
      name, handle, bio, both follow figures and creations count, asserts the form's prefill
      (`input[name="username"]`, not `handle`; **Save** enabled), renames to `edit_walk` with one
      **Save**, re-reads the landing on all five, proves `/user/you` now answers *This user doesn't
      exist.* with no profile, reads the account's own comment signed `@edit_walk`, `/`'s sentence at
      the new handle, and renames back — restoring the whole pair with `/` read again. One product
      bug fixed: a comment is signed by its author's handle and `renameAccount()` moved everything
      *but* comments, so after a rename every comment the account wrote still read `@you` on a
      profile that answered not-found; `store.comments` moves with the rest now. Red first, twice:
      deleting the comment loop → *"the comment the account wrote reads \"@you\" after the rename,
      not @edit_walk"*; deleting the authored-row loop → *"the renamed profile draws 0 creation
      card(s), not 5"* (44/45 both times). Bytes restored, tree clean. 45/45 local and 45/45
      `--live`. Brief: `docs/NEXT.md` (T-62).

- [x] **T-61 Claiming a handle on /onboarding is a gate, a refusal and one draft write.**
      `onboarding.md` was law in four places nothing executed (the case-insensitive uniqueness gate
      with **Finish** disabled, the `[a-z0-9_]` 3–24 rule lowercased on save, *only Username and
      Display name block Finish*, and *the whole form is written in one save, so an abandoned first
      run keeps what was typed*), and `/onboarding` was the **only** route in `src/router.ts` that
      `scripts/smoke.mjs` never mentioned. Row **44** (`EXPECTED_ROWS` 44) borrows `@you`, asserts a
      first visit is blank with the rule as help, reads `"ab"` → the schema's sentence and `"Ada"` →
      **`Username taken`** (uppercase, so case-insensitivity is the proof) with Finish disabled both
      times, claims a free handle and reads the landing and `/`, then revisits the form (the saved
      pair restored) and hands `@you` back. Two bugs found and fixed in the same commit:
      `saveProfile` wrote only the session record (so `/user/<handle>` read *This user doesn't
      exist.* while the old handle stayed claimed) — `renameAccount()` is now the one body for a
      claim and a rename, shared with `saveProfileEdit`; and the uniqueness verdict rode the draft
      write (silent until a name existed) — `askUniqueness()` asks on the handle's own settle. Red
      first by dropping `&& !taken.value` from `canFinish` → *"Finish stayed enabled on a taken
      handle …"*; bytes restored, `sha256sum -c` clean. 44/44 local and 44/44 `--live`. Brief:
      `docs/NEXT.md` (T-61).

- [x] **T-59 An author's edit never reaches a running session, and a published cut is a snapshot.**
      Failure-bank entry 2: *Session reads live items, so author edits corrupt running chats → copies
      only*. `session/detail.md` → **Purpose**: *the character, every lorebook attached to that
      character, and the preset are snapshotted when the session starts, and the session reads only its
      own copies from then on*, and → *Data* → *Transcript*: *a cut already published is a snapshot no
      later change in the session touches*. T-15 implemented the copies and row 33 read session 2's copy
      *states*, but **no row had ever edited a live item and looked at a session**, and **no row had
      ever published a cut** — a `getSession()` that joined the character by id, or a cut stamped from
      the live item, was green in every gate and all 41 rows. Row **42** (`EXPECTED_ROWS` 42) opens the
      seed's character (`…0001`) and presses **its own Continue** (no pinned session id), reads the
      Character copy (`Aurelia`, `untouched`, `From Aurelia of the Tides · version 4`, 1 link,
      *Update from original*), walks to the original **through the copy's `a.copy-link`**, renames the
      **live** character on `/character/<id>/edit` — **name and in-session name**, because the row
      prints `inSessionName || name` and a `name`-only edit would leave a live-join page reading the
      same string — saves, reads the detail's new name and `.in-session` line, then `go()`s back and
      asserts the copy's **name, state, detail, controls and summary are unchanged**. Then publishes
      the whole transcript as a **cut** (`Publish a cut` → range → `Continue` → the locked note
      *published as text, not a link to the session* → `Publish`) and reads the post's own page: 8
      messages, the transcript's first turn verbatim, the first line stamped `Aurelia · character`,
      and no trace of the live item's new name. Last, a **second** live rename, then the post again —
      body and cut identical. Proved **red** first by making `load()` join the live character in
      `session-detail.tsrx` → *"the copy followed the author's edit: the Character copy read
      \"Aurelia\" before … and \"Aurelia Rebuilt\" after … character detail \"From Aurelia of the Long
      Tide · version 4\""* (41/42); bytes restored, `sha256sum -c` clean. 42/42 local and 42/42
      `--live`. Brief: `docs/NEXT.md` (T-59).

- [x] **T-58 Deleting the default persona hands the mark to exactly one heir, in one step.** Failure-bank
      entry 8: *Deleting a persona leaves the collection without a default → reassign in one step*.
      `persona/collection.md` → *States* → **Populated**: *"exactly one carrying the default mark"*, and
      *"the collection is never left with personas and no default"*. `memory.ts` `deletePersona()` hands
      the mark to the **newest remaining** persona, but no row had ever pressed **Delete** on a persona —
      the collection was only ever read (row 34). Row **41** (`EXPECTED_ROWS` 41) reads `/persona` as
      data (3 cards, one `.is-default` / one `.persona-card-mark` reading `default` — **Nell**,
      `PERSONA(1)`), opens **that** card's own link (not `nth 0`), asserts the detail's `h1.name` and its
      `.mark`, then deletes in **two presses** (`Delete` in `.delete-row`, then `Confirm delete` scoped
      to `.delete-actions` — a `startsWith` match hits the opener, the T-49 trap) and reads the landing in
      one pass: path `/persona`, **2** cards, Nell absent, exactly one mark, and it is **Ash** — the heir
      is the newest by `createdAt` (`PERSONA(3)`, `at(16,4,10)`), while The Correspondent is the second
      card and the *oldest*. Last half: `go()` back to the deleted id mounts the spec's **Not found**
      sentence with its `/persona` road out (no heading, no form). Proved **red** first by disabling the
      hand-off (`if (false && row.isDefault)`) → *"2 card(s) ["Ash","The Correspondent"] at "/persona", 0
      .is-default [] — the collection was left with 2 persona(s) and 0 default(s)"* (40/41); bytes
      restored, `sha256sum -c` clean. 41/41 local and 41/41 `--live`. Brief: `docs/NEXT.md` (T-58).

- [x] **T-56 One vote per viewer: a repeat is not a vote, a switch moves one count.** Failure-bank
      entry 5: *Voting allows multiple votes per viewer → uniqueness in adapter and DB*.
      `character/detail.md` → *Actions*: *"one vote per viewer; switching replaces the previous
      vote"*, and *States* → **Voted** is a state that has to survive. Nothing had ever read a count
      around a vote: row 8 presses a brand-new post's Like and reads `aria-pressed`, which a doubled
      count leaves exactly where it was. Row **40** (40/40 local and `--live`) opens Sonic
      (`…0002` — opened by five earlier rows, voted on by none), reads the four engagement cells
      **per label** (Ratio is a percent), and asserts **deltas** from a recorded seed: Like →
      +1 like; Like **again** → the same numbers, re-read 300 ms later; Dislike → the like is
      *replaced* (like back to the seed, dislike +1, exactly one `.vote` pressed); a remount through
      `/character/catalog` keeps the Dislike pressed and the numbers; then back onto Like, one vote.
      Proved **red** first — and the ticket's suggested edit was wrong: deleting only
      `if (previous === direction) return row` stays **green** (the decrement/increment pair is
      symmetric, so a repeat nets zero). Removing **both** read `a repeated Like moved Likes to 414;
      one vote per viewer means it stays at the seed's 412 + 1`, and removing only the two decrements
      read `Likes read 413 after the switch; the Like was replaced, so it must be back at the seed's
      412`. Brief: `docs/NEXT.md`.

## Failure bank (the ways this class of product breaks)

1. Card blur hides the numbers → footer stays outside the blur (T-08; walked by T-54).
2. Session reads live items, so author edits corrupt running chats → copies only (T-15; walked by
   T-59).
3. `Load more` state lost on back → paging in component state, filters in URL (T-09; the URL/sort half
   is walked by T-55, the paging half by T-57).
4. NSFW preference treated as access control (404s) → detail routes always resolve (T-25; walked by T-53).
5. Voting allows multiple votes per viewer → uniqueness in adapter and DB (T-03, T-29; walked by T-56).
6. Report piles create one scan per report → cumulative case joins (T-27).
7. Deleting an item orphans its thread → cascade delete (T-29).
8. Deleting a persona leaves the collection without a default → reassign in one step (T-20; walked by
   T-58).
9. JEV deletes authored content → visibility only, ever (T-27).
10. API keys end up in the client bundle → server-only Edge Functions (T-32).
11. Preview build looks produced but is mock → `Preview mode` chip stays until real backend (T-16).
12. Deep links 404 on Pages → `404.html` fallback published by `publish.sh` (T-01).
13. Repo goes private again → Pages breaks; `check.sh` warns if the remote is private.

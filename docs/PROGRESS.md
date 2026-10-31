# Progress log

Append-only. Newest first. Every entry: ticket, what changed, what was verified and how, what
could not be verified.

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

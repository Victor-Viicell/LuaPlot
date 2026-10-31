# Baton — what the next session does

**Ticket: T-28B — a post can be removed, so JEV can act on one.**

Spec: `systems/jev.md` → *Rules* (the action table), *Privacy and republication* (*posts and comments
cannot be made private. Their only enforcement is removal*), *Scope*; `pages/post/detail.md` and
`components/post-card.md` for what a removed row must look like; `pages/moderation/detail.md` →
*Actions* (the conclude form already offers `removed`).

Why next: two things are still untrue of the app. `postSchema` has **no `status`**, so `clearAction()`
in `lib/llm/jevPolicy.ts` returns `escalated` for a post whose violation is certain, and `addReport`
can only queue it; and `concludeReport` refuses `outcome: "removed"` on a post for the same reason. The
comment path already does this correctly (`status: "removed"`, body gone, replies intact) — the post
path is the missing half of the same rule.

## Approach

1. **`postSchema` grows `status: z.enum(["visible", "removed"])`.** The comment's three-value enum is
   *not* reused: a post has no author-deleted placeholder row (a creator's delete removes the row).
   Fixtures: every post gains `status: "visible"`, and **one** fixture post becomes `removed` so the
   state is reachable without reporting anything.
2. **`applyJevAction` writes it**: the `removed` + `post` branch sets `status: "removed"`, and
   `clearAction("post")` in `jevPolicy.ts` returns `removed` again — delete the escalation branch and
   the sentence in its note, and update `docs/JEV.md` → *Limits of this build* in the same commit.
3. **Every listing drops a removed post; `getPost` still answers it by id** (the owner and a moderator
   open it, everyone else sees the unavailable state), exactly as `isPublic` works for authored items.
   The filter belongs in the adapter once — the feed, `/user/[username]`'s posts tab and the
   composer's *my posts* view all read the same listing.
4. **The detail page draws the state**: *This post was removed by moderation.* with no vote, no
   composer and no bookmark. **Check the thread rule before hiding anything**: `systems/jev.md` says a
   *creator's* delete takes the thread in cascade, while a *removal* is moderation's and the row
   stays — decide, then write it in `docs/DESIGN.md`.
5. **The case path stays honest**: `concludeReport` may now conclude a post `removed`, and a dismissal
   still changes no visibility. A removed post must not be counted as an open case anywhere.

## Traps

- **`status` on a post is not a visibility flag**: only removal exists; do not add `isPublic`.
- **`postSchema` is parsed by the seed check, `addPost`, `PostComposer` and every fixture** — the new
  field lands in all of them in the same commit or the gate fails at module load.
- **`ratioOf`** reads likes/dislikes only; a removed post must be absent from a ratio listing, not
  shown as a zero-engagement row.
- **`/user/[username]`'s posts feed keys on `post.id`** (noted since T-20): fix it while you are in
  that feed, it is one line.
- **Ripple**: `@for` needs `const`, an `@if` branch is one node, `effect()` is the only hook.
- Never invent a fourth status to express *pending*: JEV's uncertainty leaves a post visible.

## Found while working (carried forward — keep this list growing)

- **T-28 is done**: `moderationNoticeSchema` + `republicationOutcomeSchema` in `schema.ts`;
  `repo.moderationNotice(kind, id)` answers the newest of an immediate action's **notice row** and the
  case that hid the item (one call, two sources); `repo.requestRepublication(kind, id)` is owner-only,
  authored-only and runs `classify()` at once; `addReport`'s immediate branch writes the creator's
  notification **and** the notice row. The three authored detail pages draw the notice, the gate
  (`updatedAt > notice.at`) and the three states. The whole loop was walked in the browser.
- **The notice rows are runtime-only** in the memory adapter: report an item in the preview to create
  one, otherwise the case-derived path answers. A fixture notice would be dead seed data.
- **A refused republication rewrites the gate clock** (`noticeAt = outcome.at`), so the next attempt
  needs a newer edit — the only enforceable reading of *the request covers the item as a whole*.
- **A refused republication sets `verified: false`**: that version was not verified, and the next edit
  is what makes it eligible.
- **An immediate action files no report row** (T-27/T-28): the dialog answers `submitted`, and only
  the creator's notification and the notice row are stored.
- **`assets: []` is deliberate** (T-27): no vision pass, so an image-only report escalates
  (`imageOnly`) instead of asking a text model to judge a picture (T-32).
- **A new case needs `history: []`** — build cases through `reportSchema.parse`, which catches it.
- **"Set reason" is folded into the decision** (T-26B): one `Reason` field, `decision.reason`.
- **`event` is a DOM global**: name history helpers `historyEvent`.
- **`@for` needs `const`**: `@for (row of rows)` crashes `tsrx-tsc`; write `@for (const row of rows;
  key row.id)`.
- **An `@if` branch renders one node**: wrap a header plus a body in `<>…</>`.
- **A gate named for the positive is a bug waiting**: name the flag for its effect and check it in the
  browser — `disabled={!canRequest.value}` is the shape that works with `Button`.
- **The preview loses runtime rows on a hard reload** — every flow that writes must be walked
  **in-app**; a `goto_url` re-seed looks like a bug in the write.
- **T-26 is done**: `pages/moderation-queue.tsrx` (filter in the URL, `reportFilterSchema`,
  `relativeAge()` in `lib/format.ts`); open rows are the escalated cases only.
- **T-25 is done**: `components/NsfwControl.tsrx`; a reveal's lifetime is `CardGrid`'s `revealEpoch`,
  and any new listing that can refetch must pass it.
- **`/terms` is done** (T-24): `TERMS_RULES` + `REPORT_REASON_RULE` in `schema.ts`, ids
  `#copied-content` / `#unmarked-nsfw` / `#illegal-content`; a URL hash needs a mount jump.
- **`<a>` and `<button>` do not nest**; **`{<Component />}` inside a fragment is a parse error**;
  **`effect()` is the only lifecycle hook**; **a component's root element cannot be styled**.
- **`/notifications` is done** (T-22): `markNotificationRead`, `markAllNotificationsRead`,
  `unreadNotificationCount`, `lib/state/inbox.ts`, badge in both nav hosts.
- **Counts now: characters 28 (27 public), lorebooks 6 (5 public), presets 5, personas 3, posts 12,
  reports 5 (3 open, 2 concluded), comments 22 (one removed placeholder), sessions 2, bookmarks 8
  (one dead), notifications 6 (3 unread), profiles 7, follow edges 15.**

## When blocked

Take the next unblocked ticket in the same phase, log the blocker at the top of this file with what a
human must run, and stop. Never invent a workaround that changes the product.

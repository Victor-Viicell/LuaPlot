# Baton — what the next session does

**Ticket: T-03 — Data contract + memory adapter.**
Why next: T-05 onward are pages, and every one of them reads items, comments, notifications or
reports through `src/lib/data/repo.ts`. That file does not exist yet — there is no `src/lib/data/`
at all. Building a page before the seam exists would either invent a second source of truth or
hard-code fixtures inside a component. The primitives are done (T-02), so the first page can land
the moment this seam is real.

## Do

1. `src/lib/data/types.ts` — the entity shapes, derived from the specs, not from imagination:
   - shared item: `id` (fixed UUID string), `kind`, `title`/`name`, `author` handle, `nsfw: boolean`,
     `createdAt`/`updatedAt` (ISO strings), `likes`, `dislikes`, `bookmarks`, `commentCount`,
     `tags: string[]` (kept empty — the taxonomy is undecided), avatar reference.
   - `Character` adds `inSessionName?`, `tagline`, `description`, `lorebookIds: string[]` (references,
     never copies), `isPublic`.
   - `Lorebook` adds `description`, `entries`; `Preset` adds `description`, `settings`; `Persona`
     adds `description`, `isDefault` and **no** engagement and no NSFW flag (personal, never shared).
   - `Post` = body + at most one attachment (`characterId` or a cut from a session), no kind field,
     no edit route; `Comment` = own entity with `parentId`, `likes/dislikes`, `replyCount`, **no
     bookmark**; `Notification` = aggregated rows (`kind`, `target`, `count`, `read`);
     `Report` = `reasons`, `weight` (cumulative), `status` (`open|concluded`), `jev` verdict;
     `Session` = participant copies with `sourceId`, `version`, `edited`, `unlinked`, transcript.
   - `ratio` is **derived** (`likes / (likes + dislikes)`, 0 when there are no votes) — never stored.
   Read `src/specs/luaplot-pages.md` (conventions), `components/comment-thread.md`,
   `pages/session/detail.md`, `systems/jev.md`, `pages/moderation/queue.md` before typing a field.
2. `src/lib/data/repo.ts` — the seam. `resolveRepo()` returns the memory adapter until a Supabase
   project ref exists; every method async (`await` even in memory, so the swap is not a rewrite).
   Listing methods take `{ query?, sort?, page }` and return `{ items, hasMore }` with a page size
   of 24. Mutations return the updated entity. No `fetch` in this file.
3. `src/lib/data/memory.ts` + `src/lib/fixtures/*.ts` — ≥8 characters, 6 lorebooks, 5 presets,
   3 personas, 12 posts with comments, notifications, reports, 2 sessions with transcripts.
   Fixture ids must be real 36-char UUIDs: the router's param matcher rejects anything else.
   Make one character NSFW and one lorebook unreachable-from-a-session so T-08/T-15 can prove both
   states. Names may repeat across types on purpose (spec: names never carry identity).
4. `/dev/data` — a dev page listing counts per entity, the fixture names per kind, and a
   `resolveRepo()` badge. Same rules as `/dev/primitives`: absent from `src/specs/luaplot-pages.md`,
   absent from the tab bar, and `scripts/spec-routes.mjs` already drops `/dev/*` before comparing,
   so adding the route to `ROUTES` is enough. Use `Skeleton`, `EmptyState` and the `Card` where they
   fit — it is the second proof of the primitives against real data.

## Traps

- **Do not store `ratio`.** The card takes `ratio` as a 0–1 number; compute it in the adapter (or a
  small helper) from the vote counts. A stored percentage drifts the moment a vote is added.
- **Personas**: no engagement, no NSFW, no public catalog, no follows. If the type carries a
  `likes` field you have invented a feature the spec refuses.
- **Session copies** keep the id of their original in `sourceId`; a published cut copies message
  text and attribution. Never make a page read a live item once a session started.
- Ripple: `track()` only inside a component. Model the repo like `src/lib/router.ts` and
  `src/lib/toast.ts` — a plain store that notifies — and mirror it into a component `track()`.
  A module-scope `track()` throws on first write.
- A prop is evaluated once: pass `Tracked`/`Derived` for anything that changes and read it with
  `read()` from `src/lib/reactive.ts`. Static strings are fine as plain values.
- **Primitive styling lives in `src/styles.css`** (`docs/DESIGN.md` → "Primitives"). A page's own
  `<style>` block is layout only. Do not add a second look for `.btn` or `.card`.
- `/dev/primitives` leaves `data-theme` on `<html>` when you switch flavours — a manual dev action
  cannot survive unmounting. Press **System** before you judge the page you are building.
- The automation browser throttles CSS animations: a painted `transition` value can read as its
  start value even though the tokens are right. Verify tokens (`getPropertyValue('--color-accent')`)
  or the class/markup, not the animated paint.
- Deep links on Pages answer **HTTP 404** with `404.html` (a copy of `index.html`) and the app boots
  anyway. Only the root URL is a 200; do not "fix" the 404.
- `scripts/check.sh` is the gate: typecheck + build + `spec-routes.mjs`. It must print GREEN.

## Open decisions

- Repo method shape: `listCharacters({ query, sort, page })` per kind versus one `list(kind, opts)`.
  Default: one method per kind — the pages need type-narrow returns and the extra lines are cheap.
- Ownership of the "one vote per viewer" rule: the adapter enforces it (a vote map keyed by viewer +
  item), the page only calls `vote(id, "like" | "dislike")`.
- Pagination: `page` is a 1-based number in component state, never in the URL (spec: paging is not
  part of the URL). `hasMore` is what hides **Load more**.
- Tag taxonomy still undecided (keep `tags` empty), Stripe surface still undefined, Supabase still
  unprovisioned (memory adapter remains the truth).

## Found while working

- A scoped `<style>` block cannot style a child component's elements, so every primitive's look went
  into `src/styles.css` instead. Recorded in `docs/DESIGN.md`; do not re-open it per page.
- `ref` runs before the portal inserts the node: `element.focus()` there silently does nothing. The
  sheet retries until `isConnected`. Any future focus-on-mount needs the same wait.
- Interactions that are pure CSS (toast timer, sheet motion) are not observable in the automation
  tab; assert on state and markup instead of paint.
- `publish.sh` compares the live `index.html` bundle hash — a Pages 200 alone can still be the
  previous deploy, and it stays stale for minutes.

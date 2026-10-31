import { track, type Derived } from "ripple";
import { Avatar } from "./Avatar.tsrx";
import { Button } from "./Button.tsrx";
import { Field } from "./Field.tsrx";
import { ReportDialog } from "./ReportDialog.tsrx";
import { Skeleton } from "./Skeleton.tsrx";
import { resolveRepo } from "../lib/data/repo.ts";
import { read } from "../lib/reactive.ts";
import { commentWriteSchema } from "../lib/schema.ts";
import { initialsOf, shortStamp } from "../lib/format.ts";
import { href } from "../router.ts";
import { nsfwPreference, onPrefs } from "../lib/state/prefs.ts";
import { toast } from "../lib/toast.ts";
import type { Comment, VoteDirection } from "../lib/data/types.ts";

/**
 * The comment thread of one shared item (T-11) — `src/specs/components/comment-thread.md`.
 *
 * Four pages mount it (`/character`, `/lorebook`, `/preset`, `/post`), so nothing here may be
 * character-specific: it takes the item id and the viewer's handle and owns everything else.
 *
 * What it owns, and why:
 * - **The tree is built in code.** `listComments` answers flat rows; `build()` groups by `parentId`,
 *   sorts oldest-first at every level, folds anything below the third level onto the third indent,
 *   and drops a placeholder that has no branch left beneath it (*a comment with no replies
 *   disappears entirely*). The template renders one flat list and never recurses — a recursive
 *   `@for` in ripple 0.4.7 is a component that renders nothing.
 * - **Placeholders keep the branch.** A deleted or moderation-removed row draws its header, its
 *   time and its footer, with one sentence in place of the body and **no actions** — no vote, no
 *   reply, no report — and its replies indent beneath it exactly as under a live comment.
 * - **Collapsing is display only.** A reply list longer than three folds the rest behind
 *   `Show N more replies`; the folded rows still count in the item's count strip.
 * - **One composer, retargeted.** The spec puts the composer at the top of the thread; a **Reply**
 *   control on any row points that same composer at the comment (depth three included — the flatten
 *   rule means a reply to a reply still indents at three, so an inline third-level composer would
 *   have nowhere to go).
 * - **Counts are the adapter's.** Every write re-reads the thread and re-derives the count the page
 *   shows, because `memory.ts` recomputes `replyCount`/`commentCount` on a write. A page never
 *   keeps its own tally.
 * - **NSFW is per comment.** A flagged comment covers **its own body only** — header, time and
 *   footer stay crisp, which is the same structure the NSFW blur relies on everywhere else. The
 *   flag is never inherited from the item, and the account's Show preference is the only thing that
 *   un-covers it.
 *
 * Anchors are fragments (`#comment-[id]`), never routes: opening one expands the branch holding the
 * comment and scrolls to it.
 */

type Phase = "loading" | "ready" | "error";

/**
 * One drawn row. **Deliberately not a discriminated union**: ripple 0.4.7 loses a `kind` narrowing
 * across a branch, so a fold control is a row with `fold > 0` — a number the template can test —
 * and a placeholder is a row with `placeholder: true`.
 */
type Row = {
  key: string;
  id: string;
  author: string;
  initials: string;
  stamp: string;
  /** The ISO field the `<time>` element keeps; `stamp` is its short reading. */
  iso: string;
  body: string;
  replies: number;
  likes: number;
  dislikes: number;
  /** 0–2: the third level is the last indent (`comment-thread.md` → *Nesting*). */
  depth: number;
  placeholder: boolean;
  mine: boolean;
  /** The account's Show preference and this comment's own flag, already resolved. */
  covered: boolean;
  myVote: VoteDirection | "";
  /** > 0 on the `Show N more replies` control row; 0 on a comment. */
  fold: number;
  /** The branch a fold control expands (empty on a comment). */
  parentId: string;
  /** The row a `#comment-[id]` anchor pointed at, so it can be marked. */
  target: boolean;
};

const PLACEHOLDER_DELETED = "This comment was deleted.";
const PLACEHOLDER_REMOVED = "This comment was removed by moderation.";

function foldLabel(count: number): string {
  return count === 1 ? "Show 1 more reply" : `Show ${count} more replies`;
}

export function CommentThread({
  itemId,
  viewer,
  onCount,
}: {
  itemId: string;
  /**
   * The signed-in handle, or `""` — a signed-out visitor reads the thread, never writes it. Live
   * (`Derived`) because the account can change under the page: the preview's sign-out switch is
   * exactly that, and a frozen handle would keep drawing a composer for nobody.
   */
  viewer: Derived<string> | string;
  /** Told the thread's size after every read/write, so the page's count cell stays honest. */
  onCount?: (count: number) => void;
}) @{
  const repo = resolveRepo();

  const phase = track<Phase>("loading");
  const failure = track("");
  const entries = track<Row[]>([]);
  const signedIn = track(() => read(viewer) !== "");

  /** The composer. One draft, one flag, one reply target. */
  const draft = track("");
  const nsfwFlag = track(false);
  const replyToId = track("");
  const replyToAuthor = track("");
  const formError = track("");
  const posting = track(false);
  /** Disabled while a post is in flight and while the box is empty (`commentBodySchema` rule). */
  const denyPost = track(() => posting.value || draft.value.trim().length === 0);
  const composerLabel = track(() =>
    replyToAuthor.value ? `Reply to @${replyToAuthor.value}` : "Add a comment",
  );

  /** The confirm step on Delete — a destructive control does not fire on the first tap. */
  const confirmId = track("");

  /**
   * The Report dialog (T-12), pointed at one comment. Two strings rather than a target object,
   * because ripple 0.4.7 loses a `null` check across a branch and the dialog is mounted inside `@if`:
   * `reportId` is empty until a row's **Report** is pressed.
   */
  const reportId = track("");
  const reportAuthor = track("");

  /** The account's NSFW Show preference; Blur is a listing preference and does not reach here. */
  const show = track(nsfwPreference().show);
  onPrefs((next) => {
    show.value = next.show;
    rebuild();
  });

  /** Plain state, not tracked: only `entries` is read by the template. */
  let rows: Comment[] = [];
  /** The composer element, so Reply can bring it back into view without querying a scoped class. */
  let composerEl: HTMLDivElement | undefined;
  const expanded: string[] = [];
  const revealed: string[] = [];
  const votes: Record<string, VoteDirection> = {};
  /**
   * The fragment this mount was opened with. **Kept after the scroll** — a later rebuild (the vote
   * read, an expand, a write) must not un-mark the row the link pointed at.
   */
  let anchorId = "";
  let scrolled = false;
  let seq = 0;

  /**
   * Fold the flat rows into the drawn list. Placeholders with no surviving branch are dropped
   * **before** anything is drawn — which is what makes *a comment with no replies disappears
   * entirely* true at every depth instead of only at the root.
   */
  function build(): Row[] {
    const children = new Map<string | null, Comment[]>();
    for (const row of rows) {
      const bucket = children.get(row.parentId) ?? [];
      bucket.push(row);
      children.set(row.parentId, bucket);
    }
    for (const bucket of children.values()) {
      bucket.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    const kept = new Map<string, boolean>();
    const isKept = (row: Comment): boolean => {
      const known = kept.get(row.id);
      if (known !== undefined) return known;
      const answer =
        row.status === "visible" || (children.get(row.id) ?? []).some((kid) => isKept(kid));
      kept.set(row.id, answer);
      return answer;
    };

    const out: Row[] = [];
    const showBody = show.value;

    const toRow = (row: Comment, depth: number): Row => {
      const placeholder = row.status !== "visible";
      return {
        key: row.id,
        id: row.id,
        author: row.author,
        initials: initialsOf(row.author),
        stamp: shortStamp(row.createdAt),
        iso: row.createdAt,
        body: placeholder
          ? row.status === "deleted"
            ? PLACEHOLDER_DELETED
            : PLACEHOLDER_REMOVED
          : row.body,
        replies: row.replyCount,
        likes: row.likes,
        dislikes: row.dislikes,
        depth,
        placeholder,
        mine: !placeholder && signedIn.value && row.author === read(viewer),
        // Only the body is ever covered, and only while the account has Show off.
        covered: !placeholder && row.nsfw && !showBody && !revealed.includes(row.id),
        myVote: votes[row.id] ?? "",
        fold: 0,
        parentId: "",
        target: row.id === anchorId,
      };
    };

    const walk = (parentId: string | null, depth: number): void => {
      const kids = (children.get(parentId) ?? []).filter((kid) => isKept(kid));
      // Collapsing is a reply list's rule; a thread's own roots are never cut.
      const collapsed = parentId !== null && kids.length > 3 && !expanded.includes(parentId);
      const drawn = collapsed ? kids.slice(0, 3) : kids;

      for (const kid of drawn) {
        out.push(toRow(kid, depth));
        walk(kid.id, Math.min(depth + 1, 2));
      }

      if (collapsed && parentId !== null) {
        out.push({
          key: `fold-${parentId}`,
          id: "",
          author: "",
          initials: "",
          stamp: "",
          iso: "",
          body: "",
          replies: 0,
          likes: 0,
          dislikes: 0,
          depth: Math.min(depth + 1, 2),
          placeholder: false,
          mine: false,
          covered: false,
          myVote: "",
          fold: kids.length - drawn.length,
          parentId,
          target: false,
        });
      }
    };

    walk(null, 0);
    return out;
  }

  function rebuild(): void {
    entries.value = build();
  }

  /**
   * Expand every branch that hides `targetId`, so an anchor (or a row just posted below a fold)
   * is always reachable — a fragment that points at a hidden comment is a dead link.
   */
  function expandAlong(targetId: string): void {
    const byId = new Map(rows.map((row) => [row.id, row]));
    let cursor = byId.get(targetId);
    let guard = 0;

    while (cursor !== undefined && cursor.parentId !== null && guard < 32) {
      const parentId = cursor.parentId;
      const siblings = rows
        .filter((row) => row.parentId === parentId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      const index = siblings.findIndex((row) => row.id === cursor?.id);
      if (index >= 3 && !expanded.includes(parentId)) expanded.push(parentId);
      cursor = byId.get(parentId);
      guard += 1;
    }
  }

  /**
   * The viewer's own vote per row, from the adapter — never a page-local guess that dies on the
   * next read (`character/detail.md` → *Voted or bookmarked*).
   */
  function loadVotes(list: Comment[]): void {
    const live = list.filter((row) => row.status === "visible");
    Promise.all(live.map((row) => repo.myVote("comment", row.id).catch(() => null))).then(
      (answers) => {
        answers.forEach((direction, index) => {
          const row = live[index];
          if (!row || !direction) return;
          votes[row.id] = direction;
        });
        rebuild();
      },
    );
  }

  async function load(): Promise<void> {
    const mine = ++seq;
    phase.value = "loading";
    failure.value = "";

    const list = await repo.listComments(itemId).catch(() => null);
    if (mine !== seq) return;

    if (!list) {
      phase.value = "error";
      failure.value = "This thread could not be loaded.";
      return;
    }

    rows = list;
    if (anchorId) expandAlong(anchorId);
    phase.value = "ready";
    rebuild();
    loadVotes(list);
    onCount?.(list.length);

    if (anchorId && !scrolled) {
      scrolled = true;
      const target = anchorId;
      setTimeout(() => {
        document.getElementById(`comment-${target}`)?.scrollIntoView({ block: "center" });
      }, 0);
    }
  }

  /**
   * Every write ends by re-reading the thread: the adapter recomputed the counts, and the page's
   * count cell reads the same answer the thread draws from. The composed text is validated with the
   * **schema**, so the inline error and the stored row cannot disagree.
   */
  async function post(): Promise<void> {
    if (!signedIn.value || posting.value) return;

    const write = commentWriteSchema.safeParse({
      itemId,
      parentId: replyToId.value === "" ? null : replyToId.value,
      body: draft.value,
      nsfw: nsfwFlag.value,
    });

    if (!write.success) {
      formError.value = write.error.issues[0]?.message ?? "That comment couldn't be posted.";
      return;
    }

    formError.value = "";
    posting.value = true;
    const created = await repo.addComment(write.data).catch(() => null);
    posting.value = false;

    if (!created) {
      formError.value = "That comment couldn't be posted.";
      return;
    }

    draft.value = "";
    nsfwFlag.value = false;
    replyToId.value = "";
    replyToAuthor.value = "";
    expandAlong(created.id);
    await load();
  }

  async function remove(id: string): Promise<void> {
    confirmId.value = "";
    const removed = await repo.deleteComment(id).catch(() => null);
    if (!removed) {
      toast("That comment couldn't be deleted.");
      return;
    }
    await load();
  }

  async function castVote(id: string, direction: VoteDirection): Promise<void> {
    if (!signedIn.value) return;

    const updated = await repo.vote("comment", id, direction).catch(() => null);
    if (!updated) {
      toast("That vote didn't save.");
      return;
    }

    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) rows[index] = updated;
    votes[id] = direction;
    rebuild();
  }

  function targetReply(id: string, author: string): void {
    replyToId.value = id;
    replyToAuthor.value = author;
    formError.value = "";
    composerEl?.scrollIntoView({ block: "start" });
  }

  function clearReply(): void {
    replyToId.value = "";
    replyToAuthor.value = "";
  }

  /**
   * **Report** on a comment opens the same dialog the character page's menu does, with the comment
   * as its target. It is drawn only on a live row and only while signed in (`comment-thread.md` →
   * Actions; a placeholder carries no actions at all), and it touches nothing else: a report is not
   * a delete, and the row stays exactly where it is until a verdict is certain.
   */
  function openReport(id: string, author: string): void {
    reportId.value = id;
    reportAuthor.value = author;
  }

  function expand(parentId: string): void {
    if (!expanded.includes(parentId)) expanded.push(parentId);
    rebuild();
  }

  function reveal(id: string): void {
    if (!revealed.includes(id)) revealed.push(id);
    rebuild();
  }

  anchorId = location.hash.startsWith("#comment-") ? location.hash.slice("#comment-".length) : "";
  load();

  <>
    <style>
      .thread {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      /* The composer: page-owned wrapper for the primitive's field and button (T-09's trap). */
      .thread-composer {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      .composer-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .composer-label {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .cancel-reply {
        min-height: 44px;
        padding: 0 8px;
        border: 0;
        border-radius: 2px;
        background: none;
        color: var(--color-text-muted);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }

      .cancel-reply:hover {
        color: var(--color-text);
      }

      .composer-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      /* A native checkbox in a 44px row: the Toggle primitive is reserved for the two NSFW prefs. */
      .flag {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        color: var(--color-text-muted);
        font-size: 13px;
        cursor: pointer;
      }

      .flag input {
        width: 18px;
        height: 18px;
        margin: 0;
        accent-color: var(--color-accent);
      }

      .post {
        display: grid;
        flex: 0 0 auto;
      }

      .signin {
        margin: 0;
        padding: 16px;
        border: 1px dashed var(--color-border);
        border-radius: 6px;
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .signin a {
        color: var(--color-accent);
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .none {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        line-height: 1.6;
      }

      .failure {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--color-border);
        border-left: 2px solid var(--color-danger);
        border-radius: 0 6px 6px 0;
      }

      .failure-text {
        margin: 0;
        color: var(--color-text);
        font-size: 14px;
        line-height: 1.6;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      /* Indentation is the depth, one gutter per level: 16px at 360, 24px from `sm`. */
      .row,
      .fold {
        padding-left: calc(var(--depth) * 16px);
      }

      .row {
        scroll-margin-top: 72px;
      }

      .comment {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 0 12px 12px;
        border-left: 1px solid var(--color-border);
      }

      .row.is-target .comment {
        border-left-color: var(--color-accent);
      }

      .row-head {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .row-author {
        min-width: 0;
        margin: 0;
        overflow: hidden;
        color: var(--color-text);
        font-size: 13px;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .row-time {
        color: var(--color-text-subtle);
        font-size: 12px;
        white-space: nowrap;
      }

      .stage {
        position: relative;
      }

      .row-body {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        overflow-wrap: anywhere;
      }

      .row-body.is-covered {
        filter: blur(6px);
        user-select: none;
      }

      .cover {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background-color: color-mix(in srgb, var(--color-bg) 55%, transparent);
      }

      .placeholder {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 13px;
        font-style: italic;
        line-height: 1.6;
      }

      .row-foot {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
      }

      .act {
        min-height: 44px;
        padding: 0 10px;
        border: 1px solid transparent;
        border-radius: 2px;
        background: none;
        color: var(--color-text-muted);
        font: inherit;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
      }

      .act:hover {
        color: var(--color-text);
        background-color: var(--color-surface);
      }

      .act[aria-pressed="true"] {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .act:disabled {
        color: var(--color-text-subtle);
        cursor: default;
        background: none;
      }

      .act.is-danger {
        color: var(--color-danger);
      }

      .act.is-danger:hover {
        color: var(--color-danger);
        background-color: var(--color-surface);
      }

      .count-note {
        margin: 0 10px 0 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }

      .fold {
        display: flex;
      }

      .fold-btn {
        min-height: 44px;
        padding: 0 10px;
        border: 0;
        border-radius: 2px;
        background: none;
        color: var(--color-accent);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }

      .fold-btn:hover {
        color: var(--color-accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .loading {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      @media (min-width: 640px) {
        .row,
        .fold {
          padding-left: calc(var(--depth) * 24px);
        }

        .thread-composer {
          padding: 20px;
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .comment,
        .fold {
          transition: border-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      }
    </style>

    <div class="thread">
      @if (!signedIn.value) {
        <p class="signin">
          <a href={href("/authentification")}>Sign in</a>
          {" to comment, vote or reply."}
        </p>
      } @else {
        <div class="thread-composer" ref={composerEl}>
          <div class="composer-head">
            <p class="composer-label">{composerLabel.value}</p>
            @if (replyToId.value) {
              <button class="cancel-reply" type="button" onClick={clearReply}>Cancel</button>
            }
          </div>
          <Field
            label="Comment"
            multiline={true}
            rows={3}
            value={draft}
            error={formError}
            onInput={(value) => {
              draft.value = value;
              formError.value = "";
            }}
          />
          <div class="composer-row">
            <label class="flag">
              <input
                type="checkbox"
                checked={nsfwFlag.value}
                onChange={(event) => (nsfwFlag.value = event.currentTarget.checked)}
              />
              {"NSFW"}
            </label>
            <div class="post">
              <Button variant="primary" disabled={denyPost} onClick={post}>
                {replyToId.value ? "Post reply" : "Post comment"}
              </Button>
            </div>
          </div>
        </div>
      }

      @if (phase.value === "loading") {
        <div class="loading" aria-busy="true" aria-label="Loading comments">
          <div><Skeleton lines={3} /></div>
          <div><Skeleton lines={2} /></div>
        </div>
      } @else if (phase.value === "error") {
        <div class="failure" role="alert">
          <p class="failure-text">{failure.value}</p>
          <Button variant="secondary" onClick={load}>Retry</Button>
        </div>
      } @else if (entries.value.length === 0) {
        <p class="none">No comments yet. The composer is the whole thread.</p>
      } @else {
        <ul class="list" aria-label="Comments">
          @for (const row of entries.value; key row.key) {
            @if (row.fold > 0) {
              <li class="fold" style={{ "--depth": `${row.depth}` }}>
                <button
                  class="fold-btn"
                  type="button"
                  aria-expanded="false"
                  onClick={() => expand(row.parentId)}
                >
                  {foldLabel(row.fold)}
                </button>
              </li>
            } @else if (row.placeholder) {
              <li
                class={row.target ? "row is-target" : "row"}
                id={`comment-${row.id}`}
                style={{ "--depth": `${row.depth}` }}
              >
                <article class="comment">
                  <div class="row-head">
                    <Avatar initials={row.initials} size={24} label={row.author} />
                    <p class="row-author">{`@${row.author}`}</p>
                    <time class="row-time" datetime={row.iso}>{row.stamp}</time>
                  </div>
                  <p class="placeholder">{row.body}</p>
                  <div class="row-foot">
                    <p class="count-note">
                      {row.replies === 1 ? "1 reply" : `${row.replies} replies`}
                    </p>
                  </div>
                </article>
              </li>
            } @else {
              <li
                class={row.target ? "row is-target" : "row"}
                id={`comment-${row.id}`}
                style={{ "--depth": `${row.depth}` }}
              >
                <article class="comment">
                  <div class="row-head">
                    <Avatar initials={row.initials} size={24} label={row.author} />
                    <p class="row-author">{`@${row.author}`}</p>
                    <time class="row-time" datetime={row.iso}>{row.stamp}</time>
                  </div>
                  <div class="stage">
                    <p class={row.covered ? "row-body is-covered" : "row-body"}>{row.body}</p>
                    @if (row.covered) {
                      <div class="cover">
                        <Button variant="ghost" onClick={() => reveal(row.id)}>Reveal</Button>
                      </div>
                    }
                  </div>
                  <div class="row-foot">
                    <button
                      class="act"
                      type="button"
                      aria-pressed={row.myVote === "like" ? "true" : "false"}
                      aria-label={`Like ${row.author}'s comment`}
                      disabled={!signedIn.value}
                      onClick={() => castVote(row.id, "like")}
                    >
                      {`Like ${row.likes}`}
                    </button>
                    <button
                      class="act"
                      type="button"
                      aria-pressed={row.myVote === "dislike" ? "true" : "false"}
                      aria-label={`Dislike ${row.author}'s comment`}
                      disabled={!signedIn.value}
                      onClick={() => castVote(row.id, "dislike")}
                    >
                      {`Dislike ${row.dislikes}`}
                    </button>
                    <p class="count-note">
                      {row.replies === 1 ? "1 reply" : `${row.replies} replies`}
                    </p>
                    @if (signedIn.value) {
                      <>
                        <button
                          class="act"
                          type="button"
                          onClick={() => targetReply(row.id, row.author)}
                        >
                          Reply
                        </button>
                        <button
                          class="act"
                          type="button"
                          aria-label={`Report ${row.author}'s comment`}
                          onClick={() => openReport(row.id, row.author)}
                        >
                          Report
                        </button>
                      </>
                    }
                    @if (row.mine) {
                      @if (confirmId.value === row.id) {
                        <>
                          <button
                            class="act is-danger"
                            type="button"
                            onClick={() => remove(row.id)}
                          >
                            Confirm delete
                          </button>
                          <button class="act" type="button" onClick={() => (confirmId.value = "")}>
                            Cancel
                          </button>
                        </>
                      } @else {
                        <button
                          class="act is-danger"
                          type="button"
                          onClick={() => (confirmId.value = row.id)}
                        >
                          Delete
                        </button>
                      }
                    }
                  </div>
                </article>
              </li>
            }
          }
        </ul>
      }
    </div>

    @if (reportId.value !== "") {
      <ReportDialog
        target={{ kind: "comment", id: reportId.value, label: `Comment by @${reportAuthor.value}` }}
        onClose={() => {
          reportId.value = "";
          reportAuthor.value = "";
        }}
      />
    }
  </>
}

export default CommentThread;

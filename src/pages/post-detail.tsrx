import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { CommentThread } from "../components/CommentThread.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { PostCard } from "../components/PostCard.tsrx";
import { ReportDialog } from "../components/ReportDialog.tsrx";
import { Skeleton } from "../components/Skeleton.tsrx";
import { href, navigate, useParams } from "../router.ts";
import { resolveRepo } from "../lib/data/repo.ts";
import {
  ratioOf,
  type Character,
  type PostAttachment,
  type User,
  type VoteDirection,
} from "../lib/data/types.ts";
import { percent } from "../lib/format.ts";
import { currentUser, onSession } from "../lib/state/session.ts";
import { nsfwPreference, onPrefs } from "../lib/state/prefs.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/post/[post.id]` — the permalink (`src/specs/pages/post/detail.md`).
 *
 * What a permalink adds to the feed's card, and nothing else: the **whole** cut (no fold, no Show
 * more — the card takes `fold={false}`), the page's own engagement strip (the ratio *percentage*
 * with the raw like and dislike counts beside it, never a fraction — `luaplot-pages.md` →
 * *Engagement*), the action row (vote pair, bookmark, Report, Delete for the author), and the
 * comment thread beneath. The card's own footer is off (`foot={false}`) so the numbers are drawn
 * once, by the page that owns them.
 *
 * Three decisions this page records in `docs/DESIGN.md` → *Post detail*:
 * - **One column on a phone, two from `md`** — card and comments in the reading column, counts and
 *   actions in a 300px aside. The DOM order (card → aside → comments) *is* the phone order, so the
 *   wide layout is a grid-area change and not a second tree.
 * - **Not-found, deleted and removed share one state.** The adapter answers `null` for all three and
 *   cannot tell them apart, so the page prints the spec's not-found sentence; the two messages the
 *   spec lists for a deleted and a removed post exist so neither is privatized, not so the page can
 *   guess which one happened.
 * - **A cut has no link back to its session.** It is text; the card draws it as text and the page
 *   adds nothing.
 *
 * The body is stored in separate tracks rather than one `Post | null`: a `null` check does not
 * survive into a template block in ripple 0.4.7, and the card's props are evaluated once at mount,
 * which is exactly the moment `phase` turns `ready`.
 */

type Phase = "loading" | "ready" | "error";

export function PostDetail() @{
  const repo = resolveRepo();
  const params = useParams();
  /** The router keys a param by its own segment (`[post.id]` → `id`) — never parse the pathname. */
  const id = params.id ?? "";

  const phase = track<Phase>("loading");
  const failure = track("");
  const missing = track(false);

  const author = track("");
  const body = track("");
  const createdAt = track("");
  const nsfw = track(false);
  const verified = track(false);
  const likes = track(0);
  const dislikes = track(0);
  const bookmarks = track(0);
  const comments = track(0);
  const attachment = track<PostAttachment | null>(null);

  const bookmarked = track(false);
  const myVote = track<VoteDirection | null>(null);
  const busy = track(false);

  /** The attachment character, resolved once; empty until it answers. */
  const people = track<Record<string, Character>>({});

  const viewer = track<User | null>(currentUser());
  const show = track(nsfwPreference().show);
  onSession((next) => {
    viewer.value = next;
  });
  onPrefs((next) => {
    show.value = next.show;
  });

  const viewerHandle = track(() => viewer.value?.handle ?? "");
  const owner = track(() => viewer.value !== null && author.value === viewer.value.handle);
  /** Blur is the card's own cover; Show-off never blocks a route, so it only decides the cover. */
  const cardBlur = track(() => !show.value);

  const confirmDelete = track(false);
  const reportOpen = track(false);
  /** The report label is the author, not the body: the queue reads who posted it. */
  const reportLabel = track(() => `Post by @${author.value}`);

  let seq = 0;

  function load(): void {
    const mine = ++seq;
    phase.value = "loading";
    failure.value = "";
    missing.value = false;

    Promise.all([repo.getPost(id), repo.isBookmarked("post", id), repo.myVote("post", id)]).then(
      ([item, saved, vote]) => {
        if (mine !== seq) return;

        bookmarked.value = saved;
        myVote.value = vote;

        if (!item) {
          missing.value = true;
          phase.value = "ready";
          return;
        }

        author.value = item.author;
        body.value = item.body;
        createdAt.value = item.createdAt;
        nsfw.value = item.nsfw;
        verified.value = item.verified;
        likes.value = item.likes;
        dislikes.value = item.dislikes;
        bookmarks.value = item.bookmarks;
        comments.value = item.commentCount;
        attachment.value = item.attachment;
        phase.value = "ready";

        const attached = item.attachment;
        if (attached?.kind === "character") {
          repo.getCharacter(attached.characterId).then(
            (found) => {
              if (mine !== seq || !found) return;
              people.value = { [found.id]: found };
            },
            () => {
              // A removed attachment character is not a page failure: the card draws no attachment.
            },
          );
        }
      },
      () => {
        if (mine !== seq) return;
        phase.value = "error";
        failure.value = "This post could not be loaded.";
      },
    );
  }

  /** Signed out there is nothing to write: every action leads to sign-in (`detail.md` → Actions). */
  function needsAccount(): boolean {
    if (viewer.value) return false;
    navigate("/authentification");
    return true;
  }

  async function castVote(direction: VoteDirection): Promise<void> {
    if (needsAccount() || busy.value) return;

    busy.value = true;
    const updated = await repo.vote("post", id, direction).catch(() => null);
    busy.value = false;

    if (!updated) {
      toast("That vote didn't save.");
      return;
    }

    likes.value = updated.likes;
    dislikes.value = updated.dislikes;
    myVote.value = direction;
  }

  async function toggleBookmark(): Promise<void> {
    if (needsAccount()) return;

    const next = await repo.toggleBookmark("post", id).catch(() => null);
    if (!next) {
      toast("That bookmark didn't save.");
      return;
    }

    bookmarked.value = next.bookmarked;
    bookmarks.value = bookmarks.value + (next.bookmarked ? 1 : -1);
    toast(next.bookmarked ? "Saved to your bookmarks." : "Removed from your bookmarks.");
  }

  /**
   * Delete takes the whole thread with it (`detail.md` → *Delete*, *in cascade*), so the page leaves
   * for the feed: the post's own permalink is now the not-found state and there is nothing to show.
   */
  async function remove(): Promise<void> {
    confirmDelete.value = false;
    const gone = await repo.deletePost(id).catch(() => false);
    if (!gone) {
      toast("That post couldn't be deleted.");
      return;
    }
    navigate("/post/thread");
  }

  load();

  <>
    <style>
      .detail {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .back {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-decoration: none;
        text-transform: uppercase;
      }

      .back:hover {
        color: var(--color-text);
      }

      /* DOM order is the phone order — card, aside, comments. The wide layout is a grid-area swap. */
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
      }

      .aside {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .counts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1px;
        margin: 0;
        padding: 1px;
        overflow: hidden;
        border-radius: 6px;
        background-color: var(--color-border);
        list-style: none;
      }

      .count {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 12px;
        background-color: var(--color-bg-elevated);
      }

      .count-label {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 11px;
        letter-spacing: 0.08em;
        line-height: 1.3;
        text-transform: uppercase;
      }

      .count-value {
        margin: 0;
        color: var(--color-text);
        font-size: 20px;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .act {
        min-height: 44px;
        padding: 0 14px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        background: none;
        color: var(--color-text);
        font: inherit;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
      }

      .act:hover:not(:disabled) {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .act[aria-pressed="true"] {
        border-color: var(--color-accent);
        color: var(--color-accent);
        background-color: color-mix(in srgb, var(--color-accent) 8%, transparent);
      }

      .act:disabled {
        color: var(--color-text-subtle);
        cursor: default;
      }

      .act.is-danger {
        border-color: color-mix(in srgb, var(--color-danger) 45%, transparent);
        color: var(--color-danger);
      }

      .act.is-danger:hover {
        border-color: var(--color-danger);
        color: var(--color-danger);
      }

      .comments {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 4px;
      }

      .section-title {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .alert {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding: 16px 0;
      }

      .alert-text {
        margin: 0;
        color: var(--color-danger);
        font-size: 14px;
        line-height: 1.6;
      }

      .skel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
      }

      @media (min-width: 640px) {
        .counts {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .actions {
          flex-direction: row;
          flex-wrap: wrap;
        }

        .act {
          text-align: center;
        }
      }

      @media (min-width: 900px) {
        .layout {
          grid-template-columns: minmax(0, 1fr) 300px;
          grid-template-areas:
            "card aside"
            "comments aside";
          align-items: start;
          column-gap: 32px;
        }

        .post-wrap {
          grid-area: card;
        }

        .aside {
          grid-area: aside;
          position: sticky;
          top: 88px;
        }

        .comments {
          grid-area: comments;
        }

        .counts {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .actions {
          flex-direction: column;
        }

        .act {
          text-align: left;
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .act {
          transition: color 120ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 120ms
            cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      }
    </style>

    <div class="detail">
      <header class="head">
        <a class="back" href={href("/post/thread")}>{"← Thread"}</a>
      </header>

      @if (phase.value === "loading") {
        <div class="skel" aria-busy="true" aria-label="Loading post">
          <Skeleton variant="block" height={16} />
          <Skeleton variant="block" height={72} />
          <Skeleton variant="block" height={44} />
        </div>
      } @else if (phase.value === "error") {
        <div class="alert" role="alert">
          <p class="alert-text">{failure.value}</p>
          <Button variant="secondary" onClick={load}>Retry</Button>
        </div>
      } @else if (missing.value) {
        <EmptyState
          message="This post doesn't exist."
          actionLabel="Back to the thread"
          href={href("/post/thread")}
        />
      } @else {
        <div class="layout">
          <div class="post-wrap">
            <PostCard
              post={{
                id,
                author: author.value,
                body: body.value,
                createdAt: createdAt.value,
                nsfw: nsfw.value,
                attachment: attachment.value,
                verified: verified.value,
                likes: likes.value,
                dislikes: dislikes.value,
                bookmarks: bookmarks.value,
                commentCount: comments.value,
              }}
              people={people}
              blur={cardBlur}
              fold={false}
              foot={false}
            />
          </div>

          <aside class="aside">
            <ul class="counts" aria-label="Engagement">
              <li class="count">
                <p class="count-label">Ratio</p>
                <p class="count-value">
                  {percent(ratioOf({ likes: likes.value, dislikes: dislikes.value }))}
                </p>
              </li>
              <li class="count">
                <p class="count-label">Likes</p>
                <p class="count-value">{likes.value}</p>
              </li>
              <li class="count">
                <p class="count-label">Dislikes</p>
                <p class="count-value">{dislikes.value}</p>
              </li>
              <li class="count">
                <p class="count-label">Comments</p>
                <p class="count-value">{comments.value}</p>
              </li>
            </ul>

            <div class="actions">
              <button
                class="act"
                type="button"
                aria-pressed={myVote.value === "like" ? "true" : "false"}
                disabled={busy.value}
                onClick={() => castVote("like")}
              >
                Like
              </button>
              <button
                class="act"
                type="button"
                aria-pressed={myVote.value === "dislike" ? "true" : "false"}
                disabled={busy.value}
                onClick={() => castVote("dislike")}
              >
                Dislike
              </button>
              <button
                class="act"
                type="button"
                aria-pressed={bookmarked.value ? "true" : "false"}
                onClick={toggleBookmark}
              >
                {bookmarked.value ? "Remove bookmark" : "Bookmark"}
              </button>
              <button class="act" type="button" onClick={() => (reportOpen.value = true)}>
                Report
              </button>
              @if (owner.value) {
                @if (confirmDelete.value) {
                  <>
                    <button class="act is-danger" type="button" onClick={remove}>
                      Confirm delete
                    </button>
                    <button class="act" type="button" onClick={() => (confirmDelete.value = false)}>
                      Cancel
                    </button>
                  </>
                } @else {
                  <button
                    class="act is-danger"
                    type="button"
                    onClick={() => (confirmDelete.value = true)}
                  >
                    {`Delete post${comments.value > 0 ? " and its comments" : ""}`}
                  </button>
                }
              }
            </div>
          </aside>

          <section class="comments" aria-label="Comments">
            <h2 class="section-title">Comments</h2>
            <CommentThread
              itemId={id}
              viewer={viewerHandle}
              onCount={(count) => (comments.value = count)}
            />
          </section>
        </div>
      }
    </div>

    @if (reportOpen.value) {
      <ReportDialog
        target={{ kind: "post", id, label: reportLabel.value }}
        onClose={() => (reportOpen.value = false)}
      />
    }
  </>
}

export default PostDetail;

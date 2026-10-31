import { EmptyState } from "../components/EmptyState.tsrx";
import { PostComposer } from "../components/PostComposer.tsrx";
import { href, navigate } from "../router.ts";
import { currentUser } from "../lib/state/session.ts";

/**
 * `/post/create` — the composer as a page (`src/specs/pages/post/create.md`).
 *
 * The form itself is `PostComposer` (T-15 extracted it so `/session/[id]` can open the same form in a
 * `Sheet` with a cut attached): one component, one `postWriteSchema` parse, one `repo.addPost` call.
 * This page owns only the frame — the kicker, the lede, the signed-out state and where Publish and
 * Cancel go.
 *
 * Cancel goes back to the thread, which is where the only **Create** control lives.
 */

export function PostCreate() @{
  const viewer = currentUser();
  const signedIn = viewer !== null;

  <>
    <style>
      .compose-page {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .lede {
        max-width: 52ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      @media (min-width: 640px) {
        .lede {
          font-size: 15px;
        }
      }
    </style>

    <div class="compose-page">
      <header class="head">
        <p class="kicker">new post</p>
        <p class="lede">
          A post is written once. Correcting it means deleting it and publishing again — publishing
          makes it public immediately.
        </p>
      </header>

      @if (!signedIn) {
        <EmptyState
          message="Sign in to publish a post."
          actionLabel="Sign in"
          href={href("/authentification")}
        />
      } @else {
        <PostComposer
          onPublished={(postId) => navigate(`/post/${postId}`)}
          onCancel={() => navigate("/post/thread")}
        />
      }
    </div>
  </>
}

export default PostCreate;

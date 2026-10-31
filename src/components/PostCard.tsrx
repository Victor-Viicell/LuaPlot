import { track, type Derived } from "ripple";
import type { Character, Post } from "../lib/data/types.ts";
import { initialsOf, shortStamp } from "../lib/format.ts";
import { read } from "../lib/reactive.ts";
import { href } from "../router.ts";
import { Avatar } from "./Avatar.tsrx";
import { Button } from "./Button.tsrx";

/**
 * Timeline card — one post, drawn in the three parts `luaplot-pages.md` → *Conventions* fixes for
 * posts: a header with the poster and the time, the body (with its attachment under it), and a
 * footer with likes, dislikes and the comment count.
 *
 * **`Card` has no post branch and must not grow one.** A post has no `name` and no `tagline`, and a
 * catalogue card whose title slot is empty reads as a broken card; the two shapes share the `.card`
 * box and nothing else. `docs/DESIGN.md` → *Card and grid* carries that split.
 *
 * The count is the permalink, not a thread: the feed never renders a comment. The `<time>` is the
 * second, conventional way in, so a post with no comments is still reachable.
 *
 * A `cut` attachment folds to its first **two** messages (one character turn, one user turn — a cut
 * alternates) behind **Show more**, which expands in place. The fold is per-card state, never a
 * route change, so opening a cut does not lose the feed's scroll.
 *
 * `people` is the listing's resolved attachment characters handed in **live**: a prop expression is
 * evaluated once, so a card handed `people[id]` would keep the `null` it saw before the lookup
 * answered. The card reads the record through `read()` inside a derived instead, and the page still
 * spends one `getCharacter` per distinct id rather than one per card.
 *
 * Moderation leaves no mark: `verified` and an open case draw nothing here (`thread.md` → *Data*).
 */
export function PostCard({
  post,
  people = {},
  blur = false,
}: {
  post: Post;
  /** Attachment characters by id, resolved once by the listing. */
  people?: Derived<Record<string, Character>> | Record<string, Character>;
  /** Blur is the account's listing preference; Show-off absence is the listing's job, not a card's. */
  blur?: boolean | Derived<boolean>;
}) @{
  const revealed = track(false);
  const expanded = track(false);
  const covered = track(() => post.nsfw && read(blur) && !revealed.value);
  const permalink = href(`/post/${post.id}`);

  /**
   * The character attachment, flattened to plain strings. A derived that returns `null` cannot be
   * narrowed across a template block, so it always answers an object and `shown` decides the draw.
   */
  const attach = track(() => {
    const none = { shown: false, href: "", initials: "", name: "", note: "" };
    const attachment = post.attachment;
    if (attachment?.kind !== "character") return none;

    const person = read(people)[attachment.characterId];
    if (!person) return none;

    return {
      shown: true,
      href: href(`/character/${person.id}`),
      initials: person.avatar.initials,
      name: person.name,
      note: person.tagline ?? "",
    };
  });

  /** Narrowed once, outside the template: ripple loses the discriminated-union check inside a block. */
  const cut = post.attachment?.kind === "cut" ? post.attachment.messages : [];

  /** Two messages before the fold; a one-message cut has nothing to fold. */
  const FOLD = 2;

  <article class={covered.value ? "card post is-covered" : "card post"}>
    <header class="post-head">
      <a class="post-avatar" href={href(`/user/${post.author}`)} aria-label={`@${post.author}`}>
        <Avatar initials={initialsOf(post.author)} size={36} />
      </a>
      <div class="post-meta">
        <a class="post-author" href={href(`/user/${post.author}`)}>{`@${post.author}`}</a>
        <a class="post-time" href={permalink}>
          <time datetime={post.createdAt}>{shortStamp(post.createdAt)}</time>
        </a>
      </div>
    </header>

    <div class="post-middle">
      <div class="post-veil" aria-hidden={covered.value ? "true" : "false"}>
        <p class="post-body">{post.body}</p>

        @if (attach.value.shown) {
          <a class="post-attach" href={attach.value.href}>
            <Avatar initials={attach.value.initials} size={40} />
            <span class="post-attach-text">
              <span class="post-attach-name">{attach.value.name}</span>
              @if (attach.value.note) {
                <span class="post-attach-note">{attach.value.note}</span>
              }
            </span>
          </a>
        }

        @if (cut.length > 0) {
          <div class="post-cut">
            @for (const message of expanded.value ? cut : cut.slice(0, FOLD); key message.text) {
              <div class="cut-turn">
                <p class="cut-who">{`${message.attribution} · ${message.speaker}`}</p>
                <p class="cut-text">{message.text}</p>
              </div>
            }
            @if (!expanded.value && cut.length > FOLD) {
              <div class="cut-more">
                <Button variant="ghost" onClick={() => (expanded.value = true)}>
                  {`Show ${cut.length - FOLD} more`}
                </Button>
              </div>
            }
          </div>
        }
      </div>

      @if (covered.value) {
        <div class="card-cover">
          <Button variant="ghost" onClick={() => (revealed.value = true)}>Reveal</Button>
        </div>
      }
    </div>

    <footer class="post-foot">
      <ul class="post-counts">
        <li class="post-count">
          <span class="post-count-label">likes</span>
          <span class="post-count-value">{post.likes}</span>
        </li>
        <li class="post-count">
          <span class="post-count-label">dislikes</span>
          <span class="post-count-value">{post.dislikes}</span>
        </li>
      </ul>
      <a class="post-comments" href={permalink} aria-label={`${post.commentCount} comments`}>
        {`${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}`}
      </a>
    </footer>
  </article>
}

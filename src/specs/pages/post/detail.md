# `/post/[post.id]`

**Route** `/post/[post.id]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [thread](thread.md) · [create](create.md)

## Purpose

Permalink for one post. Renders the body plus its one optional attachment — a character or a cut from a session — or the body alone, with the comment thread beneath it. Comments are public like the post itself; composing one requires being signed in.

## Layout

_To be specified._

## Data

The attachment:

- **Rendered in full here** — the body plus, when present, one attachment: a character rendered as its card with a link to its [detail](../character/detail.md) page while it resolves, or a cut rendered as the conversation it recorded, its messages under the attribution chosen when it was published.
- **A cut carries no link back** — it records text, not a pointer: no route to the session, its ID, its other messages, or the session's copy of the character. A session is private, so a post built from one exposes only what the author chose to publish, and a later rewrite inside that session changes nothing on the post.

Engagement shown on the page:

- **Likes / dislikes** as the ratio percentage the cards carry, with the raw like and dislike counts beside it — not a like/total fraction.
- **Comment count**, with the [comment thread](../../components/comment-thread.md) beneath the body.
- **Bookmark state** for the signed-in viewer.

## Actions

- **Like / dislike** — one vote per viewer; switching replaces the previous vote, and the author votes on their own post like any other viewer
- **Bookmark / unbookmark**
- **Report** → [report](../../components/report.md)
- **Comment** (signed in only) → [comment thread](../../components/comment-thread.md)
- **Delete** (author only) — deletes the post and, in cascade, its entire comment thread
- **Open attached content** — a character attachment only, to its [detail](../character/detail.md) page; a cut is text and has no destination of its own
- **Open author** → [profile](../user/profile.md)

## States

- **Signed in** — can comment
- **Signed out** — read only
- **No comments yet**
- **Not found** — "This post doesn't exist."
- **Deleted post** — "This post doesn't exist anymore."
- **Removed by JEV** — same message, since a removed post cannot be privatized
- **Voted or bookmarked**
- **Reported**


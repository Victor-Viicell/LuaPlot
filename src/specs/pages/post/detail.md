# `/post/[post.id]`

**Route** `/post/[post.id]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [thread](thread.md) · [create](create.md)

## Purpose

Permalink for one post. Renders the body plus its one optional attachment — a character or a cut from a session — or the body alone, with the comment thread beneath it. Comments are public like the post itself; composing one requires being signed in.

## Layout

_To be specified._

## Data

Engagement shown on the page:

- **Likes / dislikes** and the ratio between them.
- **Comment count**, with the [comment thread](../../components/comment-thread.md) beneath the body.
- **Bookmark state** for the signed-in viewer.

## Actions

- **Like / dislike** — one vote per viewer; switching replaces the previous vote
- **Bookmark / unbookmark**
- **Report** → [report](../../components/report.md)
- **Comment** (signed in only) → [comment thread](../../components/comment-thread.md)
- **Delete** (author only) — deletes the post and, in cascade, its entire comment thread
- **Open attached content** → character detail or session context
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

## Open questions

- Does a published cut link back to the session, and if so, does that expose anything the author did not choose to share?
- Can an author vote on their own post?
- Is the ratio shown as a percentage, a like/total fraction, or both raw counts?

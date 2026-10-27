# Comment thread

**Used by** [`/character/[character.id]`](../pages/character/detail.md), [`/lorebook/[lorebook.id]`](../pages/lorebook/detail.md), [`/preset/[preset.id]`](../pages/preset/detail.md), [`/post/[post.id]`](../pages/post/detail.md) · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

The discussion attached to any shared item. Every piece of shared content has one, and comments themselves have one: a comment can be replied to, and replies carry their own engagement. A comment is its own entity, not a kind of post.

## Rules

- **Nesting** — comments can have comments. The model allows unbounded depth; how deep the UI renders before collapsing a branch is a display decision.
- **Engagement per comment** — likes, dislikes, and a reply count. No bookmark: bookmarks exist so content can be found again later, and a comment is already reachable from its parent.
- **Attachments** — comments may include images and GIFs, the same as posts.
- **Counts** — an item's comment count reflects its whole thread, not just top-level comments.
- **Ordering** — _to be specified._

## Layout

_To be specified._

## Actions

- **Comment** on the item
- **Reply** to a comment
- **Like / dislike** a comment — one vote per viewer, switching replaces the previous vote
- **Report** a comment → [report](report.md)

## States

- **Empty**
- **Threaded**
- **Collapsed branch**
- **Signed out** — read only
- **Loading**
- **Deleted comment**
- **Reported**

## Open questions

- Is the displayed count total comments including replies, or top-level only?
- Are comments individually linkable by anchor, or only reachable in context?
- Can authors edit or delete their comments, and what happens to the replies beneath a deleted comment: hidden branch, tombstone, or orphaned replies?
- What is the default order — oldest first, newest first, or best — and can the viewer change it?
- Does a reply notify the comment's author, and does that respect the sparse notification rules?
- Is there a depth limit after which replies flatten?
- Does a comment inherit the NSFW flag of the content it sits under, or carry its own?
- What image formats and size limits apply to comment attachments?

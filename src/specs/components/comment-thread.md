# Comment thread

**Used by** [`/character/[character.id]`](../pages/character/detail.md), [`/lorebook/[lorebook.id]`](../pages/lorebook/detail.md), [`/preset/[preset.id]`](../pages/preset/detail.md), [`/post/[post.id]`](../pages/post/detail.md) · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

The discussion attached to any shared item. Every piece of shared content has one, and comments themselves have one: a comment can be replied to, and replies carry their own engagement. A comment is its own entity, not a kind of post.

## Rules

- **Nesting** — comments can have comments. The model allows unbounded depth; the UI renders three levels inline (comment, reply, reply to a reply) and flattens anything deeper onto the third level, so the column never gets narrower than that.
- **Collapsing** — a branch with more than three replies shows the first three and folds the rest behind `Show N more replies`. Collapsing is display only; the collapsed replies still count toward the thread.
- **Engagement per comment** — likes, dislikes, and a reply count. No bookmark: bookmarks exist so content can be found again later, and a comment is already reachable from its parent.
- **Attachments** — comments may include images and GIFs, the same as posts: PNG, JPEG, WebP, and GIF, up to 10 MB each and four per comment.
- **Own NSFW flag** — a comment carries its own NSFW boolean, set in the composer and SFW by default; it does not inherit the flag of the item it sits under, so covering one reply never covers the thread. A missing flag is a violation, the same as on a post.
- **No private state** — a comment is either visible or gone. Its author, or JEV, can delete it outright; nothing is hidden or withheld.
- **No editing** — a comment is written once. Correcting it means deleting and posting again, so a comment that passed a scan never changes underneath its verification.
- **Deleted comments leave a tombstone** — only when replies hang beneath them: the body, likes, and attachments go, the author and time stay, and the branch stays open so no reply is orphaned. A comment with no replies disappears completely.
- **Removed, not hidden** — a comment under a report stays visible until JEV is certain, then disappears. An unsure verdict goes to a moderator without hiding the comment. A removal follows the same tombstone rule as a deletion when replies exist.
- **Counts** — an item's comment count reflects its whole thread, not just top-level comments.
- **Ordering** — oldest first at every level, and the order is not a control: a thread is a conversation, not a ranked listing.
- **Anchors** — every comment has an anchor on its parent page (`#comment-[comment.id]`). Opening it expands that comment's branch and scrolls to it, so one reply can be pointed at from a link or a paste. The anchor is a fragment, not a route.
- **Notifications** — a comment on a post folds into the author's existing aggregated "commented on your post" row in [notifications](../pages/notifications.md); a reply notifies nobody separately, not even the parent comment's author. Comments on characters, lorebooks, and presets notify no one.

## Layout

- The composer opens at the top of the thread; comments follow beneath it, oldest at the top, and a new reply is appended to the bottom of its branch.
- Each comment keeps the structure the NSFW blur relies on: a header with the author's profile and the time of posting, the body with its images, and a footer with likes, dislikes, the reply count, and the reply control. Only the body is ever covered.
- Replies indent one level per depth, up to three; the third level is the last indent.
- A tombstone renders the header and the footer with a single line in place of the body: "This comment was deleted."

## Actions

- **Comment** on the item
- **Reply** to a comment
- **Like / dislike** a comment — one vote per viewer, switching replaces the previous vote
- **Delete** a comment — author only, with JEV also able to remove it
- **Show more replies** — expand a collapsed branch
- **Report** a comment → [report](report.md)

## States

- **Empty** — no comments; the composer stands alone
- **Threaded** — comments with replies beneath them
- **Collapsed branch** — a branch cut to three visible replies
- **Signed out** — read only
- **Loading**
- **Deleted comment** — tombstone when replies exist, gone entirely when not
- **Removed by JEV** — the same tombstone, kept only for the branch beneath
- **Reported** — visible until the verdict is certain

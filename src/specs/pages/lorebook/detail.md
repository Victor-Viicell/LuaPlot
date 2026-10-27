# `/lorebook/[lorebook.id]`

**Route** `/lorebook/[lorebook.id]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [edit](edit.md)

## Purpose

Public read-only detail page for one lorebook, listing its entries and offering the same fork and edit actions as the other content types.

## Layout

_To be specified._

## Data

Engagement shown on the page:

- **Likes / dislikes** and the ratio between them.
- **Comment count**, with the [comment thread](../../components/comment-thread.md) beneath the entry list.
- **Bookmark state** for the signed-in viewer.

## Actions

- **Like / dislike** — one vote per viewer; switching replaces the previous vote
- **Bookmark / unbookmark**
- **Report** → [report](../../components/report.md)
- **Comment** on this lorebook → [comment thread](../../components/comment-thread.md)
- **Fork / copy** into the viewer's account
- **Edit** (owner only) → [edit](edit.md)
- **Open author** → [profile](../user/profile.md)

## States

- **Another user's lorebook**
- **Own lorebook**
- **Not found** — "This lorebook doesn't exist."
- **Long entry list**
- **Signed out** — can read, cannot vote, comment, or bookmark
- **Voted or bookmarked**
- **Reported**

## Open questions

- Are entries listed expanded, collapsed, or filtered by keyword?
- Do keywords need to be visible, or are they implementation detail?
- Should entry count and matching preview appear before forking?
- Can an author vote on their own lorebook?
- Is the ratio shown as a percentage, a like/total fraction, or both raw counts?

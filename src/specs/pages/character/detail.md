# `/character/[character.id]`

**Route** `/character/[character.id]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [edit](edit.md)

## Purpose

Public read-only detail page for one character. Shows the full definition, credits the owner, and offers the actions available on it: start a session, fork or copy, and edit when owned.

## Layout

_To be specified._

## Data

Engagement shown on the page:

- **Likes / dislikes** and the ratio between them.
- **Comment count**, with the [comment thread](../../components/comment-thread.md) beneath the definition.
- **Bookmark state** for the signed-in viewer.

## Actions

- **Like / dislike** — one vote per viewer; switching replaces the previous vote
- **Bookmark / unbookmark**
- **Report** → [report](../../components/report.md)
- **Comment** on this character → [comment thread](../../components/comment-thread.md)
- **Start a session** → [session](../session/detail.md)
- **Fork / copy** into the viewer's account
- **Edit** (owner only) → [edit](edit.md)
- **Open author** → [profile](../user/profile.md)

## States

- **Another user's character**
- **Own character**
- **Not found** — "This character doesn't exist."
- **Fork in progress**
- **Signed out** — can read, cannot vote, comment, or bookmark
- **Voted or bookmarked**
- **Reported**

## Open questions

- Does "start a session" require a persona, fall back to the default, or prompt to create one?
- Does a fork copy the definition only, or also the attached lorebook?
- Should this page show usage counts, or the author's other work?
- Is the attached lorebook embedded here, or only linked?
- Can an author vote on their own character?
- Is the ratio shown as a percentage, a like/total fraction, or both raw counts?

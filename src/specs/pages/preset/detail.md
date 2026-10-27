# `/preset/[preset.id]`

**Route** `/preset/[preset.id]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [edit](edit.md)

## Purpose

Public read-only detail page for one preset, showing its settings and offering the same fork and edit actions as the other content types.

## Layout

_To be specified._

## Data

Engagement shown on the page:

- **Likes / dislikes** and the ratio between them.
- **Comment count**, with the [comment thread](../../components/comment-thread.md) beneath the settings.
- **Bookmark state** for the signed-in viewer.
- **Moderation notice** (owner only, while private): the report, the reasons, and the measures taken.

## Actions

- **Like / dislike** — one vote per viewer; switching replaces the previous vote
- **Bookmark / unbookmark**
- **Report** → [report](../../components/report.md)
- **Request public again** (owner, while private) — flags the content for JEV re-verification
- **Comment** on this preset → [comment thread](../../components/comment-thread.md)
- **Fork / copy** into the viewer's account
- **Edit** (owner only) → [edit](edit.md)
- **Open author** → [profile](../user/profile.md)

## States

- **Another user's preset**
- **Own preset**
- **Not found** — "This preset doesn't exist."
- **Signed out** — can read, cannot vote, comment, or bookmark
- **Voted or bookmarked**
- **Reported**
- **Privated by moderation** — the owner sees the report, reasons, and measures; everyone else sees it as unavailable
- **Awaiting re-verification**

## Open questions

- Are settings shown as a flat list or grouped by category?
- Are defaults shown alongside values, so a forker knows what was changed?
- Should the page indicate whether the preset still matches the current app version?
- Can an author vote on their own preset?
- Is the ratio shown as a percentage, a like/total fraction, or both raw counts?

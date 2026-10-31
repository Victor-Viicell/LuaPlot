# `/lorebook/[lorebook.id]`

**Route** `/lorebook/[lorebook.id]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [edit](edit.md)

## Purpose

Public read-only detail page for one lorebook, listing its entries and offering the same fork and edit actions as the other content types.

## Layout

- A header holding the avatar, the name, and the link to the author, with the engagement controls and the owner's **Edit** beside it.
- **The avatar is the cover** (same treatment as the character page): it spans the full width of the content column and is **square (1:1)** — full-bleed
  on a phone, a fixed 320px column from `sm` — with the name and the controls beside it rather than above it.
  The same treatment carries to every item page, so a lorebook or preset reads with the same portrait the
  character does.
- Beneath it the entry list: every entry expanded, in the order its author arranged them, each showing its keywords and its content. The list is not collapsible, not filtered by keyword, and not paged — a long list scrolls with the page.
- The [comment thread](../../components/comment-thread.md) sits at the foot of the page, after the entry list.

## Data

Shown on the page:

- **Identity** — the avatar and the name.
- **Entries** — every entry with its keywords and its content, in the author's order. The keywords are visible rather than hidden: they are what the author wrote and what decides when an entry is injected.
- **Author** — a link to [their profile](../user/profile.md).

Engagement shown on the page:

- **Likes / dislikes** — both raw counts, beside the ratio between them as a percentage, the same reading as the [character](../character/detail.md) detail page.
- **Comment count**, with the [comment thread](../../components/comment-thread.md) beneath the entry list.
- **Bookmark state** for the signed-in viewer.
- **Moderation notice** (owner only, while private): the report, the reasons, and the measures taken.

## Actions

- **Like / dislike** — one vote per viewer; switching replaces the previous vote. The author votes like any other viewer: no self-vote exemption, and their vote counts toward the ratio
- **Bookmark / unbookmark**
- **Report** → [report](../../components/report.md)
- **Request public again** (owner, while private) — flags the content for JEV re-verification
- **Comment** on this lorebook → [comment thread](../../components/comment-thread.md)
- **Fork / copy** into the viewer's account — copies the metadata and every entry as they stand, keywords included. There is no separate preview step: the entry list on this page already shows exactly what will be copied, and nothing about matching is promised in advance.
- **Edit** (owner only) → [edit](edit.md)
- **Open author** → [profile](../user/profile.md)

## States

- **Another user's lorebook**
- **Own lorebook**
- **Not found** — "This lorebook doesn't exist."
- **Long entry list** — the whole list renders and scrolls with the page; no collapse, no paging
- **Signed out** — can read, cannot vote, comment, or bookmark
- **Voted or bookmarked**
- **Reported**
- **Privated by moderation** — the owner sees the report, reasons, and measures; everyone else sees it as unavailable
- **Awaiting re-verification**

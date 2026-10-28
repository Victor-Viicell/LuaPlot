# `/preset/[preset.id]`

**Route** `/preset/[preset.id]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [edit](edit.md)

## Purpose

Public read-only detail page for one preset, showing its settings and offering the same fork and edit actions as the other content types.

## Layout

- The settings are read as a flat list of fields, in the same order as the [create](create.md) form, not grouped into sections. The list is whatever the generation layer exposes, as it is on create.
- Values are shown as saved, with no default beside them and no mark of what the author changed: a preset is read for what it sets, and a fork starts from all of those values rather than from a diff against a baseline.

## Data

Engagement shown on the page:

- **Likes / dislikes** — both raw counts, beside the ratio between them as a percentage: the detail page is where the counts live, while a card shows only the ratio.
- **Comment count**, with the [comment thread](../../components/comment-thread.md) beneath the settings.
- **Bookmark state** for the signed-in viewer.
- **Moderation notice** (owner only, while private): the report, the reasons, and the measures taken.

The page carries no version or compatibility marker: presets are not versioned, so nothing here claims the preset matches the current app.

## Actions

- **Like / dislike** — one vote per viewer; switching replaces the previous vote. The author votes like any other viewer: no self-vote exemption, and their vote counts toward the ratio
- **Bookmark / unbookmark**
- **Report** → [report](../../components/report.md)
- **Request public again** (owner, while private) — flags the content for JEV re-verification
- **Comment** on this preset → [comment thread](../../components/comment-thread.md)
- **Fork / copy** into the viewer's account — copies all the settings as shown, the NSFW flag included, into a new preset the viewer owns, opened in [edit](edit.md) per [create](create.md)
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


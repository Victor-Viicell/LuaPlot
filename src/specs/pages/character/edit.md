# `/character/[character.id]/edit`

**Route** `/character/[character.id]/edit` · **Access** owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Owner-only editor for an existing character. Same form as [`/character/create`](create.md), preloaded with current values, with save and delete.

## Layout

_To be specified._

## Data

Same fields as [create](create.md), preloaded — including the full list of attached lorebooks, which can be extended and trimmed here the same way it is built there: by ID, or picked from the author's own lorebooks and the lorebooks they bookmarked from other authors. Removing an attachment removes the reference only; the lorebook itself is untouched and may still hang off other characters.

Renaming is a display change and reaches nothing else: URLs carry the ID, sessions address the character by the in-session name stored on the row, bookmarks and lorebook attachments store the ID, and a published cut keeps the text it recorded. No name is a key anywhere.

## Actions

- **Add lorebook by ID**
- **Pick lorebook** — from own lorebooks and bookmarked lorebooks from other authors
- **Remove lorebook**
- **Save** → [detail](detail.md)
- **Delete** with confirmation — immediate and final: no undo window, no trash, no grace period. The character row and its comment thread go in cascade, per the [conventions](../../luaplot-pages.md#conventions), and its lorebook attachments are references, so they go with it while the lorebooks themselves are untouched.
  Nothing blocks the delete and nothing is soft-hidden behind it. Other users' references degrade instead: a session that used this character keeps the copy it started from and only loses the link — it stays fully playable, though it can no longer pull the author's changes or restore from the original — a bookmark on it stays and reads "This character doesn't exist." per [bookmarks](../bookmarks.md), and a published cut is unaffected because it recorded its own text.
- **Cancel** → [detail](detail.md)

## States

- **Owner**
- **Not the owner** → forbidden, not a silent redirect
- **Not found** — "This character doesn't exist."
- **Lorebook unavailable** — an attachment that no longer resolves stays listed as unavailable
- **Delete confirmation**
- **Submitting**


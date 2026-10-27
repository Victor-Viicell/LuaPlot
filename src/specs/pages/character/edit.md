# `/character/[character.id]/edit`

**Route** `/character/[character.id]/edit` · **Access** owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Owner-only editor for an existing character. Same form as [`/character/create`](create.md), preloaded with current values, with save and delete.

## Layout

_To be specified._

## Data

Same fields as [create](create.md), preloaded — including the full list of attached lorebooks, which can be extended and trimmed here the same way it is built there: by ID, or picked from the author's own lorebooks and the lorebooks they bookmarked from other authors. Removing an attachment removes the reference only; the lorebook itself is untouched and may still hang off other characters.

## Actions

- **Add lorebook by ID**
- **Pick lorebook** — from own lorebooks and bookmarked lorebooks from other authors
- **Remove lorebook**
- **Save** → [detail](detail.md)
- **Delete** with confirmation
- **Cancel** → [detail](detail.md)

## States

- **Owner**
- **Not the owner** → forbidden, not a silent redirect
- **Not found** — "This character doesn't exist."
- **Lorebook unavailable** — an attachment that no longer resolves stays listed as unavailable
- **Delete confirmation**
- **Submitting**

## Open questions

- What happens to sessions and published posts referencing this character on delete: blocked, soft-deleted, or left with a missing reference?
- Renaming is safe for URLs now that they are ID-based — confirm nothing else keys off the name.
- Is there an undo window after delete, or is it immediate?

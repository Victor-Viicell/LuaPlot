# `/character/[character.id]/edit`

**Route** `/character/[character.id]/edit` · **Access** owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Owner-only editor for an existing character. Same form as [`/character/create`](create.md), preloaded with current values, with save and delete.

## Layout

_To be specified._

## Data

Same fields as [create](create.md), preloaded.

## Actions

- **Save** → [detail](detail.md)
- **Delete** with confirmation
- **Cancel** → [detail](detail.md)

## States

- **Owner**
- **Not the owner** → forbidden, not a silent redirect
- **Not found** — "This character doesn't exist."
- **Delete confirmation**
- **Submitting**

## Open questions

- What happens to sessions and published posts referencing this character on delete: blocked, soft-deleted, or left with a missing reference?
- Renaming is safe for URLs now that they are ID-based — confirm nothing else keys off the name.
- Is there an undo window after delete, or is it immediate?

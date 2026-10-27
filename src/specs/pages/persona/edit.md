# `/persona/[persona.id]/edit`

**Route** `/persona/[persona.id]/edit` · **Access** signed in, owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Editor for one of the user's personas. Same form as [`/persona/create`](create.md), preloaded with current values, with save and delete.

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
- **Not found** — "This persona doesn't exist in your collection."
- **Delete confirmation**
- **Submitting**

## Open questions

- Can the default persona be deleted, or must another be promoted first?
- What happens to sessions pinned to this persona when it is deleted?
- Does editing a persona change how its past session messages are attributed in already-published cuts?

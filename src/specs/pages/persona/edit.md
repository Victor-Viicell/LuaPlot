# `/persona/[persona.id]/edit`

**Route** `/persona/[persona.id]/edit` · **Access** signed in, owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Editor for one of the user's personas. Same form as [`/persona/create`](create.md), preloaded with current values, with save and delete.

## Layout

_To be specified._

## Data

Same fields as [create](create.md), preloaded.

A persona is referenced, never copied: a session holds the persona it pinned instead of a copy of it, and a published cut holds no reference at all, only the attribution text it was published with. So neither a rename nor any other edit here reaches content that exists outside this page.

## Actions

- **Save** → [detail](detail.md)
- **Delete** with confirmation — immediate and final, no undo window and no trash. A session that pinned this persona keeps its whole transcript and shows the user's side as `User` until **Switch persona** attaches another. Published cuts are untouched: each keeps the text and the attribution it recorded when it went out.
- **Cancel** → [detail](detail.md)

## States

- **Owner**
- **Not found** — "This persona doesn't exist in your collection."
- **Delete confirmation** — the default persona is deletable. The mark moves to the most recently created remaining persona in the same step, so the collection is never left holding personas with no default, per the [conventions](../../luaplot-pages.md#conventions). Deleting the last persona leaves the collection empty, with no default.
- **Submitting**

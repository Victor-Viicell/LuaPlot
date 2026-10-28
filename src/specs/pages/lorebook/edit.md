# `/lorebook/[lorebook.id]/edit`

**Route** `/lorebook/[lorebook.id]/edit` · **Access** owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [detail](detail.md) · [create](create.md)

## Purpose

Owner-only editor for an existing lorebook and its entries, preloaded with current values, with save and delete.

## Layout

- One column, in the shape of [create](create.md): the metadata (name, avatar, SFW/NSFW toggle), then the entry list with each entry's remove control and **Add entry** beneath, then **Save** and **Cancel**.
- **Delete** sits at the foot of the page, set apart from the save controls so the two are never adjacent.

## Data

Same fields and entry list as [create](create.md), preloaded.

## Actions

- **Save** → [detail](detail.md)
- **Add / remove / reorder entries**
- **Delete** with confirmation — takes the entries and the comment thread with it in cascade, and reaches no further: a character that attaches this lorebook keeps its attachment, listed as unavailable, and a session that copied the lorebook keeps its copy and loses only the link.
- **Cancel** → [detail](detail.md)

## States

- **Owner**
- **Not the owner** → forbidden
- **Not found** — "This lorebook doesn't exist."
- **Delete confirmation**
- **Submitting**

## Rules

- Saving writes to the live lorebook: a fork or a new session copies the entries as they now stand, while a session already in progress reads its own copy and is untouched — only its owner can pull the newer version into it, per [the session spec](../session/detail.md).
- The confirmation lists no referencing characters: an attachment is a reference by ID, so deletion is never blocked by the characters that read the lorebook and no reverse lookup is run to warn them. It states the consequence once instead, and those characters degrade to an unavailable attachment, per [character detail](../character/detail.md).
- Editing clears the lorebook's verified flag like any other edit, so its next report starts a fresh scan.

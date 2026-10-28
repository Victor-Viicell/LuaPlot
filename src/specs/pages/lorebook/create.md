# `/lorebook/create`

**Route** `/lorebook/create` · **Access** signed in, else redirect to `/authentification` · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [detail](detail.md)

## Purpose

Authoring view for a new lorebook: its metadata plus the individual entries (keywords plus content) that get injected during a session.

## Layout

- One form, one column, in the same shape as [`/character/create`](../character/create.md): the metadata (name, avatar, SFW/NSFW toggle) first, then the entry list, then **Save** and **Cancel** at the end.
- The entry list is the bulk of the form: one block per entry, holding its keywords and its content, with that entry's remove control on it and **Add entry** below the list.
- The editor is a page of its own, never embedded in [`/character/create`](../character/create.md): that form attaches existing lorebooks by ID or from a picker, and authoring a new one is a separate visit here.

## Data

- **Name** — display label only; duplicates allowed.
- **Avatar** — the lorebook's image.
- **NSFW** — boolean toggle, SFW by default.
- **Entries** — each with keywords and content.
- **Keywords** — the words an entry is matched on; at least one per entry.
- **Content** — the text injected when an entry matches; never empty.

Entries are written one at a time in this form: there is no import from pasted text or from a file.

Entry order is display order only. Matching is keyword-driven and order carries no priority, so when several entries match, every one of them is injected, listed in display order.

No cap applies to the number of entries or to the length of an entry's content: the editor stores what the author writes, and validation only requires a keyword and non-empty content.

## Actions

- **Add entry**
- **Remove entry**
- **Reorder entries**
- **Save** → [detail](detail.md)
- **Cancel** → [catalog](catalog.md)

## States

- **Validation error** — a missing keyword, empty content, or a missing required field
- **No entries yet**
- **Submitting**
- **Save failed**

# `/lorebook/create`

**Route** `/lorebook/create` · **Access** signed in, else redirect to `/authentification` · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [detail](detail.md)

## Purpose

Authoring view for a new lorebook: its metadata plus the individual entries (keywords plus content) that get injected during a session.

## Layout

_To be specified._

## Data

Fields to be specified. Known so far:

- **Name** — display label only; duplicates allowed.
- **Avatar** — the lorebook's image.
- **NSFW** — boolean toggle, SFW by default.
- **Entries** — each with keywords and content.

## Actions

- **Add entry**
- **Remove entry**
- **Reorder entries**
- **Save** → [detail](detail.md)
- **Cancel** → [catalog](catalog.md)

## States

- **Validation error**
- **No entries yet**
- **Submitting**
- **Save failed**

## Open questions

- Is entry order meaningful (priority on conflicting injections), or is matching purely keyword-driven?
- Is there a cap on entries or content length per entry?
- Can entries be imported from text or a file, or is it one-by-one only?
- Is this editor usable inline from [`/character/create`](../character/create.md)?

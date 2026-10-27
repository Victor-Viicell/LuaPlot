# `/persona`

**Route** `/persona` · **Access** signed in, owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [create](create.md) · [detail](detail.md)

## Purpose

The signed-in user's own collection of personas. This is a personal list, not a catalog: it holds only the current user's personas, marks which one is their default, and links to create, view, and edit. Sharing a persona is not a feature, so there is nothing here for anyone else to browse.

## Layout

_To be specified._

## Data

_To be specified._

## Actions

- **Create** → [create](create.md)
- **Open** → [detail](detail.md)
- **Edit** → [edit](edit.md)
- **Set as default**

## States

- **Empty** — no personas yet
- **Populated**
- **No default chosen**

## URL

Search and sort use the query string, per the [conventions](../../luaplot-pages.md#conventions), for consistency with the public catalogs.

## Open questions

- Is a default persona required, or is the first persona implicitly the default?
- Is this a card grid like the catalogs, or a simpler list given it is private and small?
- Where is this page linked from besides the app shell?

# `/persona/[persona.id]`

**Route** `/persona/[persona.id]` · **Access** signed in, owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [collection](collection.md) · [edit](edit.md)

## Purpose

Personal detail page for one of the user's personas. Shows the definition and offers the available actions: use as default, edit, delete. Addressed by ID because a user may hold several personas with the same name.

## Layout

_To be specified._

## Data

_To be specified._

## Actions

- **Set as default**
- **Edit** → [edit](edit.md)
- **Delete** with confirmation
- **Start a session** with this persona

## States

- **Default persona**
- **Not found** — "This persona doesn't exist in your collection."
- **Another user's persona** → same message, since personas are not addressed across accounts
- **Delete confirmation**

## Open questions

- Is there a "not found" versus "not yours" distinction, or both collapse to 404?
- Should the page list sessions currently using this persona?
- What does starting a session from here require: a character, or a character plus preset?

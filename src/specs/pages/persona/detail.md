# `/persona/[persona.id]`

**Route** `/persona/[persona.id]` · **Access** signed in, owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [collection](collection.md) · [edit](edit.md)

## Purpose

Personal detail page for one of the user's personas. Shows the definition and offers the available actions: use as default, edit, delete. Addressed by ID because a user may hold several personas with the same name.

## Layout

- A header holding the avatar, the name, the tagline, and the default mark when this persona holds it, with the actions beside it: **Set as default**, **Start a session**, **Edit**, **Delete**.
- Beneath the header the description and personality, read-only.
- No engagement row, no report control, and no comment thread: personas are personal, so none of the shared-item chrome appears.

## Data

- **Identity** — the avatar, the name, the tagline, and the description and personality, exactly as [create](create.md) saved them and [edit](edit.md) last changed them.
- **Default** — whether this persona is the one a session uses when none is chosen. Exactly one persona carries the mark once the collection holds any, so the state is either this one or none.
- **Sessions using it** — not shown. The page neither lists nor counts the sessions this persona is attached to; the persona in use is visible inside its own [session](../session/detail.md), and a persona page never enumerates conversations.
- **Engagement** — absent: no likes, dislikes, ratio, comment count, or bookmark. Nothing about a persona is shared, so nothing about it is counted.

## Actions

- **Set as default** — moves the mark off whichever persona held it
- **Edit** → [edit](edit.md)
- **Delete** with confirmation
- **Start a session** with this persona — asks for a character first, which brings that character's lorebooks and preset; if the user already has a session with that character, this opens it (Continue) rather than starting a second one, and the persona is then in use for the user's side

## States

- **Default persona** — this one carries the mark
- **Not found** — "This persona doesn't exist in your collection." An ID belonging to another account renders the same state and the same message: personas are not addressed across accounts, so there is no separate "not yours" page and no distinction between missing and unowned.
- **Delete confirmation**

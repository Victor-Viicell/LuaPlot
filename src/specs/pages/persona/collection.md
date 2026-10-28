# `/persona`

**Route** `/persona` · **Access** signed in, owner only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [create](create.md) · [detail](detail.md)

## Purpose

The signed-in user's own collection of personas. This is a personal list, not a catalog: it holds only the current user's personas, marks which one is their default, and links to create, view, and edit. Sharing a persona is not a feature, so there is nothing here for anyone else to browse.

## Layout

- A toolbar holding search, sort, and **Create** — the page's only entry to [create](create.md) — above a grid of persona cards.
- A card carries the avatar, the name, and the tagline, and the one holding the default says so on the card. No author, no ratio, no comment count: a persona has one possible owner and no engagement.
- No paging: the collection is personal and small, so every persona renders in one grid and there is no **Load more** control.
- **Reached from** the app shell's personas entry and from the cancel on [create](create.md). No other page links here: personas are absent from [profiles](../user/profile.md) and never shared, so there is nothing elsewhere to link from.

## Data

- **Persona** — avatar, name, tagline, and whether it is the default.
- **Default** — exactly one persona carries it once the collection holds any, and none does while it is empty. Nothing waits on it: no page blocks on a user having a default.

A default is not a separate requirement. The first persona saved from [create](create.md) takes the mark without a second step, and **Set as default** moves it — the collection is never left with personas and no default.

## Actions

- **Create** → [create](create.md)
- **Open** → [detail](detail.md)
- **Edit** → [edit](edit.md)
- **Set as default** — moves the mark off whichever persona held it
- **Search** — filters the grid by name
- **Sort**

## States

- **Empty** — no personas yet; the grid is replaced by the prompt to create the first one
- **Populated** — every persona listed, exactly one carrying the default mark
- **No results for the active query** — search matched nothing; **Create** stays available

## URL

Search and sort use the query string, per the [conventions](../../luaplot-pages.md#conventions), for consistency with the public catalogs.


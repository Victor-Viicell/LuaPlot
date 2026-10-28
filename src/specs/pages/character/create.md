# `/character/create`

**Route** `/character/create` · **Access** signed in, else redirect to `/authentification` · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [detail](detail.md)

## Purpose

Authoring view for a new character: defines its identity — the public name and the shorter name it is called by inside a session — its description and personality, and the lorebooks it draws on. Saves into the current user's account and goes to the character's detail page.

Save publishes: there is no draft state, so the character is public the moment it saves, and moderation is the only thing that can take it out of public view.

## Layout

- One form, one column: the identity fields (name, in-session name), then description and personality, then the image and the SFW/NSFW toggle, then the lorebook attachments.
- Lorebook attachments are a list, not a single field: an input for a lorebook ID, a picker beside it, and the current attachments beneath, each with its own remove control.
- **Save** and **Cancel** sit at the end of the form.

## Data

Fields:

- **Name** — the public display label ("Sonic the Hedgehog"). Display only: the same name can be used any number of times, by the same author or different ones, with no uniqueness check and no warning.
- **In-session name** — how the character is called inside a chat session ("Sonic"). Characters are the only type that carries one. Optional; when left empty the Name is used.
- **Description / personality**
- **Avatar** — the character's image.
- **NSFW** — boolean toggle, SFW by default.
- **Attached lorebooks** — any number, from zero up, each stored by ID. The character may reference the author's own lorebooks and any public lorebook authored by someone else. Two ways to add one:
  - **By ID** — type or paste a lorebook ID into the input and confirm.
  - **From a picker** — a list of the author's own lorebooks plus the lorebooks they have bookmarked that are not their own, per [bookmarks](../bookmarks.md).
- Attachments are references, not copies: the same lorebook can hang off any number of characters, and editing it changes what every one of them reads. A session is the one exception — it snapshots the lorebooks it starts with, per [the session spec](../session/detail.md).

## Actions

- **Add lorebook by ID**
- **Pick lorebook** — from own lorebooks and bookmarked lorebooks from other authors
- **Remove lorebook** — from its row in the attachment list
- **Save** → [detail](detail.md)
- **Cancel** → [catalog](catalog.md)

## States

- **Validation error** — including an ID that resolves to nothing the author may attach
- **Lorebook unavailable** — an attachment that no longer resolves stays listed as unavailable rather than silently vanishing
- **Submitting**
- **Save failed**

# `/post/create`

**Route** `/post/create` · **Access** signed in · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [thread](thread.md) · [detail](detail.md)

## Purpose

Composer for a new public post: a body, an SFW/NSFW flag, and at most one optional attachment — one of the author's characters, or a cut taken from one of their own sessions. The kind of post is chosen and stored nowhere: a body with no attachment is a plain text post, a body with a character is a character share, a body with a cut renders that cut.

When the attachment is a cut, the author also chooses how their own side is attributed: by the persona's name, or as a generic `User`.

A post is written once. There is no edit route and no draft, so correcting a post means deleting it and publishing again — the same rule as a comment, and it keeps a post that passed a scan from changing underneath its verification. Publishing makes the post public immediately; only moderation can take it out of public view.

## Layout

- One form, one column: the body editor with inline image and GIF insertion, then the attachment with its picker, then the SFW/NSFW toggle, then **Publish** and **Cancel**.
- **Sender attribution** appears only once a cut is attached: a body alone or with a character has no user side to attribute.
- Opened from the [thread](thread.md) or from a [session](../session/detail.md), the same form renders in a panel over that page instead of at its own route, and publishing from the panel returns to the page it was opened on. The session instance arrives with the cut already attached.

## Data

- **Body** — text with images and GIFs inserted inline, as part of the body rather than a second attachment list. Same media rules as a comment: PNG, JPEG, WebP, and GIF, up to 10 MB each and four per post.
- **NSFW** — boolean toggle, SFW by default.
- **Attachment** — at most one, and only the author's own content: one of their characters, or a cut from one of their own sessions. A lorebook or a preset cannot be attached, and neither can an item authored by somebody else; a lorebook or preset reaches a post only through a character that carries it.
- **Sender attribution** — the persona's name or `User`, chosen when a cut is attached. The post records that attribution as text at publish time, so it does not follow later changes to the persona.

## Actions

- **Insert image or GIF** into the body
- **Pick a character** — from the author's own characters
- **Attach a cut** — from one of the author's own sessions, the same cut the session's publish control produces, per [the session spec](../session/detail.md)
- **Remove attachment**
- **Publish** → [detail](detail.md)
- **Cancel** → previous context

## States

- **No attachment** — body only, a plain text post
- **Attachment selected** — a character, or a cut with the attribution choice
- **Validation error** — an empty body, a fifth image, or a file over the size limit
- **Publishing**
- **Publish failed** — the draft stays in the composer for another attempt

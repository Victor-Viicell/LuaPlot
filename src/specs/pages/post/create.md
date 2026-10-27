# `/post/create`

**Route** `/post/create` · **Access** signed in · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [thread](thread.md) · [detail](detail.md)

## Purpose

Composer for a new public post. The author picks the post type, writes the body, and may attach one of their characters or a cut taken from one of their own sessions before publishing. When attaching a cut, the author also chooses how their own side is attributed: by the persona's name, or as a generic `User`. The same composer is reachable inline from the thread and from a session.

## Layout

_To be specified._

## Data

Fields to be specified. Known so far:

- **Post type** — character share, idea, or session cut. A plain text post is the default; comments are a separate entity, not a post kind.
- **Body** — text plus inline images and GIFs.
- **NSFW** — boolean toggle, SFW by default.
- **Attachment** — a character, or a cut from one of the author's sessions.
- **Sender attribution** — persona name or `User`, when a cut is attached.

## Actions

- **Publish** → [detail](detail.md)
- **Cancel** → previous context

## States

- **No attachment**
- **Attachment selected**
- **Validation error**
- **Publishing**
- **Publish failed**

## Open questions

- Can posts be edited or deleted after publishing?
- Are the remaining post kinds (character share, idea, session cut) needed as explicit types, or is every post just a body plus an optional attachment?
- Can a post attach something that is not its own, or only the author's content?
- Can a lorebook or preset be attached, or only characters and session cuts?
- Is the composer a route, an inline panel, or both?
- Are image and GIF attachments part of the body, or a separate attachment list with their own limits?

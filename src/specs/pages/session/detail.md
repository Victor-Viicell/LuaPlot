# `/session/[session.id]`

**Route** `/session/[session.id]` · **Access** signed in, participant only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [post create](../post/create.md) · [persona detail](../persona/detail.md)

## Purpose

Active chat session. Loads the participants (character, lorebook, preset, and persona) for that session and renders the conversation with message input, so the user can continue or review an existing session. The persona is the user's own side of the conversation: the session is pinned to one, with the user's default persona used at creation, and it can be swapped mid-session without losing the transcript. A stretch of the conversation can be published as a cut, which becomes a public post while the session itself stays private. When publishing, the author chooses whether their own messages are attributed to the persona or shown as a generic `User`.

## Layout

_To be specified._

## Data

_To be specified._

## Actions

- **Send message**
- **Switch persona**
- **Publish a cut** → [post create](../post/create.md) with attribution choice
- **Open participant** → character, lorebook, preset, or persona

## States

- **Loading**
- **Active**
- **Awaiting model response**
- **Send failed**
- **Not found** — "This session doesn't exist."
- **Not a participant** → same message, since sessions are not addressed across accounts

## Open questions

- Does switching persona mark a boundary in the transcript, or is it seamless?
- How is the cut boundary chosen — drag-select, message range, or from a message onward?
- Can a session be renamed, archived, or deleted, and is there a list view of sessions anywhere?
- Are messages editable or deletable, and does that reach into already-published cuts?

# `/session/[session.id]`

**Route** `/session/[session.id]` · **Access** signed in, participant only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [post create](../post/create.md) · [persona detail](../persona/detail.md)

## Purpose

Active chat session, rendered from copies of its participants rather than from the items themselves: the character, every lorebook attached to that character, and the preset are snapshotted when the session starts, and the session reads only its own copies from then on. So an author editing a character never changes a session already running, and the session owner editing a copy never changes the character for anyone else.

Each copy keeps a link back to the item it came from. While that link resolves, the session can pull a newer version of the item or fall back to the version it was copied from; when the original is deleted, or made private to the session's owner, the session loses the link and nothing else — the copies stay, and the conversation continues.

The persona is the user's own side of the conversation and is not copied: the session is pinned to one, with the user's default persona used at creation, and it can be swapped mid-session without losing the transcript. A stretch of the conversation can be published as a cut, which becomes a public post while the session itself stays private, and the cut records the text as it stands in the session, the owner's edits included. When publishing, the author chooses whether their own messages are attributed to the persona or shown as a generic `User`.

Sessions are private and unmoderated: JEV never reads one, and no other user can report one. Enforcement stops at the distribution of public content — inside a session, what the user does is under their own control, and a copy edited inside one answers to the terms only once it leaves as a published cut.

## Layout

_To be specified._

## Data

- **The copies** — the character definition with its in-session name, each attached lorebook, and the preset, each copied at session start. Every session takes its own copies, so two sessions of one character can diverge without touching each other or the original.
- **The link** — each copied participant stores the ID of the item it came from. The link is what makes the two recreation actions possible, and a deleted original, or one made private to this user, drops the link and nothing more: no participant is marked unavailable and the session stays fully usable.
- **Nothing flows backwards** — edits inside a session never reach the original, and edits the author makes never reach a session that already started. The only path between them is the link, and it is pulled on purpose.
- **Editing a copy is free** — the session owner may rewrite the character, any of its lorebooks, and the preset for this session only. No moderation, no verification, no effect outside it.
- **Each copy's state** — untouched since it was copied, edited in the session, or refreshed from the original, so **Restore** is never offered where there is nothing to restore.
- **The persona in use** — live rather than copied, attached at start and swappable mid-session.
- **The transcript** — turns under the character's in-session name, the message input, and the publish-a-cut control.

## Actions

- **Send message**
- **Switch persona**
- **Edit session copy** — the character, any of its lorebooks, or the preset, in a session-scoped editor that writes only to the copy
- **Update from original** — per participant, while the link resolves: replaces that copy with the item's current version, which is how an author's later edits get in. It overwrites the session's own edits to that copy, so it confirms first.
- **Restore** — per participant: puts the copy back to the version it was taken from and discards the session's edits. It brings in nothing the author changed since; that is what **Update from original** is for.
- **Publish a cut** → [post create](../post/create.md) with attribution choice
- **Open participant** — opens the session's copy, with the original reachable beside it while the link holds

## States

- **Loading**
- **Active**
- **Awaiting model response**
- **Send failed**
- **Not found** — "This session doesn't exist."
- **Not a participant** → same message, since sessions are not addressed across accounts
- **Linked** — the copy can still pull from its original
- **Unlinked** — the original is gone or out of reach; the copy runs anyway, without the link actions
- **Edited copy** — changed inside the session, with **Restore** available
- **Updated from original** — refreshed to the item's current version

## Open questions

- Does switching persona mark a boundary in the transcript, or is it seamless?
- How is the cut boundary chosen — drag-select, message range, or from a message onward?
- Can a session be renamed, archived, or deleted, and is there a list view of sessions anywhere?
- Are messages editable or deletable, and does that reach into already-published cuts?
- Does a published cut inherit the character's NSFW flag, or is the author asked again? A cut is public, so the flag matters even though the session does not.
- Does a session started from a forked character link to the fork, or to the character the fork was copied from?

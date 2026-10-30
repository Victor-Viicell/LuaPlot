# T-10B — fork + Start/Continue on the character page

Displaced from T-10 on 2026-10-30 so T-10 could stay one session's work. Both actions need adapter
**writes** that do not exist yet:

- `forkCharacter(id)` — copies the definition as `character/create.md` holds it (in-session name
  included), carries `lorebookIds` as references, drops any attachment the forker cannot see, lands
  the viewer on the new character's detail page.
- `createSession(characterId)` — a session row whose participants are **copies** (`session/detail.md`:
  the character, every attached lorebook and the preset are snapshotted at start), one per character
  per user, with `findSessionForCharacter` deciding whether the primary control reads Start or
  Continue.

## Why it is not inside T-10

T-15 owns the session page, the participant copies, New Session, Delete and the publish-a-cut flow.
A half-built `createSession` inside T-10 would be rewritten there, and the copy rule (what is copied,
what is a reference, what the link keeps) is the most intricate rule in the specs. Fork is small but
shares the "copy an authored item" shape, so both belong in one ticket after T-15 has settled the
copy semantics — or before it, if the session control is wanted sooner, in which case
`createSession` must be written to T-15's rule rather than to a local guess.

## Acceptance

- Fork from another author's character produces a new character owned by the viewer with the same
  definition, the same in-session name, and references to the same lorebooks; an attachment the
  viewer cannot see is absent from the fork rather than broken.
- The primary control on `/character/[id]` reads **Start a session** when
  `findSessionForCharacter` answers `null` and **Continue** when it answers a session, opening the
  most recent one; a second session is reachable only from the settings menu's **New Session**.
- Every write is reflected in the UI without a reload (the adapter returns the updated rows).

## Traps

- One session per character per user is the adapter's rule, not the page's: ask
  `findSessionForCharacter`, never scan.
- A fork is a new item with its own id — it must not carry the original's engagement, bookmarks or
  comments (`luaplot-pages.md`: engagement is per item).
- The forker's own private lorebooks may be attached; someone else's private ones may not.

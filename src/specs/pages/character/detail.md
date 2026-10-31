# `/character/[character.id]`

**Route** `/character/[character.id]` · **Access** public · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [catalog](catalog.md) · [edit](edit.md)

## Purpose

Public read-only detail page for one character. Shows the full definition, credits the owner, and offers the actions available on it: start or continue a session, fork or copy, and edit when owned.

## Layout

- **The avatar is the cover**: it spans the full width of the content column and is **square (1:1)** — full-bleed
  on a phone, a fixed 320px column from `sm` — with the name and the controls beside it rather than above it.
  The same treatment carries to every item page, so a lorebook or preset reads with the same portrait the
  character does.
- A **settings button** sits in the top right of the header, the same control the [session](../session/detail.md) carries. Its menu holds, in order: **New Session**, **Bookmark / Remove bookmark**, **Report**, and **Edit** for the owner. The page's main controls stay on the page; the menu is for what does not need a permanent button.
- The rest of the layout is still to be specified.

## Data

Shown on the page:

- **Identity** — the name, the avatar, and the description and personality. The in-session name is shown beside the name when it is set and differs, since it is what the character is called inside a [session](../session/detail.md).
- **Attached lorebooks** — the full list, each a link to `/lorebook/[lorebook.id]`; they are referenced, never embedded here. Any number may be attached, including public lorebooks by other authors. An attachment that no longer resolves stays in the list as unavailable rather than disappearing.

Engagement shown on the page:

- **Likes / dislikes** — both raw counts, beside the ratio between them as a percentage: the detail page is where the counts live, while a card shows only the ratio.
- **Comment count**, with the [comment thread](../../components/comment-thread.md) beneath the definition.
- **Bookmark state** for the signed-in viewer.
- **Moderation notice** (owner only, while private): the report, the reasons, and the measures taken.

Nothing else is counted here: no session or usage count, and no strip of the author's other work. The author link goes to [their profile](../user/profile.md), which already lists what they made.

## Actions

- **Like / dislike** — one vote per viewer; switching replaces the previous vote. The author votes like any other viewer: no self-vote exemption, and their vote counts toward the ratio
- **Bookmark / unbookmark**
- **Report** → [report](../../components/report.md)
- **Request public again** (owner, while private) — flags the content for JEV re-verification
- **Comment** on this character → [comment thread](../../components/comment-thread.md)
- **Start a session** (while the viewer has no session with this character) → [session](../session/detail.md) — pins the viewer's default [persona](../persona/collection.md), then copies this character, its lorebooks, and the chosen preset into the session, per [the session spec](../session/detail.md). An account with no persona is not prompted and not blocked: the session starts unattributed, the user's side reads `User`, and **Switch persona** attaches one later.
- **Continue** (once a session with this character exists) — the same control, relabelled, opening that conversation where it was left rather than starting another. It opens the most recent session with this character; a second one is started deliberately, from the settings menu.
- **New Session** — first option of the settings menu: starts a fresh session from this character, with new copies of it, its lorebooks, and the preset, leaving any existing session and its copies untouched.
- **Fork / copy** into the viewer's account — copies the definition as [create](create.md) holds it, the in-session name included, with the lorebook attachments carried as references. The lorebooks themselves are never copied, so the fork reads the same lorebooks the original does; an attachment the forker cannot see is dropped from the copy instead of arriving broken. Lands on the new character's [detail](detail.md) page.
- **Edit** (owner only) → [edit](edit.md)
- **Open author** → [profile](../user/profile.md)

## States

- **Another user's character**
- **Own character**
- **Not found** — "This character doesn't exist."
- **Fork in progress**
- **Signed out** — can read, cannot vote, comment, or bookmark
- **Voted or bookmarked**
- **Reported**
- **No session with this character** — the control reads **Start a session**
- **Session in progress** — the same control reads **Continue**, opening the most recent conversation with this character
- **Privated by moderation** — the owner sees the report, reasons, and measures; everyone else sees it as unavailable
- **Awaiting re-verification**


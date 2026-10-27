# `/moderation/[report.id]`

**Route** `/moderation/[report.id]` · **Access** signed in, admin role only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [queue](queue.md) · [JEV](../../systems/jev.md) · [terms](../terms.md)

## Purpose

Review and conclude a single case JEV could not decide: uncertain content, or a copy claim it will not judge (any copied image, or copied text from outside LuaPlot). Human review is the exception, so this page is deliberately narrow: the moderator inspects the content, records a reason, chooses public or private, may remove the avatar, and closes the case. It is not a deletion tool — authored content can only be made private, and a post or comment is removed only after a violation is confirmed.

## Data

- The reported item: type, content, its avatar, and current visibility.
- The reports: cumulative, each with its own reason and details, plus the total count, the spread of reasons, and when the last one arrived.
- Which part carries the violation: the avatar or image, or the text. Avatar removal exists only for the case where the avatar is serious and the text itself is valid.
- For a copy claim: the named source, and whether it is internal (with JEV's comparison) or external (needing manual verification).
- The terms checklist, and which ones the moderator has confirmed for a dismissal.
- JEV's classification and confidence, plus what it already did — made private or escalated without acting.
- Case history: prior actions, internal comments, and who made them.
- Status: open or concluded.

## Actions

- **Conclude** — close the case with a visibility outcome: set the content back to public, or leave it private. A confirmed violation on a post or comment removes it; a removed comment becomes a placeholder that keeps its replies (see [comment thread](../../components/comment-thread.md)).
- **Remove avatar** — not a standalone action. It is an option taken at conclusion, when the avatar carries the serious violation while the text is valid; removal is then combined with either visibility outcome. This is the one content edit a moderator can make, and JEV never makes it.
- **Set reason** — record or correct the reason behind the decision.
- **Comment** — internal note on the case, never shown publicly.
- **Dismiss** — no violation. The moderator must inspect the content and tick a checkbox for each term; every box must be ticked before the case can be dismissed. Escalated content was never hidden, so nothing returns to view.

## States

- **Open**
- **Concluded**
- **Content public** — the normal state of an escalated case
- **Content private** — already privatised before the moderator opened the case
- **Content already removed** by its author or by JEV
- **No avatar to remove**
- **Not an admin** → forbidden
- **Not found** — "This report doesn't exist."
- **Concluding**

## Open questions

- When a moderator dismisses, does a JEV-private item return to public automatically, or must the owner still request republication?
- After a moderator removes an avatar, is the content re-verified before it goes public, or does it return as-is?
- For an external copy claim, what evidence is the moderator expected to record — a link, a screenshot, a note?
- Does concluding notify the creator as well as the reporter, or does JEV already notify them?
- Do internal comments form a thread, and are they visible to every admin?
- Can a concluded case be reopened, and by whom?
- Is every action logged with the admin identity as an audit trail?

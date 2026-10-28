# `/moderation/[report.id]`

**Route** `/moderation/[report.id]` · **Access** signed in, admin role only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [queue](queue.md) · [JEV](../../systems/jev.md) · [terms](../terms.md)

## Purpose

Review and conclude a single case JEV could not decide: uncertain content, or a copy claim it will not judge (any copied image, or copied text from outside LuaPlot). Human review is the exception, so this page is deliberately narrow: the moderator inspects the content, records a reason, chooses public or private, may remove the avatar, and closes the case. It is not a deletion tool — authored content can only be made private, and a post or comment is removed only after a violation is confirmed.

## Data

- The reported item: type, content, its avatar, and current visibility.
- The reports: cumulative, each with its own reason and details, plus the total count, the spread of reasons, and when the last one arrived.
- Which part carries the violation: the avatar or image, or the text. Avatar removal exists only for the case where the avatar is serious and the text itself is valid.
- For a copy claim: the named source, and whether it is internal (with JEV's comparison) or external (needing manual verification). An external claim is judged by opening the source the claim named; what was compared is recorded as the case reason plus an internal comment, and nothing is uploaded — the claim carries a link, not a file.
- The terms checklist, and which ones the moderator has confirmed for a dismissal.
- JEV's classification and confidence, plus what it already did — made private or escalated without acting.
- Case history: prior actions, internal comments, and who made them. Comments are a flat chronological list, never a thread — no replies — and every admin sees the whole history. Every moderator action lands there with the admin's identity and its time, which is the case's audit trail; JEV's own action appears only as what it already did, with no admin attached.
- Status: open or concluded.

## Actions

- **Conclude** — close the case with a visibility outcome: set the content back to public, or leave it private. A confirmed violation on a post or comment removes it; a removed comment becomes a placeholder that keeps its replies (see [comment thread](../../components/comment-thread.md)).
- **Remove avatar** — not a standalone action. It is an option taken at conclusion, when the avatar carries the serious violation while the text is valid; removal is then combined with either visibility outcome. This is the one content edit a moderator can make, and JEV never makes it.
- **Set reason** — record or correct the reason behind the decision.
- **Comment** — internal note on the case, never shown publicly.
- **Dismiss** — no violation. The moderator must inspect the content and tick a checkbox for each term; every box must be ticked before the case can be dismissed. It changes no visibility: escalated content was never hidden, so nothing returns to view. A private item found clean is concluded with the public outcome instead — dismissal says the report was wrong, while conclusion is the action that sets visibility.

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

## Rules

- Concluding notifies the creator, because it is their content whose visibility changed; [notifications](../notifications.md) is where moderation decisions on own content arrive, from JEV or from a moderator. The reporter is never told the outcome, per [report](../../components/report.md).
- Removing the avatar is an edit and clears the verified flag like any other change, but it delays nothing: the case concludes and the content goes public in the same operation, since the moderator has already judged the remaining text valid. The cleared flag only makes the item eligible for a scan on its next report.
- A concluded case is final. No reopen control exists, for any admin: a fresh report on the same item after conclusion opens a new case, which is the only route back under review.

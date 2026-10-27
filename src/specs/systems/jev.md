# JEV

**Type** asynchronous moderation system · **Index** [luaplot-pages.md](../luaplot-pages.md) · **Related** [report](../components/report.md) · [terms](../pages/terms.md)

## Purpose

JEV is the categorization model that sits between a [report](../components/report.md) and a decision. It is not a page and not user-facing: reported content enters a periodic queue, JEV classifies it against the [terms](../pages/terms.md), and it takes the smallest action that makes the content safe. The guiding constraint is that JEV can hide content but can never destroy it.

## Pipeline

1. A report is submitted on a shared item or a comment.
2. The item joins JEV's queue; nothing happens instantly.
3. JEV classifies it against the terms: copied content, missing NSFW flag, illegal content, or no violation.
4. JEV acts according to what the content is — see the table below.
5. When content is removed or made private, the creator is alerted.

## Decisions

| Content | JEV may |
| --- | --- |
| Comment | Remove it |
| Post | Remove it |
| Character | Make it private, then alert the creator |
| Lorebook | Make it private, then alert the creator |
| Preset | Make it private, then alert the creator |
| Realistic sexual depiction of a minor | Escalate immediately — this never waits in the queue |
| Anything it is unsure about | Request human review, leaving the content untouched meanwhile |

## Rules

- JEV never deletes characters, lorebooks, or presets. Private is the strongest action it has on authored content, and the creator is alerted when it happens.
- Comments and posts can be removed outright, since they are the smaller unit of content.
- Unsure is a valid outcome. Classification should not guess; it escalates.
- Realistic sexual depictions of minors are never an unsure case. They escalate immediately, ahead of the periodic queue.
- Stylized loli and shota content is not treated as literal CSAM. It is judged as ordinary NSFW content: a violation only when the flag is missing.
- The queue is periodic, so a report is not a realtime action and the reporter gets no immediate verdict.
- JEV reads the same NSFW boolean the creator sets, so a correctly flagged item is not a violation for being NSFW.

## States

- **Queued**
- **Classifying**
- **Removed**
- **Made private**
- **Escalated to human review**
- **Dismissed** — no violation found

## Open questions

- Who is the human reviewer, and where do they see escalation? No route or role exists for this yet.
- Can a creator appeal a private or a removal, or request restoration?
- Is the reporter told the outcome, and does that go through the sparse notification rules?
- What happens to the replies under a removed comment, or the comments under a removed post?
- Is content rescanned when edited, or only when reported?
- Does JEV classify images as well as text, now that every item carries one?
- How long is the queue period, and is a report duplicated if several users report the same item?

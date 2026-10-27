# `/moderation`

**Route** `/moderation` · **Access** signed in, admin role only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [case](detail.md) · [JEV](../../systems/jev.md) · [report](../../components/report.md)

## Purpose

The admin queue of cases [JEV](../../systems/jev.md) could not decide: content it is unsure about, and copy claims it will not judge (any copied image, or copied text from outside LuaPlot). JEV's confirmed violations never wait here — it acts immediately. Cases are ordered by weight, meaning the number of reports attached: a pile-on outranks a single allegation, and every new report raises an item's weight. This page is the list; every decision happens on the case itself at [`/moderation/[report.id]`](detail.md). Without this queue, escalation has no destination.

## Data

- **Escalated cases**: content type, JEV's classification, the report reason, how many reports are attached (the case's weight), and when the last one arrived.
- Why the case is here: JEV unsure, copied image, external copied text, or a combination.
- Case status: open or concluded.
- Counts: open cases versus concluded.

## Actions

- **Open case** → [detail](detail.md)
- **Filter** — open, concluded, or all

Ordering is not a control: most reports first.

## States

- **Empty queue**
- **Populated**
- **Not an admin** → forbidden
- **Loading**

## Open questions

- Are concluded cases kept indefinitely, or archived after a while?
- Do JEV's immediate actions appear here as concluded cases for audit, or stay out of the queue entirely?
- Do reports held against verified content appear here, so a moderator can see what was skipped?
- Can an admin claim a case, so two reviewers do not work the same one?
- Does the queue show a preview of the content, or only metadata?
- Does a case that keeps receiving reports climb indefinitely, or is weight capped or decayed so old items cannot starve new ones?

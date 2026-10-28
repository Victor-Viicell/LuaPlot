# `/moderation`

**Route** `/moderation` · **Access** signed in, admin role only · **Index** [luaplot-pages.md](../../luaplot-pages.md) · **Related** [case](detail.md) · [JEV](../../systems/jev.md) · [report](../../components/report.md)

## Purpose

The admin queue of cases [JEV](../../systems/jev.md) could not decide: content it is unsure about, and copy claims it will not judge (any copied image, or copied text from outside LuaPlot). JEV's confirmed violations never wait here — it acts immediately. Cases are ordered by weight, meaning the number of reports attached: a pile-on outranks a single allegation, and every new report raises an item's weight. This page is the list; every decision happens on the case itself at [`/moderation/[report.id]`](detail.md). Without this queue, escalation has no destination.

## Data

- **Escalated cases**: content type, JEV's classification, the report reason, how many reports are attached (the case's weight), and when the last one arrived.
- Why the case is here: JEV unsure, copied image, external copied text, or a combination.
- Case status: open or concluded.
- Counts: open cases versus concluded.
- No preview: the row carries metadata only. The reported item, its avatar, and the reports are inspected on the case itself.

## Actions

- **Open case** → [detail](detail.md)
- **Filter** — open, concluded, or all

Ordering is not a control: most reports first. Nothing is claimed or assigned either: a case belongs to no moderator, and the case history is where one says they are working it.

## States

- **Empty queue**
- **Populated**
- **Not an admin** → forbidden
- **Loading**

## Rules

- Cases exist only for what JEV could not decide. Its immediate actions — a post or comment removed, an item made private — open no case and never enter the queue: the creator is notified, the reasons sit on the content page, and a case that follows shows that earlier action only as what JEV already did.
- Reports held against verified content open no case and stay out of the queue. They remain attached to the item, and count toward its weight once it is reported again after a change.
- Concluded cases are kept indefinitely. There is no archive step: the concluded filter is how one is found again, and its history is the record of what was decided.
- Weight never decays and is never capped. Every report adds one, and cases of equal weight are ordered by their last report, newest first.

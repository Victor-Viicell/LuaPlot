# `/terms`

**Route** `/terms` · **Access** public · **Index** [luaplot-pages.md](../luaplot-pages.md) · **Related** [report](../components/report.md)

## Purpose

The terms of use: the rules content has to follow. Deliberately short — three prohibitions, not a legal document. Every report reason on the [report](../components/report.md) control maps back to one of them.

## Rules

1. **No copied content** — posting another user's content as your own.
2. **No unmarked NSFW** — NSFW images and text must be flagged as NSFW. NSFW content that carries no flag breaks the terms. This applies to an avatar on otherwise safe content too: the flag is what keeps the image away from people who filtered NSFW out.
3. **No illegal content** — including realistic sexual depictions of minors, real personal information, death threats, messages of violence, and degrading a real person.

### Where the line sits

Stylized or drawn depictions, including loli and shota, are not treated as literal CSAM under these terms. They are still NSFW and must be flagged as such. Realism is the dividing line: a photorealistic or convincingly realistic AI-generated sexual depiction of a minor is illegal content, and it escalates immediately instead of waiting in the ordinary review queue. There is no written test for it: JEV judges the asset, and a moderator makes the call when the case escalates.

### What the rules apply to

They are enforced against visual assets — avatars, images, and GIFs — and against text. Text on posts and comments is judged for all three rules; text on a character, lorebook, or preset is judged for the NSFW flag and for copying, and for nothing else. A character, lorebook, or preset avatar can still break any of the three. Copy claims about an image are always checked by a person, because a model cannot compare pictures precisely enough.

The flag is what makes the viewer's own [NSFW preference](../systems/nsfw.md) possible: with Show off flagged content stays out of listings, and with Blur on it is listed but covered. An accurate flag is therefore part of the rule, not a courtesy.

### What the flag covers

One flag per item, covering everything the item shows. A character, lorebook, or preset whose avatar is NSFW carries the flag even when its text is safe, and every image inside a post falls under that post's own flag. There is no per-image and no per-avatar flag, so one unflagged image makes the item an unflagged NSFW item rather than a partially flagged one.

### Accepting the terms

Finishing [`/onboarding`](onboarding.md) is the acceptance: that page states, beside **Finish**, that continuing accepts these terms, and links here. No separate acceptance record is kept and there is no version to accept, so a change to the rules is never re-asked — the text as it stands is what applies to everything published from then on.

### How enforcement works

Only you can delete the content you authored. When a rule is broken, the practical consequence is visibility: JEV can make characters, lorebooks, and presets private, and a moderator can remove an avatar when concluding a case in which the avatar itself is the serious violation. Posts and comments cannot be made private: they are removed as soon as JEV is certain a rule is broken, while a case it is unsure about stays public until a moderator decides. When content is made private you can still open it and see the report, the reasons, and the measures taken. Once every reason is fixed, you may request publication again, and JEV reviews the content before it goes public. The request is made on the content's own page, where the reasons are listed; this page states only that fixing every reason opens it, and leaves the steps there. These rules govern public content; what happens inside a private session is the user's own business.

## Layout

- One column of prose: the title, the three prohibitions as a numbered list, then the notes on where the line sits, what the flag covers, accepting the terms, what the rules apply to, and how enforcement works.
- Read-only, no controls beyond links, and no version number or last-updated date: the rules are not versioned.
- Reached from [onboarding](onboarding.md), where **Finish** carries the acceptance.

## States

- **Static** — no interactive content beyond navigation.

# JEV — the model call

`src/specs/systems/jev.md` says *what* JEV decides. This file says *how* the model is called.
Code owns every threshold and every action; Jev only returns judgments.

## Route and model

| Field | Value |
| --- | --- |
| Endpoint | `POST https://openrouter.ai/api/alpha/decisions` |
| Auth | `Authorization: Bearer $OPENROUTER_API_KEY` |
| Model | `typesafe/jev-1.14` (resolves to `typesafe/jev-1.14-20261014`) |
| Note | **Not** a chat model. `chat/completions` returns 400 for it; the decisions path is the only one. |

Verified 2026-10-30 with the project key: mixed noul + score + choice request answered in ~0.9s
for $0.000023. The response echoes the resolved model and `usage.cost`.

Why TypeSafe/Jev and not a chat model: LuaPlot needs calibrated yes/no probabilities and ordered
severity, not prose. Each answer is a number the code can branch on, and the same state can be
asked several independent questions in one round trip.

## Request shape

```json
{
  "model": "typesafe/jev-1.14",
  "state": { "...named fields, see below..." },
  "questions": { "<id>": { "type": "noul|choice|score", "instructions": "...", "criteria": ... } }
}
```

`state` is an object with named fields so questions can reference backticked paths like
`` `state.assets[0].description` ``. Never paste raw blobs; name every part.

## State per content kind

```ts
// shared
{ kind, nsfw_flag, text, assets: [{ role: "avatar"|"image"|"gif", description }] }
// post/comment only
{ kind, nsfw_flag, text, assets, item: { author_handle } }
// copy claim, second request only
{ claim: { source_kind, claimed_source }, original: { text, assets }, candidate: { text, assets } }
```

`assets[].description` is produced by the vision pass first (alt text, or the model's own short
description); Jev judges text, so every image reaches it as a described field.

## Question set

Asked together, in one request, whenever the content kind allows it.

| id | type | instructions | criteria |
| --- | --- | --- | --- |
| `unflagged_nsfw` | noul | "Does any visual asset or the text contain adult, sexual or gory content that is published while `state.nsfw_flag` is false?" | — |
| `sexualizes_minor` | noul | "Is this a realistic sexual depiction of a minor?" | — |
| `severity` | score | "How severe is the violation against the terms, if any?" | `["No violation", "Needs the NSFW flag or a fix", "Would harm users if left public"]` |
| `illegal_harm` | noul | *posts and comments only*: "Does this text incite or instruct serious real-world harm?" | — |
| `copy_claim_type` | choice | "If the creator claims copied material, what kind of source is claimed?" | `none / internal / external / image` |

Not asked: personas (outside JEV), character/lorebook/preset text for `illegal_harm` (the spec
forbids it), and anything about engagement or quality.

**`copy_claim_type` is not sent (T-27).** The report itself already says which claim it makes: the
reason code is `copied-image` or `copied-text`, and a copy claim must name a source, so
`reportSourceIsExternal()` decides *internal* versus *external*. A question whose answer is a field
of the input is not a judgment — `claimOf()` in `lib/llm/jevPolicy.ts` reads it, and the queue's
*why is this here* line reads the same two facts.

A second request is only made when code needs new evidence — the copy claim, after the internal
source is fetched.

## Policy (in code, never in the prompt)

```
if sexualizes_minor >= 0.50        -> escalate, priority ahead of the queue
else if unflagged_nsfw >= 0.85     -> clear violation: remove post/comment,
                                      make character/lorebook/preset private,
                                      notify creator, open no case
else if unflagged_nsfw >= 0.55     -> stays public, escalate to /moderation
else                               -> dismiss, mark verified, clear on next edit
copy_claim_type == "image"|"external" -> escalate to a moderator, no automatic verdict
copy_claim_type == "internal"      -> fetch the source item, ask `same_text`, then:
                                      >= 0.80 copied -> violation, else dismiss
severity                           -> queue weight only (never a verdict on its own)
```

- Thresholds live in `src/lib/llm/jevPolicy.ts` as named constants with the spec clause they come
  from, so a change is reviewable.
- `noul` has no `confidence`; only `noul` (0–1). Do not read a missing field.
- A cached `verified` flag skips the call entirely; an edit clears it (spec: one scan per version).
- Posts/comments are never made private, authored items are never deleted — the action table in
  `systems/jev.md` is the only allowed mapping.
- Results are cached per `content_id + content_version`; a pile-on of reports joins the open case
  and adds weight without a second call.
- Model failure (5xx/timeout): treat as *unsure* → stays public, escalate, log. Never invent a
  violation, never fail open into a removal.

## Where it lives (T-27)

| Piece | What it owns |
| --- | --- |
| `lib/llm/jev.ts` | The one round trip: `jevRequestSchema` before the fetch, `jevPayloadSchema` after it, `provider === "TypeSafe"` mandatory, `null` on any failure. Also the second request (`same_text`) when an internal copy claim's source was fetched. |
| `lib/llm/jevPolicy.ts` | The thresholds (`JEV_CLEAR_VIOLATION`, `JEV_UNSURE`, `JEV_MINOR_ESCALATION`, `JEV_SAME_TEXT`), the claim reading, the action table, and `decide()` — no fetch, no clock, no repo. |
| `lib/llm/mock.ts` → `mockJevAnswers` | The preview's answers, deterministic from an FNV hash of kind + text: one clear, one clean, three escalated buckets, so a report reaches every state the queue can draw. |
| `memory.ts` → `addReport` | One scan per item change: the report that opens a case scans; a report that joins an open case adds weight and does not scan; an immediate action opens no case and notifies the creator. |

The client holds `VITE_JEV_ENDPOINT` (a public address) and nothing else. The `jev` Edge Function
(T-32) is what reads `OPENROUTER_API_KEY`.

## Limits of this build

- **No vision pass, so no asset description.** `assets[].description` is the vision model's output
  and it is server-side; until it exists the adapter sends an empty `assets: []` and
  `jevPolicy.ts` escalates a report whose only surface is an image (`imageOnly`). Asking a text
  model to judge a picture it cannot see would produce a confident number with no evidence behind
  it — the one thing a moderation verdict must never be.
- **A certain violation on a post removes it.** `postSchema` carries `status: "visible" | "removed"`
  (T-28B), so `clearAction("post")` answers `removed` and the adapter flips the row, drops its thread
  in cascade and keeps everything else. The verdict is stored as `violation`, the creator gets the
  notification, and an immediate action still opens no case.
- **Comments have no `verified` flag** and never will (a comment is never edited), so a report on a
  comment always scans.

## Mock mode

Preview builds have no key. `src/lib/llm/mock.ts` returns a deterministic verdict from a small
table keyed by content hash, with the same response shape, so every UI state is reachable. The
`Preview mode` chip is mandatory on any surface that shows a JEV outcome.

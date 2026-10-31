/**
 * JEV's transport — **decisions, not chat.** No key lives here.
 *
 * `docs/JEV.md` → *Route and model*: System One is reachable only on
 * `POST https://openrouter.ai/api/alpha/decisions` (no `/v1`), and `typesafe/jev-1.14` 400s on
 * `chat/completions`. Two traps are guarded in this file rather than trusted to a config:
 *
 * - **`provider: "TypeSafe"` is required.** A router-style slug answers on the chat route by
 *   falling back to a general model — confident prose, no calibrated verdict. `jevPayloadSchema`
 *   makes that literal, so the wrong transport fails the parse instead of being read.
 * - **A missing or unreadable answer is a failure, not a clean bill.** Every reader below answers
 *   `null` rather than defaulting to zero, and `decide()` turns `null` into *unsure*.
 *
 * The client only ever holds an address: `VITE_JEV_ENDPOINT` is the deployed `jev` function
 * (`docs/ARCHITECTURE.md`), which reads `OPENROUTER_API_KEY` server-side. With no endpoint the mock
 * answers deterministically and `previewMode()` — the one fact a `Preview mode` chip reads — is true.
 */
import {
  jevPayloadSchema,
  jevRequestSchema,
  type JevContentState,
  type JevPayload,
  type JevRequest,
} from "../schema.ts";
import { MOCK_LATENCY_MS, mockJevAnswers, mockSameText } from "./mock.ts";
import { claimOf, decide, type JevClaim, type JevDecision, type JevJudgment } from "./jevPolicy.ts";
import type { VotableKind } from "../data/types.ts";

/** The pinned decisions model (`docs/JEV.md`). A version bump is a reviewable one-line change. */
export const JEV_MODEL = "typesafe/jev-1.14";

/** A public address from `.env.local`'s client-safe half; empty until the function is deployed. */
const ENDPOINT = (import.meta.env.VITE_JEV_ENDPOINT ?? "").trim();

/** True while the mock is answering — the `Preview mode` chip on any surface printing a verdict. */
export function previewMode(): boolean {
  return ENDPOINT === "";
}

/**
 * The question set for one content kind (`docs/JEV.md` → *Question set*).
 *
 * `illegal_harm` is asked of posts and comments only: `systems/jev.md` → *Scope* says authored text
 * is judged for its flag and copying, and a question whose answer the policy may not use is a
 * question that should not be sent.
 */
function questionsFor(kind: VotableKind): JevRequest["questions"] {
  return {
    unflagged_nsfw: {
      type: "noul",
      instructions:
        "Does any visual asset or the text contain adult, sexual or gory content that is being published while `state.nsfw_flag` is false?",
    },
    sexualizes_minor: {
      type: "noul",
      instructions: "Is this a realistic sexual depiction of a minor?",
    },
    severity: {
      type: "score",
      instructions: "How severe is the violation against the terms, if any?",
      criteria: [
        "No violation",
        "Needs the NSFW flag or a fix",
        "Would harm users if left public",
      ],
    },
    ...(kind === "post" || kind === "comment"
      ? {
          illegal_harm: {
            type: "noul" as const,
            instructions:
              "Does this text incite or instruct serious real-world harm to people?",
          },
        }
      : {}),
  };
}

/** One `noul` answer, or `undefined` when the payload did not carry it. */
function noul(payload: JevPayload, key: string): number | undefined {
  const answer = payload.answers[key];
  return answer?.type === "noul" ? answer.noul : undefined;
}

/** The `score` answer's position on the line, or `undefined`. */
function score(payload: JevPayload, key: string): number | undefined {
  const answer = payload.answers[key];
  return answer?.type === "score" ? answer.score : undefined;
}

/**
 * The answers flattened into the judgment the policy reads. `null` when a required answer is
 * absent — a payload with no `unflagged_nsfw` is not a verdict, whatever else it contains.
 */
function judgmentOf(payload: JevPayload): JevJudgment | null {
  const unflagged = noul(payload, "unflagged_nsfw");
  const minor = noul(payload, "sexualizes_minor");
  if (unflagged === undefined || minor === undefined) return null;

  const judgment: JevJudgment = {
    unflagged_nsfw: unflagged,
    sexualizes_minor: minor,
    severity: score(payload, "severity") ?? 0,
  };
  const harm = noul(payload, "illegal_harm");
  if (harm !== undefined) judgment.illegal_harm = harm;
  return judgment;
}

/**
 * One round trip. **Any** failure answers `null`: no endpoint, a non-2xx, a dead network, a body
 * that is not a decisions payload, or a payload without the answers this kind needs. The caller
 * reads `null` as *unsure* and never as a pass.
 */
async function ask(request: JevRequest): Promise<JevPayload | null> {
  // The request is an edge too: a malformed question set would be a 400 paid for in latency.
  const checked = jevRequestSchema.safeParse(request);
  if (!checked.success) return null;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(checked.data),
    });
    if (!response.ok) return null;

    const parsed = jevPayloadSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The mock's answer in the provider's own shape, so one reader serves both transports. */
function mockPayload(kind: VotableKind, state: JevContentState): JevPayload {
  return jevPayloadSchema.parse({
    model: JEV_MODEL,
    provider: "TypeSafe",
    answers: mockJevAnswers(kind, state),
  });
}

/**
 * One classification, policy applied. The adapter calls this and applies what comes back; nothing
 * here reads the repo, the clock or the page.
 */
export async function classify(input: {
  kind: VotableKind;
  content: JevContentState;
  /** What the report claims, read by `claimOf` from its reason codes — code's fact, not a question. */
  claim: JevClaim;
  source?: string;
  /** The claimed original's text, when an internal copy claim could be fetched and compared. */
  originalText?: string;
  /** True when the report names a visual surface only — no description reached the model. */
  imageOnly: boolean;
}): Promise<JevDecision> {
  const request: JevRequest = {
    model: JEV_MODEL,
    state: input.content,
    questions: questionsFor(input.kind),
  };

  let payload: JevPayload | null;
  if (previewMode()) {
    await pause();
    payload = mockPayload(input.kind, input.content);
  } else {
    payload = await ask(request);
  }
  const judgment = payload === null ? null : judgmentOf(payload);

  // The second request is only for evidence code could not supply: an internal copy claim whose
  // original the adapter fetched. `docs/JEV.md` → *Question set*.
  if (judgment !== null && input.originalText !== undefined && input.source !== undefined) {
    const sameText = previewMode()
      ? mockSameText(input.originalText, input.content.text)
      : await askCopy(input.originalText, input.content.text, input.source);
    if (sameText !== null) judgment.same_text = sameText;
  }

  return decide({ kind: input.kind, claim: input.claim, imageOnly: input.imageOnly, judgment });
}

/**
 * The copy comparison (`docs/JEV.md` → *Policy*): both items are fetched by the adapter, so the
 * model is only asked whether the two texts are the same. `null` on any failure — and `decide()`
 * then escalates instead of inventing a verdict.
 */
async function askCopy(
  original: string,
  candidate: string,
  claimedSource: string,
): Promise<number | null> {
  const request: JevRequest = {
    model: JEV_MODEL,
    state: {
      claim: { source_kind: "luaplot-item", claimed_source: claimedSource },
      original: { text: original, assets: [] },
      candidate: { text: candidate, assets: [] },
    },
    questions: {
      same_text: {
        type: "noul",
        instructions:
          "Is `state.candidate.text` a copy of `state.original.text` rather than an independent work?",
      },
    },
  };
  const payload = await ask(request);
  return payload === null ? null : (noul(payload, "same_text") ?? null);
}

/** The preview's frame: `Classifying` is a state the UI draws, so the mock must take a tick. */
async function pause(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

/** The claim a report carries — re-exported so the adapter reads policy facts from one module. */
export { claimOf };

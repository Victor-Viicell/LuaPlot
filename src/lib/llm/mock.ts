/**
 * The preview reply — **deterministic by construction**.
 *
 * The static build has no model: `docs/CONTRACT.md` keeps `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY`
 * out of the client bundle, so on Pages the seam answers from this file instead of inventing that a
 * model spoke. Two rules make that honest and testable:
 *
 * - **The text is a function of the transcript, never of the clock or the dice** — the turn count and
 *   the in-session name pick the line (`index = (count + speaker.length) % LINES.length`), so the same
 *   conversation always produces the same sentence and a fixture-based check can assert one. No
 *   `Math.random`, no `Date.now` anywhere in the string.
 * - **Every line says it is a preview.** A reply that reads like a model and is not one is the one
 *   thing this file must never produce; the `Preview mode` chip in the page says it once for the
 *   surface, and the sentence says it again where the text actually lands.
 *
 * The latency is fixed and small: it exists so the page's *Awaiting model response* state paints for
 * a real frame instead of flashing past on the same microtask that stored the user's turn.
 */
export const MOCK_LATENCY_MS = 180;

/** Oldest first, matched by index — three beats so a transcript does not read like a stuck record. */
const LINES: ((speaker: string, turn: number) => string)[] = [
  (speaker, turn) =>
    `${speaker} holds the line for a moment. This is a preview reply, not a model: turn ${turn} is stored, and nothing has answered it yet.`,
  (speaker, turn) =>
    `“Go on,” ${speaker} says — and the scene waits. No model is connected in the preview, so this reply is drawn from the transcript itself (turn ${turn}).`,
  (speaker, turn) =>
    `${speaker} answers in the preview's own voice: the conversation is being kept, the model is not connected. Preview reply for turn ${turn}.`,
];

/**
 * One preview sentence. `count` is the transcript's length **including** the turn just sent, which is
 * what makes this a pure function of what the user can see.
 */
export function mockReply(speaker: string, count: number): string {
  const name = speaker.trim() === "" ? "The character" : speaker.trim();
  const turn = Math.max(1, Math.round(count));
  const line = LINES[(turn + name.length) % LINES.length] ?? LINES[0];
  return line(name, turn);
}

/* --- JEV, the preview verdict (T-27) ------------------------------------------------------------ */

/**
 * The mock classifier's answers, in the provider's shape and **deterministic by construction**.
 *
 * The preview has no key (`docs/CONTRACT.md`), so `jev.ts` asks this instead of OpenRouter and the
 * `Preview mode` chip says so on every surface that prints a verdict. Two rules keep it honest:
 *
 * - **The answers are a function of the content**, never of the clock or the dice — the same text
 *   always produces the same classification, so a fixture-based check can assert one. The bucket is
 *   a five-way split of an FNV-1a hash: one clear violation, one clean pass, three escalations, so
 *   reporting a few different items in the preview reaches every state the queue can draw.
 * - **The shape is the real one** (`noul` carries `noul` and no `confidence`; `score` carries both),
 *   so a reader written against the mock is the reader that runs against the model.
 *
 * `sexualizes_minor` stays near zero: it is a threshold that escalates ahead of the queue, and a
 * preview must never fake that alarm. It is answered, so the field's absence cannot be mistaken for
 * a clean one.
 */
export function mockJevAnswers(kind: string, state: { text: string; nsfw_flag: boolean }): Record<string, unknown> {
  const bucket = hash(`jev:${kind}:${state.text}`) % 5;
  const unflagged =
    state.nsfw_flag === true
      ? 0.01 // the flag is the whole point: flagged content cannot be an *unflagged* violation
      : bucket === 0
        ? 0.9 // clear: the policy acts
        : bucket === 1
          ? 0.06 // clean: the policy verifies and stays public
          : bucket === 2
            ? 0.66
            : bucket === 3
              ? 0.44
              : 0.74; // the escalated band, 0.55–0.85

  const answers: Record<string, unknown> = {
    unflagged_nsfw: { type: "noul", noul: unflagged },
    sexualizes_minor: { type: "noul", noul: 0.01 },
    severity: {
      type: "score",
      score: Math.round(unflagged * 2),
      confidence: 0.8,
    },
  };

  if (kind === "post" || kind === "comment") {
    answers.illegal_harm = { type: "noul", noul: 0.02 };
  }
  return answers;
}

/**
 * The copy comparison for an internal claim (`docs/JEV.md` → *Policy*). Deterministic and simple on
 * purpose: shared wording wins, otherwise an FNV bucket keeps the answer stable per pair of texts.
 * The real model does the same job on the same state, so the preview shows the branch, not a guess.
 */
export function mockSameText(original: string, candidate: string): number {
  const a = words(original);
  const b = words(candidate);
  if (a === "" || b === "") return 0.01;
  if (a.includes(b) || b.includes(a)) return 0.94;

  const originalWords = new Set(a.split(" "));
  const overlap = b.split(" ").filter((word) => originalWords.has(word)).length;
  const shared = overlap / Math.max(1, b.split(" ").length);
  return Math.min(0.96, Math.max(0.01, shared));
}

/** Lowercase, punctuation stripped, whitespace collapsed — the same shape a model would read. */
function words(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word !== "")
    .join(" ");
}

/** FNV-1a over a string: small, dependency-free, and stable across runs and engines. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

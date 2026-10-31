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

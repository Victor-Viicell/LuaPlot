/**
 * The model seam — **T-16 owns this file's body.**
 *
 * `session/detail.md` → *Actions* → **Send message** appends the user's turn; the reply is a model
 * call, and no page may make one (`docs/CONTRACT.md`: the static build uses the mock provider, and a
 * preview must never pretend a model answered). So the page calls this one function and renders
 * whatever it answers:
 *
 * - `null` today. Nothing is appended, nothing is invented, and the page says the model is not
 *   connected — the spec's *Awaiting model response* state is T-16's, not a placeholder to fake.
 * - T-16 replaces the body with `chat.ts` (server-side provider) + `mock.ts` (deterministic preview
 *   reply) and a **Preview mode** chip, keeping this signature so the page does not change.
 *
 * A turn's text reaches the model through here, never from the page, and the reply is parsed before
 * any code reads a field (`docs/ARCHITECTURE.md` → *Validation*): until the schema for a model
 * payload exists, the only shape that crosses this boundary is one non-empty string.
 */
import type { Turn } from "../data/types.ts";

export type ChatRequest = {
  /** The session the turn belongs to — the server resolves the copies from here, not from the page. */
  sessionId: string;
  /** The transcript **including** the turn just sent, oldest first. */
  turns: Turn[];
  /** The message the user just typed, already trimmed by `turnWriteSchema`. */
  message: string;
};

export type ChatReply = { text: string };

/**
 * One model turn, or `null` when no provider is connected.
 *
 * Deliberately `async` and deliberately silent: a thrown error would be a page-level "Send failed",
 * and a fabricated string would be a conversation the user did not have.
 */
export async function replyTo(_request: ChatRequest): Promise<ChatReply | null> {
  return null;
}

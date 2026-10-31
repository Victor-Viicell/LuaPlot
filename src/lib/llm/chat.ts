/**
 * The model seam — one function, two transports.
 *
 * `session/detail.md` → *Actions* → **Send message** appends the user's turn; the reply is a model
 * call, and no page may make one. So the page calls this function and renders whatever it answers,
 * which is why T-15's page did not have to change for T-16 to land:
 *
 * - **A configured provider wins.** `provider.ts` posts to the server-side function (the keys live
 *   there, never in this bundle) and its answer is `chatReplySchema`-parsed before it crosses back.
 * - **Otherwise the mock answers.** `mock.ts` is deterministic from the transcript's length and the
 *   in-session name, so the preview has a real conversation to look at while saying, in the text, that
 *   it is not one. `previewMode()` is the single fact the page's `Preview mode` chip is drawn from —
 *   the chip and the sentence cannot disagree because both read this file.
 * - **`null` means failure**, and only failure: a provider that is configured but silent or malformed.
 *   The page turns that into the spec's *Send failed* under the composer; the turn is already stored,
 *   because the transcript is append-only and a rollback would lose something the user said.
 *
 * The reply is *not* written here. `repo.appendReply` owns the turn — the role, id and clock are the
 * adapter's — so there is still exactly one write path into a transcript.
 */
import { resolveRepo } from "../data/repo.ts";
import { chatReplySchema } from "../schema.ts";
import type { ChatReply, Turn } from "../data/types.ts";
import { MOCK_LATENCY_MS, mockReply } from "./mock.ts";
import { askProvider, providerConfigured } from "./provider.ts";

export type { ChatReply };

export type ChatRequest = {
  /** The session the turn belongs to — the server resolves the copies from here, not from the page. */
  sessionId: string;
  /** The transcript **including** the turn just sent, oldest first. */
  turns: Turn[];
  /** The message the user just typed, already trimmed by `turnWriteSchema`. */
  message: string;
};

/** True while the mock is the one answering — the `Preview mode` chip's only input. */
export function previewMode(): boolean {
  return !providerConfigured();
}

/**
 * One model turn, or `null` when a configured provider could not answer.
 *
 * Deliberately `async` and deliberately silent: a thrown error would be a page-level crash, and a
 * fabricated string would be a conversation the user did not have.
 */
export async function replyTo(request: ChatRequest): Promise<ChatReply | null> {
  if (!previewMode()) {
    return askProvider(request);
  }

  // The speaker is a copy field, so it is read through the adapter rather than trusted from the page;
  // a session that vanished mid-send leaves a generic name instead of failing the reply.
  const session = await resolveRepo()
    .getSession(request.sessionId)
    .catch(() => null);
  const speaker = session?.character.inSessionName || session?.character.name || "The character";

  // Not a delay for its own sake: this is the frame the *Awaiting model response* state needs.
  await new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  const parsed = chatReplySchema.safeParse({ text: mockReply(speaker, request.turns.length) });
  return parsed.success ? parsed.data : null;
}

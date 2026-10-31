/**
 * The transport for a real model — **no key lives here.**
 *
 * `docs/CONTRACT.md`: `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` are read only by server-side code
 * (`supabase/functions/chat/`), so the client may hold a URL and nothing else. `VITE_CHAT_ENDPOINT`
 * is that URL (a public address, not a secret); the function behind it resolves the session's copies,
 * calls DeepSeek, and answers `{ text }`. Until the endpoint is configured every build takes the mock
 * path in `chat.ts`, which is why the preview never pretends a model answered.
 *
 * The response is parsed before anything reads a field (`docs/ARCHITECTURE.md` → *Validation*):
 * `chatReplySchema.safeParse`, because a provider payload is an edge like any other. A non-2xx, a
 * network failure or a shape that does not parse all answer `null` — the page turns that into the
 * spec's *Send failed*, never into a fabricated sentence.
 */
import { chatReplySchema } from "../schema.ts";
import type { ChatReply, Turn } from "../data/types.ts";

/** A public address from `.env.local`'s client-safe half; empty until a function is deployed. */
const ENDPOINT = (import.meta.env.VITE_CHAT_ENDPOINT ?? "").trim();

/** Whether a real provider is reachable — the one fact the page's `Preview mode` chip is derived from. */
export function providerConfigured(): boolean {
  return ENDPOINT !== "";
}

/** One model turn from the server, or `null` when nothing usable came back. */
export async function askProvider(request: {
  sessionId: string;
  turns: Turn[];
  message: string;
}): Promise<ChatReply | null> {
  if (!providerConfigured()) return null;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: request.sessionId,
        turns: request.turns,
        message: request.message,
      }),
    });

    if (!response.ok) return null;

    const parsed = chatReplySchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    // A dead endpoint is *Send failed*, not a crash and not a made-up reply.
    return null;
  }
}

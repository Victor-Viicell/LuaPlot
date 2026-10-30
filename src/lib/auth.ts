/**
 * The auth seam — the one door every sign-in goes through (T-06).
 *
 * `authentification.md` fixes the product surface: three providers, no password, no reset, no
 * provider management, one account per provider, identities never linked. So the list below is a
 * constant, not data, and there is nothing here to configure.
 *
 * Today the body is a **preview stub**: no network, no Supabase, no session write. T-30 swaps the
 * body for `supabase.auth.signInWithOAuth({ provider })` and keeps this signature and these
 * outcome shapes, so `/authentification` does not have to change when real auth lands.
 *
 * Deliberately absent:
 *
 * - **An `ok` outcome.** A successful sign-in is a redirect the browser follows, not a value this
 *   module can hand back. Inventing `{ status: "ok" }` now would force the page to render a
 *   signed-in state that nothing has actually established.
 * - **Any call to `session.ts`.** A stub that signs the mock user in turns the page into a fake
 *   callback: the three states the spec asks it to show would become unreachable in the preview.
 * - **Fake persistence.** Nothing is stored, so a reload starts over — that is the adapter's shape
 *   until a Supabase project ref exists.
 */

/** The three providers, exactly as `authentification.md` lists them. */
export type Provider = "google" | "github" | "discord";

/** Fixed order matters: the buttons render in this order and nowhere else. */
export const PROVIDERS: readonly Provider[] = ["google", "github", "discord"];

/**
 * Display names. There is one 20px stroke icon set and no brand assets, so a provider is named in
 * text: `Continue with Google`. Never a logo, never an emoji.
 */
export const PROVIDER_NAMES: Record<Provider, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

/**
 * What one sign-in attempt can end with. `redirecting` means the hand-off to the provider was
 * accepted and the browser is leaving; `cancelled` means the visitor came back without an identity;
 * `failed` means the callback could not be trusted. No `ok` — see the header.
 */
export type AuthOutcome =
  | { status: "redirecting" }
  | { status: "cancelled" }
  | { status: "failed"; reason: string };

/** How long the stub takes to "come back" from the provider. Long enough to read the redirecting line. */
const PREVIEW_DELAY_MS = 600;

/**
 * Preview-only outcome switch, so every state is reachable from `/` in two taps:
 * `?auth=cancelled` (the default), `?auth=failed`, and `?auth=redirecting` to hold the hand-off
 * rather than pretend it returned. Deleted with the stub — a real body takes its answer from
 * Supabase's callback, never from the page's query string.
 */
function previewOutcome(provider: Provider): AuthOutcome | "hold" | null {
  if (typeof window === "undefined") return null;
  const flag = new URLSearchParams(window.location.search).get("auth");
  if (flag === "redirecting") return "hold";
  if (flag === "failed") {
    return {
      status: "failed",
      reason: `No callback arrived from ${PROVIDER_NAMES[provider]}.`,
    };
  }
  return null;
}

/**
 * One sign-in attempt with one provider. Never throws: a transport problem is `failed` with a
 * reason, because the page's job is to say what happened, not to catch.
 */
export function signInWithProvider(provider: Provider): Promise<AuthOutcome> {
  return new Promise<AuthOutcome>((resolve) => {
    const preview = previewOutcome(provider);

    // Held: the state a real redirect sits in while the browser navigates away.
    if (preview === "hold") return;

    window.setTimeout(() => {
      resolve(preview ?? { status: "cancelled" });
    }, PREVIEW_DELAY_MS);
  });
}

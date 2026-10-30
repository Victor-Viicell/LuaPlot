import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { href } from "../router.ts";
import { PROVIDERS, PROVIDER_NAMES, signInWithProvider, type Provider } from "../lib/auth.ts";

/**
 * `/authentification` — the single auth screen (`src/specs/pages/authentification.md`).
 *
 * The spec is short and strict: three providers, no password, no reset, no provider management,
 * no email or name field. Signing in and creating an account are the same three buttons, so the
 * page never asks which one the visitor wants — it asks which provider they used.
 *
 * Layout is the **same title page as `/`** (kicker → wordmark → one paragraph → hairline →
 * controls) so the two entry screens read as one sequence: the paragraph changes, the frame does
 * not. The decision is recorded in `docs/DESIGN.md` under "Auth (decided in T-06)"; the spec's
 * Layout section is `_To be specified_`.
 *
 * One status value drives everything: `status`, a discriminated union, with the copy derived from
 * it. No scattered booleans — with four reachable states and three buttons, that is the difference
 * between a page that can only be in one state at a time and one that can be in several.
 *
 * Deliberate gaps, both recorded in `docs/DESIGN.md`:
 * - **No redirect for signed-in visitors.** The spec says "signed-in visitors redirected away", but
 *   the redirect matrix is T-30 and `session.ts` ships seeded signed in — an eager redirect would
 *   make this page unreachable in the preview.
 * - **The onboarding gate is not built.** `Onboarding incomplete → /onboarding` is a link, not a
 *   state: only the matrix knows who is incomplete.
 */

type AuthStatus =
  | { kind: "idle" }
  | { kind: "redirecting"; provider: Provider }
  | { kind: "cancelled"; provider: Provider }
  | { kind: "failed"; provider: Provider; reason: string };

export function Authentification() @{
  const status = track<AuthStatus>({ kind: "idle" });

  /** One attempt at a time: while the provider is being contacted, all three buttons are disabled. */
  const busy = track(() => status.value.kind === "redirecting");

  /** The line under the buttons. Empty while idle, and the box reserves its height either way. */
  const message = track(() => {
    const current = status.value;
    if (current.kind === "redirecting") return `Redirecting to ${PROVIDER_NAMES[current.provider]}…`;
    if (current.kind === "cancelled") return `${PROVIDER_NAMES[current.provider]} sign-in was cancelled.`;
    if (current.kind === "failed") return current.reason;
    return "";
  });

  /** Cancelled is a quiet fact, failed is an error, redirecting is a status: three tones, one line. */
  const tone = track(() => {
    const current = status.value;
    if (current.kind === "redirecting") return "line-busy";
    if (current.kind === "cancelled") return "line-muted";
    if (current.kind === "failed") return "line-danger";
    return "line-idle";
  });

  /** `Try again` retries the provider that failed, not a fresh choice. */
  const retryProvider = track<Provider | null>(() =>
    status.value.kind === "failed" ? status.value.provider : null,
  );

  const retryLabel = track(() => {
    const failed = retryProvider.value;
    return failed ? `Try again with ${PROVIDER_NAMES[failed]}` : "Try again";
  });

  function choose(provider: Provider) {
    if (status.value.kind === "redirecting") return;
    status.value = { kind: "redirecting", provider };

    // `.then(onOk, onFail)`, not `try`/`catch`: a `.tsrx` statement container cannot wrap an
    // `@{` block in a try. The seam never rejects today; it will when Supabase can time out.
    signInWithProvider(provider).then(
      (outcome) => {
        if (outcome.status === "cancelled") {
          status.value = { kind: "cancelled", provider };
        } else if (outcome.status === "failed") {
          status.value = { kind: "failed", provider, reason: outcome.reason };
        }
        // `redirecting`: the browser is leaving the page. Hold the state; do not fake a return.
      },
      () => {
        status.value = {
          kind: "failed",
          provider,
          reason: `${PROVIDER_NAMES[provider]} could not be reached.`,
        };
      },
    );
  }

  function retry() {
    const failed = retryProvider.value;
    if (failed) choose(failed);
  }

  <>
    <style>
      /*
       * The arithmetic is home's: 100dvh less 56 top bar + 60 tab bar + 60 of tab-bar clearance on
       * the scroller + 52 of outlet padding. Same sum at every breakpoint, so the two entry screens
       * centre on the same line and a 360×740 screen does not scroll.
       */
      .screen {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 36px;
        min-height: calc(100dvh - 228px);
      }

      .mast {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 8px;
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .wordmark {
        margin: 0;
        color: var(--color-text);
        font-size: 34px;
        font-weight: 600;
        letter-spacing: -0.035em;
        line-height: 1.05;
      }

      .lede {
        max-width: 44ch;
        margin: 4px 0 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
        text-wrap: pretty;
      }

      /* The hairline is the same gesture as home's entry rule: the paragraph ends, the controls begin. */
      .gate {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }

      .providers {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /*
       * The status line reserves its own height while idle. Without that, every state change moves
       * the centred block a line up or down, and the page looks like it reloaded. The row is as tall
       * as the retry button when there is one, so a two-line error wraps inside it instead of
       * pushing the page into a scroll.
       */
      .status {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .line {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 20px;
        margin: 0;
        font-size: 13px;
        line-height: 1.55;
      }

      .line-idle {
        color: transparent;
      }

      .line-busy {
        color: var(--color-text-muted);
        font-size: 12px;
      }

      .line-muted {
        color: var(--color-text-muted);
      }

      .line-danger {
        color: var(--color-danger);
      }

      .tail {
        display: flex;
        flex-direction: column;
        gap: 4px;
        border-top: 1px solid var(--color-border);
        padding-top: 12px;
      }

      .note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      /* The onboarding link is a quiet footer line, not a second accent button. */
      .next {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .next a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        color: var(--color-text-muted);
        text-decoration: underline;
        text-decoration-color: var(--color-border-strong);
        text-underline-offset: 0.2em;
      }

      .next a:hover {
        color: var(--color-text);
      }

      /* One orchestrated entrance: four items, 40ms apart. */
      .kicker {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .wordmark {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 40ms both;
      }

      .lede {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 80ms both;
      }

      .gate {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both;
      }

      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      @keyframes fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @media (min-width: 640px) {
        .screen {
          min-height: calc(100dvh - 240px);
        }

        /* A 420 measure for the controls, not three buttons stretched across 640: the paragraph above
           already holds 44ch, so the two left edges agree and the rule still spans the column. */
        .providers,
        .status {
          max-width: 420px;
        }
      }

      @media (min-width: 900px) {
        .screen {
          min-height: calc(100dvh - 132px);
        }
      }

      @media (min-width: 1200px) {
        .screen {
          max-width: 560px;
          min-height: calc(100dvh - 144px);
          margin: 0 auto;
        }

        .mast {
          gap: 16px;
        }

        .wordmark {
          font-size: 44px;
        }

        .lede {
          font-size: 15px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .kicker,
        .wordmark,
        .lede,
        .gate {
          animation-name: fade;
          animation-duration: 120ms;
          animation-delay: 0ms;
        }
      }
    </style>

    <div class="screen">
      <header class="mast">
        <p class="kicker">a writing room for fiction</p>
        <h1 class="wordmark">LuaPlot</h1>
        <p class="lede">
          Signing in and signing up are the same three providers. Pick yours.
        </p>
      </header>

      <div class="gate">
        <div class="providers">
          @for (const provider of PROVIDERS; key provider) {
            <Button variant="secondary" block disabled={busy} onClick={() => choose(provider)}>
              {`Continue with ${PROVIDER_NAMES[provider]}`}
            </Button>
          }
        </div>

        <div class="status">
          <p class={`line ${tone.value}`} role="status" aria-live="polite">{message.value}</p>
          @if (retryProvider.value) {
            <Button variant="ghost" label={retryLabel.value} onClick={retry}>Try again</Button>
          }
        </div>

        <div class="tail">
          <p class="note">Preview — no provider is contacted.</p>
          <p class="next">New account? <a href={href("/onboarding")}>Continue to onboarding</a></p>
        </div>
      </div>
    </div>
  </>
}

export default Authentification;

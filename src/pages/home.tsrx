import { track } from "ripple";
import { href } from "../router.ts";
import { currentUser, onSession } from "../lib/state/session.ts";
import type { User } from "../lib/data/types.ts";

/**
 * `/` — landing page and entry point (`src/specs/pages/home.md`).
 *
 * One screen, no sections: the product name, one paragraph saying what Luaplot is, and the
 * entry control. The spec forbids a hero, feature blocks and narrative copy by name, so the
 * page is a title page — type, one hairline, one accent, a lot of air — rather than a landing
 * page in the marketing sense.
 *
 * It reads the session and nothing else: no listings, no counts, no content rows. A signed-in
 * visitor is **not** redirected (the redirect matrix is T-30); the control is the way in, and its
 * target follows the session — `/authentification` when signed out, the viewer's own profile when
 * signed in.
 */

export function Home() @{
  /**
   * The session is a subscribe/notify store, so the page mirrors it into its own tracked value —
   * the way `App.tsrx` and `/dev/state` do. `currentUser()` alone is a snapshot: the menu's dev
   * sign-out would leave a stale control behind.
   */
  const user = track<User | null>(currentUser());

  onSession((next) => {
    user.value = next;
  });

  /** The three readings, so `User | null` is narrowed in one place and the markup stays flat. */
  const reading = track(() => {
    const self = user.value;
    return self ? `signed in as ${self.displayName}` : "signed out";
  });

  const target = track(() => {
    const self = user.value;
    return self ? href(`/user/${self.handle}`) : href("/authentification");
  });

  const label = track(() => (user.value ? "Open profile" : "Sign in"));

  <>
    <style>
      /*
       * 100dvh less the shell chrome that is already taken: 56 top bar + 60 tab bar + 60 of tab-bar
       * clearance on the scroller + the outlet's 52px of padding. Zero scroll on a 360×740 first
       * screen depends on this number matching `App.tsrx`; the breakpoints below are the same sum
       * for their own chrome.
       */
      .screen {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 40px;
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

      .entry {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--color-border);
      }

      .reading {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
        margin: 0;
        line-height: 1.6;
      }

      .reading-key {
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .reading-sep {
        color: var(--color-border-strong);
        font-size: 13px;
      }

      .reading-value {
        color: var(--color-text-muted);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }

      .entry .btn {
        width: 100%;
        justify-content: center;
      }

      /* One orchestrated entrance: four items, 40ms apart, capped well under six. */
      .kicker {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .wordmark {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 40ms both;
      }

      .lede {
        animation: rise 180ms cubic-bezier(0.2, 0.8, 0.2, 1) 80ms both;
      }

      .entry {
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

        .entry {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .entry .btn {
          width: auto;
          justify-content: flex-start;
        }
      }

      @media (min-width: 900px) {
        .screen {
          min-height: calc(100dvh - 132px);
        }
      }

      @media (min-width: 1200px) {
        /* A deliberate measure, centred in the 1120 outlet — not a column stuck to the left edge. */
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

      /* Reduced motion keeps the reveal, loses the travel. */
      @media (prefers-reduced-motion: reduce) {
        .kicker,
        .wordmark,
        .lede,
        .entry {
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
          Write with characters that remember: author a lorebook, talk in a session, publish the
          best of it as a cut.
        </p>
      </header>

      <div class="entry">
        <p class="reading">
          <span class="reading-key">session</span>
          <span class="reading-sep" aria-hidden="true">·</span>
          <span class="reading-value">{reading.value}</span>
        </p>
        <a class="btn btn-primary" href={target.value}>{label.value}</a>
      </div>
    </div>
  </>
}

export default Home;

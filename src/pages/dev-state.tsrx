import { track } from "ripple";
import { Button } from "../components/Button.tsrx";
import { Toggle } from "../components/Toggle.tsrx";
import { href } from "../router.ts";
import { currentUser, onSession, sessionNotifications, signIn, signOut } from "../lib/state/session.ts";
import {
  nsfwPreference,
  onPrefs,
  prefsNotifications,
  setBlurNsfw,
  setShowNsfw,
} from "../lib/state/prefs.ts";
import type { AccountPreferences, User } from "../lib/data/types.ts";

/**
 * `/dev/state` — the two stores, as they are. Development only.
 *
 * Not a product route: absent from `src/specs/luaplot-pages.md`, absent from the tab bar, and
 * `scripts/spec-routes.mjs` drops `/dev/*` before comparing the router with the spec.
 *
 * It is the honest counterpart to the overflow menu's dev switch: here the whole state is on one
 * screen, including the counters that prove the stores are notifying at all (a silent store looks
 * identical to a wired one from the UI alone). The controls write the stores, never a page-local
 * copy — flip Show here and any listing that reads `nsfwPreference()` follows.
 */

/** What the listings would do with this pair, in one sentence. */
function effectOf(user: User | null, prefs: AccountPreferences): string {
  if (!user) return "Signed out: nothing NSFW is shown, and both flags read off.";
  if (!prefs.show) return "NSFW items are absent from every listing, whatever Blur says.";
  if (prefs.blur) return "NSFW items stay listed with the middle covered, one reveal per item.";
  return "NSFW items are listed uncovered.";
}

export function DevState() @{
  /**
   * The stores are subscribe/notify (`lib/state/*`), so this page mirrors them into its own
   * tracked values — the same shape `App.tsrx` uses for the router.
   */
  const user = track<User | null>(currentUser());
  const show = track(nsfwPreference().show);
  const blur = track(nsfwPreference().blur);
  const sessionPings = track(sessionNotifications());
  const prefsPings = track(prefsNotifications());

  onSession((next) => {
    user.value = next;
    sessionPings.value = sessionNotifications();
  });

  onPrefs((next) => {
    show.value = next.show;
    blur.value = next.blur;
    prefsPings.value = prefsNotifications();
  });

  function flipSession() {
    if (user.value) signOut();
    else signIn();
  }

  <>
    <style>
      .state {
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding-bottom: 40px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.2;
      }

      .lede {
        max-width: 64ch;
        margin: 0;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .badge {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        padding: 3px 8px;
        border: 1px solid var(--color-border);
        border-radius: 2px;
        color: var(--color-text-muted);
        font-size: 12px;
        line-height: 1.6;
      }

      .badge b {
        color: var(--color-text);
        font-weight: 600;
      }

      .counts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1px;
        border: 1px solid var(--color-border);
        background-color: var(--color-border);
      }

      .count {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 12px;
        background-color: var(--color-bg);
      }

      .count-value {
        color: var(--color-text);
        font-size: 20px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }

      .count-label {
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .count-note {
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.5;
      }

      .sec {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .sec-head {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-border);
      }

      .sec-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .sec-note {
        max-width: 72ch;
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .rows {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background-color: var(--color-border);
      }

      .stack {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .row {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 10px 12px;
        background-color: var(--color-bg);
      }

      .row-key {
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .row-value {
        margin-left: auto;
        color: var(--color-text);
        font-size: 14px;
        font-variant-numeric: tabular-nums;
      }

      .tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .note {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        line-height: 1.6;
      }

      .link {
        color: var(--color-text-muted);
        text-decoration: underline;
      }

      @media (min-width: 640px) {
        .counts {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }

      @media (min-width: 1200px) {
        .state {
          gap: 36px;
        }
      }
    </style>

    <div class="state">
      <header class="head">
        <p class="kicker">dev · stores</p>
        <h1 class="title">State</h1>
        <p class="lede">
          The session and the NSFW pair are plain subscribe/notify stores, mirrored into this page's
          tracked values. Everything below writes the store, not a copy: the shell's menu readout and
          every listing follow the same two objects.
        </p>
        <div class="badges">
          <span class="badge">session <b>{user.value ? "signed in" : "signed out"}</b></span>
          <span class="badge">handle <b>{user.value ? `@${user.value.handle}` : "—"}</b></span>
          <span class="badge">
            admin <b>{user.value?.isAdmin ? "yes" : "no"}</b>
          </span>
        </div>
      </header>

      <section class="sec">
        <div class="sec-head">
          <h2 class="sec-title">Session</h2>
          <p class="sec-note">
            Mock account, seeded signed in because every fixture is owned by it. Signing out forces
            the signed-out states pages have to render; `/dev/state` is the honest switch, the
            overflow menu carries the two-tap one.
          </p>
        </div>
        <div class="tools">
          <Button variant="primary" onClick={flipSession}>
            {user.value ? "Sign out" : "Sign in as @you"}
          </Button>
          <a
            class="btn btn-secondary"
            href={href(user.value ? `/user/${user.value.handle}` : "/authentification")}
          >
            {user.value ? "Open profile" : "Sign-in page"}
          </a>
        </div>
        <div class="rows">
          <div class="row">
            <span class="row-key">display name</span>
            <span class="row-value">{user.value?.displayName ?? "—"}</span>
          </div>
          <div class="row">
            <span class="row-key">handle</span>
            <span class="row-value">{user.value ? `@${user.value.handle}` : "—"}</span>
          </div>
          <div class="row">
            <span class="row-key">admin</span>
            <span class="row-value">{user.value?.isAdmin ? "granted by operator" : "no"}</span>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="sec-head">
          <h2 class="sec-title">NSFW preference</h2>
          <p class="sec-note">
            Per account, held by the adapter keyed by handle — never by this device. The two flags
            are independent: Show off with Blur on is a legal pair, and blur then has nothing to act
            on. Signed out, both read off and neither write lands.
          </p>
        </div>
        <div class="stack">
          <Toggle
            label="Show NSFW content"
            hint="Keeps flagged items in every listing."
            pressed={show}
            disabled={!user.value}
            onToggle={(next) => setShowNsfw(next)}
          />
          <Toggle
            label="Blur NSFW content"
            hint="Keeps them listed but covered until revealed."
            pressed={blur}
            disabled={!user.value}
            onToggle={(next) => setBlurNsfw(next)}
          />
        </div>
        <p class="note">{effectOf(user.value, { show: show.value, blur: blur.value })}</p>
        <p class="note">
          Reloading the preview resets both: the Supabase adapter is unprovisioned, so the pair
          lives in memory. Nothing fakes persistence with localStorage.
        </p>
      </section>

      <section class="counts" aria-label="Store notifications">
        <div class="count">
          <span class="count-value">{sessionPings.value}</span>
          <span class="count-label">Session emits</span>
          <span class="count-note">sign-in and sign-out</span>
        </div>
        <div class="count">
          <span class="count-value">{prefsPings.value}</span>
          <span class="count-label">Prefs emits</span>
          <span class="count-note">real changes only</span>
        </div>
        <div class="count">
          <span class="count-value">{show.value ? (blur.value ? "on · blur" : "on") : "off"}</span>
          <span class="count-label">Show</span>
          <span class="count-note">store value</span>
        </div>
        <div class="count">
          <span class="count-value">{blur.value ? "on" : "off"}</span>
          <span class="count-label">Blur</span>
          <span class="count-note">store value</span>
        </div>
      </section>

      <section class="sec">
        <div class="sec-head">
          <h2 class="sec-title">Elsewhere</h2>
          <p class="sec-note">
            The data seam has its own page; neither dev route is in the spec index.
          </p>
        </div>
        <p class="note">
          <a class="link" href={href("/dev/data")}>/dev/data</a> · counts, fixtures, mutation ·
          <a class="link" href={href("/dev/primitives")}>/dev/primitives</a> · every primitive at four
          widths
        </p>
      </section>
    </div>
  </>
}

export default DevState;

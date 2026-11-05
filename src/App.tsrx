import { effect, track, type Component } from "ripple";
import {
  currentRoute,
  follow,
  getMountedKey,
  href,
  navigate,
  onRouteChange,
  setMountedKey,
  type RouteState,
} from "./router.ts";
import {
  IconBack,
  IconBell,
  IconBookmark,
  IconCompass,
  IconDoc,
  IconFlag,
  IconMark,
  IconMenu,
  IconSpark,
  IconThread,
  IconUser,
} from "./components/Icons.tsrx";
import { ToastHost } from "./components/Toast.tsrx";
import { badgeCount } from "./lib/format.ts";
import {
  currentUser,
  onSession,
  signIn,
  signOut,
} from "./lib/state/session.ts";
import { nsfwPreference, onPrefs } from "./lib/state/prefs.ts";
import { onInbox, refreshInbox, unreadCount } from "./lib/state/inbox.ts";
import { installKeyboardInset } from "./lib/viewport.ts";
import type { AccountPreferences, User } from "./lib/data/types.ts";

/**
 * The shell: one top bar, no sidebar and no bottom tab bar. The brand sits on the left, Discover
 * and the options menu on the right. Every destination is a real spec route; the outlet loads the
 * page lazily from `router.ts`.
 */

type Status = "loading" | "ready" | "missing" | "error";

type Destination = {
  to: string;
  label: string;
  icon: Component;
  prefix: string;
};

/**
 * The options menu. Discover is deliberately absent: it has its own button in the top bar. Profile
 * is the only entry that depends on who is signed in — it points at the handle the session reports
 * (T-04), and falls back to `/authentification` when signed out.
 */
function optionsFor(user: User | null): Destination[] {
  return [
    {
      to: "/notifications",
      label: "Alerts",
      icon: IconBell,
      prefix: "/notifications",
    },
    { to: "/post/thread", label: "Thread", icon: IconThread, prefix: "/post" },
    {
      to: "/bookmarks",
      label: "Bookmarks",
      icon: IconBookmark,
      prefix: "/bookmarks",
    },
    {
      to: user ? `/user/${user.handle}` : "/authentification",
      label: "Profile",
      icon: IconUser,
      prefix: "/user",
    },
    {
      to: "/subscription",
      label: "Subscription",
      icon: IconSpark,
      prefix: "/subscription",
    },
    {
      to: "/moderation",
      label: "Moderation",
      icon: IconFlag,
      prefix: "/moderation",
    },
    { to: "/terms", label: "Terms of use", icon: IconDoc, prefix: "/terms" },
  ];
}

/** One honest sentence for the dev readout: what the listings would do right now. */
function prefsLine(user: User | null, prefs: AccountPreferences): string {
  if (!user) return "nsfw · off (signed out)";
  if (!prefs.show) return "nsfw · hidden from listings";
  return prefs.blur ? "nsfw · listed, blurred" : "nsfw · listed, uncovered";
}

function isActive(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * The Alerts destination's accessible name carries the unread count, because the badge itself is
 * decorative (`aria-hidden`): a screen reader hears *Alerts, 3 unread*, a sighted reader sees the
 * pill. Every other destination keeps its plain label.
 */
function alertsLabel(tab: Destination, unread: number): string | undefined {
  if (tab.prefix !== "/notifications" || unread === 0) return undefined;
  return `${tab.label}, ${unread} unread`;
}

export function App() @{
  /** The render signal for "where am I". The router store owns navigation; App owns the signal. */
  const route = track<RouteState>(currentRoute());
  onRouteChange((next) => {
    route.value = next;
  });

  /**
   * The mounted page, paired with the route key that mounts it. The key matters because several
   * routes share one component (`/discover/characters?q=…`, `/user/<handle>?tab=…`): setting the
   * same component again would keep the old instance, and pages read the URL **once per mount**.
   * The `key` on the rendered component turns a same-module navigation into a real remount.
   */
  const page = track<{ key: string; View: Component } | null>(null);
  const status = track<Status>("loading");
  /**
   * The route whose page is **on screen**, which is not always the route in the URL: a navigation
   * keeps the mounted page until the next module resolves, so the shell never blanks the outlet for
   * a chunk it does not have yet. The chrome (`immersive`, `wide`) follows this, not the target.
   */
  const shown = track<RouteState>(currentRoute());
  /**
   * A session draws its own chrome (`session/detail.md` → *Layout*): the shell hides the header and
   * the page owns the viewport. One predicate, so the rule is the route and not a class a page has
   * to remember to add.
   */
  const immersive = track(() => /^\/session\//.test(shown.value.path));
  /**
   * The route's own width choice (`router.ts` → `RouteDef.layout`). `reading` is the A4 column;
   * `wide` hands the page the whole content area. Only the outlet changes — the shell's chrome is
   * the same at every width.
   */
  const wide = track(() => shown.value.route?.layout === "wide");

  const menuOpen = track(false);
  const attempt = track(0);

  /**
   * Session and NSFW are plain subscribe/notify stores (`lib/state/*`); these tracked values are
   * the signals the render reads, exactly as `route` mirrors the router above.
   */
  const self = track<User | null>(currentUser());
  onSession((next) => {
    self.value = next;
  });

  const prefs = track<AccountPreferences>(nsfwPreference());
  onPrefs((next) => {
    prefs.value = next;
  });

  /** Profile points at the signed-in handle; the rest are fixed. */
  const options = track(() => optionsFor(self.value));
  /** Discover owns `/` and every `/discover/*` surface. */
  const discoverActive = track(
    () => route.value.path === "/" || route.value.path.startsWith("/discover"),
  );

  /**
   * The inbox badge (`pages/notifications.md` → *Badge*): the store's unread **row** count, mirrored
   * here because a module-scope `track()` has no owning block. `9+` is a formatting rule, so the
   * number is capped in `lib/format.ts` and never here; zero draws nothing at all.
   */
  const unread = track(unreadCount());
  onInbox((next) => {
    unread.value = next;
  });
  const badge = track(() => badgeCount(unread.value));

  // Seed once at boot: the badge does not reset on launch, and nothing increments per event.
  void refreshInbox();

  /**
   * T-36a — the on-screen keyboard, written once for the whole document.
   *
   * `--keyboard-inset` is a property of `documentElement`, and the session composer's dock is the
   * one surface that reads it. Installing the writer here rather than in that page is the rule, not
   * an optimisation: the shell mounts once, so there is exactly one writer for the app's lifetime
   * and no route change can stack a second listener on the same token.
   */
  installKeyboardInset();

  let seq = 0;
  let lastAttempt = -1;
  let scroller: HTMLElement | undefined;

  effect(() => {
    const retry = attempt.value;
    const current = route.value;
    const key = `${current.path}${current.search}`;

    // The effect also feeds the title and the scroll reset; only a new location loads a module.
    // The key lives in the router (T-66) because a page that commits its own query moves it too —
    // a private copy here stayed on the pre-query location and made the next navigation to this
    // same route a no-op (URL cleared, grid still filtered). This guard is the **only** thing that
    // skips a load, so it must never compare against `path` alone: `/post/thread?sort=…` and
    // `/user/<h>?tab=…` are links that have to remount.
    if (key === getMountedKey() && retry === lastAttempt) return;
    setMountedKey(key);
    lastAttempt = retry;

    const mine = ++seq;
    menuOpen.value = false;
    scroller?.scrollTo({ top: 0, left: 0 });

    const def = current.route;
    if (!def) {
      shown.value = current;
      page.value = null;
      status.value = "missing";
      document.title = "Not found — LuaPlot";
      return;
    }

    document.title =
      def.path === "/" ? "Discover — LuaPlot" : `${def.title} — LuaPlot`;
    status.value = "loading";
    def.page().then(
      (module) => {
        if (mine !== seq) return;
        shown.value = current;
        page.value = { key, View: module.default };
        status.value = "ready";
      },
      () => {
        if (mine !== seq) return;
        shown.value = current;
        page.value = null;
        status.value = "error";
      },
    );
  });

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate("/");
  }

  /**
   * The dev session switch. Labelled as an affordance, in the options menu so a reviewer can flip
   * it in two taps: `signOut()` exists to make the signed-out states pages must render reachable,
   * and it is not a product control (`docs/NEXT.md` → T-04, T-30 owns the real one).
   */
  function toggleSession() {
    if (self.value) signOut();
    else signIn();
    menuOpen.value = false;
  }

  /** The trigger's accessible name carries the unread count, because the badge is decorative. */
  function optionsLabel(): string {
    return unread.value > 0 ? `Menu, ${unread.value} unread` : "Menu";
  }

  <>
    <style>
      /* A session is a conversation, not a page in a shell: no top bar. The page draws its own
         header and composer and owns the whole viewport. */
      .shell.is-immersive .topbar {
        display: none;
      }

      .shell.is-immersive .content {
        overflow: hidden;
        padding-bottom: 0;
      }

      .shell.is-immersive .outlet {
        max-width: none;
        height: 100%;
        padding: 0;
      }

      .shell {
        display: flex;
        height: 100dvh;
        overflow: hidden;
        background-color: var(--color-bg);
        color: var(--color-text);
      }

      .frame {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }

      .topbar {
        display: flex;
        flex: none;
        align-items: center;
        gap: 4px;
        height: calc(56px + env(safe-area-inset-top));
        padding: env(safe-area-inset-top) 12px 0 8px;
        border-bottom: 1px solid var(--color-border);
        background-color: var(--color-bg);
      }

      /* The brand is the way home: the logo is the mark, the name is the wordmark. */
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 44px;
        min-width: 0;
        margin-right: auto;
        padding: 0 4px;
        border-radius: 2px;
        color: var(--color-text);
        text-decoration: none;
      }

      .brand:hover {
        color: var(--color-accent-text);
      }

      .brand .ico {
        flex: none;
        width: 22px;
        height: 22px;
        /* The logo is a mark: paint the stroke, never `color`, which is the text tier's job. */
        stroke: var(--color-accent);
      }

      .brand-name {
        overflow: hidden;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bar-actions {
        display: flex;
        flex: none;
        align-items: center;
        gap: 2px;
      }

      .bar-btn {
        position: relative;
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        border-radius: 2px;
        background: transparent;
        color: var(--color-text-muted);
        text-decoration: none;
        cursor: pointer;
        transition:
          color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
          background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .bar-btn:hover {
        color: var(--color-text);
        background-color: var(--color-surface);
      }

      .bar-btn:active {
        background-color: var(--color-surface-hover);
      }

      /* The icon is a mark; a bar control has no text of its own. */
      .bar-btn.is-active {
        color: var(--color-accent-text);
      }

      .content {
        flex: 1;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: env(safe-area-inset-bottom);
      }

      /* The reading column is one A4 page wide on a desktop (210mm ≈ 794px at 96dpi, the width a
         document is set to) and the whole screen on a phone, where 16px of padding is the gutter. */
      .outlet {
        max-width: 794px;
        margin: 0 auto;
        padding: 20px 16px 32px;
      }

      /* A browse surface that asks for `layout: "wide"` takes the whole content area. The
         reading column stays the default for every other route. */
      .outlet.is-wide {
        max-width: none;
      }

      /*
        The inbox badge: unread *rows*, `9+` above nine, nothing at zero. It floats on the
        icon it annotates (the menu trigger, or the Alerts row's bell) and is decorative — the
        control's `aria-label` carries the count. It never animates and never toasts.
      */
      .badge {
        position: absolute;
        top: -5px;
        right: -6px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border: 2px solid var(--color-bg);
        border-radius: 999px;
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        line-height: 12px;
        text-align: center;
        pointer-events: none;
      }

      .scrim {
        position: fixed;
        inset: 0;
        z-index: 8;
        background: transparent;
      }

      .menu {
        position: fixed;
        top: calc(56px + env(safe-area-inset-top));
        right: 10px;
        z-index: 9;
        min-width: 240px;
        max-height: calc(100dvh - 72px - env(safe-area-inset-top));
        overflow-y: auto;
        padding: 6px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-elevated);
        box-shadow: 0 18px 40px rgb(0 0 0 / 0.35);
        animation: menu-in 120ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 44px;
        padding: 0 10px;
        border-radius: 2px;
        color: var(--color-text);
        font-size: 14px;
        text-decoration: none;
      }

      .menu-item:hover {
        background-color: var(--color-surface);
      }

      /* The active row is a text-tier label plus its icon; no accent backplate. */
      .menu-item.is-active,
      .menu-item.is-active .menu-icon {
        color: var(--color-accent-text);
      }

      .menu-icon {
        position: relative;
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        color: var(--color-text-muted);
      }

      .menu-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Floating on the bell, matching the trigger's badge over the menu button. */
      .menu-icon .badge {
        top: -6px;
        right: -9px;
        border-color: var(--color-bg-elevated);
      }

      .menu-sep {
        height: 1px;
        margin: 6px 4px 4px;
        background-color: var(--color-border);
      }

      .menu-label {
        margin: 0;
        padding: 4px 12px 2px;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .menu-btn {
        width: 100%;
        border: 0;
        background: transparent;
        font-family: inherit;
        text-align: left;
        cursor: pointer;
      }

      .menu-note {
        margin: 0;
        padding: 0 12px 2px;
        color: var(--color-text-subtle);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        line-height: 1.6;
      }

      .menu-link {
        display: inline-flex;
        align-items: center;
        min-height: 32px;
        margin-left: 12px;
        color: var(--color-text-muted);
        font-size: 12px;
        text-decoration: none;
      }

      .menu-link:hover {
        color: var(--color-text);
        text-decoration: underline;
      }

      .skel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 520px;
      }

      .skel-bar {
        height: 14px;
        border-radius: 2px;
        background-color: var(--color-surface);
        animation: skel-pulse 1.2s ease-in-out infinite;
      }

      .skel-bar.is-title {
        height: 26px;
      }

      .fallback {
        max-width: 68ch;
      }

      .fallback h1 {
        margin: 0 0 8px;
        font-size: 26px;
        font-weight: 600;
        line-height: 1.2;
      }

      .fallback p {
        margin: 0 0 20px;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .fallback-action {
        display: inline-flex;
        align-items: center;
        height: 44px;
        padding: 0 16px;
        border: 1px solid var(--color-border-strong);
        border-radius: 2px;
        background: transparent;
        color: var(--color-text);
        font-size: 14px;
        text-decoration: none;
        cursor: pointer;
        transition: background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .fallback-action:hover {
        background-color: var(--color-surface);
      }

      @keyframes menu-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      @keyframes skel-pulse {
        0%,
        100% {
          opacity: 0.5;
        }
        50% {
          opacity: 1;
        }
      }

      @media (min-width: 640px) {
        .outlet {
          padding: 24px 24px 40px;
        }
      }

      @media (min-width: 900px) {
        .content {
          padding-bottom: 0;
        }

        .outlet {
          padding: 28px 32px 48px;
        }

        .menu {
          right: 16px;
        }
      }

      @media (min-width: 1200px) {
        /* A4 is the default content width (owner's call); a route may opt into the full
           content area with `layout: "wide"` (`.outlet.is-wide`). */
        .outlet {
          padding: 32px 40px 56px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .menu,
        .skel-bar {
          animation: none;
        }
      }
    </style>

    <div class={immersive.value ? "shell is-immersive" : "shell"}>
      <div class="frame">
        <header class="topbar">
          <button
            class="bar-btn"
            type="button"
            aria-label="Back"
            onClick={goBack}
          >
            <IconBack />
          </button>
          <a
            class="brand"
            href={href("/")}
            onClick={follow("/")}
            aria-label="LuaPlot — Discover"
          >
            <IconMark />
            <span class="brand-name">LuaPlot</span>
          </a>
          <div class="bar-actions">
            <a
              class={discoverActive.value ? "bar-btn is-active" : "bar-btn"}
              href={href("/discover/characters")}
              onClick={follow("/discover/characters")}
              aria-label="Discover"
              aria-current={discoverActive.value ? "page" : undefined}
            >
              <IconCompass />
            </a>
            <button
              class="bar-btn"
              type="button"
              aria-label={optionsLabel()}
              aria-haspopup="menu"
              aria-expanded={menuOpen.value ? "true" : "false"}
              onClick={() => (menuOpen.value = !menuOpen.value)}
            >
              <IconMenu />
              @if (badge.value) {
                <span class="badge" aria-hidden="true">
                  {badge.value}
                </span>
              }
            </button>
          </div>
        </header>

        @if (menuOpen.value) {
          <>
            <div class="scrim" onClick={() => (menuOpen.value = false)}></div>
            <div class="menu" role="menu" aria-label="Options">
              <p class="menu-label">Places</p>
              @for (const option of options.value; key option.label) {
                <a
                  class={
                    isActive(route.value.path, option.prefix)
                      ? "menu-item is-active"
                      : "menu-item"
                  }
                  role="menuitem"
                  href={href(option.to)}
                  aria-label={alertsLabel(option, unread.value)}
                  aria-current={
                    isActive(route.value.path, option.prefix)
                      ? "page"
                      : undefined
                  }
                  onClick={(event) => {
                    menuOpen.value = false;
                    follow(option.to)(event);
                  }}
                >
                  <span class="menu-icon" aria-hidden="true">
                    <{option.icon} />
                    @if (option.prefix === "/notifications" && badge.value) {
                      <span class="badge">{badge.value}</span>
                    }
                  </span>
                  <span class="menu-text">{option.label}</span>
                </a>
              }
              <div class="menu-sep" role="separator"></div>
              <p class="menu-label">Preview only · not a product control</p>
              <button
                class="menu-item menu-btn"
                type="button"
                role="menuitem"
                onClick={toggleSession}
              >
                <span class="menu-icon" aria-hidden="true">
                  <IconUser />
                </span>
                <span class="menu-text">
                  {self.value ? "Sign out" : "Sign in as @you"}
                </span>
              </button>
              <p class="menu-note">{prefsLine(self.value, prefs.value)}</p>
              <a
                class="menu-link"
                href={href("/dev/state")}
                onClick={(event) => {
                  menuOpen.value = false;
                  follow("/dev/state")(event);
                }}
              >
                /dev/state
              </a>
            </div>
          </>
        }

        <main
          class="content"
          ref={scroller}
          aria-busy={status.value === "loading" ? "true" : undefined}
        >
          <div class={wide.value ? "outlet is-wide" : "outlet"}>
            @switch (status.value) {
              @case "missing": {
                <section class="fallback">
                  <h1>Not found</h1>
                  <p>This page doesn't exist.</p>
                  <a
                    class="fallback-action"
                    href={href("/")}
                    onClick={follow("/")}
                  >
                    Go home
                  </a>
                </section>
              }
              @case "error": {
                <section class="fallback">
                  <h1>Couldn't load this page</h1>
                  <p>
                    The page module didn't arrive. Check the connection and try
                    again.
                  </p>
                  <button
                    class="fallback-action"
                    type="button"
                    onClick={() => (attempt.value += 1)}
                  >
                    Retry
                  </button>
                </section>
              }
              @default: {
                @if (page.value) {
                  <{page.value.View} key={page.value.key} />
                } @else {
                  /* Only the first boot has no page to keep: the shell's own placeholder is the
                     one surface it can draw before a page module exists. Data loading is the
                     page's job, and it shapes its skeleton like the answer (law 11). */
                  <div class="skel">
                    <div
                      class="skel-bar is-title"
                      style={{ width: "46%" }}
                    ></div>
                    <div class="skel-bar" style={{ width: "82%" }}></div>
                    <div class="skel-bar" style={{ width: "64%" }}></div>
                  </div>
                }
              }
            }
          </div>
        </main>
      </div>
    </div>

    <ToastHost />
  </>
}

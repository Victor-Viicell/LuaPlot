import { effect, track, type Component } from "ripple";
import { currentRoute, href, navigate, onRouteChange, type RouteState } from "./router.ts";
import {
  IconBack,
  IconBell,
  IconCatalog,
  IconHome,
  IconMore,
  IconThread,
  IconUser,
} from "./components/Icons.tsrx";
import { ToastHost } from "./components/Toast.tsrx";
import { currentUser, onSession, signIn, signOut } from "./lib/state/session.ts";
import { nsfwPreference, onPrefs } from "./lib/state/prefs.ts";
import type { AccountPreferences, User } from "./lib/data/types.ts";

/**
 * The shell: mobile top bar + bottom tab bar, a rail from `md`, a fixed sidebar from `lg`.
 * Every destination is a real spec route; the outlet loads the page lazily from `router.ts`.
 */

type Status = "loading" | "ready" | "missing" | "error";

type Destination = { to: string; label: string; icon: Component; prefix: string };

/**
 * The five destinations. Profile is the only one that depends on who is signed in: it points at
 * the handle the session reports (T-04), and falls back to `/` when signed out — the redirect
 * matrix that would send a guest to `/authentification` is T-30's, not the shell's.
 */
function tabsFor(user: User | null): Destination[] {
  return [
    { to: "/", label: "Home", icon: IconHome, prefix: "/" },
    { to: "/post/thread", label: "Thread", icon: IconThread, prefix: "/post" },
    { to: "/character/catalog", label: "Catalog", icon: IconCatalog, prefix: "/character" },
    { to: "/notifications", label: "Alerts", icon: IconBell, prefix: "/notifications" },
    {
      to: user ? `/user/${user.handle}` : "/",
      label: "Profile",
      icon: IconUser,
      prefix: "/user",
    },
  ];
}

const MENU: { to: string; label: string }[] = [
  { to: "/bookmarks", label: "Bookmarks" },
  { to: "/moderation", label: "Moderation" },
  { to: "/terms", label: "Terms of use" },
];

/** One honest sentence for the dev readout: what the listings would do right now. */
function prefsLine(user: User | null, prefs: AccountPreferences): string {
  if (!user) return "nsfw · off (signed out)";
  if (!prefs.show) return "nsfw · hidden from listings";
  return prefs.blur ? "nsfw · listed, blurred" : "nsfw · listed, uncovered";
}

function isActive(path: string, prefix: string): boolean {
  if (prefix === "/") return path === "/";
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function App() @{
  /** The render signal for "where am I". The router store owns navigation; App owns the signal. */
  const route = track<RouteState>(currentRoute());
  onRouteChange((next) => {
    route.value = next;
  });

  const Page = track<Component | null>(null);
  const status = track<Status>("loading");
  /**
   * A session draws its own chrome (`session/detail.md` → *Layout*): the shell hides its bar, its
   * tabs and its rail, and the page owns the viewport. One predicate, so the rule is the route and
   * not a class a page has to remember to add.
   */
  const immersive = track(() => /^\/session\//.test(route.value.path));

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

  /** Profile points at the signed-in handle; every other tab is fixed. */
  const tabs = track(() => tabsFor(self.value));

  let seq = 0;
  let lastKey = "";
  let lastAttempt = -1;
  let scroller: HTMLElement | undefined;

  effect(() => {
    const retry = attempt.value;
    const current = route.value;
    const key = `${current.path}${current.search}`;

    // The effect also feeds the title and the scroll reset; only a new location loads a module.
    if (key === lastKey && retry === lastAttempt) return;
    lastKey = key;
    lastAttempt = retry;

    const mine = ++seq;
    menuOpen.value = false;
    scroller?.scrollTo({ top: 0, left: 0 });

    const def = current.route;
    if (!def) {
      Page.value = null;
      status.value = "missing";
      document.title = "Not found — LuaPlot";
      return;
    }

    document.title = def.path === "/" ? "LuaPlot" : `${def.title} — LuaPlot`;
    status.value = "loading";
    def.page().then(
      (module) => {
        if (mine !== seq) return;
        Page.value = module.default;
        status.value = "ready";
      },
      () => {
        if (mine !== seq) return;
        Page.value = null;
        status.value = "error";
      },
    );
  });

  function follow(to: string) {
    return (event: MouseEvent) => {
      // Modified clicks keep the browser's own behaviour: new tab, new window, download.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      navigate(to);
    };
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate("/");
  }

  /**
   * The dev session switch. Labelled as an affordance, in the overflow menu so a reviewer can
   * flip it in two taps: `signOut()` exists to make the signed-out states pages must render
   * reachable, and it is not a product control (`docs/NEXT.md` → T-04, T-30 owns the real one).
   */
  function toggleSession() {
    if (self.value) signOut();
    else signIn();
    menuOpen.value = false;
  }

  <>
    <style>
      /* A session is a conversation, not a page in a shell: no top bar, no tab bar, no rail. The
         page draws its own header and composer and owns the whole viewport. */
      .shell.is-immersive .topbar,
      .shell.is-immersive .tabbar,
      .shell.is-immersive .rail {
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

      .rail {
        display: none;
      }

      .topbar {
        display: flex;
        flex: none;
        align-items: center;
        gap: 2px;
        height: calc(56px + env(safe-area-inset-top));
        padding: env(safe-area-inset-top) 8px 0;
        border-bottom: 1px solid var(--color-border);
        background-color: var(--color-bg);
      }

      .ghost {
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
        cursor: pointer;
        transition:
          color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
          background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .ghost:hover {
        color: var(--color-text);
        background-color: var(--color-surface);
      }

      .ghost:active {
        background-color: var(--color-surface-hover);
      }

      .titles {
        display: flex;
        flex: 1;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
        padding-left: 2px;
      }

      .bar-title {
        overflow: hidden;
        color: var(--color-text);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.005em;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .crumb {
        display: none;
        overflow: hidden;
        color: var(--color-text-subtle);
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .content {
        flex: 1;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
      }

      /* The reading column is one A4 page wide on a desktop (210mm ≈ 794px at 96dpi, the width a
         document is set to) and the whole screen on a phone, where 16px of padding is the gutter. */
      .outlet {
        max-width: 794px;
        margin: 0 auto;
        padding: 20px 16px 32px;
      }

      .tabbar {
        display: grid;
        flex: none;
        grid-template-columns: repeat(5, 1fr);
        height: calc(60px + env(safe-area-inset-bottom));
        padding-bottom: env(safe-area-inset-bottom);
        border-top: 1px solid var(--color-border);
        background-color: var(--color-bg-elevated);
      }

      .tab {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        min-height: 44px;
        color: var(--color-text-subtle);
        text-decoration: none;
        transition: color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .tab:hover {
        color: var(--color-text-muted);
      }

      .tab.is-active {
        color: var(--color-accent);
      }

      .tab.is-active::before {
        position: absolute;
        top: -1px;
        left: 50%;
        width: 20px;
        height: 2px;
        background-color: var(--color-accent);
        content: "";
        transform: translateX(-50%);
      }

      .tab-label {
        font-size: 12px;
        letter-spacing: 0.02em;
        line-height: 1;
      }

      .scrim {
        position: fixed;
        inset: 0;
        z-index: 8;
        background: transparent;
      }

      .menu {
        position: fixed;
        top: calc(52px + env(safe-area-inset-top));
        right: 10px;
        z-index: 9;
        min-width: 220px;
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
        height: 44px;
        padding: 0 12px;
        border-radius: 2px;
        color: var(--color-text);
        font-size: 14px;
        text-decoration: none;
      }

      .menu-item:hover {
        background-color: var(--color-surface);
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
        .rail {
          display: flex;
          flex: none;
          flex-direction: column;
          gap: 20px;
          width: 84px;
          padding: 16px 6px calc(16px + env(safe-area-inset-bottom));
          border-right: 1px solid var(--color-border);
          background-color: var(--color-bg-elevated);
        }

        .mark {
          padding: 6px 0 14px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.01em;
          text-align: center;
          text-decoration: none;
        }

        .rail-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rail-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          padding: 10px 4px;
          border-radius: 2px;
          color: var(--color-text-subtle);
          text-decoration: none;
          transition:
            color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
            background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .rail-item:hover {
          background-color: var(--color-surface);
          color: var(--color-text-muted);
        }

        .rail-item.is-active {
          background-color: var(--color-surface);
          color: var(--color-accent);
        }

        .rail-label {
          font-size: 12px;
          letter-spacing: 0.01em;
          line-height: 1;
        }

        .tabbar {
          display: none;
        }

        .content {
          padding-bottom: 0;
        }

        .outlet {
          padding: 28px 32px 48px;
        }
      }

      @media (min-width: 1200px) {
        .rail {
          gap: 24px;
          width: 240px;
          padding: 24px 16px;
        }

        .rail-nav {
          gap: 2px;
        }

        .rail-item {
          position: relative;
          flex-direction: row;
          gap: 12px;
          height: 44px;
          padding: 0 12px;
        }

        .rail-item.is-active::before {
          position: absolute;
          top: 10px;
          bottom: 10px;
          left: 0;
          width: 2px;
          background-color: var(--color-accent);
          content: "";
        }

        .rail-label {
          font-size: 13px;
        }

        .mark {
          padding: 0 8px 16px;
          font-size: 15px;
          text-align: left;
        }

        .crumb {
          display: inline;
        }

        .outlet {
          max-width: 1120px;
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
      <aside class="rail">
        <a class="mark" href={href("/")} onClick={follow("/")}>LuaPlot</a>
        <nav class="rail-nav" aria-label="Sections">
          @for (const tab of tabs.value; key tab.label) {
            <a
              class={isActive(route.value.path, tab.prefix) ? "rail-item is-active" : "rail-item"}
              href={href(tab.to)}
              aria-current={isActive(route.value.path, tab.prefix) ? "page" : undefined}
              onClick={follow(tab.to)}
            >
              <{tab.icon} />
              <span class="rail-label">{tab.label}</span>
            </a>
          }
        </nav>
      </aside>

      <div class="frame">
        <header class="topbar">
          <button class="ghost" type="button" aria-label="Back" onClick={goBack}>
            <IconBack />
          </button>
          <div class="titles">
            <span class="bar-title">{route.value.route ? route.value.route.title : "Not found"}</span>
            <span class="crumb">{route.value.path}</span>
          </div>
          <button
            class="ghost"
            type="button"
            aria-label="More"
            aria-expanded={menuOpen.value ? "true" : "false"}
            onClick={() => (menuOpen.value = !menuOpen.value)}
          >
            <IconMore />
          </button>
        </header>

        @if (menuOpen.value) {
          <>
            <div class="scrim" onClick={() => (menuOpen.value = false)}></div>
            <div class="menu" role="menu">
              @for (const item of MENU; key item.to) {
                <a class="menu-item" role="menuitem" href={href(item.to)} onClick={follow(item.to)}>
                  {item.label}
                </a>
              }
              <div class="menu-sep" role="separator"></div>
              <p class="menu-label">Preview only · not a product control</p>
              <button class="menu-item menu-btn" type="button" role="menuitem" onClick={toggleSession}>
                {self.value ? "Sign out" : "Sign in as @you"}
              </button>
              <p class="menu-note">{prefsLine(self.value, prefs.value)}</p>
              <a class="menu-link" href={href("/dev/state")} onClick={follow("/dev/state")}>
                /dev/state
              </a>
            </div>
          </>
        }

        <main class="content" ref={scroller} aria-busy={status.value === "loading" ? "true" : undefined}>
          <div class="outlet">
            @switch (status.value) {
              @case "loading": {
                <div class="skel">
                  <div class="skel-bar is-title" style={{ width: "46%" }}></div>
                  <div class="skel-bar" style={{ width: "82%" }}></div>
                  <div class="skel-bar" style={{ width: "64%" }}></div>
                </div>
              }
              @case "missing": {
                <section class="fallback">
                  <h1>Not found</h1>
                  <p>This page doesn't exist.</p>
                  <a class="fallback-action" href={href("/")} onClick={follow("/")}>Go home</a>
                </section>
              }
              @case "error": {
                <section class="fallback">
                  <h1>Couldn't load this page</h1>
                  <p>The page module didn't arrive. Check the connection and try again.</p>
                  <button class="fallback-action" type="button" onClick={() => (attempt.value += 1)}>
                    Retry
                  </button>
                </section>
              }
              @default: {
                @if (Page.value) {
                  <{Page.value} />
                }
              }
            }
          </div>
        </main>

        <nav class="tabbar" aria-label="Primary">
          @for (const tab of tabs.value; key tab.label) {
            <a
              class={isActive(route.value.path, tab.prefix) ? "tab is-active" : "tab"}
              href={href(tab.to)}
              aria-current={isActive(route.value.path, tab.prefix) ? "page" : undefined}
              onClick={follow(tab.to)}
            >
              <{tab.icon} />
              <span class="tab-label">{tab.label}</span>
            </a>
          }
        </nav>
      </div>
    </div>

    <ToastHost />
  </>
}

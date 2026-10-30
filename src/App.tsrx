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

/**
 * The shell: mobile top bar + bottom tab bar, a rail from `md`, a fixed sidebar from `lg`.
 * Every destination is a real spec route; the outlet loads the page lazily from `router.ts`.
 */

type Status = "loading" | "ready" | "missing" | "error";

type Destination = { to: string; label: string; icon: Component; prefix: string };

/** Placeholder until T-04 brings session state: the profile tab needs a handle to point at. */
const SELF_HANDLE = "you";

const TABS: Destination[] = [
  { to: "/", label: "Home", icon: IconHome, prefix: "/" },
  { to: "/post/thread", label: "Thread", icon: IconThread, prefix: "/post" },
  { to: "/character/catalog", label: "Catalog", icon: IconCatalog, prefix: "/character" },
  { to: "/notifications", label: "Alerts", icon: IconBell, prefix: "/notifications" },
  { to: `/user/${SELF_HANDLE}`, label: "Profile", icon: IconUser, prefix: "/user" },
];

const MENU: { to: string; label: string }[] = [
  { to: "/bookmarks", label: "Bookmarks" },
  { to: "/moderation", label: "Moderation" },
  { to: "/terms", label: "Terms of use" },
];

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
  const menuOpen = track(false);
  const attempt = track(0);

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

  <>
    <style>
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

      .outlet {
        max-width: 720px;
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

    <div class="shell">
      <aside class="rail">
        <a class="mark" href={href("/")} onClick={follow("/")}>LuaPlot</a>
        <nav class="rail-nav" aria-label="Sections">
          @for (const tab of TABS; key tab.to) {
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
          @for (const tab of TABS; key tab.to) {
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

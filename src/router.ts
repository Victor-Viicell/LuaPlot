import type { Component } from "ripple";

/**
 * The route table plus the only navigation seam in the app.
 *
 * Rules (from `src/specs/luaplot-pages.md`):
 * - fixed segments win over params, params are UUID-shaped so `catalog` can never collide with an id;
 * - the query string is untouched here — pages read it with `useQuery()`;
 * - `base` comes from `import.meta.env.BASE_URL` so `/LuaPlot/` on Pages and `/` under Tauri both work;
 * - no router dependency: ~120 lines of match + navigate.
 */

export type Access = "public" | "signed-in" | "onboarding" | "admin";

export type PageModule = { default: Component };

export type RouteDef = {
  /** Exact path from the spec index, params included (`[character.id]`, `[user.username]`). */
  path: string;
  /** Title shown in the shell's top bar and in `document.title`. */
  title: string;
  /**
   * Declared now, enforced later: T-04 brings session state, T-30 wires the redirect matrix.
   * T-01 renders every route so the smoke test can walk the tree.
   */
  access: Access;
  page: () => Promise<PageModule>;
};

export const ROUTES: RouteDef[] = [
  // Entry
  { path: "/", title: "LuaPlot", access: "public", page: () => import("./pages/home.tsrx") },
  {
    path: "/authentification",
    title: "Sign in",
    access: "public",
    page: () => import("./pages/authentification.tsrx"),
  },
  {
    path: "/onboarding",
    title: "Onboarding",
    access: "onboarding",
    page: () => import("./pages/onboarding.tsrx"),
  },

  // Personal
  {
    path: "/notifications",
    title: "Notifications",
    access: "signed-in",
    page: () => import("./pages/notifications.tsrx"),
  },
  {
    path: "/bookmarks",
    title: "Bookmarks",
    access: "signed-in",
    page: () => import("./pages/bookmarks.tsrx"),
  },

  // People
  {
    path: "/user/[user.username]",
    title: "Profile",
    access: "public",
    page: () => import("./pages/user-profile.tsrx"),
  },
  {
    path: "/user/[user.username]/edit",
    title: "Account settings",
    access: "signed-in",
    page: () => import("./pages/user-edit.tsrx"),
  },

  // Characters
  {
    path: "/character/catalog",
    title: "Characters",
    access: "public",
    page: () => import("./pages/character-catalog.tsrx"),
  },
  {
    path: "/character/create",
    title: "New character",
    access: "signed-in",
    page: () => import("./pages/character-create.tsrx"),
  },
  {
    path: "/character/[character.id]",
    title: "Character",
    access: "public",
    page: () => import("./pages/character-detail.tsrx"),
  },
  {
    path: "/character/[character.id]/edit",
    title: "Edit character",
    access: "signed-in",
    page: () => import("./pages/character-edit.tsrx"),
  },

  // Lorebooks
  {
    path: "/lorebook/catalog",
    title: "Lorebooks",
    access: "public",
    page: () => import("./pages/lorebook-catalog.tsrx"),
  },
  {
    path: "/lorebook/create",
    title: "New lorebook",
    access: "signed-in",
    page: () => import("./pages/lorebook-create.tsrx"),
  },
  {
    path: "/lorebook/[lorebook.id]",
    title: "Lorebook",
    access: "public",
    page: () => import("./pages/lorebook-detail.tsrx"),
  },
  {
    path: "/lorebook/[lorebook.id]/edit",
    title: "Edit lorebook",
    access: "signed-in",
    page: () => import("./pages/lorebook-edit.tsrx"),
  },

  // Presets
  {
    path: "/preset/catalog",
    title: "Presets",
    access: "public",
    page: () => import("./pages/preset-catalog.tsrx"),
  },
  {
    path: "/preset/create",
    title: "New preset",
    access: "signed-in",
    page: () => import("./pages/preset-create.tsrx"),
  },
  {
    path: "/preset/[preset.id]",
    title: "Preset",
    access: "public",
    page: () => import("./pages/preset-detail.tsrx"),
  },
  {
    path: "/preset/[preset.id]/edit",
    title: "Edit preset",
    access: "signed-in",
    page: () => import("./pages/preset-edit.tsrx"),
  },

  // Personas
  {
    path: "/persona",
    title: "Personas",
    access: "signed-in",
    page: () => import("./pages/persona-collection.tsrx"),
  },
  {
    path: "/persona/create",
    title: "New persona",
    access: "signed-in",
    page: () => import("./pages/persona-create.tsrx"),
  },
  {
    path: "/persona/[persona.id]",
    title: "Persona",
    access: "signed-in",
    page: () => import("./pages/persona-detail.tsrx"),
  },
  {
    path: "/persona/[persona.id]/edit",
    title: "Edit persona",
    access: "signed-in",
    page: () => import("./pages/persona-edit.tsrx"),
  },

  // Posts
  {
    path: "/post/thread",
    title: "Thread",
    access: "public",
    page: () => import("./pages/post-thread.tsrx"),
  },
  {
    path: "/post/create",
    title: "New post",
    access: "signed-in",
    page: () => import("./pages/post-create.tsrx"),
  },
  {
    path: "/post/[post.id]",
    title: "Post",
    access: "public",
    page: () => import("./pages/post-detail.tsrx"),
  },

  // Sessions
  {
    path: "/session/[session.id]",
    title: "Session",
    access: "signed-in",
    page: () => import("./pages/session-detail.tsrx"),
  },

  // Moderation
  {
    path: "/moderation",
    title: "Moderation",
    access: "admin",
    page: () => import("./pages/moderation-queue.tsrx"),
  },
  {
    path: "/moderation/[report.id]",
    title: "Case",
    access: "admin",
    page: () => import("./pages/moderation-detail.tsrx"),
  },

  // Legal
  { path: "/terms", title: "Terms of use", access: "public", page: () => import("./pages/terms.tsrx") },
];

type Segment = { literal: string } | { param: string; test: RegExp };

const PARAM_SEGMENT = /^\[(.+)\]$/;
/** Ids are constrained so a real id can never collide with a fixed word like `catalog`. */
const ID = /^[0-9a-f-]{36}$/i;
/** Handles follow the onboarding rule: 3–24 of `[a-z0-9_]`, case-insensitive. */
const HANDLE = /^[A-Za-z0-9_]{3,24}$/;

const segment = (part: string): Segment => {
  const param = PARAM_SEGMENT.exec(part);
  if (!param) return { literal: part };
  // `[character.id]` exposes `id`, `[user.username]` exposes `username`.
  const name = param[1].split(".").pop() ?? param[1];
  return { param: name, test: name === "username" ? HANDLE : ID };
};

const split = (path: string): string[] => path.split("/").filter(Boolean);

/** Fixed segments first: fewer params = more specific. */
const TABLE = ROUTES.map((route) => ({ route, segments: split(route.path).map(segment) })).sort(
  (a, b) =>
    a.segments.filter((s) => "param" in s).length - b.segments.filter((s) => "param" in s).length ||
    b.segments.length - a.segments.length,
);

export type RouteMatch = { route: RouteDef; params: Record<string, string> };

/** Match an app path (no base, no query) against the table. */
export function matchPath(path: string): RouteMatch | null {
  const parts = split(path);
  for (const entry of TABLE) {
    if (entry.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i += 1) {
      const expected = entry.segments[i];
      const actual = parts[i];
      if ("literal" in expected) {
        if (expected.literal !== actual) {
          ok = false;
          break;
        }
      } else if (expected.test.test(actual)) {
        params[expected.param] = actual;
      } else {
        ok = false;
        break;
      }
    }
    if (ok) return { route: entry.route, params };
  }
  return null;
}

/** `` for `/`, `/LuaPlot` for `/LuaPlot/` — the prefix every in-app link carries. */
export const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

/** App path → href the browser can resolve on Pages or under Tauri. */
export function href(path: string): string {
  return `${BASE}${path}`;
}

function stripBase(pathname: string): string {
  if (!BASE) return pathname || "/";
  if (pathname === BASE) return "/";
  if (pathname.startsWith(`${BASE}/`)) return pathname.slice(BASE.length);
  return pathname || "/";
}

export type RouteState = {
  /** App path, no base, no query. */
  path: string;
  /** Raw `location.search`, query included. */
  search: string;
  route: RouteDef | null;
  params: Record<string, string>;
};

function readLocation(): RouteState {
  if (typeof window === "undefined") return { path: "/", search: "", route: null, params: {} };
  const path = stripBase(window.location.pathname);
  const match = matchPath(path);
  return {
    path,
    search: window.location.search,
    route: match?.route ?? null,
    params: match?.params ?? {},
  };
}

/**
 * Router state is a plain subscribe/notify store, not a tracked value on purpose: `track()`
 * has to be created inside a component (a module-scope tracked has no owning block, and writing
 * to it throws inside the runtime). App mirrors this store into its own `track()` — that is the
 * signal every render reads.
 */
let state: RouteState = readLocation();
const listeners = new Set<(next: RouteState) => void>();

/** Current match. Reads outside a render are a snapshot, not a subscription. */
export function currentRoute(): RouteState {
  return state;
}

/** Query-string state for the current page (filters, sort, tabs). */
export function useQuery(): URLSearchParams {
  return new URLSearchParams(state.search);
}

/** Subscribe to navigation. Returns an unsubscribe function. */
export function onRouteChange(listener: (next: RouteState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  state = readLocation();
  for (const listener of listeners) listener(state);
}

/** Push or replace history, then notify. */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  const next = href(path);
  if (options.replace) window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", emit);
}

import type { Component } from "ripple";
import { isHandle } from "./lib/schema.ts";

/**
 * The route table plus the only navigation seam in the app.
 *
 * Rules (from `src/specs/luaplot-pages.md`):
 * - fixed segments win over params, params are UUID-shaped so `discover` can never collide with an id;
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
  /**
   * How wide the page's content column may grow on a desktop.
   *
   * `reading` (the default) is one A4 page wide (794px) — the app's document measure. `wide`
   * hands the page the whole content area, for a browse surface that gains columns from it
   * (`/discover/*`). The shell reads this; a page never sets its own width.
   */
  layout?: "reading" | "wide";
  page: () => Promise<PageModule>;
};

export const ROUTES: RouteDef[] = [
  // Entry
  {
    path: "/",
    title: "Discover",
    access: "public",
    layout: "wide",
    page: () => import("./pages/discover-characters.tsrx"),
  },
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
  {
    path: "/subscription",
    title: "Subscription",
    access: "signed-in",
    page: () => import("./pages/subscription.tsrx"),
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

  // Discover — the three browse surfaces, characters first and also the home page.
  {
    path: "/discover/characters",
    title: "Discover",
    access: "public",
    layout: "wide",
    page: () => import("./pages/discover-characters.tsrx"),
  },
  {
    path: "/discover/lorebooks",
    title: "Lorebooks",
    access: "public",
    layout: "wide",
    page: () => import("./pages/discover-lorebooks.tsrx"),
  },
  {
    path: "/discover/presets",
    title: "Presets",
    access: "public",
    layout: "wide",
    page: () => import("./pages/discover-presets.tsrx"),
  },

  // Characters
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

  // Development only. Not a product route: absent from the spec index, absent from the tab bar,
  // and `scripts/spec-routes.mjs` drops `/dev/*` from this table before comparing.
  {
    path: "/dev/primitives",
    title: "Primitives",
    access: "public",
    page: () => import("./pages/dev-primitives.tsrx"),
  },
  {
    path: "/dev/data",
    title: "Data",
    access: "public",
    page: () => import("./pages/dev-data.tsrx"),
  },
  {
    path: "/dev/state",
    title: "State",
    access: "public",
    page: () => import("./pages/dev-state.tsrx"),
  },
  {
    path: "/dev/native",
    title: "Native",
    access: "public",
    page: () => import("./pages/dev-native.tsrx"),
  },
];

/** A param segment carries a predicate, so the table can hand a schema rule in directly. */
type Segment = { literal: string } | { param: string; test: (value: string) => boolean };

const PARAM_SEGMENT = /^\[(.+)\]$/;
/** Ids are constrained so a real id can never collide with a fixed word like `catalog`. */
const ID = /^[0-9a-f-]{36}$/i;
const idSegment = (value: string): boolean => ID.test(value);

const segment = (part: string): Segment => {
  const param = PARAM_SEGMENT.exec(part);
  if (!param) return { literal: part };
  // `[character.id]` exposes `id`, `[user.username]` exposes `username`.
  const name = param[1].split(".").pop() ?? param[1];
  // A username is matched by the **onboarding rule itself** (`lib/schema.ts` → `isHandle`): two
  // copies of `3–24 of [a-z0-9_]` would be two rules, and the day one tightens, the other silently
  // routes a profile that cannot exist.
  return { param: name, test: name === "username" ? isHandle : idSegment };
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
      } else if (expected.test(actual)) {
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

/**
 * The `path + search` key the shell has actually **mounted**.
 *
 * It lives here, not in `App.tsrx`, because two parties write it: a navigation (the shell mounts a
 * new key) and a page that commits its own query (T-66). While it was a private `lastKey` in the
 * shell, a page's silent `pushState` left it pointing at the *pre-query* location — so pressing the
 * Catalog tab from a narrowed catalog asked for the key the shell already believed it had mounted,
 * nothing reloaded, the URL dropped the query and the grid kept it (row 48 had to route through
 * `go("/")` to force a mount).
 *
 * `emit()` deliberately does **not** touch it: a navigation must always reach the URL in the bar.
 */
let mountedKey = "";

/** The key the shell has mounted — `getMountedKey()` === the location the DOM is showing. */
export function getMountedKey(): string {
  return mountedKey;
}

/** Record the key the shell has just mounted (or failed to mount). Only the shell and `commitQuery` call this. */
export function setMountedKey(key: string): void {
  mountedKey = key;
}

/** Current match. Reads outside a render are a snapshot, not a subscription. */
export function currentRoute(): RouteState {
  return state;
}

/** Query-string state for the current page (filters, sort, tabs). */
export function useQuery(): URLSearchParams {
  return new URLSearchParams(state.search);
}

/**
 * The route's params for the current page — `{ id }` on `/character/[character.id]`, `{ username }`
 * on a profile.
 *
 * A snapshot at call time, exactly like `useQuery()`: `App.tsrx` reloads the page module whenever
 * `path + search` changes, so a page that reads this at mount reads the params it was mounted for.
 * A page must never parse `location.pathname` for its own id — the table already matched it, and a
 * second reading would be a second route rule.
 */
export function useParams(): Record<string, string> {
  return state.params;
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

/**
 * A page writing **its own** query into the address bar — the debounced search, a tag chip, a sort,
 * a tab (T-66).
 *
 * It is not `navigate()`, and it must not become `navigate()`: `navigate()` emits, `App.tsrx` reloads
 * the page module whenever the location key changes, and a remount mid-typing hands the reader a
 * **new `<input>` with no caret** — a person who types four letters and pauses loses their place.
 * So this writes history, refreshes the router's own snapshot (`useQuery()`/`useParams()` for a page
 * mounted *after* this call) and moves the shell's mounted key to the location it now owns, while
 * keeping every listener quiet.
 *
 * **The mounted key is the whole point.** Without it the shell still believed it was showing the
 * pre-query location, so any later navigation to that same route was a no-op: press the Catalog tab
 * on a narrowed catalog and the URL cleared while the grid kept the filter — the one shape
 * `character/discover.md` → *URL* forbids (a narrowed view can be shared, bookmarked).
 *
 * `search` is a bare query string (`q=sea`, leading `?` allowed), applied to the route the router
 * has already matched — a page cannot commit a query onto a path it is not on.
 */
export function commitQuery(search: string, mode: "push" | "replace" = "replace"): void {
  if (typeof window === "undefined") return;
  const clean = search.replace(/^\?/, "");
  const next = `${href(state.path)}${clean ? `?${clean}` : ""}`;
  if (mode === "replace") window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);
  state = readLocation();
  mountedKey = `${state.path}${state.search}`;
}

/**
 * The only click seam: turn a real anchor into an in-app hop.
 *
 * Every link in the app is a real `<a href>` — middle-click, back/forward, a crawler and a no-JS
 * visit all work — and pairs it with `onClick={follow(to)}`. Without it the press is a **document
 * load**: the running app is discarded and boots again (T-45 fixed exactly that on home's entry
 * control, where the reload re-seeded the mock and read like a successful sign-in).
 *
 * A modified click is deliberately left to the browser (new tab, new window, download). The caller
 * passes a plain string, so a control whose target comes from a tracked value must read it at
 * render time (`follow(target.value)`) — a captured path goes stale after a session change.
 *
 * **`to` is an app path, never an `href()`.** `navigate()` adds the base itself, so pairing
 * `onClick={follow(href(x))}` with `href={href(x)}` looks symmetric and is a bug: on Pages the base
 * is added twice (`/LuaPlot/LuaPlot/…`), the table matches nothing, and the app lands on its own
 * not-found page — while a locally-served build (base `/`) behaves perfectly (T-45).
 */
export function follow(to: string): (event: MouseEvent) => void {
  return (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", emit);
}

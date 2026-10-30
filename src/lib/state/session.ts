/**
 * Who is signed in — one store for the whole app.
 *
 * A plain subscribe/notify store, exactly like `src/router.ts` and `src/lib/toast.ts`, and for the
 * same reason: `track()` has to be created inside a component (a module-scope tracked has no
 * owning block and every write to it throws). Components mirror this store into their own
 * `track()`; `App.tsrx` does that for the profile tab.
 *
 * Mock until T-30 wires Supabase auth: one account, `you`, admin false. It is seeded **signed in**
 * because every fixture is owned by `you`, so the preview is worth opening — `signOut()` is what
 * makes the signed-out states pages must render reachable at all (`systems/nsfw.md`: signed out,
 * NSFW is off and the control leads to sign-in).
 *
 * Access enforcement is **not** here. `router.ts` declares an `access` value per route and
 * `docs/NEXT.md` gives the redirect matrix to T-30; this module only makes the state readable.
 */
import type { Handle, User } from "../data/types.ts";

/** The single mock account. Matches the fixture owner in `lib/data/memory.ts`. */
export const MOCK_USER: User = {
  handle: "you",
  displayName: "You",
  isAdmin: false,
};

let user: User | null = { ...MOCK_USER };
/** How many times the store has notified — the `/dev/state` evidence that it is wired. */
let notified = 0;
const listeners = new Set<(next: User | null) => void>();

/** The account, or `null` when signed out. A snapshot read, not a subscription. */
export function currentUser(): User | null {
  return user;
}

export function isSignedIn(): boolean {
  return user !== null;
}

/** Notifications emitted so far. Rises on every sign-in, sign-out, and profile change. */
export function sessionNotifications(): number {
  return notified;
}

/** Subscribe. Returns an unsubscribe function. */
export function onSession(listener: (next: User | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  notified += 1;
  for (const listener of listeners) listener(user);
}

/**
 * Sign in. The mock takes no credentials: `handle` exists so T-30 can pass the real account
 * through unchanged, and the default is the fixture owner.
 */
export function signIn(handle: Handle = MOCK_USER.handle): void {
  if (user?.handle === handle) return;
  user = handle === MOCK_USER.handle ? { ...MOCK_USER } : { ...MOCK_USER, handle };
  emit();
}

/** Sign out. The signed-out states belong to the pages; this only removes the account. */
export function signOut(): void {
  if (user === null) return;
  user = null;
  emit();
}

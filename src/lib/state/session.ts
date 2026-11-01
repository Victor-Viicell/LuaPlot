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
 * **The account survives a restart** (T-33B). It is kept in `localStorage` under one key, read
 * **once at module load** and written only by the three calls that already `emit()`, so every
 * `track()` consumer sees exactly the notifications it always has: the restore happens before the
 * first component exists, so there is nothing to notify. `storedSessionSchema` (schema.ts) owns the
 * whole read: absent key → this seed, `null` → signed out, a row → that account, anything else
 * (corrupt, stale, hand-edited) → this seed **silently**, never a throw and never half-applied.
 *
 * Two things are deliberately *not* persisted: the NSFW pair (it is per account and lives in the
 * adapter — `state/prefs.ts` re-reads it on every session change, so restoring it here would be a
 * second copy) and NSFW content state, which is the account's preference, not this store's.
 *
 * Access enforcement is **not** here. `router.ts` declares an `access` value per route and
 * `docs/NEXT.md` gives the redirect matrix to T-30; this module only makes the state readable.
 */
import type { Handle, User } from "../data/types.ts";
import { SESSION_KEY, storedSessionSchema } from "../schema.ts";

/** The single mock account. Matches the fixture owner in `lib/data/memory.ts`. */
export const MOCK_USER: User = {
  handle: "you",
  displayName: "You",
  isAdmin: false,
};

/** The `localStorage` this module keeps the account in, or `null` when the host has none. */
function storage(): Storage | null {
  try {
    // Not every host has one (a bare `bun test`, a locked-down webview). Touching it can throw too.
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Read the account this device kept — **once**, at module load, so the first paint already knows
 * who is here. A key that is absent means a fresh install (the seed); a store that cannot be read
 * means the same, because a preview that opens signed in is the honest fallback for a broken
 * `localStorage` rather than a blank app.
 */
function restore(): User | null {
  const store = storage();
  if (store === null) return { ...MOCK_USER };
  const raw = store.getItem(SESSION_KEY);
  if (raw === null) return { ...MOCK_USER };

  const parsed = storedSessionSchema.safeParse(raw);
  // Corrupt or stale: fall back to the seed silently. A stale row from an older shape is exactly
  // this case, and it must not leave the app signed out with no way to explain why.
  if (!parsed.success) return { ...MOCK_USER };
  if (parsed.data === null) return null;
  // The identity readout comes from the row; the admin mark never does (a client-writable store is
  // not allowed to grant it), and ownership logic keeps reading the seed, exactly as `signIn(handle)`
  // already does.
  return { ...MOCK_USER, handle: parsed.data.handle, displayName: parsed.data.displayName };
}

let user: User | null = restore();
/** How many times the store has notified — the `/dev/state` evidence that it is wired. */
let notified = 0;
const listeners = new Set<(next: User | null) => void>();

/**
 * Write the account back. Called by `signIn` / `signOut` / `setAccount` and nowhere else, so the
 * stored row and the live value cannot drift.
 *
 * Signed out it writes the literal `null` instead of removing the key: a removed key is
 * indistinguishable from a fresh install and would restore the seed on the next launch, which makes
 * *sign out* last exactly until the app restarts. A storage that refuses the write (private mode,
 * a full quota) leaves the in-memory store correct for this page — the write is a convenience, not
 * the truth.
 */
function persist(): void {
  const store = storage();
  if (store === null) return;
  try {
    store.setItem(
      SESSION_KEY,
      user === null ? "null" : JSON.stringify({ handle: user.handle, displayName: user.displayName }),
    );
  } catch {
    /* storage full or locked down: this session still works, the next launch starts from the seed */
  }
}

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

/** The one place the live value and the kept row change together: write, then notify. */
function commit(next: User | null): void {
  user = next;
  persist();
  emit();
}

/**
 * Sign in. The mock takes no credentials: `handle` exists so T-30 can pass the real account
 * through unchanged, and the default is the fixture owner.
 *
 * Already signed in as that handle is a no-op, so a restored session costs no notification.
 */
export function signIn(handle: Handle = MOCK_USER.handle): void {
  if (user?.handle === handle) return;
  commit(handle === MOCK_USER.handle ? { ...MOCK_USER } : { ...MOCK_USER, handle });
}

/** Sign out. The signed-out states belong to the pages; this only removes the account. */
export function signOut(): void {
  if (user === null) return;
  commit(null);
}

/**
 * Replace the signed-in account's own handle and display name — the one write onboarding needs.
 *
 * Without this, `signIn()` fabrics the display name (`MOCK_USER.displayName`), so a name claimed at
 * `/onboarding` would survive in the adapter and vanish from every screen. It emits like `signIn`,
 * so the profile tab, `/dev/state` and the NSFW store (which re-reads its pair per handle) all
 * follow the new account rather than the old one.
 *
 * Signed out there is no account to rename, so it does nothing: a profile write cannot create a
 * session. T-30 replaces both this and `signIn` with the Supabase row; the signature is the seam.
 */
export function setAccount(patch: { handle: Handle; displayName: string }): void {
  if (user === null) return;
  if (user.handle === patch.handle && user.displayName === patch.displayName) return;
  commit({ ...user, handle: patch.handle, displayName: patch.displayName });
}

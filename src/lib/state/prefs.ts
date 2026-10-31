/**
 * NSFW preference — the viewer's own two flags (`src/specs/systems/nsfw.md`).
 *
 * Same subscribe/notify shape as `session.ts`, `router.ts` and `toast.ts`, and for the same
 * reason: a module-scope `track()` has no owning block and every write to it throws. Pages mirror
 * this store into their own `track()`; nothing here is reactive.
 *
 * What this module guarantees, so no page has to:
 * - the pair is **per account**, not per device: it lives in the adapter keyed by handle, and the
 *   store re-reads it on every sign-in/sign-out, clearing to off first so one account's Show flag
 *   can never survive into another's;
 * - signed out it answers `{ show: false, blur: false }` and refuses to write a preference; the
 *   signed-out visitor's *Show NSFW content* answer is kept as one **pending intent** here
 *   (`requestShowNsfw`) and applied the moment there is an account to hold it, so
 *   `/authentification`'s single action is a real action and never a page-local boolean;
 * - the two flags stay **independent**: Show off with Blur on is allowed, and blur simply has
 *   nothing to act on. Coupling them here would be a rule the spec does not have.
 *
 * It is not access control: no route is blocked, nothing is hidden here. Listings ask this store
 * what the account wants and draw accordingly.
 */
import type { AccountPreferences, Handle } from "../data/types.ts";
import { resolveRepo } from "../data/repo.ts";
import { currentUser, onSession } from "./session.ts";

const repo = resolveRepo();

const OFF: AccountPreferences = { show: false, blur: false };

let state: AccountPreferences = { ...OFF };
/** How many times the store has notified — the `/dev/state` evidence that it is wired. */
let notified = 0;
const listeners = new Set<(next: AccountPreferences) => void>();

/** The account's pair. A snapshot read, not a subscription. */
export function nsfwPreference(): AccountPreferences {
  return state;
}

/** Notifications emitted so far. Rises on every real change, never on a no-op write. */
export function prefsNotifications(): number {
  return notified;
}

/** Subscribe. Returns an unsubscribe function. */
export function onPrefs(listener: (next: AccountPreferences) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replace the pair, notifying only when it actually changed. */
function set(next: AccountPreferences): void {
  if (next.show === state.show && next.blur === state.blur) return;
  state = { show: next.show, blur: next.blur };
  notified += 1;
  for (const listener of listeners) listener(state);
}

/**
 * Read the account's pair from the adapter. Signed out, or when the adapter fails, both flags are
 * off — never a remembered value from whoever was here before.
 */
export function reloadPreferences(): Promise<void> {
  const user = currentUser();
  if (!user) {
    set(OFF);
    return Promise.resolve();
  }

  const handle: Handle = user.handle;
  // Clear before asking: the previous account's Show flag must not render, even for the microtask
  // the adapter takes to answer.
  set(OFF);

  return repo.getPreferences(handle).then(
    (next) => {
      // The account may have changed while the adapter was answering: never apply a stale pair.
      if (currentUser()?.handle !== handle) return;
      set({ show: next.show, blur: next.blur });
    },
    () => {
      if (currentUser()?.handle !== handle) return;
      set(OFF);
    },
  );
}

/** One write: optimistic locally, then the adapter's answer becomes the truth. */
function write(patch: Partial<AccountPreferences>): void {
  const user = currentUser();
  if (!user) {
    // No account to hold a setting: stay off. Signing in from here is a page decision (T-25).
    set(OFF);
    return;
  }

  const handle: Handle = user.handle;
  set({ ...state, ...patch });

  void repo.savePreferences(handle, patch).then(
    (next) => {
      if (currentUser()?.handle !== handle) return;
      set({ show: next.show, blur: next.blur });
    },
    () => {
      // The memory adapter cannot fail; the Supabase one will, and a failed write must not leave
      // the UI claiming a preference the account does not hold.
      if (currentUser()?.handle !== handle) return;
      set(OFF);
    },
  );
}

export function setShowNsfw(show: boolean): void {
  write({ show });
}

export function setBlurNsfw(blur: boolean): void {
  write({ blur });
}

/**
 * The signed-out visitor's *Show NSFW content* answer, held for the account they sign in with.
 *
 * `systems/nsfw.md` → Rules: signed out there is one control rather than the pair, and signing in
 * follows the ordinary outcome. There is no account to write to yet, so the answer waits here —
 * it is **not** a preference (the store still answers off), it is one intent, it is never written
 * to the adapter while signed out, and it is dropped by a sign-out so it cannot leak into the next
 * account. `null` means the visitor has not answered.
 */
let pendingShow: boolean | null = null;

/** What the signed-out control should read: the held intent, else the account's Show flag. */
export function showRequested(): boolean {
  return pendingShow ?? state.show;
}

/**
 * One action from either side of the sign-in: signed in it is the preference's own write, signed
 * out it records the intent that {@link applyPendingIntent} carries into the new account.
 */
export function requestShowNsfw(show: boolean): void {
  if (currentUser()) {
    setShowNsfw(show);
    pendingShow = null;
    return;
  }
  pendingShow = show;
}

/** Spend the held intent once an account exists. Called on every session change. */
function applyPendingIntent(): void {
  const wanted = pendingShow;
  pendingShow = null;
  if (wanted === null) return;
  if (!currentUser()) return;
  setShowNsfw(wanted);
}

// Per account means per sign-in: whoever just arrived re-reads their own pair, and a sign-out
// clears to off (`systems/nsfw.md` → Signed out). A held intent is spent after that re-read, so
// the account's own row is what gets the write rather than the pair being overwritten by it.
onSession(() => {
  pendingShow = currentUser() ? pendingShow : null;
  void reloadPreferences().then(applyPendingIntent);
});

// Seed from whoever the session says is here — signed in at boot, so the fixture owner's pair.
void reloadPreferences();

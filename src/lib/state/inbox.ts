/**
 * The unread notification **row** count — what the shell's badge draws
 * (`src/specs/pages/notifications.md` → *Badge*).
 *
 * Same subscribe/notify shape as `session.ts` and `prefs.ts`, and for the same reason: a
 * module-scope `track()` has no owning block, so `App.tsrx` mirrors this store into its own
 * `track()` and the badge is a render of that signal.
 *
 * What this module guarantees, so neither the shell nor the page has to:
 * - the number comes **from the adapter** (`unreadNotificationCount()`), never from a list a page
 *   happens to hold and never from a page-local flag — the rule `myVote` and `isBookmarked` follow;
 * - it counts **rows**, not events: an aggregated row carrying `count: 4` is one unread row, which
 *   is the whole point of the badge (`...it counts unread notification rows, not underlying events`);
 * - it **never increments on its own**: there is no `+1` anywhere. Opening a row marks it read in the
 *   adapter and then asks again; nothing notifies, animates or toasts on mount (`Nothing notifies on
 *   mount`);
 * - signing out clears it, signing in re-reads it, and a failed read answers `0` rather than a
 *   remembered number from whoever was here before.
 */
import { resolveRepo } from "../data/repo.ts";
import { currentUser, onSession } from "./session.ts";

const repo = resolveRepo();

let state = 0;
/** How many times the store has notified — `/dev/state`'s evidence that a store is wired. */
let notified = 0;
const listeners = new Set<(next: number) => void>();

/** The unread row count. A snapshot read, not a subscription. */
export function unreadCount(): number {
  return state;
}

/** Notifications emitted so far. Rises on every real change, never on a no-op refresh. */
export function inboxNotifications(): number {
  return notified;
}

/** Subscribe. Returns an unsubscribe function. */
export function onInbox(listener: (next: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replace the count, notifying only when it actually changed (a refresh that answers the same
 * number is not an event, and the badge must not flicker for one). */
function set(next: number): void {
  const safe = Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : 0;
  if (safe === state) return;
  state = safe;
  notified += 1;
  for (const listener of listeners) listener(state);
}

/**
 * Ask the adapter for the unread row count. Signed out (or when the adapter fails) the answer is
 * `0`: the badge is hidden, not remembered.
 */
export function refreshInbox(): Promise<void> {
  if (!currentUser()) {
    set(0);
    return Promise.resolve();
  }

  return repo.unreadNotificationCount().then(
    (next) => {
      set(next);
    },
    () => {
      set(0);
    },
  );
}

// Per account means per sign-in: whoever just arrived re-reads their own inbox, and a sign-out
// clears the badge instead of leaving the previous account's number in the shell.
onSession(() => {
  void refreshInbox();
});

// Seed for the session the app booted with.
void refreshInbox();

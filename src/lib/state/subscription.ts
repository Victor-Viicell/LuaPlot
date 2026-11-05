/**
 * The account's subscription plan (`src/specs/pages/subscription.md`).
 *
 * Same subscribe/notify shape as `session.ts`, `prefs.ts` and `router.ts`, and for the same reason:
 * a module-scope `track()` has no owning block and every write to it throws. The subscription page
 * mirrors this store into its own `track()`.
 *
 * It is deliberately tiny. The page needs exactly one fact — is this account on a paid plan? — to
 * decide which of its two tabs opens, and the preview has no payment provider behind it. The plan is
 * kept in `localStorage` under one key so upgrading survives a restart; a corrupt, stale or
 * hand-edited value falls back to `free` silently, the rule `session.ts` already follows.
 */
import type { SubscriptionPlan } from "../data/types.ts";
import { SUBSCRIPTION_KEY, storedSubscriptionSchema } from "../schema.ts";

/** The `localStorage` this module keeps the plan in, or `null` when the host has none. */
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function restore(): SubscriptionPlan {
  const store = storage();
  if (store === null) return "free";
  const raw = store.getItem(SUBSCRIPTION_KEY);
  if (raw === null) return "free";
  const parsed = storedSubscriptionSchema.safeParse(raw);
  return parsed.success ? parsed.data : "free";
}

let plan: SubscriptionPlan = restore();
/** How many times the store has notified — the evidence a page is wired, as in `session.ts`. */
let notified = 0;
const listeners = new Set<(next: SubscriptionPlan) => void>();

/** The account's plan. A snapshot read, not a subscription. */
export function subscriptionPlan(): SubscriptionPlan {
  return plan;
}

/** The one predicate the page needs: a paid plan opens on Billing. */
export function isSubscribed(): boolean {
  return plan !== "free";
}

/** Notifications emitted so far. Rises only when the plan actually changes. */
export function subscriptionNotifications(): number {
  return notified;
}

/** Subscribe. Returns an unsubscribe function. */
export function onSubscription(listener: (next: SubscriptionPlan) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Write the plan once: storage is a convenience, the live value is the truth. */
export function setSubscriptionPlan(next: SubscriptionPlan): void {
  if (next === plan) return;
  plan = next;

  const store = storage();
  if (store !== null) {
    try {
      store.setItem(SUBSCRIPTION_KEY, plan);
    } catch {
      /* storage full or locked down: this session still holds the plan */
    }
  }

  notified += 1;
  for (const listener of listeners) listener(plan);
}

/** The Plan tab's one action in the preview. */
export function subscribeToPro(): void {
  setSubscriptionPlan("pro");
}

/** Billing's one action: fall back to free, which moves the default tab back to Plan. */
export function cancelSubscription(): void {
  setSubscriptionPlan("free");
}

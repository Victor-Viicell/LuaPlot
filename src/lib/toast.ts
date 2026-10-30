/**
 * Toast queue: a plain subscribe/notify store, deliberately not a tracked value.
 *
 * `track()` must be created inside a component — a module-scope tracked has no
 * owning block and every write throws. So this module keeps plain arrays and
 * notifies, exactly like `src/router.ts`, and `ToastHost` mirrors it into a
 * component-scoped `track()`.
 *
 * One host is mounted in `App.tsrx`; any module may call `toast(message)`.
 * Placement, decided in T-02: bottom, above the tab bar; 120ms, no bounce;
 * polite live region; three toasts visible at most.
 */

export type ToastItem = { id: number; message: string };

const LIFETIME_MS = 3400;
const MAX_VISIBLE = 3;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

/** Current queue, as a plain array. Reads are a snapshot, not a subscription. */
export function toastItems(): ToastItem[] {
  return items;
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function onToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

/** Show a message. The newest three stay; older ones fall off the top. */
export function toast(message: string): void {
  const id = (seq += 1);
  const next = [...items, { id, message }];
  while (next.length > MAX_VISIBLE) {
    const dropped = next.shift();
    if (dropped) {
      const timer = timers.get(dropped.id);
      if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(dropped.id);
      }
    }
  }
  items = next;
  emit();
  timers.set(
    id,
    setTimeout(() => dismissToast(id), LIFETIME_MS),
  );
}

import { Portal, track } from "ripple";
import { dismissToast, onToasts, toastItems, type ToastItem } from "../lib/toast.ts";
import { IconClose } from "./Icons.tsrx";

/**
 * Toast host. Mount once, in `App.tsrx`; call `toast(message)` from anywhere.
 * The queue lives in `src/lib/toast.ts` as a plain store, mirrored here into a
 * component-scoped `track()` (a module-scope tracked would throw on write).
 * Polite live region, bottom placement above the tab bar, no shadow.
 */
export function ToastHost() @{
  const items = track<ToastItem[]>(toastItems());
  onToasts(() => {
    items.value = toastItems();
  });

  <>
    <Portal target={document.body}>
      <div class="toasts" role="status" aria-live="polite">
        @for (const item of items.value; key item.id) {
          <div class="toast">
            <span class="toast-msg">{item.message}</span>
            <button
              class="toast-close"
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissToast(item.id)}
            >
              <IconClose />
            </button>
          </div>
        }
      </div>
    </Portal>
  </>
}

import { Portal, type Children } from "ripple";
import { IconClose } from "./Icons.tsrx";

/**
 * Sheet: the bottom sheet on mobile, a centred dialog from `md` (900).
 * Rendered only while open — the caller mounts it inside `@if`, so there is no
 * `open` prop and no exit animation to coordinate.
 *
 * - `Portal` to `document.body`: the shell's outlet scrolls and clips, a sheet must not.
 * - Escape closes, focus is trapped inside the panel, and focus starts on the panel.
 * - The scrim is `rgb(0 0 0 / .35)`; the panel carries the one sanctioned shadow.
 * - z-index: scrim 40, panel 41, toast 60 (see docs/DESIGN.md).
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  title,
  onClose,
  children,
  label,
}: {
  title: string;
  onClose: () => void;
  children?: Children;
  /** Accessible name when the visible title is not the whole name. */
  label?: string;
}) @{
  let panel: HTMLDivElement | undefined;

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel) return;

    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }

    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setPanel(element: HTMLDivElement) {
    panel = element;
    // The ref runs before the portal has inserted the panel, so focus is deferred until the
    // element is actually in the document — a detached `focus()` silently does nothing.
    let tries = 0;
    const take = () => {
      tries += 1;
      if (!element.isConnected && tries < 20) {
        setTimeout(take, 8);
        return;
      }
      element.focus();
      if (document.activeElement !== element) {
        element.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      }
    };
    setTimeout(take, 0);
  }

  <>
    <Portal target={document.body}>
      <div class="sheet-scrim" onClick={onClose}></div>
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        tabindex="-1"
        ref={setPanel}
        onKeyDown={onKeyDown}
      >
        <div class="sheet-head">
          <h2 class="sheet-title">{title}</h2>
          <button class="sheet-close" type="button" aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </Portal>
  </>
}

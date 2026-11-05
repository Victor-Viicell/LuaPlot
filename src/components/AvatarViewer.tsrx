import { Portal, track } from "ripple";
import { Avatar } from "./Avatar.tsrx";
import { IconClose } from "./Icons.tsrx";

/**
 * AvatarViewer: the square avatar, opened.
 *
 * A card image and a profile portrait are both a 1:1 box; pressing one opens this dialog so the
 * initials (and, when uploads exist, the picture) can be read at size. Zoom is part of the viewer,
 * not the box: the mouse wheel scales around the centre, a two-finger pinch does the same on touch,
 * one finger or the mouse pans once zoomed, and a double-click resets.
 *
 * The gesture math is imperative (`ref`, `addEventListener`) rather than JSX props: Ripple's event
 * map has no pointer events, and a `wheel` listener that calls `preventDefault()` must be attached
 * non-passive. The listeners live on the panel, so they leave with it.
 *
 * It is a dialog like `Sheet` (same scrim and layer ladder: scrim 40, panel 41, toast 60), but it
 * owns no header and no focus trap — a viewer has one control, Close, and Escape does the same.
 */

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function AvatarViewer({
  initials,
  label,
  onClose,
}: {
  initials: string;
  /** The item's or account's name; the dialog is named after it. */
  label: string;
  onClose: () => void;
}) {
  const scale = track(1);
  const x = track(0);
  const y = track(0);

  const points = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; scale: number } | null = null;
  let drag: { x: number; y: number; x0: number; y0: number } | null = null;

  function distance(): number {
    const [a, b] = [...points.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Back to the centre as soon as the image is at 1:1 again. */
  function settle(): void {
    if (scale.value <= MIN_SCALE + 0.001) {
      x.value = 0;
      y.value = 0;
    }
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    scale.value = clampScale(scale.value * Math.exp(-event.deltaY * 0.0015));
    settle();
  }

  function onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) {
      drag = null;
      pinch = { distance: distance(), scale: scale.value };
    } else if (points.size === 1 && scale.value > MIN_SCALE) {
      drag = { x: event.clientX, y: event.clientY, x0: x.value, y0: y.value };
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (points.size === 2 && pinch) {
      const ratio = pinch.distance === 0 ? 1 : distance() / pinch.distance;
      scale.value = clampScale(pinch.scale * ratio);
      settle();
      return;
    }

    if (points.size === 1 && drag) {
      x.value = drag.x0 + (event.clientX - drag.x);
      y.value = drag.y0 + (event.clientY - drag.y);
    }
  }

  function onPointerUp(event: PointerEvent): void {
    points.delete(event.pointerId);
    if (points.size < 2) pinch = null;
    if (points.size === 0) {
      drag = null;
      return;
    }
    const [only] = [...points.values()];
    drag = { x: only.x, y: only.y, x0: x.value, y0: y.value };
  }

  function reset(): void {
    scale.value = 1;
    x.value = 0;
    y.value = 0;
  }

  function setPanel(element: HTMLDivElement): void {
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);

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
    };
    setTimeout(take, 0);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <>
      <Portal target={document.body}>
        <div class="avatar-viewer-scrim" onClick={onClose}>
          <div
            class="avatar-viewer"
            role="dialog"
            aria-modal="true"
            aria-label={`${label} avatar`}
            tabindex="-1"
            ref={setPanel}
            onClick={(event) => event.stopPropagation()}
            onDblClick={reset}
            onKeyDown={onKeyDown}
          >
            <div
              class="avatar-viewer-stage"
              style={{
                transform: `translate(${x.value}px, ${y.value}px) scale(${scale.value})`,
              }}
            >
              <Avatar initials={initials} size="hero" />
            </div>

            <p class="avatar-viewer-hint">Scroll or pinch to zoom</p>

            <button
              class="avatar-viewer-close"
              type="button"
              aria-label="Close avatar"
              onClick={onClose}
            >
              <IconClose />
            </button>
          </div>
        </div>
      </Portal>
    </>
  );
}

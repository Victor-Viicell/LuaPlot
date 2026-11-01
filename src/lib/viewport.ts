/**
 * The on-screen keyboard, as one CSS token (T-36a).
 *
 * A phone's keyboard does not shrink the **layout** viewport — `window.innerHeight` stays exactly
 * where it was, which is why nothing in CSS can see the keyboard and why a docked composer sits
 * under it. What does shrink is `window.visualViewport`: its `height` is the part of the page still
 * on screen, and its `offsetTop` is how far the page has been scrolled under the top of that window
 * when the browser pans to keep a field visible. Their difference against `innerHeight` is the only
 * honest reading of the keyboard, so it is measured here and written once as `--keyboard-inset`,
 * which `pages/session-detail.tsrx`'s `.dock` already reads in its `padding-bottom`.
 *
 * Three rules this file exists to keep:
 *
 * 1. **One writer per document.** The token is a document property (`documentElement`), not a
 *    page's, so it is installed once by the shell (`App.tsrx`). Two writers on one page fight over
 *    the last frame, and the loser is whichever surface paints second.
 * 2. **`resize` on `visualViewport`, not on `window`.** The keyboard fires its own `resize` on the
 *    visual viewport; a `window` listener never sees it. `scroll` is subscribed too, because a
 *    browser that pans instead of resizing reports the same keyboard through `offsetTop`.
 * 3. **Coalesce with `requestAnimationFrame`.** `resize` fires in bursts while the keyboard
 *    animates in; one write per frame keeps the dock attached to it. A `setTimeout` debounce would
 *    make the dock visibly lag the keyboard by the debounce, which is the bug we are fixing.
 */

/** The token the docked surfaces read; the CSS fallback is `0px`, so a missing writer is honest. */
const TOKEN = "--keyboard-inset";

/**
 * 400px is the cap. A pinch-zoom (or a rotated tablet) can report a `visualViewport` a couple of
 * thousand pixels shorter than `innerHeight`, and a nonsense inset would push the composer off the
 * page entirely. No keyboard is taller than 400 CSS px on a phone.
 */
const MAX_INSET = 400;

/**
 * Install the writer and return its teardown.
 *
 * No `window.visualViewport` (an old WebView, a non-browser build) is not a failure: the token is
 * written as `0px` once and nothing subscribes, which is exactly the value the CSS fallback already
 * assumes. Returning the teardown rather than leaking the listener keeps the "one writer" rule
 * enforceable by whatever mounts the shell.
 */
export function installKeyboardInset(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const root = document.documentElement;
  const viewport = window.visualViewport;
  if (!viewport) {
    root.style.setProperty(TOKEN, "0px");
    return () => root.style.removeProperty(TOKEN);
  }

  let frame = 0;

  const write = (): void => {
    frame = 0;
    // Clamp both ways: a URL bar collapsing makes the visual viewport *taller* than `innerHeight`
    // (a negative inset, which CSS would read as a negative padding), and a pinch-zoom makes it
    // absurdly shorter. Neither is a keyboard.
    const raw = window.innerHeight - viewport.height - viewport.offsetTop;
    const inset = Math.max(0, Math.min(MAX_INSET, Math.round(raw)));
    root.style.setProperty(TOKEN, `${inset}px`);
  };

  const schedule = (): void => {
    if (frame) return;
    frame = window.requestAnimationFrame(write);
  };

  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
  // The first frame is written eagerly: a page can open with the keyboard already up (a focused
  // field on load), and waiting for the next `resize` would leave that composer under the keyboard.
  write();

  return () => {
    viewport.removeEventListener("resize", schedule);
    viewport.removeEventListener("scroll", schedule);
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    root.style.removeProperty(TOKEN);
  };
}

import { track } from "ripple";
import { Sheet } from "./Sheet.tsrx";

/**
 * Excerpt: a clamped piece of text that opens in full on press.
 *
 * Cards and the profile head must not let a long tagline or bio set the height of the surface that
 * lists them, so the box clips at three lines with an ellipsis. The text stays in the DOM in full —
 * screen readers and find-in-page still see it — and pressing the box opens the same text in
 * `Sheet`, which owns Escape, the focus trap and the scrim.
 *
 * It is a `<button>` because it is an action, not a paragraph. The caller hands in the typography
 * class (`.card-tagline`, `.bio`); `.excerpt` only owns the reset and the clamp.
 */
export function Excerpt({
  text,
  title,
  class: className,
}: {
  text: string;
  /** The dialog's heading: the item's name or the account's name. */
  title: string;
  /** The typography the excerpt wears. */
  class?: string;
}) {
  const open = track(false);

  return (
    <>
      <button
        type="button"
        class={className ? `excerpt ${className}` : "excerpt"}
        aria-haspopup="dialog"
        onClick={() => (open.value = true)}
      >
        {text}
      </button>
      @if (open.value) {
        <Sheet title={title} onClose={() => (open.value = false)}>
          <p class="excerpt-full">{text}</p>
        </Sheet>
      }
    </>
  );
}

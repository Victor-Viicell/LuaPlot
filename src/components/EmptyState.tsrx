import { Button } from "./Button.tsrx";
import { follow, href } from "../router.ts";

/**
 * Empty state: one line of copy and the primary action (docs/DESIGN.md "States").
 * No illustration, no second paragraph, no centred text.
 *
 * The link action takes the **app path** (`to`), not a finished href: this component owns the pair
 * `href(to)` + `onClick={follow(to)}`, so a press is a push and the running app survives it (T-46).
 * Handing it `href("/x")` would leave a bare anchor and re-boot the app; passing an href into
 * `follow()` doubles the base — `docs/ARCHITECTURE.md` → Router.
 */
export function EmptyState({
  message,
  actionLabel,
  onAction,
  to,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** App path, no base, when the action is a link to another route instead of a handler. */
  to?: string;
}) {
  return (
    <div class="empty">
      <p class="empty-copy">{message}</p>
      @if (actionLabel && to) {
        <a class="btn btn-primary" href={href(to)} onClick={follow(to)}>{actionLabel}</a>
      } @else if (actionLabel) {
        <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
      }
    </div>
  );
}

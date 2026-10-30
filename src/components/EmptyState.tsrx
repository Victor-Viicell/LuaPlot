import { Button } from "./Button.tsrx";

/**
 * Empty state: one line of copy and the primary action (docs/DESIGN.md "States").
 * No illustration, no second paragraph, no centred text.
 */
export function EmptyState({
  message,
  actionLabel,
  onAction,
  href,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** When the action is a link (an entry point to another route) instead of a handler. */
  href?: string;
}) {
  return (
    <div class="empty">
      <p class="empty-copy">{message}</p>
      @if (actionLabel && href) {
        <a class="btn btn-primary" href={href}>{actionLabel}</a>
      } @else if (actionLabel) {
        <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
      }
    </div>
  );
}

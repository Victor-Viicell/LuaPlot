/**
 * Skeleton: `lines` for text blocks, `block` for an image or a card's middle.
 * It stands in for the real layout, so match its shape where it is used — never
 * a spinner. `aria-hidden`: the surface carries `aria-busy` instead.
 */
export function Skeleton({
  variant = "lines",
  lines = 3,
  height = 120,
  lineHeight = 14,
}: {
  variant?: "lines" | "block";
  lines?: number;
  /** Block variant height, px. */
  height?: number;
  /** Line variant height, px. */
  lineHeight?: number;
}) @{
  const count = Math.max(1, Math.round(lines));

  @if (variant === "block") {
    <div class="skeleton-block" style={{ height: `${height}px` }} aria-hidden="true"></div>
  } @else {
    <div class="skeleton" aria-hidden="true">
      @for (const row of Array.from({ length: count }, (_, index) => index); key row) {
        <div
          class={row === count - 1 && count > 1 ? "skeleton-line is-last" : "skeleton-line"}
          style={{ height: `${lineHeight}px` }}
        ></div>
      }
    </div>
  }
}

/**
 * Avatar: square, 2px radius, 1px border, initials fallback.
 * No image set exists yet — every item carries one later, initials stand in until it does.
 *
 * `size` is a pixel box, `"fluid"`, or `"hero"`. The two named variants emit **no** inline size and
 * let `src/styles.css` own the box, because both follow their container: `"fluid"` is a card
 * thumbnail (a third of the card, square), `"hero"` is the cover on a character, lorebook or preset
 * page (**full width of its column, 1:1**), which no constant could express.
 */
export function Avatar({
  initials,
  label,
  size = 40,
}: {
  /** One or two characters. */
  initials: string;
  /** Accessible name; when absent the avatar is decorative. */
  label?: string;
  size?: number | "fluid" | "hero";
}) {
  const variant = size === "fluid" ? " is-fluid" : size === "hero" ? " is-hero" : "";

  return (
    <span
      class={`avatar${variant}`}
      style={typeof size === "number" ? { width: `${size}px`, height: `${size}px` } : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      {initials}
    </span>
  );
}

/**
 * Avatar: square, 2px radius, 1px border, initials fallback.
 * No image set exists yet — every item carries one later, initials stand in until it does.
 *
 * `size` is either a pixel box or `"fluid"`: a catalog card wants a thumbnail measured against its
 * own width (a third of it, square), which is a stylesheet's job, not a prop's — so `"fluid"` emits
 * no inline size and lets `.card-veil .avatar.is-fluid` in `src/styles.css` size it.
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
  size?: number | "fluid";
}) {
  const fluid = size === "fluid";

  return (
    <span
      class={fluid ? "avatar is-fluid" : "avatar"}
      style={fluid ? undefined : { width: `${size}px`, height: `${size}px` }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      {initials}
    </span>
  );
}

/**
 * Avatar: square, 2px radius, 1px border, initials fallback.
 * No image set exists yet — every item carries one later, initials stand in until it does.
 * The size is a plain inline dimension; everything else is `.avatar` in `src/styles.css`.
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
  size?: number;
}) {
  return (
    <span
      class="avatar"
      style={{ width: `${size}px`, height: `${size}px` }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      {initials}
    </span>
  );
}

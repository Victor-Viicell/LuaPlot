import type { Children } from "ripple";

/**
 * Button. Four variants, one height (44), radius 2, 14px label.
 * The look lives in `src/styles.css` (`.btn`); a page may style `.btn` it does not own.
 * Focus ring comes from the base `:focus-visible` rule — never add a second one.
 *
 * primary   the one action on a screen (accent fill)
 * secondary default: 1px outline
 * ghost     in-row actions, no border
 * danger    destructive only
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  type = "button",
  disabled = false,
  block = false,
  label,
  onClick,
  children,
}: {
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  /** Full-width, for a form's submit on mobile. */
  block?: boolean;
  /** Accessible name when the visible label is an icon or is missing. */
  label?: string;
  onClick?: (event: MouseEvent) => void;
  children?: Children;
}) {
  const classes = ["btn", `btn-${variant}`];
  if (block) classes.push("btn-block");

  return (
    <button
      class={classes.join(" ")}
      type={type}
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

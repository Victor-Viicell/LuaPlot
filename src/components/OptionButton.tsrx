import type { Children, JSX } from "ripple";

type OptionButtonProps = {
  label: string;
  onClick?: JSX.IntrinsicElements["button"]["onClick"];
  children?: Children;
};

export function OptionButton({ label, onClick, children }: OptionButtonProps) @{
  <>
    <style>
      .option-button {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        width: var(--option-button-size, 56px);
        height: var(--option-button-size, 56px);
        padding: 0;
        color: var(--color-text-muted);
        background-color: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 7px;
        cursor: pointer;
        transition:
          color 120ms ease,
          background-color 120ms ease,
          border-color 120ms ease;
      }

      .option-button:hover {
        color: var(--color-text);
        background-color: var(--color-surface-hover);
        border-color: var(--color-border-strong);
      }

      .option-button:active {
        color: var(--color-accent);
      }

      .option-button :global(svg) {
        display: block;
        width: 58%;
        height: 58%;
        pointer-events: none;
      }
    </style>
    <button
      type="button"
      class="option-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  </>
}

import { GameContext } from "../game/store";
import type { InterfaceCategory } from "../game/types";

export function OptionButton({ category }: { category: InterfaceCategory }) @{
  const game = GameContext.get();

  <>
    <button
      class={
        "option-button " +
        (game.activeInterface.value === category.id ? "active" : "")
      }
      style={{ "--accent": "var(" + category.accent + ")" }}
      title={category.label + " — " + category.tagline}
      aria-label={category.label}
      aria-pressed={game.activeInterface.value === category.id}
      onClick={() => game.setInterface(category.id)}
    >
      <span class="option-glyph">{category.glyph}</span>
      <span class="option-label">{category.label}</span>
    </button>

    <style>
      .option-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        width: var(--option-button-size, 56px);
        height: var(--option-button-size, 56px);
        flex: 0 0 var(--option-button-size, 56px);
        padding: 0;
        border: 1px solid var(--color-border);
        border-radius: 7px;
        background-color: var(--color-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        transition:
          color 140ms ease,
          border-color 140ms ease,
          background-color 140ms ease,
          transform 140ms ease;
      }

      .option-button:hover {
        border-color: var(--accent);
        background-color: var(--color-surface-hover);
        color: var(--accent);
        transform: translateY(-1px);
      }

      .option-button.active {
        border-color: var(--accent);
        color: var(--accent);
        box-shadow: inset 0 0 0 1px var(--accent);
      }

      .option-glyph {
        font-size: 19px;
        line-height: 1;
      }

      .option-label {
        font-size: 8px;
        line-height: 1;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
    </style>
  </>
}

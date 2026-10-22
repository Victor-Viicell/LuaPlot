import { THEMES } from "../game/data";
import { GameContext } from "../game/store";

export function SystemView() @{
  const game = GameContext.get();

  <>
    <div class="system-view">
      <section class="system-section">
        <h2 class="system-title">INTERFACE FLAVOR</h2>
        <p class="system-note">
          Catppuccin palettes. Mocha is the default; the rest are here for when
          the neon gets too loud.
        </p>
        <div class="theme-grid">
          @for (const option of THEMES; key option.id) {
            <button
              class={
                "theme-button " +
                (game.theme.value === option.id ? "active" : "")
              }
              onClick={() => game.setTheme(option.id)}
            >
              <span class={"theme-swatch " + option.id}></span>
              {option.label}
            </button>
          }
        </div>
      </section>

      <section class="system-section">
        <h2 class="system-title">LIFE CONTROL</h2>
        <p class="system-note">
          Starting a new life rerolls your identity, stats, and contacts. The
          city doesn't remember you.
        </p>
        <button
          class="danger-button"
          onClick={() => {
            if (confirm("Start a new life? Current progress will be lost.")) {
              game.reset();
            }
          }}
        >
          START A NEW LIFE
        </button>
      </section>

      <section class="system-section">
        <h2 class="system-title">SAVE / LOAD</h2>
        <p class="system-note">
          Manual save slots and autosave are planned for the persistence
          milestone. Nothing is written to disk yet.
        </p>
        <div class="disabled-row">
          <button class="ghost-button" disabled>
            SAVE
          </button>
          <button class="ghost-button" disabled>
            LOAD
          </button>
        </div>
      </section>

      <section class="system-section about">
        <h2 class="system-title">ABOUT</h2>
        <p class="system-note">
          NeonLife — a BitLife-style life sim in a cyberpunk sprawl. Built with
          Tauri, Vite, TypeScript, and Ripple.
        </p>
        <p class="build-tag">BUILD 0.1.0 · STREET LEVEL</p>
      </section>
    </div>

    <style>
      .system-view {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .system-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px 16px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
      }

      .system-title {
        margin: 0;
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.16em;
        color: var(--color-text-subtle);
      }

      .system-note {
        margin: 0;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .theme-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 8px;
        margin-top: 2px;
      }

      .theme-button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-sunken);
        color: var(--color-text-muted);
        font-size: 10px;
        cursor: pointer;
        text-align: left;
      }

      .theme-button:hover {
        border-color: var(--color-border-strong);
        color: var(--color-text);
      }

      .theme-button.active {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .theme-swatch {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        border-radius: 4px;
        border: 1px solid var(--color-border-strong);
      }

      .theme-swatch.mocha {
        background-color: #1e1e2e;
      }

      .theme-swatch.macchiato {
        background-color: #24273a;
      }

      .theme-swatch.frappe {
        background-color: #303446;
      }

      .theme-swatch.latte {
        background-color: #eff1f5;
      }

      .danger-button {
        align-self: flex-start;
        padding: 9px 14px;
        border: 1px solid var(--ctp-red);
        border-radius: 6px;
        background-color: transparent;
        color: var(--ctp-red);
        font-size: 9px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .danger-button:hover {
        background-color: var(--ctp-red);
        color: var(--ctp-crust);
      }

      .disabled-row {
        display: flex;
        gap: 8px;
      }

      .ghost-button {
        padding: 8px 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: transparent;
        color: var(--color-text-subtle);
        font-size: 9px;
        letter-spacing: 0.12em;
      }

      .build-tag {
        margin: 0;
        font-size: 8px;
        letter-spacing: 0.14em;
        color: var(--color-text-subtle);
      }
    </style>
  </>
}

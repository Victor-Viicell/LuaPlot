import { seasonName } from "../game/data";
import { GameContext } from "../game/store";

export function LogDialog() @{
  const game = GameContext.get();

  <>
    <section class="log-dialog" role="dialog" aria-label="Life log">
      <header class="log-header">
        <div class="log-heading">
          <span class="log-title">LIFE LOG</span>
          <span class="log-date">
            {"AGE " + game.player.age} ·{" "}
            {seasonName(game.clock.season).toUpperCase()} {game.clock.day}
            {" · " + game.clock.year}
          </span>
        </div>
        <button
          class="log-close"
          title="Close life log"
          onClick={() => game.toggleLog()}
        >
          ✕
        </button>
      </header>
      <div class="log-scroll">
        @for (const entry of game.log; key entry.id) {
          <p class={"log-entry " + entry.tone}>
            <span class="log-age">
              [{entry.age} · {entry.time}]
            </span>
            {entry.text}
          </p>
        }
        @if (game.log.length === 0) {
          <p class="log-empty">No signal. The city is waiting.</p>
        }
      </div>
    </section>

    <style>
      .log-dialog {
        position: absolute;
        bottom: 14px;
        left: 14px;
        z-index: 20;
        display: flex;
        width: min(430px, calc(100% - 28px));
        max-height: min(420px, calc(100% - 28px));
        flex-direction: column;
        border: 1px solid var(--color-border-strong);
        border-radius: 9px;
        background-color: rgba(17, 17, 27, 0.92);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        backdrop-filter: blur(6px);
      }

      .log-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 9px 12px;
        border-bottom: 1px solid var(--color-border);
        background-color: var(--color-bg-elevated);
      }

      .log-heading {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
      }

      .log-title {
        font-size: 9px;
        letter-spacing: 0.18em;
        color: var(--color-accent);
      }

      .log-date {
        font-size: 8px;
        letter-spacing: 0.08em;
        color: var(--color-text-subtle);
        white-space: nowrap;
      }

      .log-close {
        flex-shrink: 0;
        padding: 2px 7px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: transparent;
        color: var(--color-text-subtle);
        font-size: 9px;
        line-height: 1.4;
        cursor: pointer;
      }

      .log-close:hover {
        border-color: var(--ctp-red);
        color: var(--ctp-red);
      }

      .log-scroll {
        display: flex;
        flex: 1;
        min-height: 0;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        overflow-y: auto;
      }

      .log-entry {
        margin: 0;
        font-size: 11px;
        line-height: 1.6;
        color: var(--color-text-muted);
      }

      .log-entry.good {
        color: var(--ctp-green);
      }

      .log-entry.bad {
        color: var(--ctp-red);
      }

      .log-entry.event {
        color: var(--ctp-yellow);
      }

      .log-age {
        margin-right: 6px;
        color: var(--color-text-subtle);
        font-variant-numeric: tabular-nums;
      }

      .log-empty {
        margin: auto;
        font-size: 10px;
        color: var(--color-text-subtle);
      }
    </style>
  </>
}

import { STAT_LABELS } from "../game/data";
import { GameContext } from "../game/store";
import type { StatKey } from "../game/types";

export function StatBar({ stat }: { stat: StatKey }) @{
  const game = GameContext.get();

  <>
    <div class="stat-row" title={STAT_LABELS[stat]}>
      <span class="stat-label">{STAT_LABELS[stat]}</span>
      <span class="stat-track">
        <span
          class={"stat-fill " + stat}
          style={{ width: game.stats[stat] + "%" }}
        ></span>
      </span>
      <span class="stat-value">{Math.round(game.stats[stat])}</span>
    </div>

    <style>
      .stat-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-width: 0;
      }

      .stat-label {
        width: 64px;
        flex-shrink: 0;
        font-size: 9px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-subtle);
        white-space: nowrap;
      }

      .stat-track {
        display: block;
        flex: 1;
        min-width: 0;
        height: 4px;
        border-radius: 999px;
        background-color: var(--color-bg-sunken);
        overflow: hidden;
      }

      .stat-fill {
        display: block;
        height: 100%;
        border-radius: inherit;
        transition: width 220ms ease;
      }

      .stat-fill.health {
        background-color: var(--ctp-green);
      }

      .stat-fill.happiness {
        background-color: var(--ctp-yellow);
      }

      .stat-fill.energy {
        background-color: var(--ctp-sky);
      }

      .stat-fill.satiety {
        background-color: var(--ctp-peach);
      }

      .stat-fill.hygiene {
        background-color: var(--ctp-teal);
      }

      .stat-fill.smarts {
        background-color: var(--ctp-blue);
      }

      .stat-fill.looks {
        background-color: var(--ctp-pink);
      }

      .stat-fill.streetCred {
        background-color: var(--ctp-mauve);
      }

      .stat-value {
        width: 22px;
        flex-shrink: 0;
        text-align: right;
        font-size: 10px;
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
      }
    </style>
  </>
}

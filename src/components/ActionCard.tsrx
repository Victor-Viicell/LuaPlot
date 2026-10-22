import { track } from "ripple";
import {
  STAT_KEYS,
  STAT_LABELS,
  locationById,
  statDeltaOf,
} from "../game/data";
import {
  durationLabel,
  energyLabel,
  formatCredits,
  formatHourWindow,
} from "../game/format";
import { GameContext } from "../game/store";
import type { GameAction } from "../game/types";

function requirementLabel(action: GameAction): string | null {
  const requires = action.requires;
  if (!requires) {
    return null;
  }

  if (requires.employed) {
    return "JOB REQUIRED";
  }

  if (requires.stat !== undefined && requires.min !== undefined) {
    return `${STAT_LABELS[requires.stat].toUpperCase()} ${requires.min}+`;
  }

  if (requires.minWanted !== undefined) {
    return `HEAT ${requires.minWanted}+`;
  }

  if (requires.maxWanted !== undefined) {
    return `HEAT ≤ ${requires.maxWanted}`;
  }

  if (requires.credits !== undefined) {
    return `¥${formatCredits(requires.credits)}`;
  }

  if (requires.feature) {
    return `${requires.feature.toUpperCase()} AT HOME`;
  }

  return null;
}

function locationLabel(at: string[]): string {
  return at.map((id) => locationById(id).name).join(" / ");
}

export function ActionCard({
  action,
  remote,
}: {
  action: GameAction;
  remote: boolean;
}) @{
  const game = GameContext.get();
  const block = track(() => game.actionBlockReason(action));
  const where = track(() => (action.at ? locationLabel(action.at) : ""));

  <>
    <article class={"action-card " + (remote ? "remote" : "")}>
      <div class="action-main">
        <div class="action-head">
          <h3 class="action-name">{action.label}</h3>
          @if (remote) {
            <span class="action-remote">ELSEWHERE</span>
          }
        </div>
        <p class="action-description">{action.description}</p>
        <div class="tag-row">
          @if (action.cost) {
            <span class="tag cost">¥{formatCredits(action.cost)}</span>
          }
          @if (action.credits) {
            <span class="tag good">+¥{formatCredits(action.credits)}</span>
          }
          @if (action.time) {
            <span class="tag time">{durationLabel(action.time)}</span>
          }
          @if (action.oncePerYear) {
            <span class="tag once">ONCE / YEAR</span>
          }
          @if (action.energy) {
            <span class={"tag " + (action.energy > 0 ? "good" : "energy")}>
              {energyLabel(action.energy)}
            </span>
          }
          @for (const stat of STAT_KEYS; key stat) {
            @if (statDeltaOf(action.stats, stat) !== 0) {
              <span
                class={
                  "tag " +
                  (statDeltaOf(action.stats, stat) > 0 ? "good" : "bad")
                }
              >
                {STAT_LABELS[stat]}
                {statDeltaOf(action.stats, stat) > 0 ? " +" : " "}
                {statDeltaOf(action.stats, stat)}
              </span>
            }
          }
          @if (action.wanted) {
            <span class="tag heat">
              HEAT {action.wanted > 0 ? "+" : ""}
              {action.wanted}
            </span>
          }
          @if (action.at) {
            <span class="tag place">AT {where.value}</span>
          }
          @if (action.hours) {
            <span class="tag hours">{formatHourWindow(action.hours)}</span>
          }
          @if (requirementLabel(action)) {
            <span class="tag req">{requirementLabel(action)}</span>
          }
        </div>
      </div>
      <button
        class="action-run"
        disabled={block.value !== null}
        title={block.value ?? "Do it"}
        onClick={() => game.runAction(action)}
      >
        {block.value === null ? "RUN" : remote ? "NOT HERE" : "LOCKED"}
      </button>
    </article>

    <style>
      .action-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
        transition:
          border-color 140ms ease,
          background-color 140ms ease;
      }

      .action-card:hover {
        border-color: var(--color-border-strong);
        background-color: var(--color-surface-hover);
      }

      .action-card.remote {
        opacity: 0.68;
        border-style: dashed;
      }

      .action-card.remote:hover {
        opacity: 1;
      }

      .action-main {
        display: flex;
        flex-direction: column;
        gap: 5px;
        flex: 1;
        min-width: 0;
      }

      .action-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }

      .action-name {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text);
      }

      .action-remote {
        flex-shrink: 0;
        font-size: 7px;
        letter-spacing: 0.12em;
        color: var(--ctp-overlay-2);
      }

      .action-description {
        margin: 0;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 2px;
      }

      .tag {
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 8px;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
        background-color: var(--color-bg-sunken);
        white-space: nowrap;
      }

      .tag.good {
        color: var(--ctp-green);
        border-color: rgba(166, 227, 161, 0.3);
      }

      .tag.bad {
        color: var(--ctp-red);
        border-color: rgba(243, 139, 168, 0.3);
      }

      .tag.cost,
      .tag.energy {
        color: var(--ctp-yellow);
        border-color: rgba(249, 226, 175, 0.3);
      }

      .tag.time {
        color: var(--ctp-sky);
        border-color: rgba(137, 220, 235, 0.3);
      }

      .tag.once {
        color: var(--ctp-overlay-2);
      }

      .tag.heat {
        color: var(--ctp-maroon);
        border-color: rgba(235, 160, 172, 0.3);
      }

      .tag.req {
        color: var(--ctp-sky);
        border-color: rgba(137, 220, 235, 0.3);
      }

      .tag.place {
        color: var(--ctp-peach);
        border-color: rgba(250, 179, 135, 0.3);
      }

      .tag.hours {
        color: var(--ctp-lavender);
        border-color: rgba(180, 190, 254, 0.3);
      }

      .action-run {
        flex-shrink: 0;
        min-width: 66px;
        padding: 8px 12px;
        border: 1px solid var(--color-accent);
        border-radius: 6px;
        background-color: transparent;
        color: var(--color-accent);
        font-size: 9px;
        letter-spacing: 0.14em;
        cursor: pointer;
        transition:
          background-color 140ms ease,
          color 140ms ease;
      }

      .action-run:hover:not(:disabled) {
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
      }

      .action-run:disabled {
        opacity: 0.4;
        cursor: default;
      }
    </style>
  </>
}

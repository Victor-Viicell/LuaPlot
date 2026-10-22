import { track } from "ripple";
import {
  actionsAt,
  actionsFor,
  homeLocation,
  isOpenNow,
  locationById,
  propertyById,
} from "../game/data";
import { formatHourWindow } from "../game/format";
import { GameContext } from "../game/store";
import { ActionCard } from "./ActionCard.tsrx";

export function ActionList({ hereOnly }: { hereOnly: boolean }) @{
  const game = GameContext.get();
  const currentLocation = track(() =>
    game.location.value === "home"
      ? homeLocation(propertyById(game.home.value))
      : locationById(game.location.value),
  );
  const open = track(() =>
    isOpenNow(currentLocation.value, game.clock.secondOfDay),
  );
  const hereActions = track(() =>
    hereOnly
      ? actionsAt(game.location.value)
      : actionsFor(game.activeInterface.value).filter(
          (action) => !action.at || action.at.includes(game.location.value),
        ),
  );
  const elsewhereActions = track(() =>
    hereOnly
      ? []
      : actionsFor(game.activeInterface.value).filter(
          (action) => action.at && !action.at.includes(game.location.value),
        ),
  );

  <>
    <div class="action-list">
      @if (!hereOnly) {
        <section class="location-context">
          <div class="context-main">
            <span class="context-kicker">CURRENT POSITION</span>
            <strong class="context-name">
              {currentLocation.value.name} · {currentLocation.value.district}
            </strong>
          </div>
          <div class="context-side">
            <span class={"context-state " + (open.value ? "open" : "closed")}>
              {open.value ? "OPEN" : "CLOSED"}
            </span>
            @if (currentLocation.value.openHours) {
              <span class="context-hours">
                {formatHourWindow(currentLocation.value.openHours)}
              </span>
            }
            <button
              class="context-map"
              onClick={() => {
                game.setInterface(null);
                game.exitLocation();
              }}
            >
              MAP →
            </button>
          </div>
        </section>
      }

      @if (hereActions.value.length > 0) {
        <>
          <div
            class={"action-section-label " + (open.value ? "" : "closed-label")}
          >
            {open.value ? "AVAILABLE HERE" : "HERE — CLOSED"}
          </div>
          @for (const action of hereActions.value; key action.id) {
            <ActionCard {action} remote={false} />
          }
        </>
      }

      @if (elsewhereActions.value.length > 0) {
        <>
          <div class="action-section-label elsewhere-label">ELSEWHERE</div>
          @for (const action of elsewhereActions.value; key action.id) {
            <ActionCard {action} remote={true} />
          }
        </>
      }

      @if (
        hereActions.value.length === 0 &&
        elsewhereActions.value.length === 0
      ) {
        <p class="action-empty">Nothing available here yet.</p>
      }
    </div>

    <style>
      .action-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      }

      .location-context {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-bg-elevated);
      }

      .context-main {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .context-kicker {
        font-size: 7px;
        letter-spacing: 0.16em;
        color: var(--color-text-subtle);
      }

      .context-name {
        font-size: 11px;
        font-weight: 500;
        color: var(--color-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .context-side {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-shrink: 0;
      }

      .context-state {
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 8px;
        letter-spacing: 0.1em;
      }

      .context-state.open {
        color: var(--ctp-green);
        border-color: rgba(166, 227, 161, 0.35);
      }

      .context-state.closed {
        color: var(--ctp-red);
        border-color: rgba(243, 139, 168, 0.35);
      }

      .context-hours {
        font-size: 8px;
        color: var(--ctp-lavender);
        white-space: nowrap;
      }

      .context-map {
        padding: 5px 8px;
        border: 1px solid var(--ctp-sky);
        border-radius: 5px;
        background-color: transparent;
        color: var(--ctp-sky);
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.1em;
        cursor: pointer;
      }

      .context-map:hover {
        background-color: var(--ctp-sky);
        color: var(--ctp-crust);
      }

      .action-section-label {
        margin-top: 4px;
        font-size: 8px;
        letter-spacing: 0.18em;
        color: var(--ctp-green);
      }

      .elsewhere-label,
      .closed-label {
        color: var(--color-text-subtle);
      }

      .action-empty {
        margin: 0;
        padding: 18px;
        font-size: 11px;
        color: var(--color-text-subtle);
        text-align: center;
      }
    </style>
  </>
}

import { ClockBar } from "./ClockBar.tsrx";
import { InterfacePanel } from "./InterfacePanel.tsrx";
import { LocationView } from "./LocationView.tsrx";
import { LogDialog } from "./LogDialog.tsrx";
import { MapView } from "./MapView.tsrx";
import { OptionButton } from "./OptionButton.tsrx";
import { StatBar } from "./StatBar.tsrx";
import { LEFT_CATEGORIES, RIGHT_CATEGORIES, STAT_KEYS } from "../game/data";
import { formatCredits, initials } from "../game/format";
import { GameContext } from "../game/store";

export function MainContainer() @{
  const game = GameContext.get();

  <>
    <div class="main-container">
      <div class="inner-panel">
        <ClockBar />

        <div class="main-stage">
          @if (game.enteredLocation.value) {
            <LocationView />
          } @else {
            <MapView />
          }

          @if (game.activeInterface.value) {
            <>
              <div
                class="dialog-backdrop"
                onClick={() => game.setInterface(null)}
              ></div>
              <div
                class={
                  "dialog-frame " +
                  (game.activeInterface.value === "inventory" ? "compact" : "")
                }
              >
                <InterfacePanel />
              </div>
            </>
          }

          @if (game.logOpen.value) {
            <LogDialog />
          }
        </div>

        <div class="player-gui">
          <div class="portrait-and-left-options">
            <div class="portrait">
              <div class="portrait-inner">
                <span class="portrait-glyph">{initials(game.player.name)}</span>
                <span class="portrait-name">{game.player.name}</span>
                <span class="portrait-meta">{game.player.occupation}</span>
                <span class="portrait-tag">
                  {game.player.district + " // STREET LEVEL"}
                </span>
              </div>
            </div>
            <div class="left-options">
              @for (const category of LEFT_CATEGORIES; key category.id) {
                <OptionButton {category} />
              }
            </div>
          </div>

          <div class="stats-and-right-options">
            <div class="stats">
              <div class="stats-header">
                <span class="stats-title">CORE</span>
                <span class="stats-credits">
                  ¥{formatCredits(game.player.credits)}
                </span>
              </div>
              <div class="stats-list">
                @for (const stat of STAT_KEYS; key stat) {
                  <StatBar {stat} />
                }
              </div>
            </div>

            <div class="right-options">
              @for (const category of RIGHT_CATEGORIES; key category.id) {
                <OptionButton {category} />
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      .main-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-width: 0;
        margin: 0;
        padding: 10px;
        background-color: var(--color-bg);
      }

      .main-container .inner-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
        justify-content: stretch;
        background-color: var(--color-bg);
        overflow: hidden;
      }

      .main-stage {
        position: relative;
        display: flex;
        flex: 1;
        min-height: 0;
        width: 100%;
        border: 1px solid var(--color-border);
        border-radius: 9px;
        background-color: var(--color-bg-sunken);
        overflow: hidden;
      }

      .dialog-backdrop {
        position: absolute;
        inset: 0;
        z-index: 30;
        background-color: rgba(17, 17, 27, 0.58);
        backdrop-filter: blur(2px);
      }

      .dialog-frame {
        position: absolute;
        inset: 18px;
        z-index: 31;
        display: flex;
        min-height: 0;
        border-radius: 10px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
      }

      .dialog-frame > * {
        flex: 1;
        min-width: 0;
      }

      .dialog-frame.compact {
        inset: 48px 9%;
      }

      .player-gui {
        --player-gui-height: 400px;
        --player-gui-padding: 10px;
        --section-gap: 10px;
        --option-button-size: 56px;
        display: flex;
        gap: var(--section-gap);
        flex-direction: row;
        flex-shrink: 0;
        width: 100%;
        padding: var(--player-gui-padding);
        height: var(--player-gui-height);
        border: 1px solid var(--color-border);
        border-radius: 9px;
        background-color: var(--color-bg-elevated);
      }

      .portrait-and-left-options {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: calc(
          var(--player-gui-height) - (2 * var(--player-gui-padding)) -
            var(--option-button-size) - var(--section-gap)
        );
        flex-shrink: 0;
        gap: var(--section-gap);
      }

      .portrait {
        position: relative;
        display: flex;
        flex: 1;
        min-height: 0;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--color-border);
        border-radius: 7px;
        background:
          radial-gradient(
            circle at 70% 20%,
            rgba(203, 166, 247, 0.14),
            transparent 55%
          ),
          linear-gradient(160deg, var(--color-surface), var(--color-bg-sunken));
        overflow: hidden;
      }

      .portrait::after {
        content: "";
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent 0 3px,
          rgba(17, 17, 27, 0.2) 3px 4px
        );
        pointer-events: none;
      }

      .portrait-inner {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 12px;
        text-align: center;
      }

      .portrait-glyph {
        font-size: 42px;
        letter-spacing: 0.08em;
        color: var(--color-accent);
        text-shadow: 0 0 28px rgba(203, 166, 247, 0.35);
      }

      .portrait-name {
        font-size: 13px;
        color: var(--color-text);
      }

      .portrait-meta {
        font-size: 10px;
        color: var(--ctp-peach);
      }

      .portrait-tag {
        margin-top: 6px;
        font-size: 8px;
        letter-spacing: 0.14em;
        color: var(--color-text-subtle);
      }

      .left-options {
        display: flex;
        flex: 0 0 var(--option-button-size);
        width: 100%;
        flex-direction: row;
        justify-content: space-between;
      }

      .stats-and-right-options {
        display: flex;
        flex-direction: row;
        flex: 1;
        min-width: 0;
        height: 100%;
        gap: var(--section-gap);
      }

      .stats {
        display: flex;
        flex: 1;
        min-width: 0;
        height: 100%;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        border: 1px solid var(--color-border);
        border-radius: 7px;
        background-color: var(--color-surface);
      }

      .stats-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--color-border);
      }

      .stats-title {
        font-size: 9px;
        letter-spacing: 0.18em;
        color: var(--color-text-subtle);
      }

      .stats-credits {
        font-size: 11px;
        color: var(--ctp-teal);
        font-variant-numeric: tabular-nums;
      }

      .stats-list {
        display: flex;
        flex: 1;
        min-height: 0;
        flex-direction: column;
        justify-content: center;
        gap: 7px;
      }

      .right-options {
        display: flex;
        flex-direction: column;
        flex: 0 0 var(--option-button-size);
        height: 100%;
        justify-content: space-between;
      }
    </style>
  </>
}

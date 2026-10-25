import {
  BodyIcon,
  InventoryIcon,
  MapIcon,
  SettingsIcon,
} from "./OptionIcons.tsrx";
import { OptionButton } from "./OptionButton.tsrx";

export function MainContainer() @{
  <>
    <div class="main-container">
      <div class="main-panel">
        <div class="main-header">
          <div class="portrait">
            <div class="portrait-inner"></div>
          </div>
        </div>
        <div class="main-stage"></div>
        <div class="player-gui">
          <div class="options">
            <OptionButton label="Map">
              <MapIcon />
            </OptionButton>
            <OptionButton label="Inventory">
              <InventoryIcon />
            </OptionButton>
            <OptionButton label="Body">
              <BodyIcon />
            </OptionButton>
            <OptionButton label="Inventory">
              <InventoryIcon />
            </OptionButton>
            <OptionButton label="Settings">
              <SettingsIcon />
            </OptionButton>
          </div>
          <div class="stats"></div>
        </div>
      </div>
    </div>

    <style>
      .main-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 5px;
        background-color: var(--color-bg);
      }

      .main-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        gap: 5px;
      }

      .main-header {
        display: flex;
        flex-direction: row;
        height: 100px;
        width: 100%;
        padding: 5px;
        border: 1px solid var(--color-border);
        border-radius: 9px;
        background-color: var(--color-bg-elevated);
      }

      .main-stage {
        position: relative;
        display: flex;
        flex: 1;
        min-height: 0;
        height: 100%;
        width: 100%;
        border: 1px solid var(--color-border);
        border-radius: 9px;
        background-color: var(--color-bg-sunken);
        overflow: hidden;
      }

      .player-gui {
        --player-gui-height: 300px;
        --player-gui-padding: 5px;
        --section-gap: 5px;
        --option-button-size: 48px;
        display: flex;
        gap: var(--section-gap);
        flex-direction: row;
        width: 100%;
        padding: var(--player-gui-padding);
        height: var(--player-gui-height);
        border: 1px solid var(--color-border);
        border-radius: 9px;
        background-color: var(--color-bg-elevated);
      }

      .portrait {
        display: flex;
        height: 100%;
        aspect-ratio: 1;
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

      .stats {
        display: flex;
        flex: 1;
        height: 100%;
        width: 100%;
        flex-direction: column;
        gap: 5px;
        padding: 12px;
        border: 1px solid var(--color-border);
        border-radius: 7px;
        background-color: var(--color-surface);
      }

      .options {
        display: flex;
        flex-shrink: 0;
        flex-direction: column;
        align-items: center;
        height: 100%;
        gap: 5px;
      }
    </style>
  </>
}

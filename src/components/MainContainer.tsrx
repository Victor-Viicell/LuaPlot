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
            <div class="option-buttom">
              <div class="option-arrow">«</div>
              <div class="option-label">Inventory</div>
            </div>
            <div class="option-buttom">
              <div class="option-arrow">«</div>
              <div class="option-label">Inventory</div>
            </div>
            <div class="option-buttom">
              <div class="option-arrow">«</div>
              <div class="option-label">Inventory</div>
            </div>
            <div class="option-buttom">
              <div class="option-arrow">«</div>
              <div class="option-label">Inventory</div>
            </div>
            <div class="option-buttom">
              <div class="option-arrow">«</div>
              <div class="option-label">Inventory</div>
            </div>
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
        padding: 10px;
        background-color: var(--color-bg);
      }

      .main-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        gap: 10px;
      }

      .main-header {
        display: flex;
        flex-direction: row;
        height: 100px;
        width: 100%;
        padding: 10px;
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

      .options {
        display: flex;
        width: 100%;
        flex-direction: column;
        height: 100%;
        gap: 10px;
      }

      .option-buttom {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        height: 100%;
        background-color: var(--color-surface);
        gap: 10px;
        padding: 10px;
        padding-top: 5px;
        padding-bottom: 5px;
        border: 1px solid var(--color-border);
        border-radius: 7px;
      }
      .option-buttom:hover {
        background-color: var(--color-surface-hover);
        cursor: pointer;
      }
    </style>
  </>
}

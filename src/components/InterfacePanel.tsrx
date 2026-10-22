import { ActionList } from "./ActionList.tsrx";
import { FinanceView } from "./FinanceView.tsrx";
import { HealthView } from "./HealthView.tsrx";
import { HomeView } from "./HomeView.tsrx";
import { InventoryView } from "./InventoryView.tsrx";
import { RelationshipsView } from "./RelationshipsView.tsrx";
import { SystemView } from "./SystemView.tsrx";
import { categoryById } from "../game/data";
import { GameContext } from "../game/store";

export function InterfacePanel() @{
  const game = GameContext.get();

  <>
    <div class="interface-panel">
      <header class="interface-header">
        <div class="interface-heading">
          <span class="interface-kicker">
            {"// " + categoryById(game.activeInterface.value).tagline}
          </span>
          <h1
            class="interface-title"
            style={{
              "--accent":
                "var(" + categoryById(game.activeInterface.value).accent + ")",
            }}
          >
            {categoryById(game.activeInterface.value).label}
          </h1>
        </div>
        <button
          class="interface-close"
          onClick={() => game.setInterface(null)}
          title="Close interface"
        >
          CLOSE ✕
        </button>
      </header>

      <div class="interface-body">
        @switch (game.activeInterface.value) {
          @case "relationships": {
            <RelationshipsView />
          }
          @case "health": {
            <HealthView />
          }
          @case "finance": {
            <FinanceView />
          }
          @case "inventory": {
            <InventoryView />
          }
          @case "home": {
            <HomeView />
          }
          @case "system": {
            <SystemView />
          }
          @default: {
            <ActionList hereOnly={false} />
          }
        }
      </div>
    </div>

    <style>
      .interface-panel {
        display: flex;
        flex: 1;
        min-height: 0;
        width: 100%;
        flex-direction: column;
        border: 1px solid var(--color-border);
        border-radius: 9px;
        background-color: var(--color-bg-sunken);
        overflow: hidden;
      }

      .interface-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border);
        background-color: var(--color-bg-elevated);
      }

      .interface-heading {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .interface-kicker {
        font-size: 8px;
        letter-spacing: 0.1em;
        color: var(--color-text-subtle);
        text-transform: uppercase;
      }

      .interface-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--accent);
      }

      .interface-close {
        flex-shrink: 0;
        padding: 7px 10px;
        border: 1px solid var(--color-border-strong);
        border-radius: 5px;
        background-color: transparent;
        color: var(--color-text-subtle);
        font-size: 8px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .interface-close:hover {
        border-color: var(--ctp-red);
        color: var(--ctp-red);
      }

      .interface-body {
        flex: 1;
        min-height: 0;
        padding: 14px 16px;
        overflow-y: auto;
      }
    </style>
  </>
}

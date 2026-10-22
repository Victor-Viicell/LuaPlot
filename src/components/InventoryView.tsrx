import { track } from "ripple";
import { ConsumablesView } from "./ConsumablesView.tsrx";
import { ItemsView } from "./ItemsView.tsrx";

type InventoryTab = "supplies" | "assets" | "cyberware";

const TABS: { id: InventoryTab; label: string }[] = [
  { id: "supplies", label: "Supplies" },
  { id: "assets", label: "Gear" },
  { id: "cyberware", label: "Chrome" },
];

export function InventoryView() @{
  const tab = track<InventoryTab>("supplies");

  <>
    <div class="inventory-view">
      <div class="inventory-head">
        <div class="inventory-tabs">
          @for (const entry of TABS; key entry.id) {
            <button
              class={
                "inventory-tab " + (tab.value === entry.id ? "active" : "")
              }
              onClick={() => {
                tab.value = entry.id;
              }}
            >
              {entry.label}
            </button>
          }
        </div>
        <span class="inventory-note">
          Gear and chrome are permanent. Supplies are consumed on use.
        </span>
      </div>

      @if (tab.value === "supplies") {
        <ConsumablesView />
      }
      @if (tab.value === "assets") {
        <ItemsView slot="assets" />
      }
      @if (tab.value === "cyberware") {
        <ItemsView slot="cyberware" />
      }
    </div>

    <style>
      .inventory-view {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .inventory-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 9px 12px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-bg-elevated);
      }

      .inventory-tabs {
        display: flex;
        gap: 6px;
      }

      .inventory-tab {
        padding: 6px 10px;
        border: 1px solid var(--color-border-strong);
        border-radius: 5px;
        background-color: transparent;
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .inventory-tab:hover {
        border-color: var(--color-accent);
        color: var(--color-text);
      }

      .inventory-tab.active {
        border-color: var(--color-accent);
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
      }

      .inventory-note {
        font-size: 9px;
        line-height: 1.5;
        color: var(--color-text-subtle);
        text-align: right;
      }

      @media (max-width: 900px) {
        .inventory-head {
          align-items: flex-start;
          flex-direction: column;
        }

        .inventory-note {
          text-align: left;
        }
      }
    </style>
  </>
}

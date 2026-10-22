import { track } from "ripple";
import { CONSUMABLES, STAT_KEYS, STAT_LABELS, statDeltaOf } from "../game/data";
import { durationLabel, formatCredits } from "../game/format";
import { GameContext } from "../game/store";

export function ConsumablesView() @{
  const game = GameContext.get();
  const totalStock = track(() =>
    game.supplies.reduce((sum, entry) => sum + entry.qty, 0),
  );
  const vendorBlock = track(() => game.vendorBlockReason("supplies"));

  <>
    <section class="consumables">
      <div class="consumables-head">
        <div>
          <h2 class="consumables-title">STREET FOOD &amp; CHEM</h2>
          <p class="consumables-note">
            Satiety drains as time passes. Stock up, then use what you carry.
            Stims buy energy with your health.
            @if (vendorBlock.value) {
              <span class="consumables-vendor">{vendorBlock.value}.</span>
            }
          </p>
        </div>
        <span class="consumables-stock">{totalStock.value} IN STOCK</span>
      </div>

      <div class="consumables-grid">
        @for (const item of CONSUMABLES; key item.id) {
          <article class="consumable-card">
            <div class="consumable-head">
              <h3>{item.label}</h3>
              <span class="consumable-price">¥{formatCredits(item.price)}</span>
            </div>
            <p class="consumable-description">{item.description}</p>
            <div class="consumable-tags">
              <span class="consumable-tag time">
                {durationLabel(item.time)}
              </span>
              @for (const stat of STAT_KEYS; key stat) {
                @if (statDeltaOf(item.stats, stat) !== 0) {
                  <span
                    class={
                      "consumable-tag " +
                      (statDeltaOf(item.stats, stat) > 0 ? "good" : "bad")
                    }
                  >
                    {STAT_LABELS[stat]}
                    {statDeltaOf(item.stats, stat) > 0 ? " +" : " "}
                    {statDeltaOf(item.stats, stat)}
                  </span>
                }
              }
            </div>
            <div class="consumable-actions">
              <button
                class="consumable-buy"
                disabled={
                  game.player.credits < item.price || vendorBlock.value !== null
                }
                title={vendorBlock.value ?? "Buy one"}
                onClick={() => game.buyConsumable(item)}
              >
                BUY
              </button>
              <button
                class="consumable-use"
                disabled={game.supplyCount(item.id) === 0}
                onClick={() => game.consume(item)}
              >
                USE
                {game.supplyCount(item.id) > 0
                  ? " ×" + game.supplyCount(item.id)
                  : ""}
              </button>
            </div>
          </article>
        }
      </div>
    </section>

    <style>
      .consumables {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .consumables-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-bg-elevated);
      }

      .consumables-title {
        margin: 0;
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.16em;
        color: var(--color-text-subtle);
      }

      .consumables-note {
        margin: 5px 0 0;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .consumables-vendor {
        display: block;
        margin-top: 3px;
        color: var(--ctp-yellow);
        font-size: 9px;
      }

      .consumables-stock {
        flex-shrink: 0;
        font-size: 8px;
        letter-spacing: 0.1em;
        color: var(--ctp-yellow);
        white-space: nowrap;
      }

      .consumables-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 10px;
      }

      .consumable-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
      }

      .consumable-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }

      .consumable-head h3 {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text);
      }

      .consumable-price {
        font-size: 10px;
        color: var(--ctp-teal);
        font-variant-numeric: tabular-nums;
      }

      .consumable-description {
        margin: 0;
        flex: 1;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .consumable-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .consumable-tag {
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-bg-sunken);
        font-size: 8px;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
      }

      .consumable-tag.good {
        color: var(--ctp-green);
        border-color: rgba(166, 227, 161, 0.3);
      }

      .consumable-tag.bad {
        color: var(--ctp-red);
        border-color: rgba(243, 139, 168, 0.3);
      }

      .consumable-tag.time {
        color: var(--ctp-sky);
        border-color: rgba(137, 220, 235, 0.3);
      }

      .consumable-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }

      .consumable-buy,
      .consumable-use {
        padding: 7px 8px;
        border: 1px solid var(--color-border-strong);
        border-radius: 5px;
        background-color: transparent;
        color: var(--color-text-muted);
        font-size: 8px;
        letter-spacing: 0.1em;
        cursor: pointer;
      }

      .consumable-buy {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .consumable-use {
        border-color: var(--ctp-green);
        color: var(--ctp-green);
      }

      .consumable-buy:hover:not(:disabled) {
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
      }

      .consumable-use:hover:not(:disabled) {
        background-color: var(--ctp-green);
        color: var(--ctp-crust);
      }

      .consumable-buy:disabled,
      .consumable-use:disabled {
        opacity: 0.35;
        cursor: default;
      }
    </style>
  </>
}

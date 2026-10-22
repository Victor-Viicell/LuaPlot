import { track } from "ripple";
import { ITEMS, STAT_KEYS, STAT_LABELS, statDeltaOf } from "../game/data";
import { formatCredits } from "../game/format";
import { GameContext } from "../game/store";

export function ItemsView({ slot }: { slot: "assets" | "cyberware" }) @{
  const game = GameContext.get();
  const vendorBlock = track(() => game.vendorBlockReason(slot));

  <>
    <div class="items">
      <p class="items-note">
        {slot === "assets"
          ? "One-time purchases. Permanent bonuses, no upkeep — yet."
          : "Chrome is forever, or close enough. Some of it takes a bite out of your body."}
        @if (vendorBlock.value) {
          <span class="items-vendor">{vendorBlock.value}.</span>
        }
      </p>

      <div class="items-grid">
        @for (const item of ITEMS[slot]; key item.id) {
          <article
            class={"item-card " + (game.owned.includes(item.id) ? "owned" : "")}
          >
            <div class="item-head">
              <h3>{item.label}</h3>
              <span class="item-price">¥{formatCredits(item.price)}</span>
            </div>
            <p class="item-description">{item.description}</p>
            <div class="item-tags">
              @for (const stat of STAT_KEYS; key stat) {
                @if (statDeltaOf(item.stats, stat) !== 0) {
                  <span
                    class={
                      "item-tag " +
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
            <button
              class="item-buy"
              disabled={
                game.owned.includes(item.id) ||
                game.player.credits < item.price ||
                vendorBlock.value !== null
              }
              title={vendorBlock.value ?? "Buy it"}
              onClick={() => game.acquire(item)}
            >
              {game.owned.includes(item.id)
                ? "OWNED"
                : game.player.credits < item.price
                  ? "CAN'T AFFORD"
                  : "BUY"}
            </button>
          </article>
        }
      </div>
    </div>

    <style>
      .items {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .items-note {
        margin: 0;
        padding: 10px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-bg-elevated);
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .items-vendor {
        display: block;
        margin-top: 3px;
        color: var(--ctp-yellow);
        font-size: 9px;
      }

      .items-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 10px;
      }

      .item-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 13px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
      }

      .item-card.owned {
        border-color: rgba(166, 227, 161, 0.35);
      }

      .item-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }

      .item-head h3 {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text);
      }

      .item-price {
        font-size: 10px;
        color: var(--ctp-teal);
        font-variant-numeric: tabular-nums;
      }

      .item-description {
        margin: 0;
        flex: 1;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .item-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .item-tag {
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-bg-sunken);
        font-size: 8px;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
      }

      .item-tag.good {
        color: var(--ctp-green);
        border-color: rgba(166, 227, 161, 0.3);
      }

      .item-tag.bad {
        color: var(--ctp-red);
        border-color: rgba(243, 139, 168, 0.3);
      }

      .item-buy {
        padding: 8px 10px;
        border: 1px solid var(--color-accent);
        border-radius: 6px;
        background-color: transparent;
        color: var(--color-accent);
        font-size: 9px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .item-buy:hover:not(:disabled) {
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
      }
    </style>
  </>
}

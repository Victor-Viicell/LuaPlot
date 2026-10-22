import { track } from "ripple";
import { ActionList } from "./ActionList.tsrx";
import { propertyById } from "../game/data";
import { formatCredits, signedCredits } from "../game/format";
import { GameContext } from "../game/store";

export function FinanceView() @{
  const game = GameContext.get();
  const home = track(() => propertyById(game.home.value));
  const housingCost = track(() =>
    game.tenure.value === "own" ? home.value.upkeep : home.value.rent,
  );

  <>
    <div class="finance">
      <div class="finance-grid">
        <div class="finance-card">
          <span class="finance-label">BALANCE</span>
          <strong class="finance-value credits">
            ¥{formatCredits(game.player.credits)}
          </strong>
        </div>
        <div class="finance-card">
          <span class="finance-label">SALARY</span>
          <strong class="finance-value">
            ¥{formatCredits(game.player.salary)}
            <small>/yr</small>
          </strong>
        </div>
        <div class="finance-card">
          <span class="finance-label">
            {game.tenure.value === "own" ? "UPKEEP" : "RENT"}
          </span>
          <strong class="finance-value">
            ¥{formatCredits(housingCost.value)}
            <small>/yr</small>
          </strong>
        </div>
        <div class="finance-card">
          <span class="finance-label">EQUITY</span>
          <strong class="finance-value">
            ¥{formatCredits(game.tenure.value === "own" ? home.value.price : 0)}
            <small>{game.tenure.value === "own" ? "owned" : "rented"}</small>
          </strong>
        </div>
        <div class="finance-card">
          <span class="finance-label">NET FLOW</span>
          <strong
            class={
              "finance-value " +
              (game.player.salary - housingCost.value >= 0
                ? "positive"
                : "negative")
            }
          >
            {signedCredits(game.player.salary - housingCost.value)}
            <small>/yr</small>
          </strong>
        </div>
      </div>

      <section class="ledger-section">
        <div class="ledger-head">
          <h2 class="section-title">TRANSACTION LEDGER</h2>
          <span class="ledger-count">{game.ledger.length} ENTRIES</span>
        </div>
        <div class="ledger-list">
          @for (const entry of game.ledger; key entry.id) {
            <div class="ledger-row">
              <span class="ledger-age">AGE {entry.age}</span>
              <span class="ledger-label">{entry.label}</span>
              <span
                class={
                  "ledger-amount " +
                  (entry.amount >= 0 ? "positive" : "negative")
                }
              >
                {signedCredits(entry.amount)}
              </span>
            </div>
          }
          @if (game.ledger.length === 0) {
            <p class="ledger-empty">
              No transactions yet. Take a job or make a move.
            </p>
          }
        </div>
      </section>

      <section class="finance-actions">
        <h2 class="section-title">MONEY MOVES</h2>
        <ActionList hereOnly={false} />
      </section>
    </div>

    <style>
      .finance {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .finance-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
      }

      .finance-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
      }

      .finance-label {
        font-size: 8px;
        letter-spacing: 0.14em;
        color: var(--color-text-subtle);
      }

      .finance-value {
        font-size: 16px;
        font-weight: 500;
        color: var(--color-text);
        font-variant-numeric: tabular-nums;
      }

      .finance-value small {
        margin-left: 2px;
        font-size: 9px;
        color: var(--color-text-subtle);
      }

      .finance-value.credits,
      .finance-value.positive {
        color: var(--ctp-teal);
      }

      .finance-value.negative {
        color: var(--ctp-red);
      }

      .ledger-section,
      .finance-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .section-title {
        margin: 0;
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.16em;
        color: var(--color-text-subtle);
      }

      .ledger-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }

      .ledger-count {
        font-size: 8px;
        letter-spacing: 0.08em;
        color: var(--color-text-subtle);
      }

      .ledger-list {
        display: flex;
        flex-direction: column;
        max-height: 220px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
        overflow-y: auto;
      }

      .ledger-row {
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--color-border);
        font-size: 10px;
      }

      .ledger-row:last-child {
        border-bottom: 0;
      }

      .ledger-age {
        width: 52px;
        flex-shrink: 0;
        color: var(--color-text-subtle);
        font-size: 8px;
      }

      .ledger-label {
        flex: 1;
        min-width: 0;
        color: var(--color-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ledger-amount {
        font-variant-numeric: tabular-nums;
      }

      .ledger-amount.positive {
        color: var(--ctp-green);
      }

      .ledger-amount.negative {
        color: var(--ctp-red);
      }

      .ledger-empty {
        margin: 0;
        padding: 18px;
        font-size: 10px;
        color: var(--color-text-subtle);
        text-align: center;
      }
    </style>
  </>
}

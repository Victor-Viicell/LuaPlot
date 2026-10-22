import { track } from "ripple";
import {
  PROPERTIES,
  STAT_KEYS,
  STAT_LABELS,
  actionById,
  districtFacts,
  propertyById,
  statDeltaOf,
} from "../game/data";
import { formatCount, formatCreditRange, formatCredits } from "../game/format";
import {
  FURNITURE,
  FURNITURE_CATEGORY_LABELS,
  furnitureById,
  furnitureSlotsUsed,
} from "../game/furniture";
import { GameContext } from "../game/store";
import type {
  FurnitureInteraction,
  FurnitureOption,
  Property,
  Tenure,
} from "../game/types";

function rentLabel(
  currentId: string,
  currentTenure: Tenure,
  credits: number,
  option: Property,
): string {
  if (currentId === option.id && currentTenure === "rent") {
    return "CURRENT HOME";
  }

  if (currentId === option.id && currentTenure === "own") {
    return "OWNED";
  }

  if (credits < option.deposit) {
    return "DEPOSIT SHORT";
  }

  return option.deposit > 0
    ? `RENT · ¥${formatCredits(option.deposit)} DOWN`
    : "RENT · FREE MOVE-IN";
}

function rentDisabled(
  currentId: string,
  currentTenure: Tenure,
  credits: number,
  option: Property,
): boolean {
  return (
    (currentId === option.id && currentTenure === "rent") ||
    (currentId === option.id && currentTenure === "own") ||
    credits < option.deposit
  );
}

function buyLabel(
  currentId: string,
  currentTenure: Tenure,
  credits: number,
  option: Property,
): string {
  if (currentId === option.id && currentTenure === "own") {
    return "OWNED";
  }

  if (currentId === option.id && currentTenure === "rent") {
    return credits < option.price
      ? "BUY-OUT SHORT"
      : `BUY-OUT · ¥${formatCredits(option.price)}`;
  }

  if (credits < option.price) {
    return "PRICE SHORT";
  }

  return `BUY · ¥${formatCredits(option.price)}`;
}

function buyDisabled(
  currentId: string,
  currentTenure: Tenure,
  credits: number,
  option: Property,
): boolean {
  return (
    (currentId === option.id && currentTenure === "own") ||
    credits < option.price
  );
}

function furnitureBlocked(
  item: FurnitureOption,
  installed: FurnitureOption[],
  credits: number,
  slotsUsed: number,
  homeSlots: number,
): boolean {
  const existing = installed.find((entry) => entry.category === item.category);

  if (existing?.id === item.id) {
    return true;
  }

  if (credits < item.price) {
    return true;
  }

  return slotsUsed - (existing?.slots ?? 0) + item.slots > homeSlots;
}

function furnitureLabel(
  item: FurnitureOption,
  installed: FurnitureOption[],
  credits: number,
  slotsUsed: number,
  homeSlots: number,
): string {
  const existing = installed.find((entry) => entry.category === item.category);

  if (existing?.id === item.id) {
    return "INSTALLED";
  }

  if (slotsUsed - (existing?.slots ?? 0) + item.slots > homeSlots) {
    return "NO SLOTS";
  }

  if (credits < item.price) {
    return "CREDITS SHORT";
  }

  return existing
    ? `REPLACE · ¥${formatCredits(item.price)}`
    : `INSTALL · ¥${formatCredits(item.price)}`;
}

export function HomeView() @{
  const game = GameContext.get();
  const current = track(() => propertyById(game.home.value));
  const facts = track(() => districtFacts(current.value.district));
  const owned = track(() => game.tenure.value === "own");
  const installed = track(() =>
    Array.from(game.furniture)
      .map((id) => furnitureById(id))
      .filter((item): item is FurnitureOption => item !== undefined),
  );
  const slotsUsed = track(() => furnitureSlotsUsed(Array.from(game.furniture)));
  const available = track(() =>
    FURNITURE.filter(
      (item) => !installed.value.some((entry) => entry.id === item.id),
    ),
  );
  const cost = track(() =>
    owned.value ? current.value.upkeep : current.value.rent,
  );

  function interactionBlock(interaction: FurnitureInteraction): string | null {
    if (game.location.value !== "home") {
      return "Travel home first";
    }

    if (interaction.timeMode) {
      return null;
    }

    if (!interaction.actionId) {
      return "No interaction";
    }

    const action = actionById(interaction.actionId);
    return action ? game.actionBlockReason(action) : "Unknown action";
  }

  function useInteraction(interaction: FurnitureInteraction): void {
    if (interaction.timeMode) {
      game.openTimeDialog(interaction.timeMode);
      return;
    }

    if (interaction.actionId) {
      const action = actionById(interaction.actionId);
      if (action) {
        game.runAction(action);
      }
    }
  }

  <>
    <div class="home-view">
      <section class="current-home">
        <span class="current-label">CURRENT RESIDENCE</span>
        <h2>{current.value.name}</h2>
        <span class="home-district">{current.value.district}</span>
        <p class="current-description">{current.value.description}</p>
        <div class="current-facts">
          <span class="fact-strong">{owned.value ? "OWNED" : "RENTED"}</span>
          <span>
            {owned.value ? "UPKEEP" : "RENT"} ¥{formatCredits(cost.value)}/yr
          </span>
          <span>{current.value.address}</span>
          <span>{current.value.slots} SLOTS</span>
          <span>ORIGIN · {game.player.district}</span>
          <span>{game.player.occupation}</span>
        </div>
        @if (facts.value) {
          <>
            <div class="hood-line">
              <span>{formatCount(facts.value.placeCount, "PLACE")}</span>
              <span>{formatCount(facts.value.services.length, "SERVICE")}</span>
              @if (facts.value.rentRange) {
                <span>
                  {"DISTRICT RENT " +
                    formatCreditRange(facts.value.rentRange, "/YR")}
                </span>
              }
            </div>
            <p class="hood-blurb">{facts.value.blurb}</p>
          </>
        }
        <button
          class="home-map"
          onClick={() => {
            game.setInterface(null);
            game.exitLocation();
          }}
        >
          OPEN CITY MAP →
        </button>
      </section>

      <section class="furnishings">
        <div class="furniture-head">
          <div>
            <span class="current-label">FURNISHINGS</span>
            <h3>Slots and installed features</h3>
          </div>
          <span class="slots-badge">
            {`${slotsUsed.value} / ${current.value.slots} SLOTS`}
          </span>
        </div>

        <div class="installed-grid">
          @if (installed.value.length === 0) {
            <p class="furniture-empty">
              Nothing installed. A bed is required to sleep here.
            </p>
          }
          @for (const item of installed.value; key item.id) {
            <article class="furniture-card installed">
              <div class="furniture-card-head">
                <strong>{item.label}</strong>
                <span class="furniture-category">
                  {FURNITURE_CATEGORY_LABELS[item.category]}
                </span>
              </div>
              <p class="furniture-description">{item.description}</p>
              <div class="furniture-tags">
                <span>{item.slots} SLOT</span>
                @if (item.sleepEnergy) {
                  <span>+{item.sleepEnergy} EN/H</span>
                }
                @if (item.sleepHappiness) {
                  <span>+{item.sleepHappiness} HAP</span>
                }
                @if (item.restEnergy) {
                  <span>+{item.restEnergy} EN/H REST</span>
                }
              </div>
              <div class="furniture-actions">
                @for (
                  const interaction of item.interactions;
                  key interaction.label
                ) {
                  <button
                    class="furniture-use"
                    disabled={interactionBlock(interaction) !== null}
                    title={interactionBlock(interaction) ?? interaction.label}
                    onClick={() => useInteraction(interaction)}
                  >
                    {interaction.label}
                  </button>
                }
              </div>
              <button
                class="furniture-sell"
                onClick={() => game.sellFurniture(item)}
              >
                SELL · ¥{formatCredits(Math.round(item.price * 0.5))}
              </button>
            </article>
          }
        </div>

        <div class="furniture-catalog">
          @for (const item of available.value; key item.id) {
            <article class="furniture-card">
              <div class="furniture-card-head">
                <strong>{item.label}</strong>
                <span class="furniture-category">
                  {FURNITURE_CATEGORY_LABELS[item.category]}
                </span>
              </div>
              <p class="furniture-description">{item.description}</p>
              <div class="furniture-tags">
                <span>{item.slots} SLOT</span>
                @if (item.sleepEnergy) {
                  <span>+{item.sleepEnergy} EN/H</span>
                }
                @if (item.sleepHappiness) {
                  <span>+{item.sleepHappiness} HAP</span>
                }
                @if (item.restEnergy) {
                  <span>+{item.restEnergy} EN/H REST</span>
                }
              </div>
              <button
                class="furniture-install"
                disabled={furnitureBlocked(
                  item,
                  installed.value,
                  game.player.credits,
                  slotsUsed.value,
                  current.value.slots,
                )}
                onClick={() => game.installFurniture(item)}
              >
                {furnitureLabel(
                  item,
                  installed.value,
                  game.player.credits,
                  slotsUsed.value,
                  current.value.slots,
                )}
              </button>
            </article>
          }
        </div>
      </section>

      <section class="market-head">
        <div>
          <span class="current-label">PROPERTY MARKET</span>
          <h3>Rent or buy across the city</h3>
        </div>
        <span class="market-note">
          PRICES COME FROM THE UNIT, BUILDING, AND ACCESS — NOT A DISTRICT SCORE
        </span>
      </section>

      <div class="home-grid">
        @for (const option of PROPERTIES; key option.id) {
          <article
            class={
              "home-card " +
              (game.home.value === option.id ? "current " : "") +
              (game.home.value === option.id && owned.value ? "owned " : "")
            }
          >
            <div class="home-card-head">
              <h3>{option.name}</h3>
              @if (game.home.value === option.id) {
                <span class="current-badge">
                  {owned.value ? "OWNED" : "CURRENT"}
                </span>
              }
            </div>
            <span class="home-district">{option.district}</span>
            <span class="home-address">{option.address}</span>
            <p class="home-description">{option.description}</p>
            <div class="home-tags">
              <span class="home-tag">
                RENT ¥{formatCredits(option.rent)}/yr
              </span>
              <span class="home-tag">BUY ¥{formatCredits(option.price)}</span>
              <span class="home-tag">
                DEPOSIT ¥{formatCredits(option.deposit)}
              </span>
              <span class="home-tag">
                UPKEEP ¥{formatCredits(option.upkeep)}/yr
              </span>
              <span class="home-tag sleep">SLOTS {option.slots}</span>
              @for (const stat of STAT_KEYS; key stat) {
                @if (statDeltaOf(option.stats, stat) !== 0) {
                  <span class="home-tag good">
                    {STAT_LABELS[stat]} +{statDeltaOf(option.stats, stat)}
                  </span>
                }
              }
            </div>
            <div class="home-actions">
              <button
                class="home-move"
                disabled={rentDisabled(
                  game.home.value,
                  game.tenure.value,
                  game.player.credits,
                  option,
                )}
                onClick={() => game.moveHome(option, "rent")}
              >
                {rentLabel(
                  game.home.value,
                  game.tenure.value,
                  game.player.credits,
                  option,
                )}
              </button>
              <button
                class="home-buy"
                disabled={buyDisabled(
                  game.home.value,
                  game.tenure.value,
                  game.player.credits,
                  option,
                )}
                onClick={() => game.moveHome(option, "own")}
              >
                {buyLabel(
                  game.home.value,
                  game.tenure.value,
                  game.player.credits,
                  option,
                )}
              </button>
            </div>
          </article>
        }
      </div>
    </div>

    <style>
      .home-view {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .current-home {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        padding: 16px 18px;
        border: 1px solid var(--ctp-peach);
        border-radius: 8px;
        background:
          radial-gradient(
            circle at 90% 10%,
            rgba(250, 179, 135, 0.12),
            transparent 50%
          ),
          var(--color-surface);
      }

      .current-label {
        font-size: 8px;
        letter-spacing: 0.16em;
        color: var(--ctp-peach);
      }

      .current-home h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        color: var(--color-text);
      }

      .home-district {
        font-size: 8px;
        letter-spacing: 0.1em;
        color: var(--color-text-subtle);
      }

      .home-address {
        margin-top: -4px;
        font-size: 8px;
        letter-spacing: 0.04em;
        color: var(--color-text-subtle);
      }

      .current-description {
        margin: 0;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .current-facts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }

      .current-facts span {
        padding: 2px 7px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-bg-sunken);
        font-size: 8px;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
      }

      .current-facts .fact-strong {
        border-color: rgba(250, 179, 135, 0.45);
        color: var(--ctp-peach);
      }

      .hood-line {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 2px;
        font-size: 8px;
        letter-spacing: 0.06em;
        color: var(--ctp-sky);
      }

      .hood-blurb {
        margin: 0;
        font-size: 9px;
        line-height: 1.45;
        color: var(--color-text-subtle);
      }

      .home-map {
        margin-top: 8px;
        padding: 7px 10px;
        border: 1px solid var(--ctp-sky);
        border-radius: 5px;
        background-color: transparent;
        color: var(--ctp-sky);
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .home-map:hover {
        background-color: var(--ctp-sky);
        color: var(--ctp-crust);
      }

      .furnishings {
        display: flex;
        flex-direction: column;
        gap: 9px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
      }

      .furniture-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
      }

      .furniture-head h3 {
        margin: 2px 0 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text);
      }

      .slots-badge {
        padding: 3px 8px;
        border: 1px solid var(--ctp-teal);
        border-radius: 4px;
        color: var(--ctp-teal);
        font-size: 8px;
        letter-spacing: 0.1em;
        white-space: nowrap;
      }

      .installed-grid,
      .furniture-catalog {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
        gap: 8px;
      }

      .furniture-empty {
        grid-column: 1 / -1;
        margin: 0;
        padding: 10px;
        border: 1px dashed var(--color-border);
        border-radius: 6px;
        font-size: 9px;
        color: var(--color-text-subtle);
      }

      .furniture-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        border: 1px solid var(--color-border);
        border-radius: 7px;
        background-color: var(--color-bg-sunken);
      }

      .furniture-card.installed {
        border-color: rgba(148, 226, 213, 0.4);
      }

      .furniture-card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }

      .furniture-card-head strong {
        font-size: 10px;
        font-weight: 500;
        color: var(--color-text);
      }

      .furniture-category {
        font-size: 7px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-text-subtle);
      }

      .furniture-description {
        margin: 0;
        flex: 1;
        font-size: 9px;
        line-height: 1.45;
        color: var(--color-text-muted);
      }

      .furniture-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .furniture-tags span {
        padding: 2px 5px;
        border: 1px solid var(--color-border);
        border-radius: 3px;
        font-size: 7px;
        letter-spacing: 0.05em;
        color: var(--color-text-subtle);
      }

      .furniture-install,
      .furniture-sell,
      .furniture-use {
        padding: 6px 8px;
        border-radius: 5px;
        background-color: transparent;
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.08em;
        cursor: pointer;
      }

      .furniture-install {
        border: 1px solid var(--ctp-teal);
        color: var(--ctp-teal);
      }

      .furniture-sell {
        border: 1px solid var(--color-border-strong);
        color: var(--color-text-muted);
      }

      .furniture-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .furniture-use {
        flex: 1;
        border: 1px solid var(--ctp-mauve);
        color: var(--ctp-mauve);
      }

      .furniture-use:hover:not(:disabled) {
        background-color: var(--ctp-mauve);
        color: var(--ctp-crust);
      }

      .furniture-use:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .furniture-install:hover:not(:disabled) {
        background-color: var(--ctp-teal);
        color: var(--ctp-crust);
      }

      .furniture-sell:hover {
        border-color: var(--ctp-red);
        color: var(--ctp-red);
      }

      .furniture-install:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .market-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 14px;
        padding-top: 2px;
      }

      .market-head h3 {
        margin: 2px 0 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text);
      }

      .market-note {
        max-width: 280px;
        font-size: 7px;
        line-height: 1.5;
        letter-spacing: 0.08em;
        text-align: right;
        color: var(--color-text-subtle);
      }

      .home-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 10px;
      }

      .home-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 13px 14px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--color-surface);
      }

      .home-card.current {
        border-color: var(--ctp-peach);
      }

      .home-card.owned {
        background:
          linear-gradient(135deg, rgba(250, 179, 135, 0.08), transparent 60%),
          var(--color-surface);
      }

      .home-card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }

      .home-card-head h3 {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text);
      }

      .current-badge {
        font-size: 7px;
        letter-spacing: 0.12em;
        color: var(--ctp-peach);
      }

      .home-description {
        margin: 0;
        flex: 1;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .home-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .home-tag {
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-bg-sunken);
        font-size: 8px;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
      }

      .home-tag.sleep {
        color: var(--ctp-peach);
        border-color: rgba(250, 179, 135, 0.3);
      }

      .home-tag.good {
        color: var(--ctp-green);
        border-color: rgba(166, 227, 161, 0.3);
      }

      .home-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }

      .home-move,
      .home-buy {
        padding: 8px 10px;
        border-radius: 6px;
        background-color: transparent;
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.08em;
        cursor: pointer;
      }

      .home-move {
        border: 1px solid var(--ctp-peach);
        color: var(--ctp-peach);
      }

      .home-buy {
        border: 1px solid var(--ctp-teal);
        color: var(--ctp-teal);
      }

      .home-move:hover:not(:disabled) {
        background-color: var(--ctp-peach);
        color: var(--ctp-crust);
      }

      .home-buy:hover:not(:disabled) {
        background-color: var(--ctp-teal);
        color: var(--ctp-crust);
      }

      .home-move:disabled,
      .home-buy:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    </style>
  </>
}

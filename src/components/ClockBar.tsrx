import { track } from "ripple";
import {
  SEASONS,
  SEASON_DAYS,
  WAIT_ENERGY_PER_HOUR,
  hotelRestPerHour,
  locationFor,
  propertyById,
} from "../game/data";
import { furnitureWithFeature } from "../game/furniture";
import { formatClock, formatDuration } from "../game/format";
import { GameContext } from "../game/store";
import type { TimeMode } from "../game/types";

const TIME_PRESETS = [15 * 60, 30 * 60, 60 * 60, 4 * 3600, 8 * 3600];

function presetLabel(seconds: number): string {
  return seconds < 3600 ? `${seconds / 60}M` : `${seconds / 3600}H`;
}

export function ClockBar() @{
  const game = GameContext.get();

  const daysLeft = track(
    () =>
      SEASON_DAYS -
      game.clock.day +
      (SEASONS.length - game.clock.season - 1) * SEASON_DAYS,
  );
  const dayProgress = track(() => (game.clock.secondOfDay / 86400) * 100);

  const dialogOpen = track(() => game.timeDialog.mode !== null);
  const mode = track<TimeMode | null>(() => game.timeDialog.mode);
  const totalSeconds = track(
    () =>
      game.timeDialog.hours * 3600 +
      game.timeDialog.minutes * 60 +
      game.timeDialog.seconds,
  );

  const currentLocation = track(() =>
    locationFor(game.location.value, propertyById(game.home.value)),
  );
  const missingHomeBed = track(
    () =>
      game.location.value === "home" &&
      !furnitureWithFeature(Array.from(game.furniture), "bed"),
  );
  const bed = track(() => {
    const location = locationFor(
      game.location.value,
      propertyById(game.home.value),
    );

    if (location.kind === "home") {
      const property = propertyById(game.home.value);
      const bedItem = furnitureWithFeature(Array.from(game.furniture), "bed");

      if (!bedItem) {
        return null;
      }

      return {
        label: `${property.name} · ${bedItem.label}`,
        rate: 0,
        perHour: bedItem.sleepEnergy ?? 4,
        heals: (bedItem.sleepHealth ?? 0) > 0,
      };
    }

    if (location.kind === "hotel") {
      return {
        label: location.name,
        rate: location.hotelRate ?? 10,
        perHour: hotelRestPerHour(location),
        heals: false,
      };
    }

    return null;
  });

  const chair = track(() =>
    furnitureWithFeature(Array.from(game.furniture), "rest"),
  );
  const sleepCost = track(() =>
    bed.value ? Math.ceil((totalSeconds.value / 3600) * bed.value.rate) : 0,
  );
  const sleepGain = track(() =>
    bed.value
      ? Math.round(
          (totalSeconds.value / 3600) *
            bed.value.perHour *
            (game.stats.satiety < 20 ? 0.6 : 1),
        )
      : 0,
  );
  const restGain = track(() =>
    chair.value
      ? Math.round(
          (totalSeconds.value / 3600) *
            (chair.value.restEnergy ?? 1) *
            (game.stats.satiety < 20 ? 0.6 : 1),
        )
      : 0,
  );
  const waitDrain = track(() =>
    Math.round((totalSeconds.value / 3600) * WAIT_ENERGY_PER_HOUR),
  );
  const canConfirm = track(() => {
    if (totalSeconds.value <= 0) {
      return false;
    }

    if (mode.value === "wait") {
      return true;
    }

    if (mode.value === "rest") {
      return chair.value !== null && game.location.value === "home";
    }

    return bed.value !== null && game.player.credits >= sleepCost.value;
  });

  function setDuration(total: number): void {
    game.timeDialog.hours = Math.floor(total / 3600);
    game.timeDialog.minutes = Math.floor((total % 3600) / 60);
    game.timeDialog.seconds = total % 60;
  }

  function openDialog(next: TimeMode): void {
    game.openTimeDialog(next);
  }

  function closeDialog(): void {
    game.closeTimeDialog();
  }

  function confirmDialog(): void {
    if (!canConfirm.value || !mode.value) {
      return;
    }

    const total = totalSeconds.value;

    if (mode.value === "sleep") {
      game.sleepFor(total);
    } else if (mode.value === "rest") {
      game.restFor(total);
    } else {
      game.waitFor(total);
    }

    game.closeTimeDialog();
  }

  function clampField(value: number, max: number): number {
    return Math.max(0, Math.min(max, Math.floor(value) || 0));
  }

  <>
    <div class="clock-bar">
      <div class="clock-date">
        <span class="clock-season">
          {SEASONS[game.clock.season].label.toUpperCase()}
        </span>
        <span class="clock-day">
          DAY {game.clock.day} / {SEASON_DAYS}
        </span>
        <span class="clock-year">· {game.clock.year}</span>
      </div>

      <button
        class="clock-location"
        title="Return to city map"
        onClick={() => {
          game.setInterface(null);
          game.exitLocation();
        }}
      >
        {"⌖ " + currentLocation.value.name}
      </button>

      <div class="clock-time">{formatClock(game.clock.secondOfDay, true)}</div>

      <div class="clock-track" title="24-hour day">
        <span
          class="clock-fill"
          style={{ width: dayProgress.value + "%" }}
        ></span>
      </div>

      <div class="clock-age">
        {"AGE " + game.player.age}
        <span class="clock-next">· {daysLeft.value}D TO NEXT YEAR</span>
      </div>

      @if (game.stats.satiety <= 0) {
        <button
          class="clock-warning"
          title="Open Health to eat"
          onClick={() => game.setInterface("health")}
        >
          STARVING
        </button>
      }
      @if (game.stats.satiety > 0 && game.stats.satiety < 20) {
        <button
          class="clock-warning"
          title="Open Health to eat"
          onClick={() => game.setInterface("health")}
        >
          HUNGRY
        </button>
      }

      <div class="clock-actions">
        <button
          class="clock-button primary"
          title="Choose sleep duration"
          onClick={() => openDialog("sleep")}
        >
          SLEEP
        </button>
        <button
          class="clock-button"
          title="Choose wait duration"
          onClick={() => openDialog("wait")}
        >
          WAIT
        </button>
        <button
          class="clock-button"
          title="Open the life log"
          onClick={() => game.toggleLog()}
        >
          LOG
        </button>
      </div>
    </div>

    @if (dialogOpen.value) {
      <div class="time-overlay">
        <div class="time-dialog" role="dialog" aria-modal="true">
          <div class="time-dialog-head">
            <span class="time-dialog-kicker">TIME CONTROL</span>
            <h2 class="time-dialog-title">
              {mode.value === "sleep"
                ? "SLEEP"
                : mode.value === "rest"
                  ? "REST"
                  : "WAIT"}
            </h2>
            <p class="time-dialog-sub">
              {mode.value === "sleep"
                ? bed.value
                  ? `Sleeping at ${bed.value.label}. ${
                      bed.value.rate > 0 ? `¥${bed.value.rate}/H` : "Free."
                    }`
                  : missingHomeBed.value
                    ? "No bed at home. Buy one from the Home screen."
                    : "No bed here. Travel home or rent a hotel room first."
                : mode.value === "rest"
                  ? chair.value
                    ? `Resting on the ${chair.value.label}. +${chair.value.restEnergy ?? 1} EN per hour.`
                    : "No chair or couch at home. Waiting while standing drains energy."
                  : `Waiting at the ${currentLocation.value.name} while standing. Waiting costs ${WAIT_ENERGY_PER_HOUR} EN per hour.`}
            </p>
          </div>

          <div class="duration-row">
            <label class="duration-field">
              <input
                class="duration-input"
                type="number"
                min="0"
                max="23"
                value={game.timeDialog.hours}
                onInput={(event) => {
                  game.timeDialog.hours = clampField(
                    Number(event.currentTarget.value),
                    23,
                  );
                }}
              />
              <span>H</span>
            </label>
            <label class="duration-field">
              <input
                class="duration-input"
                type="number"
                min="0"
                max="59"
                value={game.timeDialog.minutes}
                onInput={(event) => {
                  game.timeDialog.minutes = clampField(
                    Number(event.currentTarget.value),
                    59,
                  );
                }}
              />
              <span>M</span>
            </label>
            <label class="duration-field">
              <input
                class="duration-input"
                type="number"
                min="0"
                max="59"
                value={game.timeDialog.seconds}
                onInput={(event) => {
                  game.timeDialog.seconds = clampField(
                    Number(event.currentTarget.value),
                    59,
                  );
                }}
              />
              <span>S</span>
            </label>
          </div>

          <div class="preset-row">
            @for (const preset of TIME_PRESETS; key preset) {
              <button class="preset-button" onClick={() => setDuration(preset)}>
                {presetLabel(preset)}
              </button>
            }
          </div>

          <div class="time-summary">
            <span class="time-total">
              {"TOTAL · " + formatDuration(totalSeconds.value)}
            </span>
            @if (mode.value === "sleep") {
              @if (bed.value) {
                <>
                  <span
                    class={
                      "time-effect " + (sleepCost.value > 0 ? "cost" : "free")
                    }
                  >
                    {sleepCost.value > 0 ? `−¥${sleepCost.value}` : "FREE"}
                  </span>
                  <span class="time-effect gain">+{sleepGain.value} EN</span>
                </>
              } @else {
                <span class="time-effect bad">NO BED</span>
              }
            }
            @if (mode.value === "rest") {
              @if (chair.value) {
                <span class="time-effect gain">+{restGain.value} EN</span>
              } @else {
                <span class="time-effect bad">NO SEAT</span>
              }
            }
            @if (mode.value === "wait") {
              <span class="time-effect cost">−{waitDrain.value} EN</span>
            }
          </div>

          @if (mode.value === "sleep" && !bed.value && missingHomeBed.value) {
            <>
              <p class="time-warning">
                You need a bed to sleep at home. Buy one from the Home screen.
              </p>
              <button
                class="time-travel"
                onClick={() => {
                  closeDialog();
                  game.setInterface("home");
                }}
              >
                OPEN HOME
              </button>
            </>
          }

          @if (mode.value === "sleep" && !bed.value && !missingHomeBed.value) {
            <>
              <p class="time-warning">
                Sleep is only available at home or a hotel. Open the map to
                travel.
              </p>
              <button
                class="time-travel"
                onClick={() => {
                  closeDialog();
                  game.setInterface(null);
                  game.exitLocation();
                }}
              >
                OPEN CITY MAP
              </button>
            </>
          }

          @if (
            mode.value === "sleep" &&
            bed.value &&
            sleepCost.value > game.player.credits
          ) {
            <p class="time-warning">
              You need ¥{sleepCost.value} for this stay. You have ¥
              {game.player.credits}.
            </p>
          }

          @if (mode.value === "rest" && !chair.value) {
            <>
              <p class="time-warning">
                You need a chair or couch at home to rest. Standing wait will
                drain energy instead.
              </p>
              <button
                class="time-travel"
                onClick={() => {
                  closeDialog();
                  game.setInterface("home");
                }}
              >
                OPEN HOME
              </button>
            </>
          }

          <div class="time-actions">
            <button class="time-cancel" onClick={closeDialog}>
              CANCEL
            </button>
            <button
              class="time-confirm"
              disabled={!canConfirm.value}
              onClick={confirmDialog}
            >
              {mode.value === "sleep"
                ? "SLEEP"
                : mode.value === "rest"
                  ? "REST"
                  : "WAIT"}
            </button>
          </div>
        </div>
      </div>
    }

    <style>
      .clock-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
        flex-shrink: 0;
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--color-border);
        border-radius: 9px;
        background-color: var(--color-bg-elevated);
      }

      .clock-date {
        display: flex;
        align-items: baseline;
        gap: 7px;
        white-space: nowrap;
      }

      .clock-season {
        font-size: 10px;
        letter-spacing: 0.18em;
        color: var(--ctp-peach);
      }

      .clock-day {
        font-size: 9px;
        letter-spacing: 0.08em;
        color: var(--color-text-subtle);
      }

      .clock-year {
        font-size: 9px;
        color: var(--color-text-subtle);
        font-variant-numeric: tabular-nums;
      }

      .clock-location {
        padding: 3px 7px;
        border: 1px solid var(--color-border-strong);
        border-radius: 4px;
        background-color: var(--color-bg-sunken);
        color: var(--ctp-sky);
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.08em;
        cursor: pointer;
        white-space: nowrap;
      }

      .clock-location:hover {
        border-color: var(--ctp-sky);
      }

      .clock-time {
        font-size: 18px;
        line-height: 1;
        color: var(--color-text);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.04em;
      }

      .clock-track {
        flex: 1;
        min-width: 90px;
        height: 4px;
        border-radius: 999px;
        background-color: var(--color-bg-sunken);
        overflow: hidden;
      }

      .clock-fill {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--ctp-sky), var(--ctp-mauve));
        transition: width 220ms ease;
      }

      .clock-age {
        font-size: 9px;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .clock-next {
        margin-left: 4px;
        color: var(--color-text-subtle);
      }

      .clock-warning {
        padding: 2px 6px;
        border: 1px solid rgba(249, 226, 175, 0.35);
        border-radius: 4px;
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.1em;
        color: var(--ctp-yellow);
        background-color: var(--color-bg-sunken);
        white-space: nowrap;
        cursor: pointer;
      }

      .clock-warning:hover {
        border-color: var(--ctp-yellow);
      }

      .clock-actions {
        display: flex;
        gap: 6px;
        margin-left: auto;
      }

      .clock-button {
        padding: 6px 9px;
        border: 1px solid var(--color-border-strong);
        border-radius: 5px;
        background-color: transparent;
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.1em;
        cursor: pointer;
        white-space: nowrap;
        transition:
          background-color 140ms ease,
          color 140ms ease,
          border-color 140ms ease;
      }

      .clock-button:hover {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .clock-button.primary {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .clock-button.primary:hover {
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
      }

      .time-overlay {
        position: fixed;
        inset: 0;
        z-index: 200;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(17, 17, 27, 0.72);
        backdrop-filter: blur(4px);
      }

      .time-dialog {
        display: flex;
        width: min(460px, 100%);
        flex-direction: column;
        gap: 14px;
        padding: 20px;
        border: 1px solid var(--color-border-strong);
        border-radius: 10px;
        background-color: var(--color-bg-elevated);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      }

      .time-dialog-head {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .time-dialog-kicker {
        font-size: 8px;
        letter-spacing: 0.18em;
        color: var(--color-text-subtle);
      }

      .time-dialog-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.08em;
        color: var(--color-accent);
      }

      .time-dialog-sub {
        margin: 0;
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-text-muted);
      }

      .duration-row {
        display: flex;
        gap: 10px;
      }

      .duration-field {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 5px;
        min-width: 0;
      }

      .duration-input {
        width: 100%;
        min-width: 0;
        padding: 10px 6px;
        border: 1px solid var(--color-border-strong);
        border-radius: 6px;
        background-color: var(--color-bg-sunken);
        color: var(--color-text);
        font-family: inherit;
        font-size: 20px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }

      .duration-input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .duration-field span {
        font-size: 9px;
        letter-spacing: 0.1em;
        color: var(--color-text-subtle);
      }

      .preset-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .preset-button {
        padding: 5px 9px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-bg-sunken);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 8px;
        letter-spacing: 0.08em;
        cursor: pointer;
      }

      .preset-button:hover {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .time-summary {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid var(--color-border);
      }

      .time-total {
        flex: 1;
        font-size: 10px;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .time-effect {
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 8px;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }

      .time-effect.gain,
      .time-effect.free {
        color: var(--ctp-green);
        border-color: rgba(166, 227, 161, 0.3);
      }

      .time-effect.cost {
        color: var(--ctp-yellow);
        border-color: rgba(249, 226, 175, 0.3);
      }

      .time-effect.bad {
        color: var(--ctp-red);
        border-color: rgba(243, 139, 168, 0.3);
      }

      .time-warning {
        margin: 0;
        padding: 8px 10px;
        border: 1px solid rgba(249, 226, 175, 0.3);
        border-radius: 6px;
        background-color: var(--color-bg-sunken);
        font-size: 9px;
        line-height: 1.5;
        color: var(--ctp-yellow);
      }

      .time-travel {
        padding: 8px;
        border: 1px solid var(--color-accent);
        border-radius: 6px;
        background-color: transparent;
        color: var(--color-accent);
        font-family: inherit;
        font-size: 9px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .time-travel:hover {
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
      }

      .time-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .time-cancel,
      .time-confirm {
        padding: 10px 12px;
        border-radius: 6px;
        font-family: inherit;
        font-size: 9px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .time-cancel {
        border: 1px solid var(--color-border-strong);
        background-color: transparent;
        color: var(--color-text-muted);
      }

      .time-cancel:hover {
        border-color: var(--color-text-muted);
        color: var(--color-text);
      }

      .time-confirm {
        border: 1px solid var(--color-accent);
        background-color: var(--color-accent);
        color: var(--color-accent-contrast);
      }

      .time-confirm:hover:not(:disabled) {
        background-color: var(--color-accent-hover);
        border-color: var(--color-accent-hover);
      }

      .time-confirm:disabled {
        opacity: 0.4;
        cursor: default;
      }
    </style>
  </>
}

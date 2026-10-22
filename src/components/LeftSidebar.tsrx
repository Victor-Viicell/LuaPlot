import { StatBar } from "./StatBar.tsrx";
import { propertyById, locationFor } from "../game/data";
import { formatCredits, heatMeter, initials } from "../game/format";
import { GameContext, type GameStore } from "../game/store";

function conditionLabel(game: GameStore): string {
  if (game.stats.satiety <= 0) {
    return "Starving";
  }

  if (game.stats.satiety < 20) {
    return "Hungry";
  }

  if (game.stats.hygiene < 15) {
    return "Grimy";
  }

  if (game.player.wanted >= 4) {
    return "Hunted";
  }

  if (game.stats.health < 30) {
    return "Critical";
  }

  if (game.stats.happiness < 25) {
    return "Burnt out";
  }

  if (game.stats.energy < 20) {
    return "Exhausted";
  }

  return "Stable";
}

function conditionTone(game: GameStore): string {
  if (
    game.stats.satiety <= 0 ||
    game.stats.health < 30 ||
    game.player.wanted >= 4
  ) {
    return "danger";
  }

  if (
    game.stats.satiety < 20 ||
    game.stats.hygiene < 15 ||
    game.stats.happiness < 25 ||
    game.stats.energy < 20
  ) {
    return "warn";
  }

  return "ok";
}

export function LeftSidebar() @{
  const game = GameContext.get();

  <>
    <div class="left-sidebar">
      <div class="inner-panel dossier">
        <header class="brand">
          <span class="brand-mark">N/L</span>
          <span class="brand-copy">
            <span class="brand-name">NEONLIFE</span>
            <span class="brand-sub">life sim // 0.1</span>
          </span>
        </header>

        <section class="identity">
          <div class="avatar">
            <span class="avatar-scan"></span>
            <span class="avatar-initials">{initials(game.player.name)}</span>
          </div>
          <div class="identity-copy">
            <h1>{game.player.name}</h1>
            <p>{game.player.pronouns} · {game.player.age} years</p>
            <p class="identity-job">{game.player.occupation}</p>
          </div>
        </section>

        <section class="panel-block">
          <h2 class="block-title">VITALS</h2>
          <div class="stat-list">
            <StatBar stat="health" />
            <StatBar stat="happiness" />
            <StatBar stat="energy" />
            <StatBar stat="satiety" />
            <StatBar stat="smarts" />
            <StatBar stat="looks" />
            <StatBar stat="streetCred" />
          </div>
        </section>

        <section class="panel-block">
          <h2 class="block-title">LEDGER</h2>
          <div class="wallet-row">
            <span>Credits</span>
            <strong class="wallet-credits">¥{formatCredits(game.player.credits)}</strong>
          </div>
          <div class="wallet-row">
            <span>Salary</span>
            <strong>¥{formatCredits(game.player.salary)}/yr</strong>
          </div>
          <div class="wallet-row">
            <span>{game.tenure.value === "own" ? "Upkeep" : "Rent"}</span>
            <strong>
              ¥{formatCredits(
                game.tenure.value === "own"
                  ? propertyById(game.home.value).upkeep
                  : propertyById(game.home.value).rent,
              )}/yr
            </strong>
          </div>
          <div class="wallet-row">
            <span>Heat</span>
            <strong class="wallet-heat">{heatMeter(game.player.wanted)}</strong>
          </div>
        </section>

        <section class="panel-block status-block">
          <h2 class="block-title">STATUS</h2>
          <div class="status-line">
            <span class={"status-dot " + conditionTone(game)}></span>
            {conditionLabel(game)}
          </div>
          <p class="status-meta">HOME · {propertyById(game.home.value).name}</p>
          <p class="status-meta">
            {"AT · " +
              locationFor(game.location.value, propertyById(game.home.value)).name}
          </p>
          <p class="status-meta">ORIGIN · {game.player.district}</p>
        </section>

        <footer class="sidebar-footer">THE CITY ALWAYS COLLECTS.</footer>
      </div>
    </div>

    <style>
      .left-sidebar {
        width: 400px;
        max-width: 400px;
        height: 100%;
        margin: 0;
        padding: 10px;
      }

      .dossier {
        display: flex;
        flex-direction: column;
        gap: 18px;
        height: 100%;
        padding: 20px;
        border: 1px solid var(--color-border);
        border-radius: 10px;
        overflow-y: auto;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border: 1px solid var(--color-accent);
        border-radius: 6px;
        color: var(--color-accent);
        font-size: 12px;
        letter-spacing: 0.06em;
        box-shadow: 0 0 18px rgba(203, 166, 247, 0.22);
      }

      .brand-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .brand-name {
        font-size: 15px;
        letter-spacing: 0.24em;
        color: var(--color-text);
      }

      .brand-sub {
        font-size: 9px;
        letter-spacing: 0.12em;
        color: var(--color-text-subtle);
      }

      .identity {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .avatar {
        position: relative;
        display: grid;
        place-items: center;
        width: 78px;
        height: 78px;
        flex-shrink: 0;
        border: 1px solid var(--color-border-strong);
        border-radius: 8px;
        background:
          radial-gradient(circle at 30% 20%, rgba(137, 220, 235, 0.18), transparent 55%),
          linear-gradient(150deg, var(--color-surface), var(--color-bg-sunken));
        overflow: hidden;
      }

      .avatar-scan {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent 0 3px,
          rgba(17, 17, 27, 0.28) 3px 4px
        );
      }

      .avatar-initials {
        position: relative;
        font-size: 24px;
        letter-spacing: 0.06em;
        color: var(--ctp-sky);
      }

      .identity-copy {
        min-width: 0;
      }

      .identity-copy h1 {
        margin: 0;
        font-size: 19px;
        line-height: 1.2;
        color: var(--color-text);
      }

      .identity-copy p {
        margin: 4px 0 0;
        font-size: 11px;
        color: var(--color-text-muted);
      }

      .identity-copy .identity-job {
        color: var(--color-accent);
      }

      .panel-block {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 14px;
        border-top: 1px solid var(--color-border);
      }

      .block-title {
        margin: 0;
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.18em;
        color: var(--color-text-subtle);
      }

      .stat-list {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .wallet-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        font-size: 11px;
        color: var(--color-text-muted);
      }

      .wallet-row strong {
        font-weight: 500;
        color: var(--color-text);
        font-variant-numeric: tabular-nums;
      }

      .wallet-row .wallet-credits {
        color: var(--ctp-teal);
      }

      .wallet-row .wallet-heat {
        color: var(--ctp-red);
        letter-spacing: 0.14em;
      }

      .status-line {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--color-text);
      }

      .status-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background-color: var(--ctp-green);
        box-shadow: 0 0 10px var(--ctp-green);
      }

      .status-dot.warn {
        background-color: var(--ctp-yellow);
        box-shadow: 0 0 10px var(--ctp-yellow);
      }

      .status-dot.danger {
        background-color: var(--ctp-red);
        box-shadow: 0 0 10px var(--ctp-red);
      }

      .status-meta {
        margin: 0;
        font-size: 9px;
        letter-spacing: 0.08em;
        color: var(--color-text-subtle);
      }

      .sidebar-footer {
        margin-top: auto;
        padding-top: 12px;
        font-size: 8px;
        letter-spacing: 0.22em;
        color: var(--color-text-subtle);
        opacity: 0.7;
      }
    </style>
  </>
}

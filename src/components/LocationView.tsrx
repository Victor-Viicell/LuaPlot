import { track } from "ripple";
import {
  districtFacts,
  isOpenNow,
  locationFor,
  propertyAnchor,
  propertyById,
  routeBetween,
} from "../game/data";
import {
  formatCount,
  formatCreditRange,
  formatDuration,
  formatHourWindow,
} from "../game/format";
import { GameContext } from "../game/store";
import { cityById } from "../game/world";
import { ActionList } from "./ActionList.tsrx";
import { HomeView } from "./HomeView.tsrx";

export function LocationView() @{
  const game = GameContext.get();

  const homeProperty = track(() => propertyById(game.home.value));
  const enteredId = track(
    () => game.enteredLocation.value ?? game.location.value,
  );
  const place = track(() => locationFor(enteredId.value, homeProperty.value));
  const isHome = track(() => enteredId.value === "home");
  const open = track(() =>
    isHome.value ? true : isOpenNow(place.value, game.clock.secondOfDay),
  );
  const facts = track(() => districtFacts(place.value.district));
  const homeRoute = track(() =>
    isHome.value
      ? null
      : routeBetween(
          enteredId.value,
          "home",
          propertyAnchor(homeProperty.value),
        ),
  );
  const homeEnergy = track(() =>
    homeRoute.value ? Math.max(1, Math.ceil(homeRoute.value.minutes / 12)) : 0,
  );

  function leave(): void {
    game.exitLocation();
  }

  <>
    <div class="location-view">
      <header class="place-head">
        <button class="place-back" onClick={leave}>
          ← CITY MAP
        </button>
        <div class="place-title">
          <span class="place-kicker">
            {place.value.district.toUpperCase() +
              " // " +
              place.value.kind.toUpperCase()}
          </span>
          <h1 class="place-name">
            {isHome.value ? homeProperty.value.name : place.value.name}
          </h1>
          <span class="place-meta">
            {place.value.address +
              " · " +
              formatHourWindow(place.value.openHours)}
          </span>
        </div>
        <span class={"place-state " + (open.value ? "open" : "closed")}>
          {open.value ? "OPEN" : "CLOSED"}
        </span>
      </header>

      <div class="place-body">
        <main class="place-main">
          <p class="place-desc">
            {isHome.value
              ? homeProperty.value.description
              : place.value.description}
          </p>

          <div class="place-tags">
            @for (const service of place.value.services; key service) {
              <span class="place-tag">{service}</span>
            }
          </div>

          @if (isHome.value) {
            <HomeView />
          } @else {
            <ActionList hereOnly={true} />
          }

          @if (!open.value) {
            <p class="place-warning">
              Closed until {formatHourWindow(place.value.openHours)}. You can
              stay, but the services here are shut.
            </p>
          }
        </main>

        <aside class="place-side">
          @if (facts.value) {
            <>
              <section class="side-block">
                <span class="side-label">DISTRICT</span>
                <strong class="side-strong">{facts.value.name}</strong>
                <div class="side-metrics">
                  <span>{formatCount(facts.value.placeCount, "PLACE")}</span>
                  <span>
                    {formatCount(facts.value.services.length, "SERVICE")}
                  </span>
                </div>
                @if (facts.value.rentRange) {
                  <p class="side-rent">
                    {"RENT " + formatCreditRange(facts.value.rentRange, "/YR")}
                  </p>
                }
                <p class="side-text">{facts.value.blurb}</p>
              </section>

              <section class="side-block">
                <span class="side-label">AROUND HERE</span>
                <div class="side-tags">
                  @for (const service of facts.value.services; key service) {
                    <span class="side-tag">{service}</span>
                  }
                </div>
              </section>
            </>
          }

          @if (homeRoute.value) {
            <section class="side-block">
              <span class="side-label">GETTING HOME</span>
              <strong class="side-strong">
                {formatDuration(homeRoute.value.minutes * 60) +
                  " · −" +
                  homeEnergy.value +
                  " EN"}
              </strong>
              <p class="side-text">
                {homeProperty.value.name + " · " + homeProperty.value.district}
              </p>
              <button class="side-map" onClick={leave}>
                SHOW ON MAP
              </button>
            </section>
          }

          <section class="side-block">
            <span class="side-label">ADDRESS</span>
            <p class="side-text">{place.value.address ?? "No fixed address"}</p>
            <p class="side-text">
              {place.value.cityId
                ? cityById(place.value.cityId).name.toUpperCase()
                : "—"}
            </p>
          </section>
        </aside>
      </div>
    </div>

    <style>
      .location-view {
        display: flex;
        flex: 1;
        min-width: 0;
        height: 100%;
        flex-direction: column;
        background-color: var(--color-bg-sunken);
      }

      .place-head {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-shrink: 0;
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border);
        background-color: var(--color-bg-elevated);
      }

      .place-back {
        flex-shrink: 0;
        padding: 6px 9px;
        border: 1px solid var(--color-border-strong);
        border-radius: 5px;
        background-color: transparent;
        color: var(--color-text-subtle);
        font-size: 8px;
        letter-spacing: 0.12em;
        cursor: pointer;
      }

      .place-back:hover {
        border-color: var(--ctp-sky);
        color: var(--ctp-sky);
      }

      .place-title {
        display: flex;
        flex: 1;
        min-width: 0;
        flex-direction: column;
        gap: 2px;
      }

      .place-kicker {
        font-size: 8px;
        letter-spacing: 0.12em;
        color: var(--color-text-subtle);
      }

      .place-name {
        margin: 0;
        font-size: 21px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--color-text);
      }

      .place-meta {
        font-size: 9px;
        letter-spacing: 0.04em;
        color: var(--color-text-subtle);
      }

      .place-state {
        flex-shrink: 0;
        padding: 3px 8px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 8px;
        letter-spacing: 0.12em;
      }

      .place-state.open {
        color: var(--ctp-green);
        border-color: rgba(166, 227, 161, 0.35);
      }

      .place-state.closed {
        color: var(--ctp-red);
        border-color: rgba(243, 139, 168, 0.35);
      }

      .place-body {
        display: flex;
        flex: 1;
        min-height: 0;
        align-items: stretch;
      }

      .place-main {
        display: flex;
        flex: 1;
        min-width: 0;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        overflow-y: auto;
      }

      .place-main .home-view {
        overflow: visible;
      }

      .place-desc {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: var(--color-text-muted);
      }

      .place-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .place-tag {
        padding: 2px 7px;
        border: 1px solid rgba(137, 220, 235, 0.28);
        border-radius: 4px;
        background-color: var(--color-bg-elevated);
        font-size: 8px;
        letter-spacing: 0.05em;
        color: var(--ctp-sky);
      }

      .place-warning {
        margin: 0;
        padding: 9px 10px;
        border: 1px solid rgba(249, 226, 175, 0.3);
        border-radius: 6px;
        font-size: 10px;
        line-height: 1.5;
        color: var(--ctp-yellow);
      }

      .place-side {
        display: flex;
        width: 250px;
        flex-shrink: 0;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        border-left: 1px solid var(--color-border);
        background-color: var(--color-bg-elevated);
        overflow-y: auto;
      }

      .side-block {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px;
        border: 1px solid var(--color-border);
        border-radius: 7px;
        background-color: var(--color-surface);
      }

      .side-label {
        font-size: 7px;
        letter-spacing: 0.14em;
        color: var(--color-text-subtle);
      }

      .side-strong {
        font-size: 11px;
        font-weight: 500;
        color: var(--color-text);
        font-variant-numeric: tabular-nums;
      }

      .side-text {
        margin: 0;
        font-size: 9px;
        line-height: 1.5;
        color: var(--color-text-subtle);
      }

      .side-metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        font-size: 8px;
        color: var(--color-text-muted);
      }

      .side-rent {
        margin: 0;
        font-size: 8px;
        letter-spacing: 0.04em;
        color: var(--ctp-peach);
      }

      .side-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .side-tag {
        padding: 1px 5px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 7px;
        color: var(--color-text-muted);
      }

      .side-map {
        margin-top: 3px;
        padding: 6px 8px;
        border: 1px solid var(--ctp-sky);
        border-radius: 5px;
        background-color: transparent;
        color: var(--ctp-sky);
        font-size: 8px;
        letter-spacing: 0.1em;
        cursor: pointer;
      }

      .side-map:hover {
        background-color: var(--ctp-sky);
        color: var(--ctp-crust);
      }

      @media (max-width: 1100px) {
        .place-side {
          width: 210px;
        }
      }
    </style>
  </>
}

import { RippleObject, track } from "ripple";
import {
  districtFacts,
  isOpenNow,
  locationById,
  locationFor,
  mapEdges,
  mapNodes,
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
import type { Location } from "../game/types";
import { DEFAULT_CITY_ID, cityById } from "../game/world";

const VIEW_WIDTH = 880;
const MIN_VIEW_WIDTH = 340;
const PAN_THRESHOLD = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function MapView() @{
  const game = GameContext.get();
  const city = cityById(DEFAULT_CITY_ID);
  const aspect = city.map.width / city.map.height;
  const regions = city.map.regions;

  const homeProperty = track(() => propertyById(game.home.value));
  const homeAnchor = track(() => propertyAnchor(homeProperty.value));
  const nodes = track(() => mapNodes(homeAnchor.value));
  const edges = track(() => mapEdges(homeAnchor.value));
  const current = track(() =>
    locationFor(game.location.value, homeProperty.value),
  );
  const selectedId = track<string | null>(null);
  const selected = track<Location>(() =>
    selectedId.value
      ? locationFor(selectedId.value, homeProperty.value)
      : current.value,
  );
  const selectedOpen = track(() =>
    selectedId.value === "home"
      ? true
      : isOpenNow(selected.value, game.clock.secondOfDay),
  );
  const here = track(
    () => selectedId.value !== null && selectedId.value === game.location.value,
  );
  const route = track(() =>
    selectedId.value
      ? routeBetween(game.location.value, selectedId.value, homeAnchor.value)
      : { minutes: 0, path: [] as string[] },
  );
  const routeStops = track(() =>
    route.value.path.slice(1, -1).map((id) => locationById(id).name),
  );
  const travelEnergy = track(() =>
    here.value ? 0 : Math.max(1, Math.ceil(route.value.minutes / 12)),
  );
  const hood = track(() => districtFacts(selected.value.district));
  const selectedName = track(() =>
    selectedId.value ? displayName(selectedId.value) : "",
  );

  const pan = new RippleObject({
    x: clamp((city.map.width - VIEW_WIDTH) / 2, 0, city.map.width - VIEW_WIDTH),
    y: clamp(
      (city.map.height - VIEW_WIDTH / aspect) / 2,
      0,
      city.map.height - VIEW_WIDTH / aspect,
    ),
    w: VIEW_WIDTH,
    h: VIEW_WIDTH / aspect,
  });

  let drag: {
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null = null;
  let suppressClick = false;

  function viewBox(): string {
    return `${pan.x} ${pan.y} ${pan.w} ${pan.h}`;
  }

  function setViewWidth(next: number): void {
    const width = clamp(next, MIN_VIEW_WIDTH, city.map.width);
    const height = width / aspect;
    const centerX = pan.x + pan.w / 2;
    const centerY = pan.y + pan.h / 2;

    pan.w = width;
    pan.h = height;
    pan.x = clamp(centerX - width / 2, 0, city.map.width - width);
    pan.y = clamp(centerY - height / 2, 0, city.map.height - height);
  }

  function centerOn(id: string): void {
    const node = nodes.value.find((entry) => entry.locationId === id);
    if (!node) {
      return;
    }

    pan.x = clamp(node.x - pan.w / 2, 0, city.map.width - pan.w);
    pan.y = clamp(node.y - pan.h / 2, 0, city.map.height - pan.h);
  }

  function beginPan(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    suppressClick = false;
    (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
  }

  function movePan(event: PointerEvent): void {
    if (!drag) {
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > PAN_THRESHOLD) {
      drag.moved = true;
    }

    if (!drag.moved) {
      return;
    }

    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const scale =
      rect.width > 0 && rect.height > 0
        ? Math.max(rect.width / pan.w, rect.height / pan.h)
        : 1;
    const step = scale > 0 ? 1 / scale : 1;

    pan.x = clamp(drag.originX - dx * step, 0, city.map.width - pan.w);
    pan.y = clamp(drag.originY - dy * step, 0, city.map.height - pan.h);
  }

  function endPan(): void {
    if (drag?.moved) {
      suppressClick = true;
    }
    drag = null;
  }

  function selectNode(id: string): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    selectedId.value = id;
  }

  function clearSelection(): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    selectedId.value = null;
  }

  function travel(): void {
    if (selected.value) {
      game.travelTo(selected.value);
    }
  }

  function enter(): void {
    if (selectedId.value && here.value) {
      game.enterLocation(selectedId.value);
    }
  }

  function displayName(id: string): string {
    return id === "home" ? homeProperty.value.name : locationById(id).name;
  }

  function displaySub(id: string): string {
    return id === "home" ? "HOME" : locationById(id).district.toUpperCase();
  }

  function nodeOpen(id: string): boolean {
    return id === "home"
      ? true
      : isOpenNow(locationById(id), game.clock.secondOfDay);
  }

  function nodeOf(id: string) {
    return nodes.value.find((node) => node.locationId === id) ?? nodes.value[0];
  }

  function edgeOnRoute(from: string, to: string): boolean {
    const path = route.value.path;
    for (let index = 0; index < path.length - 1; index += 1) {
      if (
        (path[index] === from && path[index + 1] === to) ||
        (path[index] === to && path[index + 1] === from)
      ) {
        return true;
      }
    }
    return false;
  }

  <>
    <div class="map-view">
      <svg
        class="map-canvas"
        viewBox={viewBox()}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={"City map of " + city.name}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <defs>
          <pattern
            id="map-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(205, 214, 244, 0.055)"
              stroke-width="1"
            ></path>
          </pattern>
          <radialGradient id="map-glow" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stop-color="rgba(203, 166, 247, 0.1)"></stop>
            <stop offset="60%" stop-color="rgba(137, 220, 235, 0.04)"></stop>
            <stop offset="100%" stop-color="rgba(17, 17, 27, 0)"></stop>
          </radialGradient>
        </defs>

        <rect
          class="map-bg"
          x="0"
          y="0"
          width={city.map.width}
          height={city.map.height}
          fill="url(#map-grid)"
          onClick={clearSelection}
        ></rect>
        <rect
          class="map-glow"
          x="0"
          y="0"
          width={city.map.width}
          height={city.map.height}
          fill="url(#map-glow)"
          pointer-events="none"
        ></rect>
        <path
          class="map-river"
          d="M 20 620 C 200 560, 320 640, 480 566 S 760 624, 980 540"
        ></path>
        <path
          class="map-ring"
          d="M 140 240 C 260 110, 540 110, 710 200 S 950 360, 860 548 S 540 612, 360 540 S 110 420, 140 240 Z"
        ></path>

        @for (const edge of edges.value; key edge.id) {
          <line
            class={
              "map-edge " + (edgeOnRoute(edge.from, edge.to) ? "on-route" : "")
            }
            x1={nodeOf(edge.from).x}
            y1={nodeOf(edge.from).y}
            x2={nodeOf(edge.to).x}
            y2={nodeOf(edge.to).y}
          ></line>
        }

        @for (const region of regions; key region.id) {
          <text class="region-label" x={region.x} y={region.y}>
            {region.label}
          </text>
        }

        @for (const node of nodes.value; key node.locationId) {
          <g
            class={
              "map-node " +
              (node.locationId === game.location.value ? "current " : "") +
              (node.locationId === selectedId.value ? "selected " : "") +
              (nodeOpen(node.locationId) ? "" : "closed")
            }
            onClick={(event) => {
              event.stopPropagation();
              selectNode(node.locationId);
            }}
          >
            <circle class="node-halo" cx={node.x} cy={node.y} r="26"></circle>
            <circle class="node-dot" cx={node.x} cy={node.y} r="9"></circle>
            <text class="node-label" x={node.x} y={node.y + 38}>
              {displayName(node.locationId)}
            </text>
            <text class="node-sub" x={node.x} y={node.y + 53}>
              {displaySub(node.locationId)}
            </text>
            @if (node.locationId === game.location.value) {
              <text class="node-you" x={node.x} y={node.y - 22}>
                YOU
              </text>
            }
          </g>
        }
      </svg>

      <div class="map-hud">
        <div class="hud-title">
          <span class="hud-city">
            {city.name.toUpperCase() + " // CITY GRID"}
          </span>
          <span class="hud-hint">DRAG TO PAN · CLICK A PLACE</span>
        </div>
        <div class="hud-legend">
          <span class="legend-dot current"></span>
          YOU
          <span class="legend-dot open"></span>
          OPEN
          <span class="legend-dot closed"></span>
          CLOSED
        </div>
      </div>

      <div class="map-controls">
        <button
          class="map-control"
          title="Zoom in"
          onClick={() => setViewWidth(pan.w * 0.75)}
        >
          +
        </button>
        <button
          class="map-control"
          title="Zoom out"
          onClick={() => setViewWidth(pan.w * 1.33)}
        >
          −
        </button>
        <button
          class="map-control"
          title="Center on my location"
          onClick={() => centerOn(game.location.value)}
        >
          ⌖
        </button>
      </div>

      @if (selectedId.value) {
        <aside class="map-card">
          <div class="card-head">
            <span class="card-kicker">
              {selected.value.district.toUpperCase()}
            </span>
            <div class="card-head-actions">
              <span
                class={"card-state " + (selectedOpen.value ? "open" : "closed")}
              >
                {selectedOpen.value ? "OPEN" : "CLOSED"}
              </span>
              <button
                class="card-close"
                title="Close"
                onClick={() => {
                  selectedId.value = null;
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <h2 class="card-name">{selectedName.value}</h2>
          <p class="card-desc">{selected.value.description}</p>

          <div class="card-tags">
            <span class="card-tag">{selected.value.kind.toUpperCase()}</span>
            <span class="card-tag">
              {formatHourWindow(selected.value.openHours)}
            </span>
            @if (selected.value.address) {
              <span class="card-tag address">{selected.value.address}</span>
            }
            @if (selectedId.value === "home") {
              <>
                <span class="card-tag service">{homeProperty.value.name}</span>
                <span class="card-tag">
                  {game.tenure.value === "own" ? "OWNED" : "RENTED"}
                </span>
              </>
            }
            @for (const service of selected.value.services; key service) {
              <span class="card-tag service">{service}</span>
            }
          </div>

          @if (hood.value) {
            <div class="card-hood">
              <div class="hood-head">
                <span class="hood-label">DISTRICT</span>
                <span class="hood-count">
                  {formatCount(hood.value.placeCount, "PLACE")}
                </span>
              </div>
              @if (hood.value.rentRange) {
                <p class="hood-rent">
                  {"RENT " + formatCreditRange(hood.value.rentRange, "/YR")}
                </p>
              }
              <p class="hood-blurb">{hood.value.blurb}</p>
            </div>
          }

          <div class="card-route">
            <span class="route-label">
              {"ROUTE FROM " + current.value.name}
            </span>
            @if (here.value) {
              <strong class="route-value here">YOU ARE HERE</strong>
            } @else {
              <>
                <strong class="route-value">
                  {formatDuration(route.value.minutes * 60) +
                    " · −" +
                    travelEnergy.value +
                    " EN"}
                </strong>
                @if (routeStops.value.length > 0) {
                  <span class="route-via">
                    {"VIA " + routeStops.value.join(" · ")}
                  </span>
                }
              </>
            }
          </div>

          @if (here.value) {
            <button class="card-enter" onClick={enter}>
              ENTER HERE
            </button>
          } @else {
            <button class="card-travel" onClick={travel}>
              TRAVEL
            </button>
          }

          @if (!selectedOpen.value) {
            <p class="card-warning">
              Closed. Travel is possible, but services stay shut until
              {" " + formatHourWindow(selected.value.openHours)}.
            </p>
          }
        </aside>
      }
    </div>

    <style>
      .map-view {
        position: relative;
        flex: 1;
        min-width: 0;
        height: 100%;
        background:
          radial-gradient(
            circle at 72% 18%,
            rgba(203, 166, 247, 0.08),
            transparent 45%
          ),
          radial-gradient(
            circle at 18% 82%,
            rgba(137, 220, 235, 0.07),
            transparent 45%
          ),
          var(--color-bg-sunken);
        overflow: hidden;
        user-select: none;
      }

      .map-canvas {
        display: block;
        width: 100%;
        height: 100%;
        cursor: grab;
        touch-action: none;
      }

      .map-canvas:active {
        cursor: grabbing;
      }

      .map-bg {
        fill: url(#map-grid);
      }

      .map-glow {
        pointer-events: none;
      }

      .map-river {
        fill: none;
        stroke: rgba(137, 220, 235, 0.12);
        stroke-width: 18;
        stroke-linecap: round;
        pointer-events: none;
      }

      .map-ring {
        fill: none;
        stroke: rgba(203, 166, 247, 0.1);
        stroke-width: 2;
        stroke-dasharray: 4 9;
        pointer-events: none;
      }

      .map-edge {
        stroke: var(--color-border-strong);
        stroke-width: 2;
        opacity: 0.55;
        pointer-events: none;
      }

      .map-edge.on-route {
        stroke: var(--ctp-sky);
        stroke-width: 3;
        opacity: 1;
        filter: drop-shadow(0 0 6px rgba(137, 220, 235, 0.55));
      }

      .map-node {
        cursor: pointer;
      }

      .node-halo {
        fill: transparent;
        stroke: transparent;
        stroke-width: 2;
        transition:
          fill 140ms ease,
          stroke 140ms ease;
      }

      .map-node:hover .node-halo {
        fill: rgba(205, 214, 244, 0.05);
        stroke: var(--color-border-strong);
      }

      .map-node.selected .node-halo {
        fill: rgba(203, 166, 247, 0.08);
        stroke: var(--ctp-mauve);
      }

      .map-node.current .node-halo {
        stroke: var(--ctp-mauve);
        stroke-dasharray: 3 4;
      }

      .node-dot {
        fill: var(--ctp-sky);
        stroke: var(--color-bg-sunken);
        stroke-width: 2;
      }

      .map-node.selected .node-dot {
        fill: var(--ctp-pink);
      }

      .map-node.current .node-dot {
        fill: var(--ctp-mauve);
        filter: drop-shadow(0 0 8px var(--ctp-mauve));
      }

      .map-node.closed .node-dot {
        fill: var(--ctp-overlay-1);
      }

      .node-label {
        fill: var(--color-text);
        font-size: 20px;
        text-anchor: middle;
        pointer-events: none;
      }

      .node-sub {
        fill: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.06em;
        text-anchor: middle;
        pointer-events: none;
      }

      .node-you {
        fill: var(--ctp-mauve);
        font-size: 12px;
        letter-spacing: 0.12em;
        text-anchor: middle;
        pointer-events: none;
      }

      .region-label {
        fill: var(--color-text-subtle);
        font-size: 11px;
        letter-spacing: 0.18em;
        opacity: 0.5;
        pointer-events: none;
      }

      .map-hud {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid var(--color-border);
        border-radius: 7px;
        background-color: rgba(17, 17, 27, 0.72);
        backdrop-filter: blur(4px);
        pointer-events: none;
      }

      .hud-title {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }

      .hud-city {
        font-size: 9px;
        letter-spacing: 0.16em;
        color: var(--ctp-sky);
      }

      .hud-hint {
        font-size: 7px;
        letter-spacing: 0.1em;
        color: var(--color-text-subtle);
      }

      .hud-legend {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 7px;
        letter-spacing: 0.1em;
        color: var(--color-text-subtle);
      }

      .legend-dot {
        width: 7px;
        height: 7px;
        margin-left: 5px;
        border-radius: 999px;
        background-color: var(--ctp-overlay-1);
      }

      .legend-dot.current {
        background-color: var(--ctp-mauve);
        box-shadow: 0 0 8px var(--ctp-mauve);
      }

      .legend-dot.open {
        background-color: var(--ctp-green);
      }

      .map-controls {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .map-control {
        display: grid;
        place-items: center;
        width: 27px;
        height: 27px;
        padding: 0;
        border: 1px solid var(--color-border-strong);
        border-radius: 5px;
        background-color: rgba(17, 17, 27, 0.78);
        color: var(--color-text-muted);
        font-size: 13px;
        line-height: 1;
        cursor: pointer;
        backdrop-filter: blur(4px);
      }

      .map-control:hover {
        border-color: var(--ctp-sky);
        color: var(--ctp-sky);
      }

      .map-card {
        position: absolute;
        top: 54px;
        right: 12px;
        display: flex;
        width: min(300px, calc(100% - 24px));
        max-height: calc(100% - 66px);
        flex-direction: column;
        gap: 9px;
        padding: 13px;
        border: 1px solid var(--color-border-strong);
        border-radius: 9px;
        background-color: rgba(24, 24, 37, 0.93);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
        overflow-y: auto;
        backdrop-filter: blur(6px);
      }

      .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .card-kicker {
        font-size: 7px;
        letter-spacing: 0.14em;
        color: var(--color-text-subtle);
      }

      .card-head-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .card-state {
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 7px;
        letter-spacing: 0.1em;
      }

      .card-state.open {
        color: var(--ctp-green);
        border-color: rgba(166, 227, 161, 0.35);
      }

      .card-state.closed {
        color: var(--ctp-red);
        border-color: rgba(243, 139, 168, 0.35);
      }

      .card-close {
        padding: 0 5px;
        border: 0;
        background-color: transparent;
        color: var(--color-text-subtle);
        font-size: 11px;
        line-height: 1.3;
        cursor: pointer;
      }

      .card-close:hover {
        color: var(--ctp-red);
      }

      .card-name {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        color: var(--color-text);
      }

      .card-desc {
        margin: 0;
        font-size: 10px;
        line-height: 1.55;
        color: var(--color-text-muted);
      }

      .card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .card-tag {
        padding: 2px 6px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-bg-sunken);
        font-size: 8px;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
      }

      .card-tag.service {
        color: var(--ctp-sky);
        border-color: rgba(137, 220, 235, 0.28);
      }

      .card-tag.address {
        color: var(--color-text-subtle);
      }

      .card-hood {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 9px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-sunken);
      }

      .hood-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }

      .hood-label {
        font-size: 7px;
        letter-spacing: 0.12em;
        color: var(--color-text-subtle);
      }

      .hood-count {
        font-size: 7px;
        letter-spacing: 0.1em;
        color: var(--ctp-peach);
      }

      .hood-rent {
        margin: 0;
        font-size: 8px;
        letter-spacing: 0.05em;
        color: var(--ctp-peach);
      }

      .hood-blurb {
        margin: 0;
        font-size: 9px;
        line-height: 1.45;
        color: var(--color-text-subtle);
      }

      .card-route {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 8px 9px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background-color: var(--color-bg-sunken);
      }

      .route-label {
        font-size: 7px;
        letter-spacing: 0.12em;
        color: var(--color-text-subtle);
      }

      .route-value {
        font-size: 12px;
        font-weight: 500;
        color: var(--ctp-sky);
        font-variant-numeric: tabular-nums;
      }

      .route-value.here {
        color: var(--ctp-mauve);
        letter-spacing: 0.1em;
      }

      .route-via {
        font-size: 8px;
        color: var(--color-text-subtle);
      }

      .card-travel,
      .card-enter {
        padding: 9px 10px;
        border-radius: 6px;
        font-family: inherit;
        font-size: 9px;
        letter-spacing: 0.14em;
        cursor: pointer;
      }

      .card-travel {
        border: 1px solid var(--ctp-sky);
        background-color: transparent;
        color: var(--ctp-sky);
      }

      .card-travel:hover {
        background-color: var(--ctp-sky);
        color: var(--ctp-crust);
      }

      .card-enter {
        border: 1px solid var(--ctp-mauve);
        background-color: rgba(203, 166, 247, 0.12);
        color: var(--ctp-mauve);
      }

      .card-enter:hover {
        background-color: var(--ctp-mauve);
        color: var(--ctp-crust);
      }

      .card-warning {
        margin: 0;
        padding: 8px 9px;
        border: 1px solid rgba(249, 226, 175, 0.3);
        border-radius: 6px;
        font-size: 9px;
        line-height: 1.5;
        color: var(--ctp-yellow);
      }
    </style>
  </>
}

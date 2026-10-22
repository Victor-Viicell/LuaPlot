import { Context, RippleArray, RippleObject, track, type Tracked } from "ripple";
import {
  HUNGER_PER_HOUR,
  NPC_DISTRICTS,
  NPC_FIRST_NAMES,
  NPC_LAST_NAMES,
  NPC_REPLIES,
  SEASONS,
  SEASON_DAYS,
  STAT_KEYS,
  STAT_LABELS,
  WAIT_ENERGY_PER_HOUR,
  activeLifeEvents,
  hotelRestPerHour,
  isHourInWindow,
  isOpenNow,
  LOCATIONS,
  locationById,
  locationFor,
  propertyAnchor,
  propertyById,
  randomFrom,
  randomInt,
  randomNpc,
  routeBetween,
} from "./data";
import {
  formatClock,
  formatCredits,
  formatDuration,
  formatHourWindow,
  signedCredits,
} from "./format";
import {
  furnitureSlotsUsed,
  furnitureWithFeature,
  installedInCategory,
} from "./furniture";
import type {
  ActionOutcome,
  Consumable,
  FurnitureOption,
  GameAction,
  GameClock,
  InterfaceId,
  ItemOption,
  LedgerEntry,
  Location,
  LogEntry,
  LogTone,
  Npc,
  NpcInteraction,
  Player,
  PlayerStats,
  Property,
  StatDelta,
  StatKey,
  SupplyEntry,
  Tenure,
  ThemeName,
  TimeDialog,
  TimeMode,
} from "./types";

export type GameStore = {
  player: RippleObject<Player>;
  stats: RippleObject<PlayerStats>;
  clock: RippleObject<GameClock>;
  npcs: RippleArray<Npc>;
  log: RippleArray<LogEntry>;
  ledger: RippleArray<LedgerEntry>;
  owned: RippleArray<string>;
  supplies: RippleArray<SupplyEntry>;
  furniture: RippleArray<string>;
  home: Tracked<string>;
  tenure: Tracked<Tenure>;
  location: Tracked<string>;
  activeInterface: Tracked<InterfaceId | null>;
  enteredLocation: Tracked<string | null>;
  logOpen: Tracked<boolean>;
  theme: Tracked<ThemeName>;
  timeDialog: RippleObject<TimeDialog>;
  setInterface: (id: InterfaceId | null) => void;
  enterLocation: (id: string) => void;
  exitLocation: () => void;
  toggleLog: () => void;
  advanceTime: (hours: number) => void;
  openTimeDialog: (mode: TimeMode) => void;
  closeTimeDialog: () => void;
  sleepFor: (seconds: number) => void;
  waitFor: (seconds: number) => void;
  restFor: (seconds: number) => void;
  travelTo: (location: Location) => void;
  runAction: (action: GameAction) => void;
  actionBlockReason: (action: GameAction) => string | null;
  vendorBlockReason: (kind: "supplies" | "assets" | "cyberware") => string | null;
  interactNpc: (npc: Npc, kind: NpcInteraction) => void;
  meetNpc: () => void;
  acquire: (item: ItemOption) => void;
  moveHome: (property: Property, tenure: Tenure) => void;
  installFurniture: (item: FurnitureOption) => void;
  sellFurniture: (item: FurnitureOption) => void;
  hasHomeFeature: (feature: string) => boolean;
  buyConsumable: (item: Consumable) => void;
  consume: (item: Consumable) => void;
  supplyCount: (id: string) => number;
  setTheme: (theme: ThemeName) => void;
  reset: () => void;
};

export const GameContext = new Context<GameStore>();

let nextId = 1;

function id(): number {
  const value = nextId;
  nextId += 1;
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function startingPlayer(): Player {
  return {
    name: `${randomFrom(NPC_FIRST_NAMES)} ${randomFrom(NPC_LAST_NAMES)}`,
    age: 22,
    pronouns: randomFrom(["they/them", "she/her", "he/him"]),
    district: randomFrom(NPC_DISTRICTS),
    occupation: "Unemployed",
    salary: 0,
    credits: 2500,
    wanted: 0,
  };
}

function startingStats(): PlayerStats {
  return {
    health: randomInt(74, 92),
    happiness: randomInt(55, 72),
    energy: randomInt(82, 100),
    satiety: randomInt(70, 90),
    hygiene: randomInt(60, 85),
    smarts: randomInt(40, 60),
    looks: randomInt(45, 68),
    streetCred: randomInt(8, 18),
  };
}

const INTERACTION_COSTS: Record<
  NpcInteraction,
  {
    credits: number;
    energy: number;
    time: number;
    happiness: number;
    relationship: number;
    minRelationship?: number;
  }
> = {
  message: { credits: 0, energy: -1, time: 0.25, happiness: 1, relationship: 3 },
  hangout: { credits: 80, energy: -10, time: 3, happiness: 6, relationship: 8 },
  gift: { credits: 300, energy: 0, time: 1, happiness: 3, relationship: 14 },
  date: {
    credits: 150,
    energy: -6,
    time: 4,
    happiness: 8,
    relationship: 10,
    minRelationship: 40,
  },
};

const START_YEAR = 2087;
const START_HOUR = 7;

export function createGameStore(): GameStore {
  const player = new RippleObject<Player>(startingPlayer());
  const stats = new RippleObject<PlayerStats>(startingStats());
  const clock = new RippleObject<GameClock>({
    year: START_YEAR,
    season: 0,
    day: 1,
    secondOfDay: START_HOUR * 3600,
  });
  const npcs = new RippleArray<Npc>(randomNpc(), randomNpc(), randomNpc());
  const log = new RippleArray<LogEntry>();
  const ledger = new RippleArray<LedgerEntry>();
  const owned = new RippleArray<string>();
  const supplies = new RippleArray<SupplyEntry>();
  const furniture = new RippleArray<string>("bed-mat");
  const usedThisYear = new RippleArray<string>();
  const home = track<string>("lantern-capsule");
  const tenure = track<Tenure>("rent");
  const location = track<string>("home");
  const activeInterface = track<InterfaceId | null>(null);
  const enteredLocation = track<string | null>(null);
  const logOpen = track(false);
  const theme = track<ThemeName>("mocha");
  const timeDialog = new RippleObject<TimeDialog>({
    mode: null,
    hours: 8,
    minutes: 0,
    seconds: 0,
  });

  function setStat(key: StatKey, value: number): void {
    stats[key] = clamp(Math.round(value * 10) / 10, 0, 100);
  }

  function currentPlace(): Location {
    return locationFor(location.value, propertyById(home.value));
  }

  function applyStats(delta: StatDelta | undefined): void {
    if (!delta) {
      return;
    }

    for (const key of STAT_KEYS) {
      const amount = delta[key];
      if (amount) {
        setStat(key, stats[key] + amount);
      }
    }
  }

  function appendLog(text: string, tone: LogTone): void {
    log.unshift({
      id: id(),
      age: player.age,
      time: formatClock(clock.secondOfDay),
      text,
      tone,
    });
    if (log.length > 80) {
      log.length = 80;
    }
  }

  function addLedger(label: string, amount: number): void {
    if (!amount) {
      return;
    }

    ledger.unshift({ id: id(), age: player.age, label, amount });
    if (ledger.length > 50) {
      ledger.length = 50;
    }
  }

  function adjustCredits(amount: number, label?: string): void {
    player.credits = Math.max(0, Math.round(player.credits + amount));
    if (label) {
      addLedger(label, amount);
    }
  }

  function rollOutcome(outcomes: ActionOutcome[]): ActionOutcome {
    const roll = Math.random();
    let cumulative = 0;

    for (const outcome of outcomes) {
      cumulative += outcome.chance;
      if (roll <= cumulative) {
        return outcome;
      }
    }

    return outcomes[outcomes.length - 1];
  }

  function applyOutcome(outcome: ActionOutcome): void {
    let credits = outcome.credits ?? 0;
    if (outcome.creditsRange) {
      credits = randomInt(outcome.creditsRange[0], outcome.creditsRange[1]);
    }

    if (credits) {
      adjustCredits(credits, credits > 0 ? "Payout" : "Loss");
    }

    applyStats(outcome.stats);

    if (outcome.wanted) {
      player.wanted = clamp(player.wanted + outcome.wanted, 0, 5);
    }

    if (outcome.occupation) {
      player.occupation = outcome.occupation;
    }

    if (outcome.setSalary !== undefined) {
      player.salary = outcome.setSalary;
    }

    if (outcome.salary) {
      player.salary = Math.max(0, player.salary + outcome.salary);
    }

    const suffix = credits ? ` (${signedCredits(credits)})` : "";
    appendLog(outcome.text + suffix, outcome.tone ?? "info");
  }

  function settleYear(): void {
    player.age += 1;
    usedThisYear.length = 0;

    if (player.age > 35) {
      setStat("health", stats.health - 2);
    }

    if (player.age > 55) {
      setStat("health", stats.health - 2);
    }

    const salary = player.salary;
    if (salary > 0) {
      adjustCredits(salary, "Salary");
    }

    const property = propertyById(home.value);
    const housingCost = tenure.value === "own" ? property.upkeep : property.rent;
    const housingLabel = tenure.value === "own" ? "Upkeep" : "Rent";

    if (player.credits >= housingCost) {
      adjustCredits(-housingCost, housingLabel);
    } else {
      player.credits = 0;
      setStat("happiness", stats.happiness - 15);
      appendLog(
        `You can't cover the ¥${formatCredits(housingCost)} ${housingLabel.toLowerCase()} on the ${property.name}. Your housing situation gets worse.`,
        "bad",
      );
    }

    for (const npc of npcs) {
      updateNpc(npc.id, { relationship: clamp(npc.relationship - 2, 0, 100) });
    }

    if (Math.random() < 0.75) {
      triggerLifeEvent();
    }

    if (npcs.length < 8 && Math.random() < 0.35) {
      addNpc("A new face drifts into your orbit.");
    }

    appendLog(
      `You turn ${player.age}. ${
        salary > 0
          ? `Your contract pays ¥${formatCredits(salary)} a year.`
          : "You're still off the payroll."
      } ${housingLabel} is ¥${formatCredits(housingCost)}/year.`,
      "info",
    );
  }

  function enterNewDay(): void {
    clock.day += 1;

    if (stats.satiety <= 0) {
      setStat("health", stats.health - 5);
      setStat("happiness", stats.happiness - 3);
      appendLog("You wake up starving. Your body is sending invoices.", "bad");
    } else if (stats.satiety < 20) {
      setStat("happiness", stats.happiness - 1);
    }

    if (stats.hygiene <= 0) {
      setStat("happiness", stats.happiness - 3);
      appendLog("You wake up filthy. It is starting to affect how people look at you.", "bad");
    } else if (stats.hygiene < 15) {
      setStat("happiness", stats.happiness - 1);
    }

    if (clock.day > SEASON_DAYS) {
      clock.day = 1;
      clock.season += 1;

      if (clock.season >= SEASONS.length) {
        clock.season = 0;
        clock.year += 1;
        settleYear();
      } else {
        appendLog(`${SEASONS[clock.season].label} rolls in over the sprawl.`, "event");
      }
    }
  }

  function advanceSeconds(seconds: number, asleep = false): void {
    let remaining = Math.max(0, Math.round(seconds));

    while (remaining > 0) {
      const untilMidnight = 86400 - clock.secondOfDay;
      const step = Math.min(remaining, untilMidnight);
      const hours = step / 3600;

      clock.secondOfDay += step;
      remaining -= step;

      setStat(
        "satiety",
        stats.satiety - hours * HUNGER_PER_HOUR * (asleep ? 0.4 : 1),
      );
      setStat(
        "hygiene",
        stats.hygiene - hours * (asleep ? 0.8 : 1.5),
      );

      if (clock.secondOfDay >= 86400) {
        clock.secondOfDay = 0;
        enterNewDay();
      }
    }
  }

  function openTimeDialog(mode: TimeMode): void {
    const total = mode === "sleep" ? 8 * 3600 : 3600;
    timeDialog.mode = mode;
    timeDialog.hours = Math.floor(total / 3600);
    timeDialog.minutes = Math.floor((total % 3600) / 60);
    timeDialog.seconds = total % 60;
  }

  function closeTimeDialog(): void {
    timeDialog.mode = null;
  }

  function advanceTime(hours: number): void {
    advanceSeconds(hours * 3600);
  }

  function sleepFor(seconds: number): void {
    const duration = Math.max(1, Math.round(seconds));
    const hours = duration / 3600;
    const current = currentPlace();

    let label: string;
    let rate = 0;
    let restorePerHour = 0;
    let heals = false;
    let bedHappiness = 0;
    let bedName = "";

    if (current.kind === "home") {
      const property = propertyById(home.value);
      const bed = furnitureWithFeature(Array.from(furniture), "bed");

      if (!bed) {
        appendLog(
          `You don't have a bed at the ${property.name}. Buy one in Home, or rent a room at a hotel.`,
          "bad",
        );
        return;
      }

      label = property.name;
      bedName = bed.label;
      restorePerHour = bed.sleepEnergy ?? 4;
      heals = (bed.sleepHealth ?? 0) > 0;
      bedHappiness = bed.sleepHappiness ?? 0;
    } else if (current.kind === "hotel") {
      label = current.name;
      rate = current.hotelRate ?? 10;
      restorePerHour = hotelRestPerHour(current);
    } else {
      appendLog(
        `There's no bed at the ${current.name}. Sleep at home or rent a room at a hotel.`,
        "bad",
      );
      return;
    }

    const cost = Math.ceil(hours * rate);
    if (cost > player.credits) {
      appendLog(
        `${label} wants ¥${formatCredits(cost)} for ${formatDuration(duration)}. You don't have it.`,
        "bad",
      );
      return;
    }

    const hungry = stats.satiety < 20;
    const restore = Math.round(hours * restorePerHour * (hungry ? 0.6 : 1));
    const before = stats.energy;

    if (cost) {
      adjustCredits(-cost, `${label} sleep`);
    }

    advanceSeconds(duration, true);
    setStat("energy", stats.energy + restore);

    if (bedHappiness) {
      setStat("happiness", stats.happiness + bedHappiness);
    }

    if (heals && hours >= 6) {
      setStat("health", stats.health + 1);
    }

    const gained = Math.round(stats.energy - before);
    appendLog(
      `You sleep ${formatDuration(duration)} at the ${label}${
        bedName ? ` on the ${bedName}` : ""
      }. (+${gained} EN${
        bedHappiness ? `, +${bedHappiness} HAP` : ""
      }${cost ? `, −¥${formatCredits(cost)}` : ", free"})`,
      hungry ? "info" : "good",
    );

    if (hungry) {
      appendLog("You went to sleep hungry. The rest didn't take.", "info");
    }
  }

  function waitFor(seconds: number): void {
    const duration = Math.max(1, Math.round(seconds));
    const drain = Math.round((duration / 3600) * WAIT_ENERGY_PER_HOUR);

    advanceSeconds(duration);
    if (drain) {
      setStat("energy", stats.energy - drain);
    }

    if (duration >= 60) {
      appendLog(
        `You wait ${formatDuration(duration)} standing.${drain ? ` (−${drain} EN)` : ""}`,
        "info",
      );
    }
  }

  function restFor(seconds: number): void {
    const duration = Math.max(1, Math.round(seconds));
    const hours = duration / 3600;
    const chair = furnitureWithFeature(Array.from(furniture), "rest");

    if (location.value !== "home" || !chair) {
      appendLog(
        "You need a chair or couch at home to rest properly.",
        "bad",
      );
      return;
    }

    const hungry = stats.satiety < 20;
    const gain = Math.round(
      hours * (chair.restEnergy ?? 1) * (hungry ? 0.6 : 1),
    );
    const before = stats.energy;

    advanceSeconds(duration);
    setStat("energy", stats.energy + gain);

    if (hours >= 1) {
      setStat("happiness", stats.happiness + 1);
    }

    const gained = Math.round(stats.energy - before);
    appendLog(
      `You rest ${formatDuration(duration)} on the ${chair.label}. (+${gained} EN)`,
      hungry ? "info" : "good",
    );

    if (hungry) {
      appendLog("You rested hungry. It didn't take the edge off.", "info");
    }
  }

  function placeName(place: Location): string {
    return place.kind === "home" ? place.name : `the ${place.name}`;
  }

  function travelTo(destination: Location): void {
    if (destination.id === location.value) {
      appendLog(`You're already at ${placeName(destination)}.`, "info");
      return;
    }

    const origin = currentPlace();
    const route = routeBetween(
      origin.id,
      destination.id,
      propertyAnchor(propertyById(home.value)),
    );
    const minutes = Math.max(1, route.minutes);
    const energy = Math.max(1, Math.ceil(minutes / 12));
    const stops = route.path.slice(1, -1).map((id) => locationById(id).name);
    const via = stops.length > 0 ? ` via ${stops.join(", ")}` : "";

    advanceSeconds(minutes * 60);
    setStat("energy", stats.energy - energy);
    location.value = destination.id;

    appendLog(
      `You travel from ${placeName(origin)} to ${placeName(destination)}${via}. (${minutes}M, −${energy} EN)`,
      "info",
    );
  }

  function actionBlockReason(action: GameAction): string | null {
    if (action.oncePerYear && usedThisYear.includes(action.id)) {
      return "Already done this year";
    }

    if (action.at && !action.at.includes(location.value)) {
      const names = action.at.map((id) => locationById(id).name);
      return `Only at ${names.join(" / ")}`;
    }

    const current = currentPlace();
    if (action.at && !isOpenNow(current, clock.secondOfDay)) {
      return `${current.name} is closed (${formatHourWindow(current.openHours)})`;
    }

    if (
      action.hours &&
      !isHourInWindow(clock.secondOfDay / 3600, action.hours)
    ) {
      return `Only ${formatHourWindow(action.hours)}`;
    }

    if (action.requires?.feature && !hasHomeFeature(action.requires.feature)) {
      return `Needs ${action.requires.feature} at Home`;
    }

    if (action.cost !== undefined && player.credits < action.cost) {
      return "Not enough credits";
    }

    if (action.energy !== undefined && action.energy < 0 && stats.energy < -action.energy) {
      return "Not enough energy";
    }

    const requires = action.requires;
    if (!requires) {
      return null;
    }

    if (requires.credits !== undefined && player.credits < requires.credits) {
      return "Not enough credits";
    }

    if (requires.employed && player.occupation === "Unemployed") {
      return "Needs a job";
    }

    if (
      requires.stat !== undefined &&
      requires.min !== undefined &&
      stats[requires.stat] < requires.min
    ) {
      return `${STAT_LABELS[requires.stat]} ${requires.min}+ required`;
    }

    if (requires.minWanted !== undefined && player.wanted < requires.minWanted) {
      return `Heat ${requires.minWanted}+ required`;
    }

    if (requires.maxWanted !== undefined && player.wanted > requires.maxWanted) {
      return "Too much heat";
    }

    return null;
  }

  function runAction(action: GameAction): void {
    const blocked = actionBlockReason(action);
    if (blocked) {
      appendLog(`${action.label}: ${blocked.toLowerCase()}.`, "bad");
      return;
    }

    if (action.cost) {
      adjustCredits(-action.cost, action.label);
    }

    if (action.credits) {
      adjustCredits(action.credits, action.label);
    }

    if (action.energy) {
      setStat("energy", stats.energy + action.energy);
    }

    applyStats(action.stats);

    if (action.wanted) {
      player.wanted = clamp(player.wanted + action.wanted, 0, 5);
    }

    if (action.text) {
      appendLog(action.text, action.tone ?? "info");
    }

    if (action.outcomes && action.outcomes.length > 0) {
      applyOutcome(rollOutcome(action.outcomes));
    }

    if (action.oncePerYear) {
      usedThisYear.unshift(action.id);
    }

    advanceSeconds((action.time ?? 1) * 3600);
  }

  function updateNpc(npcId: number, patch: Partial<Npc>): void {
    const index = npcs.findIndex((npc) => npc.id === npcId);
    if (index === -1) {
      return;
    }

    npcs[index] = { ...npcs[index], ...patch };
  }

  function interactNpc(npc: Npc, kind: NpcInteraction): void {
    const cost = INTERACTION_COSTS[kind];

    if (cost.minRelationship !== undefined && npc.relationship < cost.minRelationship) {
      appendLog(`${npc.name} isn't ready for that. Build some trust first.`, "bad");
      return;
    }

    if (player.credits < cost.credits) {
      appendLog("You can't afford that right now.", "bad");
      return;
    }

    if (cost.energy < 0 && stats.energy < -cost.energy) {
      appendLog("You're too exhausted for that.", "bad");
      return;
    }

    if (cost.credits) {
      adjustCredits(-cost.credits, kind === "gift" ? "Gift" : "Night out");
    }

    setStat("energy", stats.energy + cost.energy);
    setStat("happiness", stats.happiness + cost.happiness);

    const relationship = clamp(npc.relationship + cost.relationship, 0, 100);
    const lastLine = randomFrom(NPC_REPLIES[kind]);
    updateNpc(npc.id, { relationship, lastLine });

    appendLog(`${npc.name}: “${lastLine}”`, "good");
    advanceSeconds(cost.time * 3600);
  }

  function addNpc(message?: string): void {
    const npc = randomNpc();
    npcs.unshift(npc);

    if (message) {
      appendLog(
        `${message} You meet ${npc.name}, a ${npc.role.toLowerCase()} from ${npc.district}. They seem ${npc.trait}.`,
        "good",
      );
    }
  }

  function meetNpc(): void {
    if (stats.energy < 20) {
      appendLog("You're too exhausted to work the room.", "bad");
      return;
    }

    setStat("energy", stats.energy - 20);
    addNpc("You spend the evening working the room.");
    advanceSeconds(4 * 3600);
  }

  function vendorBlockReason(
    kind: "supplies" | "assets" | "cyberware",
  ): string | null {
    const service =
      kind === "supplies" ? "Supplies" : kind === "assets" ? "Gear" : "Chrome";
    const current = currentPlace();

    if (current.services.includes(service)) {
      return null;
    }

    const vendors = LOCATIONS.filter((place) =>
      place.services.includes(service),
    ).map((place) => place.name);
    const label =
      kind === "supplies" ? "supplies" : kind === "assets" ? "gear" : "chrome";

    return `Buy ${label} at ${vendors.join(", ")}`;
  }

  function acquire(item: ItemOption): void {
    const vendorIssue = vendorBlockReason(item.slot);
    if (vendorIssue) {
      appendLog(vendorIssue + ".", "bad");
      return;
    }

    if (owned.includes(item.id)) {
      appendLog(`You already own the ${item.label}.`, "info");
      return;
    }

    if (player.credits < item.price) {
      appendLog(`The ${item.label} costs ¥${formatCredits(item.price)}. You're short.`, "bad");
      return;
    }

    adjustCredits(-item.price, item.label);
    owned.unshift(item.id);
    applyStats(item.stats);
    appendLog(`You buy the ${item.label}.`, "good");
    advanceSeconds(3600);
  }

  function moveHome(property: Property, nextTenure: Tenure): void {
    const sameHome = home.value === property.id;

    if (sameHome && tenure.value === nextTenure) {
      appendLog("You already live there.", "info");
      return;
    }

    if (sameHome && nextTenure === "rent") {
      appendLog(
        `You already own the ${property.name}. Renting it back to yourself seems unwise.`,
        "info",
      );
      return;
    }

    const cost = nextTenure === "own" ? property.price : property.deposit;
    if (player.credits < cost) {
      appendLog(
        nextTenure === "own"
          ? `The ${property.name} is listed at ¥${formatCredits(property.price)}. You're short.`
          : `The deposit on the ${property.name} is ¥${formatCredits(property.deposit)}. You're short.`,
        "bad",
      );
      return;
    }

    const usedSlots = furnitureSlotsUsed(Array.from(furniture));
    if (usedSlots > property.slots) {
      appendLog(
        `Your furniture needs ${usedSlots} slots, but the ${property.name} only has ${property.slots}. Sell or replace something first.`,
        "bad",
      );
      return;
    }

    if (!sameHome) {
      const previous = propertyById(home.value);
      if (tenure.value === "own") {
        const sale = Math.round(previous.price * 0.8);
        adjustCredits(sale, `${previous.name} sale`);
        appendLog(
          `You sell the ${previous.name} for ¥${formatCredits(sale)}.`,
          "info",
        );
      } else if (previous.deposit > 0) {
        adjustCredits(previous.deposit, `${previous.name} deposit refund`);
      }
    }

    if (cost) {
      adjustCredits(
        -cost,
        nextTenure === "own"
          ? `${property.name} purchase`
          : `${property.name} deposit`,
      );
    }

    home.value = property.id;
    tenure.value = nextTenure;

    const statKey = `move:${property.id}`;
    if (!usedThisYear.includes(statKey)) {
      usedThisYear.push(statKey);
      applyStats(property.stats);
    }

    appendLog(
      nextTenure === "own"
        ? `You buy the ${property.name} in ${property.district} for ¥${formatCredits(property.price)}. Upkeep is ¥${formatCredits(property.upkeep)}/year.`
        : `You rent the ${property.name} in ${property.district}. Rent is ¥${formatCredits(property.rent)}/year.`,
      "good",
    );
    advanceSeconds(3 * 3600);
  }

  function hasHomeFeature(feature: string): boolean {
    return furnitureWithFeature(Array.from(furniture), feature) !== undefined;
  }

  function installFurniture(item: FurnitureOption): void {
    const property = propertyById(home.value);
    const installed = Array.from(furniture);
    const existing = installedInCategory(installed, item.category);

    if (existing?.id === item.id) {
      appendLog(`The ${item.label} is already installed.`, "info");
      return;
    }

    const used = furnitureSlotsUsed(installed);
    const nextUsed = used - (existing?.slots ?? 0) + item.slots;

    if (nextUsed > property.slots) {
      appendLog(
        `The ${item.label} needs ${item.slots} slot${item.slots === 1 ? "" : "s"}, but ${property.slots - used} slot${property.slots - used === 1 ? "" : "s"} remain.`,
        "bad",
      );
      return;
    }

    if (player.credits < item.price) {
      appendLog(
        `The ${item.label} costs ¥${formatCredits(item.price)}. You're short.`,
        "bad",
      );
      return;
    }

    adjustCredits(-item.price, item.label);

    if (existing) {
      const refund = Math.round(existing.price * 0.4);
      if (refund) {
        adjustCredits(refund, `${existing.label} resale`);
      }
      const index = furniture.findIndex((id) => id === existing.id);
      if (index !== -1) {
        furniture.splice(index, 1);
      }
    }

    furniture.push(item.id);
    appendLog(
      existing
        ? `You replace the ${existing.label} with the ${item.label}.`
        : `You install the ${item.label} at home.`,
      "good",
    );
    advanceSeconds(3600);
  }

  function sellFurniture(item: FurnitureOption): void {
    const index = furniture.findIndex((id) => id === item.id);
    if (index === -1) {
      appendLog(`You don't have a ${item.label}.`, "bad");
      return;
    }

    const refund = Math.round(item.price * 0.5);
    furniture.splice(index, 1);
    adjustCredits(refund, `${item.label} resale`);
    appendLog(
      `You sell the ${item.label} for ¥${formatCredits(refund)}.`,
      "info",
    );
    advanceSeconds(15 * 60);
  }

  function supplyCount(itemId: string): number {
    return supplies.find((entry) => entry.id === itemId)?.qty ?? 0;
  }

  function buyConsumable(item: Consumable): void {
    const vendorIssue = vendorBlockReason("supplies");
    if (vendorIssue) {
      appendLog(vendorIssue + ".", "bad");
      return;
    }

    if (player.credits < item.price) {
      appendLog(`The ${item.label} costs ¥${formatCredits(item.price)}. You're short.`, "bad");
      return;
    }

    adjustCredits(-item.price, item.label);

    const index = supplies.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      supplies.unshift({ id: item.id, qty: 1 });
    } else {
      supplies[index] = { ...supplies[index], qty: supplies[index].qty + 1 };
    }

    appendLog(`You stock up on ${item.label}.`, "info");
    advanceSeconds(15 * 60);
  }

  function consume(item: Consumable): void {
    const index = supplies.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      appendLog(`You don't have any ${item.label}.`, "bad");
      return;
    }

    const entry = supplies[index];
    if (entry.qty <= 1) {
      supplies.splice(index, 1);
    } else {
      supplies[index] = { ...entry, qty: entry.qty - 1 };
    }

    applyStats(item.stats);
    appendLog(item.text, item.tone ?? "info");
    advanceSeconds(item.time * 3600);
  }

  function triggerLifeEvent(): void {
    const pool = activeLifeEvents(player.age, player.wanted);
    if (pool.length === 0) {
      return;
    }

    const event = randomFrom(pool);
    applyStats(event.stats);

    if (event.credits) {
      adjustCredits(event.credits, "Life event");
    }

    if (event.wanted) {
      player.wanted = clamp(player.wanted + event.wanted, 0, 5);
    }

    appendLog(event.text, event.tone);
  }

  function setTheme(next: ThemeName): void {
    theme.value = next;
    document.documentElement.dataset.theme = next;
  }

  function reset(): void {
    const nextPlayer = startingPlayer();
    player.name = nextPlayer.name;
    player.age = nextPlayer.age;
    player.pronouns = nextPlayer.pronouns;
    player.district = nextPlayer.district;
    player.occupation = nextPlayer.occupation;
    player.salary = nextPlayer.salary;
    player.credits = nextPlayer.credits;
    player.wanted = nextPlayer.wanted;

    const nextStats = startingStats();
    for (const key of STAT_KEYS) {
      stats[key] = nextStats[key];
    }

    npcs.length = 0;
    npcs.push(randomNpc(), randomNpc(), randomNpc());

    clock.year = START_YEAR;
    clock.season = 0;
    clock.day = 1;
    clock.secondOfDay = START_HOUR * 3600;

    log.length = 0;
    ledger.length = 0;
    owned.length = 0;
    supplies.length = 0;
    usedThisYear.length = 0;
    furniture.length = 0;
    furniture.push("bed-mat");
    home.value = "lantern-capsule";
    tenure.value = "rent";
    location.value = "home";
    activeInterface.value = null;
    timeDialog.mode = null;

    const start = propertyById(home.value);
    appendLog(
      `You wake up in the ${start.name} in ${start.district} with ¥${formatCredits(player.credits)} and no plan.`,
      "info",
    );
    appendLog(
      `${npcs.length} contacts in your network. Everyone else is a stranger.`,
      "info",
    );
  }

  setTheme(theme.value);
  const firstHome = propertyById(home.value);
  appendLog(
    `You wake up in the ${firstHome.name} in ${firstHome.district} with ¥${formatCredits(player.credits)} and no plan.`,
    "info",
  );
  appendLog(`${npcs.length} contacts in your network. Everyone else is a stranger.`, "info");

  return {
    player,
    stats,
    clock,
    npcs,
    log,
    ledger,
    owned,
    supplies,
    furniture,
    home,
    tenure,
    location,
    activeInterface,
    enteredLocation,
    logOpen,
    theme,
    timeDialog,
    setInterface: (next) => {
      activeInterface.value = next;
    },
    enterLocation: (id) => {
      if (id !== location.value) {
        return;
      }

      activeInterface.value = null;
      logOpen.value = false;
      enteredLocation.value = id;
    },
    exitLocation: () => {
      enteredLocation.value = null;
    },
    toggleLog: () => {
      logOpen.value = !logOpen.value;
    },
    advanceTime,
    openTimeDialog,
    closeTimeDialog,
    sleepFor,
    waitFor,
    restFor,
    travelTo,
    runAction,
    actionBlockReason,
    vendorBlockReason,
    interactNpc,
    meetNpc,
    acquire,
    moveHome,
    installFurniture,
    sellFurniture,
    hasHomeFeature,
    buyConsumable,
    consume,
    supplyCount,
    setTheme,
    reset,
  };
}

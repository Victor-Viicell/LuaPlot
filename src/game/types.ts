export type StatKey =
  | "health"
  | "happiness"
  | "energy"
  | "satiety"
  | "hygiene"
  | "smarts"
  | "looks"
  | "streetCred";

export type PlayerStats = Record<StatKey, number>;

export type StatDelta = Partial<Record<StatKey, number>>;

export type Player = {
  name: string;
  age: number;
  pronouns: string;
  district: string;
  occupation: string;
  salary: number;
  credits: number;
  wanted: number;
};

export type Npc = {
  id: number;
  name: string;
  role: string;
  district: string;
  trait: string;
  relationship: number;
  lastLine: string;
};

export type LogTone = "info" | "good" | "bad" | "event";

export type LogEntry = {
  id: number;
  age: number;
  time: string;
  text: string;
  tone: LogTone;
};

export type GameClock = {
  year: number;
  season: number;
  day: number;
  secondOfDay: number;
};

export type LocationKind = "home" | "hotel" | "venue";

export type Location = {
  id: string;
  name: string;
  kind: LocationKind;
  district: string;
  description: string;
  /** Street address, when the place has a fixed one. Home does not. */
  address?: string;
  cityId?: string;
  /** Opening window in 24h hours. Omitted means always open. */
  openHours?: [number, number];
  /** What the player can do here, shown on the map. */
  services: string[];
  hotelRate?: number;
  hotelRest?: number;
};

export type MapRegion = "north" | "center" | "east" | "under";

export type MapNode = {
  locationId: string;
  x: number;
  y: number;
  region: MapRegion;
};

export type MapAnchor = Pick<MapNode, "x" | "y" | "region">;

export type MapEdge = {
  id: string;
  from: string;
  to: string;
};

/**
 * Authored world hierarchy: Nation → State → City → District → Address/Place.
 * These entities live in `world.ts`; the runtime views (Location, Property)
 * are derived from them.
 *
 * Quality is emergent, never authored. District facts (services, rents, wages,
 * safety) are computed from buildings, businesses, jobs, and residents.
 */
export type Nation = {
  id: string;
  name: string;
  currency: string;
  blurb: string;
};

export type State = {
  id: string;
  nationId: string;
  name: string;
  blurb: string;
};

export type CityMapRegion = {
  id: MapRegion;
  label: string;
  x: number;
  y: number;
};

export type City = {
  id: string;
  stateId: string;
  name: string;
  blurb: string;
  map: {
    width: number;
    height: number;
    regions: CityMapRegion[];
  };
};

export type District = {
  id: string;
  cityId: string;
  name: string;
  blurb: string;
  /** Label anchor on the city map. */
  label: { x: number; y: number };
};

export type Place = {
  id: string;
  name: string;
  kind: LocationKind;
  cityId: string;
  districtId: string;
  address: string;
  description: string;
  openHours?: [number, number];
  services: string[];
  hotelRate?: number;
  /** Energy restored per hour, for hotels. Quality of this specific place. */
  hotelRest?: number;
  /** Position on the local city map. */
  map: { x: number; y: number; region: MapRegion };
};

export type CityEdge = {
  cityId: string;
  id: string;
  from: string;
  to: string;
};

export type PropertyListing = {
  id: string;
  name: string;
  cityId: string;
  districtId: string;
  address: string;
  x: number;
  y: number;
  region: MapRegion;
  /** How many furniture items fit in this home. */
  slots: number;
  rent: number;
  price: number;
  deposit: number;
  upkeep: number;
  description: string;
  stats: StatDelta;
};

export type Tenure = "rent" | "own";

export type FurnitureCategory =
  | "bed"
  | "seating"
  | "shower"
  | "cooling"
  | "computer"
  | "storage"
  | "comfort";

export type TimeMode = "sleep" | "wait" | "rest";

export type TimeDialog = {
  mode: TimeMode | null;
  hours: number;
  minutes: number;
  seconds: number;
};

export type FurnitureInteraction = {
  label: string;
  /** Opens the duration dialog in this mode. */
  timeMode?: TimeMode;
  /** Runs a hidden home action. */
  actionId?: string;
};

export type FurnitureOption = {
  id: string;
  label: string;
  category: FurnitureCategory;
  price: number;
  slots: number;
  description: string;
  /** Features unlocked in the home, e.g. "bed", "shower", "workspace". */
  features: string[];
  /** Beds only: energy restored per hour of sleep. */
  sleepEnergy?: number;
  /** Beds only: happiness gained when waking. */
  sleepHappiness?: number;
  /** Beds only: health gained after six hours of sleep. */
  sleepHealth?: number;
  /** Seating only: energy restored per hour of rest. */
  restEnergy?: number;
  /** Object interactions shown on the furniture card. */
  interactions: FurnitureInteraction[];
};

export type Property = {
  id: string;
  name: string;
  district: string;
  address: string;
  cityId: string;
  /** Placement of the player's home node on the city map while living here. */
  x: number;
  y: number;
  region: MapRegion;
  /** How many furniture items fit in this home. */
  slots: number;
  rent: number;
  price: number;
  deposit: number;
  upkeep: number;
  description: string;
  stats: StatDelta;
};

export type LedgerEntry = {
  id: number;
  age: number;
  label: string;
  amount: number;
};

export type InterfaceId =
  | "leisure"
  | "health"
  | "education"
  | "career"
  | "relationships"
  | "map"
  | "inventory"
  | "finance"
  | "crime"
  | "home"
  | "system";

export type InterfaceCategory = {
  id: InterfaceId;
  label: string;
  glyph: string;
  accent: string;
  side: "left" | "right";
  tagline: string;
};

export type Requirement = {
  stat?: StatKey;
  min?: number;
  credits?: number;
  employed?: boolean;
  minWanted?: number;
  maxWanted?: number;
  /** Required furniture feature at Home, e.g. "shower" or "computer". */
  feature?: string;
};

export type ActionOutcome = {
  chance: number;
  text: string;
  tone?: LogTone;
  stats?: StatDelta;
  credits?: number;
  creditsRange?: [number, number];
  wanted?: number;
  occupation?: string;
  setSalary?: number;
  salary?: number;
};

export type GameAction = {
  id: string;
  label: string;
  description: string;
  cost?: number;
  credits?: number;
  energy?: number;
  time?: number;
  /** Location ids where this action is available. Omitted means anywhere. */
  at?: string[];
  /** Time-of-day window in 24h hours. Omitted means any time. */
  hours?: [number, number];
  /** Home-furniture actions are run from the object, not the global menus. */
  hidden?: boolean;
  stats?: StatDelta;
  wanted?: number;
  text?: string;
  tone?: LogTone;
  outcomes?: ActionOutcome[];
  requires?: Requirement;
  oncePerYear?: boolean;
};

export type ItemOption = {
  id: string;
  label: string;
  price: number;
  description: string;
  stats: StatDelta;
  slot: "assets" | "cyberware";
};


export type Consumable = {
  id: string;
  label: string;
  description: string;
  price: number;
  time: number;
  stats: StatDelta;
  text: string;
  tone?: LogTone;
};

export type SupplyEntry = {
  id: string;
  qty: number;
};

export type LifeEvent = {
  id: string;
  text: string;
  tone: LogTone;
  minAge?: number;
  maxAge?: number;
  minWanted?: number;
  stats?: StatDelta;
  credits?: number;
  wanted?: number;
};

export type NpcInteraction = "message" | "hangout" | "gift" | "date";

export type ThemeName = "mocha" | "macchiato" | "frappe" | "latte";

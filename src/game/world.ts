import type {
  City,
  CityEdge,
  District,
  Nation,
  Place,
  PropertyListing,
  State,
} from "./types";

/**
 * AUTHORED WORLD CATALOG
 * ======================
 * This is the single source of truth for every place in NeonLife. The map is
 * hand-authored, never generated. Change coordinates, hours, services, prices,
 * addresses, or whole cities here and the rest of the game follows.
 *
 * Hierarchy: Nation → State → City → District → Address/Place.
 *
 * Current implementation ships one city (Vesper). Country-level travel will
 * add more cities by appending to CITIES, PLACES, PROPERTY_LISTINGS, and
 * CITY_EDGES. Each city owns a local map (width/height in map units).
 *
 * Quality is NOT authored here. Districts are geography and flavor only. Rent,
 * wages, services, safety, and demand will be computed from buildings,
 * businesses, job slots, and residents. See `docs/simulation-plan.md`.
 *
 * See docs/world-building.md before adding content.
 */

export const DEFAULT_CITY_ID = "vesper";

export const NATIONS: Nation[] = [
  {
    id: "meridian",
    name: "Meridian Compact",
    currency: "credits",
    blurb:
      "A coastal trade compact stitched together from old city-states. Ports, signals, and contracts hold it together.",
  },
];

export const STATES: State[] = [
  {
    id: "lantern-reach",
    nationId: "meridian",
    name: "Lantern Reach",
    blurb:
      "A dense coastal state of vertical cities, tidal power, and freight rails that never quite stop.",
  },
];

export const CITIES: City[] = [
  {
    id: "vesper",
    stateId: "lantern-reach",
    name: "Vesper",
    blurb:
      "A rain-soaked port built in layers: street level, rail level, and the undercity beneath both.",
    map: {
      width: 1000,
      height: 640,
      regions: [
        { id: "north", label: "NORTH SPRAWL", x: 512, y: 34 },
        { id: "center", label: "CENTRAL BELT", x: 514, y: 250 },
        { id: "east", label: "EAST ARCADE", x: 852, y: 330 },
        { id: "under", label: "UNDERCITY", x: 178, y: 410 },
      ],
    },
  },
];

export const DISTRICTS: District[] = [
  {
    id: "undercity",
    cityId: "vesper",
    name: "Undercity",
    label: { x: 178, y: 410 },
    blurb:
      "Cheap rent and cheaper wiring. Nobody asks where the power comes from.",
  },
  {
    id: "salt-flats",
    cityId: "vesper",
    name: "Salt Flats",
    label: { x: 640, y: 600 },
    blurb: "Wind, dust, and cash-only businesses that never file a report.",
  },
  {
    id: "chop-row",
    cityId: "vesper",
    name: "Chop Row",
    label: { x: 900, y: 580 },
    blurb:
      "Workshops, scrap yards, and a strong market for things that fell off trucks.",
  },
  {
    id: "lantern-district",
    cityId: "vesper",
    name: "Lantern District",
    label: { x: 500, y: 70 },
    blurb:
      "Dense, loud, and affordable. The laundry downstairs fixes a jacket for five credits.",
  },
  {
    id: "marrow-market",
    cityId: "vesper",
    name: "Marrow Market",
    label: { x: 580, y: 340 },
    blurb:
      "The market never closes. Everything is negotiable, including the rules.",
  },
  {
    id: "kestrel-row",
    cityId: "vesper",
    name: "Kestrel Row",
    label: { x: 300, y: 190 },
    blurb:
      "Old walk-ups, good transit, and a neighborhood watch that actually watches.",
  },
  {
    id: "iron-union",
    cityId: "vesper",
    name: "Iron Union",
    label: { x: 380, y: 460 },
    blurb:
      "Shift work, solid plumbing, and the best cheap coffee in the central belt.",
  },
  {
    id: "the-spine",
    cityId: "vesper",
    name: "The Spine",
    label: { x: 230, y: 540 },
    blurb:
      "Fixers and freelancers stacked twenty floors high. Convenient if you can pay.",
  },
  {
    id: "signal-yard",
    cityId: "vesper",
    name: "Signal Yard",
    label: { x: 830, y: 150 },
    blurb:
      "Grid infrastructure, clean power, and landlords who understand bandwidth.",
  },
  {
    id: "violet-mile",
    cityId: "vesper",
    name: "Violet Mile",
    label: { x: 720, y: 360 },
    blurb:
      "Nightlife money buys fast repairs, private clinics, and very loud neighbors.",
  },
  {
    id: "glass-spire",
    cityId: "vesper",
    name: "Glass Spire",
    label: { x: 730, y: 60 },
    blurb:
      "Private security, same-hour maintenance, and salaries worth signing for.",
  },
];

export const PLACES: Place[] = [
  {
    id: "capsule-annex",
    name: "Capsule Annex",
    kind: "hotel",
    cityId: "vesper",
    districtId: "lantern-district",
    address: "9 Lantern Walk",
    description: "Cheap pods rented by the hour. The sheets are clean enough.",
    hotelRate: 8,
    hotelRest: 4.7,
    services: ["Rest", "Shower"],
    map: { x: 520, y: 92, region: "north" },
  },
  {
    id: "consortium-plaza",
    name: "Consortium Plaza",
    kind: "venue",
    cityId: "vesper",
    districtId: "glass-spire",
    address: "1 Consortium Plaza",
    description: "Clean glass, private security, and money in the air.",
    openHours: [7, 20],
    services: ["Work", "Education", "Finance"],
    map: { x: 760, y: 100, region: "north" },
  },
  {
    id: "gridhouse",
    name: "Gridhouse",
    kind: "venue",
    cityId: "vesper",
    districtId: "signal-yard",
    address: "6 Relay Court",
    description:
      "A co-working deck farm with a side door for people who don't sign in.",
    openHours: [7, 2],
    services: ["Education", "Netrunning"],
    map: { x: 886, y: 196, region: "north" },
  },
  {
    id: "night-market",
    name: "Night Market",
    kind: "venue",
    cityId: "vesper",
    districtId: "marrow-market",
    address: "Marrow Market, Gate 3",
    description: "Food stalls, knockoff chrome, and people selling rumors.",
    openHours: [18, 4],
    services: ["Food", "Leisure", "Social", "Underworld"],
    map: { x: 560, y: 300, region: "center" },
  },
  {
    id: "union-hall",
    name: "Union Hall",
    kind: "venue",
    cityId: "vesper",
    districtId: "iron-union",
    address: "120 Union Hall Way",
    description: "Shift boards, cheap coffee, and a gym in the basement.",
    openHours: [5, 21],
    services: ["Work", "Gym"],
    map: { x: 360, y: 402, region: "center" },
  },
  {
    id: "bath-house",
    name: "Kestrel Bath House",
    kind: "venue",
    cityId: "vesper",
    districtId: "kestrel-row",
    address: "40 Kestrel Row",
    description:
      "Tiled stalls, industrial hot water, and a sauna that has outlived three owners.",
    openHours: [6, 23],
    services: ["Bath", "Sauna"],
    map: { x: 250, y: 340, region: "center" },
  },
  {
    id: "neon-strip",
    name: "Neon Strip",
    kind: "venue",
    cityId: "vesper",
    districtId: "violet-mile",
    address: "88 Violet Mile",
    description: "Clubs, memory parlors, and bad decisions by the hour.",
    openHours: [20, 5],
    services: ["Leisure", "Social", "Underworld"],
    map: { x: 760, y: 402, region: "east" },
  },
  {
    id: "chop-shop",
    name: "Chop Shop",
    kind: "venue",
    cityId: "vesper",
    districtId: "chop-row",
    address: "31 Chop Row",
    description:
      "Gear, chrome, and a back room that smells like solder and antiseptic.",
    openHours: [10, 3],
    services: ["Gear", "Chrome", "Supplies"],
    map: { x: 884, y: 500, region: "east" },
  },
  {
    id: "no-tell-motel",
    name: "No-Tell Motel",
    kind: "hotel",
    cityId: "vesper",
    districtId: "salt-flats",
    address: "44 Salt Flats Service Road",
    description: "Cash only. No cameras. No questions about the stains.",
    hotelRate: 18,
    hotelRest: 4.1,
    services: ["Rest", "Discretion"],
    map: { x: 650, y: 548, region: "east" },
  },
  {
    id: "undercity-clinic",
    name: "Undercity Clinic",
    kind: "venue",
    cityId: "vesper",
    districtId: "undercity",
    address: "17 Sump Line",
    description:
      "A street surgeon who works for cash and doesn't ask how you got the wound.",
    services: ["Body", "Chrome"],
    map: { x: 178, y: 470, region: "under" },
  },
  {
    id: "the-spine",
    name: "The Spine",
    kind: "venue",
    cityId: "vesper",
    districtId: "the-spine",
    address: "The Spine, Level 12",
    description:
      "A vertical bazaar of fixers, bounties, and people who trade in favors.",
    openHours: [20, 6],
    services: ["Underworld", "Fixers", "Bounties"],
    map: { x: 178, y: 574, region: "under" },
  },
];

export const CITY_EDGES: CityEdge[] = [
  {
    cityId: "vesper",
    id: "e-bath-market",
    from: "bath-house",
    to: "night-market",
  },
  {
    cityId: "vesper",
    id: "e-bath-union",
    from: "bath-house",
    to: "union-hall",
  },
  {
    cityId: "vesper",
    id: "e-capsule-consortium",
    from: "capsule-annex",
    to: "consortium-plaza",
  },
  {
    cityId: "vesper",
    id: "e-capsule-market",
    from: "capsule-annex",
    to: "night-market",
  },
  {
    cityId: "vesper",
    id: "e-consortium-grid",
    from: "consortium-plaza",
    to: "gridhouse",
  },
  {
    cityId: "vesper",
    id: "e-consortium-market",
    from: "consortium-plaza",
    to: "night-market",
  },
  {
    cityId: "vesper",
    id: "e-consortium-strip",
    from: "consortium-plaza",
    to: "neon-strip",
  },
  { cityId: "vesper", id: "e-grid-strip", from: "gridhouse", to: "neon-strip" },
  {
    cityId: "vesper",
    id: "e-market-union",
    from: "night-market",
    to: "union-hall",
  },
  {
    cityId: "vesper",
    id: "e-market-strip",
    from: "night-market",
    to: "neon-strip",
  },
  {
    cityId: "vesper",
    id: "e-market-chop",
    from: "night-market",
    to: "chop-shop",
  },
  {
    cityId: "vesper",
    id: "e-union-clinic",
    from: "union-hall",
    to: "undercity-clinic",
  },
  {
    cityId: "vesper",
    id: "e-clinic-spine",
    from: "undercity-clinic",
    to: "the-spine",
  },
  {
    cityId: "vesper",
    id: "e-market-motel",
    from: "night-market",
    to: "no-tell-motel",
  },
  { cityId: "vesper", id: "e-strip-chop", from: "neon-strip", to: "chop-shop" },
  {
    cityId: "vesper",
    id: "e-chop-motel",
    from: "chop-shop",
    to: "no-tell-motel",
  },
  {
    cityId: "vesper",
    id: "e-strip-motel",
    from: "neon-strip",
    to: "no-tell-motel",
  },
];

export const PROPERTY_LISTINGS: PropertyListing[] = [
  {
    id: "underwalk-room",
    name: "Underwalk Room",
    cityId: "vesper",
    districtId: "undercity",
    address: "4 Boiler Lane",
    x: 92,
    y: 540,
    region: "under",
    rent: 420,
    price: 4200,
    deposit: 0,
    upkeep: 60,
    slots: 4,
    description:
      "A windowless room behind a boiler. The lock works. The heater sometimes does.",
    stats: { happiness: 1 },
  },
  {
    id: "saltflats-flop",
    name: "Salt Flats Flophouse",
    cityId: "vesper",
    districtId: "salt-flats",
    address: "612 Salt Flats Service Road",
    x: 540,
    y: 596,
    region: "east",
    rent: 520,
    price: 5600,
    deposit: 0,
    upkeep: 80,
    slots: 4,
    description:
      "A room above a garage. Dust gets into everything, including the food.",
    stats: { happiness: 2 },
  },
  {
    id: "choprow-bunk",
    name: "Chop Row Bunk",
    cityId: "vesper",
    districtId: "chop-row",
    address: "27 Chop Row, Rear Yard",
    x: 928,
    y: 566,
    region: "east",
    rent: 680,
    price: 8000,
    deposit: 100,
    upkeep: 120,
    slots: 5,
    description:
      "A converted workshop bunk with a workbench and a very social fuse box.",
    stats: { happiness: 2 },
  },
  {
    id: "lantern-capsule",
    name: "Capsule Stack",
    cityId: "vesper",
    districtId: "lantern-district",
    address: "9 Lantern Walk, Stack C",
    x: 430,
    y: 156,
    region: "north",
    rent: 900,
    price: 11000,
    deposit: 200,
    upkeep: 180,
    slots: 4,
    description:
      "A pod, a locker, and a shared bathroom with a broken lock. It is a start.",
    stats: { energy: 3 },
  },
  {
    id: "market-loft",
    name: "Market Loft",
    cityId: "vesper",
    districtId: "marrow-market",
    address: "Marrow Market, Stall 62",
    x: 626,
    y: 268,
    region: "center",
    rent: 1500,
    price: 20000,
    deposit: 500,
    upkeep: 300,
    slots: 6,
    description:
      "One room above a stall. The smell of frying batter is both a feature and a warning.",
    stats: { happiness: 4 },
  },
  {
    id: "kestrel-flat",
    name: "Kestrel Row Flat",
    cityId: "vesper",
    districtId: "kestrel-row",
    address: "18 Kestrel Row",
    x: 300,
    y: 230,
    region: "center",
    rent: 1900,
    price: 27000,
    deposit: 700,
    upkeep: 420,
    slots: 6,
    description:
      "Thin walls, reliable power, and neighbors who mind their business.",
    stats: { happiness: 5, energy: 3 },
  },
  {
    id: "union-walkup",
    name: "Union Walk-Up",
    cityId: "vesper",
    districtId: "iron-union",
    address: "118 Union Hall Way",
    x: 318,
    y: 512,
    region: "center",
    rent: 1700,
    price: 24000,
    deposit: 600,
    upkeep: 360,
    slots: 6,
    description:
      "Three flights up, but the building has a gym and the pipes hold pressure.",
    stats: { happiness: 4, energy: 2 },
  },
  {
    id: "spine-stack",
    name: "Spine Stack",
    cityId: "vesper",
    districtId: "the-spine",
    address: "The Spine, Level 9",
    x: 268,
    y: 588,
    region: "under",
    rent: 2600,
    price: 38000,
    deposit: 900,
    upkeep: 600,
    slots: 6,
    description:
      "A stacked unit in the bazaar. Overnight deliveries, permanent noise, excellent fixers.",
    stats: { happiness: 5, streetCred: 1 },
  },
  {
    id: "signal-loft",
    name: "Signal Yard Loft",
    cityId: "vesper",
    districtId: "signal-yard",
    address: "6 Relay Court, Loft 4",
    x: 932,
    y: 240,
    region: "north",
    rent: 3600,
    price: 60000,
    deposit: 1400,
    upkeep: 900,
    slots: 7,
    description:
      "Open plan, exposed conduit, and a view of someone else's relay tower.",
    stats: { happiness: 6, energy: 4, smarts: 1 },
  },
  {
    id: "violet-studio",
    name: "Violet Mile Studio",
    cityId: "vesper",
    districtId: "violet-mile",
    address: "84 Violet Mile",
    x: 700,
    y: 330,
    region: "center",
    rent: 4200,
    price: 74000,
    deposit: 1600,
    upkeep: 1100,
    slots: 7,
    description:
      "Soundproofed walls, blackout blinds, and a club downstairs that never quite stops.",
    stats: { happiness: 7, looks: 2 },
  },
  {
    id: "spire-suite",
    name: "Spire Executive Suite",
    cityId: "vesper",
    districtId: "glass-spire",
    address: "1 Consortium Plaza, Floor 44",
    x: 700,
    y: 40,
    region: "north",
    rent: 9600,
    price: 220000,
    deposit: 4000,
    upkeep: 3300,
    slots: 10,
    description:
      "Above the rain. Below the orbital platforms. Envied from every floor.",
    stats: { happiness: 10, looks: 3, streetCred: 3 },
  },
];

export function nationById(id: string): Nation {
  return NATIONS.find((nation) => nation.id === id) ?? NATIONS[0];
}

export function stateById(id: string): State {
  return STATES.find((state) => state.id === id) ?? STATES[0];
}

export function cityById(id: string): City {
  return CITIES.find((city) => city.id === id) ?? CITIES[0];
}

export function districtById(id: string): District {
  return DISTRICTS.find((district) => district.id === id) ?? DISTRICTS[0];
}

export function districtName(id: string): string {
  return districtById(id).name;
}

export function placeById(id: string): Place | undefined {
  return PLACES.find((place) => place.id === id);
}

export function placesInCity(cityId: string): Place[] {
  return PLACES.filter((place) => place.cityId === cityId);
}

export function districtsInCity(cityId: string): District[] {
  return DISTRICTS.filter((district) => district.cityId === cityId);
}

export function propertiesInCity(cityId: string): PropertyListing[] {
  return PROPERTY_LISTINGS.filter((listing) => listing.cityId === cityId);
}

/** Full street address for a place, ready for UI display. */
export function placeAddress(place: Place): string {
  return `${place.address}, ${districtName(place.districtId)}, ${cityById(place.cityId).name}`;
}

export function propertyAddress(listing: PropertyListing): string {
  return `${listing.address}, ${districtName(listing.districtId)}, ${cityById(listing.cityId).name}`;
}

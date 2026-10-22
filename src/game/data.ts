import type {
  Consumable,
  GameAction,
  InterfaceCategory,
  InterfaceId,
  ItemOption,
  LifeEvent,
  Location,
  MapAnchor,
  MapEdge,
  MapNode,
  Npc,
  NpcInteraction,
  Property,
  StatDelta,
  StatKey,
  ThemeName,
} from "./types";
import {
  CITY_EDGES,
  DEFAULT_CITY_ID,
  DISTRICTS,
  PLACES,
  PROPERTY_LISTINGS,
  districtName,
} from "./world";

export const STAT_KEYS: StatKey[] = [
  "health",
  "happiness",
  "energy",
  "satiety",
  "hygiene",
  "smarts",
  "looks",
  "streetCred",
];

export const STAT_LABELS: Record<StatKey, string> = {
  health: "Health",
  happiness: "Happiness",
  energy: "Energy",
  satiety: "Satiety",
  hygiene: "Hygiene",
  smarts: "Smarts",
  looks: "Looks",
  streetCred: "Street Cred",
};

export const SEASONS = [
  { id: "bloom", label: "Bloom", flavor: "Warm rain and neon reflections." },
  { id: "surge", label: "Surge", flavor: "Heat, blackouts, and short tempers." },
  { id: "rust", label: "Rust", flavor: "Cold wind and older debts." },
  { id: "frost", label: "Frost", flavor: "The city locks down and waits." },
] as const;

export const SEASON_DAYS = 7;
export const DAYS_PER_YEAR = SEASONS.length * SEASON_DAYS;

export const HUNGER_PER_HOUR = 3;
export const WAIT_ENERGY_PER_HOUR = 3;
export const HOTEL_REST_PER_HOUR = 4.5;
/** One map unit is roughly 20 meters; travel time follows straight-line distance. */
export const MINUTES_PER_MAP_UNIT = 0.05;

export const DEFAULT_HOME_ANCHOR: MapAnchor = {
  x: 300,
  y: 230,
  region: "center",
};

export function seasonName(index: number): string {
  return SEASONS[index]?.label ?? SEASONS[0].label;
}

export const CATEGORIES: InterfaceCategory[] = [
  {
    id: "health",
    label: "Body",
    glyph: "⚕",
    accent: "--ctp-green",
    side: "left",
    tagline: "Condition, food, and chems",
  },
  {
    id: "education",
    label: "Education",
    glyph: "▤",
    accent: "--ctp-blue",
    side: "left",
    tagline: "Learn new skills",
  },
  {
    id: "career",
    label: "Work",
    glyph: "▣",
    accent: "--ctp-yellow",
    side: "left",
    tagline: "Chase credits",
  },
  {
    id: "relationships",
    label: "Social",
    glyph: "♥",
    accent: "--ctp-red",
    side: "left",
    tagline: "People are leverage",
  },
  {
    id: "leisure",
    label: "Leisure",
    glyph: "◈",
    accent: "--ctp-pink",
    side: "left",
    tagline: "Spend your off-hours",
  },
  {
    id: "inventory",
    label: "Inventory",
    glyph: "▦",
    accent: "--ctp-sapphire",
    side: "right",
    tagline: "Everything you carry",
  },
  {
    id: "finance",
    label: "Finance",
    glyph: "¥",
    accent: "--ctp-teal",
    side: "right",
    tagline: "Track the flow",
  },
  {
    id: "crime",
    label: "Underworld",
    glyph: "☠",
    accent: "--ctp-maroon",
    side: "right",
    tagline: "High risk, high cred",
  },
  {
    id: "home",
    label: "Home",
    glyph: "⌂",
    accent: "--ctp-peach",
    side: "right",
    tagline: "Your slice of the sprawl",
  },
  {
    id: "system",
    label: "System",
    glyph: "⚙",
    accent: "--ctp-overlay-2",
    side: "right",
    tagline: "Options and saves",
  },
];

export const LEFT_CATEGORIES = CATEGORIES.filter((category) => category.side === "left");
export const RIGHT_CATEGORIES = CATEGORIES.filter((category) => category.side === "right");

export function categoryById(id: InterfaceId | null): InterfaceCategory {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0];
}

const ACTIONS: Partial<Record<InterfaceId, GameAction[]>> = {
  leisure: [
    {
      id: "leisure-club",
      label: "Club Night",
      description: "Lose a night to bass, smoke, and bad decisions.",
      cost: 120,
      energy: -12,
      time: 5,
      at: ["neon-strip"],
      hours: [20, 5],
      outcomes: [
        {
          chance: 0.7,
          text: "You dance until the lights come up. For a few hours, the city is yours.",
          tone: "good",
          stats: { happiness: 14, looks: 1 },
        },
        {
          chance: 0.3,
          text: "A fight erupts by the bar. You slip out before security seals the doors.",
          tone: "info",
          stats: { happiness: 5, health: -4 },
        },
      ],
    },
    {
      id: "leisure-braindance",
      label: "Rent a Memory Reel",
      description: "Borrow someone else's memories for an evening.",
      cost: 60,
      energy: -4,
      time: 3,
      at: ["neon-strip"],
      hours: [12, 4],
      stats: { happiness: 9, smarts: 1 },
      text: "You jack into a bootleg memory reel and wake up feeling like you've been somewhere.",
      tone: "good",
    },
    {
      id: "leisure-gym",
      label: "Street Gym",
      description: "Cheap weights, rusted machines, honest sweat.",
      cost: 40,
      energy: -18,
      time: 2,
      at: ["union-hall"],
      hours: [5, 22],
      stats: { health: 8, looks: 3 },
      text: "You put in a hard session at the gym under the overpass.",
      tone: "good",
    },
    {
      id: "leisure-noodles",
      label: "Chrome Noodle Bar",
      description: "Hot broth, synthetic pork, and a moment of peace.",
      cost: 25,
      energy: 10,
      time: 1,
      at: ["night-market"],
      hours: [18, 4],
      stats: { happiness: 5, satiety: 30 },
      text: "You eat at the noodle bar until the rain stops.",
      tone: "good",
    },
    {
      id: "leisure-companion",
      label: "Hire a Companion",
      description: "A little comfort, a little static in the wiring.",
      cost: 200,
      energy: -8,
      time: 2,
      at: ["neon-strip"],
      hours: [18, 5],
      stats: { happiness: 12, health: -3 },
      text: "You spend the night with a companion and wake up feeling more wired than rested.",
      tone: "info",
    },
    {
      id: "leisure-orbital",
      label: "Orbital Weekend",
      description: "Two days above the smog. Absurdly expensive, absolutely worth it.",
      cost: 2400,
      energy: 40,
      time: 48,
      at: ["consortium-plaza"],
      hours: [8, 20],
      stats: { happiness: 22, health: 4, looks: 2 },
      oncePerYear: true,
      text: "You burn a fortune on an orbital weekend. The stars are real. So is the bill.",
      tone: "good",
    },
    {
      id: "home-cook",
      label: "Prep Meals",
      description: "Batch-cook with what you have in cold storage.",
      cost: 15,
      energy: -4,
      time: 1.5,
      at: ["home"],
      hidden: true,
      requires: { feature: "cooling" },
      stats: { satiety: 40, happiness: 4 },
      text: "You cook a batch of food and portion it out. The place smells like a home.",
      tone: "good",
    },
    {
      id: "home-dress",
      label: "Dress Up",
      description: "Take your time with the wardrobe. Presentation is a weapon.",
      energy: -1,
      time: 0.5,
      at: ["home"],
      hidden: true,
      requires: { feature: "wardrobe" },
      stats: { looks: 2, happiness: 3 },
      oncePerYear: true,
      text: "You put together an outfit that makes the mirror worth looking at.",
      tone: "good",
    },
  ],

  health: [
    {
      id: "health-patch",
      label: "Street Surgeon Patch-Up",
      description: "Cash-only clinic work. No questions, mediocre anesthesia.",
      cost: 350,
      energy: -6,
      time: 2,
      at: ["undercity-clinic"],
      stats: { health: 18 },
      text: "A street surgeon patches you up with stolen supplies and a steady hand.",
      tone: "good",
    },
    {
      id: "health-therapy",
      label: "Trauma Therapy",
      description: "Talk to a licensed professional instead of a bartender.",
      cost: 220,
      time: 2,
      at: ["undercity-clinic"],
      hours: [9, 21],
      stats: { happiness: 12, health: 3 },
      text: "Your therapist helps you put a name to some of the static.",
      tone: "good",
    },
    {
      id: "health-stims",
      label: "IV Stim Drip",
      description: "Clinic-grade stims. Expensive, effective, and rough on the body.",
      cost: 180,
      time: 1,
      at: ["undercity-clinic"],
      stats: { energy: 55, health: -8 },
      text: "The drip hits all at once. You leave wired and slightly worse for wear.",
      tone: "info",
    },
    {
      id: "health-detox",
      label: "Detox Clinic",
      description: "Flush the cheap shit out of your system.",
      cost: 500,
      energy: -8,
      time: 6,
      at: ["undercity-clinic"],
      hours: [6, 23],
      stats: { health: 12, happiness: -4 },
      text: "Detox is ugly, but you come out cleaner than you went in.",
      tone: "info",
    },
    {
      id: "home-shower",
      label: "Shower at Home",
      description: "A real shower, your own soap, and ten minutes without the city.",
      energy: -2,
      time: 0.5,
      at: ["home"],
      hidden: true,
      requires: { feature: "shower" },
      stats: { hygiene: 45, happiness: 2 },
      text: "You shower at home. The day's grime goes down the drain.",
      tone: "good",
    },
    {
      id: "bathhouse-shower",
      label: "Bath House Shower",
      description: "Pay the attendant, get a stall, and scrub off the street.",
      cost: 25,
      energy: -2,
      time: 0.5,
      at: ["bath-house"],
      hours: [6, 23],
      stats: { hygiene: 50, happiness: 3 },
      text: "You pay for a shower at the bath house. It is not home, but it is clean.",
      tone: "good",
    },
    {
      id: "bathhouse-sauna",
      label: "Bath House Sauna",
      description: "Hot steam, cold water, and a bench that holds your whole week.",
      cost: 45,
      energy: 5,
      time: 1,
      at: ["bath-house"],
      hours: [6, 23],
      stats: { hygiene: 15, happiness: 7, health: 2 },
      text: "You sit in the steam until your thoughts go quiet.",
      tone: "good",
    },
  ],

  education: [
    {
      id: "education-datapad",
      label: "Study on Datapad",
      description: "Cheap tutorials, interrupted by ads for better tutorials.",
      energy: -8,
      time: 3,
      at: ["home", "gridhouse"],
      stats: { smarts: 5 },
      text: "You grind through tutorials on a cracked datapad.",
      tone: "good",
    },
    {
      id: "home-study",
      label: "Study at the Work Deck",
      description: "A quiet desk, a real display, and no one looking over your shoulder.",
      energy: -8,
      time: 2,
      at: ["home"],
      hidden: true,
      requires: { feature: "computer" },
      stats: { smarts: 4, happiness: 1 },
      text: "You study at your work deck until the screen starts to blur.",
      tone: "good",
    },
    {
      id: "education-bootcamp",
      label: "Gridrunning Bootcamp",
      description: "Twelve weeks of intrusion countermeasures and caffeine.",
      cost: 700,
      energy: -20,
      time: 8,
      at: ["gridhouse"],
      hours: [7, 2],
      stats: { smarts: 12, streetCred: 3 },
      text: "You finish netrunning bootcamp with a certificate and a headache.",
      tone: "good",
    },
    {
      id: "education-university",
      label: "Meridian Polytechnic",
      description: "A real degree, if you can survive the tuition.",
      cost: 3200,
      energy: -25,
      time: 10,
      at: ["gridhouse"],
      hours: [8, 22],
      stats: { smarts: 22 },
      oncePerYear: true,
      text: "A semester at Meridian Polytechnic expands your mind and empties your account.",
      tone: "good",
    },
    {
      id: "education-cert",
      label: "Corporate Certification",
      description: "A laminated credential that opens certain doors.",
      cost: 1400,
      energy: -12,
      time: 6,
      at: ["consortium-plaza"],
      hours: [8, 20],
      stats: { smarts: 10, streetCred: 5 },
      text: "You earn a corporate certification. It looks good in a hostile inbox.",
      tone: "good",
    },
    {
      id: "education-streetwise",
      label: "Streetwise Course",
      description: "Learn which alleys lie and which people do.",
      energy: -6,
      time: 3,
      at: ["night-market"],
      hours: [18, 4],
      stats: { smarts: 2, streetCred: 4 },
      text: "An old fixer teaches you how the street actually works.",
      tone: "good",
    },
  ],

  career: [
    {
      id: "career-gig",
      label: "Take a Freelance Gig",
      description: "A one-off job from the board. Deliver, get paid, disappear.",
      energy: -20,
      time: 5,
      at: ["union-hall"],
      hours: [5, 21],
      outcomes: [
        {
          chance: 0.78,
          text: "The client pays on delivery and leaves a five-star review.",
          tone: "good",
          creditsRange: [350, 850],
          stats: { streetCred: 2, happiness: 2 },
        },
        {
          chance: 0.22,
          text: "The client ghosts you after you finish the work.",
          tone: "bad",
          stats: { happiness: -3 },
        },
      ],
    },
    {
      id: "career-shift",
      label: "Work a Shift",
      description: "Clock in, keep your head down, clock out.",
      energy: -18,
      time: 8,
      at: ["union-hall"],
      hours: [5, 21],
      credits: 900,
      stats: { happiness: -2 },
      requires: { employed: true },
      text: "You work a full shift and collect your pay.",
      tone: "good",
    },
    {
      id: "career-promotion",
      label: "Ask for a Promotion",
      description: "Put your name in the room where the money lives.",
      energy: -5,
      time: 2,
      at: ["consortium-plaza"],
      hours: [8, 20],
      requires: { employed: true },
      oncePerYear: true,
      outcomes: [
        {
          chance: 0.5,
          text: "Your manager approves a raise. Nobody looks happy about it.",
          tone: "good",
          salary: 2400,
          stats: { happiness: 8, streetCred: 2 },
        },
        {
          chance: 0.5,
          text: "Your request is noted, filed, and quietly ignored.",
          tone: "bad",
          stats: { happiness: -5 },
        },
      ],
    },
    {
      id: "career-corporate",
      label: "Apply for a Corporate Job",
      description: "A badge, a desk, and a salary with strings attached.",
      energy: -10,
      time: 3,
      at: ["consortium-plaza"],
      hours: [8, 20],
      requires: { stat: "smarts", min: 35 },
      outcomes: [
        {
          chance: 0.6,
          text: "You pass the interview and sign a contract you didn't fully read.",
          tone: "good",
          occupation: "Junior Analyst",
          setSalary: 9600,
          stats: { happiness: 6, streetCred: 2 },
        },
        {
          chance: 0.4,
          text: "The recruiter smiles, thanks you, and never calls back.",
          tone: "bad",
          stats: { happiness: -4 },
        },
      ],
    },
    {
      id: "career-hustle",
      label: "Street Hustle",
      description: "Move some product for someone who won't give a name.",
      energy: -14,
      time: 5,
      at: ["night-market"],
      hours: [18, 4],
      outcomes: [
        {
          chance: 0.7,
          text: "The drop goes clean. Your cut lands in a burner account.",
          tone: "good",
          creditsRange: [120, 400],
          wanted: 1,
          stats: { streetCred: 1 },
        },
        {
          chance: 0.3,
          text: "A patrol drone spots the handoff. You run, and you bleed.",
          tone: "bad",
          wanted: 1,
          stats: { health: -5 },
        },
      ],
    },
  ],

  finance: [
    {
      id: "finance-scrub",
      label: "Scrub Your Trace",
      description: "Pay someone to make your name boring again.",
      cost: 500,
      time: 3,
      wanted: -1,
      text: "A fixer scrubs a little heat off your profile.",
      tone: "good",
    },
    {
      id: "finance-invest",
      label: "Invest in a Fixer's Scheme",
      description: "High risk. The fixer is very confident.",
      cost: 1000,
      time: 1,
      at: ["the-spine"],
      hours: [20, 6],
      outcomes: [
        {
          chance: 0.3,
          text: "The scheme pays out better than promised. You don't ask why.",
          tone: "good",
          credits: 2600,
          stats: { happiness: 8 },
        },
        {
          chance: 0.5,
          text: "The scheme breaks even after fees and lies.",
          tone: "info",
          credits: 1100,
          stats: { happiness: -2 },
        },
        {
          chance: 0.2,
          text: "The fixer disappears with the capital. Your capital.",
          tone: "bad",
          stats: { happiness: -10 },
        },
      ],
    },
  ],

  crime: [
    {
      id: "crime-pickpocket",
      label: "Pickpocket",
      description: "Small scores, small consequences, occasionally neither.",
      energy: -8,
      time: 2,
      at: ["night-market", "neon-strip"],
      hours: [18, 5],
      requires: { maxWanted: 4 },
      outcomes: [
        {
          chance: 0.55,
          text: "Your fingers find a wallet and vanish into the crowd.",
          tone: "good",
          creditsRange: [80, 240],
          wanted: 1,
        },
        {
          chance: 0.45,
          text: "A mark catches your wrist. You twist free, but not clean.",
          tone: "bad",
          wanted: 1,
          stats: { health: -4 },
        },
      ],
    },
    {
      id: "crime-dataheist",
      label: "Data Heist",
      description: "Crack a corporate shard and sell what's inside.",
      energy: -16,
      time: 6,
      at: ["gridhouse"],
      hours: [20, 5],
      requires: { stat: "smarts", min: 40 },
      outcomes: [
        {
          chance: 0.6,
          text: "The ice breaks. The buyer pays in untraceable credit chips.",
          tone: "good",
          credits: 1400,
          wanted: 1,
          stats: { streetCred: 2 },
        },
        {
          chance: 0.4,
          text: "The shard burns your deck and singes your nervous system.",
          tone: "bad",
          wanted: 2,
          stats: { health: -6 },
        },
      ],
    },
    {
      id: "crime-infiltration",
      label: "Corporate Infiltration",
      description: "Walk into the tower like you belong there.",
      energy: -25,
      time: 8,
      at: ["consortium-plaza"],
      hours: [20, 6],
      requires: { stat: "streetCred", min: 45 },
      outcomes: [
        {
          chance: 0.5,
          text: "You walk out with a server rack's worth of secrets.",
          tone: "good",
          credits: 4200,
          wanted: 2,
          stats: { streetCred: 3, happiness: 5 },
        },
        {
          chance: 0.5,
          text: "Internal security corners you on the 40th floor. You jump a fence and a lot of luck.",
          tone: "bad",
          wanted: 2,
          stats: { health: -18 },
        },
      ],
    },
    {
      id: "crime-bounty",
      label: "Take a Bounty",
      description: "Someone wants someone brought in. You're the someone who does that.",
      energy: -20,
      time: 6,
      at: ["the-spine"],
      hours: [20, 6],
      requires: { stat: "health", min: 40 },
      outcomes: [
        {
          chance: 0.65,
          text: "The target comes quietly. The bounty clears the same night.",
          tone: "good",
          credits: 1600,
          wanted: -1,
          stats: { streetCred: 2 },
        },
        {
          chance: 0.35,
          text: "The target fights. You win, barely, and pay for it in blood.",
          tone: "bad",
          stats: { health: -15, happiness: -4 },
        },
      ],
    },
    {
      id: "crime-laylow",
      label: "Lay Low",
      description: "A rented room, cash only, no questions.",
      cost: 300,
      energy: -5,
      time: 12,
      at: ["home", "no-tell-motel"],
      wanted: -1,
      text: "You disappear for a few weeks and let the heat cool.",
      tone: "good",
    },
    {
      id: "crime-bribe",
      label: "Bribe a Cop",
      description: "Make your file a little less interesting.",
      cost: 900,
      time: 2,
      at: ["night-market", "the-spine"],
      hours: [18, 6],
      requires: { minWanted: 1 },
      wanted: -2,
      stats: { happiness: -3 },
      text: "A detective takes your envelope and forgets your face.",
      tone: "info",
    },
  ],
};

export function actionsFor(id: InterfaceId | null): GameAction[] {
  return ((id && ACTIONS[id]) || []).filter((action) => !action.hidden);
}

/** Every non-hidden action tied to this exact address, across all interfaces. */
export function actionsAt(locationId: string): GameAction[] {
  const found: GameAction[] = [];

  for (const actions of Object.values(ACTIONS)) {
    for (const action of actions ?? []) {
      if (!action.hidden && action.at?.includes(locationId)) {
        found.push(action);
      }
    }
  }

  return found;
}

export function actionById(id: string): GameAction | undefined {
  return Object.values(ACTIONS)
    .flat()
    .find((action) => action.id === id);
}

export const ITEMS: Record<"assets" | "cyberware", ItemOption[]> = {
  assets: [
    {
      id: "asset-sidearm",
      label: "Kestrel Sidearm",
      price: 800,
      description: "Small, loud, and reassuring in the wrong neighborhoods.",
      stats: { streetCred: 2 },
      slot: "assets",
    },
    {
      id: "asset-jacket",
      label: "Armored Flight Jacket",
      price: 600,
      description: "Kevlar weave under cracked leather. Looks good in rain.",
      stats: { looks: 3 },
      slot: "assets",
    },
    {
      id: "asset-bike",
      label: "Vanta Bike",
      price: 12000,
      description: "A machine that turns every commute into a rumor.",
      stats: { looks: 4, happiness: 5 },
      slot: "assets",
    },
    {
      id: "asset-drone",
      label: "Recon Drone Kit",
      price: 1500,
      description: "A palm-sized eye in the sky with questionable firmware.",
      stats: { smarts: 2 },
      slot: "assets",
    },
  ],
  cyberware: [
    {
      id: "cyber-neural",
      label: "Neural Link",
      price: 1500,
      description: "Thought to machine, machine to thought. The entry fee.",
      stats: { smarts: 5, streetCred: 2 },
      slot: "cyberware",
    },
    {
      id: "cyber-subdermal",
      label: "Subdermal Armor",
      price: 2400,
      description: "Ballistic weave under the skin. Shrug off what used to kill you.",
      stats: { health: 10 },
      slot: "cyberware",
    },
    {
      id: "cyber-optics",
      label: "Optics Suite",
      price: 1800,
      description: "Thermal, zoom, and a HUD that never quite stops talking.",
      stats: { looks: 2, smarts: 3 },
      slot: "cyberware",
    },
    {
      id: "cyber-arm",
      label: "Cyberarm",
      price: 3200,
      description: "Grip strength of a freight door and a warranty that voids in combat.",
      stats: { health: 5, looks: 2 },
      slot: "cyberware",
    },
    {
      id: "cyber-overclock",
      label: "Overclock Spine",
      price: 6000,
      description: "Move faster than the world. Pay for it every time you do.",
      stats: { energy: 10, streetCred: 6, health: -4 },
      slot: "cyberware",
    },
  ],
};

export function hotelRestPerHour(location: Location): number {
  return location.hotelRest ?? HOTEL_REST_PER_HOUR;
}

export const PROPERTIES: Property[] = PROPERTY_LISTINGS.filter(
  (listing) => listing.cityId === DEFAULT_CITY_ID,
).map((listing) => ({
  id: listing.id,
  name: listing.name,
  district: districtName(listing.districtId),
  address: listing.address,
  cityId: listing.cityId,
  x: listing.x,
  y: listing.y,
  region: listing.region,
  rent: listing.rent,
  price: listing.price,
  deposit: listing.deposit,
  upkeep: listing.upkeep,
  slots: listing.slots,
  description: listing.description,
  stats: listing.stats,
}));

export function propertyById(id: string): Property {
  return PROPERTIES.find((property) => property.id === id) ?? PROPERTIES[0];
}

export function propertyAnchor(property: Property): MapAnchor {
  return { x: property.x, y: property.y, region: property.region };
}

export function homeLocation(property: Property): Location {
  return {
    id: "home",
    name: "Home",
    kind: "home",
    district: property.district,
    description: `${property.name} — ${property.description}`,
    address: property.address,
    cityId: property.cityId,
    services: ["Rest", "Storage", "Study", "Supplies"],
  };
}

export const CONSUMABLES: Consumable[] = [
  {
    id: "food-paste",
    label: "Nutrient Paste",
    price: 12,
    time: 0.25,
    description: "A grey tube of everything your body needs and nothing it wants.",
    stats: { satiety: 30, happiness: -2 },
    text: "You choke down a tube of nutrient paste.",
    tone: "info",
  },
  {
    id: "food-noodles",
    label: "Synth Noodle Cup",
    price: 30,
    time: 0.5,
    description: "Hot, salty, and technically food.",
    stats: { satiety: 40, happiness: 3 },
    text: "You eat a cup of synth noodles on the curb.",
    tone: "good",
  },
  {
    id: "food-kebab",
    label: "Synth Kebab",
    price: 45,
    time: 0.5,
    description: "Meat-adjacent protein wrapped in something that used to be bread.",
    stats: { satiety: 45, health: -1, happiness: 2 },
    text: "You eat a synth kebab. Your body files a complaint.",
    tone: "info",
  },
  {
    id: "food-ramen",
    label: "Street Ramen",
    price: 70,
    time: 1,
    description: "A real bowl from a stall that has survived three crackdowns.",
    stats: { satiety: 60, happiness: 6, health: 1 },
    text: "You eat a proper bowl of ramen. The city feels briefly survivable.",
    tone: "good",
  },
  {
    id: "drink-coffee",
    label: "Black Coffee",
    price: 18,
    time: 0.25,
    description: "Bitter, synthetic, and the only thing holding the morning together.",
    stats: { energy: 14, happiness: 2 },
    text: "You drink a black coffee. The static clears, a little.",
    tone: "good",
  },
  {
    id: "drink-volt",
    label: "Volt Cola",
    price: 35,
    time: 0.25,
    description: "Sugar, taurine, and a warning label in six languages.",
    stats: { energy: 28, health: -4, happiness: 3 },
    text: "Volt Cola hits your bloodstream like a police siren.",
    tone: "info",
  },
  {
    id: "drug-stim",
    label: "Combat Stim",
    price: 90,
    time: 0.25,
    description: "Borrow energy from tomorrow's body. The bill always comes due.",
    stats: { energy: 45, health: -10, happiness: 4 },
    text: "The stim hits. Your hands shake and the world sharpens.",
    tone: "info",
  },
  {
    id: "med-gel",
    label: "Med-Gel",
    price: 160,
    time: 0.5,
    description: "A cold pack of nanites that stitch what they can find.",
    stats: { health: 22, satiety: 10 },
    text: "You apply med-gel. Your skin itches as it knits.",
    tone: "good",
  },
];

export function consumableById(id: string): Consumable | undefined {
  return CONSUMABLES.find((item) => item.id === id);
}

const HOME_LOCATION: Location = {
  id: "home",
  name: "Home",
  kind: "home",
  district: districtName("kestrel-row"),
  description:
    "Your current residence. The street address changes with your lease.",
  services: ["Rest", "Storage", "Study", "Supplies"],
};

export const LOCATIONS: Location[] = [
  HOME_LOCATION,
  ...PLACES.filter((place) => place.cityId === DEFAULT_CITY_ID).map((place) => ({
    id: place.id,
    name: place.name,
    kind: place.kind,
    district: districtName(place.districtId),
    description: place.description,
    address: place.address,
    cityId: place.cityId,
    openHours: place.openHours,
    services: place.services,
    hotelRate: place.hotelRate,
    hotelRest: place.hotelRest,
  })),
];

/** Concrete, derived facts about a district. No authored quality scores. */
export type DistrictFacts = {
  id: string;
  name: string;
  blurb: string;
  placeCount: number;
  services: string[];
  rentRange: [number, number] | null;
  saleRange: [number, number] | null;
};

export function districtFacts(name: string): DistrictFacts | null {
  const district = DISTRICTS.find((entry) => entry.name === name);
  if (!district) {
    return null;
  }

  const places = LOCATIONS.filter(
    (location) => location.kind !== "home" && location.district === name,
  );
  const homes = PROPERTIES.filter((property) => property.district === name);
  const services = [...new Set(places.flatMap((place) => place.services))].sort();
  const rents = homes.map((property) => property.rent);
  const prices = homes.map((property) => property.price);

  return {
    id: district.id,
    name: district.name,
    blurb: district.blurb,
    placeCount: places.length,
    services,
    rentRange:
      rents.length > 0 ? [Math.min(...rents), Math.max(...rents)] : null,
    saleRange:
      prices.length > 0 ? [Math.min(...prices), Math.max(...prices)] : null,
  };
}

export function locationById(id: string): Location {
  return LOCATIONS.find((location) => location.id === id) ?? LOCATIONS[0];
}

/** Resolves the runtime location, including the movable Home node. */
export function locationFor(id: string, property: Property): Location {
  return id === "home" ? homeLocation(property) : locationById(id);
}

export const MAP_NODES: MapNode[] = PLACES.filter(
  (place) => place.cityId === DEFAULT_CITY_ID,
).map((place) => ({
  locationId: place.id,
  x: place.map.x,
  y: place.map.y,
  region: place.map.region,
}));

export const MAP_EDGES: MapEdge[] = CITY_EDGES.filter(
  (edge) => edge.cityId === DEFAULT_CITY_ID,
).map(({ id, from, to }) => ({ id, from, to }));

/** The active home is a movable node. It connects to the three nearest venues. */
export function mapNodes(anchor: MapAnchor = DEFAULT_HOME_ANCHOR): MapNode[] {
  return [{ locationId: "home", ...anchor }, ...MAP_NODES];
}

export function mapEdges(anchor: MapAnchor = DEFAULT_HOME_ANCHOR): MapEdge[] {
  const home = { locationId: "home", ...anchor };
  const nearest = [...MAP_NODES]
    .map((node) => ({
      node,
      distance: Math.hypot(node.x - home.x, node.y - home.y),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  return [
    ...MAP_EDGES,
    ...nearest.map(({ node }) => ({
      id: `home-${node.locationId}`,
      from: "home",
      to: node.locationId,
    })),
  ];
}

export function edgeMinutes(edge: MapEdge, nodes: MapNode[]): number {
  const from = nodes.find((node) => node.locationId === edge.from);
  const to = nodes.find((node) => node.locationId === edge.to);
  if (!from || !to) {
    return 1;
  }

  return Math.max(
    2,
    Math.round(Math.hypot(from.x - to.x, from.y - to.y) * MINUTES_PER_MAP_UNIT),
  );
}

export function routeBetween(
  from: string,
  to: string,
  anchor: MapAnchor = DEFAULT_HOME_ANCHOR,
): { minutes: number; path: string[] } {
  if (from === to) {
    return { minutes: 0, path: [from] };
  }

  const nodes = mapNodes(anchor);
  const edges = mapEdges(anchor);
  const adjacency = new Map<string, { id: string; minutes: number }[]>();
  for (const node of nodes) {
    adjacency.set(node.locationId, []);
  }

  for (const edge of edges) {
    const minutes = edgeMinutes(edge, nodes);
    adjacency.get(edge.from)?.push({ id: edge.to, minutes });
    adjacency.get(edge.to)?.push({ id: edge.from, minutes });
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const unvisited = new Set<string>(nodes.map((node) => node.locationId));

  for (const id of unvisited) {
    distances.set(id, Infinity);
  }
  distances.set(from, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let best = Infinity;

    for (const id of unvisited) {
      const distance = distances.get(id) ?? Infinity;
      if (distance < best) {
        best = distance;
        current = id;
      }
    }

    if (current === null || best === Infinity) {
      break;
    }

    unvisited.delete(current);
    if (current === to) {
      break;
    }

    // Home is a destination, not a shortcut. Routes between venues don't
    // cut through the player's apartment.
    if (current === "home" && from !== "home") {
      continue;
    }

    for (const neighbor of adjacency.get(current) ?? []) {
      if (!unvisited.has(neighbor.id)) {
        continue;
      }

      const candidate = best + neighbor.minutes;
      if (candidate < (distances.get(neighbor.id) ?? Infinity)) {
        distances.set(neighbor.id, candidate);
        previous.set(neighbor.id, current);
      }
    }
  }

  const path: string[] = [];
  let cursor: string | undefined = to;
  while (cursor) {
    path.unshift(cursor);
    cursor = previous.get(cursor);
  }

  return {
    minutes: distances.get(to) ?? 0,
    path: path[0] === from ? path : [from, to],
  };
}

export function isHourInWindow(hour: number, window?: [number, number]): boolean {
  if (!window) {
    return true;
  }

  const [open, close] = window;
  if (open === close) {
    return true;
  }

  const hourOfDay = ((hour % 24) + 24) % 24;
  return open < close
    ? hourOfDay >= open && hourOfDay < close
    : hourOfDay >= open || hourOfDay < close;
}

export function isOpenNow(location: Location, secondOfDay: number): boolean {
  return isHourInWindow(secondOfDay / 3600, location.openHours);
}

export const LIFE_EVENTS: LifeEvent[] = [
  {
    id: "event-credchip",
    text: "A courier drone drops a cred-chip at your feet and speeds off. You keep it.",
    tone: "good",
    credits: 180,
  },
  {
    id: "event-landlord",
    text: "Your landlord raises the rent and sends it as a cheerful text.",
    tone: "bad",
    stats: { happiness: -8 },
  },
  {
    id: "event-tail",
    text: "You catch the same corporate tail three times before you lose them.",
    tone: "bad",
    wanted: 1,
    stats: { happiness: -3 },
  },
  {
    id: "event-kid",
    text: "A neighborhood kid asks for help fixing a deck. You spend the afternoon on it.",
    tone: "good",
    stats: { happiness: 5, smarts: 1 },
  },
  {
    id: "event-tattoo",
    text: "You wake up with a migraine and a new tattoo you don't remember paying for.",
    tone: "info",
    stats: { health: -4, happiness: 3, looks: -1 },
  },
  {
    id: "event-noodles",
    text: "Your favorite noodle stand closes. The city feels a little smaller.",
    tone: "bad",
    stats: { happiness: -6 },
  },
  {
    id: "event-deck",
    text: "You find a functioning cyberdeck in a scrap pile. It still boots.",
    tone: "good",
    stats: { smarts: 3 },
  },
  {
    id: "event-medic",
    text: "A street medic stitches you up for free after a rough night.",
    tone: "good",
    stats: { health: 8 },
  },
  {
    id: "event-shootout",
    text: "You get caught in a gang shootout. You keep your life and lose some blood.",
    tone: "bad",
    minAge: 18,
    stats: { health: -12 },
    wanted: 1,
  },
  {
    id: "event-fixer",
    text: "A fixer remembers your face and says they'll call. That's either good or very bad.",
    tone: "good",
    stats: { streetCred: 3 },
  },
  {
    id: "event-skimmed",
    text: "Your bank account gets skimmed by someone with better software than the bank.",
    tone: "bad",
    credits: -250,
  },
  {
    id: "event-afterlife",
    text: "You spend a night at the Afterlife, trading stories with people who shouldn't be alive.",
    tone: "good",
    stats: { happiness: 7, energy: -5 },
  },
  {
    id: "event-recruiter",
    text: "A corporate recruiter scans your profile and leaves a vague, flattering message.",
    tone: "info",
    stats: { smarts: 1, streetCred: 1 },
  },
  {
    id: "event-joints",
    text: "Your joints ache in the acid rain. Age is a subscription you can't cancel.",
    tone: "bad",
    minAge: 45,
    stats: { health: -6 },
  },
  {
    id: "event-crate",
    text: "A dead relative leaves you a crate of old gear and a stack of unpaid bills.",
    tone: "info",
    minAge: 30,
    credits: 600,
    stats: { happiness: -2 },
  },
  {
    id: "event-crackdown",
    text: "A corp security sweep locks down your block. You spend the night in a stairwell.",
    tone: "bad",
    minWanted: 2,
    stats: { energy: -10, happiness: -4 },
  },
];

export const NPC_FIRST_NAMES = [
  "V",
  "Ryo",
  "Jax",
  "Nadia",
  "Kiro",
  "Sable",
  "Mako",
  "Iris",
  "Dex",
  "Rook",
  "Yuki",
  "Silas",
  "Nyx",
  "Juno",
  "Ash",
  "Cass",
  "Mira",
  "Tomo",
];

export const NPC_LAST_NAMES = [
  "Kestrel",
  "Volt",
  "Zero",
  "Marrow",
  "Six",
  "Chrome",
  "Vega",
  "Kade",
  "Static",
  "Hex",
  "Nova",
  "Ward",
  "Cinder",
  "Halo",
];

export const NPC_ROLES = [
  "Fixer",
  "Gridrunner",
  "Chopdoc",
  "Corporate Suit",
  "Blade",
  "Media",
  "Nomad",
  "Companion",
  "Techie",
  "Patrol Cop",
];

export const NPC_DISTRICTS = DISTRICTS.filter(
  (district) => district.cityId === DEFAULT_CITY_ID,
).map((district) => district.name);

export const NPC_TRAITS = [
  "loyal",
  "greedy",
  "paranoid",
  "idealistic",
  "burned out",
  "ambitious",
  "superstitious",
  "quiet",
];

export const NPC_REPLIES: Record<NpcInteraction, string[]> = {
  message: [
    "you up? got something with your name on it.",
    "saw your face on a screen. weird week?",
    "stay off the main streets tonight.",
    "if you're selling, I'm buying. if you're buying, we should talk.",
    "you still alive? good.",
  ],
  hangout: [
    "next round's on you, yeah?",
    "I know a place where the cameras don't work.",
    "you're better company than the static.",
    "let's not talk business for one night.",
    "same booth, same rain, same us.",
  ],
  gift: [
    "you didn't have to. but I'm keeping it.",
    "this buys you one favor. choose it carefully.",
    "credits don't fix people, but they buy good distractions.",
    "I owe you. I hate owing people.",
    "shiny. you're learning how this city works.",
  ],
  date: [
    "one drink. then we'll see what the night wants.",
    "you're not as bad at this as you pretend.",
    "the city looks almost honest from up here.",
    "don't make this weird. too late, maybe.",
    "I could get used to this. that scares me.",
  ],
};

export const NPC_GREETINGS = [
  "Keep your head down out there.",
  "I hear things. Sometimes they're even true.",
  "You look like you need a favor or a warning.",
  "Credits are tight. Trust is tighter.",
  "The city's got teeth this week.",
  "Don't trust the quiet ones.",
];

export const THEMES: { id: ThemeName; label: string }[] = [
  { id: "mocha", label: "Mocha" },
  { id: "macchiato", label: "Macchiato" },
  { id: "frappe", label: "Frappé" },
  { id: "latte", label: "Latte" },
];

let nextNpcId = 1;

export function randomFrom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomNpc(): Npc {
  return {
    id: nextNpcId++,
    name: `${randomFrom(NPC_FIRST_NAMES)} ${randomFrom(NPC_LAST_NAMES)}`,
    role: randomFrom(NPC_ROLES),
    district: randomFrom(NPC_DISTRICTS),
    trait: randomFrom(NPC_TRAITS),
    relationship: randomInt(20, 55),
    lastLine: randomFrom(NPC_GREETINGS),
  };
}

export function activeLifeEvents(age: number, wanted: number): LifeEvent[] {
  return LIFE_EVENTS.filter(
    (event) =>
      (event.minAge === undefined || age >= event.minAge) &&
      (event.maxAge === undefined || age <= event.maxAge) &&
      (event.minWanted === undefined || wanted >= event.minWanted),
  );
}

export function statDeltaOf(stats: StatDelta | undefined, key: StatKey): number {
  return stats?.[key] ?? 0;
}

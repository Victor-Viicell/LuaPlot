import type { FurnitureCategory, FurnitureOption } from "./types";

/**
 * FURNITURE CATALOG
 * =================
 * Furniture is installed in a home and occupies slots. The home's `slots` value
 * is physical space; the item's `slots` value is how much it consumes.
 *
 * One item per category can be installed at a time. Buying a new bed replaces
 * the old bed. Features are what actually change the game: a home without a
 * shower cannot shower at home; a home without a bed cannot be slept in.
 *
 * The player owns the furniture, not the landlord. It moves with the player when
 * there is enough space in the new home.
 */
export const FURNITURE: FurnitureOption[] = [
  {
    id: "bed-mat",
    label: "Foam Mat",
    category: "bed",
    price: 120,
    slots: 1,
    description: "A thin foam mat on the floor. Better than concrete, barely.",
    features: ["bed"],
    sleepEnergy: 4.5,
    sleepHappiness: 1,
    interactions: [{ label: "SLEEP", timeMode: "sleep" }],
  },
  {
    id: "bed-frame",
    label: "Spring Bed",
    category: "bed",
    price: 480,
    slots: 1,
    description: "A real frame and a mattress with most of its springs intact.",
    features: ["bed"],
    sleepEnergy: 5.5,
    sleepHappiness: 3,
    interactions: [{ label: "SLEEP", timeMode: "sleep" }],
  },
  {
    id: "bed-pod",
    label: "Gel Sleep Pod",
    category: "bed",
    price: 1800,
    slots: 1,
    description:
      "Climate-controlled, sound-dampened, and almost worth the price.",
    features: ["bed"],
    sleepEnergy: 7,
    sleepHappiness: 6,
    sleepHealth: 1,
    interactions: [{ label: "SLEEP", timeMode: "sleep" }],
  },
  {
    id: "chair-folding",
    label: "Folding Chair",
    category: "seating",
    price: 180,
    slots: 1,
    description: "Metal legs and a canvas seat. It holds you, barely.",
    features: ["rest"],
    restEnergy: 1.5,
    interactions: [{ label: "REST", timeMode: "rest" }],
  },
  {
    id: "chair-couch",
    label: "Secondhand Couch",
    category: "seating",
    price: 850,
    slots: 1,
    description: "Lumpy, worn, and exactly where you want to be after a shift.",
    features: ["rest"],
    restEnergy: 3,
    interactions: [{ label: "REST", timeMode: "rest" }],
  },
  {
    id: "chair-recliner",
    label: "Recliner",
    category: "seating",
    price: 2200,
    slots: 1,
    description: "It leans back, the heat works, and the city gets quieter.",
    features: ["rest"],
    restEnergy: 4.5,
    interactions: [{ label: "REST", timeMode: "rest" }],
  },
  {
    id: "shower-stall",
    label: "Stall Shower",
    category: "shower",
    price: 750,
    slots: 1,
    description: "A narrow stall, a weak head, and your own hot water.",
    features: ["shower"],
    interactions: [{ label: "SHOWER", actionId: "home-shower" }],
  },
  {
    id: "cool-locker",
    label: "Cold Locker",
    category: "cooling",
    price: 600,
    slots: 1,
    description: "Keeps a week of food cold enough to trust.",
    features: ["cooling"],
    interactions: [{ label: "COOK", actionId: "home-cook" }],
  },
  {
    id: "work-deck",
    label: "Work Deck",
    category: "computer",
    price: 1200,
    slots: 1,
    description: "A desk, a display, and enough processing power to study at home.",
    features: ["computer"],
    interactions: [{ label: "STUDY", actionId: "home-study" }],
  },
  {
    id: "wardrobe",
    label: "Wardrobe",
    category: "storage",
    price: 350,
    slots: 1,
    description: "Somewhere to keep clothes that are not the floor.",
    features: ["wardrobe"],
    interactions: [{ label: "DRESS", actionId: "home-dress" }],
  },
];

export const FURNITURE_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  bed: "Bed",
  seating: "Seating",
  shower: "Shower",
  cooling: "Cold Storage",
  computer: "Workspace",
  storage: "Wardrobe",
  comfort: "Comfort",
};

export function furnitureById(id: string): FurnitureOption | undefined {
  return FURNITURE.find((item) => item.id === id);
}

export function furnitureSlotsUsed(ids: string[]): number {
  return ids.reduce(
    (total, id) => total + (furnitureById(id)?.slots ?? 0),
    0,
  );
}

export function furnitureWithFeature(
  ids: string[],
  feature: string,
): FurnitureOption | undefined {
  return ids
    .map((id) => furnitureById(id))
    .find((item) => item?.features.includes(feature));
}

export function installedInCategory(
  ids: string[],
  category: FurnitureCategory,
): FurnitureOption | undefined {
  return ids
    .map((id) => furnitureById(id))
    .find((item) => item?.category === category);
}

# NeonLife — Living World Simulation Plan

This document sets the direction for **real buildings, corporations, jobs, NPCs,
families, and lineage**. It supersedes the authored neighborhood-tier model.

## 1. Principle: quality is emergent

Neighborhood quality is **not** a number, tier, or multiplier. It is the result
of what actually exists there:

- which businesses operate, what they sell, and how good they are;
- how many jobs exist, what they pay, and whether they are filled;
- building condition, unit size, amenities, and vacancy;
- who lives there: incomes, households, family status, reputation;
- real safety: security, lighting, foot traffic, crime, enforcement;
- access: travel times, transit, and distance to work and services;
- prices and rents produced by that demand.

A `DistrictProfile` may be computed for the UI, but it is a **read-only
summary**, never authored. There is no `tier`, `serviceQuality`,
`jobMultiplier`, or `safety` field in the final model.

## 2. Static world vs. living state

**Authored** (source files):

- geography: Nation → State → City → District → Address;
- buildings and their units;
- corporations;
- businesses and job templates;
- civic infrastructure.

**Simulated** (save state):

- people, families, households, lineage;
- which job slot each person fills;
- leases, ownership, vacancy;
- business finances, prices, and hiring;
- player state and history;
- dynamic building condition and maintenance.

The authored world is the stage. The simulation is what happens on it.

## 3. Entity graph

```
Nation
└─ State
   └─ City
      └─ District
         └─ Address
            └─ Building
               └─ Unit (residential / commercial / civic)
                  ├─ Household (rent / own)
                  └─ Business
                     └─ JobSlot (filled by a Person or vacant)

Corporation ─ owns ── Buildings
            └─ operates ── Businesses ── JobSlots

Lineage ─ has ── Families ── have ── People
                                  └─ Households ── occupy ── Units
```

### Static entities

```ts
type BuildingKind =
  | "residential"
  | "commercial"
  | "industrial"
  | "mixed"
  | "civic";

type BuildingOwner =
  | { kind: "corporation"; id: string }
  | { kind: "family"; id: string }
  | { kind: "city" };

type Building = {
  id: string;
  addressId: string;
  districtId: string;
  kind: BuildingKind;
  floors: number;
  condition: number;        // 0–100, changes over time
  owner: BuildingOwner;
  amenities: string[];      // gym, laundry, parking, security, roof access
  units: BuildingUnit[];
  map: { x: number; y: number };
};

type BuildingUnit = {
  id: string;
  buildingId: string;
  kind: "room" | "studio" | "apartment" | "house" | "shop" | "office"
      | "warehouse" | "studio-stage" | "clinic" | "civic";
  bedrooms: number;
  capacity: number;         // people who can live here
  rent: number;             // market rent, can change
  price: number;            // sale price, can change
  condition: number;        // 0–100
  occupiedBy?: string;      // household id
  operatedBy?: string;      // business id
};

type Industry =
  | "food"
  | "technology"
  | "software"
  | "hardware"
  | "entertainment"
  | "healthcare"
  | "retail"
  | "logistics"
  | "finance"
  | "security"
  | "media"
  | "construction"
  | "energy"
  | "civic";

type Corporation = {
  id: string;
  name: string;
  industry: Industry;
  foundedYear: number;
  wealth: number;
  reputation: number;
  headquartersBuildingId: string;
  ownedBuildingIds: string[];
  businessIds: string[];
};

type Business = {
  id: string;
  corporationId: string;
  buildingId: string;
  unitId?: string;
  name: string;
  industry: Industry;
  services: string[];
  openHours: [number, number];
  revenue: number;
  reputation: number;
  jobSlots: JobSlot[];
};

type JobSlot = {
  id: string;
  businessId: string;
  title: string;
  industry: Industry;
  wagePerHour: number;
  shift: [number, number];
  requirements: {
    education?: number;
    smarts?: number;
    looks?: number;
    streetCred?: number;
  };
  filledBy?: string;        // person id, undefined means open
};
```

### Living entities

```ts
type Person = {
  id: string;
  name: string;
  age: number;
  pronouns: string;
  familyId: string;
  householdId: string;
  homeUnitId?: string;
  jobSlotId?: string;
  employerId?: string;
  income: number;           // derived from the job slot
  education: number;
  skills: Record<string, number>;
  health: number;
  happiness: number;
  schedule: ScheduleEntry[];
  relationships: Relationship[];
};

type Family = {
  id: string;
  surname: string;
  lineageId: string;
  originClass: SocialClass; // roll at generation; affects starting luck
  wealth: number;
  reputation: number;
  homeUnitId?: string;
  memberIds: string[];
  ownedUnitIds: string[];
};

type Lineage = {
  id: string;
  surname: string;
  foundedYear: number;
  originCityId: string;
  originClass: SocialClass;
  generations: number;
  history: LineageEvent[];
};

type Household = {
  id: string;
  unitId: string;
  memberIds: string[];
  tenure: "rent" | "own";
  leaseUntil?: number;      // season/year
};
```

## 4. Buildings and units

Buildings are physical and addressable. A tower can hold hundreds of
households; a rooming house can hold a dozen; a shop is a commercial unit on the
ground floor; a mixed-use building combines both.

- **Residential units** have capacity, bedrooms, rent, sale price, and condition.
- **Commercial units** house businesses, clinics, clubs, workshops, offices.
- **Civic units** house schools, clinics, police, transit, administration.
- Condition and amenities affect rent, sleep recovery, safety, and events.
- Buildings can be owned by corporations, families, or the city. Owners maintain
  them, collect rent, and can sell.

A neighborhood's housing quality is the actual distribution of its buildings and
units, not a score.

### Furniture, slots, and features

A home is not automatically functional. It is a set of **slots** and the
furniture installed in them.

- A unit has `furnitureSlots`. A cheap room might have 4; a studio 6; a tower
  unit 8–10.
- A furniture item consumes `slots`. Most items take 1.
- One item per category can be installed. Buying a better bed replaces the old
  bed; the old item is resold or stored.
- **Furniture belongs to the occupant, not the landlord.** It moves with the
  player if the new home has room; otherwise it must be sold or stored.
- Furniture is bought from real businesses and delivered/installed at home.
- **Objects are interacted with.** Sleep requires using a bed; rest requires a
  chair or couch; showering requires a shower. The object opens the relevant
  action or duration dialog. Home actions do not live in a global menu.
- Features are not cosmetic. They gate actions and change simulation outcomes.
- Standing wait always works but costs more energy. Sitting/resting on a real
  seat restores energy at that item's rate instead.

```ts
type FurnitureCategory =
  | "bed" | "shower" | "cooling" | "computer" | "storage" | "comfort";

type Furniture = {
  id: string;
  name: string;
  category: FurnitureCategory;
  slots: number;
  price: number;
  features: string[];          // "bed", "shower", "cooling", ...
  sleep?: {
    energyPerHour: number;
    happinessOnWake: number;
    healthAfterSixHours?: number;
  };
};

type Unit = {
  // ...building fields
  furnitureSlots: number;
  installedFurniture: string[];
};
```

Examples of feature gates:

| Feature | Enables | Without it |
| ------- | ------- | ---------- |
| `bed` | sleep at home, with that bed's energy/happiness | no sleep at home; hotel or floor penalty |
| `rest` | chair/couch rest at that seat's recovery rate | standing wait costs more energy |
| `shower` | shower at home | must pay a bath house or stay dirty |
| `cooling` | batch-cook / store food | food spoils or cannot be bought in bulk |
| `computer` | study or work remotely at home | must travel to a Gridhouse or workplace |
| `wardrobe` | dress up, presentation actions | limited looks actions |

Hygiene is a real need. It decays while awake, and low hygiene costs happiness
and social outcomes. A shower restores it. A home without a shower forces the
player to use a public bath house (or stay dirty).

### Service businesses: bath houses

A bath house is an ordinary business in a building:

- it charges entry or per-use fees;
- it has opening hours and a reputation;
- it hires attendants, cleaners, and maintenance staff as real job slots;
- if a slot is unfilled, the job is available to an NPC or the player;
- service quality comes from staffing, maintenance, and building condition —
  not a district score.

The same pattern covers laundries, clinics, gyms, repair shops, and restaurants.

## 5. Corporations and businesses

Corporations are real economic actors. They own buildings and operate
businesses across industries. Examples of the intended shape (not canon names):

- an entertainment corporation operating a studio, a venue, and a streaming
  service;
- a food corporation owning a processing plant and a chain of stalls;
- a software corporation renting offices and paying high wages;
- a hardware corporation running a fabrication floor and a repair shop;
- a security corporation selling patrol contracts to buildings and venues.

Businesses:

- occupy a building/unit;
- have opening hours and services;
- generate revenue from NPC and player consumption;
- hire, fire, expand, contract, and close;
- compete with other businesses in the same industry and district.

## 6. Jobs and the labor market

Every job has a real workplace address. There is no global job ladder.

- A `JobSlot` belongs to a business, in a building, at an address.
- A slot is either **open** or **filled by a Person**.
- NPCs apply for and fill slots based on skills, wage, commute, status, and
  relationships.
- The player sees real openings: title, employer, address, wage, shift,
  requirements, and whether an NPC already holds it.
- Taking a shift requires travelling to the workplace during the shift window.
  Late arrival, absence, and quitting have consequences.
- Income is `wagePerHour × hours worked`, not an abstract yearly salary.
- Promotions, layoffs, poaching, and business failure change the slot map.
- NPC unemployment and wages affect their housing, consumption, and family
  status, which in turn affect the neighborhood.

## 7. Housing market

Housing is a set of real units in real buildings.

- Rent and sale prices derive from building condition, unit size, amenities,
  access, nearby services, and demand — they are not authored per neighborhood.
- Families and households occupy units up to capacity. High-status families
  occupy better units; low-status families share, rent rooms, or double up.
- Landlords are corporations, families, or the city. They maintain, raise rent,
  evict, and sell.
- The player rents or buys a specific unit at an address. Moving means changing
  the Home node on the map.
- Vacancy and homelessness are real states, not flavor.
- Bills and rent should use the compressed calendar: each 7-day season is a
  month, so rent is due at the start of each season (four times per year).

## 8. Families and lineage

Families are the continuity layer. The game is intended to continue across
generations, including the player's.

- Every person belongs to a family and a lineage.
- A family has a surname, origin class, wealth, reputation, home, assets, and
  members.
- Origin class is rolled from the family's history: inherited wealth, parents'
  jobs, home, city, and reputation.
- Families own homes and sometimes businesses/buildings. Family wealth and
  reputation change through jobs, crime, business, marriage, and inheritance.
- NPC families age, marry, have children, migrate, and die. Family status is not
  static.

### Player birth

A new life starts with a **birth roll**, optionally rerollable or chosen from a
shortlist:

- family and lineage;
- parents and siblings;
- family home and district;
- parents' jobs and incomes;
- inherited traits and initial relationships;
- family assets and debts;
- starting education and health.

The current "adult with a capsule and ¥2,500" start becomes a quick-start option,
not the default.

### Continual play

- The player ages, works, learns, forms relationships, and can have children.
- On death, play continues as an heir (or a new lineage if none survives).
- Inheritance transfers assets, debts, homes, businesses, and relationships.
- Lineage history records migrations, jobs, scandals, businesses, and deaths.
- A family can rise or fall across generations; the city changes around it.

## 9. Simulation ticks and scale

Use tiered simulation to keep it fast:

| Cadence | What happens |
| ------- | ------------ |
| Hour | player travel, shifts, opening hours, local NPC schedules |
| Day | work attendance, wages accrued, consumption, applications, local events |
| Season (7 days) | rent/bills, hiring/firing, prices, maintenance, business reports |
| Year (28 days) | aging, school progression, inheritance, market shifts |

- Detailed simulation for the active city and nearby NPCs.
- Statistical/cohort simulation for distant cities and off-screen populations.
- Seeded RNG so a world can be reproduced and tested.
- Persist static seed + dynamic state; do not persist derived UI summaries.

## 10. Derived district profile

The map and Home screens should show concrete facts, optionally summarized:

```ts
type DistrictProfile = {
  districtId: string;
  population: number;
  households: number;
  vacancyRate: number;
  medianRent: number;
  medianWage: number;
  unemploymentRate: number;
  openJobs: number;
  businessesByIndustry: Partial<Record<Industry, number>>;
  services: string[];
  averageBuildingCondition: number;
  reportedSafetyIncidents: number;
  transitMinutesToCenter: number;
};
```

Display examples: "3 open jobs · 2 food businesses · median rent ¥1,900 ·
12 vacant units", not "Tier 2 / Services 2/5".

## 11. Data layout

When this grows beyond the current single `world.ts`:

```
src/game/world/
  geography.ts      nations, states, cities, districts, addresses
  buildings.ts      buildings, units, ownership
  corporations.ts   corporations, businesses, job templates
  seed.ts           starting population/family parameters
  index.ts          helpers and derived lookups

src/game/sim/
  types.ts          Person, Family, Household, Lineage, runtime state
  worldgen.ts       seeded population, families, job filling
  jobs.ts           applications, shifts, wages, hiring/firing
  housing.ts        leases, rent, vacancy, moving
  families.ts       births, aging, marriage, inheritance
  tick.ts           day/season/year simulation
  selectors.ts      DistrictProfile and other derived views
```

The current `world.ts` stays as the authored catalog until the first building
data lands, then splits along these lines.

## 12. Migration plan

### Phase A — one vertical slice (next)

- Add building/unit/corporation/business/job types and seed data for one district
  (Kestrel Row is the natural first).
- Author: 3 buildings, 2 corporations, 3 businesses, 8 job slots, 4 families,
  ~12 NPCs, 4 occupied homes, 2 vacancies.
- Replace the district tier panel with computed facts.
- Add a real job board at a business address; NPCs fill most slots.
- Let the player apply for an open slot and work a scheduled shift at that
  building.
- Derive rent/rest from the unit and building, not a district score.
- Save/reload job fills and household occupancy.

### Phase B — population and families

- Generate NPC families, assign homes and jobs, give them schedules.
- Add the birth roll / family selection screen.
- Replace the adult quick-start with birth or quick-start.

### Phase C — lineage

- Aging, death, inheritance, heirs, and lineage history.
- NPC family aging and migration.
- Family-owned homes and businesses.

### Phase D — city and country

- `activeCityId`; per-city maps, prices, wages, and labor markets.
- World map above the city map.
- Intercity travel with duration, fare, and border/visa requirements.
- Migration between cities for NPCs and the player.

## 13. First slice acceptance criteria

- Every job shown in the UI belongs to a business in a building at an address.
- Every job slot is either open or filled by a named NPC.
- The player can take an open job and must travel to the workplace for a shift.
- Pay is hourly wage × hours worked; no global salary multiplier.
- Housing rent/price comes from the unit and building, not a district tier.
- The neighborhood panel shows computed facts and real lists, not authored
  scores.
- Saving and loading preserves job fills, leases, and household membership.

## 14. Open decisions

1. **Time scale for shifts:** 28-day years with 7-day seasons; do shifts use
   fixed 4–8 hour blocks or free-form hours?
2. **NPC fidelity:** full schedules for every NPC, or detailed only near the
   player and statistical elsewhere?
3. **Player business ownership:** can the player found, buy, or run a business
   and hire NPCs? The model supports it, but it changes the UI scope.
4. **Inheritance:** what transfers to an heir, and what decays or is taxed?
5. **Marriage and family creation:** player choice, simulated courtship, or
   both?
6. **Rent cadence:** season-start billing (four times per year) is the proposed
   default.
7. **Save format:** JSON first, SQLite if populations and histories grow large.
8. **Authored vs. generated:** buildings/corporations are authored for canon;
   families/NPCs are seeded/generated. Confirm which named corporations are
   canon.

# NeonLife — World Building Guide

All places are **authored by hand** in `src/game/world.ts`. Nothing about the map
is procedurally generated. The runtime arrays (`LOCATIONS`, `PROPERTIES`,
`MAP_NODES`, `MAP_EDGES`, `NEIGHBORHOODS`) are derived from this catalog — do
not edit those in `data.ts`.

The living-world layer in `docs/simulation-plan.md` extends this catalog with
buildings, units, corporations, businesses, job slots, and then simulated
families and people.

## Hierarchy

```
Nation            e.g. Meridian Compact
└─ State           e.g. Lantern Reach
   └─ City         e.g. Vesper            ← owns a local map
      └─ District  e.g. Kestrel Row       ← geography only in the target model
         └─ Address
            └─ Building                  ← residential / commercial / civic
               └─ Unit                   ← household home or business space
                  ├─ Household            ← simulated family/roommates
                  └─ Business → JobSlot   ← real jobs, filled by NPCs
```

Every entity uses a stable, lowercase kebab-case `id`. Player-facing names and
numbers may change freely; ids are referenced by actions, saves, and the map
graph, so treat an id rename as a migration.

Quality is not authored. A district's service level, rent, wages, and safety are
computed from its buildings, businesses, jobs, residents, and access. The former
`tier`, `serviceQuality`, `jobMultiplier`, and `safety` fields have been removed;
district panels now show concrete places, services, and rent ranges.

## Source of truth

| Export             | Contains                                           |
| ------------------ | -------------------------------------------------- |
| `NATIONS`          | nations, currency, flavor                          |
| `STATES`           | states and their nation                            |
| `CITIES`           | cities, parent state, map size, region labels      |
| `DISTRICTS`        | geography, name, flavor, and map label              |
| `PLACES`           | venues and hotels, address, hours, services, node  |
| `CITY_EDGES`       | walking links between places in one city           |
| `PROPERTY_LISTINGS`| rent/buy housing, address, node position, rest     |

Helpers: `nationById`, `stateById`, `cityById`, `districtById`,
`districtName`, `placeById`, `placesInCity`, `districtsInCity`,
`propertiesInCity`, `placeAddress`, `propertyAddress`.

## Adding a place

1. Add a `Place` entry to `PLACES`.
2. Give it a unique `id`, `cityId`, and `districtId`.
3. Set a street `address` (the district and city are appended for display).
4. Put its node in `map: { x, y, region }`. The map is 1000 × 640 for Vesper.
5. Optionally add edges in `CITY_EDGES` connecting it to existing place ids.
   Travel time is derived from straight-line distance, so there is no timer
   field to tune.
6. If it is the only route into a branch, add at least two edges so the graph
   stays connected.
7. Add actions that use it by setting `at: ["your-new-id"]` in `data.ts`.

Example:

```ts
{
  id: "tidal-archive",
  name: "Tidal Archive",
  kind: "venue",
  cityId: "vesper",
  districtId: "salt-flats",
  address: "7 Pump House Road",
  description: "A public archive built into the seawall. Quiet, damp, guarded.",
  openHours: [9, 19],
  services: ["Education", "Research"],
  map: { x: 700, y: 600, region: "east" },
}
```

Then:

```ts
// world.ts
{ cityId: "vesper", id: "e-tidal-motel", from: "tidal-archive", to: "no-tell-motel" },
```

## Adding a property

Properties live in `PROPERTY_LISTINGS` and follow the same district/address
rules. `x`, `y`, and `region` determine where the player's Home node appears on
the city map while they live there.

- `rent` — charged at year-end while renting.
- `deposit` — paid once to move in; refunded when moving out.
- `price` — one-time purchase price.
- `upkeep` — charged at year-end while owned (roughly 1.5% of price).
- `rest` — sleep recovery base. `rest / 8` energy per hour; 48+ heals at 6h.
- `stats` — one-time move-in bonus, granted at most once per property per year.

These listings are a bridge. In the target model they become **units inside
buildings**, with rent and price derived from unit size, condition, amenities,
and access.

## Furniture is not world geography

Furniture is authored separately in `src/game/furniture.ts`. It has no map node
and no address. Each item declares its slots, price, features, sleep/rest rates,
and the object interactions it exposes (SLEEP, REST, SHOWER, COOK, STUDY,
DRESS). Homes declare `slots` in `PROPERTY_LISTINGS`.

Adding a furniture item does not require a store change unless it introduces a
new interaction verb. Feature-gated home actions live in `data.ts` and should be
marked `hidden: true` so they only run from the object.

## Adding a building, business, or job (planned)

The full schema is in `docs/simulation-plan.md`. The intended authoring flow:

1. Add a `Building` at an address in a district, with units.
2. Add or reference a `Corporation` that owns it.
3. Add a `Business` in one of its commercial units.
4. Define `JobSlot`s on the business: title, wage per hour, shift, requirements.
5. Place the building's map node and connect it with `CITY_EDGES` if needed.
6. Do **not** author neighborhood quality. It is computed from these entities.

Job slots are either open or filled by a simulated person. The player applies to
real openings at real addresses.

## Adding a district

1. Add a `District` with `cityId` and a map label anchor. Geography only.
2. Add places, properties, and later buildings with `districtId` set to its id.
3. Do not add quality scores. Services, rents, wages, and safety are computed
   from what actually exists in the district.

## Adding a city (country-level travel)

The data model is already hierarchical, but the UI currently renders one city's
local map. The planned sequence:

1. Add a `City` to `CITIES` with its own map size and region labels.
2. Add districts, places, edges, and properties for that city.
3. Add buildings, businesses, and job slots for that city.
4. Add an `activeCityId` to the store (default `DEFAULT_CITY_ID`).
5. Filter the map view by `activeCityId`; keep Home property coordinates local
   to the active city.
6. Add an intercity network: city-to-city routes with minutes, fare, and a
   border/visa requirement. The world map becomes the layer above the city map.
7. Gate local places/actions on the active city, so a Vesper action cannot run
   while the player is in another city.

Two things are intentionally **not** implemented yet:

- Intercity travel costs and border checks.
- A visual world map showing nations, states, and cities. The nation/state/city
  records exist so that layer can be added without re-authoring the city.

## Map conventions for Vesper

- Canvas: `1000 × 640`.
- Regions: `north`, `center`, `east`, `under`.
- Node label sits at `y + 36`; the district sub-label at `y + 51`.
- Keep nodes at least ~90 map units apart to avoid label collisions.
- Home is rendered from the active property, not from `PLACES`.
- Home connects to the three nearest places. Routes between places never cut
  through Home.

## Authoring checklist

- [ ] Unique id, correct `cityId`/`districtId`.
- [ ] Address filled in.
- [ ] Map node placed and a second edge if the branch is new.
- [ ] Action `at` ids match the new place id.
- [ ] No banned licensed-universe names (see `docs/neonlife.md` §11).
- [ ] `bun run build` passes.

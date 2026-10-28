# Simulation model notes (src/utils)

Loaded when working in `src/utils/`. The root `CLAUDE.md` covers the state tree, persistence and sync.

**physics.ts** holds the core model:
- SVP/VPD math.
- Room climate (indoor vs `outdoor_garden` vs `greenhouse`) and per-tent climate.
- `arbitrateEnclosureEquipment`: the central controller. It resolves conflicting equipment by `controllerPriority` and produces `activeInterlocks`.
- Per-crop growth.

Plant stage requirements, durations, stage transitions and cultivar profiles (hops, peppers) live in `plantLifecycle.ts`. Plant height and canopy are not incremented directly. Each tick eases them toward `getPlantTargetSize`, which interpolates the per-species `STAGE_END_SIZES` by `stageProgress` and scales by `getContainerSizeFactor` (pot volume). They never shrink. Tune sizes in that table.

**Indoor room heat balance** (`roomThermal.ts`): there is no hidden HVAC. A room's temperature is a BTU balance integrated in substeps of at most 5 minutes.
- **Losses** go through the envelope by `foundationType`:
  - to the outdoors, including ACH air leakage;
  - to the ground at 55°F;
  - to the rest of the house at the room's visible `adjacentSpaceTempF`.
- **Gains** come from every item in the room and its tents (`getItemHeatWatts`): electrical watts, plus a dehumidifier's condensation heat, minus a humidifier's evaporative cooling.
- **Thermostat equipment** only counts when placed in the room:
  - heaters;
  - `portable_ac`: BTU rating, dries the air, vents its own heat outside;
  - `hvac_register`: the house central system's supply at a CFM, 55°F cool / 110°F heat, with a mode and set-point.

Moisture is tracked as absolute humidity, so RH moves with temperature.

**Tent temperature** (tent loop in `physics.ts`) is its own heat balance, solved exactly each step.
- **Gains:** `getItemHeatWatts` of everything inside the tent: lights, heaters, a dehumidifier's condensation heat, minus a humidifier's evaporative cooling.
- **Losses** to the room:
  - the shell (walls, roof, floor) at the tent's U-value;
  - exchanged air at `1.08 × CFM`, where CFM is the fan's rated CFM × output × 0.7 for filter/duct losses, plus passive leakage.
- **Construction:** the U-value and leakage come from `getTentEnvelope` (`tentEnvelope.ts`), which reads `mylarRating` and the brand:
  - reflective liner vs bare fabric;
  - a small denier effect;
  - seal quality: premium brands or 2000D leak 1.5 ACH, budget 210D leaks 4.5 ACH;
  - insulated thermal tents at U 0.4.

  The dashboard tent panel lets you change the fabric.
- **Equilibrium:** the tent settles at room + gains / losses, with a time constant of a few minutes. For example, 375 W in an 8×4 tent gives about +5°F.
- **Not the same exchange as moisture/CO2:** those still use the older `airExchangeFraction`.

Tent exhaust carries its vapour and CO2 into the room. Mushrooms respire CO2 by mass (`getMushroomCo2Lph`), and the tent settles at a level above the room set by production over airflow.

Room temperature, RH and CO2 are kept unrounded or to one decimal, because per-minute changes are tiny. `migrateRoomClimateControl` converts the old `hvacMode` into a visible register once. A/Cs and registers are room-only; the Add form enforces it.

**Spatial model** (`spatial.ts`):
- **Positions** are in feet (`Position3D`), relative to the parent room or tent. For items, `(x, y)` is the footprint center and `z` the base elevation. Tents use their back-left corner.
- **Dimensions:** every item has `dimensions` (L x W x H ft). Plants and mushrooms also carry `containerDimensions` (pot / bed / monotub), and their `dimensions` is derived from it:
  - plants: pot plus `heightInches` / `canopyWidthInches`;
  - mushrooms: container plus the stage's fruit height.
- **Don't hand-set crop `dimensions`.** `syncItemGeometry` recomputes it in the crop tick, in the `App` add/update handlers, and in the `loadSimulation` migration.
- **Placement:**
  - Use `getDefaultSpatialPosition` / `clampItemPosition` rather than raw math, so things stay inside walls.
  - `App.handleAddItem` runs every new item through `placeItemInFreeSpace`. That moves it to the nearest spot that doesn't overlap existing items (or tents, on a room floor), keeping its elevation. If the container is full, it takes the least-overlapping spot.

**Equipment connections** (`equipmentLinks.ts`):
- **Hoses:** a humidifier or CO2 controller in `room.items` can feed a tent through a hose or tubing (`ductedToTentId`). Physics then arbitrates it with that tent's equipment while it follows room air.
- **Heat mats** carry `attachedToId`, which is one of:
  - their tent's id: under the floor tray, warming every pot or container in the tent at reduced strength;
  - an item in the same container: under a plant pot or mushroom container, warming its root zone or substrate;
  - a humidifier it is wrapped around: heating its reservoir by water volume and mat wattage.

  Attached mats have no position of their own (`getAttachedPosition`).
- **Reservoirs and buckets:**
  - Humidifier water always follows the surrounding air plus any wrapped mat. There is no built-in reservoir heater or chiller.
  - Humidifiers hold `reservoirLevelL`; dehumidifiers hold a collection bucket (`bucketLevelL`).
  - Their capacities (`reservoirCapacityL`, `bucketCapacityL`) are explicit properties and never exceed what fits in the unit's body (`getMaxReservoirLiters` / `getMaxBucketCapacityL`).
- **Water use and collection** follow a moisture balance, not run time:
  - In a tent: the vapour the air gained or lost, plus what the air exchange carried through (`absoluteHumidityGm3`), split across running units by `shareEnclosureWater`.
  - On a room floor: each unit moves real grams of vapour and stops at its target.
- **Rated output is only a ceiling:**
  - humidifiers: about 0.011 L/h per watt;
  - dehumidifiers: their pints/day rating (DOE 2019, 65°F / 60% RH), derated for cooler or drier air.

  Tent exhaust carries its vapour into the room, and that is what a room dehumidifier ends up collecting.
- **Empty or full:** an empty tank or full bucket stops the unit with a journal alert until it is refilled or emptied (inspector or the in-game Water Can), unless `drainHoseConnected`.
- **Per-tick status:** every unit's live `waterFlowLph`, `effectiveSetting` and `interlockStatus` are written each tick, room units included. Room RH is stored to one decimal so per-minute vapour flows aren't rounded away.
- **Sim clock:** at 1x speed, one sim minute passes per real second (60x real time).
- **Cleanup:** `migrateEquipmentLinks` removes dangling links. It runs on load and after deleting tents or items.
- **Fans:** inline fan duct sizes and their CFM / watts / dimensions live in `equipmentCatalog.ts`. Tent air exchange scales with fan CFM against tent volume.
- **Exhaust destination:** exhaust fans carry `exhaustTo` (`room` by default, or `outdoors`).
  - An outdoor duct sends that fan's share of tent air (heat, vapour, CO2) out of the building instead of into the room.
  - The room draws the same CFM back in from outdoors as make-up air (`getOutdoorVentedCfm` / `getOutdoorFanShare`, `extraOutdoorUa` in `stepRoomTemperature`).
- **Activity:** `getEquipmentActivity` (`equipmentStatus.ts`) classifies any unit as running / idle / blocked / off from its live tick state.
- **Slow temperatures:** `reservoirTempF`, `rootTempF` and `substrateTempF` are stored unrounded, because per-tick changes are smaller than 0.1°.

**Crop issues** (`cropIssues.ts`): `getCropIssues` judges plants with the same `evaluatePlantStageSuitability` the inspector shows.
- Light level is judged only while the lights are on.
- The photoperiod comes from the container's grow-light schedule (`getPhotoperiodHours`).
- `issueBadgeText` gives the short badge text.

**Outdoor weather** (`weatherService.ts`):
- Looks up the ZIP via `api.zippopotam.us` and gets hourly data from Open-Meteo.
- Caches both in `localStorage` (`sprout_spore_weather_cache_v3_*`, `sprout_spore_geo_v3_*`) and holds them in `weatherPackageRef`, so ticks never hit the network.
- Falls back to regional climatology normals when offline.

**Catalogs:** tent models are in `tentCatalog.ts`; equipment and crop presets are mostly inline in `AddItemModal.tsx` / `AddRoomModal.tsx`.

**Checking a physics change:** run `npm run sim` (see `scripts/sim-check.mts`) instead of writing a throwaway script.

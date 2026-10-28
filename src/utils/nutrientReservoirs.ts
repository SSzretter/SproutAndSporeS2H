import { CultivationSystemType, Dimensions, EquipmentItem, Item, PlantItem, ReservoirFeedTarget } from '../types/sim';
import { getRackTiers, isGrowRack } from './growRacks';
import { TAP_WATER_TEMP_F } from './equipmentLinks';
import type { SimulationEvent } from './physics';

/**
 * Nutrient reservoirs: a tank of nutrient solution with a pump whose lines run to plants or grow
 * rack shelves anywhere in its room, tents included (`feedTargets`). In flood mode the pump runs on
 * a timer (ebb & flow tables / trays, drip lines); in continuous mode it circulates nonstop
 * (recirculating DWC, aeroponics). Every time water reaches a fed plant its root zone is soaked back
 * up and takes on the solution's strength, pH, temperature and oxygen; the tank loses that water, its
 * EC creeps up as plants drink more water than salts, and its pH drifts up. An empty tank floods
 * nothing. A chiller / heater holds the water temperature, and an air stone keeps it oxygenated
 * (warm water holds less oxygen).
 */

export interface NutrientReservoirPreset {
  name: string;
  liters: number;
  pumpWatts: number;
}

export const NUTRIENT_RESERVOIR_PRESETS: NutrientReservoirPreset[] = [
  { name: '10 gal Reservoir + 160 GPH Pump', liters: 38, pumpWatts: 10 },
  { name: '27 gal Tote Reservoir + 400 GPH Pump', liters: 102, pumpWatts: 25 },
  { name: '55 gal Drum Reservoir + 800 GPH Pump', liters: 208, pumpWatts: 50 }
];

// Hydro systems whose root zone is watered from a reservoir (DWC buckets hold their own water)
export const RESERVOIR_FED_SYSTEMS: CultivationSystemType[] = ['ebb_and_flow', 'drip_hydro', 'aeroponics'];

export const DEFAULT_NUTRIENT_EC_PPM = 900;
export const DEFAULT_NUTRIENT_PH = 5.9;
const TAP_WATER_PH = 7.2;
const LITRES_PER_CUBIC_FOOT = 28.317;
// Below this the pump sucks air
const EMPTY_LEVEL_L = 0.5;
// Plants take up salts at a lower concentration than the water they drink, so the tank's EC climbs
const SALT_UPTAKE_RATIO = 0.8;
// Hydro solution pH creeps up as roots take up nitrate (per day)
const PH_DRIFT_PER_DAY = 0.15;
// A soaked root zone holds this share of its volume as water, by medium
const WATER_HOLDING: Record<NonNullable<PlantItem['growingMedium']>, number> = {
  living_organic_soil: 0.45,
  peat_potting_mix: 0.5,
  native_garden_loam: 0.4,
  hydroton_clay_pebbles: 0.25,
  rockwool_cubes: 0.75,
  coco_perlite: 0.6,
  aeroponic_mist: 0.1
};
// Chiller: heat it can pull out of the water (W) and the compressor power on top, both dumped into the air
const CHILLER_CAPACITY_W = 400;
const CHILLER_COMPRESSOR_W = 200;
// Aquarium heater element
const HEATER_W = 200;
// Air pump driving the air stone
export const AIR_PUMP_W = 5;
// Most a submersible pump warms its tank above the air around it
const MAX_PUMP_WARMING_F = 8;
// Below this oxygen saturation roots start to suffer (root rot risk)
export const LOW_ROOT_OXYGEN_PCT = 60;
// Moisture a flood leaves behind, by medium (clay pebbles drain hard)
const SOAKED_MOISTURE: Partial<Record<NonNullable<PlantItem['growingMedium']>, number>> = {
  hydroton_clay_pebbles: 82,
  rockwool_cubes: 95,
  coco_perlite: 92,
  aeroponic_mist: 90
};

export function isNutrientReservoir(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && item.type === 'nutrient_reservoir';
}

/** Tote / drum body for a tank size: about 1.5 : 1 : 0.9 (L : W : H), plus the lid. */
export function getReservoirDimensions(liters: number): Dimensions {
  const cuFt = Math.max(5, liters) / LITRES_PER_CUBIC_FOOT;
  const w = Math.cbrt(cuFt / (1.5 * 0.9));
  const round = (v: number) => Math.round(v * 100) / 100;
  return { length: round(w * 1.5), width: round(w), height: round(w * 0.9 + 0.08), unit: 'ft' };
}

export function getNutrientCapacityL(eq: EquipmentItem): number {
  return Math.max(5, eq.nutrientCapacityL ?? NUTRIENT_RESERVOIR_PRESETS[1].liters);
}

export function getNutrientLevelL(eq: EquipmentItem): number {
  return Math.max(0, Math.min(getNutrientCapacityL(eq), eq.nutrientLevelL ?? getNutrientCapacityL(eq)));
}

export function isNutrientReservoirEmpty(eq: EquipmentItem): boolean {
  return getNutrientLevelL(eq) <= EMPTY_LEVEL_L;
}

/** Water (L) a root zone holds when soaked, from its container volume and medium. */
export function getRootZoneWaterL(plant: PlantItem): number {
  const gallons = plant.containerVolumeGallons || 5;
  return Math.max(0.01, gallons * 3.785 * (WATER_HOLDING[plant.growingMedium ?? 'living_organic_soil'] ?? 0.5));
}

/** Plants this reservoir's lines reach, among the given items (its room's floor and tents). */
export function getFedPlants(eq: EquipmentItem, items: Item[]): PlantItem[] {
  const targets = eq.feedTargets ?? [];
  if (targets.length === 0) return [];
  return items.filter((i): i is PlantItem => i.category === 'plant' && !i.isHarvested && targets.some(t =>
    t.id === i.id || (!!i.rackSlot && t.id === i.rackSlot.rackId && (t.tier === undefined || t.tier === i.rackSlot.tier))
  ));
}

/** The reservoir feeding this plant, if any (look it up among all of the room's items). */
export function getFeedingReservoir(plant: PlantItem, items: Item[]): EquipmentItem | undefined {
  return items.find((i): i is EquipmentItem => isNutrientReservoir(i) && getFedPlants(i, [plant]).length > 0);
}

/** Drops lines to things that are gone (or shelves a rack no longer has). */
export function pruneFeedTargets(eq: EquipmentItem, items: Item[]): ReservoirFeedTarget[] {
  return (eq.feedTargets ?? []).filter(t => {
    const target = items.find(i => i.id === t.id);
    if (!target) return false;
    if (t.tier === undefined) return true;
    return isGrowRack(target) && t.tier < getRackTiers(target).length;
  });
}

/** Oxygen saturation (%) solution holds at a temperature: full up to ~68°F, falling as it warms. */
function oxygenSaturationPct(waterTempF: number): number {
  return Math.max(50, Math.min(100, 100 - Math.max(0, waterTempF - 68) * 2.5));
}

/** Short description of what a reservoir feeds, e.g. "2 shelves, 1 plant (73 plants)". */
export function describeFeedTargets(eq: EquipmentItem, items: Item[]): string {
  const targets = eq.feedTargets ?? [];
  if (targets.length === 0) return 'Nothing connected';
  const racks = targets.filter(t => items.some(i => i.id === t.id && isGrowRack(i)));
  const plants = targets.length - racks.length;
  const parts = [
    ...(racks.length > 0 ? [`${racks.length} rack line${racks.length === 1 ? '' : 's'}`] : []),
    ...(plants > 0 ? [`${plants} plant${plants === 1 ? '' : 's'}`] : [])
  ];
  const fed = getFedPlants(eq, items).length;
  return `${parts.join(', ')} (${fed} plant${fed === 1 ? '' : 's'} fed)`;
}

// ---------------------------------------------------------------------------
// Pump timer
// ---------------------------------------------------------------------------

/** Local minutes since the epoch (the timer follows the wall clock, like the light schedule). */
function localMinutes(simTime: number): number {
  return (simTime - new Date(simTime).getTimezoneOffset() * 60000) / 60000;
}

function floodStartMinutes(eq: EquipmentItem): number[] {
  const n = Math.max(1, Math.min(48, Math.round(eq.floodsPerDay ?? 6)));
  const first = (Math.max(0, Math.min(23, eq.floodStartHour ?? 6))) * 60;
  return Array.from({ length: n }, (_, k) => (first + (k * 1440) / n) % 1440);
}

/** Is the pump running at this moment (continuous mode always; flood mode inside a flood window)? */
export function isPumpScheduledOn(eq: EquipmentItem, simTime: number): boolean {
  if (!eq.powerOn) return false;
  if ((eq.pumpMode ?? 'flood') === 'continuous') return true;
  const now = localMinutes(simTime);
  const minutes = Math.max(1, eq.floodMinutes ?? 15);
  return floodStartMinutes(eq).some(start => (((now - start) % 1440) + 1440) % 1440 < minutes);
}

/** Floods that began in (from, to]. */
function countFloodStarts(eq: EquipmentItem, fromTime: number, toTime: number): number {
  const from = localMinutes(fromTime);
  const to = localMinutes(toTime);
  return floodStartMinutes(eq).reduce((n, start) => n + Math.floor((to - start) / 1440) - Math.floor((from - start) / 1440), 0);
}

// ---------------------------------------------------------------------------
// Solution handling (inspector actions)
// ---------------------------------------------------------------------------

/** Dump and refill with a fresh mix made up to the targets, at tap temperature. */
export function mixFreshSolution(eq: EquipmentItem, simTime?: number): EquipmentItem {
  return {
    ...eq,
    lastSolutionChangeTime: simTime ?? eq.lastSolutionChangeTime,
    nutrientLevelL: getNutrientCapacityL(eq),
    nutrientEcPpm: eq.nutrientTargetEcPpm ?? DEFAULT_NUTRIENT_EC_PPM,
    nutrientPh: eq.nutrientTargetPh ?? DEFAULT_NUTRIENT_PH,
    reservoirTempF: TAP_WATER_TEMP_F
  };
}

/** Top off with plain tap water: dilutes the strength, nudges pH toward tap water, cools it. */
export function topOffWithWater(eq: EquipmentItem, ambientTempF: number): EquipmentItem {
  const capacity = getNutrientCapacityL(eq);
  const left = getNutrientLevelL(eq);
  const added = capacity - left;
  if (added <= 0) return eq;
  const mix = (a: number, b: number) => (a * left + b * added) / capacity;
  return {
    ...eq,
    nutrientLevelL: capacity,
    nutrientEcPpm: Math.round(mix(eq.nutrientEcPpm ?? 0, 0)),
    nutrientPh: Math.round(mix(eq.nutrientPh ?? TAP_WATER_PH, TAP_WATER_PH) * 100) / 100,
    reservoirTempF: mix(eq.reservoirTempF ?? ambientTempF, TAP_WATER_TEMP_F)
  };
}

/** Dose nutrients and pH up / down to bring what's in the tank to the targets. */
export function adjustToTargets(eq: EquipmentItem): EquipmentItem {
  return { ...eq, nutrientEcPpm: eq.nutrientTargetEcPpm ?? DEFAULT_NUTRIENT_EC_PPM, nutrientPh: eq.nutrientTargetPh ?? DEFAULT_NUTRIENT_PH };
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

function nutrientLevelFor(ecPpm: number): PlantItem['nutrientLevel'] {
  return ecPpm < 400 ? 'low' : ecPpm > 2000 ? 'high' : 'balanced';
}

/** Electrical heat (W) a reservoir gives off right now: pump while running, air pump, chiller / heater. */
export function getReservoirHeatWatts(eq: EquipmentItem): number {
  if (!eq.powerOn) return 0;
  const pump = (eq.powerWatts || 0) * ((eq.effectiveSetting ?? 0) / 100);
  return pump + (eq.airStone ? AIR_PUMP_W : 0) + (eq.conditioningWatts ?? 0);
}

/** A container (room floor or tent) and the air temperature around the things in it. */
export interface ReservoirContainer {
  items: Item[];
  ambientTempF: number;
  location?: string;
}

/**
 * Runs every reservoir in a room for one tick, across its floor and all its tents: floods /
 * circulates to the plants and rack shelves it feeds (wherever they stand), drains the water they
 * took, and moves the solution's EC, pH, temperature and oxygen. Returns the containers with
 * reservoirs and fed plants updated; everything else is passed through untouched.
 */
export function stepRoomNutrientReservoirs(
  containers: ReservoirContainer[],
  params: { simTime: number; elapsedMinutes: number },
  events: SimulationEvent[]
): Item[][] {
  const all = containers.flatMap(c => c.items);
  if (!all.some(isNutrientReservoir)) return containers.map(c => c.items);
  const { simTime, elapsedMinutes } = params;
  const hours = Math.max(1e-6, elapsedMinutes / 60);
  const days = elapsedMinutes / 1440;
  const updated = new Map<string, Item>();

  for (const container of containers) {
    for (const res of container.items.filter(isNutrientReservoir)) {
      const ambientTempF = container.ambientTempF;
      let level = getNutrientLevelL(res);
      let ec = res.nutrientEcPpm ?? DEFAULT_NUTRIENT_EC_PPM;
      let ph = res.nutrientPh ?? DEFAULT_NUTRIENT_PH;
      const wasEmpty = isNutrientReservoirEmpty(res);
      const continuous = (res.pumpMode ?? 'flood') === 'continuous';
      const runningNow = isPumpScheduledOn(res, simTime) && !wasEmpty;
      const floods = res.powerOn && !continuous ? countFloodStarts(res, simTime - elapsedMinutes * 60000, simTime) : 0;
      const watering = !wasEmpty && res.powerOn && (continuous || floods > 0 || runningNow);
      const waterTempF = res.reservoirTempF ?? ambientTempF;
      const oxygenPct = res.dissolvedOxygenPct ?? oxygenSaturationPct(waterTempF);

      let drawnL = 0;
      if (watering) {
        const fed = getFedPlants(res, all).map(p => (updated.get(p.id) as PlantItem | undefined) ?? p);
        const needs = fed.map(p => {
          const soaked = SOAKED_MOISTURE[p.growingMedium ?? 'coco_perlite'] ?? 90;
          return { plant: p, soaked, litres: (Math.max(0, soaked - p.soilMoisture) / 100) * getRootZoneWaterL(p) };
        });
        const wanted = needs.reduce((sum, n) => sum + n.litres, 0);
        // Not enough left to soak everything: each gets the same share
        const share = wanted > 0 ? Math.min(1, Math.max(0, level - EMPTY_LEVEL_L) / wanted) : 1;
        // A flood swaps out the root zone's solution; continuous flow blends it in over ~30 minutes
        const blend = continuous ? Math.min(1, elapsedMinutes / 30) : 0.8;
        // Between floods roots sit in air, so flood-and-drain root zones stay well oxygenated
        const rootOxygen = continuous ? oxygenPct : Math.max(oxygenPct, 85);
        for (const { plant, soaked, litres } of needs) {
          const moisture = plant.soilMoisture + (soaked - plant.soilMoisture) * share;
          const plantEc = (plant.ecTdsPpm ?? ec) + (ec - (plant.ecTdsPpm ?? ec)) * blend * share;
          const plantPh = (plant.soilPh ?? ph) + (ph - (plant.soilPh ?? ph)) * blend * share;
          const aeration = (plant.aerationOxygenPct ?? rootOxygen) + (rootOxygen - (plant.aerationOxygenPct ?? rootOxygen)) * blend;
          // Oxygen-starved roots in warm, still solution rot: a slow health loss
          const rotLossPerDay = aeration < LOW_ROOT_OXYGEN_PCT ? ((LOW_ROOT_OXYGEN_PCT - aeration) / LOW_ROOT_OXYGEN_PCT) * 6 : 0;
          updated.set(plant.id, {
            ...plant,
            soilMoisture: Math.max(plant.soilMoisture, moisture),
            ecTdsPpm: Math.round(plantEc),
            soilPh: Math.round(plantPh * 100) / 100,
            reservoirTempF: waterTempF,
            rootTempF: plant.rootTempF + (waterTempF - plant.rootTempF) * 0.3 * blend * share,
            aerationOxygenPct: aeration,
            health: Math.max(0, plant.health - rotLossPerDay * days),
            nutrientLevel: nutrientLevelFor(plantEc),
            lastWateredTime: simTime
          });
          drawnL += litres * share;
        }
      }

      // Plants drink more water than salts: what's left gets stronger
      if (drawnL > 0) {
        const after = Math.max(0, level - drawnL);
        ec = after > 0 ? (ec * level - SALT_UPTAKE_RATIO * ec * drawnL) / after : ec;
        level = after;
      }
      ph = Math.min(7.5, ph + PH_DRIFT_PER_DAY * days);

      // Water temperature: drifts to the air around the tank, warmed by the submersible pump while it
      // runs; a chiller / heater then pulls it toward its set-point within its capacity
      // Thermal mass: the water, but never less than the tank walls, lid and pump housing (~a quarter tank)
      const litres = Math.max(1, level, getNutrientCapacityL(res) * 0.25);
      const lossWPerK = 0.6 * Math.pow(litres, 2 / 3);
      const duty = !res.powerOn || wasEmpty ? 0 : continuous ? 1 : Math.min(1, ((res.floodMinutes ?? 15) * (res.floodsPerDay ?? 6)) / 1440);
      // A submersible pump warms its water a few degrees at most
      const equilibriumF = ambientTempF + Math.min(MAX_PUMP_WARMING_F, (((res.powerWatts || 0) * duty) / lossWPerK) * 1.8);
      const tauSeconds = (litres * 4186) / lossWPerK;
      let nextTempF = waterTempF + (equilibriumF - waterTempF) * (1 - Math.exp(-(elapsedMinutes * 60) / tauSeconds));
      const conditioning = res.powerOn ? (res.waterConditioning ?? 'none') : 'none';
      const targetF = res.waterTargetTempF ?? 66;
      const degFPerWattStep = (elapsedMinutes * 60 * 1.8) / (litres * 4186);
      let conditioningWatts = 0;
      if ((conditioning === 'chiller' || conditioning === 'both') && nextTempF > targetF) {
        const removedF = Math.min(nextTempF - targetF, CHILLER_CAPACITY_W * degFPerWattStep);
        const pulledW = removedF / degFPerWattStep;
        nextTempF -= removedF;
        // The heat it pulls out of the water plus its compressor go into the air
        conditioningWatts = pulledW + CHILLER_COMPRESSOR_W * Math.min(1, pulledW / CHILLER_CAPACITY_W);
      } else if ((conditioning === 'heater' || conditioning === 'both') && nextTempF < targetF) {
        const addedF = Math.min(targetF - nextTempF, HEATER_W * degFPerWattStep);
        nextTempF += addedF;
        conditioningWatts = addedF / degFPerWattStep; // ends up in the air through the tank walls
      }

      // Dissolved oxygen: an air stone keeps it near what the water can hold; still water loses it
      const saturation = oxygenSaturationPct(nextTempF);
      const oxygenTarget = res.powerOn && res.airStone ? saturation : saturation * 0.65;
      const nextOxygen = oxygenPct + (oxygenTarget - oxygenPct) * Math.min(1, elapsedMinutes / 120);

      const next: EquipmentItem = {
        ...res,
        nutrientLevelL: level,
        // Not rounded: per-minute drift is far below what the display shows
        nutrientEcPpm: ec,
        nutrientPh: ph,
        reservoirTempF: nextTempF,
        dissolvedOxygenPct: nextOxygen,
        conditioningWatts,
        waterFlowLph: drawnL / hours,
        effectiveSetting: runningNow ? 100 : 0,
        interlockStatus: !res.powerOn ? 'Pump off'
          : isNutrientReservoirEmpty({ ...res, nutrientLevelL: level }) ? 'Reservoir empty: Refill and mix solution'
          : (res.feedTargets ?? []).length === 0 ? 'No feed lines connected'
          : continuous ? 'Circulating: Continuous flow'
          : runningNow ? 'Flooding: Pump on (timer)'
          : 'Between floods: Draining back'
      };
      if (!wasEmpty && isNutrientReservoirEmpty(next)) {
        events.push({
          type: 'warning',
          category: 'alert',
          tentName: container.location,
          title: `🪣 Nutrient Reservoir Empty: ${res.name}`,
          message: `${res.name} ran dry and can no longer feed its plants. Refill and mix fresh solution.`
        });
      }
      updated.set(res.id, next);
    }
  }

  return containers.map(c => c.items.map(i => updated.get(i.id) ?? i));
}

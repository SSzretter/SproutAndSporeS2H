import { EquipmentItem, Item, Position3D, Room, Tent } from '../types/sim';
import { inferInlineFanDuctSize, INLINE_FAN_SPECS } from './equipmentCatalog';
import { pruneFeedTargets } from './nutrientReservoirs';

/**
 * Equipment connections — what is piped into, sitting under, or wrapped around what.
 *
 * Hoses: a humidifier or CO2 controller in `room.items` can pipe its output into a tent
 * (`ductedToTentId`). Its output then lands in that tent and it is arbitrated by that tent's
 * controller, while the unit itself sits in (and follows) the room's air.
 *
 * Heat mats (`attachedToId`): the id of the mat's own tent means it lies under that tent's floor
 * tray and warms everything standing on it; an item id in the same container means it sits under
 * that plant pot / mushroom container (warming its root zone / substrate) or is wrapped around
 * that humidifier (heating its reservoir water). Attached mats have no position of their own.
 */

// Share of mist that survives the hose run (condensation on the hose walls)
export const HOSE_DELIVERY_EFFICIENCY = 0.9;

export function isHumidifier(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && item.type === 'humidifier';
}

/** Equipment that can sit outside a tent and feed it through a hose. */
export function isDuctable(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && (item.type === 'humidifier' || item.type === 'co2_regulator');
}

/** The tent a room-level unit is ducted into, or undefined if not ducted / link is dangling. */
export function getDuctTargetTent(room: Room, item: Item): Tent | undefined {
  if (!isDuctable(item) || !item.ductedToTentId) return undefined;
  if (!room.items.some(i => i.id === item.id)) return undefined; // only room-level units can be ducted
  return room.tents.find(t => t.id === item.ductedToTentId);
}

/** Room-level humidifiers and CO2 controllers whose hose feeds the given tent. */
export function getDuctedEquipmentForTent(room: Room, tentId: string): EquipmentItem[] {
  if (!room.tents.some(t => t.id === tentId)) return [];
  return room.items.filter((i): i is EquipmentItem => isDuctable(i) && i.ductedToTentId === tentId);
}

// ---------------------------------------------------------------------------
// Heat mats
// ---------------------------------------------------------------------------

export function isHeatMat(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && item.type === 'heat_mat';
}

/** Plant pots and mushroom containers can sit on a mat; humidifiers can have one wrapped around them. */
export function canHeatMatAttachTo(item: Item): boolean {
  return item.category === 'plant' || item.category === 'mushroom' || isHumidifier(item);
}

export type HeatMatTarget = { kind: 'tent_floor'; tent: Tent } | { kind: 'item'; item: Item; wrapped: boolean };

/** What a mat is attached to, looked up among the items of its own container. */
export function getHeatMatTarget(mat: Item, containerItems: Item[], tent?: Tent): HeatMatTarget | null {
  if (!isHeatMat(mat) || !mat.attachedToId) return null;
  if (tent && mat.attachedToId === tent.id) return { kind: 'tent_floor', tent };
  const item = containerItems.find(i => i.id === mat.attachedToId && i.id !== mat.id);
  if (!item || !canHeatMatAttachTo(item)) return null;
  return { kind: 'item', item, wrapped: isHumidifier(item) };
}

/** Short human description of where a mat is, e.g. "Under Northern Lights #5's pot". */
export function describeHeatMatPlacement(target: HeatMatTarget | null): string {
  if (!target) return 'Not attached to anything';
  if (target.kind === 'tent_floor') return `Under ${target.tent.name}'s floor tray`;
  const { item } = target;
  if (target.wrapped) return `Wrapped around ${item.name}`;
  if (item.category === 'mushroom') return `Under ${item.name} (${item.containerType.replace('_', ' ')})`;
  return `Under ${item.name}'s pot`;
}

/** Position of an attached mat in its container's coordinates: it follows its target. */
export function getAttachedPosition(mat: Item, containerItems: Item[], tent?: Tent): Position3D | null {
  const target = getHeatMatTarget(mat, containerItems, tent);
  if (!target) return null;
  if (target.kind === 'tent_floor') {
    return { x: target.tent.dimensions.length / 2, y: target.tent.dimensions.width / 2, z: 0 };
  }
  const pos = target.item.position;
  if (!pos) return null;
  return { x: pos.x, y: pos.y, z: pos.z || 0 };
}

// A 20–25W seedling mat lifts the pot or container sitting on it by roughly 8–10°F
const MAT_RISE_F_PER_WATT = 0.4;
const MAT_MAX_RISE_F = 15;
// Under the tent's catch tray the heat spreads through the tray to everything standing on it
const TRAY_SPREAD = 0.6;

/** Extra warmth reaching a root zone / substrate, optionally capped by a mat thermostat. */
export interface RootZoneHeat {
  riseF: number;
  maxF?: number;
}

/** Heat from powered mats under this item directly, or under its tent's floor tray. */
export function getRootZoneHeat(target: Item, containerItems: Item[], tentId?: string): RootZoneHeat | null {
  let riseF = 0;
  let maxF: number | undefined;
  for (const mat of containerItems) {
    if (!isHeatMat(mat) || !mat.powerOn || !mat.attachedToId) continue;
    const share = mat.attachedToId === target.id ? 1 : tentId && mat.attachedToId === tentId ? TRAY_SPREAD : 0;
    if (share === 0) continue;
    riseF += Math.min(MAT_MAX_RISE_F, (mat.powerWatts || 25) * MAT_RISE_F_PER_WATT) * share;
    if (mat.targetTempF !== undefined) maxF = Math.min(maxF ?? Infinity, mat.targetTempF);
  }
  if (riseF <= 0) return null;
  return { riseF: Math.min(MAT_MAX_RISE_F + 4, riseF), maxF };
}

/** Applies mat heat to a temperature: adds the rise, but a thermostat never pushes past its set-point. */
export function applyRootZoneHeat(baseF: number, heat: RootZoneHeat | null): number {
  if (!heat) return baseF;
  const heated = baseF + heat.riseF;
  return heat.maxF !== undefined ? Math.max(baseF, Math.min(heated, heat.maxF)) : heated;
}

// ---------------------------------------------------------------------------
// Humidifier reservoir water
// ---------------------------------------------------------------------------

// Share of a wrapped mat's power that actually goes into the water
const WRAP_COUPLING = 0.6;
const WATER_J_PER_LITRE_K = 4186;

// ---------------------------------------------------------------------------
// Capacities: tanks and buckets must physically fit inside the unit's body
// ---------------------------------------------------------------------------

const LITRES_PER_CUBIC_FOOT = 28.317;
// A humidifier's water tank can take up at most this share of its body; a dehumidifier's
// pull-out bucket sits in the bottom section, so it can take up less
const MAX_TANK_BODY_SHARE = 0.75;
const MAX_BUCKET_BODY_SHARE = 0.3;

function bodyLitres(eq: EquipmentItem): number {
  const { length, width, height } = eq.dimensions;
  return length * width * height * LITRES_PER_CUBIC_FOOT;
}

/** Largest tank that fits in this humidifier's body. */
export function getMaxReservoirLiters(eq: EquipmentItem): number {
  return Math.max(0.5, bodyLitres(eq) * MAX_TANK_BODY_SHARE);
}

/** Capacity a humidifier gets when none is set: a size in its name ("6L"), else a third of its body. */
export function getDefaultReservoirLiters(eq: EquipmentItem): number {
  const named = eq.name.match(/(\d+(?:\.\d+)?)\s*(?:L|litre|liter)s?\b/i);
  const estimate = named ? parseFloat(named[1]) : Math.max(1.5, Math.min(40, bodyLitres(eq) * 0.35));
  return Math.min(getMaxReservoirLiters(eq), estimate);
}

/** Tank size in litres (the set capacity, never more than fits in the body). */
export function getReservoirLiters(eq: EquipmentItem): number {
  return Math.min(getMaxReservoirLiters(eq), eq.reservoirCapacityL ?? getDefaultReservoirLiters(eq));
}

/** Water currently in the tank (older saves without a level start full). */
export function getReservoirLevelL(eq: EquipmentItem): number {
  return Math.max(0, Math.min(getReservoirLiters(eq), eq.reservoirLevelL ?? getReservoirLiters(eq)));
}

// Below this the transducer runs dry and the unit can't mist
const EMPTY_LEVEL_L = 0.02;

export function isReservoirEmpty(eq: EquipmentItem): boolean {
  return getReservoirLevelL(eq) <= EMPTY_LEVEL_L;
}

// Ultrasonic units atomize ~0.01 L/h per watt at full output (a 30W home unit ~0.3 L/h,
// an 80W commercial fogger ~0.9 L/h). This is the ceiling; actual use follows demand.
const MIST_LITRES_PER_WATT_HOUR = 0.011;

/** Most water (L/h) a humidifier can atomize at the given output (0-100%). */
export function getMistWaterUseLph(eq: EquipmentItem, outputPercent: number): number {
  return MIST_LITRES_PER_WATT_HOUR * (eq.powerWatts || 50) * Math.max(0, Math.min(100, outputPercent)) / 100;
}

// ---------------------------------------------------------------------------
// Dehumidifier collection bucket
// ---------------------------------------------------------------------------

export function isDehumidifier(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && item.type === 'dehumidifier';
}

/** Largest bucket that fits in this dehumidifier's body. */
export function getMaxBucketCapacityL(eq: EquipmentItem): number {
  return Math.max(0.5, bodyLitres(eq) * MAX_BUCKET_BODY_SHARE);
}

/** Capacity a dehumidifier gets when none is set (a 50-pint unit's bucket holds ~8 L). */
export function getDefaultBucketCapacityL(eq: EquipmentItem): number {
  return Math.min(getMaxBucketCapacityL(eq), Math.max(1, Math.min(15, bodyLitres(eq) * 0.07)));
}

/** Bucket size in litres (the set capacity, never more than fits in the body). */
export function getBucketCapacityL(eq: EquipmentItem): number {
  return Math.min(getMaxBucketCapacityL(eq), eq.bucketCapacityL ?? getDefaultBucketCapacityL(eq));
}

export function getBucketLevelL(eq: EquipmentItem): number {
  return Math.max(0, Math.min(getBucketCapacityL(eq), eq.bucketLevelL ?? 0));
}

// The float switch trips just before the bucket brims
const BUCKET_FULL_MARGIN_L = 0.02;

export function isBucketFull(eq: EquipmentItem): boolean {
  return !eq.drainHoseConnected && getBucketLevelL(eq) >= getBucketCapacityL(eq) - BUCKET_FULL_MARGIN_L;
}

const LITRES_PER_PINT = 0.473;

/**
 * Most water (L/h) a dehumidifier can pull out of the air right now. Its rating ("50-Pint" =
 * pints/day, DOE 2019 test at 65°F / 60% RH) comes from the name, else from wattage. Capacity
 * falls with drier air (little below ~30% RH) and cooler air, and scales with the power setting.
 */
export function getDehumidifierExtractionLph(eq: EquipmentItem, outputPercent: number, rh: number, tempF: number): number {
  const pints = eq.name.match(/(\d+)\s*-?\s*pints?\b/i);
  const ratedLph = pints ? (parseInt(pints[1], 10) * LITRES_PER_PINT) / 24 : (eq.powerWatts || 300) * 0.003;
  const humidityFactor = Math.max(0, Math.min(1.5, (rh - 30) / 30));
  const temperatureFactor = Math.max(0.5, Math.min(1.3, 1 + (tempF - 65) * 0.012));
  return ratedLph * (Math.max(0, Math.min(100, outputPercent)) / 100) * humidityFactor * temperatureFactor;
}

export function emptyBucket(eq: EquipmentItem): EquipmentItem {
  return { ...eq, bucketLevelL: 0 };
}

// ---------------------------------------------------------------------------
// Moisture balance: water used / collected follows the vapour actually moved
// ---------------------------------------------------------------------------

/** Water vapour held by air (g/m³) at a temperature and relative humidity. */
export function absoluteHumidityGm3(tempF: number, rh: number): number {
  const tempC = (tempF - 32) * 5 / 9;
  const svpPa = 610.78 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  return ((rh / 100) * svpPa / (461.5 * (tempC + 273.15))) * 1000;
}

export const CUBIC_METRES_PER_CUBIC_FOOT = 0.0283168;

// Share of atomized mist that actually evaporates; the rest settles out as droplets
export const MIST_EVAPORATION_EFFICIENCY = 0.85;

/**
 * Splits an enclosure's water flow across its running units, each within its own limit:
 * `humidifierL` of water the mist had to supply and `dehumidifierL` of condensate pulled out this
 * tick. Humidifiers are limited by rated output and water left, dehumidifiers by rated capacity at
 * these conditions and bucket room. Sets each unit's level and its live `waterFlowLph`.
 */
export function shareEnclosureWater<T extends Item>(
  items: T[],
  humidifierL: number,
  dehumidifierL: number,
  conditions: { rh: number; tempF: number },
  elapsedMinutes: number
): T[] {
  const hours = Math.max(1e-6, elapsedMinutes / 60);
  const running = (item: Item) => item.category === 'equipment' && item.powerOn && (item.effectiveSetting ?? 0) > 0;

  const limits = new Map<string, number>();
  for (const item of items) {
    if (!running(item)) continue;
    const eq = item as unknown as EquipmentItem;
    if (eq.type === 'humidifier' && !isReservoirEmpty(eq)) {
      limits.set(eq.id, Math.min(getReservoirLevelL(eq), getMistWaterUseLph(eq, eq.effectiveSetting ?? 0) * hours));
    } else if (eq.type === 'dehumidifier' && !isBucketFull(eq)) {
      const room = eq.drainHoseConnected ? Infinity : getBucketCapacityL(eq) - getBucketLevelL(eq);
      limits.set(eq.id, Math.min(room, getDehumidifierExtractionLph(eq, eq.effectiveSetting ?? 0, conditions.rh, conditions.tempF) * hours));
    }
  }

  const totalLimit = (type: 'humidifier' | 'dehumidifier') =>
    items.reduce((sum, i) => (i.category === 'equipment' && i.type === type ? sum + (limits.get(i.id) ?? 0) : sum), 0);
  const humScale = Math.min(1, humidifierL / Math.max(1e-9, totalLimit('humidifier')));
  const dehuScale = Math.min(1, dehumidifierL / Math.max(1e-9, totalLimit('dehumidifier')));

  return items.map(item => {
    if (item.category !== 'equipment') return item;
    const eq = item as unknown as EquipmentItem;
    if (eq.type === 'humidifier') {
      const used = (limits.get(eq.id) ?? 0) * humScale;
      return { ...eq, reservoirLevelL: Math.max(0, getReservoirLevelL(eq) - used), waterFlowLph: used / hours } as unknown as T;
    }
    if (eq.type === 'dehumidifier') {
      const collected = (limits.get(eq.id) ?? 0) * dehuScale;
      return {
        ...eq,
        bucketLevelL: eq.drainHoseConnected ? 0 : Math.min(getBucketCapacityL(eq), getBucketLevelL(eq) + collected),
        waterFlowLph: collected / hours
      } as unknown as T;
    }
    return item;
  });
}

// Fresh tap water temperature used when topping up a reservoir
export const TAP_WATER_TEMP_F = 60;

/** Fills the tank to capacity; the fresh water mixes with whatever was left at tap temperature. */
export function refillReservoir(eq: EquipmentItem, ambientTempF: number): EquipmentItem {
  const capacity = getReservoirLiters(eq);
  const left = getReservoirLevelL(eq);
  const leftTempF = eq.reservoirTempF ?? ambientTempF;
  return {
    ...eq,
    reservoirLevelL: capacity,
    reservoirTempF: (left * leftTempF + (capacity - left) * TAP_WATER_TEMP_F) / capacity
  };
}

/**
 * Advances a humidifier's water temperature. Water always drifts toward the air around the unit;
 * powered mats wrapped around it add heat. The steady state is ambient + power / heat-loss, and the
 * time to get there scales with the water's mass (a few hours for a 6 L tank).
 * A mat thermostat (targetTempF) holds the water at its set-point instead of overshooting.
 */
export function stepReservoirTempF(eq: EquipmentItem, ambientTempF: number, elapsedMinutes: number, containerItems: Item[]): number {
  const current = eq.reservoirTempF ?? ambientTempF;
  // Less water warms and cools faster (an almost-empty tank still has some thermal mass in its walls)
  const liters = Math.max(0.3, getReservoirLevelL(eq));
  const lossWPerK = 0.6 * Math.pow(liters, 2 / 3); // heat lost through the tank walls, ~surface area

  let heatWatts = 0;
  let capF: number | undefined;
  for (const mat of containerItems) {
    if (!isHeatMat(mat) || !mat.powerOn || mat.attachedToId !== eq.id) continue;
    heatWatts += (mat.powerWatts || 25) * WRAP_COUPLING;
    if (mat.targetTempF !== undefined) capF = Math.min(capF ?? Infinity, mat.targetTempF);
  }

  let equilibriumF = ambientTempF + (heatWatts / lossWPerK) * 1.8;
  if (capF !== undefined) equilibriumF = Math.max(ambientTempF, Math.min(equilibriumF, capF));

  const tauSeconds = (liters * WATER_J_PER_LITRE_K) / lossWPerK;
  const fraction = 1 - Math.exp(-(Math.max(0, elapsedMinutes) * 60) / tauSeconds);
  // Not rounded: at normal speed each tick moves the water only a few hundredths of a degree
  return current + (equilibriumF - current) * fraction;
}

/**
 * How reservoir temperature changes mist behaviour:
 * - outputFactor: warmer water atomizes/evaporates more readily, cold water fogs less.
 * - coolingPerCapacity: °F per 5 min per unit capacity the mist pulls out of the air. Cold mist
 *   cools via evaporation; mist warmer than the air cancels that and can add heat.
 */
export function getMistWaterEffects(waterTempF: number, airTempF: number): { outputFactor: number; coolingPerCapacity: number } {
  const outputFactor = Math.max(0.75, Math.min(1.25, 1 + (waterTempF - 68) * 0.01));
  const coolingPerCapacity = Math.max(-0.04, Math.min(0.1, 0.05 + 0.003 * (airTempF - waterTempF)));
  return { outputFactor, coolingPerCapacity };
}

// ---------------------------------------------------------------------------
// Save migration / link cleanup
// ---------------------------------------------------------------------------

/**
 * Normalizes equipment links in a room. Run on load and after deleting tents or items:
 * - drops the retired reservoir heater/chiller fields,
 * - drops hoses on in-tent units and hoses pointing at tents that no longer exist,
 * - re-homes heat mats whose target is gone (in a tent: under its floor tray, as mats behaved
 *   before attachments existed; on a room floor: unattached),
 * - fills in inline fan duct size and airflow,
 * - drops nutrient reservoir feed lines to plants / racks / shelves that are gone.
 */
export function migrateEquipmentLinks(room: Room): Room {
  // Reservoir feed lines can run anywhere in the room
  const allRoomItems = [...room.items, ...room.tents.flatMap(t => t.items)];
  const fix = (item: Item, items: Item[], tent?: Tent): Item => {
    if (item.category !== 'equipment') return item;
    const next: EquipmentItem & { reservoirConditioning?: unknown; reservoirSetpointF?: unknown } = { ...item };
    delete next.reservoirConditioning;
    delete next.reservoirSetpointF;

    if (next.ductedToTentId && (tent || !isDuctable(next) || !room.tents.some(t => t.id === next.ductedToTentId))) {
      delete next.ductedToTentId;
    }

    if (next.type === 'heat_mat') {
      if (!getHeatMatTarget(next, items, tent)) {
        if (tent) next.attachedToId = tent.id;
        else delete next.attachedToId;
      }
    } else if (next.attachedToId) {
      delete next.attachedToId;
    }

    if (next.type === 'dehumidifier') {
      next.bucketCapacityL = getBucketCapacityL(next); // explicit, and never larger than fits
      next.bucketLevelL = Math.min(next.bucketCapacityL, next.bucketLevelL ?? 0);
    }

    if (next.type === 'humidifier') {
      next.reservoirCapacityL = getReservoirLiters(next); // explicit, and never larger than fits
      next.reservoirLevelL = Math.min(next.reservoirCapacityL, next.reservoirLevelL ?? next.reservoirCapacityL);
    }

    if (next.type === 'nutrient_reservoir') {
      next.feedTargets = pruneFeedTargets(next, allRoomItems); // lines to removed plants / racks / shelves
    }

    if (next.type === 'exhaust_fan') {
      next.ductSizeIn = next.ductSizeIn || inferInlineFanDuctSize(next);
      next.flowRateCfm = next.flowRateCfm || INLINE_FAN_SPECS[next.ductSizeIn].cfm;
    }
    return next;
  };

  return {
    ...room,
    items: room.items.map(i => fix(i, room.items)),
    tents: room.tents.map(t => ({ ...t, items: t.items.map(i => fix(i, t.items, t)) }))
  };
}

// ---------------------------------------------------------------------------
// Exhaust ducting
// ---------------------------------------------------------------------------

/** Exhaust fan airflow (CFM) at its live output, from its set CFM or its duct-size model. */
function liveFanCfm(eq: EquipmentItem, outputPercent: number): number {
  const cfm = eq.flowRateCfm || INLINE_FAN_SPECS[eq.ductSizeIn || inferInlineFanDuctSize(eq)].cfm;
  return cfm * Math.max(0, Math.min(100, outputPercent)) / 100;
}

/**
 * CFM currently ducted out of the building by exhaust fans in these items. Tent fans use the
 * controller's output; a room-level fan has no controller and runs at its setting while on.
 */
export function getOutdoorVentedCfm(items: Item[], controlled: boolean): number {
  return items.reduce((sum, i) => {
    if (i.category !== 'equipment' || i.type !== 'exhaust_fan' || i.exhaustTo !== 'outdoors' || !i.powerOn) return sum;
    return sum + liveFanCfm(i, controlled ? (i.effectiveSetting ?? 0) : i.setting);
  }, 0);
}

/** Share (0-1) of a tent's running fan airflow that is ducted outdoors rather than into the room. */
export function getOutdoorFanShare(items: Item[]): number {
  let total = 0;
  let outdoors = 0;
  for (const i of items) {
    if (i.category !== 'equipment' || i.type !== 'exhaust_fan' || !i.powerOn) continue;
    const cfm = liveFanCfm(i, i.effectiveSetting ?? 0);
    total += cfm;
    if (i.exhaustTo === 'outdoors') outdoors += cfm;
  }
  return total > 0 ? outdoors / total : 0;
}

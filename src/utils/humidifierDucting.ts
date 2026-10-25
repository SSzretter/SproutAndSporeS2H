import { EquipmentItem, Item, Room, Tent } from '../types/sim';

/**
 * Hose-ducted humidifiers & reservoir water temperature.
 *
 * A humidifier/fogger sitting in `room.items` can pipe its mist through a hose into a tent
 * (`ductedToTentId`). Its moisture then lands in that tent and it is arbitrated by that tent's
 * controller, while its water reservoir sits in (and drifts toward) the room's air temperature.
 */

export const DEFAULT_RESERVOIR_SETPOINT_F = 68;

// Share of mist that survives the hose run (condensation on the hose walls)
export const HOSE_DELIVERY_EFFICIENCY = 0.9;

export function isHumidifier(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && item.type === 'humidifier';
}

/** The tent a room-level humidifier is ducted into, or undefined if not ducted / link is dangling. */
export function getDuctTargetTent(room: Room, item: Item): Tent | undefined {
  if (!isHumidifier(item) || !item.ductedToTentId) return undefined;
  if (!room.items.some(i => i.id === item.id)) return undefined; // only room-level units can be ducted
  return room.tents.find(t => t.id === item.ductedToTentId);
}

/** Room-level humidifiers whose hose feeds the given tent. */
export function getDuctedHumidifiersForTent(room: Room, tentId: string): EquipmentItem[] {
  return room.items.filter(
    (i): i is EquipmentItem => isHumidifier(i) && i.ductedToTentId === tentId && room.tents.some(t => t.id === tentId)
  );
}

/**
 * Advances a humidifier's reservoir water temperature one step.
 * Passive water drifts toward the air around the unit (tent air for in-tent units, room air for
 * external/ducted units). A powered heater pulls it up to its setpoint, a chiller pulls it down;
 * neither works against ambient beyond that (a heater never cools, a chiller never warms).
 */
export function stepReservoirTempF(eq: EquipmentItem, ambientTempF: number, elapsedMinutes: number): number {
  const current = eq.reservoirTempF ?? ambientTempF;
  const setpoint = eq.reservoirSetpointF ?? DEFAULT_RESERVOIR_SETPOINT_F;
  const mode = eq.reservoirConditioning || 'none';

  let target = ambientTempF;
  let rate = 0.012; // ~1/80 min time constant for a few litres of water
  if (eq.powerOn && mode === 'heater' && setpoint > ambientTempF) {
    target = setpoint;
    rate = 0.05;
  } else if (eq.powerOn && mode === 'chiller' && setpoint < ambientTempF) {
    target = setpoint;
    rate = 0.04;
  }

  const fraction = 1 - Math.exp(-rate * Math.max(0, elapsedMinutes));
  return parseFloat((current + (target - current) * fraction).toFixed(1));
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

/**
 * Save migration: default reservoir fields on humidifiers, drop hose links on in-tent units
 * and links that point at tents that no longer exist.
 */
export function migrateHumidifierDucting(room: Room): Room {
  const fixHumidifier = (item: Item, allowDuct: boolean): Item => {
    if (!isHumidifier(item)) return item;
    const next: EquipmentItem = {
      ...item,
      reservoirConditioning: item.reservoirConditioning || 'none',
      reservoirSetpointF: item.reservoirSetpointF ?? DEFAULT_RESERVOIR_SETPOINT_F
    };
    if (next.ductedToTentId && (!allowDuct || !room.tents.some(t => t.id === next.ductedToTentId))) {
      delete next.ductedToTentId;
    }
    return next;
  };

  return {
    ...room,
    items: room.items.map(i => fixHumidifier(i, true)),
    tents: room.tents.map(t => ({ ...t, items: t.items.map(i => fixHumidifier(i, false)) }))
  };
}

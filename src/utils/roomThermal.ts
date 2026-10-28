import { EquipmentItem, Item, Room } from '../types/sim';
import { getReservoirHeatWatts } from './nutrientReservoirs';

/**
 * Indoor room heat balance. There is no hidden HVAC: a room's temperature comes from its envelope
 * (heat lost to the outdoors, the ground and the rest of the house), the heat every piece of
 * equipment gives off, and only the heating / cooling equipment actually placed in it
 * (heaters, portable A/Cs, HVAC supply registers). Units: BTU, BTU/h, BTU/h·°F, °F.
 */

// Deep soil around a foundation stays near this all year
export const GROUND_TEMP_F = 55;
// The rest of the house next to an indoor room, when the room doesn't say otherwise
export const DEFAULT_ADJACENT_SPACE_TEMP_F = 70;

const BTU_PER_WATT_HOUR = 3.412;
const AIR_BTU_PER_CUBIC_FOOT_F = 0.018;
// Heat stored by a room's surfaces and contents (BTU per °F), beyond its air. Concrete only counts for
// the inner few inches that exchange heat with the room over a day.
const DRYWALL_BTU_PER_SQFT_F = 0.5; // 1/2" gypsum on walls & ceiling
const FURNISHINGS_BTU_PER_SQFT_F = 0.6; // per sq ft of floor
const CONCRETE_BTU_PER_SQFT_F = 2.5; // ~2" active layer of slab / foundation wall
// Latent heat of water: condensing 1 L/h releases ~630 W; evaporating it absorbs the same
export const LATENT_WATTS_PER_LITRE_HOUR = 628;
// Longest step the room temperature is integrated in, so thermostats cycle even on time skips
export const MAX_THERMAL_SUBSTEP_MINUTES = 5;

// HVAC supply air temperatures delivered by a register
export const REGISTER_COOL_SUPPLY_F = 55;
export const REGISTER_HEAT_SUPPLY_F = 110;
export const DEFAULT_REGISTER_CFM = 150;
export const DEFAULT_PORTABLE_AC_BTU = 8000;

export interface RoomEnvelope {
  uaOutdoor: number; // walls / roof exposed outside + air leakage
  uaGround: number; // below-grade walls and slab
  uaHouse: number; // interior partitions, ceilings / floors shared with the house
  capacity: number; // BTU per °F
}

/** Heat-loss paths for a room, by where it sits in the building (foundationType). */
export function getRoomEnvelope(room: Room): RoomEnvelope {
  const { length: L, width: W, height: H } = room.dimensions;
  const wallArea = 2 * (L + W) * H;
  const floorArea = L * W;
  const volume = Math.max(100, L * W * H);
  const rWall = Math.max(1, room.wallRValue || 19);
  const infiltration = (room.airChangesPerHour || 0.35) * volume * AIR_BTU_PER_CUBIC_FOOT_F;
  // Half of a room's walls face outside; the rest are interior partitions (drywall, ~R-2)
  const exteriorWall = wallArea * 0.5;
  const interiorWall = wallArea * 0.5;

  let uaOutdoor = infiltration;
  let uaGround = 0;
  let uaHouse = interiorWall / 2;
  switch (room.foundationType) {
    case 'slab_on_grade':
      uaOutdoor += exteriorWall / rWall;
      uaGround += floorArea / 10;
      uaHouse += floorArea / 3; // ceiling to the floor above
      break;
    case 'second_floor':
      uaOutdoor += exteriorWall / rWall + floorArea / 38; // insulated attic ceiling above
      uaHouse += floorArea / 3; // floor over the level below
      break;
    case 'attic':
      uaOutdoor += exteriorWall / (rWall * 0.5) + floorArea / (rWall * 0.7); // roof deck
      uaHouse += floorArea / rWall; // insulated attic floor over the house
      break;
    case 'conditioned_basement':
    default:
      // Exterior walls are mostly below grade; soil adds roughly R-8 outside the concrete
      uaOutdoor += (exteriorWall * 0.2) / rWall;
      uaGround += (exteriorWall * 0.8) / (rWall * 0.5 + 8) + floorArea / 10;
      uaHouse += floorArea / 3; // uninsulated joists to the floor above
      break;
  }
  // Thermal mass: air + drywall + furnishings, plus exposed concrete for slab and basement rooms
  let concreteArea = 0;
  if (room.foundationType === 'slab_on_grade') concreteArea = floorArea;
  else if (!room.foundationType || room.foundationType === 'conditioned_basement') concreteArea = floorArea + exteriorWall * 0.8;
  const capacity = volume * AIR_BTU_PER_CUBIC_FOOT_F
    + (wallArea + floorArea) * DRYWALL_BTU_PER_SQFT_F
    + floorArea * FURNISHINGS_BTU_PER_SQFT_F
    + concreteArea * CONCRETE_BTU_PER_SQFT_F;
  return { uaOutdoor, uaGround, uaHouse, capacity };
}

export function isLightScheduledOn(hour: number, schedule?: { enabled: boolean; onHour: number; offHour: number }): boolean {
  if (!schedule || !schedule.enabled) return true;
  const { onHour, offHour } = schedule;
  if (onHour < offHour) {
    return hour >= onHour && hour < offHour;
  } else {
    // Overnight schedule e.g. 18:00 to 06:00
    return hour >= onHour || hour < offHour;
  }
}

/** Equipment the room loop runs on its own thermostat (heat or cooling directly in the room). */
export function isRoomClimateUnit(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && (item.type === 'heater' || item.type === 'portable_ac' || item.type === 'hvac_register');
}

/**
 * Heat (watts) a running item gives off into the space around it, from its last tick:
 * everything electrical ends up as heat; a dehumidifier also releases the latent heat of the water
 * it condenses, and a humidifier's mist absorbs heat as it evaporates. Room heaters, A/Cs and
 * registers are handled by the thermostat loop instead.
 */
export function getItemHeatWatts(item: Item, hour: number): number {
  if (item.category === 'person' || item.category === 'pet') return item.heatOutputWatts || 0;
  if (item.category !== 'equipment' || !item.powerOn) return 0;
  const output = (item.effectiveSetting ?? item.setting ?? 0) / 100;
  switch (item.type) {
    case 'grow_light':
      return isLightScheduledOn(hour, item.schedule) ? (item.powerWatts || 0) * ((item.setting ?? 100) / 100) : 0;
    case 'dehumidifier':
      return (item.powerWatts || 0) * output + (item.waterFlowLph ?? 0) * LATENT_WATTS_PER_LITRE_HOUR;
    case 'humidifier':
      return (item.powerWatts || 0) * output - (item.waterFlowLph ?? 0) * 0.85 * LATENT_WATTS_PER_LITRE_HOUR;
    case 'heat_mat':
      return item.powerWatts || 0;
    case 'nutrient_reservoir':
      return getReservoirHeatWatts(item);
    case 'oscillating_fan':
      return (item.powerWatts || 0) * ((item.setting ?? 100) / 100);
    case 'portable_ac':
    case 'hvac_register':
      return 0; // cooling / heating handled by the thermostat loop; A/C heat is vented outside
    default:
      return (item.powerWatts || 0) * output;
  }
}

/** Rated cooling of a portable A/C: its setting, else a "12,000 BTU" style figure in its name. */
export function getPortableAcBtu(eq: EquipmentItem): number {
  if (eq.coolingCapacityBtu) return eq.coolingCapacityBtu;
  const named = eq.name.replace(/,/g, '').match(/(\d{4,5})\s*BTU/i);
  return named ? parseInt(named[1], 10) : DEFAULT_PORTABLE_AC_BTU;
}

export interface RoomClimateUnitState {
  running: boolean;
  status: string;
}

/**
 * Integrates the room's temperature over `elapsedMinutes` in short substeps. `gainsWatts` is the
 * steady heat from everything else in the room (equipment in tents included). Returns the new
 * temperature, each thermostat unit's state for display, and how many minutes each cooling unit
 * ran (A/Cs and cooling registers also dry the air).
 */
export function stepRoomTemperature(params: {
  room: Room;
  tempF: number;
  outdoorTempF: number;
  extraOutdoorUa?: number; // make-up air drawn from outdoors to replace air ducted outside (1.08 x CFM)
  gainsWatts: number;
  elapsedMinutes: number;
}): { tempF: number; units: Map<string, RoomClimateUnitState>; coolingRunMinutes: Map<string, number> } {
  const { room, outdoorTempF, gainsWatts, elapsedMinutes, extraOutdoorUa = 0 } = params;
  const env = getRoomEnvelope(room);
  const houseF = room.adjacentSpaceTempF ?? DEFAULT_ADJACENT_SPACE_TEMP_F;
  const units = room.items.filter(isRoomClimateUnit);
  const states = new Map<string, RoomClimateUnitState>();
  const coolingRunMinutes = new Map<string, number>();

  let tempF = params.tempF;
  let remaining = Math.max(0, elapsedMinutes);
  while (remaining > 1e-9) {
    const dtMin = Math.min(MAX_THERMAL_SUBSTEP_MINUTES, remaining);
    remaining -= dtMin;

    const uaOutdoor = env.uaOutdoor + extraOutdoorUa;
    let ua = uaOutdoor + env.uaGround + env.uaHouse;
    let weighted = uaOutdoor * outdoorTempF + env.uaGround * GROUND_TEMP_F + env.uaHouse * houseF;
    let gainsBtuH = gainsWatts * BTU_PER_WATT_HOUR;

    for (const unit of units) {
      const target = unit.targetTempF ?? (unit.type === 'heater' ? 74 : 72);
      let running = false;
      let status = unit.powerOn ? `Idle: ${tempF.toFixed(1)}°F at target ${target}°F` : 'Off';
      if (unit.powerOn && unit.type === 'heater' && tempF < target) {
        running = true;
        gainsBtuH += (unit.powerWatts || 0) * ((unit.setting ?? 100) / 100) * BTU_PER_WATT_HOUR;
        status = `Heating: ${tempF.toFixed(1)}°F → ${target}°F`;
      } else if (unit.powerOn && unit.type === 'portable_ac' && tempF > target) {
        running = true;
        gainsBtuH -= getPortableAcBtu(unit) * ((unit.setting ?? 100) / 100);
        status = `Cooling: ${tempF.toFixed(1)}°F → ${target}°F`;
      } else if (unit.powerOn && unit.type === 'hvac_register') {
        const mode = unit.registerMode ?? 'cool';
        const cooling = (mode === 'cool' || mode === 'auto') && tempF > target;
        const heating = (mode === 'heat' || mode === 'auto') && tempF < target;
        if (cooling || heating) {
          running = true;
          // Supply air mixes into the room: a coupling of 1.08 BTU/h per CFM per °F toward the supply temperature
          const coupling = 1.08 * (unit.flowRateCfm ?? DEFAULT_REGISTER_CFM) * ((unit.setting ?? 100) / 100);
          const supplyF = cooling ? REGISTER_COOL_SUPPLY_F : REGISTER_HEAT_SUPPLY_F;
          ua += coupling;
          weighted += coupling * supplyF;
          status = `${cooling ? 'Cooling' : 'Heating'}: ${tempF.toFixed(1)}°F → ${target}°F (${supplyF}°F supply)`;
        } else if (mode === 'off') {
          status = 'Closed (register off)';
        }
      }
      if (running && (unit.type === 'portable_ac' || (unit.type === 'hvac_register' && tempF > target))) {
        coolingRunMinutes.set(unit.id, (coolingRunMinutes.get(unit.id) ?? 0) + dtMin);
      }
      // Report the state from the last substep
      states.set(unit.id, { running, status });
    }

    const equilibriumF = (weighted + gainsBtuH) / ua;
    tempF = equilibriumF + (tempF - equilibriumF) * Math.exp((-ua * (dtMin / 60)) / env.capacity);
  }
  return { tempF, units: states, coolingRunMinutes };
}

/** Litres per hour a running portable A/C wrings out of the air (more in humid air). */
export function getPortableAcMoistureLph(eq: EquipmentItem, rh: number): number {
  const humidityFactor = Math.max(0, Math.min(1.5, (rh - 30) / 30));
  return (getPortableAcBtu(eq) / DEFAULT_PORTABLE_AC_BTU) * 0.9 * humidityFactor;
}

type LegacyHvacRoom = Room & { hvacMode?: string; hvacCoolingSetpointF?: number; hvacHeatingSetpointF?: number };

/**
 * Save migration: rooms used to carry an invisible "central HVAC mode". A room that had central A/C
 * or heat on gets a visible ceiling supply register at the same setpoint instead, then the old
 * fields are dropped (so deleting the register later sticks). Passive rooms just lose the fields.
 */
export function migrateRoomClimateControl(room: Room): Room {
  const legacy = room as LegacyHvacRoom;
  if (legacy.hvacMode === undefined && legacy.hvacCoolingSetpointF === undefined && legacy.hvacHeatingSetpointF === undefined) {
    return room;
  }
  const { hvacMode, hvacCoolingSetpointF, hvacHeatingSetpointF, ...rest } = legacy;
  const next: Room = { ...rest };
  const indoor = !room.environmentType || room.environmentType === 'indoor';
  const conditioned = hvacMode === 'central_ac_active' || hvacMode === 'heating_active';
  if (indoor && conditioned && !room.items.some(i => i.category === 'equipment' && i.type === 'hvac_register')) {
    const cooling = hvacMode === 'central_ac_active';
    next.items = [...room.items, createHvacRegister(room, cooling ? 'cool' : 'heat', cooling ? (hvacCoolingSetpointF ?? 72) : (hvacHeatingSetpointF ?? 68))];
  }
  return next;
}

/** A ceiling supply register from the house's central system, centered in the room. */
export function createHvacRegister(room: Room, mode: 'cool' | 'heat' | 'auto', targetTempF: number): EquipmentItem {
  return {
    id: `eq-register-${room.id}-${Date.now()}`,
    name: 'Ceiling Supply Register (Central HVAC)',
    category: 'equipment',
    type: 'hvac_register',
    powerOn: true,
    powerWatts: 0,
    setting: 100,
    registerMode: mode,
    targetTempF,
    flowRateCfm: DEFAULT_REGISTER_CFM,
    dimensions: { length: 1.0, width: 0.4, height: 0.08, unit: 'ft' },
    position: { x: room.dimensions.length / 2, y: room.dimensions.width / 2, z: Math.max(0, room.dimensions.height - 0.08) },
    notes: 'Conditioned air from the house\'s central system. Set its mode and thermostat here; close it (mode off) to stop it.'
  };
}

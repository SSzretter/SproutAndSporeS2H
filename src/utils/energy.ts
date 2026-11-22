import { EnergyCategory, EquipmentItem, Item, Room, RoomEnergyMeter } from '../types/sim';
import { getPortableAcBtu, isLightScheduledOn } from './roomThermal';
import { getReservoirElectricWatts } from './nutrientReservoirs';

/**
 * Electricity metering. Each tick, every piece of equipment in a room (its tents included) draws
 * power from what it actually did that tick (its effectiveSetting, schedule or thermostat state), and
 * the room's meter integrates that into kWh: today, yesterday and lifetime, split by category.
 * A ceiling register's energy belongs to the house's central system, so it isn't metered here.
 */

export const DEFAULT_ELECTRICITY_RATE_PER_KWH = 0.15; // US$ / kWh, roughly the US residential average

export const ENERGY_CATEGORY_LABELS: Record<EnergyCategory, string> = {
  lighting: 'Lighting',
  climate: 'Heat & cooling',
  humidity: 'Humidity',
  airflow: 'Fans',
  water: 'Pumps & reservoirs',
  heat_mats: 'Heat mats',
  other: 'Other'
};

export function getEnergyCategory(eq: EquipmentItem): EnergyCategory {
  switch (eq.type) {
    case 'grow_light': return 'lighting';
    case 'heater':
    case 'portable_ac': return 'climate';
    case 'humidifier':
    case 'dehumidifier': return 'humidity';
    case 'exhaust_fan':
    case 'oscillating_fan': return 'airflow';
    case 'nutrient_reservoir': return 'water';
    case 'heat_mat': return 'heat_mats';
    default: return 'other';
  }
}

/** Watts an item draws from the wall right now (0 when off, idle or not electrical). */
export function getItemElectricWatts(item: Item, hour: number): number {
  if (item.category !== 'equipment' || !item.powerOn) return 0;
  const output = (item.effectiveSetting ?? item.setting ?? 0) / 100;
  switch (item.type) {
    case 'grow_light':
      return isLightScheduledOn(hour, item.schedule) ? (item.powerWatts || 0) * ((item.setting ?? 100) / 100) : 0;
    case 'heat_mat':
      return item.powerWatts || 0;
    case 'oscillating_fan':
      return (item.powerWatts || 0) * ((item.setting ?? 100) / 100);
    case 'nutrient_reservoir':
      return getReservoirElectricWatts(item);
    case 'portable_ac': {
      // A typical portable A/C draws about 1 W per 10 BTU/h of cooling (EER ~10) when its rating isn't given
      const rated = item.powerWatts || getPortableAcBtu(item) / 10;
      return rated * output;
    }
    case 'hvac_register':
    case 'co2_bag':
    case 'grow_rack':
      return 0;
    default:
      return (item.powerWatts || 0) * output;
  }
}

export function createEnergyMeter(simTime: number): RoomEnergyMeter {
  return {
    totalKWh: 0,
    todayKWh: 0,
    yesterdayKWh: 0,
    dayStartTime: startOfDay(simTime),
    currentWatts: 0,
    peakWattsToday: 0,
    byCategoryKWh: {}
  };
}

function startOfDay(simTime: number): number {
  const d = new Date(simTime);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Advances a room's meter by one tick, using the room's items as they stand after the tick (so
 * thermostats, schedules and controllers report what they did). Rolls today into yesterday at sim
 * midnight.
 */
export function stepRoomEnergy(room: Room, simTime: number, elapsedMinutes: number): RoomEnergyMeter {
  const hour = new Date(simTime).getHours() + new Date(simTime).getMinutes() / 60;
  const meter: RoomEnergyMeter = room.energy ? { ...room.energy, byCategoryKWh: { ...room.energy.byCategoryKWh } } : createEnergyMeter(simTime);

  const dayStart = startOfDay(simTime);
  if (dayStart !== meter.dayStartTime) {
    // A skip of more than a day leaves yesterday at whatever the last partial day used
    meter.yesterdayKWh = dayStart - meter.dayStartTime <= 86_400_000 * 1.1 ? meter.todayKWh : 0;
    meter.todayKWh = 0;
    meter.peakWattsToday = 0;
    meter.dayStartTime = dayStart;
  }

  let watts = 0;
  const kWhPerWatt = Math.max(0, elapsedMinutes) / 60 / 1000;
  for (const item of [...room.items, ...room.tents.flatMap(t => t.items)]) {
    const w = getItemElectricWatts(item, hour);
    if (w <= 0 || item.category !== 'equipment') continue;
    watts += w;
    const category = getEnergyCategory(item);
    meter.byCategoryKWh[category] = (meter.byCategoryKWh[category] ?? 0) + w * kWhPerWatt;
  }
  meter.currentWatts = watts;
  meter.peakWattsToday = Math.max(meter.peakWattsToday, watts);
  meter.todayKWh += watts * kWhPerWatt;
  meter.totalKWh += watts * kWhPerWatt;
  return meter;
}

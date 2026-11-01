import { Item } from '../types/sim';
import { isBucketFull, isReservoirEmpty } from './equipmentLinks';
import { isLightScheduledOn } from './roomThermal';
import { isNutrientReservoirEmpty } from './nutrientReservoirs';

/**
 * What a piece of equipment is doing right now, from its live simulation state:
 * - running: actually working (lights lit, fan blowing, misting, heating, cooling, injecting...)
 * - idle: powered but not needed right now (target reached, lights-off period, controller hold)
 * - blocked: wants to run but can't (empty tank, full bucket)
 * - off: switched off
 */
export type EquipmentActivity = 'running' | 'idle' | 'blocked' | 'off';

export interface EquipmentActivityInfo {
  activity: EquipmentActivity;
  label: string;
}

export function getEquipmentActivity(item: Item, hour: number): EquipmentActivityInfo | null {
  if (item.category !== 'equipment') return null;
  if (item.type === 'grow_rack') return null; // Passive shelving: nothing to run
  if (!item.powerOn && item.type !== 'co2_bag') return { activity: 'off', label: 'Off' };

  if (item.type === 'humidifier' && isReservoirEmpty(item)) return { activity: 'blocked', label: 'Out of water' };
  if (item.type === 'dehumidifier' && isBucketFull(item)) return { activity: 'blocked', label: 'Bucket full' };
  if (item.type === 'nutrient_reservoir') {
    if (isNutrientReservoirEmpty(item)) return { activity: 'blocked', label: 'Reservoir empty' };
    if (!(item.feedTargets ?? []).length) return { activity: 'idle', label: 'No feed lines' };
    return (item.effectiveSetting ?? 0) > 0
      ? { activity: 'running', label: item.pumpMode === 'continuous' ? 'Circulating' : 'Flooding' }
      : { activity: 'idle', label: 'Between floods' };
  }

  switch (item.type) {
    case 'grow_light': {
      const isRunning = isLightScheduledOn(hour, item.schedule);
      if (isRunning) return { activity: 'running', label: item.schedule?.enabled ? 'Lights on' : 'Lights on (24/0)' };
      const isOffDisabled = item.schedule && !item.schedule.enabled && item.schedule.disabledState !== 'on';
      return {
        activity: 'idle',
        label: isOffDisabled ? 'Schedule disabled (Off for germination)' : 'Lights off (schedule)'
      };
    }
    case 'co2_bag':
      return { activity: 'running', label: 'Releasing CO\u2082' };
    case 'heat_mat':
    case 'oscillating_fan':
      return { activity: 'running', label: 'Running' };
    default: {
      // Controller / thermostat output from the last tick; units nothing controls run while powered
      const output = item.effectiveSetting ?? item.setting;
      const status = item.interlockStatus?.split(':')[0];
      return output > 0
        ? { activity: 'running', label: status && !/idle|standby|off|locked|closed/i.test(status) ? status : 'Running' }
        : { activity: 'idle', label: status || 'Idle' };
    }
  }
}

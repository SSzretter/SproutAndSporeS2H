import { Item } from '../types/sim';
import { isBucketFull, isReservoirEmpty } from './equipmentLinks';
import { isLightScheduledOn } from './roomThermal';

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
  if (!item.powerOn && item.type !== 'co2_bag') return { activity: 'off', label: 'Off' };

  if (item.type === 'humidifier' && isReservoirEmpty(item)) return { activity: 'blocked', label: 'Out of water' };
  if (item.type === 'dehumidifier' && isBucketFull(item)) return { activity: 'blocked', label: 'Bucket full' };

  switch (item.type) {
    case 'grow_light':
      return isLightScheduledOn(hour, item.schedule)
        ? { activity: 'running', label: 'Lights on' }
        : { activity: 'idle', label: 'Lights off (schedule)' };
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

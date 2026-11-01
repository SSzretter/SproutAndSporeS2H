import React from 'react';
import { EquipmentItem } from '../../types/sim';
import { DEFAULT_MAT_THERMOSTAT_F, getHeatMatOptions, getHeatMatPlacementValue, getHeatMatTarget, withHeatMatPlacement } from '../../utils/equipmentLinks';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const HeatMatCard: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, onUpdateItem, eq } = props;

  return (
    <>
      {/* 7. HEAT MAT PLACEMENT & THERMOSTAT */}
      {eq.type === 'heat_mat' && (() => {
        const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
        const containerItems = hostTent ? hostTent.items : room.items;
        const target = getHeatMatTarget(eq, containerItems, hostTent);
        const options = getHeatMatOptions(containerItems, hostTent, eq.id);
        const hasThermostat = eq.targetTempF !== undefined;
        return (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs text-zinc-300">
              <span>Placed Under / Wrapped Around</span>
              <span className="font-mono font-bold text-orange-400">{eq.powerOn ? `${eq.powerWatts}W` : 'Off'}</span>
            </div>
            <select
              value={target ? getHeatMatPlacementValue(eq) : ''}
              onChange={e => onUpdateItem(withHeatMatPlacement(eq, e.target.value), selectedParentTentId)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-orange-500"
            >
              {!hostTent && <option value="">Not attached (lying on the floor)</option>}
              {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="text-[10px] text-zinc-500 block">
              {!target
                ? 'Not touching anything, so it warms nothing. Put it under a pot or container, or wrap it around a humidifier.'
                : target.kind === 'tent_floor'
                  ? `Lies under the catch tray: every pot and container standing in ${target.tent.name} gets part of its heat.`
                  : target.kind === 'rack_tray'
                    ? `Sits under that 1020 tray on ${target.rack.name}: every cell in it gets the mat's full warmth.`
                  : target.wrapped
                    ? `Heats ${target.item.name}'s reservoir water; how fast depends on the water volume and the mat's wattage.`
                    : `Warms ${target.item.name}'s ${target.item.category === 'mushroom' ? 'substrate' : 'root zone'} from below.`}
            </span>
            <label className="flex items-center gap-2 text-xs text-zinc-300 pt-1">
              <input
                type="checkbox"
                checked={hasThermostat}
                onChange={e => {
                  const next: EquipmentItem = { ...eq };
                  if (e.target.checked) next.targetTempF = DEFAULT_MAT_THERMOSTAT_F;
                  else delete next.targetTempF;
                  onUpdateItem(next, selectedParentTentId);
                }}
                className="accent-orange-500"
              />
              <span>Thermostat controller</span>
              {hasThermostat && <span className="ml-auto font-mono font-bold text-orange-400">{eq.targetTempF}°F</span>}
            </label>
            {hasThermostat && (
              <input
                type="range"
                min="65"
                max="100"
                value={eq.targetTempF}
                onChange={e => onUpdateItem({ ...eq, targetTempF: parseInt(e.target.value) }, selectedParentTentId)}
                className="w-full accent-orange-500 cursor-pointer"
              />
            )}
          </div>
        );
      })()}
    </>
  );
};

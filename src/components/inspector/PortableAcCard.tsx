import React from 'react';
import { getPortableAcBtu } from '../../utils/roomThermal';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const PortableAcCard: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, onUpdateItem, eq } = props;

  return (
    <>
      {/* 5b. PORTABLE A/C */}
      {eq.type === 'portable_ac' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Cooling Thermostat</span>
            <span className="font-mono font-bold text-sky-400">{eq.targetTempF ?? 72}°F</span>
          </div>
          <input
            type="range"
            min="60"
            max="85"
            value={eq.targetTempF ?? 72}
            onChange={e => onUpdateItem({ ...eq, targetTempF: parseInt(e.target.value) }, selectedParentTentId)}
            className="w-full accent-sky-500 cursor-pointer"
          />
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <label htmlFor={`btu-${eq.id}`}>Rated cooling capacity</label>
            <div className="flex items-center gap-1">
              <input
                id={`btu-${eq.id}`}
                type="number"
                min="4000"
                max="24000"
                step="1000"
                value={getPortableAcBtu(eq)}
                onChange={e => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value > 0) onUpdateItem({ ...eq, coolingCapacityBtu: Math.max(1000, Math.min(36000, value)) }, selectedParentTentId);
                }}
                className="w-20 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-sky-500"
              />
              <span>BTU/h</span>
            </div>
          </div>
          <span className="text-[10px] text-zinc-500 block">
            Runs while the room is above the set-point, removing {getPortableAcBtu(eq).toLocaleString()} BTU/h of heat and some moisture. Its own heat is vented outside through the window hose.
          </span>
        </div>
      )}
    </>
  );
};

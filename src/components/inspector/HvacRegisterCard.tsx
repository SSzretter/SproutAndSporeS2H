import React from 'react';
import { Room, EquipmentItem } from '../../types/sim';
import { DEFAULT_REGISTER_CFM, REGISTER_COOL_SUPPLY_F, REGISTER_HEAT_SUPPLY_F } from '../../utils/roomThermal';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const HvacRegisterCard: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, onUpdateItem, eq } = props;

  return (
    <>
      {/* 5c. HVAC SUPPLY REGISTER */}
      {eq.type === 'hvac_register' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-300">
            <span>Central System Supply</span>
            <select
              value={eq.registerMode ?? 'cool'}
              onChange={e => onUpdateItem({ ...eq, registerMode: e.target.value as EquipmentItem['registerMode'] }, selectedParentTentId)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
            >
              <option value="cool">Cooling</option>
              <option value="heat">Heating</option>
              <option value="auto">Auto (heat or cool)</option>
              <option value="off">Off (register closed)</option>
            </select>
          </div>
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Room Thermostat</span>
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
            <label htmlFor={`cfm-${eq.id}`}>Airflow through the register</label>
            <div className="flex items-center gap-1">
              <input
                id={`cfm-${eq.id}`}
                type="number"
                min="25"
                max="600"
                step="25"
                value={eq.flowRateCfm ?? DEFAULT_REGISTER_CFM}
                onChange={e => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value > 0) onUpdateItem({ ...eq, flowRateCfm: Math.max(25, Math.min(1000, value)) }, selectedParentTentId);
                }}
                className="w-16 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-sky-500"
              />
              <span>CFM</span>
            </div>
          </div>
          <span className="text-[10px] text-zinc-500 block">
            Blows the house system's air in ({REGISTER_COOL_SUPPLY_F}°F when cooling, {REGISTER_HEAT_SUPPLY_F}°F when heating) while the room is past the set-point. Cooling air is dry, so it also lowers humidity.
          </span>
        </div>
      )}
    </>
  );
};

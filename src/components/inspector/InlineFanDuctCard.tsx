import React from 'react';
import { INLINE_FAN_SPECS, INLINE_FAN_DUCT_SIZES } from '../../utils/equipmentCatalog';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const InlineFanDuctCard: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, onUpdateItem, eq } = props;

  return (
    <>
      {/* 6. INLINE FAN DUCT SIZE */}
      {eq.type === 'exhaust_fan' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Duct / Port Size</span>
            <span className="font-mono font-bold text-sky-400">{eq.flowRateCfm ?? INLINE_FAN_SPECS[eq.ductSizeIn || 6].cfm} CFM</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {INLINE_FAN_DUCT_SIZES.map(size => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  const spec = INLINE_FAN_SPECS[size];
                  onUpdateItem({
                    ...eq,
                    ductSizeIn: size,
                    flowRateCfm: spec.cfm,
                    powerWatts: spec.watts,
                    dimensions: { ...spec.dimensions }
                  }, selectedParentTentId);
                }}
                className={`py-1.5 rounded-lg text-xs font-medium border ${
                          (eq.ductSizeIn || 6) === size ? 'bg-sky-950 border-sky-500 text-sky-300' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
              >
                {size}" duct
              </button>
            ))}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            Air exchange scales with the fan's CFM against the tent's volume.
          </span>
          <div className="flex items-center justify-between gap-2 pt-1 text-xs text-zinc-300">
            <label htmlFor={`exhaust-to-${eq.id}`}>Exhaust ducted to</label>
            <select
              id={`exhaust-to-${eq.id}`}
              value={eq.exhaustTo ?? 'room'}
              onChange={e => onUpdateItem({ ...eq, exhaustTo: e.target.value as 'room' | 'outdoors' }, selectedParentTentId)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
            >
              <option value="room">The room</option>
              <option value="outdoors">Outdoors (window / wall vent)</option>
            </select>
          </div>
          <span className="text-[10px] text-zinc-500 block">
            {(eq.exhaustTo ?? 'room') === 'outdoors'
              ? 'Ducted out a window or wall vent: what it removes leaves the building. The room draws in the same amount of outdoor air to replace it.'
              : selectedParentTentId
                ? "Blows the tent's warm, humid (and CO\u2082-laden) air into the room, so it adds to the room's climate."
                : 'A room-level fan blowing into the room just stirs the air; duct it outdoors to ventilate the room.'}
          </span>
        </div>
      )}
    </>
  );
};

import React from 'react';
import { EquipmentItem } from '../../types/sim';
import { getReservoirLiters, getReservoirLevelL, isReservoirEmpty, getMistWaterUseLph, refillReservoir, getMaxReservoirLiters, isHeatMat } from '../../utils/equipmentLinks';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const HumidifierReservoirCard: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, tempUnit, onLogJournalEntry, onUpdateItem, eq } = props;

  return (
    <>
      {/* 3c. HUMIDIFIER RESERVOIR WATER (follows ambient; heated only by a wrapped heat mat) */}
      {eq.type === 'humidifier' && (() => {
        const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
        const ambientF = hostTent ? hostTent.climate.tempF : room.climate.tempF;
        const waterF = eq.reservoirTempF ?? ambientF;
        const containerItems = hostTent ? hostTent.items : room.items;
        const wrappedMats = containerItems.filter(i => isHeatMat(i) && i.attachedToId === eq.id) as EquipmentItem[];
        const fmt = (f: number) => tempUnit === 'F' ? `${f.toFixed(1)}°F` : `${((f - 32) * 5 / 9).toFixed(1)}°C`;
        const capacityL = getReservoirLiters(eq);
        const empty = isReservoirEmpty(eq);
        const levelL = empty ? 0 : getReservoirLevelL(eq);
        const levelPct = Math.round((levelL / capacityL) * 100);
        // Live use from the last tick (follows the moisture the air actually took up); max is the rated output
        const useLph = eq.powerOn ? (eq.waterFlowLph ?? 0) : 0;
        const maxLph = getMistWaterUseLph(eq, eq.setting);
        const maxCapacityL = getMaxReservoirLiters(eq);
        return (
          <div className={`bg-zinc-900 border rounded-xl p-3.5 space-y-2 ${empty ? 'border-rose-700/70' : 'border-zinc-800'}`}>
            <div className="flex justify-between text-xs text-zinc-300">
              <span>Reservoir Water</span>
              <span className="font-mono font-bold text-cyan-400">{fmt(waterF)}</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                <div
                  className={`h-full ${empty ? 'bg-rose-500' : levelPct < 20 ? 'bg-amber-400' : 'bg-cyan-500'}`}
                  style={{ width: `${levelPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className={empty ? 'text-rose-400 font-bold' : levelPct < 20 ? 'text-amber-300' : 'text-zinc-400'}>
                  {empty ? 'EMPTY — not misting' : `${levelL.toFixed(1)} / ${capacityL.toFixed(1)} L (${levelPct}%)`}
                </span>
                <span className="text-zinc-500">
                  {empty ? '' : useLph > 0.0005 ? `using ${useLph.toFixed(2)} L/h · ~${Math.floor(levelL / useLph)}h left` : 'Idle — not using water'}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={levelPct >= 100}
              onClick={() => {
                onUpdateItem(refillReservoir(eq, ambientF), selectedParentTentId);
                onLogJournalEntry?.({
                  title: `💧 Refilled ${eq.name}`,
                  message: `Topped up the reservoir with ${(capacityL - levelL).toFixed(1)} L of fresh tap water (${capacityL.toFixed(1)} L tank).`,
                  type: 'action',
                  category: 'care'
                });
              }}
              className="w-full py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-cyan-950/50 border-cyan-800 text-cyan-200 hover:bg-cyan-900/60"
            >
              {levelPct >= 100 ? 'Reservoir Full' : 'Refill Reservoir'}
            </button>
            <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400 pt-1">
              <label htmlFor={`cap-${eq.id}`}>Tank capacity (max {maxCapacityL.toFixed(1)} L to fit this unit)</label>
              <div className="flex items-center gap-1">
                <input
                  id={`cap-${eq.id}`}
                  type="number"
                  min="0.5"
                  step="0.5"
                  max={maxCapacityL.toFixed(1)}
                  value={Number(capacityL.toFixed(1))}
                  onChange={e => {
                    const value = parseFloat(e.target.value);
                    if (isNaN(value) || value <= 0) return;
                    const capped = Math.min(maxCapacityL, value);
                    onUpdateItem({ ...eq, reservoirCapacityL: capped, reservoirLevelL: Math.min(capped, getReservoirLevelL(eq)) }, selectedParentTentId);
                  }}
                  className="w-16 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
                <span>L</span>
              </div>
            </div>
            <span className="text-[10px] text-zinc-500 block">
              Rated up to {maxLph.toFixed(2)} L/h at its {eq.setting}% setting; it only uses what the air actually takes up (more with the exhaust or vents carrying humid air out).
            </span>
            <span className="text-[10px] text-zinc-500 block">
              {wrappedMats.length > 0
                ? `Heated by ${wrappedMats.map(m => `${m.name}${m.powerOn ? ` (${m.powerWatts}W)` : ' (off)'}`).join(', ')} wrapped around it; otherwise follows ${hostTent ? 'tent' : 'room'} air (${fmt(ambientF)}).`
                : `Follows ${hostTent ? 'tent' : 'room'} air (${fmt(ambientF)}). Wrap a heat mat around the unit to warm the water.`}
              {' '}Warmer water fogs more and cools the air less.
            </span>
          </div>
        );
      })()}
    </>
  );
};

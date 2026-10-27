import React from 'react';
import { getBucketCapacityL, getBucketLevelL, isBucketFull, getDehumidifierExtractionLph, emptyBucket, getMaxBucketCapacityL } from '../../utils/equipmentLinks';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const DehumidifierBucketCard: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, onLogJournalEntry, onUpdateItem, eq } = props;

  return (
    <>
      {/* 3d. DEHUMIDIFIER COLLECTION BUCKET & DRAIN HOSE */}
      {eq.type === 'dehumidifier' && (() => {
        const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
        const rh = hostTent ? hostTent.climate.rh : room.climate.rh;
        const capacityL = getBucketCapacityL(eq);
        const levelL = getBucketLevelL(eq);
        const full = isBucketFull(eq);
        const levelPct = Math.round((levelL / capacityL) * 100);
        // Live collection from the last tick (follows the moisture actually pulled out of the air)
        const fillLph = eq.powerOn ? (eq.waterFlowLph ?? 0) : 0;
        const tempF = hostTent ? hostTent.climate.tempF : room.climate.tempF;
        const maxLph = getDehumidifierExtractionLph(eq, eq.setting, rh, tempF);
        const maxCapacityL = getMaxBucketCapacityL(eq);
        return (
          <div className={`bg-zinc-900 border rounded-xl p-3.5 space-y-2 ${full ? 'border-rose-700/70' : 'border-zinc-800'}`}>
            <div className="flex justify-between text-xs text-zinc-300">
              <span>Collection Bucket</span>
              <span className="font-mono font-bold text-cyan-400">
                {eq.drainHoseConnected ? 'Drain hose' : `${levelL.toFixed(1)} / ${capacityL.toFixed(1)} L`}
              </span>
            </div>
            {!eq.drainHoseConnected && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <div
                    className={`h-full ${full ? 'bg-rose-500' : levelPct > 80 ? 'bg-amber-400' : 'bg-cyan-500'}`}
                    style={{ width: `${levelPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className={full ? 'text-rose-400 font-bold' : levelPct > 80 ? 'text-amber-300' : 'text-zinc-400'}>
                    {full ? 'FULL — shut off' : `${levelPct}% full`}
                  </span>
                  <span className="text-zinc-500">
                    {full ? '' : fillLph > 0.0005 ? `collecting ${fillLph.toFixed(2)} L/h · full in ~${Math.floor((capacityL - levelL) / fillLph)}h` : 'Idle — not collecting'}
                  </span>
                </div>
              </div>
            )}
            {!eq.drainHoseConnected && (
              <button
                type="button"
                disabled={levelL < 0.05}
                onClick={() => {
                  onUpdateItem(emptyBucket(eq), selectedParentTentId);
                  onLogJournalEntry?.({
                    title: `🪣 Emptied ${eq.name}`,
                    message: `Poured out ${levelL.toFixed(1)} L of condensate from the collection bucket.`,
                    type: 'action',
                    category: 'care'
                  });
                }}
                className="w-full py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-cyan-950/50 border-cyan-800 text-cyan-200 hover:bg-cyan-900/60"
              >
                {levelL < 0.05 ? 'Bucket Empty' : 'Empty Bucket'}
              </button>
            )}
            {!eq.drainHoseConnected && (
            <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400 pt-1">
              <label htmlFor={`cap-${eq.id}`}>Bucket capacity (max {maxCapacityL.toFixed(1)} L to fit this unit)</label>
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
                    onUpdateItem({ ...eq, bucketCapacityL: capped, bucketLevelL: Math.min(capped, getBucketLevelL(eq)) }, selectedParentTentId);
                  }}
                  className="w-16 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
                <span>L</span>
              </div>
            </div>
            )}
            <span className="text-[10px] text-zinc-500 block">
              Can pull up to {maxLph.toFixed(2)} L/h at {Math.round(rh)}% RH and {Math.round(tempF)}°F (rated at 65°F / 60% RH; less in drier or cooler air).
            </span>
            <label className="flex items-center gap-2 text-xs text-zinc-300 pt-1">
              <input
                type="checkbox"
                checked={!!eq.drainHoseConnected}
                onChange={e => onUpdateItem({ ...eq, drainHoseConnected: e.target.checked, bucketLevelL: e.target.checked ? 0 : eq.bucketLevelL }, selectedParentTentId)}
                className="accent-cyan-500"
              />
              <span>Continuous drain hose</span>
            </label>
            <span className="text-[10px] text-zinc-500 block">
              {eq.drainHoseConnected
                ? `Condensate runs straight to a drain (${fillLph.toFixed(2)} L/h right now), so the unit never stops for a full bucket.`
                : 'When the bucket fills, the float switch shuts the unit off until it is emptied. Drier air collects less water.'}
            </span>
          </div>
        );
      })()}
    </>
  );
};

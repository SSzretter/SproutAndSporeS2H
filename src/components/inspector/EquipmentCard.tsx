import React from 'react';
import { Zap, Shield, Power } from 'lucide-react';
import { EquipmentItem } from '../../types/sim';
import { GrowLightControls } from './GrowLightControls';
import { ExhaustFanControls } from './ExhaustFanControls';
import { HumidityControls } from './HumidityControls';
import { HumidifierReservoirCard } from './HumidifierReservoirCard';
import { DehumidifierBucketCard } from './DehumidifierBucketCard';
import { Co2HeaterControls } from './Co2HeaterControls';
import { PortableAcCard } from './PortableAcCard';
import { HvacRegisterCard } from './HvacRegisterCard';
import { InlineFanDuctCard } from './InlineFanDuctCard';
import { HeatMatCard } from './HeatMatCard';
import { GrowRackCard } from './GrowRackCard';
import { NutrientReservoirCard } from './NutrientReservoirCard';
import type { ItemSectionProps } from './types';

export const EquipmentCard: React.FC<ItemSectionProps> = (props) => {
  const { selectedParentTentId, onUpdateItem, currentItem } = props;

  return (
    <>
      {currentItem.category === 'equipment' && (() => {
        const eq = currentItem as EquipmentItem;
        // A rack is passive shelving: no power or controller, just its shelves and trays
        if (eq.type === 'grow_rack') return <GrowRackCard {...props} eq={eq} />;
        const currentMode = eq.controlMode || 'auto';
        const triggers = eq.autoTriggers || {};

        // Helper for hour labels
        const formatHour = (h: number) => {
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const ampm = h < 12 ? 'AM' : 'PM';
          return `${h.toString().padStart(2, '0')}:00 (${h12} ${ampm})`;
        };

        // Calculate daylight hours
        const onH = eq.schedule?.onHour ?? 6;
        const offH = eq.schedule?.offHour ?? 0;
        let dayLength = 0;
        if (eq.schedule?.enabled) {
          dayLength = offH >= onH ? offH - onH : (24 - onH + offH);
          if (dayLength === 0) dayLength = 24;
        } else if (eq.schedule?.disabledState === 'on') {
          dayLength = 24;
        } else {
          dayLength = 0;
        }
        const nightLength = 24 - dayLength;

        return (
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-4">
            {/* Header with Power Switch & Controller Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${eq.powerOn ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    {eq.name}
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {eq.type.replace('_', ' ')}
                    </span>
                  </h4>
                  <span className="text-xs text-zinc-400 font-mono">
                    Rated Draw: {eq.powerWatts}W • Actual: {Math.round(eq.powerWatts * ((eq.effectiveSetting ?? eq.setting) / 100))}W
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onUpdateItem({
                      ...eq,
                      powerOn: !eq.powerOn
                    }, selectedParentTentId);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                      eq.powerOn
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 ring-1 ring-emerald-400/50'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                    }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{eq.powerOn ? 'POWER: ON' : 'POWER: OFF'}</span>
                </button>
              </div>
            </div>

            {/* Central Controller Arbitration Status Banner */}
            {eq.powerOn && (
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-zinc-300">Controller State:</span>
                    <p className="text-[11px] font-mono text-zinc-400">
                      {eq.interlockStatus || (eq.effectiveSetting !== undefined ? `Running at ${eq.effectiveSetting}% output` : 'Active and responding')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Effective Output:</span>
                  <span className={`font-mono text-sm font-bold px-2.5 py-0.5 rounded ${
                      (eq.effectiveSetting ?? eq.setting) > 0 
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                    {eq.effectiveSetting ?? eq.setting}%
                  </span>
                </div>
              </div>
            )}

            <GrowLightControls {...props} eq={eq} formatHour={formatHour} dayLength={dayLength} nightLength={nightLength} />

            <ExhaustFanControls {...props} eq={eq} currentMode={currentMode} triggers={triggers} />

            <HumidityControls {...props} eq={eq} />

            <HumidifierReservoirCard {...props} eq={eq} />

            <DehumidifierBucketCard {...props} eq={eq} />

            <Co2HeaterControls {...props} eq={eq} />

            <PortableAcCard {...props} eq={eq} />

            <HvacRegisterCard {...props} eq={eq} />

            <InlineFanDuctCard {...props} eq={eq} />

            <HeatMatCard {...props} eq={eq} />

            <NutrientReservoirCard {...props} eq={eq} />
          </div>
        );
      })()}
    </>
  );
};

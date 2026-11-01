import React from 'react';
import { Wind, Plus, ShieldAlert, Shield, ShieldCheck } from 'lucide-react';
import { EquipmentItem, ControllerPriority } from '../../types/sim';
import type { TentSectionProps, TentLocals } from './types';

export const TentExhaustFanCard: React.FC<TentSectionProps & Pick<TentLocals, 'isShroomTent'>> = (props) => {
  const { room, onUpdateTent, onOpenAddItem, currentTent, isShroomTent } = props;

  return (
    <>
        {/* Exhaust Fan Master Speed & Lung Air Exchange with Live Controller Arbitration */}
        {(() => {
          const installedExhaustFan = currentTent.items.find(
            i => i.category === 'equipment' && i.type === 'exhaust_fan'
          ) as EquipmentItem | undefined;

          return (
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
              {installedExhaustFan ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-xs font-semibold text-zinc-200">
                        Exhaust Fan: {installedExhaustFan.name}
                      </span>
                      <p className="text-[10px] text-zinc-400">Pulls conditioned lung room air through intake ports</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={currentTent.exhaustFanSpeed}
                      onChange={e => {
                        const newSpeed = parseInt(e.target.value);
                        if (currentTent) {
                          const updatedItems = currentTent.items.map(it => {
                            if (it.id === installedExhaustFan.id) {
                              return { ...it, setting: newSpeed, powerOn: newSpeed > 0 };
                            }
                            return it;
                          });
                          onUpdateTent({
                            ...currentTent,
                            exhaustFanSpeed: newSpeed,
                            items: updatedItems
                          });
                        }
                      }}
                      className="w-28 accent-emerald-500 cursor-pointer"
                    />
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-emerald-400 block">
                        {currentTent.exhaustFanSpeed}%
                      </span>
                      {currentTent.effectiveFanSpeed !== undefined && currentTent.effectiveFanSpeed !== currentTent.exhaustFanSpeed && (
                        <span className="text-[9px] font-mono text-cyan-300 block">
                          Live: {currentTent.effectiveFanSpeed}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-zinc-500" />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300">
                        Passive Airflow (No Exhaust Fan Installed)
                      </span>
                      <p className="text-[10px] text-zinc-500">
                        Air exchange is limited to passive mesh port infiltration (~0.05 ACH). Add an inline fan to force air exchange.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenAddItem(currentTent.id)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-750 text-emerald-300 text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Fan</span>
                  </button>
                </div>
              )}

          {/* Central Controller Coordination & Conflict Priority */}
          <div className="pt-2 border-t border-zinc-850 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Central Controller Priority:</span>
              </div>
              <select
                value={currentTent.controllerPriority || (isShroomTent ? 'humidity_first' : 'balanced_auto')}
                onChange={e => {
                  if (currentTent) {
                    onUpdateTent({
                      ...currentTent,
                      controllerPriority: e.target.value as ControllerPriority
                    });
                  }
                }}
                className="bg-zinc-900 border border-zinc-750 focus:border-indigo-500 rounded-lg px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none"
              >
                <option value="humidity_first">💧 Humidity First (Mushrooms / Seedlings / Clones)</option>
                <option value="balanced_auto">⚖️ Balanced Auto (Smooth VPD Coordination)</option>
                <option value="temperature_first">🌡️ Temperature First (High Heat Relief)</option>
                <option value="co2_enrichment">💨 CO₂ Enrichment (Bottled Gas Retention)</option>
              </select>
            </div>

            {/* Live Active Conflict Protection & Interlocks Banner */}
            {currentTent.activeInterlocks && currentTent.activeInterlocks.length > 0 ? (
              <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-lg p-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-[11px]">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Active Controller Conflict Protections:</span>
                </div>
                <ul className="space-y-0.5 pl-5 list-disc text-[11px] text-zinc-300 font-mono">
                  {currentTent.activeInterlocks.map((msg, idx) => (
                    <li key={idx} className="leading-tight">{msg}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 font-mono bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-2.5 py-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Central Controller Interlock Active • All devices coordinated without fighting</span>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </>
  );
};

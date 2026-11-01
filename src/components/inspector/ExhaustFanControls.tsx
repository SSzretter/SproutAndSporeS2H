import React from 'react';
import { Wind, Droplets, Thermometer, Sparkles, ShieldCheck, Timer, SlidersHorizontal } from 'lucide-react';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const ExhaustFanControls: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq' | 'currentMode' | 'triggers'>> = (props) => {
  const { room, selectedParentTentId, onUpdateItem, eq, currentMode, triggers } = props;

  return (
    <>
      {/* 2. EXHAUST FAN INTELLIGENT TRIGGERS & CONFLICT SAFEGUARDS */}
      {eq.type === 'exhaust_fan' && (
        <div className="space-y-4">
          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl">
            <button
              type="button"
              onClick={() => {
                onUpdateItem({
                  ...eq,
                  controlMode: 'auto'
                }, selectedParentTentId);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        currentMode === 'auto'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Auto Triggers</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateItem({
                  ...eq,
                  controlMode: 'cycle'
                }, selectedParentTentId);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        currentMode === 'cycle'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
            >
              <Timer className="w-3.5 h-3.5" />
              <span>FAE Cycle Timer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateItem({
                  ...eq,
                  controlMode: 'manual'
                }, selectedParentTentId);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        currentMode === 'manual'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Manual Fixed Speed</span>
            </button>
          </div>

          {/* AUTO SMART TRIGGER SETPOINTS */}
          {currentMode === 'auto' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div>
                <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                  Environmental Trigger Setpoints (Intelligent Activation)
                </h5>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Fan automatically turns on or ramps speed only when canopy needs heat evacuation, excess humidity venting, or fresh CO₂ exchange.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* High Temp Trigger */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1">
                      <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                      High Temp Trigger
                    </span>
                    <span className="font-mono font-bold text-rose-400">{triggers.tempTriggerHighF ?? 78}°F</span>
                  </div>
                  <input
                    type="range"
                    min="68"
                    max="90"
                    value={triggers.tempTriggerHighF ?? 78}
                    onChange={e => {
                      onUpdateItem({
                        ...eq,
                        autoTriggers: {
                          ...triggers,
                          tempTriggerHighF: parseInt(e.target.value)
                        }
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 block">Ramps speed to exhaust excess heat to lung room</span>
                </div>

                {/* High RH Trigger */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                      High Humidity Trigger
                    </span>
                    <span className="font-mono font-bold text-cyan-400">{triggers.rhTriggerHigh ?? 68}% RH</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="98"
                    value={triggers.rhTriggerHigh ?? 68}
                    onChange={e => {
                      onUpdateItem({
                        ...eq,
                        autoTriggers: {
                          ...triggers,
                          rhTriggerHigh: parseInt(e.target.value)
                        }
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 block">Exhausts wet air if canopy exceeds ceiling limit</span>
                </div>

                {/* Low RH Floor Protection */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                      Low RH Safeguard Floor
                    </span>
                    <span className="font-mono font-bold text-teal-400">{triggers.rhTriggerLow ?? 45}% RH</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="90"
                    value={triggers.rhTriggerLow ?? 45}
                    onChange={e => {
                      onUpdateItem({
                        ...eq,
                        autoTriggers: {
                          ...triggers,
                          rhTriggerLow: parseInt(e.target.value)
                        }
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-teal-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 block">Throttles fan down if tent is dry to prevent desiccation</span>
                </div>

                {/* High CO2 Trigger (FAE for mushrooms) */}
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5 text-purple-400" />
                      High CO₂ FAE Trigger
                    </span>
                    <span className="font-mono font-bold text-purple-400">{triggers.co2TriggerHighPpm ?? 950} PPM</span>
                  </div>
                  <input
                    type="range"
                    min="600"
                    max="2000"
                    step="50"
                    value={triggers.co2TriggerHighPpm ?? 950}
                    onChange={e => {
                      onUpdateItem({
                        ...eq,
                        autoTriggers: {
                          ...triggers,
                          co2TriggerHighPpm: parseInt(e.target.value)
                        }
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 block">Evacuates heavy CO2 to trigger healthy mushroom pinheads</span>
                </div>
              </div>

              {/* Speed Bounds */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Idle Min Speed</span>
                    <span className="font-mono font-bold text-zinc-200">{triggers.minSpeedPercent ?? 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={triggers.minSpeedPercent ?? 0}
                    onChange={e => {
                      onUpdateItem({
                        ...eq,
                        autoTriggers: {
                          ...triggers,
                          minSpeedPercent: parseInt(e.target.value)
                        }
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Max Speed Ceiling</span>
                    <span className="font-mono font-bold text-zinc-200">{triggers.maxSpeedPercent ?? eq.setting}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={triggers.maxSpeedPercent ?? eq.setting}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      onUpdateItem({
                        ...eq,
                        setting: val,
                        autoTriggers: {
                          ...triggers,
                          maxSpeedPercent: val
                        }
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CYCLE TIMER CONTROLS */}
          {currentMode === 'cycle' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div>
                <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-emerald-400" />
                  Intermittent FAE Cycle Timing
                </h5>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Runs for X minutes every Y minutes to refresh oxygen without exhausting humidity.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Run Duration (Mins)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={triggers.cycleOnMinutes ?? 3}
                    onChange={e => {
                      onUpdateItem({
                        ...eq,
                        autoTriggers: {
                          ...triggers,
                          cycleOnMinutes: Math.max(1, parseInt(e.target.value) || 1)
                        }
                      }, selectedParentTentId);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>

                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Pause Interval (Mins)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={triggers.cycleOffMinutes ?? 15}
                    onChange={e => {
                      onUpdateItem({
                        ...eq,
                        autoTriggers: {
                          ...triggers,
                          cycleOffMinutes: Math.max(1, parseInt(e.target.value) || 1)
                        }
                      }, selectedParentTentId);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>

                <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Pulse Speed Setting</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={eq.setting}
                      onChange={e => {
                        onUpdateItem({
                          ...eq,
                          setting: parseInt(e.target.value)
                        }, selectedParentTentId);
                      }}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-emerald-400">{eq.setting}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MANUAL SPEED SLIDER */}
          {currentMode === 'manual' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Fixed Manual Fan Speed</span>
                <span className="font-mono font-bold text-emerald-400">{eq.setting}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={eq.setting}
                onChange={e => {
                  onUpdateItem({
                    ...eq,
                    setting: parseInt(e.target.value)
                  }, selectedParentTentId);
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-zinc-500 block">
                Runs continuously at this fixed percentage without automatic sensor modulation.
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

import React from 'react';
import { Sun, Clock } from 'lucide-react';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const GrowLightControls: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq' | 'formatHour' | 'dayLength' | 'nightLength'>> = (props) => {
  const { selectedParentTentId, onUpdateItem, eq, formatHour, dayLength, nightLength } = props;

  return (
    <>
      {/* 1. GROW LIGHT PHOTOPERIOD & DIMMER CONTROLS */}
      {eq.type === 'grow_light' && (
        <div className="space-y-4">
          {/* Master Dimming Slider */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs text-zinc-200">
              <span className="font-semibold flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                LED Intensity Dimmer
              </span>
              <span className="font-mono font-bold text-amber-400">{eq.setting}%</span>
            </div>
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
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>Low Propagation (20-40%)</span>
              <span>Vegetative (50-70%)</span>
              <span>Peak Bloom (80-100%)</span>
            </div>
          </div>

          {/* Fully Editable Schedule Controls */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Light Photoperiod Schedule</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateItem({
                      ...eq,
                      schedule: {
                        enabled: !(eq.schedule?.enabled ?? true),
                        onHour: eq.schedule?.onHour ?? 6,
                        offHour: eq.schedule?.offHour ?? 0
                      }
                    }, selectedParentTentId);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                            (eq.schedule?.enabled ?? true)
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                >
                  {(eq.schedule?.enabled ?? true) ? 'Schedule: ACTIVE' : 'Schedule: 24/0 ALWAYS ON'}
                </button>
              </div>
            </div>

            {(eq.schedule?.enabled ?? true) && (
              <div className="space-y-3 pt-1">
                {/* Day/Night Ratio Badge */}
                <div className="flex items-center justify-between bg-zinc-950/70 border border-zinc-800 rounded-lg p-2.5 text-xs">
                  <span className="text-zinc-400">Calculated Photoperiod:</span>
                  <span className="font-mono font-bold text-amber-300">
                    ☀️ {dayLength}h DAY / 🌙 {nightLength}h NIGHT
                  </span>
                </div>

                {/* Exact On / Off Hour Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                      <span>Light Turn-ON Time</span>
                    </label>
                    <select
                      value={eq.schedule?.onHour ?? 6}
                      onChange={e => {
                        const newOn = parseInt(e.target.value);
                        onUpdateItem({
                          ...eq,
                          schedule: {
                            enabled: true,
                            onHour: newOn,
                            offHour: eq.schedule?.offHour ?? 0
                          }
                        }, selectedParentTentId);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {formatHour(i)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                      <span>Light Turn-OFF Time</span>
                    </label>
                    <select
                      value={eq.schedule?.offHour ?? 0}
                      onChange={e => {
                        const newOff = parseInt(e.target.value);
                        onUpdateItem({
                          ...eq,
                          schedule: {
                            enabled: true,
                            onHour: eq.schedule?.onHour ?? 6,
                            offHour: newOff
                          }
                        }, selectedParentTentId);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {formatHour(i)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">Quick Presets:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: '18/6 Veg', on: 6, off: 0 },
                      { label: '12/12 Bloom', on: 8, off: 20 },
                      { label: '20/4 Auto', on: 4, off: 0 },
                      { label: '10/14 Ripen', on: 9, off: 19 },
                      { label: '12/12 Myco', on: 7, off: 19 },
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          onUpdateItem({
                            ...eq,
                            schedule: { enabled: true, onHour: preset.on, offHour: preset.off }
                          }, selectedParentTentId);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                                  eq.schedule?.enabled && eq.schedule.onHour === preset.on && eq.schedule.offHour === preset.off
                                    ? 'bg-amber-500 text-black font-bold'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
                                }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

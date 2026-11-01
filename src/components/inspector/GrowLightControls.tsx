import React from 'react';
import { Sun, Clock, Moon } from 'lucide-react';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const GrowLightControls: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq' | 'formatHour' | 'dayLength' | 'nightLength'>> = (props) => {
  const { selectedParentTentId, onUpdateItem, eq, formatHour, dayLength, nightLength } = props;

  const isTimerActive = eq.schedule?.enabled ?? true;
  const isScheduleDisabledOff = !isTimerActive && eq.schedule?.disabledState !== 'on';
  const isScheduleDisabledAlwaysOn = !isTimerActive && eq.schedule?.disabledState === 'on';

  return (
    <>
      {/* 1. GROW LIGHT PHOTOPERIOD & DIMMER CONTROLS */}
      {eq.type === 'grow_light' && (
        <div className="space-y-4">
          {!eq.powerOn && (
            <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-200">
              <Moon className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Light is Powered OFF:</strong> The fixture is unpowered. To keep the light powered and installed but disable its schedule, use the Photoperiod Schedule modes below.
              </span>
            </div>
          )}

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Photoperiod Schedule</span>
              </div>
              
              {/* 3-Mode Segmented Control */}
              <div className="flex flex-wrap items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateItem({
                      ...eq,
                      schedule: {
                        enabled: true,
                        disabledState: 'off',
                        onHour: eq.schedule?.onHour ?? 6,
                        offHour: eq.schedule?.offHour ?? 0
                      }
                    }, selectedParentTentId);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                    isTimerActive
                      ? 'bg-amber-500 text-zinc-950 shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                  }`}
                  title="Run photoperiod schedule automatically"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Timer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateItem({
                      ...eq,
                      schedule: {
                        enabled: false,
                        disabledState: 'off',
                        onHour: eq.schedule?.onHour ?? 6,
                        offHour: eq.schedule?.offHour ?? 0
                      }
                    }, selectedParentTentId);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                    isScheduleDisabledOff
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                  }`}
                  title="Disable schedule so light stays off (ideal for germination)"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Disabled (Off)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateItem({
                      ...eq,
                      schedule: {
                        enabled: false,
                        disabledState: 'on',
                        onHour: eq.schedule?.onHour ?? 6,
                        offHour: eq.schedule?.offHour ?? 0
                      }
                    }, selectedParentTentId);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                    isScheduleDisabledAlwaysOn
                      ? 'bg-amber-950 text-amber-300 border border-amber-700/60 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                  }`}
                  title="Continuous light 24 hours a day"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>24/0 Always On</span>
                </button>
              </div>
            </div>

            {/* Banner when Schedule is Disabled (Off) */}
            {isScheduleDisabledOff && (
              <div className="bg-indigo-950/40 border border-indigo-600/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-200">
                <Moon className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-indigo-100 flex items-center gap-2">
                    <span>Schedule Disabled: Light Kept Off</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                      0 PPFD • DARK
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-300/80 leading-relaxed">
                    The fixture is installed and ready, but its schedule is disabled so it will not turn on while seeds are germinating. Your saved timer ({formatHour(eq.schedule?.onHour ?? 6)} to {formatHour(eq.schedule?.offHour ?? 0)}) will resume immediately once you switch back to <strong>Timer</strong> or click a preset below.
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateItem({
                          ...eq,
                          schedule: {
                            enabled: true,
                            disabledState: 'off',
                            onHour: eq.schedule?.onHour ?? 6,
                            offHour: eq.schedule?.offHour ?? 0
                          }
                        }, selectedParentTentId);
                      }}
                      className="text-[11px] font-mono text-indigo-200 underline hover:text-white"
                    >
                      ▶ Re-enable Timer Schedule
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Banner when Schedule is 24/0 Continuous */}
            {isScheduleDisabledAlwaysOn && (
              <div className="bg-amber-950/30 border border-amber-600/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
                <Sun className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-amber-100 flex items-center gap-2">
                    <span>Schedule Disabled: 24/0 Continuous Light</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                      24h DAYLIGHT
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">
                    Timer is bypassed. The fixture runs 24 hours a day at {eq.setting}% intensity.
                  </p>
                </div>
              </div>
            )}

            {/* Timer Settings */}
            <div className={`space-y-3 pt-1 transition-opacity ${!isTimerActive ? 'opacity-85' : ''}`}>
              {/* Day/Night Ratio Badge */}
              <div className="flex items-center justify-between bg-zinc-950/70 border border-zinc-800 rounded-lg p-2.5 text-xs">
                <span className="text-zinc-400">
                  {isTimerActive ? 'Active Photoperiod:' : isScheduleDisabledOff ? 'Saved Timer (Currently Idle):' : 'Active Photoperiod:'}
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {isScheduleDisabledOff ? (
                    <span className="text-indigo-300">🌑 0h LIGHT / 24h DARK (Timer: {dayLength}h / {nightLength}h)</span>
                  ) : isScheduleDisabledAlwaysOn ? (
                    <span>☀️ 24h LIGHT / 0h DARK</span>
                  ) : (
                    <span>☀️ {dayLength}h DAY / 🌙 {nightLength}h NIGHT</span>
                  )}
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
                          enabled: isTimerActive,
                          disabledState: eq.schedule?.disabledState ?? 'off',
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
                          enabled: isTimerActive,
                          disabledState: eq.schedule?.disabledState ?? 'off',
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
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">
                  Quick Presets {isScheduleDisabledOff ? '(Clicking activates Timer mode)' : ''}:
                </span>
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
                          schedule: { enabled: true, disabledState: 'off', onHour: preset.on, offHour: preset.off }
                        }, selectedParentTentId);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                                isTimerActive && eq.schedule?.onHour === preset.on && eq.schedule?.offHour === preset.off
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
          </div>
        </div>
      )}
    </>
  );
};

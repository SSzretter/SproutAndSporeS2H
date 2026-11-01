import React from 'react';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const Co2HeaterControls: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { selectedParentTentId, onUpdateItem, eq } = props;

  return (
    <>
      {/* 4. CO2 REGULATOR SOLENOID CONTROLS */}
      {eq.type === 'co2_regulator' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Target CO₂ Enriched Level</span>
            <span className="font-mono font-bold text-purple-400">{eq.targetCo2Ppm ?? 1200} PPM</span>
          </div>
          <input
            type="range"
            min="400"
            max="2000"
            step="50"
            value={eq.targetCo2Ppm ?? 1200}
            onChange={e => {
              onUpdateItem({
                ...eq,
                targetCo2Ppm: parseInt(e.target.value)
              }, selectedParentTentId);
            }}
            className="w-full accent-purple-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>Atmospheric Clean Air (420)</span>
            <span>High PPFD Bloom (1200-1500)</span>
          </div>
          <div className="text-[10px] text-indigo-400/90 font-mono pt-1">
            🔒 Interlock Active: Solenoid automatically pauses exhaust fan while injecting to retain bottled CO₂ gas.
          </div>
        </div>
      )}

      {/* 5. HEATER THERMOSTAT */}
      {eq.type === 'heater' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Thermostat Target Temperature</span>
            <span className="font-mono font-bold text-amber-400">{eq.targetTempF ?? 74}°F</span>
          </div>
          <input
            type="range"
            min="60"
            max="90"
            value={eq.targetTempF ?? 74}
            onChange={e => {
              onUpdateItem({
                ...eq,
                targetTempF: parseInt(e.target.value)
              }, selectedParentTentId);
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>Cool Night (65°F)</span>
            <span>Comfort (72-76°F)</span>
            <span>Warm (82°F)</span>
          </div>
        </div>
      )}
    </>
  );
};

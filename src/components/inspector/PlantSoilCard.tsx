import React from 'react';
import { Layers } from 'lucide-react';
import type { ItemSectionProps, PlantLocals } from './types';

export const PlantSoilCard: React.FC<ItemSectionProps & Pick<PlantLocals, 'plant'>> = (props) => {
  const { selectedParentTentId, onLogJournalEntry, onUpdateItem, plant } = props;

  return (
    <>
      {/* 4. Soil & Hydroponic Dynamics */}
      <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span>Soil &amp; Hydroponic Substrate Dynamics</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-emerald-300">
                  {plant.containerVolumeGallons || 5} Gal · {(plant.containerType || 'fabric_pot').replace(/_/g, ' ')}
                </span>
              </h4>
              <p className="text-[11px] text-zinc-400">
                Medium: <span className="text-zinc-200 capitalize">{(plant.growingMedium || 'living_organic_soil').replace(/_/g, ' ')}</span> · 
                System: <span className="text-zinc-200 capitalize">{(plant.systemType || 'soil_container').replace(/_/g, ' ')}</span> · 
                Nutrients: <span className="text-zinc-200 capitalize">{(plant.nutrientProgram || 'organic_living_soil').replace(/_/g, ' ')}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Soil / Reservoir pH */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Substrate pH</span>
              <span className={`font-mono font-bold text-sm ${
                        (plant.soilPh || 6.4) >= 6.0 && (plant.soilPh || 6.4) <= 6.8
                          ? 'text-emerald-400'
                          : (plant.soilPh || 6.4) >= 5.5 && (plant.soilPh || 6.4) <= 7.2
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }`}>
                {(plant.soilPh || 6.4).toFixed(2)} pH
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Target: {(plant.growingMedium || '').includes('soil') || (plant.growingMedium || '').includes('loam') ? '6.0 - 6.8 (Soil)' : '5.5 - 6.3 (Hydro)'}
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const newPh = Math.max(4.5, Number(((plant.soilPh || 6.4) - 0.2).toFixed(2)));
                  onUpdateItem({ ...plant, soilPh: newPh }, selectedParentTentId);
                  onLogJournalEntry?.({
                    title: `🧪 Adjusted pH Down: ${plant.name}`,
                    message: `Applied citric acid / pH Down. Medium pH adjusted to ${newPh}.`,
                    type: 'action',
                    category: 'care'
                  });
                }}
                className="flex-1 py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-amber-300"
              >
                -0.2 (Down)
              </button>
              <button
                type="button"
                onClick={() => {
                  const newPh = Math.min(8.5, Number(((plant.soilPh || 6.4) + 0.2).toFixed(2)));
                  onUpdateItem({ ...plant, soilPh: newPh }, selectedParentTentId);
                  onLogJournalEntry?.({
                    title: `🧪 Adjusted pH Up: ${plant.name}`,
                    message: `Applied potassium bicarbonate / pH Up. Medium pH adjusted to ${newPh}.`,
                    type: 'action',
                    category: 'care'
                  });
                }}
                className="flex-1 py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-cyan-300"
              >
                +0.2 (Up)
              </button>
            </div>
          </div>

          {/* EC / TDS Nutrient Strength */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400">
              <span>EC / Nutrient PPM</span>
              <span className="font-mono font-bold text-sm text-emerald-400">
                {Math.round(plant.ecTdsPpm || 850)} PPM
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">
              EC: {((plant.ecTdsPpm || 850) / 500).toFixed(2)} mS/cm · ~{((plant.ecTdsPpm || 850) * 0.7).toFixed(0)} TDS
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const newEc = Math.min(2200, Math.round((plant.ecTdsPpm || 850) + 250));
                  onUpdateItem({ ...plant, ecTdsPpm: newEc, lastFedTime: Date.now() }, selectedParentTentId);
                  onLogJournalEntry?.({
                    title: `🧪 Fed Nutrients: ${plant.name}`,
                    message: `Dosed nutrient reservoir (+250 PPM). Live EC now ${newEc} PPM.`,
                    type: 'action',
                    category: 'care'
                  });
                }}
                className="flex-1 py-1 px-1.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/60 text-[10px] font-mono text-emerald-300"
              >
                +250 Feed
              </button>
              <button
                type="button"
                onClick={() => {
                  const newEc = Math.max(150, Math.round((plant.ecTdsPpm || 850) - 350));
                  onUpdateItem({ ...plant, ecTdsPpm: newEc, soilMoisture: Math.min(95, plant.soilMoisture + 15) }, selectedParentTentId);
                  onLogJournalEntry?.({
                    title: `💧 Flushed Substrate: ${plant.name}`,
                    message: `Flushed root zone with fresh water (-350 PPM). EC reduced to ${newEc} PPM.`,
                    type: 'action',
                    category: 'care'
                  });
                }}
                className="flex-1 py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300"
              >
                Flush
              </button>
            </div>
          </div>

          {/* Microbial Soil Biology */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Microbial Health</span>
              <span className="font-mono font-bold text-sm text-teal-400">
                {Math.round(plant.microbialHealth || 85)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-teal-400 rounded-full" 
                style={{ width: `${Math.min(100, plant.microbialHealth || 85)}%` }} 
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onUpdateItem({ 
                  ...plant, 
                  microbialHealth: Math.min(100, (plant.microbialHealth || 80) + 20),
                  soilPh: Number(Math.max(6.2, Math.min(6.6, plant.soilPh || 6.4)).toFixed(2))
                }, selectedParentTentId);
                onLogJournalEntry?.({
                  title: `🧫 Inoculated Compost Tea: ${plant.name}`,
                  message: `Drenched root zone with aerated compost tea. Mycorrhizae & rhizobacteria replenished.`,
                  type: 'action',
                  category: 'care'
                });
              }}
              className="w-full py-1 rounded bg-teal-950/70 hover:bg-teal-900 border border-teal-800/60 text-[10px] font-mono text-teal-300 mt-1"
            >
              + Drench Compost Tea
            </button>
          </div>

          {/* Root Aeration & Dissolved Oxygen */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Root Aeration / DO</span>
              <span className="font-mono font-bold text-sm text-cyan-400">
                {Math.round(plant.aerationOxygenPct || 75)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 rounded-full" 
                style={{ width: `${Math.min(100, plant.aerationOxygenPct || 75)}%` }} 
              />
            </div>
            <div className="text-[10px] text-zinc-400 pt-1">
              {(plant.containerType === 'fabric_pot' || plant.systemType === 'dwc' || plant.systemType === 'aeroponics')
                ? 'High air-pruning & oxygenated roots'
                : 'Standard drainage root zone'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

import React from 'react';
import { Flower2, Droplets, Scissors, Award, Sparkles, Play } from 'lucide-react';
import { PlantItem } from '../../types/sim';
import type { ItemSectionProps, PlantLocals } from './types';

export const PlantVigorCard: React.FC<ItemSectionProps & Pick<PlantLocals, 'plant' | 'isSeed'>> = (props) => {
  const { selectedParentTentId, onLogJournalEntry, onUpdateItem, onHarvestPlant, setShow3dGrowthTimelapse, currentTent, plant, isSeed } = props;

  return (
    <>
      {/* 1. Botanical Vigor & Root Telemetry Card */}
      <div className="bg-zinc-950/80 border border-emerald-950 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Flower2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span>{plant.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-normal">
                  {isSeed ? '🌱 From Seed' : '✂️ From Cutting'}
                </span>
              </h4>
              <span className="text-[11px] text-zinc-400">
                {plant.species} · {plant.strainName} · Age: {plant.ageDays.toFixed(1)} Days
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShow3dGrowthTimelapse(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/50 cursor-pointer"
              title="Watch interactive 3D lifecycle growth timelapse matching 3D game view"
            >
              <Play className="w-3.5 h-3.5 fill-current text-emerald-200" />
              <span>Watch Lifecycle Growth</span>
            </button>
            <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
              {plant.stage.replace('_', ' ')} ({plant.stageProgress.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Meters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Plant Health</span>
              <span className="font-mono font-bold text-emerald-400">{plant.health}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                          plant.health > 80 ? 'bg-emerald-500' : plant.health > 50 ? 'bg-amber-500' : 'bg-rose-500'
                        }`} 
                style={{ width: `${plant.health}%` }} 
              />
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              {plant.health > 85 ? 'Vigorous cellular respiration' : 'Slight stress detected'}
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Soil Moisture</span>
              <span className="font-mono font-bold text-cyan-400">{plant.soilMoisture.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 rounded-full transition-all"
                style={{ width: `${plant.soilMoisture}%` }} 
              />
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              {plant.soilMoisture < 25 ? '⚠️ Soil dry! Water required' : 'Optimal root zone hydration'}
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Root Zone Temp</span>
              <span className="font-mono font-bold text-amber-400">
                {plant.rootTempF ? `${plant.rootTempF.toFixed(1)}°F` : '68.0°F'}
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${Math.max(10, Math.min(100, ((plant.rootTempF || 68) - 50) * 2.5))}%` }} 
              />
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 block">
              {(plant.rootTempF || 68) >= 65 && (plant.rootTempF || 68) <= 76 
                ? '✓ Ideal nutrient absorption' 
                : (plant.rootTempF || 68) < 65 
                  ? '❄ Chilly root zone' 
                  : '▲ Warm root zone'}
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>CO₂ Photosynthesis</span>
              <span className="font-mono font-bold text-emerald-400">
                {currentTent?.climate.co2Ppm ? `${currentTent.climate.co2Ppm} PPM` : 'Enriched'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-emerald-300 mt-1">
              {(currentTent?.climate.co2Ppm || 1000) >= 1000 
                ? '🚀 +25% Supercharged Growth' 
                : (currentTent?.climate.co2Ppm || 600) < 400 
                  ? '⚠️ Stomata CO₂ Depletion' 
                  : 'Standard Atmospheric'}
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Yield: {plant.yieldPotentialGrams.toFixed(0)}g
            </span>
          </div>
        </div>

        {/* Interactive Crop Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              onUpdateItem({
                ...plant,
                soilMoisture: Math.min(95, plant.soilMoisture + 35),
                rootTempF: Math.max(65, ((plant as PlantItem).rootTempF || 70) - 2.5),
                health: Math.min(100, plant.health + 5),
                lastWateredTime: Date.now()
              }, selectedParentTentId);
              onLogJournalEntry?.({
                title: `💧 Watered ${plant.name}`,
                message: `Hydrated root zone (+35% moisture). Soil moisture restored to ${Math.min(100, plant.soilMoisture + 35)}%.`,
                type: 'action',
                category: 'care'
              });
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-medium transition-all shadow-md shadow-cyan-950/40"
          >
            <Droplets className="w-4 h-4" />
            <span>Water Pot &amp; Cool Roots (+35%)</span>
          </button>

          <button
            onClick={() => {
              onUpdateItem({
                ...plant,
                soilMoisture: Math.min(95, plant.soilMoisture + 20),
                nutrientLevel: 'balanced',
                health: Math.min(100, plant.health + 8),
              }, selectedParentTentId);
              onLogJournalEntry?.({
                title: `🧪 Fed Nutrients: ${plant.name}`,
                message: `Applied balanced nutrition formula and microelements. Vitality reinforced.`,
                type: 'action',
                category: 'care'
              });
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-md shadow-emerald-950/40"
          >
            <Sparkles className="w-4 h-4" />
            <span>Feed Organic Nutrients</span>
          </button>

          <button
            onClick={() => {
              onUpdateItem({
                ...plant,
                canopyWidthInches: plant.canopyWidthInches + 2.5,
                yieldPotentialGrams: plant.yieldPotentialGrams + 15,
              }, selectedParentTentId);
              onLogJournalEntry?.({
                title: `✂️ Pruned Canopy: ${plant.name}`,
                message: `Trimmed foliage to improve light penetration and airflow through inner canopy.`,
                type: 'action',
                category: 'care'
              });
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
          >
            <Scissors className="w-4 h-4 text-amber-400" />
            <span>Prune / Top Canopy</span>
          </button>

          <button
            onClick={() => {
              onHarvestPlant(plant, currentTent?.id);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                      plant.stage === 'ready' || plant.stage === 'ripening'
                        ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-950/50 animate-pulse'
                        : 'bg-zinc-800 hover:bg-amber-950/60 hover:text-amber-300 text-zinc-400 border border-zinc-700'
                    }`}
          >
            <Award className="w-4 h-4" />
            <span>Harvest Crop ({plant.yieldPotentialGrams.toFixed(0)}g)</span>
          </button>
        </div>
      </div>
    </>
  );
};

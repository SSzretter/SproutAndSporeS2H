import React from 'react';
import { Sprout, Wind, Droplets, Check, Award, Sparkles, Activity, Dna, FlaskConical, Play } from 'lucide-react';
import { MushroomItem } from '../../types/sim';
import { generateSporeTraits, getGeneticTier, SporeGeneticTraits } from '../../utils/genetics';
import type { ItemSectionProps } from './types';

export const MushroomCard: React.FC<ItemSectionProps> = (props) => {
  const { selectedParentTentId, onLogJournalEntry, onUpdateItem, onHarvestMushroom, setShow3dGrowthTimelapse, currentTent, currentItem } = props;

  return (
    <>
      {currentItem.category === 'mushroom' && (
        <div className="bg-zinc-950/80 border border-amber-950 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-amber-400" />
              <h4 className="text-sm font-bold text-zinc-100">Mycology Substrate, Respiration &amp; FAE</h4>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShow3dGrowthTimelapse(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-950/50 cursor-pointer"
                title="Watch interactive 3D lifecycle growth timelapse matching 3D game view"
              >
                <Play className="w-3.5 h-3.5 fill-current text-amber-200" />
                <span>Watch Lifecycle Growth</span>
              </button>
              <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                Stage: {currentItem.stage} ({currentItem.stageProgress.toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Meters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Mycelium Colonization</span>
                <span className="font-mono font-bold text-amber-400">{currentItem.myceliumColonization}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-400 rounded-full" 
                  style={{ width: `${currentItem.myceliumColonization}%` }} 
                />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Substrate Moisture</span>
                <span className="font-mono font-bold text-cyan-400">{currentItem.substrateMoisture.toFixed(0)}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 rounded-full" 
                  style={{ width: `${currentItem.substrateMoisture}%` }} 
                />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Fungal Respiration CO₂</span>
                <span className="font-mono font-bold text-indigo-400">
                  {currentTent?.climate.co2Ppm || 820} PPM
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 block mt-1">
                {currentItem.stage === 'colonizing' ? 'High CO₂ ideal for spawn' : 'Needs FAE (<1000 PPM) for caps'}
              </span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Flush Yield</span>
                <span className="font-mono font-bold text-emerald-400">{currentItem.yieldPotentialGrams.toFixed(0)} g</span>
              </div>
              <span className="text-xs font-mono text-zinc-300 mt-1 block">
                Container: {currentItem.containerType} · Flush #{currentItem.flushCount}
              </span>
            </div>
          </div>

          {/* Interactive Shroom Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                onUpdateItem({
                  ...currentItem,
                  substrateMoisture: Math.min(95, currentItem.substrateMoisture + 25),
                  health: Math.min(100, currentItem.health + 6),
                  lastMistedTime: Date.now()
                }, selectedParentTentId);
                onLogJournalEntry?.({
                  title: `💨 Misted Substrate: ${currentItem.name}`,
                  message: `Provided surface micro-droplet misting. Substrate moisture refreshed to ${Math.min(95, currentItem.substrateMoisture + 25)}%.`,
                  type: 'action',
                  category: 'care'
                });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-medium transition-all shadow-md shadow-cyan-950/40"
            >
              <Droplets className="w-4 h-4" />
              <span>Mist Substrate (+25%)</span>
            </button>

            <button
              onClick={() => {
                onUpdateItem({
                  ...currentItem,
                  health: Math.min(100, currentItem.health + 5),
                  stageProgress: Math.min(100, currentItem.stageProgress + 10)
                }, selectedParentTentId);
                onLogJournalEntry?.({
                  title: `💨 Fresh Air Exchange: ${currentItem.name}`,
                  message: `Displaced stagnant CO2 build-up in mushroom chamber to promote healthy pin formation and cap development.`,
                  type: 'action',
                  category: 'care'
                });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
            >
              <Wind className="w-4 h-4 text-amber-400" />
              <span>Fan / FAE Pulse (Fresh Air Exchange)</span>
            </button>

            <button
              onClick={() => {
                onHarvestMushroom(currentItem as MushroomItem, currentTent?.id);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                  currentItem.stage === 'ready' || currentItem.stage === 'mature'
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-950/50 animate-pulse'
                    : 'bg-zinc-800 hover:bg-amber-950/60 hover:text-amber-300 text-zinc-400 border border-zinc-700'
                }`}
            >
              <Award className="w-4 h-4" />
              <span>Harvest Flush ({currentItem.yieldPotentialGrams.toFixed(0)}g)</span>
            </button>
          </div>

          {/* Spore Genetics & Inoculant Trait Profile Card */}
          {(() => {
            const sporeTraits = currentItem.traits || generateSporeTraits(currentItem.species, currentItem.strainName);
            const sporeTier = getGeneticTier(sporeTraits.colonizationVigor, sporeTraits.viabilityPct, sporeTraits.flushYieldMultiplier);

            return (
              <div className="bg-gradient-to-r from-amber-950/30 via-zinc-950 to-zinc-950 border border-amber-800/60 rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-amber-900/40 pb-3 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <Dna className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-amber-200">
                          Spore Inoculant Genetics &amp; Hyphal Vigor
                        </h4>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${sporeTier.badgeColor}`}>
                          Tier {sporeTier.tier} · {sporeTier.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300/70 font-mono">
                        Inoculant: <span className="text-zinc-200">{sporeTraits.inoculantType}</span> · Batch: <span className="text-zinc-200">{sporeTraits.sporeBatchId}</span> · Grade: <span className="text-zinc-200">{sporeTraits.inoculantGrade}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {sporeTraits.sporeViabilityOutcome === 'failed' ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-700 text-xs font-bold">
                        <span>❌ Inoculant Stalled / Contaminated</span>
                      </div>
                    ) : currentItem.stage === 'colonizing' ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-950 text-teal-300 border border-teal-700 text-xs font-bold">
                        <span>🍄 Anastomosing Mycelium ({sporeTraits.viabilityPct}% Viable)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-bold">
                        <Check className="w-3.5 h-3.5" />
                        <span>Fully Colonized &amp; Fruiting</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Viability Gauge */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      Spore Germination Viability Rating
                    </span>
                    <span className="font-mono font-bold text-amber-300">
                      {sporeTraits.viabilityPct}% Spore Viability
                    </span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                          sporeTraits.viabilityPct >= 90 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                          sporeTraits.viabilityPct >= 75 ? 'bg-gradient-to-r from-teal-500 to-amber-400' :
                          'bg-gradient-to-r from-amber-500 to-rose-500'
                        }`}
                      style={{ width: `${sporeTraits.viabilityPct}%` }}
                    />
                  </div>
                </div>

                {/* Genetic Traits Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Colonization Vigor</span>
                    <div className={`font-mono font-bold text-sm ${sporeTraits.colonizationVigor >= 1.15 ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {sporeTraits.colonizationVigor.toFixed(2)}x
                    </div>
                    <span className="text-[10px] text-zinc-500 block">
                      Substrate run speed
                    </span>
                  </div>

                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Pinning Density</span>
                    <div className="font-mono font-bold text-sm text-amber-300 uppercase">
                      {sporeTraits.pinningDensity}
                    </div>
                    <span className="text-[10px] text-zinc-500 block">
                      Primordia cluster count
                    </span>
                  </div>

                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Flush Yield Multiplier</span>
                    <div className={`font-mono font-bold text-sm ${sporeTraits.flushYieldMultiplier >= 1.15 ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {sporeTraits.flushYieldMultiplier.toFixed(2)}x
                    </div>
                    <span className="text-[10px] text-zinc-500 block">
                      Fruiting body biomass
                    </span>
                  </div>

                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Contam Defense</span>
                    <div className={`font-mono font-bold text-sm uppercase ${
                        sporeTraits.contaminationResistance === 'impervious' ? 'text-emerald-400' :
                        sporeTraits.contaminationResistance === 'aggressive' ? 'text-teal-300' : 'text-amber-400'
                      }`}>
                      {sporeTraits.contaminationResistance}
                    </div>
                    <span className="text-[10px] text-zinc-500 block">
                      Mold &amp; trichoderma defense
                    </span>
                  </div>

                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">CO₂ Tolerance</span>
                    <div className="font-mono font-bold text-sm text-zinc-200">
                      {sporeTraits.co2Tolerance.toFixed(2)}x
                    </div>
                    <span className="text-[10px] text-zinc-500 block">
                      FAE elasticity floor
                    </span>
                  </div>
                </div>

                {/* Phenotype Description */}
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-900/40 text-amber-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-amber-200 block">
                      Mycelial Phenotype: {sporeTraits.phenotypeName}
                    </span>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Spore inoculation delivers natural genetic variability. This isolate displays 
                      <strong className="text-zinc-200"> {sporeTraits.colonizationVigor}x</strong> hyphal network expansion and 
                      <strong className="text-zinc-200"> {sporeTraits.pinningDensity}</strong> cluster formation.
                    </p>
                  </div>
                </div>

                {/* Inoculant Actions */}
                <div className="pt-2 border-t border-amber-900/30 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-amber-300 text-[11px] font-semibold">Mycology Interventions:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated: SporeGeneticTraits = {
                        ...sporeTraits,
                        colonizationVigor: parseFloat((sporeTraits.colonizationVigor + 0.12).toFixed(2)),
                        sporeViabilityOutcome: 'germinated'
                      };
                      onUpdateItem({
                        ...currentItem,
                        traits: updated,
                        health: Math.min(100, currentItem.health + 8)
                      }, selectedParentTentId);
                      onLogJournalEntry?.({
                        title: `🧪 Injected Liquid Culture: ${currentItem.name}`,
                        message: `Dosed substrate with vigorous isolated mycelium liquid culture booster (+12% vigor).`,
                        type: 'action',
                        category: 'care'
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700/60 transition-colors flex items-center gap-1.5"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-amber-300" />
                    <span>Liquid Culture Booster (+12% Vigor)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const fresh = generateSporeTraits(currentItem.species, currentItem.strainName, 'Isolated Commercial LC');
                      onUpdateItem({
                        ...currentItem,
                        stageProgress: 0,
                        health: 98,
                        substrateMoisture: 88,
                        myceliumColonization: 15,
                        traits: fresh
                      }, selectedParentTentId);
                      onLogJournalEntry?.({
                        title: `🍄 Re-Inoculated: ${currentItem.name}`,
                        message: `Inoculated fresh isolated spore culture (Batch #${fresh.sporeBatchId}, ${fresh.viabilityPct}% viability).`,
                        type: 'action',
                        category: 'care'
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                  >
                    Re-Inoculate Fresh Spores
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
};

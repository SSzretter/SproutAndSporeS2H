import React from 'react';
import { Box, Thermometer, Check, Sparkles, Activity, Dna, FlaskConical, Pencil } from 'lucide-react';
import { CommitNumberInput } from '../CommitNumberInput';
import { generateSeedTraits, getGeneticTier, SeedGeneticTraits } from '../../utils/genetics';
import { getHeatMatsFor } from '../../utils/equipmentLinks';
import type { ItemSectionProps, PlantLocals } from './types';

// Root-zone temperature that sprouts most seeds fastest
const SEED_ROOT_TEMP_F = 82;

// Editable genetic multipliers: [trait, label, what it drives in the simulation]
const MULTIPLIER_TRAITS: [keyof SeedGeneticTraits, string, string][] = [
  ['germinationVigor', 'Emergence Vigor', 'Germination / rooting speed'],
  ['growthRateMultiplier', 'Growth Rate', 'Stage speed after sprouting'],
  ['yieldMultiplier', 'Yield Capacity', 'Harvest mass'],
  ['nutrientEfficiency', 'Nutrient Efficiency', 'Feeding tolerance'],
  ['terpeneResinPotential', 'Resin / Terpenes', 'Aroma, oils, heat']
];
const RESISTANCE_LEVELS: SeedGeneticTraits['pestMoldResistance'][] = ['fragile', 'moderate', 'hardy', 'resilient'];

export const PlantGeneticsCard: React.FC<ItemSectionProps & Pick<PlantLocals, 'plant' | 'isSeed' | 'currentStageDays'>> = (props) => {
  const { room, selectedParentTentId, onLogJournalEntry, onUpdateItem, plant, isSeed, currentStageDays } = props;
  const [editingGenetics, setEditingGenetics] = React.useState(false);

  return (
    <>
      {/* 2. Seed / Cutting Genetics & Phenotypic Traits Card */}
      {(() => {
        const traits = plant.traits || generateSeedTraits(plant.species, plant.strainName, plant.propagationType);
        const tierInfo = getGeneticTier(traits.germinationVigor, traits.viabilityPct, traits.yieldMultiplier);
        const tent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
        const heatMats = getHeatMatsFor(plant, tent ? tent.items : room.items, tent?.id);
        const matsAtTarget = heatMats.every(m => m.powerOn && m.targetTempF === SEED_ROOT_TEMP_F);
        const rootTempF = plant.rootTempF ?? 0;
        const setTraits = (patch: Partial<SeedGeneticTraits>) =>
          onUpdateItem({ ...plant, traits: { ...traits, ...patch } }, selectedParentTentId);

        return (
          <div className="bg-gradient-to-r from-purple-950/30 via-zinc-950 to-zinc-950 border border-purple-800/60 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-purple-900/40 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <Dna className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-purple-200">
                      {isSeed ? 'Seed Genetics & Phenotypic Trait Variability' : 'Clone Lineage & Genetic Trait Profile'}
                    </h4>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${tierInfo.badgeColor}`}>
                      Tier {tierInfo.tier} · {tierInfo.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-300/70 font-mono">
                    Lineage: <span className="text-zinc-200">{traits.generation}</span> · Batch: <span className="text-zinc-200">{traits.seedId}</span> · Grade: <span className="text-zinc-200">{traits.seedGrade}</span>
                  </p>
                </div>
              </div>

              {/* Viability & Germination Status Banner */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGenetics(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    editingGenetics ? 'bg-purple-700 text-white border-purple-500' : 'bg-zinc-900 text-purple-300 border-purple-800/60 hover:bg-purple-950'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {editingGenetics ? 'Done' : 'Edit genetics'}
                </button>
                {traits.germinationOutcome === 'failed' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-700 text-xs font-bold">
                    <span>❌ Failed to Germinate</span>
                  </div>
                ) : traits.germinationOutcome === 'dormant' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-700 text-xs font-bold animate-pulse">
                    <span>⚠️ Dormant Embryo</span>
                  </div>
                ) : plant.stage === 'germination' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-950 text-teal-300 border border-teal-700 text-xs font-bold">
                    <span>🌱 Cracking Seed Coat ({traits.viabilityPct}% Viable)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-bold">
                    <Check className="w-3.5 h-3.5" />
                    <span>Viable Embryo Sprouted</span>
                  </div>
                )}
              </div>
            </div>

            {/* Failure Alert if any */}
            {traits.germinationOutcome === 'failed' && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold block text-rose-200">Embryo Viability Loss:</span>
                  <span>{traits.failureReason || 'Seed lacked sufficient vigor or rotted under adverse root conditions.'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newTraits = generateSeedTraits(plant.species, plant.strainName, plant.propagationType, 'Certified High-Viability');
                    onUpdateItem({
                      ...plant,
                      stage: 'germination',
                      stageProgress: 0,
                      currentStageDays: 0,
                      soilMoisture: 75,
                      rootTempF: 78,
                      health: 98,
                      traits: newTraits
                    }, selectedParentTentId);
                    onLogJournalEntry?.({
                      title: `🌱 Re-Seeded Container: ${plant.name}`,
                      message: `Planted fresh viable seed (Batch #${newTraits.seedId}, ${newTraits.viabilityPct}% viability).`,
                      type: 'action',
                      category: 'care'
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/40 transition-colors"
                >
                  🌱 Re-Seed Pot (Plant Fresh Seed)
                </button>
              </div>
            )}

            {/* Viability Gauge & Breakdown */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  Seed Embryo Viability Potential
                </span>
                <span className="font-mono font-bold text-purple-300">
                  {traits.viabilityPct}% Viability Rating
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                            traits.viabilityPct >= 90 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                            traits.viabilityPct >= 75 ? 'bg-gradient-to-r from-teal-500 to-amber-400' :
                            'bg-gradient-to-r from-amber-500 to-rose-500'
                          }`}
                  style={{ width: `${traits.viabilityPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                <span>Commercial standard: 85%</span>
                <span>{traits.viabilityPct >= 92 ? 'High-vigor certified germination' : traits.viabilityPct >= 75 ? 'Standard natural batch variability' : 'Marginal seed viability - warmth & care needed'}</span>
              </div>
            </div>

            {/* Genetic Trait Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
              {/* Germination Vigor */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                <span className="text-[10px] text-zinc-400 font-medium block">Emergence Vigor</span>
                <div className={`font-mono font-bold text-sm ${traits.germinationVigor >= 1.15 ? 'text-emerald-400' : traits.germinationVigor >= 0.95 ? 'text-teal-300' : 'text-amber-400'}`}>
                  {traits.germinationVigor.toFixed(2)}x
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  {traits.germinationVigor >= 1 ? `+${Math.round((traits.germinationVigor - 1) * 100)}% fast sprout` : `${Math.round((traits.germinationVigor - 1) * 100)}% slower sprout`}
                </span>
              </div>

              {/* Growth Rate */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                <span className="text-[10px] text-zinc-400 font-medium block">Growth Rate Pace</span>
                <div className={`font-mono font-bold text-sm ${traits.growthRateMultiplier >= 1.15 ? 'text-emerald-400' : traits.growthRateMultiplier >= 0.95 ? 'text-teal-300' : 'text-amber-400'}`}>
                  {traits.growthRateMultiplier.toFixed(2)}x
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  {traits.growthRateMultiplier >= 1 ? `+${Math.round((traits.growthRateMultiplier - 1) * 100)}% daily veg` : `${Math.round((traits.growthRateMultiplier - 1) * 100)}% compact veg`}
                </span>
              </div>

              {/* Yield Multiplier */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                <span className="text-[10px] text-zinc-400 font-medium block">Yield Capacity</span>
                <div className={`font-mono font-bold text-sm ${traits.yieldMultiplier >= 1.15 ? 'text-emerald-400' : traits.yieldMultiplier >= 0.95 ? 'text-teal-300' : 'text-amber-400'}`}>
                  {traits.yieldMultiplier.toFixed(2)}x
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  {traits.yieldMultiplier >= 1 ? `+${Math.round((traits.yieldMultiplier - 1) * 100)}% flower mass` : 'Standard harvest mass'}
                </span>
              </div>

              {/* Mold & Pest Defense */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                <span className="text-[10px] text-zinc-400 font-medium block">Stress &amp; Mold</span>
                <div className={`font-mono font-bold text-sm uppercase ${
                          traits.pestMoldResistance === 'resilient' ? 'text-emerald-400' :
                          traits.pestMoldResistance === 'hardy' ? 'text-teal-300' :
                          traits.pestMoldResistance === 'moderate' ? 'text-zinc-300' : 'text-rose-400'
                        }`}>
                  {traits.pestMoldResistance}
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  {traits.pestMoldResistance === 'resilient' ? 'High pathogen armor' : traits.pestMoldResistance === 'hardy' ? 'Good tolerance' : 'Sensitive to rot'}
                </span>
              </div>

              {/* Terpene / Secondary Metabolite Potential */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                <span className="text-[10px] text-zinc-400 font-medium block">Resin / Terpenes</span>
                <div className={`font-mono font-bold text-sm ${traits.terpeneResinPotential >= 1.15 ? 'text-purple-300' : 'text-zinc-200'}`}>
                  {traits.terpeneResinPotential.toFixed(2)}x
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  {plant.species === 'Hops' ? 'Alpha acids bonus' : plant.species === 'Chili Pepper' ? 'Capsaicin heat punch' : 'Trichome resin density'}
                </span>
              </div>
            </div>

            {/* Genetics editor: the values the simulation reads for this one plant */}
            {editingGenetics && (
              <div className="bg-zinc-900/90 border border-purple-800/50 rounded-xl p-3 space-y-2.5">
                <p className="text-[11px] text-zinc-400">
                  Multipliers are 1.00x for an average plant (seed packs roll about 0.80x to 1.30x). Changes apply to this plant right away.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-400 block">Viability %</span>
                    <CommitNumberInput
                      value={traits.viabilityPct}
                      min={1}
                      max={100}
                      integer
                      onCommit={v => setTraits({ viabilityPct: v })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 font-mono text-zinc-100"
                    />
                    <span className="text-[10px] text-zinc-500 block">Chance it sprouts</span>
                  </label>
                  {MULTIPLIER_TRAITS.map(([key, label, hint]) => (
                    <label key={key} className="space-y-1">
                      <span className="text-[10px] text-zinc-400 block">{label} (x)</span>
                      <CommitNumberInput
                        value={traits[key] as number}
                        min={0.5}
                        max={2}
                        step={0.01}
                        onCommit={v => setTraits({ [key]: parseFloat(v.toFixed(2)) })}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 font-mono text-zinc-100"
                      />
                      <span className="text-[10px] text-zinc-500 block">{hint}</span>
                    </label>
                  ))}
                  <label className="space-y-1">
                    <span className="text-[10px] text-zinc-400 block">Stress &amp; Mold</span>
                    <select
                      value={traits.pestMoldResistance}
                      onChange={e => setTraits({ pestMoldResistance: e.target.value as SeedGeneticTraits['pestMoldResistance'] })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-100 capitalize"
                    >
                      {RESISTANCE_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <span className="text-[10px] text-zinc-500 block">Pathogen tolerance</span>
                  </label>
                </div>
              </div>
            )}

            {/* Phenotypic Expression Box */}
            <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-900/40 text-purple-300 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <span className="font-bold text-purple-200 block">
                  Unique Phenotype: {traits.phenotypeName}
                </span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Just as in nature, this individual seed exhibits distinct genetic variance from other seeds in the batch. 
                  It carries a <strong className="text-zinc-200">{traits.growthRateMultiplier}x</strong> growth pace, 
                  <strong className="text-zinc-200"> {traits.pestMoldResistance}</strong> pathogen resistance, and 
                  <strong className="text-zinc-200"> {traits.terpeneResinPotential}x</strong> secondary metabolite accumulation potential.
                </p>
              </div>
            </div>

            {/* Cultivator Interventions for Seeds */}
            {plant.stage === 'germination' && (
              <div className="pt-2 border-t border-purple-900/30 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-purple-300 text-[11px] font-semibold">Cultivator Seed Care:</span>
                        
                <button
                  type="button"
                  onClick={() => {
                    const updatedTraits: SeedGeneticTraits = {
                      ...traits,
                      viabilityPct: Math.min(99, traits.viabilityPct + 12),
                      germinationVigor: parseFloat((traits.germinationVigor + 0.10).toFixed(2)),
                      germinationOutcome: 'in_progress'
                    };
                    onUpdateItem({
                      ...plant,
                      soilMoisture: Math.min(85, plant.soilMoisture + 15),
                      traits: updatedTraits
                    }, selectedParentTentId);
                    onLogJournalEntry?.({
                      title: `🧪 Kelp & Peroxide Soak: ${plant.name}`,
                      message: `Applied dilute 1% H2O2 & cold-water kelp extract drench. Softened seed coat (+12% viability) and stimulated embryo awakening!`,
                      type: 'action',
                      category: 'care'
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 transition-colors flex items-center gap-1.5"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-purple-300" />
                  <span>Kelp &amp; Peroxide Seed Soak (+12% Viability)</span>
                </button>

                {heatMats.length > 0 ? (
                  <button
                    type="button"
                    disabled={matsAtTarget}
                    onClick={() => {
                      heatMats.forEach(mat => onUpdateItem({ ...mat, powerOn: true, targetTempF: SEED_ROOT_TEMP_F }, selectedParentTentId));
                      onLogJournalEntry?.({
                        title: `🌡️ Bottom Heat Set: ${plant.name}`,
                        message: `Switched on ${heatMats.map(m => m.name).join(', ')} with the thermostat at ${SEED_ROOT_TEMP_F}°F to speed radicle emergence. Root zone is ${rootTempF.toFixed(1)}°F and will warm gradually.`,
                        type: 'action',
                        category: 'care'
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-800/60 transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:hover:bg-amber-950/70"
                  >
                    <Thermometer className="w-3.5 h-3.5 text-amber-300" />
                    <span>{matsAtTarget ? `Heat mat on at ${SEED_ROOT_TEMP_F}°F` : `Set Heat Mat to ${SEED_ROOT_TEMP_F}°F`} · root zone {rootTempF.toFixed(1)}°F</span>
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800 flex items-center gap-1.5" title="Root zone follows the air around it. A heat mat under the pot, tray or tent floor, or a heater warming the air, raises it.">
                    <Thermometer className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Root zone {rootTempF.toFixed(1)}°F · no heat mat here ({SEED_ROOT_TEMP_F}°F is ideal for sprouting)</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const newTraits = generateSeedTraits(plant.species, plant.strainName, plant.propagationType, 'Certified High-Viability');
                    onUpdateItem({
                      ...plant,
                      stageProgress: 0,
                      currentStageDays: 0,
                      health: 98,
                      soilMoisture: 78,
                      rootTempF: 78,
                      traits: newTraits
                    }, selectedParentTentId);
                    onLogJournalEntry?.({
                      title: `🌱 Re-Seeded: ${plant.name}`,
                      message: `Planted fresh viable seed (Batch #${newTraits.seedId}, ${newTraits.viabilityPct}% viability).`,
                      type: 'action',
                      category: 'care'
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                >
                  Roll Fresh Seed Batch
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
};

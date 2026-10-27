import React from 'react';
import { getPepperCultivar } from '../../utils/plantLifecycle';
import type { ItemSectionProps, PlantLocals } from './types';

export const PlantPepperCard: React.FC<ItemSectionProps & Pick<PlantLocals, 'plant'>> = (props) => {
  const { plant } = props;

  return (
    <>
      {/* 6. Hot Pepper & Chili Cultivar Botany, Capsaicin Pungency & Germination Dynamics */}
      {plant.species === 'Chili Pepper' && (() => {
        const pepperCult = getPepperCultivar(plant.strainName || plant.name);
        const shu = plant.scovilleHeatUnits || (pepperCult?.scovilleHeatUnits) || 50000;
        const isSuperhot = shu >= 800000;
        const isHot = shu >= 50000 && shu < 800000;
        const isMedium = shu >= 2500 && shu < 50000;

        const heatLabel = isSuperhot ? 'Superhot (Extreme Fire)' : isHot ? 'Hot (Fiery)' : isMedium ? 'Medium (Pungent Warmth)' : 'Sweet / Mild';
        const heatBadgeStyle = isSuperhot ? 'bg-red-950 text-red-300 border-red-700' : isHot ? 'bg-orange-950 text-orange-300 border-orange-700' : isMedium ? 'bg-amber-950 text-amber-300 border-amber-700' : 'bg-blue-950 text-blue-300 border-blue-700';

        return (
          <div className="bg-gradient-to-r from-red-950/30 to-zinc-950 border border-red-800/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-red-900/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌶️</span>
                <div>
                  <h4 className="text-sm font-bold text-red-200">
                    {pepperCult?.name || 'Chili Pepper'} · Capsicum Pungency &amp; Phenology
                  </h4>
                  <p className="text-[11px] text-red-400/80">
                    {pepperCult?.scientificName || 'Capsicum chinense / annuum'} · {pepperCult?.origin || 'Americas'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${heatBadgeStyle}`}>
                  🔥 {shu.toLocaleString()} SHU · {heatLabel}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Germination Root Warmth Assessment */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
                <div className="text-zinc-400 text-[10px] uppercase font-mono">
                  {plant.stage === 'germination' ? 'Germination Substrate Warmth' : 'Root Zone Warmth'}
                </div>
                <div className={`font-bold mt-0.5 ${plant.rootTempF >= 78 && plant.rootTempF <= 88 ? 'text-emerald-300' : plant.rootTempF < 70 ? 'text-amber-400' : 'text-zinc-200'}`}>
                  {plant.rootTempF.toFixed(1)}°F {plant.rootTempF >= 78 && plant.rootTempF <= 88 ? '• Optimal (80-86°F)' : plant.rootTempF < 70 ? '• Too Cold (<75°F)' : ''}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  {plant.stage === 'germination' 
                    ? (plant.rootTempF >= 78 ? 'Rapid seed coat cracking & embryo emergence!' : 'Bottom seedling heat mat strongly recommended to break seed dormancy.')
                    : 'Warm root zone stimulates active nutrient uptake and fruit setting.'}
                </div>
              </div>

              {/* Seedling & Fruiting Phenology */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
                <div className="text-zinc-400 text-[10px] uppercase font-mono">Capsaicinoid Synthesis</div>
                <div className="font-bold text-amber-300 mt-0.5">
                  {['flowering', 'ripening', 'ready'].includes(plant.stage) 
                    ? '🌶️ Pod Placenta Capsaicin Active' 
                    : '🌱 Pre-Flower Branching Node Setup'}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  {plant.stage === 'ripening' 
                    ? 'High daylight PPFD and warm temps maximizing Scoville pungency.'
                    : 'Maintain stable day (75-84°F) and night (>65°F) to prevent blossom drop.'}
                </div>
              </div>

              {/* Cultivar Milestone Expected Days */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
                <div className="text-zinc-400 text-[10px] uppercase font-mono">Expected Stage Duration</div>
                <div className="font-bold text-zinc-200 mt-0.5">
                  {plant.stage === 'germination' ? `${pepperCult?.germinationDaysExpected || 14} days to sprout` : plant.stage === 'vegetative' ? `${pepperCult?.vegetativeDaysExpected || 30} days veg` : plant.stage === 'flowering' ? `${pepperCult?.floweringDaysExpected || 50} days bloom` : `${pepperCult?.ripeningDaysExpected || 15} days ripening`}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Total crop cycle: ~{(pepperCult?.germinationDaysExpected || 14) + (pepperCult?.seedlingDaysExpected || 8) + (pepperCult?.matureSeedlingDaysExpected || 10) + (pepperCult?.vegetativeDaysExpected || 30) + (pepperCult?.floweringDaysExpected || 50) + (pepperCult?.ripeningDaysExpected || 15)} days to harvest
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

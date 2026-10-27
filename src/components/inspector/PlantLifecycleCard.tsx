import React from 'react';
import { Check, Calendar, Clock, Play } from 'lucide-react';
import { PlantStage, PlantKeyDates } from '../../types/sim';
import { formatSimDateTime } from '../../utils/plantLifecycle';
import type { ItemSectionProps, PlantLocals } from './types';

export const PlantLifecycleCard: React.FC<ItemSectionProps & Pick<PlantLocals, 'plant' | 'isSeed' | 'suitability' | 'expectedDays' | 'currentStageDays' | 'milestones'>> = (props) => {
  const { selectedParentTentId, simTime, onUpdateItem, setShow3dGrowthTimelapse, plant, isSeed, suitability, expectedDays, currentStageDays, milestones } = props;

  return (
    <>
      {/* 3. Key Dates & Botanical Lifecycle Timeline Card */}
      <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-400" />
            <div>
              <h4 className="text-sm font-bold text-zinc-100">Lifecycle Milestones &amp; Tracked Dates</h4>
              <p className="text-[11px] text-zinc-400">
                Historical record of sowing/cutting dates and stage transition milestones
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-zinc-400">Days in Current Stage:</span>
            <span className="ml-1 text-xs font-mono font-bold text-teal-300">
              {currentStageDays.toFixed(1)} / {expectedDays} Days
            </span>
          </div>
        </div>

        {/* Current Stage Progress Bar */}
        <div className="space-y-1.5 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              Active Stage: <span className="text-teal-300 uppercase">{plant.stage.replace('_', ' ')}</span>
            </span>
            <span className="font-mono text-xs font-bold text-teal-300">
              {plant.stageProgress.toFixed(0)}% Completed
            </span>
          </div>
          <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${plant.stageProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>Rate: {suitability.overallScore.toFixed(2)}x base speed</span>
            <span>Remaining in Stage: ~{Math.max(0, expectedDays - currentStageDays).toFixed(1)} days</span>
          </div>
        </div>

        {/* Milestone Dates Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {milestones.map((m, idx) => {
            const isCurrentStage = 
              (m.id === 'planted' && (plant.stage === 'germination' || plant.stage === 'rooting')) ||
              (m.id === (isSeed ? 'sprouted' : 'rooted') && (plant.stage === 'germination' || plant.stage === 'rooting')) ||
              (m.id === plant.stage);

            return (
              <div 
                key={m.id}
                className={`p-2.5 rounded-xl border transition-all ${
                          isCurrentStage
                            ? 'bg-teal-950/60 border-teal-500 ring-1 ring-teal-500/40 text-teal-100'
                            : m.date
                              ? 'bg-zinc-900/90 border-emerald-900/60 text-zinc-200'
                              : 'bg-zinc-950/60 border-zinc-850 text-zinc-500'
                        }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    #{idx + 1}
                  </span>
                  <span className="text-xs">
                    {m.date ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px]">
                        <Check className="w-3 h-3" /> Logged
                      </span>
                    ) : isCurrentStage ? (
                      <span className="text-teal-400 font-bold text-[10px] animate-pulse">
                        ● In Progress
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-[10px]">Upcoming</span>
                    )}
                  </span>
                </div>
                <div className="text-xs font-semibold flex items-center gap-1.5 mb-1 truncate">
                  <span>{m.icon}</span>
                  <span className="truncate">{m.label}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 truncate">
                  {m.date ? formatSimDateTime(m.date) : 'Pending milestone'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stage Override Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-850 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-[11px]">Manual Lifecycle Stage Controls:</span>
            <button
              type="button"
              onClick={() => setShow3dGrowthTimelapse(true)}
              className="px-2.5 py-1 rounded-lg bg-teal-950 hover:bg-teal-900 text-teal-200 border border-teal-800 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <Play className="w-3 h-3 fill-current text-teal-300" />
              <span>Watch Growth 3D</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: isSeed ? 'germination' : 'rooting', label: isSeed ? 'Germinate' : 'Root' },
              { id: 'seedling', label: 'Seedling' },
              { id: 'mature_seedling', label: 'Mature' },
              { id: 'vegetative', label: 'Veg' },
              { id: 'flowering', label: 'Flower' },
              { id: 'ripening', label: 'Ripen' },
              { id: 'ready', label: 'Ready' }
            ].map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  const now = simTime || Date.now();
                  const updatedDates: PlantKeyDates = { ...(plant.keyDates || { plantedDate: now }) };
                  if (st.id === 'seedling') {
                    if (isSeed) updatedDates.sproutedDate = updatedDates.sproutedDate || now;
                    else updatedDates.rootedDate = updatedDates.rootedDate || now;
                    updatedDates.seedlingDate = updatedDates.seedlingDate || now;
                  } else if (st.id === 'mature_seedling') {
                    updatedDates.matureSeedlingDate = updatedDates.matureSeedlingDate || now;
                  } else if (st.id === 'vegetative') {
                    updatedDates.vegetativeDate = updatedDates.vegetativeDate || now;
                  } else if (st.id === 'flowering') {
                    updatedDates.floweringDate = updatedDates.floweringDate || now;
                  } else if (st.id === 'ripening') {
                    updatedDates.ripeningDate = updatedDates.ripeningDate || now;
                  } else if (st.id === 'ready') {
                    updatedDates.readyDate = updatedDates.readyDate || now;
                  }

                  onUpdateItem({
                    ...plant,
                    stage: st.id as PlantStage,
                    stageProgress: 0,
                    currentStageDays: 0,
                    keyDates: updatedDates
                  }, selectedParentTentId);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                          plant.stage === st.id
                            ? 'bg-teal-700 text-white font-bold'
                            : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300'
                        }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

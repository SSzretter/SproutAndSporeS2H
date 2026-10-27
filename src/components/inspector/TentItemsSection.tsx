import React from 'react';
import { Box, Sprout, Flower2, Wind, Sun, Trash2, Plus, ChevronRight, User, Dog, Cat, Dna } from 'lucide-react';
import { Tent, Item, PersonItem, PetItem } from '../../types/sim';
import type { TentSectionProps, TentLocals } from './types';

export const TentItemsSection: React.FC<TentSectionProps & Pick<TentLocals, 'filteredTentItems'>> = (props) => {
  const { onSelectItem, onOpenAddItem, filterTab, setFilterTab, setQuickItemToDelete, currentTent, filteredTentItems } = props;

  return (
    <>
      {/* Tent Items Section */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Box className="w-4 h-4 text-emerald-400" />
              Items Inside {currentTent.name}
            </h4>
            <p className="text-xs text-zinc-400">
              Click any crop or device to inspect growth stages, roots, water/mist, or tweak settings
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddItem(currentTent?.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Item to Tent</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800 pb-2 overflow-x-auto">
          {(['all', 'plants', 'mushrooms', 'equipment', 'people', 'pets'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors shrink-0 ${
                  filterTab === tab
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTentItems.map(item => {
            if (item.category === 'plant') {
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item.id, currentTent?.id)}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-emerald-500/60 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Flower2 className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-emerald-300">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                          {item.stage}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickItemToDelete({ id: item.id, name: item.name, kind: 'item', parentTentId: currentTent?.id });
                          }}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                          title={`Remove ${item.name} from Tent`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-2 flex items-center justify-between">
                      <span>{item.species} · {item.strainName}</span>
                      {item.traits && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 flex items-center gap-1">
                          <Dna className="w-2.5 h-2.5 text-purple-400" />
                          {item.traits.viabilityPct}% · {item.traits.growthRateMultiplier.toFixed(2)}x
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex justify-between text-zinc-400 mb-0.5">
                          <span>Health</span>
                          <span className="font-mono text-emerald-400">{item.health}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                                item.health > 80 ? 'bg-emerald-500' : item.health > 50 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} 
                            style={{ width: `${item.health}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-zinc-400 mb-0.5">
                          <span>Soil Moisture</span>
                          <span className="font-mono text-cyan-400">{item.soilMoisture.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-cyan-500 rounded-full" 
                            style={{ width: `${item.soilMoisture}%` }} 
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-zinc-400 pt-0.5">
                        <span>Root Zone:</span>
                        <span className="font-mono text-zinc-200 font-semibold">
                          {item.rootTempF ? `${item.rootTempF.toFixed(1)}°F` : '68.0°F'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono">{item.dimensions.length}′ × {item.dimensions.width}′ × {item.dimensions.height}′</span>
                    <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            } else if (item.category === 'mushroom') {
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item.id, currentTent?.id)}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-amber-500/60 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Sprout className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-amber-300">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 uppercase">
                          {item.stage}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickItemToDelete({ id: item.id, name: item.name, kind: 'item', parentTentId: currentTent?.id });
                          }}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                          title={`Remove ${item.name} from Tent`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-2 flex items-center justify-between">
                      <span>{item.species} · Flush #{item.flushCount}</span>
                      {item.traits && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                          <Dna className="w-2.5 h-2.5 text-amber-400" />
                          {item.traits.viabilityPct}% · {item.traits.colonizationVigor.toFixed(2)}x
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <div className="flex justify-between text-zinc-400 mb-0.5">
                          <span>Health</span>
                          <span className="font-mono text-emerald-400">{item.health}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${item.health}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-zinc-400 mb-0.5">
                          <span>Substrate Moisture</span>
                          <span className="font-mono text-cyan-400">{item.substrateMoisture.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-cyan-500 rounded-full" 
                            style={{ width: `${item.substrateMoisture}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono">{item.dimensions.length}′ × {item.dimensions.width}′ × {item.dimensions.height}′</span>
                    <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            } else if (item.category === 'person') {
              const p = item as PersonItem;
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectItem(p.id, currentTent?.id)}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-violet-500/60 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-violet-300">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800 capitalize">
                          {p.activity}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickItemToDelete({ id: p.id, name: p.name, kind: 'item', parentTentId: currentTent?.id });
                          }}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                          title={`Remove ${p.name} from Tent`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-2">
                      +{p.co2RateLitersPerHour} L/h CO₂ · {p.heatOutputWatts}W Body Heat
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Biological occupant inside tent atmosphere
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono">{p.dimensions.length}′ × {p.dimensions.width}′ × {p.dimensions.height}′</span>
                    <span className="text-violet-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            } else if (item.category === 'pet') {
              const pet = item as PetItem;
              return (
                <div
                  key={pet.id}
                  onClick={() => onSelectItem(pet.id, currentTent?.id)}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-rose-500/60 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {pet.petType === 'cat' ? <Cat className="w-4 h-4" /> : <Dog className="w-4 h-4" />}
                        </div>
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-rose-300">
                          {pet.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 capitalize">
                          {pet.petType.replace('_', ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickItemToDelete({ id: pet.id, name: pet.name, kind: 'item', parentTentId: currentTent?.id });
                          }}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                          title={`Remove ${pet.name} from Tent`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-2">
                      +{pet.co2RateLitersPerHour} L/h CO₂ · {pet.heatOutputWatts}W Warmth
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {pet.breed || 'Pet animal companion'}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono">{pet.dimensions.length}′ × {pet.dimensions.width}′ × {pet.dimensions.height}′</span>
                    <span className="text-rose-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            } else {
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item.id, currentTent?.id)}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
                          {item.type === 'grow_light' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Wind className="w-4 h-4 text-cyan-400" />}
                        </div>
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-emerald-300">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            item.powerOn 
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}>
                          {item.powerOn ? 'ON' : 'OFF'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickItemToDelete({ id: item.id, name: item.name, kind: 'item', parentTentId: currentTent?.id });
                          }}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                          title={`Remove ${item.name} from Tent`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-2">
                      {item.powerWatts}W · Setting: {item.setting}%
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono">{item.dimensions.length}′ × {item.dimensions.width}′ × {item.dimensions.height}′</span>
                    <span className="text-zinc-400 group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </>
  );
};

import React from 'react';
import { Box, Sprout, Flower2, Zap, Wind, Droplets, Sun, Trash2, Plus, ChevronRight, Flame, User, Dog, Cat } from 'lucide-react';
import { Room, Tent, Item, PlantItem, MushroomItem, EquipmentItem, PersonItem, PetItem } from '../../types/sim';
import { VpdBadge } from '../VpdBadge';
import type { InspectorContext, RoomLocals } from './types';

export const RoomItemsSection: React.FC<InspectorContext & Pick<RoomLocals, 'filteredItems'>> = (props) => {
  const { room, onSelectTent, onSelectItem, onOpenAddItem, filterTab, setFilterTab, setQuickItemToDelete, filteredItems } = props;

  return (
    <>
      {/* Items Listing Section */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Box className="w-4 h-4 text-emerald-400" />
              Items &amp; Tents in {room.name}
            </h4>
            <p className="text-xs text-zinc-400">
              Click any item or tent below to inspect its microclimate and settings
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddItem()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Item to Room</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800 pb-2 overflow-x-auto">
          {(['all', 'tents', 'equipment', 'plants', 'mushrooms', 'people', 'pets'] as const).map(tab => (
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

        {/* Items Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map(item => {
            if (item.kind === 'tent') {
              const tent = item as Tent & { kind: 'tent' };
              const vol = Math.round(tent.dimensions.length * tent.dimensions.width * tent.dimensions.height);
              return (
                <div
                  key={tent.id}
                  onClick={() => onSelectTent(tent.id)}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-emerald-500/60 hover:bg-zinc-900 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-zinc-200 group-hover:text-emerald-300">
                          {tent.name}
                        </h5>
                        {tent.brand && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                              tent.brand === 'AC Infinity'
                                ? 'bg-sky-950 text-sky-300 border border-sky-800'
                                : tent.brand === 'Spider Farmer'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-zinc-800 text-zinc-400'
                            }`}>
                            {tent.brand}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {tent.dimensions.length}′ × {tent.dimensions.width}′ × {tent.dimensions.height}′ · {vol} cu ft
                        {tent.mylarRating && <span className="text-zinc-500"> · {tent.mylarRating.split(' ')[0]}</span>}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        {tent.items.length} inside · {tent.climate.tempF.toFixed(1)}°F · {tent.climate.rh}% RH · {tent.climate.co2Ppm || 420} PPM CO₂
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <VpdBadge vpd={tent.climate.vpdKpa} target="plant" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickItemToDelete({ id: tent.id, name: tent.name, kind: 'tent' });
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                      title={`Remove ${tent.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
                  </div>
                </div>
              );
            } else {
              const it = item as Item & { kind: 'item' };
              const isPerson = it.category === 'person';
              const isPet = it.category === 'pet';
              const isPlant = it.category === 'plant';
              const isMushroom = it.category === 'mushroom';

              let icon = <Wind className="w-5 h-5 text-cyan-400" />;
              let iconBg = 'bg-zinc-800 border-zinc-750 text-zinc-300';
              let tagColor = 'bg-zinc-800 text-zinc-400';
              let tagLabel = 'Equipment';
              let details = '';

              if (isPerson) {
                const p = it as PersonItem;
                icon = <User className="w-5 h-5 text-violet-400" />;
                iconBg = 'bg-violet-950/50 border-violet-800/60 text-violet-300';
                tagColor = 'bg-violet-950 text-violet-300 border border-violet-800';
                tagLabel = `Person (${p.activity})`;
                details = `+${p.co2RateLitersPerHour} L/h CO₂ · ${p.heatOutputWatts}W Heat · ${p.moistureLitersPerDay}L/d`;
              } else if (isPet) {
                const pet = it as PetItem;
                icon = pet.petType === 'cat' ? <Cat className="w-5 h-5 text-rose-400" /> : <Dog className="w-5 h-5 text-rose-400" />;
                iconBg = 'bg-rose-950/50 border-rose-800/60 text-rose-300';
                tagColor = 'bg-rose-950 text-rose-300 border border-rose-800';
                tagLabel = `Pet (${pet.petType.replace('_', ' ')})`;
                details = `+${pet.co2RateLitersPerHour} L/h CO₂ · ${pet.heatOutputWatts}W Warmth`;
              } else if (isPlant) {
                const pl = it as PlantItem;
                icon = <Flower2 className="w-5 h-5 text-emerald-400" />;
                iconBg = 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300';
                tagColor = 'bg-emerald-950 text-emerald-300 border border-emerald-800';
                tagLabel = `Plant (${pl.stage})`;
                details = `Health: ${pl.health}% · Soil: ${pl.soilMoisture.toFixed(0)}%${pl.traits ? ` · 🧬 ${pl.traits.viabilityPct}% Viable (${pl.traits.growthRateMultiplier}x)` : ''}`;
              } else if (isMushroom) {
                const m = it as MushroomItem;
                icon = <Sprout className="w-5 h-5 text-amber-400" />;
                iconBg = 'bg-amber-950/50 border-amber-800/60 text-amber-300';
                tagColor = 'bg-amber-950 text-amber-300 border border-amber-800';
                tagLabel = `Mushroom (${m.stage})`;
                details = `Health: ${m.health}% · Substrate: ${m.substrateMoisture.toFixed(0)}%${m.traits ? ` · 🍄 ${m.traits.viabilityPct}% Viable (${m.traits.colonizationVigor}x)` : ''}`;
              } else {
                const eq = it as EquipmentItem;
                if (eq.type === 'grow_light') icon = <Sun className="w-5 h-5 text-yellow-400" />;
                else if (eq.type === 'humidifier' || eq.type === 'dehumidifier') icon = <Droplets className="w-5 h-5 text-cyan-400" />;
                else if (eq.type === 'heater') icon = <Flame className="w-5 h-5 text-amber-400" />;
                else icon = <Zap className="w-5 h-5 text-teal-400" />;
                details = eq.powerOn ? `● Active (${eq.powerWatts}W)` : `○ Standby (${eq.powerWatts}W)`;
              }

              return (
                <div
                  key={it.id}
                  onClick={() => onSelectItem(it.id)}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-emerald-500/60 hover:bg-zinc-900 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${iconBg} group-hover:scale-105 transition-transform`}>
                      {icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-zinc-200 group-hover:text-emerald-300">
                          {it.name}
                        </h5>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${tagColor}`}>
                          {tagLabel}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {it.dimensions.length}′ × {it.dimensions.width}′ × {it.dimensions.height}′
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        {details}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickItemToDelete({ id: it.id, name: it.name, kind: 'item', parentTentId: null });
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                      title={`Remove ${it.name} from Room`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
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

import React, { useState, useMemo } from 'react';
import { 
  Package, 
  X, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Calendar, 
  Clock, 
  Scale, 
  DollarSign, 
  Award, 
  Sparkles, 
  Droplets, 
  MapPin, 
  CheckCircle2, 
  Trash2,
  Box,
  Leaf,
  Layers,
  ChevronRight,
  Flame,
  Sun
} from 'lucide-react';
import { HarvestRecord } from '../../types/sim';

interface PlayerInventoryModalProps {
  harvests: HarvestRecord[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateHarvestRecord?: (updatedRecord: HarvestRecord) => void;
  onDeleteHarvestRecord?: (recordId: string) => void;
}

type FilterCategory = 'all' | 'plant' | 'mushroom' | 'legendary';
type SortOption = 'newest' | 'oldest' | 'yield_desc' | 'quality_desc' | 'name_asc';

export const PlayerInventoryModal: React.FC<PlayerInventoryModalProps> = ({
  harvests,
  isOpen,
  onClose,
  onUpdateHarvestRecord,
  onDeleteHarvestRecord
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Aggregate Stash Telemetry
  const totalMassGrams = harvests.reduce((acc, h) => acc + (h.yieldGrams || 0), 0);
  const totalOunces = (totalMassGrams / 28.3495).toFixed(1);
  const totalPounds = (totalMassGrams / 453.592).toFixed(2);
  const totalEstValue = harvests.reduce((acc, h) => {
    if (typeof h.estimatedValue === 'number') return acc + h.estimatedValue;
    const mult = h.quality === 'Legendary' ? 12 : h.quality === 'Excellent' ? 9 : 6;
    return acc + Math.round(h.yieldGrams * mult);
  }, 0);

  const plantCount = harvests.filter(h => h.type === 'plant').length;
  const mushroomCount = harvests.filter(h => h.type === 'mushroom').length;
  const legendaryCount = harvests.filter(h => h.quality === 'Legendary').length;

  // Filter & Sort Logic
  const filteredHarvests = useMemo(() => {
    return harvests.filter(item => {
      // Category filter
      if (filterCategory === 'plant' && item.type !== 'plant') return false;
      if (filterCategory === 'mushroom' && item.type !== 'mushroom') return false;
      if (filterCategory === 'legendary' && item.quality !== 'Legendary') return false;

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSpecies = item.species.toLowerCase().includes(q);
        const matchesStrain = item.strainName ? item.strainName.toLowerCase().includes(q) : false;
        const matchesOrigin = (item.originRoomName || '').toLowerCase().includes(q) || 
                              (item.originTentName || '').toLowerCase().includes(q);
        const matchesQuality = item.quality.toLowerCase().includes(q);
        if (!matchesName && !matchesSpecies && !matchesStrain && !matchesOrigin && !matchesQuality) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortOption === 'newest') {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      }
      if (sortOption === 'oldest') {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      }
      if (sortOption === 'yield_desc') {
        return b.yieldGrams - a.yieldGrams;
      }
      if (sortOption === 'quality_desc') {
        const score = (q: string) => q === 'Legendary' ? 4 : q === 'Excellent' ? 3 : q === 'Good' ? 2 : 1;
        return score(b.quality) - score(a.quality);
      }
      if (sortOption === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [harvests, filterCategory, sortOption, searchQuery]);

  const handleAdvanceCure = (record: HarvestRecord) => {
    if (!onUpdateHarvestRecord) return;
    const stages: Array<'Fresh Cut' | 'Drying' | 'Curing' | 'Cured & Ready'> = [
      'Fresh Cut', 
      'Drying', 
      'Curing', 
      'Cured & Ready'
    ];
    const currentIndex = stages.indexOf(record.cureStatus || 'Fresh Cut');
    const nextIndex = (currentIndex + 1) % stages.length;
    onUpdateHarvestRecord({
      ...record,
      cureStatus: stages[nextIndex]
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl text-zinc-100 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-zinc-100">
                  Cultivator Harvest Inventory
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                  {harvests.length} Products Stashed
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Personal vault of harvested crops, cured botanical flowers, and fruited mushroom flushes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Close Inventory (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Inventory Analytics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Dried Yield</span>
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-emerald-400">
              {totalMassGrams.toLocaleString()} g
              <span className="text-xs text-zinc-400 font-sans ml-1.5">
                ({totalOunces} oz)
              </span>
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Stash Valuation</span>
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-amber-300">
              ${totalEstValue.toLocaleString()}
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
              <Award className="w-3.5 h-3.5 text-yellow-400" />
              <span>Quality Ratio</span>
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-zinc-200">
              {legendaryCount} <span className="text-xs text-zinc-400 font-sans">Legendary Grade</span>
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Botanical Split</span>
            </div>
            <div className="text-xs sm:text-sm font-mono font-bold text-zinc-200 mt-1">
              <span className="text-emerald-400">🌿 {plantCount}</span>
              <span className="text-zinc-600 mx-1.5">/</span>
              <span className="text-purple-400">🍄 {mushroomCount}</span>
            </div>
          </div>
        </div>

        {/* Search, Filter Category & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-800/80">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search harvested items by name, species, strain, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs overflow-x-auto">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                filterCategory === 'all'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({harvests.length})
            </button>
            <button
              onClick={() => setFilterCategory('plant')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                filterCategory === 'plant'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🌿 Plants ({plantCount})
            </button>
            <button
              onClick={() => setFilterCategory('mushroom')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                filterCategory === 'mushroom'
                  ? 'bg-zinc-800 text-purple-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🍄 Mushrooms ({mushroomCount})
            </button>
            <button
              onClick={() => setFilterCategory('legendary')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                filterCategory === 'legendary'
                  ? 'bg-zinc-800 text-amber-300 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🏆 Top Shelf ({legendaryCount})
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="newest">Harvest Date: Newest First</option>
              <option value="oldest">Harvest Date: Oldest First</option>
              <option value="yield_desc">Mass: Heaviest Yield First</option>
              <option value="quality_desc">Quality Grade: Highest First</option>
              <option value="name_asc">Alphabetical: A to Z</option>
            </select>
          </div>
        </div>

        {/* Scrollable Inventory Grid */}
        <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3 min-h-[220px]">
          {filteredHarvests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-600">
                <Package className="w-10 h-10" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-zinc-300 mb-1">
                  {harvests.length === 0 
                    ? 'Your Harvest Inventory Is Empty' 
                    : 'No Matching Harvests Found'}
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {harvests.length === 0 
                    ? 'Nurture your cannabis cultivars, hops, peppers, or oyster mushrooms to harvest maturity! Switch to Hotbar Tool [3] (Harvest Shears) in 2D game mode or use proximity action [E] to harvest mature crops.' 
                    : 'Try clearing your search query or switching category filters to view other stored items.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredHarvests.map(item => {
                const isSelected = selectedRecordId === item.id;
                const formattedTime = item.timeStr 
                  ? item.timeStr 
                  : item.timestamp 
                    ? new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : '12:00 PM';

                const qualityBadge = item.quality === 'Legendary'
                  ? 'bg-amber-950/80 border-amber-700/70 text-amber-300'
                  : item.quality === 'Excellent'
                    ? 'bg-emerald-950/80 border-emerald-700/70 text-emerald-300'
                    : item.quality === 'Good'
                      ? 'bg-sky-950/80 border-sky-700/70 text-sky-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300';

                const itemEstValue = typeof item.estimatedValue === 'number'
                  ? item.estimatedValue
                  : Math.round(item.yieldGrams * (item.quality === 'Legendary' ? 12 : item.quality === 'Excellent' ? 9 : 6));

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedRecordId(isSelected ? null : item.id)}
                    className={`rounded-xl border p-3.5 transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-zinc-850/90 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                        : 'bg-zinc-950/90 border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-900/90'
                    }`}
                  >
                    {/* Top Row: Icon, Name, Species & Quality Badge */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-2.5 rounded-xl border text-lg flex items-center justify-center shrink-0 ${
                          item.type === 'plant'
                            ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                            : 'bg-purple-950/40 border-purple-800/40 text-purple-400'
                        }`}>
                          {item.type === 'plant' ? '🌿' : '🍄'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-zinc-100">
                              {item.name}
                            </h4>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${qualityBadge}`}>
                              ★ {item.quality}
                            </span>
                          </div>

                          <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="font-medium text-zinc-300">{item.species}</span>
                            {item.strainName && (
                              <>
                                <span className="text-zinc-600">·</span>
                                <span className="text-emerald-400/90 italic">{item.strainName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Yield Weight Pill */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-bold text-amber-400">
                          {item.yieldGrams}g
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {(item.yieldGrams / 28.3495).toFixed(1)} oz
                        </div>
                      </div>
                    </div>

                    {/* Middle Row: Date & Time Harvested + Location Tag */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-850 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      {/* Date & Time Stamp */}
                      <div className="flex items-center gap-1.5 text-zinc-300 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{item.dateStr}</span>
                        <span className="text-zinc-600">·</span>
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{formattedTime}</span>
                      </div>

                      {/* Origin Room & Tent */}
                      <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        <span className="truncate max-w-[140px]">
                          {item.originTentName ? `${item.originTentName}` : item.originRoomName || 'Facility'}
                        </span>
                      </div>
                    </div>

                    {/* Secondary Attributes Strip */}
                    <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
                      <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800/70">
                        <span className="text-zinc-500 block text-[9px] uppercase">Cure State</span>
                        <span className="text-emerald-300 font-medium">
                          {item.cureStatus || 'Cured & Ready'}
                        </span>
                      </div>

                      <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800/70">
                        <span className="text-zinc-500 block text-[9px] uppercase">Est. Value</span>
                        <span className="text-amber-300 font-bold">
                          ${itemEstValue}
                        </span>
                      </div>

                      <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800/70">
                        <span className="text-zinc-500 block text-[9px] uppercase">Potency</span>
                        <span className="text-cyan-300 truncate block">
                          {item.potencyNote || `${item.health || 85}% Vitality`}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Properties Drawer (When Clicked) */}
                    {isSelected && (
                      <div 
                        className="mt-3 pt-3 border-t border-zinc-800 space-y-2 animate-in fade-in duration-100"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          {item.containerType && (
                            <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                              <span className="text-[10px] text-zinc-500 block uppercase font-mono">Container</span>
                              <span className="text-zinc-200">{item.containerType}</span>
                            </div>
                          )}
                          {item.growingMedium && (
                            <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                              <span className="text-[10px] text-zinc-500 block uppercase font-mono">Medium</span>
                              <span className="text-zinc-200">{item.growingMedium}</span>
                            </div>
                          )}
                        </div>

                        {item.notes && (
                          <div className="text-[11px] text-zinc-400 bg-zinc-900 p-2 rounded-lg border border-zinc-800 italic">
                            "{item.notes}"
                          </div>
                        )}

                        {/* Interactive Item Actions */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => handleAdvanceCure(item)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Advance Cure: {item.cureStatus === 'Fresh Cut' ? 'Hang Dry' : item.cureStatus === 'Drying' ? 'Jar Cure' : 'Cured'}</span>
                          </button>

                          {onDeleteHarvestRecord && (
                            <button
                              onClick={() => onDeleteHarvestRecord(item.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              title="Discard / Smoke / Sample this batch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Sample / Discard</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-mono text-zinc-300 font-semibold">{filteredHarvests.length}</span>
            <span>of</span>
            <span className="font-mono text-zinc-300 font-semibold">{harvests.length}</span>
            <span>items visible · Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[10px]">I</kbd>
            <span>or</span>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[10px]">Esc</kbd>
            <span>to toggle</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold transition-colors"
            >
              Close Inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

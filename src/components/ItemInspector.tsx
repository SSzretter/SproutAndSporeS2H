import React, { useState } from 'react';
import { 
  Home, 
  Box, 
  Sprout, 
  Flower2, 
  Zap, 
  Wind, 
  Droplets, 
  Thermometer, 
  Sun, 
  Scissors, 
  Check, 
  Trash2, 
  ArrowLeft, 
  Edit3, 
  Plus, 
  Sliders, 
  Award,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  Calendar,
  Building,
  Flame,
  Activity,
  User,
  Dog,
  Cat,
  Heart,
  Shield,
  ShieldCheck,
  Clock,
  Timer,
  SlidersHorizontal,
  Layers,
  Power
} from 'lucide-react';
import { 
  Room, 
  Tent, 
  Item, 
  PlantItem, 
  MushroomItem, 
  EquipmentItem, 
  PersonItem,
  PersonActivity,
  PetItem,
  PetType,
  Dimensions, 
  ConstructionStandard,
  ControllerPriority,
  EquipmentControlMode,
  EquipmentAutoTriggers
} from '../types/sim';
import { VpdBadge } from './VpdBadge';
import { TENT_CATALOG } from '../utils/tentCatalog';
import { PropagationType, PlantStage, PlantKeyDates } from '../types/sim';
import { evaluatePlantStageSuitability, DEFAULT_STAGE_REQUIREMENTS, DEFAULT_STAGE_DURATIONS, formatSimDateTime } from '../utils/plantLifecycle';

interface ItemInspectorProps {
  room: Room;
  rooms?: Room[];
  outdoorCo2Ppm?: number;
  selectedType: 'room' | 'tent' | 'item' | null;
  selectedId: string | null;
  selectedParentTentId?: string | null;
  tempUnit: 'F' | 'C';
  onUpdateRoom: (room: Room) => void;
  onUpdateTent: (tent: Tent) => void;
  onUpdateItem: (item: Item, parentTentId?: string | null) => void;
  onDeleteTent: (tentId: string) => void;
  onDeleteItem: (itemId: string, parentTentId?: string | null) => void;
  onDeleteRoom?: (roomId: string) => void;
  onOpenAddRoom?: () => void;
  onOpenLocationModal?: () => void;
  onSelectRoom: () => void;
  onSelectTent: (tentId: string) => void;
  onSelectItem: (itemId: string, parentTentId?: string | null) => void;
  onOpenAddItem: (tentId?: string) => void;
  onHarvestPlant: (plant: PlantItem, tentId?: string) => void;
  onHarvestMushroom: (mushroom: MushroomItem, tentId?: string) => void;
  simTime?: number;
}

export const ItemInspector: React.FC<ItemInspectorProps> = ({
  room,
  rooms = [],
  outdoorCo2Ppm = 420,
  selectedType,
  selectedId,
  selectedParentTentId,
  tempUnit,
  simTime,
  onUpdateRoom,
  onUpdateTent,
  onUpdateItem,
  onDeleteTent,
  onDeleteItem,
  onDeleteRoom,
  onOpenAddRoom,
  onOpenLocationModal,
  onSelectRoom,
  onSelectTent,
  onSelectItem,
  onOpenAddItem,
  onHarvestPlant,
  onHarvestMushroom,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'tents' | 'plants' | 'mushrooms' | 'equipment' | 'people' | 'pets'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteRoomConfirm, setShowDeleteRoomConfirm] = useState(false);
  const [quickItemToDelete, setQuickItemToDelete] = useState<{ id: string; name: string; kind: 'tent' | 'item'; parentTentId?: string | null } | null>(null);

  // Find currently selected tent if any
  let currentTent: Tent | undefined = undefined;
  if (selectedType === 'tent') {
    currentTent = room.tents.find(t => t.id === selectedId);
  } else if (selectedParentTentId) {
    currentTent = room.tents.find(t => t.id === selectedParentTentId);
  }

  // Find currently selected item if any
  let currentItem: Item | undefined = undefined;
  if (selectedType === 'item') {
    if (selectedParentTentId && currentTent) {
      currentItem = currentTent.items.find(i => i.id === selectedId);
    } else {
      currentItem = room.items.find(i => i.id === selectedId);
    }
  }

  // Dimension change helper for Room
  const handleRoomDimensionChange = (key: keyof Dimensions, value: number) => {
    if (isNaN(value) || value <= 0) return;
    onUpdateRoom({
      ...room,
      dimensions: {
        ...room.dimensions,
        [key]: parseFloat(value.toFixed(1))
      }
    });
  };

  // Dimension change helper for Tent
  const handleTentDimensionChange = (key: keyof Dimensions, value: number) => {
    if (!currentTent || isNaN(value) || value <= 0) return;
    onUpdateTent({
      ...currentTent,
      dimensions: {
        ...currentTent.dimensions,
        [key]: parseFloat(value.toFixed(1))
      }
    });
  };

  // Dimension change helper for Item
  const handleItemDimensionChange = (key: keyof Dimensions, value: number) => {
    if (!currentItem || isNaN(value) || value <= 0) return;
    onUpdateItem({
      ...currentItem,
      dimensions: {
        ...currentItem.dimensions,
        [key]: parseFloat(value.toFixed(1))
      }
    });
  };

  // 1. RENDER INSPECTOR WHEN ROOM IS SELECTED
  if (selectedType === 'room' || (!selectedType && selectedId === room.id)) {
    const roomVolume = Math.round(room.dimensions.length * room.dimensions.width * room.dimensions.height);
    
    const allRoomItems = [
      ...room.tents.map(t => ({ ...t, kind: 'tent' as const })),
      ...room.items.map(i => ({ ...i, kind: 'item' as const }))
    ];

    const filteredItems = allRoomItems.filter(item => {
      if (filterTab === 'all') return true;
      if (filterTab === 'tents') return item.kind === 'tent';
      if (item.kind === 'item') {
        if (filterTab === 'plants') return item.category === 'plant';
        if (filterTab === 'mushrooms') return item.category === 'mushroom';
        if (filterTab === 'equipment') return item.category === 'equipment';
        if (filterTab === 'people') return item.category === 'person';
        if (filterTab === 'pets') return item.category === 'pet';
      }
      return false;
    });

    return (
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-6">
        {/* Breadcrumb Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1 font-semibold text-emerald-400">
              <Home className="w-3.5 h-3.5" /> Room
            </span>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <span className="text-zinc-200 font-medium">{room.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 border border-zinc-700">
              2005 Colonial House Specification
            </span>
          </div>
        </div>

        {/* Room Header & Dimensions Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    className="bg-zinc-950 border border-emerald-500 rounded-lg px-2.5 py-1 text-sm font-bold text-zinc-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (editedName.trim()) {
                        onUpdateRoom({ ...room, name: editedName.trim() });
                      }
                      setIsEditingName(false);
                    }}
                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-100">{room.name}</h3>
                  <button
                    onClick={() => {
                      setEditedName(room.name);
                      setIsEditingName(true);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-200"
                    title="Rename Room"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                  {room.tents.length} Tents Active · {room.items.length} Direct Items
                </span>
                {onOpenAddRoom && (
                  <button
                    type="button"
                    onClick={onOpenAddRoom}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                    title="Add a new room to facility"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Room</span>
                  </button>
                )}
                {onDeleteRoom && rooms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteRoomConfirm(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/60 transition-colors"
                    title={`Delete room: ${room.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete Room</span>
                  </button>
                )}
              </div>
            </div>

            {/* Editable Dimensions: L x W x H */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  Room Physical Enclosure (L × W × H)
                </span>
                <span className="font-mono text-emerald-400 text-xs">
                  Volume: {roomVolume.toLocaleString()} cu ft ({Math.round(roomVolume * 0.0283)} m³)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Length (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="4"
                    max="100"
                    value={room.dimensions.length}
                    onChange={e => handleRoomDimensionChange('length', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Width (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="4"
                    max="100"
                    value={room.dimensions.width}
                    onChange={e => handleRoomDimensionChange('width', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Height (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="6"
                    max="30"
                    value={room.dimensions.height}
                    onChange={e => handleRoomDimensionChange('height', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* 2005 COLONIAL HOUSE ENVELOPE & HVAC CONTROLS */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-sky-400" />
                  Building Envelope &amp; 2005 Colonial House Physics
                </span>
                <span className="text-[10px] font-mono text-sky-300 bg-sky-950/80 border border-sky-850 px-2 py-0.5 rounded">
                  IECC 2003/2006 Code
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Construction Spec details */}
                <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Exterior Wall Insulation:</span>
                    <span className="font-mono text-zinc-200 font-semibold">R-19 (U-0.053)</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Outdoor Air Infiltration:</span>
                    <span className="font-mono text-zinc-200 font-semibold">0.35 ACH (Fresh Air)</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Foundation Coupling:</span>
                    <select
                      value={room.foundationType || 'conditioned_basement'}
                      onChange={e => onUpdateRoom({ ...room, foundationType: e.target.value as any })}
                      className="bg-zinc-950 border border-zinc-750 rounded px-1.5 py-0.5 text-[11px] text-zinc-200"
                    >
                      <option value="conditioned_basement">Basement Suite (R-10 Concrete)</option>
                      <option value="slab_on_grade">1st Floor Living (Slab on Grade)</option>
                      <option value="second_floor">2nd Floor Bedroom Space</option>
                      <option value="attic">Attic / Bonus Room (Unconditioned)</option>
                    </select>
                  </div>
                </div>

                {/* Central HVAC Status */}
                <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Central HVAC Mode:</span>
                    <select
                      value={room.hvacMode || 'central_ac_active'}
                      onChange={e => onUpdateRoom({ ...room, hvacMode: e.target.value as any })}
                      className="bg-zinc-950 border border-zinc-750 rounded px-1.5 py-0.5 text-[11px] text-zinc-200"
                    >
                      <option value="central_ac_active">Active Central A/C (72°F)</option>
                      <option value="heating_active">Active Central Heat (68°F)</option>
                      <option value="passive_drift">Passive Envelope Drift (HVAC Off)</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Outdoor Air Infiltration CO₂:</span>
                    <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                      <span>{outdoorCo2Ppm} PPM</span>
                      {onOpenLocationModal && (
                        <button
                          type="button"
                          onClick={onOpenLocationModal}
                          className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-sans font-normal border border-zinc-700 transition-colors"
                          title="Configure Outdoor Atmospheric Baseline in Weather Settings"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 bg-zinc-950/60 p-2 rounded border border-zinc-850">
                    {(() => {
                      const people = room.items.filter(i => i.category === 'person');
                      const pets = room.items.filter(i => i.category === 'pet');
                      if (people.length === 0 && pets.length === 0) {
                        return 'Unoccupied: No residents or pets assumed. Infiltration maintains fresh outside air equilibrium (~420 PPM).';
                      }
                      return `Active Occupancy: ${people.length} People, ${pets.length} Pets exhaling biological CO₂ and radiating body warmth into the lung room.`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Room Live Climate Panel */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
                Room Atmosphere Telemetry
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Temperature</span>
                  <span className="font-mono font-bold text-zinc-100">
                    {tempUnit === 'F' ? `${room.climate.tempF.toFixed(1)}°F` : `${room.climate.tempC.toFixed(1)}°C`}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Relative Humidity</span>
                  <span className="font-mono font-bold text-zinc-100">{room.climate.rh}% RH</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Vapor Pressure Deficit</span>
                  <span className="font-mono font-bold text-emerald-400">{room.climate.vpdKpa.toFixed(2)} kPa</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Ambient CO₂</span>
                  <span className="font-mono font-bold text-emerald-400">{room.climate.co2Ppm || 420} PPM</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Ambient PPFD</span>
                  <span className="font-mono font-bold text-zinc-100">{room.climate.lightPPFD} µmol</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-800">
              <VpdBadge vpd={room.climate.vpdKpa} target="plant" showDetails />
            </div>
          </div>
        </div>

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
                  details = `Health: ${pl.health}% · Soil: ${pl.soilMoisture.toFixed(0)}%`;
                } else if (isMushroom) {
                  const m = it as MushroomItem;
                  icon = <Sprout className="w-5 h-5 text-amber-400" />;
                  iconBg = 'bg-amber-950/50 border-amber-800/60 text-amber-300';
                  tagColor = 'bg-amber-950 text-amber-300 border border-amber-800';
                  tagLabel = `Mushroom (${m.stage})`;
                  details = `Health: ${m.health}% · Substrate: ${m.substrateMoisture.toFixed(0)}%`;
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

        {/* Quick Item Deletion Confirmation Modal */}
        {quickItemToDelete && (
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setQuickItemToDelete(null)}
          >
            <div 
              className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-zinc-100">
                    Remove {quickItemToDelete.kind === 'tent' ? 'Tent' : 'Item'}
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Are you sure you want to remove <span className="font-semibold text-zinc-200">{quickItemToDelete.name}</span>?
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                {quickItemToDelete.kind === 'tent'
                  ? 'This will dismantle the enclosure and remove all internal equipment and crops located inside it from the facility.'
                  : 'This item will be removed immediately and its environmental impact (respiration, power, or climate modulation) will stop.'}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickItemToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (quickItemToDelete.kind === 'tent') {
                      onDeleteTent(quickItemToDelete.id);
                    } else {
                      onDeleteItem(quickItemToDelete.id, quickItemToDelete.parentTentId);
                    }
                    setQuickItemToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-colors"
                >
                  Confirm Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. RENDER INSPECTOR WHEN TENT IS SELECTED
  if (selectedType === 'tent' && currentTent) {
    const tentVol = Math.round(currentTent.dimensions.length * currentTent.dimensions.width * currentTent.dimensions.height);
    const isShroomTent = currentTent.items.some(i => i.category === 'mushroom');

    const filteredTentItems = currentTent.items.filter(item => {
      if (filterTab === 'all') return true;
      if (filterTab === 'plants') return item.category === 'plant';
      if (filterTab === 'mushrooms') return item.category === 'mushroom';
      if (filterTab === 'equipment') return item.category === 'equipment';
      if (filterTab === 'people') return item.category === 'person';
      if (filterTab === 'pets') return item.category === 'pet';
      return false;
    });

    return (
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-6">
        {/* Breadcrumb Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <button 
              onClick={onSelectRoom}
              className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <Home className="w-3.5 h-3.5" /> {room.name}
            </button>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <span className="text-emerald-400 font-semibold">{currentTent.name}</span>
          </div>
          <button
            onClick={onSelectRoom}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Room
          </button>
        </div>

        {/* Tent Header & Dimensions Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    className="bg-zinc-950 border border-emerald-500 rounded-lg px-2.5 py-1 text-sm font-bold text-zinc-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (editedName.trim() && currentTent) {
                        onUpdateTent({ ...currentTent, name: editedName.trim() });
                      }
                      setIsEditingName(false);
                    }}
                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-100">{currentTent.name}</h3>
                  <button
                    onClick={() => {
                      setEditedName(currentTent!.name);
                      setIsEditingName(true);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-200"
                    title="Rename Tent"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                title="Delete this Tent"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Standard Brand Model Info */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${
                    currentTent.brand === 'AC Infinity'
                      ? 'bg-sky-950 border border-sky-800 text-sky-300'
                      : currentTent.brand === 'Spider Farmer'
                        ? 'bg-amber-950 border border-amber-800 text-amber-300'
                        : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {currentTent.brand || 'Custom Enclosure'}
                  </span>
                  <span className="text-xs font-semibold text-zinc-200">
                    {currentTent.modelName || 'Standard Grow Tent'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-mono text-zinc-400">
                    Switch to Model:
                  </label>
                  <select
                    onChange={(e) => {
                      const selected = TENT_CATALOG.find(t => t.id === e.target.value);
                      if (selected && currentTent) {
                        onUpdateTent({
                          ...currentTent,
                          name: `${selected.brand} ${selected.modelName}`,
                          brand: selected.brand,
                          modelName: selected.modelName,
                          mylarRating: selected.mylarRating,
                          poleDiameter: selected.poleDiameter,
                          ventPorts: selected.ventPorts,
                          dimensions: selected.dimensions
                        });
                      }
                    }}
                    defaultValue=""
                    className="bg-zinc-900 border border-zinc-750 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="" disabled>Select Factory Tent...</option>
                    <optgroup label="AC Infinity CLOUDLAB Series">
                      {TENT_CATALOG.filter(t => t.brand === 'AC Infinity').map(t => (
                        <option key={t.id} value={t.id}>{t.modelName} ({t.shortCode})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Spider Farmer Series">
                      {TENT_CATALOG.filter(t => t.brand === 'Spider Farmer').map(t => (
                        <option key={t.id} value={t.id}>{t.modelName} ({t.shortCode})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Hardware Specs Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-zinc-400">
                <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300">
                  {currentTent.mylarRating || '1680D Mylar'}
                </span>
                <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300">
                  {currentTent.poleDiameter || '22mm Steel Frame'}
                </span>
                <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400">
                  {currentTent.ventPorts || 'Dual Cinch Ports'}
                </span>
              </div>
            </div>

            {/* Editable Dimensions: L x W x H */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  Tent Physical Dimensions (L × W × H)
                </span>
                <span className="font-mono text-emerald-400 text-xs">
                  Volume: {tentVol} cu ft ({Math.round(tentVol * 0.0283)} m³)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Length (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="2"
                    max="20"
                    value={currentTent.dimensions.length}
                    onChange={e => handleTentDimensionChange('length', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Width (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="2"
                    max="20"
                    value={currentTent.dimensions.width}
                    onChange={e => handleTentDimensionChange('width', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Height (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="3"
                    max="12"
                    value={currentTent.dimensions.height}
                    onChange={e => handleTentDimensionChange('height', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Exhaust Fan Master Speed & Lung Air Exchange with Live Controller Arbitration */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200">Exhaust Air Exchange with Host Room</span>
                    <p className="text-[10px] text-zinc-400">Pulls conditioned lung room air in through mesh bottom intakes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentTent.exhaustFanSpeed}
                    onChange={e => {
                      if (currentTent) {
                        onUpdateTent({
                          ...currentTent,
                          exhaustFanSpeed: parseInt(e.target.value)
                        });
                      }
                    }}
                    className="w-28 accent-emerald-500 cursor-pointer"
                  />
                  <div className="text-right">
                    <span className="font-mono text-xs font-bold text-emerald-400 block">
                      {currentTent.exhaustFanSpeed}%
                    </span>
                    {currentTent.effectiveFanSpeed !== undefined && currentTent.effectiveFanSpeed !== currentTent.exhaustFanSpeed && (
                      <span className="text-[9px] font-mono text-cyan-300 block">
                        Live: {currentTent.effectiveFanSpeed}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Central Controller Coordination & Conflict Priority */}
              <div className="pt-2 border-t border-zinc-850 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Central Controller Priority:</span>
                  </div>
                  <select
                    value={currentTent.controllerPriority || (isShroomTent ? 'humidity_first' : 'balanced_auto')}
                    onChange={e => {
                      if (currentTent) {
                        onUpdateTent({
                          ...currentTent,
                          controllerPriority: e.target.value as ControllerPriority
                        });
                      }
                    }}
                    className="bg-zinc-900 border border-zinc-750 focus:border-indigo-500 rounded-lg px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none"
                  >
                    <option value="humidity_first">💧 Humidity First (Mushrooms / Seedlings / Clones)</option>
                    <option value="balanced_auto">⚖️ Balanced Auto (Smooth VPD Coordination)</option>
                    <option value="temperature_first">🌡️ Temperature First (High Heat Relief)</option>
                    <option value="co2_enrichment">💨 CO₂ Enrichment (Bottled Gas Retention)</option>
                  </select>
                </div>

                {/* Live Active Conflict Protection & Interlocks Banner */}
                {currentTent.activeInterlocks && currentTent.activeInterlocks.length > 0 ? (
                  <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-lg p-2 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-[11px]">
                      <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Active Controller Conflict Protections:</span>
                    </div>
                    <ul className="space-y-0.5 pl-5 list-disc text-[11px] text-zinc-300 font-mono">
                      {currentTent.activeInterlocks.map((msg, idx) => (
                        <li key={idx} className="leading-tight">{msg}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 font-mono bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-2.5 py-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Central Controller Interlock Active • All devices coordinated without fighting</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tent Microclimate Panel */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
                Tent Sensor Telemetry
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Temperature</span>
                  <span className="font-mono font-bold text-zinc-100">
                    {tempUnit === 'F' ? `${currentTent.climate.tempF.toFixed(1)}°F` : `${currentTent.climate.tempC.toFixed(1)}°C`}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Relative Humidity</span>
                  <span className="font-mono font-bold text-zinc-100">{currentTent.climate.rh}% RH</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Vapor Pressure Deficit</span>
                  <span className="font-mono font-bold text-emerald-400">{currentTent.climate.vpdKpa.toFixed(2)} kPa</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Canopy CO₂</span>
                  <span className="font-mono font-bold text-emerald-400">{currentTent.climate.co2Ppm || 600} PPM</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Canopy Light</span>
                  <span className="font-mono font-bold text-yellow-400">{currentTent.climate.lightPPFD} PPFD</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-800">
              <VpdBadge vpd={currentTent.climate.vpdKpa} target={isShroomTent ? 'mushroom' : 'plant'} showDetails />
            </div>
          </div>
        </div>

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

                      <div className="text-[11px] text-zinc-400 mb-2">
                        {item.species} · {item.strainName}
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

                      <div className="text-[11px] text-zinc-400 mb-2">
                        {item.species} · Flush #{item.flushCount}
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

        {/* Quick Item Deletion Confirmation Modal in Tent View */}
        {quickItemToDelete && (
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setQuickItemToDelete(null)}
          >
            <div 
              className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-zinc-100">
                    Remove Item from Tent
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Are you sure you want to remove <span className="font-semibold text-zinc-200">{quickItemToDelete.name}</span>?
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                This item will be removed from the tent immediately and its effects will cease.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickItemToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteItem(quickItemToDelete.id, quickItemToDelete.parentTentId);
                    setQuickItemToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-colors"
                >
                  Confirm Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                Delete {currentTent.name}?
              </h3>
              <p className="text-sm text-zinc-400 mt-2">
                This will remove the tent and all {currentTent.items.length} items (plants, mushrooms, and equipment) inside it.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDeleteTent(currentTent!.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors shadow-lg shadow-rose-900/30"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. RENDER INSPECTOR WHEN SPECIFIC ITEM IS SELECTED
  if (selectedType === 'item' && currentItem) {
    const parentName = currentTent ? currentTent.name : room.name;

    return (
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-6">
        {/* Breadcrumb Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <button 
              onClick={onSelectRoom}
              className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <Home className="w-3.5 h-3.5" /> {room.name}
            </button>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            {currentTent && (
              <>
                <button 
                  onClick={() => onSelectTent(currentTent!.id)}
                  className="hover:text-emerald-400 transition-colors"
                >
                  {currentTent.name}
                </button>
                <ChevronRight className="w-3 h-3 text-zinc-600" />
              </>
            )}
            <span className="text-emerald-400 font-semibold">{currentItem.name}</span>
          </div>

          <button
            onClick={() => {
              if (currentTent) onSelectTent(currentTent.id);
              else onSelectRoom();
            }}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to {parentName}
          </button>
        </div>

        {/* Item Title & Dimensions Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    className="bg-zinc-950 border border-emerald-500 rounded-lg px-2.5 py-1 text-sm font-bold text-zinc-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (editedName.trim() && currentItem) {
                        onUpdateItem({ ...currentItem, name: editedName.trim() }, selectedParentTentId);
                      }
                      setIsEditingName(false);
                    }}
                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-100">{currentItem.name}</h3>
                  <button
                    onClick={() => {
                      setEditedName(currentItem!.name);
                      setIsEditingName(true);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-200"
                    title="Rename Item"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                title="Delete this Item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Editable Dimensions: L x W x H */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  Item Dimensions (L × W × H)
                </span>
                <span className="font-mono text-emerald-400 text-xs">
                  Footprint: {(currentItem.dimensions.length * currentItem.dimensions.width).toFixed(2)} sq ft
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Length ({currentItem.dimensions.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="20"
                    value={currentItem.dimensions.length}
                    onChange={e => handleItemDimensionChange('length', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Width ({currentItem.dimensions.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="20"
                    value={currentItem.dimensions.width}
                    onChange={e => handleItemDimensionChange('width', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Height ({currentItem.dimensions.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="20"
                    value={currentItem.dimensions.height}
                    onChange={e => handleItemDimensionChange('height', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Notes Field */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Cultivator Notes
              </label>
              <textarea
                value={currentItem.notes || ''}
                onChange={e => {
                  if (currentItem) {
                    onUpdateItem({
                      ...currentItem,
                      notes: e.target.value
                    }, selectedParentTentId);
                  }
                }}
                placeholder="Log nutrient feedings, training techniques, or observations..."
                className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Location & Move Card */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
                Placement Location
              </span>
              <div className="text-xs text-zinc-300 space-y-2">
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Current Container:</span>
                  <span className="font-semibold text-emerald-400">{parentName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-850">
                  <span className="text-zinc-400">Category:</span>
                  <span className="font-mono capitalize text-zinc-200">{currentItem.category}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400">
              <span>All changes automatically saved to browser storage.</span>
            </div>
          </div>
        </div>

        {/* SPECIFIC ACTIONS & GAUGES BASED ON ITEM TYPE */}
        {currentItem.category === 'plant' && (() => {
          const plant = currentItem as PlantItem;
          const enclosureClimate = currentTent?.climate || room.climate;
          const isSeed = (plant.propagationType || 'seed') === 'seed';
          
          // Get photoperiod hours
          const growLight = (currentTent?.items || room.items).find(i => i.category === 'equipment' && i.type === 'grow_light') as EquipmentItem | undefined;
          let photoperiodHours = 18;
          if (growLight?.schedule?.enabled) {
            const on = growLight.schedule.onHour;
            const off = growLight.schedule.offHour;
            photoperiodHours = off > on ? (off - on) : (24 - on + off);
          } else if (growLight && !growLight.powerOn) {
            photoperiodHours = 0;
          } else if (growLight && growLight.powerOn) {
            photoperiodHours = 24;
          }

          // Evaluate live suitability
          const suitability = evaluatePlantStageSuitability(
            plant,
            enclosureClimate,
            plant.rootTempF || 68,
            photoperiodHours
          );

          // Expected days for current stage
          let expectedDays = DEFAULT_STAGE_DURATIONS[plant.stage] || 30;
          if (plant.stage === 'germination' && plant.germinationDaysExpected) expectedDays = plant.germinationDaysExpected;
          else if (plant.stage === 'rooting' && plant.rootingDaysExpected) expectedDays = plant.rootingDaysExpected;
          else if (plant.stage === 'seedling' && plant.seedlingDaysExpected) expectedDays = plant.seedlingDaysExpected;
          else if (plant.stage === 'mature_seedling' && plant.matureSeedlingDaysExpected) expectedDays = plant.matureSeedlingDaysExpected;
          else if (plant.stage === 'vegetative' && plant.vegetativeDaysExpected) expectedDays = plant.vegetativeDaysExpected;
          else if (plant.stage === 'flowering' && plant.floweringDaysExpected) expectedDays = plant.floweringDaysExpected;
          else if (plant.stage === 'ripening' && plant.ripeningDaysExpected) expectedDays = plant.ripeningDaysExpected;

          const currentStageDays = plant.currentStageDays || 0;
          const req = plant.stageRequirements?.[plant.stage] || DEFAULT_STAGE_REQUIREMENTS[plant.stage];

          const milestones = [
            {
              id: 'planted',
              label: isSeed ? 'Planted for Germination' : 'Cutting Taken for Rooting',
              date: plant.keyDates?.plantedDate,
              icon: isSeed ? '🌱' : '✂️',
              reached: true
            },
            {
              id: isSeed ? 'sprouted' : 'rooted',
              label: isSeed ? 'Sprouted / Emerged' : 'Roots Struck / Callus',
              date: isSeed ? plant.keyDates?.sproutedDate : plant.keyDates?.rootedDate,
              icon: '🌱',
              reached: Boolean(isSeed ? plant.keyDates?.sproutedDate : plant.keyDates?.rootedDate) || (plant.stage !== 'germination' && plant.stage !== 'rooting')
            },
            {
              id: 'seedling',
              label: 'Early Seedling',
              date: plant.keyDates?.seedlingDate,
              icon: '🌿',
              reached: Boolean(plant.keyDates?.seedlingDate) || (plant.stage !== 'germination' && plant.stage !== 'rooting')
            },
            {
              id: 'mature_seedling',
              label: 'Mature Seedling',
              date: plant.keyDates?.matureSeedlingDate,
              icon: '🪴',
              reached: Boolean(plant.keyDates?.matureSeedlingDate) || ['vegetative', 'flowering', 'ripening', 'ready'].includes(plant.stage)
            },
            {
              id: 'vegetative',
              label: 'Vegetative Canopy',
              date: plant.keyDates?.vegetativeDate,
              icon: '🌿',
              reached: Boolean(plant.keyDates?.vegetativeDate) || ['flowering', 'ripening', 'ready'].includes(plant.stage)
            },
            {
              id: 'flowering',
              label: 'Flowering Bloom',
              date: plant.keyDates?.floweringDate,
              icon: '🌸',
              reached: Boolean(plant.keyDates?.floweringDate) || ['ripening', 'ready'].includes(plant.stage)
            },
            {
              id: 'ripening',
              label: 'Ripening / Trichomes',
              date: plant.keyDates?.ripeningDate,
              icon: '✨',
              reached: Boolean(plant.keyDates?.ripeningDate) || plant.stage === 'ready'
            },
            {
              id: 'ready',
              label: 'Ready for Harvest',
              date: plant.keyDates?.readyDate,
              icon: '🏆',
              reached: Boolean(plant.keyDates?.readyDate) || plant.stage === 'ready'
            }
          ];

          return (
            <div className="space-y-4">
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

              {/* 2. Key Dates & Botanical Lifecycle Timeline Card */}
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
                  <span className="text-zinc-400 text-[11px]">Manual Lifecycle Stage Controls:</span>
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

              {/* 3. Stage Conditions vs Live Enclosure Environment Audit */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">
                        Stage Condition Requirements &amp; Live Physics Audit
                      </h4>
                      <p className="text-[11px] text-zinc-400">{req.summary}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                    suitability.status === 'optimal'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : suitability.status === 'acceptable'
                        ? 'bg-teal-950 text-teal-300 border border-teal-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
                    {suitability.overallScore.toFixed(2)}x Growth Rate ({suitability.status.toUpperCase()})
                  </span>
                </div>

                {/* Audit Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  {/* Temp */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Air Temp</span>
                    <div className="font-mono font-bold text-zinc-100 text-sm">
                      {enclosureClimate.tempF.toFixed(1)}°F
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      Target: {req.tempMinF}-{req.tempMaxF}°F
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.tempStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-rose-950 text-rose-400'
                    }`}>
                      {suitability.tempStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {/* Humidity */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Humidity (RH)</span>
                    <div className="font-mono font-bold text-zinc-100 text-sm">
                      {enclosureClimate.rh}%
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      Target: {req.rhMin}-{req.rhMax}%
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.rhStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-amber-950 text-amber-400'
                    }`}>
                      {suitability.rhStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {/* VPD */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">VPD Deficit</span>
                    <div className="font-mono font-bold text-zinc-100 text-sm">
                      {enclosureClimate.vpdKpa} kPa
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      Target: {req.vpdMin}-{req.vpdMax} kPa
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.vpdStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-amber-950 text-amber-400'
                    }`}>
                      {suitability.vpdStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {/* PPFD */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Light PPFD</span>
                    <div className="font-mono font-bold text-zinc-100 text-sm">
                      {enclosureClimate.lightPPFD} μmol
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      Opt: ~{req.ppfdOptimal} μmol
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.ppfdStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-rose-950 text-rose-400'
                    }`}>
                      {suitability.ppfdStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {/* Root Zone */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Root Zone Temp</span>
                    <div className="font-mono font-bold text-zinc-100 text-sm">
                      {(plant.rootTempF || 68).toFixed(1)}°F
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      Target: 68-75°F
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.rootTempStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-amber-950 text-amber-400'
                    }`}>
                      {suitability.rootTempStatus.toUpperCase()}
                    </span>
                  </div>

                  {/* Photoperiod */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
                    <span className="text-[10px] text-zinc-400 font-medium block">Photoperiod</span>
                    <div className="font-mono font-bold text-zinc-100 text-sm">
                      {photoperiodHours}h Light
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      Req: {req.targetPhotoperiodHours}h Light
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.photoperiodStatus === 'aligned' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-rose-950 text-rose-400'
                    }`}>
                      {suitability.photoperiodStatus === 'aligned' ? 'ALIGNED' : 'MISALIGNED'}
                    </span>
                  </div>
                </div>

                {suitability.limitingFactor && (
                  <div className="p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                    <span className="font-bold">⚠️ Limiting Factor:</span>
                    <span>{suitability.limitingFactor}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {currentItem.category === 'mushroom' && (
          <div className="bg-zinc-950/80 border border-amber-950 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold text-zinc-100">Mycology Substrate, Respiration &amp; FAE</h4>
              </div>
              <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                Stage: {currentItem.stage} ({currentItem.stageProgress.toFixed(0)}%)
              </span>
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
          </div>
        )}

        {currentItem.category === 'equipment' && (() => {
          const eq = currentItem as EquipmentItem;
          const currentMode = eq.controlMode || 'auto';
          const triggers = eq.autoTriggers || {};

          // Helper for hour labels
          const formatHour = (h: number) => {
            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const ampm = h < 12 ? 'AM' : 'PM';
            return `${h.toString().padStart(2, '0')}:00 (${h12} ${ampm})`;
          };

          // Calculate daylight hours
          const onH = eq.schedule?.onHour ?? 6;
          const offH = eq.schedule?.offHour ?? 0;
          let dayLength = offH >= onH ? offH - onH : (24 - onH + offH);
          if (dayLength === 0) dayLength = 24;
          const nightLength = 24 - dayLength;

          return (
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-4">
              {/* Header with Power Switch & Controller Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${eq.powerOn ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      {eq.name}
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {eq.type.replace('_', ' ')}
                      </span>
                    </h4>
                    <span className="text-xs text-zinc-400 font-mono">
                      Rated Draw: {eq.powerWatts}W • Actual: {Math.round(eq.powerWatts * ((eq.effectiveSetting ?? eq.setting) / 100))}W
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onUpdateItem({
                        ...eq,
                        powerOn: !eq.powerOn
                      }, selectedParentTentId);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                      eq.powerOn
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 ring-1 ring-emerald-400/50'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{eq.powerOn ? 'POWER: ON' : 'POWER: OFF'}</span>
                  </button>
                </div>
              </div>

              {/* Central Controller Arbitration Status Banner */}
              {eq.powerOn && (
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-zinc-300">Controller State:</span>
                      <p className="text-[11px] font-mono text-zinc-400">
                        {eq.interlockStatus || (eq.effectiveSetting !== undefined ? `Running at ${eq.effectiveSetting}% output` : 'Active and responding')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400">Effective Output:</span>
                    <span className={`font-mono text-sm font-bold px-2.5 py-0.5 rounded ${
                      (eq.effectiveSetting ?? eq.setting) > 0 
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {eq.effectiveSetting ?? eq.setting}%
                    </span>
                  </div>
                </div>
              )}

              {/* 1. GROW LIGHT PHOTOPERIOD & DIMMER CONTROLS */}
              {eq.type === 'grow_light' && (
                <div className="space-y-4">
                  {/* Master Dimming Slider */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between text-xs text-zinc-200">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Sun className="w-4 h-4 text-amber-400" />
                        LED Intensity Dimmer
                      </span>
                      <span className="font-mono font-bold text-amber-400">{eq.setting}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={eq.setting}
                      onChange={e => {
                        onUpdateItem({
                          ...eq,
                          setting: parseInt(e.target.value)
                        }, selectedParentTentId);
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                      <span>Low Propagation (20-40%)</span>
                      <span>Vegetative (50-70%)</span>
                      <span>Peak Bloom (80-100%)</span>
                    </div>
                  </div>

                  {/* Fully Editable Schedule Controls */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Light Photoperiod Schedule</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateItem({
                              ...eq,
                              schedule: {
                                enabled: !(eq.schedule?.enabled ?? true),
                                onHour: eq.schedule?.onHour ?? 6,
                                offHour: eq.schedule?.offHour ?? 0
                              }
                            }, selectedParentTentId);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                            (eq.schedule?.enabled ?? true)
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {(eq.schedule?.enabled ?? true) ? 'Schedule: ACTIVE' : 'Schedule: 24/0 ALWAYS ON'}
                        </button>
                      </div>
                    </div>

                    {(eq.schedule?.enabled ?? true) && (
                      <div className="space-y-3 pt-1">
                        {/* Day/Night Ratio Badge */}
                        <div className="flex items-center justify-between bg-zinc-950/70 border border-zinc-800 rounded-lg p-2.5 text-xs">
                          <span className="text-zinc-400">Calculated Photoperiod:</span>
                          <span className="font-mono font-bold text-amber-300">
                            ☀️ {dayLength}h DAY / 🌙 {nightLength}h NIGHT
                          </span>
                        </div>

                        {/* Exact On / Off Hour Selectors */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                              <span>Light Turn-ON Time</span>
                            </label>
                            <select
                              value={eq.schedule?.onHour ?? 6}
                              onChange={e => {
                                const newOn = parseInt(e.target.value);
                                onUpdateItem({
                                  ...eq,
                                  schedule: {
                                    enabled: true,
                                    onHour: newOn,
                                    offHour: eq.schedule?.offHour ?? 0
                                  }
                                }, selectedParentTentId);
                              }}
                              className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none"
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>
                                  {formatHour(i)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                              <span>Light Turn-OFF Time</span>
                            </label>
                            <select
                              value={eq.schedule?.offHour ?? 0}
                              onChange={e => {
                                const newOff = parseInt(e.target.value);
                                onUpdateItem({
                                  ...eq,
                                  schedule: {
                                    enabled: true,
                                    onHour: eq.schedule?.onHour ?? 6,
                                    offHour: newOff
                                  }
                                }, selectedParentTentId);
                              }}
                              className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none"
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>
                                  {formatHour(i)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Quick Presets:</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {[
                              { label: '18/6 Veg', on: 6, off: 0 },
                              { label: '12/12 Bloom', on: 8, off: 20 },
                              { label: '20/4 Auto', on: 4, off: 0 },
                              { label: '10/14 Ripen', on: 9, off: 19 },
                              { label: '12/12 Myco', on: 7, off: 19 },
                            ].map(preset => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  onUpdateItem({
                                    ...eq,
                                    schedule: { enabled: true, onHour: preset.on, offHour: preset.off }
                                  }, selectedParentTentId);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                                  eq.schedule?.enabled && eq.schedule.onHour === preset.on && eq.schedule.offHour === preset.off
                                    ? 'bg-amber-500 text-black font-bold'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. EXHAUST FAN INTELLIGENT TRIGGERS & CONFLICT SAFEGUARDS */}
              {eq.type === 'exhaust_fan' && (
                <div className="space-y-4">
                  {/* Mode Selector Tabs */}
                  <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateItem({
                          ...eq,
                          controlMode: 'auto'
                        }, selectedParentTentId);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        currentMode === 'auto'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Smart Auto Triggers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateItem({
                          ...eq,
                          controlMode: 'cycle'
                        }, selectedParentTentId);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        currentMode === 'cycle'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Timer className="w-3.5 h-3.5" />
                      <span>FAE Cycle Timer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateItem({
                          ...eq,
                          controlMode: 'manual'
                        }, selectedParentTentId);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        currentMode === 'manual'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Manual Fixed Speed</span>
                    </button>
                  </div>

                  {/* AUTO SMART TRIGGER SETPOINTS */}
                  {currentMode === 'auto' && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div>
                        <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                          Environmental Trigger Setpoints (Intelligent Activation)
                        </h5>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Fan automatically turns on or ramps speed only when canopy needs heat evacuation, excess humidity venting, or fresh CO₂ exchange.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {/* High Temp Trigger */}
                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-300 flex items-center gap-1">
                              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                              High Temp Trigger
                            </span>
                            <span className="font-mono font-bold text-rose-400">{triggers.tempTriggerHighF ?? 78}°F</span>
                          </div>
                          <input
                            type="range"
                            min="68"
                            max="90"
                            value={triggers.tempTriggerHighF ?? 78}
                            onChange={e => {
                              onUpdateItem({
                                ...eq,
                                autoTriggers: {
                                  ...triggers,
                                  tempTriggerHighF: parseInt(e.target.value)
                                }
                              }, selectedParentTentId);
                            }}
                            className="w-full accent-rose-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-zinc-500 block">Ramps speed to exhaust excess heat to lung room</span>
                        </div>

                        {/* High RH Trigger */}
                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-300 flex items-center gap-1">
                              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                              High Humidity Trigger
                            </span>
                            <span className="font-mono font-bold text-cyan-400">{triggers.rhTriggerHigh ?? 68}% RH</span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="98"
                            value={triggers.rhTriggerHigh ?? 68}
                            onChange={e => {
                              onUpdateItem({
                                ...eq,
                                autoTriggers: {
                                  ...triggers,
                                  rhTriggerHigh: parseInt(e.target.value)
                                }
                              }, selectedParentTentId);
                            }}
                            className="w-full accent-cyan-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-zinc-500 block">Exhausts wet air if canopy exceeds ceiling limit</span>
                        </div>

                        {/* Low RH Floor Protection */}
                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-300 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                              Low RH Safeguard Floor
                            </span>
                            <span className="font-mono font-bold text-teal-400">{triggers.rhTriggerLow ?? 45}% RH</span>
                          </div>
                          <input
                            type="range"
                            min="30"
                            max="90"
                            value={triggers.rhTriggerLow ?? 45}
                            onChange={e => {
                              onUpdateItem({
                                ...eq,
                                autoTriggers: {
                                  ...triggers,
                                  rhTriggerLow: parseInt(e.target.value)
                                }
                              }, selectedParentTentId);
                            }}
                            className="w-full accent-teal-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-zinc-500 block">Throttles fan down if tent is dry to prevent desiccation</span>
                        </div>

                        {/* High CO2 Trigger (FAE for mushrooms) */}
                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-300 flex items-center gap-1">
                              <Wind className="w-3.5 h-3.5 text-purple-400" />
                              High CO₂ FAE Trigger
                            </span>
                            <span className="font-mono font-bold text-purple-400">{triggers.co2TriggerHighPpm ?? 950} PPM</span>
                          </div>
                          <input
                            type="range"
                            min="600"
                            max="2000"
                            step="50"
                            value={triggers.co2TriggerHighPpm ?? 950}
                            onChange={e => {
                              onUpdateItem({
                                ...eq,
                                autoTriggers: {
                                  ...triggers,
                                  co2TriggerHighPpm: parseInt(e.target.value)
                                }
                              }, selectedParentTentId);
                            }}
                            className="w-full accent-purple-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-zinc-500 block">Evacuates heavy CO2 to trigger healthy mushroom pinheads</span>
                        </div>
                      </div>

                      {/* Speed Bounds */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
                        <div>
                          <div className="flex justify-between text-xs text-zinc-400 mb-1">
                            <span>Idle Min Speed</span>
                            <span className="font-mono font-bold text-zinc-200">{triggers.minSpeedPercent ?? 0}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            value={triggers.minSpeedPercent ?? 0}
                            onChange={e => {
                              onUpdateItem({
                                ...eq,
                                autoTriggers: {
                                  ...triggers,
                                  minSpeedPercent: parseInt(e.target.value)
                                }
                              }, selectedParentTentId);
                            }}
                            className="w-full accent-emerald-500 cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-zinc-400 mb-1">
                            <span>Max Speed Ceiling</span>
                            <span className="font-mono font-bold text-zinc-200">{triggers.maxSpeedPercent ?? eq.setting}%</span>
                          </div>
                          <input
                            type="range"
                            min="30"
                            max="100"
                            value={triggers.maxSpeedPercent ?? eq.setting}
                            onChange={e => {
                              const val = parseInt(e.target.value);
                              onUpdateItem({
                                ...eq,
                                setting: val,
                                autoTriggers: {
                                  ...triggers,
                                  maxSpeedPercent: val
                                }
                              }, selectedParentTentId);
                            }}
                            className="w-full accent-emerald-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CYCLE TIMER CONTROLS */}
                  {currentMode === 'cycle' && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                      <div>
                        <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                          <Timer className="w-4 h-4 text-emerald-400" />
                          Intermittent FAE Cycle Timing
                        </h5>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Runs for X minutes every Y minutes to refresh oxygen without exhausting humidity.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-1">
                          <label className="text-[10px] font-mono text-zinc-400 uppercase">Run Duration (Mins)</label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={triggers.cycleOnMinutes ?? 3}
                            onChange={e => {
                              onUpdateItem({
                                ...eq,
                                autoTriggers: {
                                  ...triggers,
                                  cycleOnMinutes: Math.max(1, parseInt(e.target.value) || 1)
                                }
                              }, selectedParentTentId);
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                          />
                        </div>

                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-1">
                          <label className="text-[10px] font-mono text-zinc-400 uppercase">Pause Interval (Mins)</label>
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={triggers.cycleOffMinutes ?? 15}
                            onChange={e => {
                              onUpdateItem({
                                ...eq,
                                autoTriggers: {
                                  ...triggers,
                                  cycleOffMinutes: Math.max(1, parseInt(e.target.value) || 1)
                                }
                              }, selectedParentTentId);
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                          />
                        </div>

                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-1">
                          <label className="text-[10px] font-mono text-zinc-400 uppercase">Pulse Speed Setting</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="10"
                              max="100"
                              value={eq.setting}
                              onChange={e => {
                                onUpdateItem({
                                  ...eq,
                                  setting: parseInt(e.target.value)
                                }, selectedParentTentId);
                              }}
                              className="w-full accent-emerald-500 cursor-pointer"
                            />
                            <span className="font-mono text-xs font-bold text-emerald-400">{eq.setting}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MANUAL SPEED SLIDER */}
                  {currentMode === 'manual' && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex justify-between text-xs text-zinc-300">
                        <span>Fixed Manual Fan Speed</span>
                        <span className="font-mono font-bold text-emerald-400">{eq.setting}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={eq.setting}
                        onChange={e => {
                          onUpdateItem({
                            ...eq,
                            setting: parseInt(e.target.value)
                          }, selectedParentTentId);
                        }}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-zinc-500 block">
                        Runs continuously at this fixed percentage without automatic sensor modulation.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 3. HUMIDIFIER & DEHUMIDIFIER CONTROLS */}
              {(eq.type === 'humidifier' || eq.type === 'dehumidifier') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Target Humidity Set-Point</span>
                      <span className="font-mono font-bold text-cyan-400">{eq.targetRh ?? 60}% RH</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="98"
                      value={eq.targetRh ?? 60}
                      onChange={e => {
                        onUpdateItem({
                          ...eq,
                          targetRh: parseInt(e.target.value)
                        }, selectedParentTentId);
                      }}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                      <span>Veg (60-70%)</span>
                      <span>Flower (45-55%)</span>
                      <span>Mushroom (85-95%)</span>
                    </div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Output Mist Rate / Capacity</span>
                      <span className="font-mono font-bold text-cyan-400">{eq.setting}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={eq.setting}
                      onChange={e => {
                        onUpdateItem({
                          ...eq,
                          setting: parseInt(e.target.value)
                        }, selectedParentTentId);
                      }}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      Power Consumption: {Math.round(eq.powerWatts * (eq.setting / 100))} Watts
                    </span>
                  </div>
                </div>
              )}

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
            </div>
          );
        })()}

        {/* SPECIFIC ACTIONS & GAUGES FOR PERSON */}
        {currentItem.category === 'person' && (() => {
          const person = currentItem as PersonItem;
          return (
            <div className="bg-zinc-950/80 border border-violet-950 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-violet-400" />
                  <h4 className="text-sm font-bold text-zinc-100">Biological Human Occupant &amp; Respiration</h4>
                </div>
                <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800 font-semibold">
                  Activity: {person.activity}
                </span>
              </div>

              {/* Occupant Respiration Telemetry Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>CO₂ Exhalation Rate</span>
                    <span className="font-mono font-bold text-violet-400">{person.co2RateLitersPerHour} L/hr</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Adds natural atmospheric carbon dioxide to {parentName} during cellular respiration.
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Metabolic Body Heat</span>
                    <span className="font-mono font-bold text-amber-400">{person.heatOutputWatts} Watts</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Thermal radiation contributes sensible heat to the enclosure's energy balance.
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Perspiration &amp; Vapor</span>
                    <span className="font-mono font-bold text-cyan-400">{person.moistureLitersPerDay} L/day</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Breath vapor and perspiration adds gentle humidity to indoor air.
                  </div>
                </div>
              </div>

              {/* Activity Level Selector */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                <label className="text-xs font-semibold text-zinc-200 block">
                  Adjust Physical Activity Level:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { level: 'resting', label: 'Resting / Seated', co2: 15, watts: 75, moisture: 0.8 },
                    { level: 'normal', label: 'Normal Inspection', co2: 22, watts: 100, moisture: 1.2 },
                    { level: 'active', label: 'Active Trellising', co2: 32, watts: 140, moisture: 1.8 },
                    { level: 'exercising', label: 'Heavy Exertion', co2: 50, watts: 210, moisture: 2.5 },
                  ].map(spec => (
                    <button
                      key={spec.level}
                      type="button"
                      onClick={() => {
                        onUpdateItem({
                          ...person,
                          activity: spec.level as PersonActivity,
                          co2RateLitersPerHour: spec.co2,
                          heatOutputWatts: spec.watts,
                          moistureLitersPerDay: spec.moisture,
                          notes: `Biological occupant (${spec.label}) exhaling ~${spec.co2} L/hr CO₂ with ${spec.watts}W heat.`
                        }, selectedParentTentId);
                      }}
                      className={`p-2 rounded-xl text-xs text-left border transition-all ${
                        person.activity === spec.level
                          ? 'bg-violet-950 border-violet-500 text-violet-200 ring-1 ring-violet-500'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      <span className="font-semibold block">{spec.label}</span>
                      <span className="font-mono text-[10px] text-zinc-400 block mt-0.5">{spec.co2} L/h · {spec.watts}W</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Removal Button Banner */}
              <div className="flex items-center justify-between p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-rose-300 block">Remove Person from Facility</span>
                  <span className="text-[11px] text-zinc-400">Biological respiration and body heat emission will immediately stop.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove Person</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* SPECIFIC ACTIONS & GAUGES FOR PET */}
        {currentItem.category === 'pet' && (() => {
          const pet = currentItem as PetItem;
          return (
            <div className="bg-zinc-950/80 border border-rose-950 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  {pet.petType === 'cat' ? <Cat className="w-5 h-5 text-rose-400" /> : <Dog className="w-5 h-5 text-rose-400" />}
                  <h4 className="text-sm font-bold text-zinc-100">Biological Pet Companion &amp; Respiration</h4>
                </div>
                <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
                  {pet.petType.replace('_', ' ')}
                </span>
              </div>

              {/* Pet Telemetry Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>CO₂ Exhalation Rate</span>
                    <span className="font-mono font-bold text-rose-400">{pet.co2RateLitersPerHour} L/hr</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Naturally exhales carbon dioxide into {parentName} during breath cycles.
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Body Warmth</span>
                    <span className="font-mono font-bold text-amber-400">{pet.heatOutputWatts} Watts</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Radiates warm body temperature into the ambient air.
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Respiration Vapor</span>
                    <span className="font-mono font-bold text-cyan-400">{pet.moistureLitersPerDay} L/day</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Exhaled breath vapor slightly modulates indoor humidity.
                  </div>
                </div>
              </div>

              {/* Pet Type Selector */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                <label className="text-xs font-semibold text-zinc-200 block">
                  Adjust Pet Classification:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'dog_large', label: 'Large Dog (50-85 lbs)', co2: 10, watts: 45, moisture: 0.6 },
                    { type: 'dog_medium', label: 'Medium Dog (25-50 lbs)', co2: 6, watts: 28, moisture: 0.4 },
                    { type: 'dog_small', label: 'Small Dog (<25 lbs)', co2: 3.5, watts: 18, moisture: 0.25 },
                    { type: 'cat', label: 'Domestic Cat (8-15 lbs)', co2: 2.2, watts: 12, moisture: 0.18 },
                  ].map(spec => (
                    <button
                      key={spec.type}
                      type="button"
                      onClick={() => {
                        onUpdateItem({
                          ...pet,
                          petType: spec.type as PetType,
                          co2RateLitersPerHour: spec.co2,
                          heatOutputWatts: spec.watts,
                          moistureLitersPerDay: spec.moisture,
                          notes: `Pet occupant (${spec.label}) exhaling ~${spec.co2} L/hr CO₂ with ${spec.watts}W heat.`
                        }, selectedParentTentId);
                      }}
                      className={`p-2 rounded-xl text-xs text-left border transition-all ${
                        pet.petType === spec.type
                          ? 'bg-rose-950 border-rose-500 text-rose-200 ring-1 ring-rose-500'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      <span className="font-semibold block">{spec.label.split(' ')[0]} {spec.label.split(' ')[1]}</span>
                      <span className="font-mono text-[10px] text-zinc-400 block mt-0.5">{spec.co2} L/h · {spec.watts}W</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Removal Button Banner */}
              <div className="flex items-center justify-between p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-rose-300 block">Remove Pet from Facility</span>
                  <span className="text-[11px] text-zinc-400">Biological respiration and body heat emission will immediately stop.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove Pet</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                Delete {currentItem.name}?
              </h3>
              <p className="text-sm text-zinc-400 mt-2">
                Are you sure you want to remove this {currentItem.category} from {parentName}?
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDeleteItem(currentItem!.id, selectedParentTentId);
                    setShowDeleteConfirm(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors shadow-lg shadow-rose-900/30"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Room Confirmation Modal */}
        {showDeleteRoomConfirm && onDeleteRoom && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                Delete Room: {room.name}?
              </h3>
              <p className="text-sm text-zinc-400 mt-2">
                Are you sure you want to delete this room? All {room.tents.length} tents, crops, mushrooms, and equipment located in this room will be permanently removed.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteRoomConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteRoom(room.id);
                    setShowDeleteRoomConfirm(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors shadow-lg shadow-rose-900/30"
                >
                  Confirm Delete Room
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

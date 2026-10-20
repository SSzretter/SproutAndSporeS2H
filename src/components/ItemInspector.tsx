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
  Heart
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
  ConstructionStandard 
} from '../types/sim';
import { VpdBadge } from './VpdBadge';
import { TENT_CATALOG } from '../utils/tentCatalog';

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
}

export const ItemInspector: React.FC<ItemInspectorProps> = ({
  room,
  rooms = [],
  outdoorCo2Ppm = 420,
  selectedType,
  selectedId,
  selectedParentTentId,
  tempUnit,
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
              <span className="text-xs text-zinc-400 font-mono">
                {room.tents.length} Tents Active · {room.items.length} Direct Items
              </span>
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
                    <span>Outdoor Ambient CO₂ Baseline:</span>
                    {onOpenLocationModal ? (
                      <button
                        onClick={onOpenLocationModal}
                        className="font-mono text-sky-400 font-bold hover:text-sky-300 hover:bg-sky-950/40 border border-sky-800/50 rounded px-2 py-0.5 transition-colors text-xs"
                        title="Click to edit Outdoor Atmospheric CO₂ in the Location modal"
                      >
                        {outdoorCo2Ppm || 420} PPM
                      </button>
                    ) : (
                      <span className="font-mono text-emerald-400 font-bold">{outdoorCo2Ppm || 420} PPM</span>
                    )}
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

            {/* Exhaust Fan Master Speed & Lung Air Exchange */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-400" />
                <div>
                  <span className="text-xs font-semibold text-zinc-200">Exhaust Air Exchange with Host Room</span>
                  <p className="text-[10px] text-zinc-450">Pulls conditioned lung room air in through mesh bottom intakes</p>
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
                <span className="font-mono text-xs font-bold text-emerald-400 w-9 text-right">
                  {currentTent.exhaustFanSpeed}%
                </span>
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
        {currentItem.category === 'plant' && (
          <div className="bg-zinc-950/80 border border-emerald-950 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Flower2 className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-zinc-100">Botanical Vigor, Roots &amp; Photosynthesis</h4>
              </div>
              <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                Stage: {currentItem.stage} ({currentItem.stageProgress.toFixed(0)}%)
              </span>
            </div>

            {/* Meters Grid: Health, Soil Moisture, Root Zone Temp, and CO2 Photosynthesis */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Plant Health</span>
                  <span className="font-mono font-bold text-emerald-400">{currentItem.health}%</span>
                </div>
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      currentItem.health > 80 ? 'bg-emerald-500' : currentItem.health > 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`} 
                    style={{ width: `${currentItem.health}%` }} 
                  />
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  {currentItem.health > 85 ? 'Vigorous cellular respiration' : 'Slight stress detected'}
                </span>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Soil Moisture</span>
                  <span className="font-mono font-bold text-cyan-400">{currentItem.soilMoisture.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 rounded-full transition-all"
                    style={{ width: `${currentItem.soilMoisture}%` }} 
                  />
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  {currentItem.soilMoisture < 25 ? '⚠️ Soil dry! Water required' : 'Optimal root zone hydration'}
                </span>
              </div>

              {/* ROOT ZONE TEMPERATURE */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Root Zone Temp</span>
                  <span className="font-mono font-bold text-amber-400">
                    {currentItem.rootTempF ? `${currentItem.rootTempF.toFixed(1)}°F` : '68.0°F'}
                  </span>
                </div>
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${Math.max(10, Math.min(100, ((currentItem.rootTempF || 68) - 50) * 2.5))}%` }} 
                  />
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  {(currentItem.rootTempF || 68) >= 65 && (currentItem.rootTempF || 68) <= 72 
                    ? '✓ Ideal nutrient absorption' 
                    : (currentItem.rootTempF || 68) < 65 
                      ? '❄ Chilly root zone' 
                      : '▲ Warm root zone'}
                </span>
              </div>

              {/* CO2 PHOTOSYNTHESIS STATUS */}
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
                  Yield: {currentItem.yieldPotentialGrams.toFixed(0)}g
                </span>
              </div>
            </div>

            {/* Interactive Crop Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  onUpdateItem({
                    ...currentItem,
                    soilMoisture: Math.min(95, currentItem.soilMoisture + 35),
                    rootTempF: Math.max(65, ((currentItem as PlantItem).rootTempF || 70) - 2.5),
                    health: Math.min(100, currentItem.health + 5),
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
                    ...currentItem,
                    soilMoisture: Math.min(95, currentItem.soilMoisture + 20),
                    nutrientLevel: 'balanced',
                    health: Math.min(100, currentItem.health + 8),
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
                    ...currentItem,
                    canopyWidthInches: currentItem.canopyWidthInches + 2.5,
                    yieldPotentialGrams: currentItem.yieldPotentialGrams + 15,
                  }, selectedParentTentId);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
              >
                <Scissors className="w-4 h-4 text-amber-400" />
                <span>Prune / Top Canopy</span>
              </button>

              <button
                onClick={() => {
                  onHarvestPlant(currentItem as PlantItem, currentTent?.id);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                  currentItem.stage === 'ready' || currentItem.stage === 'ripening'
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-950/50 animate-pulse'
                    : 'bg-zinc-800 hover:bg-amber-950/60 hover:text-amber-300 text-zinc-400 border border-zinc-700'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>Harvest Crop ({currentItem.yieldPotentialGrams.toFixed(0)}g)</span>
              </button>
            </div>
          </div>
        )}

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

        {currentItem.category === 'equipment' && (
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h4 className="text-sm font-bold text-zinc-100">Equipment Controls &amp; Settings</h4>
              </div>
              <button
                onClick={() => {
                  onUpdateItem({
                    ...currentItem,
                    powerOn: !currentItem.powerOn
                  }, selectedParentTentId);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  currentItem.powerOn
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                }`}
              >
                {currentItem.powerOn ? 'POWER: ON' : 'POWER: OFF'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Setting Slider */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>Output Power / Speed Setting</span>
                  <span className="font-mono font-bold text-emerald-400">{currentItem.setting}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentItem.setting}
                  onChange={e => {
                    onUpdateItem({
                      ...currentItem,
                      setting: parseInt(e.target.value)
                    }, selectedParentTentId);
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-zinc-500 block">
                  Power Consumption: {Math.round(currentItem.powerWatts * (currentItem.setting / 100))} Watts
                </span>
              </div>

              {/* CO2 Regulator Target Setpoint */}
              {currentItem.type === 'co2_regulator' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Target CO₂ Enriched Level</span>
                    <span className="font-mono font-bold text-emerald-400">{currentItem.targetCo2Ppm ?? 1200} PPM</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="2000"
                    step="50"
                    value={currentItem.targetCo2Ppm ?? 1200}
                    onChange={e => {
                      onUpdateItem({
                        ...currentItem,
                        targetCo2Ppm: parseInt(e.target.value)
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Atmospheric (420)</span>
                    <span>High PPFD Bloom (1200-1500)</span>
                  </div>
                </div>
              )}

              {/* Light Photoperiod Schedule */}
              {currentItem.type === 'grow_light' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Photoperiod Schedule</span>
                    <span className="font-mono text-amber-400 text-xs">
                      {currentItem.schedule?.enabled ? `${currentItem.schedule.onHour}:00 - ${currentItem.schedule.offHour}:00` : '24/0 Continuous'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => {
                        onUpdateItem({
                          ...currentItem,
                          schedule: { enabled: true, onHour: 6, offHour: 0 } // 18/6
                        }, selectedParentTentId);
                      }}
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-xs font-mono text-zinc-300"
                    >
                      18/6 (Veg)
                    </button>
                    <button
                      onClick={() => {
                        onUpdateItem({
                          ...currentItem,
                          schedule: { enabled: true, onHour: 8, offHour: 20 } // 12/12
                        }, selectedParentTentId);
                      }}
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-xs font-mono text-zinc-300"
                    >
                      12/12 (Bloom)
                    </button>
                    <button
                      onClick={() => {
                        onUpdateItem({
                          ...currentItem,
                          schedule: { enabled: false, onHour: 0, offHour: 24 } // 24/0
                        }, selectedParentTentId);
                      }}
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-xs font-mono text-zinc-300"
                    >
                      24/0 (Clone)
                    </button>
                  </div>
                </div>
              )}

              {/* Target RH for humidifiers/dehumidifiers */}
              {(currentItem.type === 'humidifier' || currentItem.type === 'dehumidifier') && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Target Humidity Set-Point</span>
                    <span className="font-mono font-bold text-cyan-400">{currentItem.targetRh ?? 60}% RH</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="95"
                    value={currentItem.targetRh ?? 60}
                    onChange={e => {
                      onUpdateItem({
                        ...currentItem,
                        targetRh: parseInt(e.target.value)
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Heater Thermostat */}
              {currentItem.type === 'heater' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Target Temperature</span>
                    <span className="font-mono font-bold text-amber-400">{currentItem.targetTempF ?? 74}°F</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="90"
                    value={currentItem.targetTempF ?? 74}
                    onChange={e => {
                      onUpdateItem({
                        ...currentItem,
                        targetTempF: parseInt(e.target.value)
                      }, selectedParentTentId);
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        )}

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
      </div>
    );
  }

  return null;
};

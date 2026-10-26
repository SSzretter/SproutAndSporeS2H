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
  Power,
  Move,
  MapPin,
  Dna,
  FlaskConical,
  Play
} from 'lucide-react';
import { CropGrowth3DViewer } from './game3d/CropGrowth3DViewer';
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
import { clampItemPosition } from '../utils/spatial';
import { getDuctTargetTent, HOSE_DELIVERY_EFFICIENCY, getReservoirLiters, getReservoirLevelL, isReservoirEmpty, getMistWaterUseLph, refillReservoir, getBucketCapacityL, getBucketLevelL, isBucketFull, getDehumidifierExtractionLph, emptyBucket, getMaxReservoirLiters, getMaxBucketCapacityL, canHeatMatAttachTo, describeHeatMatPlacement, getHeatMatTarget, isHeatMat } from '../utils/equipmentLinks';
import { INLINE_FAN_SPECS, INLINE_FAN_DUCT_SIZES } from '../utils/equipmentCatalog';
import { getPortableAcBtu, DEFAULT_REGISTER_CFM, REGISTER_COOL_SUPPLY_F, REGISTER_HEAT_SUPPLY_F } from '../utils/roomThermal';
import { PropagationType, PlantStage, PlantKeyDates, JournalEntry, JournalCategory } from '../types/sim';
import { evaluatePlantStageSuitability, DEFAULT_STAGE_REQUIREMENTS, DEFAULT_STAGE_DURATIONS, formatSimDateTime, getPepperCultivar } from '../utils/plantLifecycle';
import { generateSeedTraits, generateSporeTraits, getGeneticTier, SeedGeneticTraits, SporeGeneticTraits } from '../utils/genetics';

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
  onLogJournalEntry?: (entry: { title: string; message: string; type: JournalEntry['type']; category?: JournalCategory }) => void;
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
  onLogJournalEntry,
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
  const [show3dGrowthTimelapse, setShow3dGrowthTimelapse] = useState(false);

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
  // Crops (plants & mushrooms) edit their pot/container size; their overall dimensions are derived from it plus growth.
  const handleItemDimensionChange = (key: keyof Dimensions, value: number) => {
    if (!currentItem || isNaN(value) || value <= 0) return;
    if (currentItem.category === 'plant' || currentItem.category === 'mushroom') {
      const container = currentItem.containerDimensions || currentItem.dimensions;
      onUpdateItem({
        ...currentItem,
        containerDimensions: {
          ...container,
          [key]: parseFloat(value.toFixed(2))
        }
      }, selectedParentTentId);
      return;
    }
    onUpdateItem({
      ...currentItem,
      dimensions: {
        ...currentItem.dimensions,
        [key]: parseFloat(value.toFixed(1))
      }
    }, selectedParentTentId);
  };

  // Position change helper for Tent
  const handleTentPositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!currentTent || isNaN(value)) return;
    const currentPos = currentTent.position || { x: 2.5, y: 2.0, z: 0 };
    onUpdateTent({
      ...currentTent,
      position: {
        ...currentPos,
        [axis]: Math.max(0, parseFloat(value.toFixed(1)))
      }
    });
  };

  // Position change helper for Item
  const handleItemPositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!currentItem || isNaN(value)) return;
    const currentPos = currentItem.position || { x: 1.0, y: 1.0, z: 0 };
    const containerDims = currentTent ? currentTent.dimensions : room.dimensions;
    onUpdateItem({
      ...currentItem,
      position: clampItemPosition(
        { ...currentPos, [axis]: Math.max(0, parseFloat(value.toFixed(1))) },
        currentItem.dimensions,
        containerDims
      )
    }, selectedParentTentId);
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

            {/* PHYSICAL ENVIRONMENT SPECIFICATIONS (OUTDOOR GARDEN vs GREENHOUSE vs INDOOR ENVELOPE) */}
            {room.environmentType === 'outdoor_garden' ? (
              <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-400" />
                    Outdoor Garden &amp; Open Atmosphere Physics
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                    Open Sky · No Building Envelope
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Outdoor Microclimate & Terroir details */}
                  <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Solar Exposure:</span>
                      <span className="font-mono text-amber-300 font-semibold">100% Daylight (0–1600+ PPFD)</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Thermal Envelope:</span>
                      <span className="font-mono text-zinc-300 font-semibold">None (Direct Ambient Drift)</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Natural Precipitation:</span>
                      <span className="font-mono text-sky-300 font-semibold">Natural Rainfall Hydration</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Garden Configuration:</span>
                      <span className="font-mono text-emerald-400 capitalize">
                        {room.gardenConfig ? room.gardenConfig.replace(/_/g, ' ') : 'Hop Yard Trellis'}
                      </span>
                    </div>
                  </div>

                  {/* Atmospheric Circulation & Ambient CO2 */}
                  <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Air Circulation:</span>
                      <span className="font-mono text-zinc-200 font-semibold">Unrestricted Ambient Breeze</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Ambient Outdoor CO₂:</span>
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
                    <div className="text-[10px] text-emerald-300/80 bg-zinc-950/60 p-2 rounded border border-zinc-850">
                      Open-air garden: Crops transpire freely under outdoor solar PPFD, natural rain hydrates containers and soil, and temperatures mirror local ambient weather. No building envelope or heating / cooling equipment; it follows the local weather.
                    </div>
                  </div>
                </div>
              </div>
            ) : room.environmentType === 'greenhouse' ? (
              <div className="bg-teal-950/20 border border-teal-800/50 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    Solar Greenhouse &amp; Glazing Microclimate
                  </span>
                  <span className="text-[10px] font-mono text-teal-300 bg-teal-950/80 border border-teal-800 px-2 py-0.5 rounded">
                    Polycarbonate Glazing · Solar Gain
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Greenhouse Glazing Spec */}
                  <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Glazing Material:</span>
                      <span className="font-mono text-teal-300 font-semibold">Twin-Wall Polycarbonate (R-3)</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Solar Transmittance:</span>
                      <span className="font-mono text-zinc-200 font-semibold">82% Sunlight PPFD</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Passive Solar Heat Gain:</span>
                      <span className="font-mono text-amber-300 font-semibold">+1.5°F to +5.5°F Daylight Boost</span>
                    </div>
                  </div>

                  {/* Greenhouse Ventilation */}
                  <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Passive Ridge Louvers:</span>
                      <span className="font-mono text-zinc-200 font-semibold">2.0 ACH Natural Exchange</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Outdoor CO₂ Baseline:</span>
                      <span className="font-mono text-emerald-400 font-bold">{outdoorCo2Ppm} PPM</span>
                    </div>
                    <div className="text-[10px] text-teal-300/80 bg-zinc-950/60 p-2 rounded border border-zinc-850">
                      High-tunnel greenhouse: Shields crops from severe wind and excessive rain while harvesting natural solar photons and thermal gain.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* INDOOR ROOM: RESIDENTIAL BUILDING ENVELOPE & HVAC */
              <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-sky-400" />
                    Building Envelope &amp; {room.constructionStandard === 'modern_tight' ? 'Modern High-Performance' : room.constructionStandard === 'older_drafty' ? 'Older Home' : '2005 Colonial House'} Physics
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
                      <span className="font-mono text-zinc-200 font-semibold">R-{room.wallRValue || 19} (U-{(1 / Math.max(1, room.wallRValue || 19)).toFixed(3)})</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <span>Outdoor Air Infiltration:</span>
                      <span className="font-mono text-zinc-200 font-semibold">{room.airChangesPerHour || 0.35} ACH (Fresh Air)</span>
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

                  {/* Surroundings & the heating / cooling equipment actually in the room (no hidden HVAC) */}
                  <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                      <label htmlFor={`adjacent-${room.id}`}>Rest of house (adjacent spaces):</label>
                      <div className="flex items-center gap-1">
                        <input
                          id={`adjacent-${room.id}`}
                          type="number"
                          min="35"
                          max="95"
                          value={room.adjacentSpaceTempF ?? 70}
                          onChange={e => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) onUpdateRoom({ ...room, adjacentSpaceTempF: Math.max(35, Math.min(95, value)) });
                          }}
                          className="w-14 bg-zinc-950 border border-zinc-750 rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-zinc-200"
                        />
                        <span>°F</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-400 bg-zinc-950/60 p-2 rounded border border-zinc-850">
                      {(() => {
                        const climateGear = room.items.filter(i => i.category === 'equipment' && (i.type === 'heater' || i.type === 'portable_ac' || i.type === 'hvac_register'));
                        return climateGear.length === 0
                          ? 'No heating or cooling equipment: temperature drifts with the outdoors, the ground and the rest of the house, plus heat from lights and gear. Add a heater, portable A/C or HVAC register to control it.'
                          : `Heating / cooling: ${climateGear.map(i => i.name).join(', ')}.`;
                      })()}
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
                          return 'Unoccupied: room CO₂ comes from tent exhaust (mushroom respiration, CO₂ injection); outdoor air leaking in pulls it back toward the outdoor level.';
                        }
                        return `Active Occupancy: ${people.length} People, ${pets.length} Pets exhaling biological CO₂ and radiating body warmth into the lung room.`;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Room Live Climate Panel */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
                {room.environmentType === 'outdoor_garden' 
                  ? 'Garden Atmosphere Telemetry (Outdoor)' 
                  : room.environmentType === 'greenhouse' 
                    ? 'Greenhouse Atmosphere Telemetry' 
                    : 'Indoor Envelope Telemetry'}
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
                  <span className="font-mono font-bold text-emerald-400">{Math.round(room.climate.co2Ppm || 420)} PPM</span>
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
                          name: currentTent.name, // Preserves the user-defined custom tent name
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
                    <optgroup label="Gorilla Grow Tent Series">
                      {TENT_CATALOG.filter(t => t.brand === 'Gorilla Grow').map(t => (
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

            {/* Editable 3D Position in Host Room: X, Y, Z */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-sky-400" />
                  3D Spatial Position in {room.name} (X, Y, Z)
                </span>
                <span className="font-mono text-sky-400 text-xs">
                  Room: {room.dimensions.length}′ × {room.dimensions.width}′
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    X: West→East (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={Math.max(0, room.dimensions.length - currentTent.dimensions.length)}
                    value={currentTent.position?.x ?? 2.5}
                    onChange={e => handleTentPositionChange('x', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Y: North→South (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={Math.max(0, room.dimensions.width - currentTent.dimensions.width)}
                    value={currentTent.position?.y ?? 2.0}
                    onChange={e => handleTentPositionChange('y', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Z: Elevation (ft)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={Math.max(0, room.dimensions.height - currentTent.dimensions.height)}
                    value={currentTent.position?.z ?? 0}
                    onChange={e => handleTentPositionChange('z', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-zinc-400">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    handleTentPositionChange('x', 2.5);
                    handleTentPositionChange('y', 2.0);
                    handleTentPositionChange('z', 0);
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                >
                  Wall Clearance
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cx = Math.max(0, parseFloat(((room.dimensions.length - currentTent.dimensions.length) / 2).toFixed(1)));
                    const cy = Math.max(0, parseFloat(((room.dimensions.width - currentTent.dimensions.width) / 2).toFixed(1)));
                    handleTentPositionChange('x', cx);
                    handleTentPositionChange('y', cy);
                    handleTentPositionChange('z', 0);
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                >
                  Center Enclosure
                </button>
              </div>
            </div>

            {/* Exhaust Fan Master Speed & Lung Air Exchange with Live Controller Arbitration */}
            {(() => {
              const installedExhaustFan = currentTent.items.find(
                i => i.category === 'equipment' && i.type === 'exhaust_fan'
              ) as EquipmentItem | undefined;

              return (
                <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
                  {installedExhaustFan ? (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4 text-cyan-400" />
                        <div>
                          <span className="text-xs font-semibold text-zinc-200">
                            Exhaust Fan: {installedExhaustFan.name}
                          </span>
                          <p className="text-[10px] text-zinc-400">Pulls conditioned lung room air through intake ports</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={currentTent.exhaustFanSpeed}
                          onChange={e => {
                            const newSpeed = parseInt(e.target.value);
                            if (currentTent) {
                              const updatedItems = currentTent.items.map(it => {
                                if (it.id === installedExhaustFan.id) {
                                  return { ...it, setting: newSpeed, powerOn: newSpeed > 0 };
                                }
                                return it;
                              });
                              onUpdateTent({
                                ...currentTent,
                                exhaustFanSpeed: newSpeed,
                                items: updatedItems
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
                  ) : (
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4 text-zinc-500" />
                        <div>
                          <span className="text-xs font-semibold text-zinc-300">
                            Passive Airflow (No Exhaust Fan Installed)
                          </span>
                          <p className="text-[10px] text-zinc-500">
                            Air exchange is limited to passive mesh port infiltration (~0.05 ACH). Add an inline fan to force air exchange.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onOpenAddItem(currentTent.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-750 text-emerald-300 text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Fan</span>
                      </button>
                    </div>
                  )}

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
            );
          })()}
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
    const isCropItem = currentItem.category === 'plant' || currentItem.category === 'mushroom';
    const itemSizeDims = (currentItem.category === 'plant' || currentItem.category === 'mushroom') && currentItem.containerDimensions
      ? currentItem.containerDimensions
      : currentItem.dimensions;

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
                  {isCropItem ? 'Pot / Container Dimensions (L × W × H)' : 'Item Dimensions (L × W × H)'}
                </span>
                <span className="font-mono text-emerald-400 text-xs">
                  Footprint: {(currentItem.dimensions.length * currentItem.dimensions.width).toFixed(2)} sq ft
                </span>
              </div>
              {isCropItem && (
                <div className="text-[10px] font-mono text-zinc-400">
                  Overall with {currentItem.category === 'plant' ? 'canopy' : 'fruit bodies'}: {currentItem.dimensions.length}′ × {currentItem.dimensions.width}′ × {currentItem.dimensions.height}′
                  {currentItem.category === 'plant' && (
                    <> · plant {currentItem.heightInches.toFixed(0)}″ tall, {currentItem.canopyWidthInches.toFixed(0)}″ canopy</>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Length ({itemSizeDims.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="20"
                    value={itemSizeDims.length}
                    onChange={e => handleItemDimensionChange('length', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Width ({itemSizeDims.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="20"
                    value={itemSizeDims.width}
                    onChange={e => handleItemDimensionChange('width', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                    Height ({itemSizeDims.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="20"
                    value={itemSizeDims.height}
                    onChange={e => handleItemDimensionChange('height', parseFloat(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Editable 3D Position in Enclosure: X, Y, Z */}
            {(() => {
              const containerName = currentTent ? currentTent.name : room.name;
              const containerDims = currentTent ? currentTent.dimensions : room.dimensions;
              const curPos = currentItem.position || { x: 1.0, y: 1.0, z: 0 };

              return (
                <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Move className="w-3.5 h-3.5 text-sky-400" />
                      3D Spatial Position in {containerName} (X, Y, Z)
                    </span>
                    <span className="font-mono text-sky-400 text-xs">
                      Enclosure: {containerDims.length}′ × {containerDims.width}′ × {containerDims.height}′
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                        X Offset (ft)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={containerDims.length}
                        value={curPos.x}
                        onChange={e => handleItemPositionChange('x', parseFloat(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                        Y Depth (ft)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={containerDims.width}
                        value={curPos.y}
                        onChange={e => handleItemPositionChange('y', parseFloat(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                        Z Elevation (ft)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={containerDims.height}
                        value={curPos.z}
                        onChange={e => handleItemPositionChange('z', parseFloat(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-zinc-400">Position Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleItemPositionChange('z', 0);
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                    >
                      Floor (Z=0)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleItemPositionChange('z', Math.max(0, parseFloat((containerDims.height - 1.2).toFixed(1))));
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                    >
                      Ceiling / Hanging (Z={Math.max(0, parseFloat((containerDims.height - 1.2).toFixed(1)))}′)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleItemPositionChange('z', 2.5);
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                    >
                      Bench / Shelf (Z=2.5′)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleItemPositionChange('x', parseFloat((containerDims.length / 2).toFixed(1)));
                        handleItemPositionChange('y', parseFloat((containerDims.width / 2).toFixed(1)));
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                    >
                      Center Alignment
                    </button>
                  </div>
                </div>
              );
            })()}

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

              {/* 2. Seed / Cutting Genetics & Phenotypic Traits Card */}
              {(() => {
                const traits = plant.traits || generateSeedTraits(plant.species, plant.strainName, plant.propagationType);
                const tierInfo = getGeneticTier(traits.germinationVigor, traits.viabilityPct, traits.yieldMultiplier);

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

                        <button
                          type="button"
                          onClick={() => {
                            onUpdateItem({
                              ...plant,
                              rootTempF: 82.0
                            }, selectedParentTentId);
                            onLogJournalEntry?.({
                              title: `🌡️ Applied Bottom Heat Mat: ${plant.name}`,
                              message: `Warmed substrate root zone to 82°F to break seed dormancy and accelerate radicle emergence.`,
                              type: 'action',
                              category: 'care'
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-800/60 transition-colors flex items-center gap-1.5"
                        >
                          <Thermometer className="w-3.5 h-3.5 text-amber-300" />
                          <span>Set Bottom Heat (82°F Optimal)</span>
                        </button>

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

              {/* 4. Soil & Hydroponic Dynamics */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <span>Soil &amp; Hydroponic Substrate Dynamics</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-emerald-300">
                          {plant.containerVolumeGallons || 5} Gal · {(plant.containerType || 'fabric_pot').replace(/_/g, ' ')}
                        </span>
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Medium: <span className="text-zinc-200 capitalize">{(plant.growingMedium || 'living_organic_soil').replace(/_/g, ' ')}</span> · 
                        System: <span className="text-zinc-200 capitalize">{(plant.systemType || 'soil_container').replace(/_/g, ' ')}</span> · 
                        Nutrients: <span className="text-zinc-200 capitalize">{(plant.nutrientProgram || 'organic_living_soil').replace(/_/g, ' ')}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Soil / Reservoir pH */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Substrate pH</span>
                      <span className={`font-mono font-bold text-sm ${
                        (plant.soilPh || 6.4) >= 6.0 && (plant.soilPh || 6.4) <= 6.8
                          ? 'text-emerald-400'
                          : (plant.soilPh || 6.4) >= 5.5 && (plant.soilPh || 6.4) <= 7.2
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }`}>
                        {(plant.soilPh || 6.4).toFixed(2)} pH
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Target: {(plant.growingMedium || '').includes('soil') || (plant.growingMedium || '').includes('loam') ? '6.0 - 6.8 (Soil)' : '5.5 - 6.3 (Hydro)'}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newPh = Math.max(4.5, Number(((plant.soilPh || 6.4) - 0.2).toFixed(2)));
                          onUpdateItem({ ...plant, soilPh: newPh }, selectedParentTentId);
                          onLogJournalEntry?.({
                            title: `🧪 Adjusted pH Down: ${plant.name}`,
                            message: `Applied citric acid / pH Down. Medium pH adjusted to ${newPh}.`,
                            type: 'action',
                            category: 'care'
                          });
                        }}
                        className="flex-1 py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-amber-300"
                      >
                        -0.2 (Down)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newPh = Math.min(8.5, Number(((plant.soilPh || 6.4) + 0.2).toFixed(2)));
                          onUpdateItem({ ...plant, soilPh: newPh }, selectedParentTentId);
                          onLogJournalEntry?.({
                            title: `🧪 Adjusted pH Up: ${plant.name}`,
                            message: `Applied potassium bicarbonate / pH Up. Medium pH adjusted to ${newPh}.`,
                            type: 'action',
                            category: 'care'
                          });
                        }}
                        className="flex-1 py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-cyan-300"
                      >
                        +0.2 (Up)
                      </button>
                    </div>
                  </div>

                  {/* EC / TDS Nutrient Strength */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>EC / Nutrient PPM</span>
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        {Math.round(plant.ecTdsPpm || 850)} PPM
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      EC: {((plant.ecTdsPpm || 850) / 500).toFixed(2)} mS/cm · ~{((plant.ecTdsPpm || 850) * 0.7).toFixed(0)} TDS
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newEc = Math.min(2200, Math.round((plant.ecTdsPpm || 850) + 250));
                          onUpdateItem({ ...plant, ecTdsPpm: newEc, lastFedTime: Date.now() }, selectedParentTentId);
                          onLogJournalEntry?.({
                            title: `🧪 Fed Nutrients: ${plant.name}`,
                            message: `Dosed nutrient reservoir (+250 PPM). Live EC now ${newEc} PPM.`,
                            type: 'action',
                            category: 'care'
                          });
                        }}
                        className="flex-1 py-1 px-1.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/60 text-[10px] font-mono text-emerald-300"
                      >
                        +250 Feed
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newEc = Math.max(150, Math.round((plant.ecTdsPpm || 850) - 350));
                          onUpdateItem({ ...plant, ecTdsPpm: newEc, soilMoisture: Math.min(95, plant.soilMoisture + 15) }, selectedParentTentId);
                          onLogJournalEntry?.({
                            title: `💧 Flushed Substrate: ${plant.name}`,
                            message: `Flushed root zone with fresh water (-350 PPM). EC reduced to ${newEc} PPM.`,
                            type: 'action',
                            category: 'care'
                          });
                        }}
                        className="flex-1 py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300"
                      >
                        Flush
                      </button>
                    </div>
                  </div>

                  {/* Microbial Soil Biology */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Microbial Health</span>
                      <span className="font-mono font-bold text-sm text-teal-400">
                        {Math.round(plant.microbialHealth || 85)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-400 rounded-full" 
                        style={{ width: `${Math.min(100, plant.microbialHealth || 85)}%` }} 
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateItem({ 
                          ...plant, 
                          microbialHealth: Math.min(100, (plant.microbialHealth || 80) + 20),
                          soilPh: Number(Math.max(6.2, Math.min(6.6, plant.soilPh || 6.4)).toFixed(2))
                        }, selectedParentTentId);
                        onLogJournalEntry?.({
                          title: `🧫 Inoculated Compost Tea: ${plant.name}`,
                          message: `Drenched root zone with aerated compost tea. Mycorrhizae & rhizobacteria replenished.`,
                          type: 'action',
                          category: 'care'
                        });
                      }}
                      className="w-full py-1 rounded bg-teal-950/70 hover:bg-teal-900 border border-teal-800/60 text-[10px] font-mono text-teal-300 mt-1"
                    >
                      + Drench Compost Tea
                    </button>
                  </div>

                  {/* Root Aeration & Dissolved Oxygen */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Root Aeration / DO</span>
                      <span className="font-mono font-bold text-sm text-cyan-400">
                        {Math.round(plant.aerationOxygenPct || 75)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-cyan-400 rounded-full" 
                        style={{ width: `${Math.min(100, plant.aerationOxygenPct || 75)}%` }} 
                      />
                    </div>
                    <div className="text-[10px] text-zinc-400 pt-1">
                      {(plant.containerType === 'fabric_pot' || plant.systemType === 'dwc' || plant.systemType === 'aeroponics')
                        ? 'High air-pruning & oxygenated roots'
                        : 'Standard drainage root zone'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Craft Hop Trellis & Brewing Alpha Acid Profile */}
              {plant.species === 'Hops' && (
                <div className="bg-gradient-to-r from-amber-950/30 to-zinc-950 border border-amber-800/70 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-900/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🍺</span>
                      <div>
                        <h4 className="text-sm font-bold text-amber-200">
                          Craft Hop Trellis Bine &amp; Brewing Quality (Humulus lupulus)
                        </h4>
                        <p className="text-[11px] text-amber-400/80">
                          Twining Bine Height: {(plant.heightInches / 12).toFixed(1)} ft · Trellis Target: 14 - 16 ft
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-950 border border-amber-800">
                        {(plant.alphaAcidsPct || 7.0).toFixed(1)}% Alpha Acids (AA)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
                      <div className="text-zinc-400 text-[10px] uppercase font-mono">Brewing Profile</div>
                      <div className="font-bold text-zinc-200 mt-0.5">
                        {(plant.alphaAcidsPct || 7) >= 11 ? 'High-Alpha Bittering' : (plant.alphaAcidsPct || 7) >= 6 ? 'Dual Purpose Bittering & Aroma' : 'Noble Fine Aroma'}
                      </div>
                      <div className="text-[10px] text-amber-400/90 mt-1">
                        Ideal for IPAs, Pale Ales, and Craft Lagers
                      </div>
                    </div>

                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
                      <div className="text-zinc-400 text-[10px] uppercase font-mono">Lupulin Resin Glands</div>
                      <div className="font-bold text-emerald-300 mt-0.5">
                        {['flowering', 'ripening', 'ready'].includes(plant.stage) 
                          ? '✨ Golden Strobile Cones Active' 
                          : '🌿 Vegetative Bine Vigorous Extension'}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        Cone density: {plant.stage === 'flowering' ? 'Dense papery strobiles' : plant.stage === 'ripening' ? 'Fragrant lupulin dust' : 'Climbing trellis twine'}
                      </div>
                    </div>

                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
                      <div className="text-zinc-400 text-[10px] uppercase font-mono">Climbing Trellis Progress</div>
                      <div className="flex items-center justify-between font-mono text-zinc-200 text-xs mt-0.5">
                        <span>{plant.heightInches.toFixed(0)}″</span>
                        <span>192″ Max (16′)</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full bg-amber-500 rounded-full" 
                          style={{ width: `${Math.min(100, (plant.heightInches / 192) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

              {/* 3b. HOSE DUCTING (humidifiers & CO2 controllers kept outside a tent) */}
              {(eq.type === 'humidifier' || eq.type === 'co2_regulator') && (() => {
                const isMist = eq.type === 'humidifier';
                const isRoomLevel = !selectedParentTentId;
                const ductTent = getDuctTargetTent(room, eq);
                const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
                return (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>{isMist ? 'Mist Hose / Ducting' : 'CO₂ Injection Tubing'}</span>
                      <span className={`font-mono font-bold ${ductTent ? 'text-cyan-400' : 'text-zinc-500'}`}>
                        {ductTent ? `→ ${ductTent.name}` : hostTent ? 'In tent' : 'Room air'}
                      </span>
                    </div>
                    {isRoomLevel ? (
                      <>
                        <select
                          value={ductTent?.id ?? ''}
                          onChange={e => {
                            const next: EquipmentItem = { ...eq };
                            if (e.target.value) next.ductedToTentId = e.target.value;
                            else delete next.ductedToTentId;
                            onUpdateItem(next, selectedParentTentId);
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                        >
                          <option value="">{isMist ? 'No hose — mists into the room' : 'No tubing — injects into the room'}</option>
                          {room.tents.map(t => (
                            <option key={t.id} value={t.id}>{isMist ? 'Hose into' : 'Tubing into'} {t.name}</option>
                          ))}
                        </select>
                        <span className="text-[10px] text-zinc-500 block">
                          {ductTent
                            ? isMist
                              ? `Sits outside the tent; mist is piped into ${ductTent.name} and runs on that tent's controller (~${Math.round((1 - HOSE_DELIVERY_EFFICIENCY) * 100)}% lost to hose condensation).`
                              : `Tank and solenoid sit outside the tent; CO₂ is injected into ${ductTent.name} and runs on that tent's controller.`
                            : room.tents.length > 0
                              ? `Run ${isMist ? 'a hose' : 'tubing'} into a tent to free up tent floor space.`
                              : `Add a tent to this room to ${isMist ? 'duct mist' : 'inject CO₂'} into it.`}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-zinc-500 block">
                        {isMist ? 'Mists' : 'Injects'} directly into {hostTent?.name ?? 'this tent'}. Place the unit in the room to {isMist ? 'duct it in through a hose' : 'feed it through tubing'} instead.
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* 3c. HUMIDIFIER RESERVOIR WATER (follows ambient; heated only by a wrapped heat mat) */}
              {eq.type === 'humidifier' && (() => {
                const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
                const ambientF = hostTent ? hostTent.climate.tempF : room.climate.tempF;
                const waterF = eq.reservoirTempF ?? ambientF;
                const containerItems = hostTent ? hostTent.items : room.items;
                const wrappedMats = containerItems.filter(i => isHeatMat(i) && i.attachedToId === eq.id) as EquipmentItem[];
                const fmt = (f: number) => tempUnit === 'F' ? `${f.toFixed(1)}°F` : `${((f - 32) * 5 / 9).toFixed(1)}°C`;
                const capacityL = getReservoirLiters(eq);
                const empty = isReservoirEmpty(eq);
                const levelL = empty ? 0 : getReservoirLevelL(eq);
                const levelPct = Math.round((levelL / capacityL) * 100);
                // Live use from the last tick (follows the moisture the air actually took up); max is the rated output
                const useLph = eq.powerOn ? (eq.waterFlowLph ?? 0) : 0;
                const maxLph = getMistWaterUseLph(eq, eq.setting);
                const maxCapacityL = getMaxReservoirLiters(eq);
                return (
                  <div className={`bg-zinc-900 border rounded-xl p-3.5 space-y-2 ${empty ? 'border-rose-700/70' : 'border-zinc-800'}`}>
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Reservoir Water</span>
                      <span className="font-mono font-bold text-cyan-400">{fmt(waterF)}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                        <div
                          className={`h-full ${empty ? 'bg-rose-500' : levelPct < 20 ? 'bg-amber-400' : 'bg-cyan-500'}`}
                          style={{ width: `${levelPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className={empty ? 'text-rose-400 font-bold' : levelPct < 20 ? 'text-amber-300' : 'text-zinc-400'}>
                          {empty ? 'EMPTY — not misting' : `${levelL.toFixed(1)} / ${capacityL.toFixed(1)} L (${levelPct}%)`}
                        </span>
                        <span className="text-zinc-500">
                          {empty ? '' : useLph > 0.0005 ? `using ${useLph.toFixed(2)} L/h · ~${Math.floor(levelL / useLph)}h left` : 'Idle — not using water'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={levelPct >= 100}
                      onClick={() => {
                        onUpdateItem(refillReservoir(eq, ambientF), selectedParentTentId);
                        onLogJournalEntry?.({
                          title: `💧 Refilled ${eq.name}`,
                          message: `Topped up the reservoir with ${(capacityL - levelL).toFixed(1)} L of fresh tap water (${capacityL.toFixed(1)} L tank).`,
                          type: 'action',
                          category: 'care'
                        });
                      }}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-cyan-950/50 border-cyan-800 text-cyan-200 hover:bg-cyan-900/60"
                    >
                      {levelPct >= 100 ? 'Reservoir Full' : 'Refill Reservoir'}
                    </button>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400 pt-1">
                      <label htmlFor={`cap-${eq.id}`}>Tank capacity (max {maxCapacityL.toFixed(1)} L to fit this unit)</label>
                      <div className="flex items-center gap-1">
                        <input
                          id={`cap-${eq.id}`}
                          type="number"
                          min="0.5"
                          step="0.5"
                          max={maxCapacityL.toFixed(1)}
                          value={Number(capacityL.toFixed(1))}
                          onChange={e => {
                            const value = parseFloat(e.target.value);
                            if (isNaN(value) || value <= 0) return;
                            const capped = Math.min(maxCapacityL, value);
                            onUpdateItem({ ...eq, reservoirCapacityL: capped, reservoirLevelL: Math.min(capped, getReservoirLevelL(eq)) }, selectedParentTentId);
                          }}
                          className="w-16 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                        />
                        <span>L</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500 block">
                      Rated up to {maxLph.toFixed(2)} L/h at its {eq.setting}% setting; it only uses what the air actually takes up (more with the exhaust or vents carrying humid air out).
                    </span>
                    <span className="text-[10px] text-zinc-500 block">
                      {wrappedMats.length > 0
                        ? `Heated by ${wrappedMats.map(m => `${m.name}${m.powerOn ? ` (${m.powerWatts}W)` : ' (off)'}`).join(', ')} wrapped around it; otherwise follows ${hostTent ? 'tent' : 'room'} air (${fmt(ambientF)}).`
                        : `Follows ${hostTent ? 'tent' : 'room'} air (${fmt(ambientF)}). Wrap a heat mat around the unit to warm the water.`}
                      {' '}Warmer water fogs more and cools the air less.
                    </span>
                  </div>
                );
              })()}

              {/* 3d. DEHUMIDIFIER COLLECTION BUCKET & DRAIN HOSE */}
              {eq.type === 'dehumidifier' && (() => {
                const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
                const rh = hostTent ? hostTent.climate.rh : room.climate.rh;
                const capacityL = getBucketCapacityL(eq);
                const levelL = getBucketLevelL(eq);
                const full = isBucketFull(eq);
                const levelPct = Math.round((levelL / capacityL) * 100);
                // Live collection from the last tick (follows the moisture actually pulled out of the air)
                const fillLph = eq.powerOn ? (eq.waterFlowLph ?? 0) : 0;
                const tempF = hostTent ? hostTent.climate.tempF : room.climate.tempF;
                const maxLph = getDehumidifierExtractionLph(eq, eq.setting, rh, tempF);
                const maxCapacityL = getMaxBucketCapacityL(eq);
                return (
                  <div className={`bg-zinc-900 border rounded-xl p-3.5 space-y-2 ${full ? 'border-rose-700/70' : 'border-zinc-800'}`}>
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Collection Bucket</span>
                      <span className="font-mono font-bold text-cyan-400">
                        {eq.drainHoseConnected ? 'Drain hose' : `${levelL.toFixed(1)} / ${capacityL.toFixed(1)} L`}
                      </span>
                    </div>
                    {!eq.drainHoseConnected && (
                      <div className="space-y-1">
                        <div className="h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                          <div
                            className={`h-full ${full ? 'bg-rose-500' : levelPct > 80 ? 'bg-amber-400' : 'bg-cyan-500'}`}
                            style={{ width: `${levelPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className={full ? 'text-rose-400 font-bold' : levelPct > 80 ? 'text-amber-300' : 'text-zinc-400'}>
                            {full ? 'FULL — shut off' : `${levelPct}% full`}
                          </span>
                          <span className="text-zinc-500">
                            {full ? '' : fillLph > 0.0005 ? `collecting ${fillLph.toFixed(2)} L/h · full in ~${Math.floor((capacityL - levelL) / fillLph)}h` : 'Idle — not collecting'}
                          </span>
                        </div>
                      </div>
                    )}
                    {!eq.drainHoseConnected && (
                      <button
                        type="button"
                        disabled={levelL < 0.05}
                        onClick={() => {
                          onUpdateItem(emptyBucket(eq), selectedParentTentId);
                          onLogJournalEntry?.({
                            title: `🪣 Emptied ${eq.name}`,
                            message: `Poured out ${levelL.toFixed(1)} L of condensate from the collection bucket.`,
                            type: 'action',
                            category: 'care'
                          });
                        }}
                        className="w-full py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-cyan-950/50 border-cyan-800 text-cyan-200 hover:bg-cyan-900/60"
                      >
                        {levelL < 0.05 ? 'Bucket Empty' : 'Empty Bucket'}
                      </button>
                    )}
                    {!eq.drainHoseConnected && (
                    <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400 pt-1">
                      <label htmlFor={`cap-${eq.id}`}>Bucket capacity (max {maxCapacityL.toFixed(1)} L to fit this unit)</label>
                      <div className="flex items-center gap-1">
                        <input
                          id={`cap-${eq.id}`}
                          type="number"
                          min="0.5"
                          step="0.5"
                          max={maxCapacityL.toFixed(1)}
                          value={Number(capacityL.toFixed(1))}
                          onChange={e => {
                            const value = parseFloat(e.target.value);
                            if (isNaN(value) || value <= 0) return;
                            const capped = Math.min(maxCapacityL, value);
                            onUpdateItem({ ...eq, bucketCapacityL: capped, bucketLevelL: Math.min(capped, getBucketLevelL(eq)) }, selectedParentTentId);
                          }}
                          className="w-16 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                        />
                        <span>L</span>
                      </div>
                    </div>
                    )}
                    <span className="text-[10px] text-zinc-500 block">
                      Can pull up to {maxLph.toFixed(2)} L/h at {Math.round(rh)}% RH and {Math.round(tempF)}°F (rated at 65°F / 60% RH; less in drier or cooler air).
                    </span>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 pt-1">
                      <input
                        type="checkbox"
                        checked={!!eq.drainHoseConnected}
                        onChange={e => onUpdateItem({ ...eq, drainHoseConnected: e.target.checked, bucketLevelL: e.target.checked ? 0 : eq.bucketLevelL }, selectedParentTentId)}
                        className="accent-cyan-500"
                      />
                      <span>Continuous drain hose</span>
                    </label>
                    <span className="text-[10px] text-zinc-500 block">
                      {eq.drainHoseConnected
                        ? `Condensate runs straight to a drain (${fillLph.toFixed(2)} L/h right now), so the unit never stops for a full bucket.`
                        : 'When the bucket fills, the float switch shuts the unit off until it is emptied. Drier air collects less water.'}
                    </span>
                  </div>
                );
              })()}

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

              {/* 5b. PORTABLE A/C */}
              {eq.type === 'portable_ac' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Cooling Thermostat</span>
                    <span className="font-mono font-bold text-sky-400">{eq.targetTempF ?? 72}°F</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="85"
                    value={eq.targetTempF ?? 72}
                    onChange={e => onUpdateItem({ ...eq, targetTempF: parseInt(e.target.value) }, selectedParentTentId)}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <label htmlFor={`btu-${eq.id}`}>Rated cooling capacity</label>
                    <div className="flex items-center gap-1">
                      <input
                        id={`btu-${eq.id}`}
                        type="number"
                        min="4000"
                        max="24000"
                        step="1000"
                        value={getPortableAcBtu(eq)}
                        onChange={e => {
                          const value = parseInt(e.target.value);
                          if (!isNaN(value) && value > 0) onUpdateItem({ ...eq, coolingCapacityBtu: Math.max(1000, Math.min(36000, value)) }, selectedParentTentId);
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-sky-500"
                      />
                      <span>BTU/h</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    Runs while the room is above the set-point, removing {getPortableAcBtu(eq).toLocaleString()} BTU/h of heat and some moisture. Its own heat is vented outside through the window hose.
                  </span>
                </div>
              )}

              {/* 5c. HVAC SUPPLY REGISTER */}
              {eq.type === 'hvac_register' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center text-xs text-zinc-300">
                    <span>Central System Supply</span>
                    <select
                      value={eq.registerMode ?? 'cool'}
                      onChange={e => onUpdateItem({ ...eq, registerMode: e.target.value as EquipmentItem['registerMode'] }, selectedParentTentId)}
                      className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="cool">Cooling</option>
                      <option value="heat">Heating</option>
                      <option value="auto">Auto (heat or cool)</option>
                      <option value="off">Off (register closed)</option>
                    </select>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Room Thermostat</span>
                    <span className="font-mono font-bold text-sky-400">{eq.targetTempF ?? 72}°F</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="85"
                    value={eq.targetTempF ?? 72}
                    onChange={e => onUpdateItem({ ...eq, targetTempF: parseInt(e.target.value) }, selectedParentTentId)}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <label htmlFor={`cfm-${eq.id}`}>Airflow through the register</label>
                    <div className="flex items-center gap-1">
                      <input
                        id={`cfm-${eq.id}`}
                        type="number"
                        min="25"
                        max="600"
                        step="25"
                        value={eq.flowRateCfm ?? DEFAULT_REGISTER_CFM}
                        onChange={e => {
                          const value = parseInt(e.target.value);
                          if (!isNaN(value) && value > 0) onUpdateItem({ ...eq, flowRateCfm: Math.max(25, Math.min(1000, value)) }, selectedParentTentId);
                        }}
                        className="w-16 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-sky-500"
                      />
                      <span>CFM</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    Blows the house system's air in ({REGISTER_COOL_SUPPLY_F}°F when cooling, {REGISTER_HEAT_SUPPLY_F}°F when heating) while the room is past the set-point. Cooling air is dry, so it also lowers humidity.
                  </span>
                </div>
              )}

              {/* 6. INLINE FAN DUCT SIZE */}
              {eq.type === 'exhaust_fan' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Duct / Port Size</span>
                    <span className="font-mono font-bold text-sky-400">{eq.flowRateCfm ?? INLINE_FAN_SPECS[eq.ductSizeIn || 6].cfm} CFM</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {INLINE_FAN_DUCT_SIZES.map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          const spec = INLINE_FAN_SPECS[size];
                          onUpdateItem({
                            ...eq,
                            ductSizeIn: size,
                            flowRateCfm: spec.cfm,
                            powerWatts: spec.watts,
                            dimensions: { ...spec.dimensions }
                          }, selectedParentTentId);
                        }}
                        className={`py-1.5 rounded-lg text-xs font-medium border ${
                          (eq.ductSizeIn || 6) === size ? 'bg-sky-950 border-sky-500 text-sky-300' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {size}" duct
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    Air exchange scales with the fan's CFM against the tent's volume.
                  </span>
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs text-zinc-300">
                    <label htmlFor={`exhaust-to-${eq.id}`}>Exhaust ducted to</label>
                    <select
                      id={`exhaust-to-${eq.id}`}
                      value={eq.exhaustTo ?? 'room'}
                      onChange={e => onUpdateItem({ ...eq, exhaustTo: e.target.value as 'room' | 'outdoors' }, selectedParentTentId)}
                      className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="room">The room</option>
                      <option value="outdoors">Outdoors (window / wall vent)</option>
                    </select>
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    {(eq.exhaustTo ?? 'room') === 'outdoors'
                      ? 'Ducted out a window or wall vent: what it removes leaves the building. The room draws in the same amount of outdoor air to replace it.'
                      : selectedParentTentId
                        ? "Blows the tent's warm, humid (and CO\u2082-laden) air into the room, so it adds to the room's climate."
                        : 'A room-level fan blowing into the room just stirs the air; duct it outdoors to ventilate the room.'}
                  </span>
                </div>
              )}

              {/* 7. HEAT MAT PLACEMENT & THERMOSTAT */}
              {eq.type === 'heat_mat' && (() => {
                const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
                const containerItems = hostTent ? hostTent.items : room.items;
                const target = getHeatMatTarget(eq, containerItems, hostTent);
                const options = [
                  ...(hostTent ? [{ id: hostTent.id, label: describeHeatMatPlacement({ kind: 'tent_floor', tent: hostTent }) }] : []),
                  ...containerItems.filter(i => i.id !== eq.id && canHeatMatAttachTo(i)).map(i => ({
                    id: i.id,
                    label: describeHeatMatPlacement(getHeatMatTarget({ ...eq, attachedToId: i.id }, containerItems, hostTent))
                  }))
                ];
                const hasThermostat = eq.targetTempF !== undefined;
                return (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Placed Under / Wrapped Around</span>
                      <span className="font-mono font-bold text-orange-400">{eq.powerOn ? `${eq.powerWatts}W` : 'Off'}</span>
                    </div>
                    <select
                      value={target ? (target.kind === 'tent_floor' ? target.tent.id : target.item.id) : ''}
                      onChange={e => {
                        const next: EquipmentItem = { ...eq };
                        if (e.target.value) next.attachedToId = e.target.value;
                        else delete next.attachedToId;
                        onUpdateItem(next, selectedParentTentId);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-orange-500"
                    >
                      {!hostTent && <option value="">Not attached (lying on the floor)</option>}
                      {options.map(o => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-zinc-500 block">
                      {!target
                        ? 'Not touching anything, so it warms nothing. Put it under a pot or container, or wrap it around a humidifier.'
                        : target.kind === 'tent_floor'
                          ? `Lies under the catch tray: every pot and container standing in ${target.tent.name} gets part of its heat.`
                          : target.wrapped
                            ? `Heats ${target.item.name}'s reservoir water; how fast depends on the water volume and the mat's wattage.`
                            : `Warms ${target.item.name}'s ${target.item.category === 'mushroom' ? 'substrate' : 'root zone'} from below.`}
                    </span>
                    <label className="flex items-center gap-2 text-xs text-zinc-300 pt-1">
                      <input
                        type="checkbox"
                        checked={hasThermostat}
                        onChange={e => {
                          const next: EquipmentItem = { ...eq };
                          if (e.target.checked) next.targetTempF = 78;
                          else delete next.targetTempF;
                          onUpdateItem(next, selectedParentTentId);
                        }}
                        className="accent-orange-500"
                      />
                      <span>Thermostat controller</span>
                      {hasThermostat && <span className="ml-auto font-mono font-bold text-orange-400">{eq.targetTempF}°F</span>}
                    </label>
                    {hasThermostat && (
                      <input
                        type="range"
                        min="65"
                        max="100"
                        value={eq.targetTempF}
                        onChange={e => onUpdateItem({ ...eq, targetTempF: parseInt(e.target.value) }, selectedParentTentId)}
                        className="w-full accent-orange-500 cursor-pointer"
                      />
                    )}
                  </div>
                );
              })()}
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

        {/* 3D Crop Growth Timelapse Modal */}
        {show3dGrowthTimelapse && currentItem && (currentItem.category === 'plant' || currentItem.category === 'mushroom') && (
          <CropGrowth3DViewer
            crop={currentItem as PlantItem | MushroomItem}
            isOpen={show3dGrowthTimelapse}
            onClose={() => setShow3dGrowthTimelapse(false)}
            onApplyStage={(stage, progress) => {
              if (currentItem!.category === 'plant') {
                onUpdateItem({
                  ...currentItem!,
                  stage: stage as PlantStage,
                  stageProgress: Math.round(progress)
                }, selectedParentTentId);
              } else {
                onUpdateItem({
                  ...currentItem!,
                  stage: stage as MushroomItem['stage'],
                  stageProgress: Math.round(progress)
                }, selectedParentTentId);
              }
            }}
          />
        )}
      </div>
    );
  }

  return null;
};

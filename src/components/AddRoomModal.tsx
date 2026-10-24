import React, { useState } from 'react';
import { 
  Building2, 
  X, 
  Plus, 
  Check, 
  Layers, 
  Sliders, 
  Home, 
  Bed, 
  Car, 
  Compass, 
  Sparkles,
  Wind,
  ThermometerSnowflake,
  ShieldAlert,
  Sun,
  Trees,
  Sprout,
  Flower2
} from 'lucide-react';
import { Room, ConstructionStandard, Dimensions, Climate, RoomEnvironmentType, GardenLayoutConfig, PlantItem, OutsideConditions } from '../types/sim';
import { calculateVPD } from '../utils/physics';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRoom: (room: Room) => void;
  outdoorCo2Ppm?: number;
  outsideClimate?: OutsideConditions;
}

interface RoomPreset {
  id: string;
  category: 'indoor' | 'outdoor';
  name: string;
  desc: string;
  icon: any;
  dimensions: Dimensions;
  environmentType: RoomEnvironmentType;
  gardenConfig?: GardenLayoutConfig;
  constructionStandard: ConstructionStandard;
  foundationType: 'conditioned_basement' | 'slab_on_grade' | 'second_floor' | 'attic';
  wallRValue: number;
  airChangesPerHour: number;
  hvacMode: 'central_ac_active' | 'passive_drift' | 'heating_active';
  hvacCoolingSetpointF: number;
  hvacHeatingSetpointF: number;
}

const ROOM_PRESETS: RoomPreset[] = [
  // Indoor Rooms
  {
    id: 'preset-basement',
    category: 'indoor',
    name: 'Conditioned Basement',
    desc: 'Cool below-grade thermal mass, concrete foundation, tight R-19 insulation.',
    icon: Home,
    dimensions: { length: 20, width: 15, height: 8, unit: 'ft' },
    environmentType: 'indoor',
    constructionStandard: 'colonial_2005',
    foundationType: 'conditioned_basement',
    wallRValue: 19,
    airChangesPerHour: 0.35,
    hvacMode: 'central_ac_active',
    hvacCoolingSetpointF: 72,
    hvacHeatingSetpointF: 68
  },
  {
    id: 'preset-bedroom',
    category: 'indoor',
    name: 'Spare Bedroom (2nd Floor)',
    desc: 'Above-ground living space, standard residential drywall & central HVAC ducting.',
    icon: Bed,
    dimensions: { length: 12, width: 12, height: 8, unit: 'ft' },
    environmentType: 'indoor',
    constructionStandard: 'colonial_2005',
    foundationType: 'second_floor',
    wallRValue: 19,
    airChangesPerHour: 0.40,
    hvacMode: 'central_ac_active',
    hvacCoolingSetpointF: 72,
    hvacHeatingSetpointF: 68
  },
  {
    id: 'preset-garage',
    category: 'indoor',
    name: 'Garage Workshop',
    desc: 'Slab-on-grade, higher natural air exchange (0.65 ACH), seasonal ambient swing.',
    icon: Car,
    dimensions: { length: 24, width: 20, height: 10, unit: 'ft' },
    environmentType: 'indoor',
    constructionStandard: 'older_drafty',
    foundationType: 'slab_on_grade',
    wallRValue: 13,
    airChangesPerHour: 0.65,
    hvacMode: 'passive_drift',
    hvacCoolingSetpointF: 78,
    hvacHeatingSetpointF: 60
  },
  {
    id: 'preset-attic',
    category: 'indoor',
    name: 'Attic / Bonus Room',
    desc: 'Upper roofline microclimate, high solar exposure, R-25 insulated rafter deck.',
    icon: Compass,
    dimensions: { length: 16, width: 14, height: 7.5, unit: 'ft' },
    environmentType: 'indoor',
    constructionStandard: 'colonial_2005',
    foundationType: 'attic',
    wallRValue: 25,
    airChangesPerHour: 0.45,
    hvacMode: 'central_ac_active',
    hvacCoolingSetpointF: 70,
    hvacHeatingSetpointF: 66
  },
  // Outdoor Gardens & Greenhouses
  {
    id: 'preset-hop-yard',
    category: 'outdoor',
    name: 'Craft Hop Yard (Trellis Array)',
    desc: '16ft tall pine trellis poles with coir twines, full solar PPFD, ideal for Cascade & Citra bines.',
    icon: Trees,
    dimensions: { length: 30, width: 24, height: 16, unit: 'ft' },
    environmentType: 'outdoor_garden',
    gardenConfig: 'hop_yard_trellis',
    constructionStandard: 'older_drafty',
    foundationType: 'slab_on_grade',
    wallRValue: 1,
    airChangesPerHour: 10.0,
    hvacMode: 'passive_drift',
    hvacCoolingSetpointF: 75,
    hvacHeatingSetpointF: 60
  },
  {
    id: 'preset-raised-beds',
    category: 'outdoor',
    name: 'Backyard Cedar Raised Beds',
    desc: 'Deep cedar wood planter boxes (4×8 ft) with living organic super soil, mulch, and natural sunshine.',
    icon: Sprout,
    dimensions: { length: 24, width: 20, height: 6, unit: 'ft' },
    environmentType: 'outdoor_garden',
    gardenConfig: 'raised_beds_courtyard',
    constructionStandard: 'older_drafty',
    foundationType: 'slab_on_grade',
    wallRValue: 1,
    airChangesPerHour: 10.0,
    hvacMode: 'passive_drift',
    hvacCoolingSetpointF: 75,
    hvacHeatingSetpointF: 60
  },
  {
    id: 'preset-in-ground',
    category: 'outdoor',
    name: 'In-Ground Permaculture Patch',
    desc: 'Tilled fertile garden topsoil patch with woodchip pathways, high soil volume buffer, and earthworms.',
    icon: Sun,
    dimensions: { length: 25, width: 20, height: 6, unit: 'ft' },
    environmentType: 'outdoor_garden',
    gardenConfig: 'in_ground_permaculture',
    constructionStandard: 'older_drafty',
    foundationType: 'slab_on_grade',
    wallRValue: 1,
    airChangesPerHour: 10.0,
    hvacMode: 'passive_drift',
    hvacCoolingSetpointF: 75,
    hvacHeatingSetpointF: 60
  },
  {
    id: 'preset-patio-deck',
    category: 'outdoor',
    name: 'Sunny Patio Container Deck',
    desc: 'Sunny outdoor stone terrace with breathable fabric smart pots, terracotta herb containers, and DWC tubs.',
    icon: Flower2,
    dimensions: { length: 18, width: 14, height: 8, unit: 'ft' },
    environmentType: 'outdoor_garden',
    gardenConfig: 'patio_container_deck',
    constructionStandard: 'older_drafty',
    foundationType: 'slab_on_grade',
    wallRValue: 1,
    airChangesPerHour: 8.0,
    hvacMode: 'passive_drift',
    hvacCoolingSetpointF: 75,
    hvacHeatingSetpointF: 60
  },
  {
    id: 'preset-greenhouse',
    category: 'outdoor',
    name: 'Solar High-Tunnel Greenhouse',
    desc: 'Double-polycarbonate solar shelter with passive ventilation louvers, capturing +6°F natural solar gain.',
    icon: Sparkles,
    dimensions: { length: 20, width: 12, height: 9, unit: 'ft' },
    environmentType: 'greenhouse',
    gardenConfig: 'greenhouse_polytunnel',
    constructionStandard: 'modern_tight',
    foundationType: 'slab_on_grade',
    wallRValue: 3,
    airChangesPerHour: 2.0,
    hvacMode: 'passive_drift',
    hvacCoolingSetpointF: 80,
    hvacHeatingSetpointF: 55
  }
];

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  isOpen,
  onClose,
  onAddRoom,
  outdoorCo2Ppm = 420,
  outsideClimate
}) => {
  const [activeCategory, setActiveCategory] = useState<'indoor' | 'outdoor'>('outdoor');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-hop-yard');
  const [roomName, setRoomName] = useState<string>('Craft Hop Yard (Trellis Array)');
  const [length, setLength] = useState<number>(30);
  const [width, setWidth] = useState<number>(24);
  const [height, setHeight] = useState<number>(16);
  const [environmentType, setEnvironmentType] = useState<RoomEnvironmentType>('outdoor_garden');
  const [gardenConfig, setGardenConfig] = useState<GardenLayoutConfig | undefined>('hop_yard_trellis');
  const [foundationType, setFoundationType] = useState<'conditioned_basement' | 'slab_on_grade' | 'second_floor' | 'attic'>('slab_on_grade');
  const [constructionStandard, setConstructionStandard] = useState<ConstructionStandard>('older_drafty');
  const [wallRValue, setWallRValue] = useState<number>(1);
  const [airChangesPerHour, setAirChangesPerHour] = useState<number>(10.0);
  const [hvacMode, setHvacMode] = useState<'central_ac_active' | 'passive_drift' | 'heating_active'>('passive_drift');
  const [starterSetup, setStarterSetup] = useState<'empty' | 'starter_hops' | 'starter_raised_bed' | 'starter_veg'>('starter_hops');

  if (!isOpen) return null;

  const handleSelectPreset = (preset: RoomPreset) => {
    setSelectedPresetId(preset.id);
    setRoomName(preset.name);
    setLength(preset.dimensions.length);
    setWidth(preset.dimensions.width);
    setHeight(preset.dimensions.height);
    setEnvironmentType(preset.environmentType);
    setGardenConfig(preset.gardenConfig);
    setFoundationType(preset.foundationType);
    setConstructionStandard(preset.constructionStandard);
    setWallRValue(preset.wallRValue);
    setAirChangesPerHour(preset.airChangesPerHour);
    setHvacMode(preset.hvacMode);

    if (preset.id === 'preset-hop-yard') {
      setStarterSetup('starter_hops');
    } else if (preset.category === 'outdoor') {
      setStarterSetup('starter_raised_bed');
    } else {
      setStarterSetup('empty');
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = roomName.trim() || 'New Facility Room';
    const roomId = `room-${Date.now()}`;

    const isOutdoor = environmentType === 'outdoor_garden' || environmentType === 'greenhouse';

    const initialClimate: Climate = (isOutdoor && outsideClimate) ? {
      tempF: environmentType === 'greenhouse' 
        ? Math.max(outsideClimate.tempF, outsideClimate.tempF + (outsideClimate.lightPPFD > 400 ? 5.5 : 1.5))
        : outsideClimate.tempF,
      tempC: environmentType === 'greenhouse'
        ? parseFloat((((outsideClimate.tempF + (outsideClimate.lightPPFD > 400 ? 5.5 : 1.5)) - 32) * (5 / 9)).toFixed(1))
        : outsideClimate.tempC,
      rh: environmentType === 'greenhouse'
        ? Math.min(95, outsideClimate.rh + 6)
        : outsideClimate.rh,
      lightPPFD: environmentType === 'greenhouse'
        ? Math.round(outsideClimate.lightPPFD * 0.82)
        : outsideClimate.lightPPFD,
      vpdKpa: calculateVPD(
        environmentType === 'greenhouse' ? outsideClimate.tempF + 4 : outsideClimate.tempF,
        environmentType === 'greenhouse' ? Math.min(95, outsideClimate.rh + 6) : outsideClimate.rh,
        environmentType === 'greenhouse' ? Math.round(outsideClimate.lightPPFD * 0.82) : outsideClimate.lightPPFD
      ),
      co2Ppm: outsideClimate.co2Ppm || outdoorCo2Ppm
    } : {
      tempF: isOutdoor ? 74.0 : hvacMode === 'central_ac_active' ? 72.0 : 70.0,
      tempC: isOutdoor ? 23.3 : hvacMode === 'central_ac_active' ? 22.2 : 21.1,
      rh: 55,
      lightPPFD: isOutdoor ? 850 : 10,
      vpdKpa: calculateVPD(isOutdoor ? 74.0 : 72.0, 55, isOutdoor ? 850 : 10),
      co2Ppm: outdoorCo2Ppm
    };

    const newRoom: Room = {
      id: roomId,
      name: cleanName,
      dimensions: {
        length: Math.max(6, Math.min(60, Number(length) || 12)),
        width: Math.max(6, Math.min(60, Number(width) || 12)),
        height: Math.max(6, Math.min(25, Number(height) || 8)),
        unit: 'ft'
      },
      climate: initialClimate,
      tents: [],
      items: [],
      environmentType,
      gardenConfig,
      constructionStandard,
      foundationType,
      wallRValue,
      airChangesPerHour,
      hvacMode,
      hvacCoolingSetpointF: 72.0,
      hvacHeatingSetpointF: 68.0,
      roomCo2BaselinePpm: outdoorCo2Ppm
    };

    const now = Date.now();

    // Starter items if requested
    if (starterSetup === 'starter_hops') {
      // Add Cascade & Citra Hops climbing on trellises
      const cascadeHop: PlantItem = {
        id: `hop-cascade-${now}`,
        name: 'Cascade Hops (Bine #1)',
        category: 'plant',
        species: 'Hops',
        strainName: 'Cascade (USDA 56013)',
        propagationType: 'cutting',
        stage: 'vegetative',
        stageProgress: 65,
        ageDays: 32,
        currentStageDays: 14,
        keyDates: {
          plantedDate: now - 32 * 86400000,
          rootedDate: now - 25 * 86400000,
          seedlingDate: now - 25 * 86400000,
          matureSeedlingDate: now - 18 * 86400000,
          vegetativeDate: now - 14 * 86400000
        },
        systemType: 'raised_bed',
        containerType: 'raised_bed_cedar',
        containerVolumeGallons: 50,
        growingMedium: 'living_organic_soil',
        nutrientProgram: 'organic_living_soil',
        soilPh: 6.5,
        ecTdsPpm: 1250,
        microbialHealth: 96,
        aerationOxygenPct: 88,
        alphaAcidsPct: 6.2,
        health: 98,
        soilMoisture: 72,
        rootTempF: 68.5,
        nutrientLevel: 'balanced',
        heightInches: 108, // 9 feet tall climbing bine!
        canopyWidthInches: 32,
        yieldPotentialGrams: 360,
        isHarvested: false,
        dimensions: { length: 3, width: 3, height: 12, unit: 'ft' },
        notes: 'Climbing clockwise up 16ft vertical coir twine on the south hop yard trellis.'
      };

      const citraHop: PlantItem = {
        id: `hop-citra-${now}`,
        name: 'Citra Hops (Bine #2)',
        category: 'plant',
        species: 'Hops',
        strainName: 'Citra (HBC 394)',
        propagationType: 'cutting',
        stage: 'flowering',
        stageProgress: 40,
        ageDays: 45,
        currentStageDays: 8,
        keyDates: {
          plantedDate: now - 45 * 86400000,
          rootedDate: now - 38 * 86400000,
          seedlingDate: now - 38 * 86400000,
          matureSeedlingDate: now - 30 * 86400000,
          vegetativeDate: now - 22 * 86400000,
          floweringDate: now - 8 * 86400000
        },
        systemType: 'in_ground',
        containerType: 'in_ground_earth',
        containerVolumeGallons: 100,
        growingMedium: 'native_garden_loam',
        nutrientProgram: 'organic_living_soil',
        soilPh: 6.4,
        ecTdsPpm: 1400,
        microbialHealth: 94,
        aerationOxygenPct: 85,
        alphaAcidsPct: 11.8,
        health: 96,
        soilMoisture: 68,
        rootTempF: 69.2,
        nutrientLevel: 'balanced',
        heightInches: 144, // 12 feet tall bine with cone burrs
        canopyWidthInches: 36,
        yieldPotentialGrams: 440,
        isHarvested: false,
        dimensions: { length: 3, width: 3, height: 14, unit: 'ft' },
        notes: 'Abundant burrs transforming into papery cones rich in tropical lupulin glands.'
      };

      newRoom.items.push(cascadeHop, citraHop);
    } else if (starterSetup === 'starter_raised_bed') {
      const heirloomTomato: PlantItem = {
        id: `plant-garden-tom-${now}`,
        name: 'Heirloom Brandywine Tomato',
        category: 'plant',
        species: 'Tomato',
        strainName: 'Brandywine Heirloom',
        propagationType: 'seed',
        stage: 'flowering',
        stageProgress: 55,
        ageDays: 40,
        currentStageDays: 10,
        keyDates: {
          plantedDate: now - 40 * 86400000,
          sproutedDate: now - 36 * 86400000,
          seedlingDate: now - 36 * 86400000,
          matureSeedlingDate: now - 28 * 86400000,
          vegetativeDate: now - 20 * 86400000,
          floweringDate: now - 10 * 86400000
        },
        systemType: 'raised_bed',
        containerType: 'raised_bed_cedar',
        containerVolumeGallons: 50,
        growingMedium: 'living_organic_soil',
        nutrientProgram: 'organic_living_soil',
        soilPh: 6.6,
        ecTdsPpm: 1300,
        microbialHealth: 98,
        aerationOxygenPct: 90,
        health: 96,
        soilMoisture: 70,
        rootTempF: 70.0,
        nutrientLevel: 'balanced',
        heightInches: 42,
        canopyWidthInches: 28,
        yieldPotentialGrams: 480,
        isHarvested: false,
        dimensions: { length: 2.5, width: 2.5, height: 3.5, unit: 'ft' },
        notes: 'Thriving in cedar raised bed under open sunshine.'
      };
      newRoom.items.push(heirloomTomato);
    } else if (starterSetup === 'starter_veg') {
      newRoom.tents.push({
        id: `tent-${now}-starter`,
        name: 'Starter Veg 4x4 Tent',
        brand: 'AC Infinity',
        modelName: 'CLOUDLAB 844',
        dimensions: { length: 4, width: 4, height: 6.67, unit: 'ft' },
        climate: {
          tempF: 74.5,
          tempC: 23.6,
          rh: 60,
          lightPPFD: 450,
          vpdKpa: calculateVPD(74.5, 60, 450),
          co2Ppm: outdoorCo2Ppm
        },
        items: [
          {
            id: `eq-light-${now}`,
            name: '300W LED Quantum Bar',
            category: 'equipment',
            type: 'grow_light',
            powerOn: true,
            powerWatts: 300,
            setting: 70,
            schedule: { enabled: true, onHour: 6, offHour: 0 },
            dimensions: { length: 3, width: 3, height: 0.3, unit: 'ft' }
          },
          {
            id: `eq-fan-${now}`,
            name: '4" EC Inline Exhaust Fan',
            category: 'equipment',
            type: 'exhaust_fan',
            powerOn: true,
            powerWatts: 45,
            setting: 50,
            dimensions: { length: 1, width: 0.7, height: 0.7, unit: 'ft' }
          }
        ],
        exhaustFanSpeed: 50,
        activePreset: 'veg'
      });
    }

    onAddRoom(newRoom);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-zinc-100 my-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Add New Cultivation Room</h3>
              <p className="text-xs text-zinc-400">Expand your facility with an additional lung room or dedicated growing space</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs: Outdoor Gardens vs Indoor Rooms */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('outdoor');
              const firstOutdoor = ROOM_PRESETS.find(p => p.category === 'outdoor');
              if (firstOutdoor) handleSelectPreset(firstOutdoor);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === 'outdoor'
                ? 'bg-emerald-600 text-zinc-950 shadow-md shadow-emerald-950/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Trees className="w-4 h-4" />
            <span>Outdoor Gardens &amp; Hop Yards ({ROOM_PRESETS.filter(p => p.category === 'outdoor').length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('indoor');
              const firstIndoor = ROOM_PRESETS.find(p => p.category === 'indoor');
              if (firstIndoor) handleSelectPreset(firstIndoor);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === 'indoor'
                ? 'bg-emerald-600 text-zinc-950 shadow-md shadow-emerald-950/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Indoor Grow Rooms ({ROOM_PRESETS.filter(p => p.category === 'indoor').length})</span>
          </button>
        </div>

        {/* Preset Cards */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-zinc-300 block uppercase tracking-wider font-mono">
            Select {activeCategory === 'outdoor' ? 'Garden Layout' : 'Architectural'} Template:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ROOM_PRESETS.filter(p => p.category === activeCategory).map(preset => {
              const Icon = preset.icon;
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/70 shadow-sm ring-1 ring-emerald-500/50'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-850 text-zinc-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-200">{preset.name}</h4>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{preset.desc}</p>
                    <div className="mt-2 text-[10px] font-mono text-zinc-500 flex gap-2">
                      <span>{preset.dimensions.length}×{preset.dimensions.width}×{preset.dimensions.height} ft</span>
                      <span>·</span>
                      <span className="capitalize">{preset.environmentType.replace('_', ' ')}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Room Form */}
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          {/* Room Name */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Garden / Room Identifier:
            </label>
            <input
              type="text"
              required
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              placeholder="e.g. Craft Hop Yard, Backyard Raised Beds, Basement Suite"
            />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Length (ft):</label>
              <input
                type="number"
                min="6"
                max="60"
                step="0.5"
                value={length}
                onChange={e => setLength(parseFloat(e.target.value) || 12)}
                className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-1.5 text-sm font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Width (ft):</label>
              <input
                type="number"
                min="6"
                max="60"
                step="0.5"
                value={width}
                onChange={e => setWidth(parseFloat(e.target.value) || 12)}
                className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-1.5 text-sm font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                {environmentType === 'outdoor_garden' ? 'Trellis / Height (ft):' : 'Ceiling Height (ft):'}
              </label>
              <input
                type="number"
                min="6"
                max="25"
                step="0.5"
                value={height}
                onChange={e => setHeight(parseFloat(e.target.value) || 8)}
                className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-1.5 text-sm font-mono text-zinc-100"
              />
            </div>
          </div>

          {/* Environmental Behavior Notice */}
          {environmentType === 'outdoor_garden' ? (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5">
              <Sun className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-200">Outdoor Garden Solar &amp; Weather Dynamics:</span>
                <p className="text-[11px] text-emerald-300/80 mt-0.5">
                  Plants grow under live outdoor sunlight (up to 1600+ PPFD on sunny days) and natural rain replenishes soil moisture. Hop bines climb vertically along the {height}ft trellis cables.
                </p>
              </div>
            </div>
          ) : environmentType === 'greenhouse' ? (
            <div className="p-3 bg-teal-950/30 border border-teal-800/50 rounded-xl text-xs text-teal-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-teal-200">Solar Greenhouse Glazing:</span>
                <p className="text-[11px] text-teal-300/80 mt-0.5">
                  Double-polycarbonate glazing traps solar warmth (+5 to 7°F thermal lift) while transmitting 82% natural daylight sunlight.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-sky-950/20 border border-sky-900/40 rounded-xl text-xs text-sky-300/90 flex items-start gap-2.5">
              <Wind className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-sky-200">Indoor Infiltration &amp; Central HVAC:</span>
                <p className="text-[11px] text-sky-300/80 mt-0.5">
                  Exchanges fresh air with outdoor baseline (<strong>{outdoorCo2Ppm} PPM CO₂</strong>) with R-{wallRValue} insulation and central HVAC conditioning.
                </p>
              </div>
            </div>
          )}

          {/* Starter Equipment & Crops Selection */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Initial Starter Planting / Setup:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStarterSetup('empty')}
                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                  starterSetup === 'empty'
                    ? 'bg-zinc-800 text-zinc-100 border-emerald-500/60'
                    : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                }`}
              >
                <span className="block font-semibold">Empty Space</span>
                <span className="text-[11px] text-zinc-500">Add plants and containers manually</span>
              </button>

              {environmentType === 'outdoor_garden' || environmentType === 'greenhouse' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStarterSetup('starter_hops')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      starterSetup === 'starter_hops'
                        ? 'bg-zinc-800 text-zinc-100 border-emerald-500/60 ring-1 ring-emerald-500/40'
                        : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    <span className="block font-semibold text-amber-300">Trellised Hops Array</span>
                    <span className="text-[11px] text-zinc-400">Cascade &amp; Citra climbing bines</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStarterSetup('starter_raised_bed')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      starterSetup === 'starter_raised_bed'
                        ? 'bg-zinc-800 text-zinc-100 border-emerald-500/60 ring-1 ring-emerald-500/40'
                        : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    <span className="block font-semibold text-rose-300">Cedar Raised Bed Veg</span>
                    <span className="text-[11px] text-zinc-400">Heirloom tomato in living soil</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setStarterSetup('starter_veg')}
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    starterSetup === 'starter_veg'
                      ? 'bg-zinc-800 text-zinc-100 border-emerald-500/60'
                      : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                  }`}
                >
                  <span className="block font-semibold">Include 4x4 Veg Tent</span>
                  <span className="text-[11px] text-zinc-500">Pre-wired with 300W LED &amp; fan</span>
                </button>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

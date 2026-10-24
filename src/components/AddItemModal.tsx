import React, { useState } from 'react';
import { 
  X, 
  Box, 
  Sprout, 
  Flower2, 
  Zap, 
  Wind, 
  Droplets, 
  Thermometer, 
  Sun, 
  Check, 
  Plus, 
  Shield, 
  Layers, 
  Sparkles,
  User,
  Dog,
  Cat,
  Activity,
  Heart,
  Clock,
  SlidersHorizontal
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
  PlantSpecies, 
  MushroomSpecies, 
  EquipmentType,
  TentBrand,
  Dimensions,
  CultivationSystemType,
  ContainerType,
  GrowingMedium,
  NutrientProgram
} from '../types/sim';
import { calculateVPD } from '../utils/physics';
import { TENT_CATALOG, CatalogTentModel } from '../utils/tentCatalog';
import { PropagationType, PlantStage, PlantKeyDates } from '../types/sim';
import { DEFAULT_STAGE_DURATIONS, DEFAULT_STAGE_REQUIREMENTS, formatSimDateTime, HOP_CULTIVARS, PEPPER_CULTIVARS } from '../utils/plantLifecycle';
import { getDefaultItemDimensions, getDefaultSpatialPosition } from '../utils/spatial';

interface AddItemModalProps {
  room: Room;
  targetTentId?: string | null;
  isOpen: boolean;
  simTime?: number;
  onClose: () => void;
  onAddTent: (tent: Tent) => void;
  onAddItem: (item: Item, tentId?: string | null) => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  room,
  targetTentId,
  isOpen,
  simTime,
  onClose,
  onAddTent,
  onAddItem,
}) => {
  const [activeTab, setActiveTab] = useState<'tent' | 'plant' | 'mushroom' | 'equipment' | 'person' | 'pet'>(
    targetTentId ? 'plant' : 'tent'
  );
  const [selectedDestinationTentId, setSelectedDestinationTentId] = useState<string>(
    targetTentId || 'room'
  );

  React.useEffect(() => {
    if (isOpen) {
      if (targetTentId) {
        setSelectedDestinationTentId(targetTentId);
        setActiveTab(prev => prev === 'tent' ? 'plant' : prev);
      } else {
        if (selectedDestinationTentId !== 'room') {
          const tentExists = room.tents && room.tents.some(t => t.id === selectedDestinationTentId);
          if (!tentExists) {
            setSelectedDestinationTentId(room.tents && room.tents.length > 0 ? room.tents[0].id : 'room');
          }
        }
      }
    }
  }, [targetTentId, isOpen, room]);

  // Tent Catalog & Form State
  const [tentBrandFilter, setTentBrandFilter] = useState<'all' | 'AC Infinity' | 'Spider Farmer' | 'Custom'>('AC Infinity');
  const [selectedCatalogTent, setSelectedCatalogTent] = useState<CatalogTentModel>(TENT_CATALOG[7]); // CLOUDLAB 844 default
  const [tentFriendlyName, setTentFriendlyName] = useState('Grow Tent #1');
  const [customTentName, setCustomTentName] = useState('Custom Grow Tent');
  const [customLength, setCustomLength] = useState(4);
  const [customWidth, setCustomWidth] = useState(4);
  const [customHeight, setCustomHeight] = useState(6.5);

  // Plant Form State
  const [plantSpecies, setPlantSpecies] = useState<PlantSpecies>('Cannabis');
  const [plantName, setPlantName] = useState('Gorilla Glue #4');
  const [plantStrain, setPlantStrain] = useState('Sour Dubb x Chem Sister');
  const [selectedHopIdx, setSelectedHopIdx] = useState(0);
  const [selectedPepperIdx, setSelectedPepperIdx] = useState(0);
  const [propagationType, setPropagationType] = useState<PropagationType>('seed');
  const [plantStage, setPlantStage] = useState<PlantStage>('germination');
  const [germinationDays, setGerminationDays] = useState(4);
  const [rootingDays, setRootingDays] = useState(10);
  const [seedlingDays, setSeedlingDays] = useState(8);
  const [matureSeedlingDays, setMatureSeedlingDays] = useState(10);
  const [vegDays, setVegDays] = useState(28);
  const [flowerDays, setFlowerDays] = useState(60);
  const [ripenDays, setRipenDays] = useState(10);
  const [showAdvancedDurations, setShowAdvancedDurations] = useState(false);

  // Soil & Hydroponic Customization State
  const [systemType, setSystemType] = useState<CultivationSystemType>('soil_container');
  const [containerType, setContainerType] = useState<ContainerType>('fabric_pot');
  const [containerVolume, setContainerVolume] = useState<number>(5);
  const [growingMedium, setGrowingMedium] = useState<GrowingMedium>('living_organic_soil');
  const [nutrientProgram, setNutrientProgram] = useState<NutrientProgram>('organic_living_soil');
  const [showSoilCustomizer, setShowSoilCustomizer] = useState(true);

  // Mushroom Form State
  const [mushroomSpecies, setMushroomSpecies] = useState<MushroomSpecies>('Lion\'s Mane');
  const [mushroomName, setMushroomName] = useState('Lion\'s Mane Fruiting Block');
  const [mushroomContainer, setMushroomContainer] = useState<'monotub' | 'grow_bag' | 'fruiting_block'>('fruiting_block');

  // Equipment Form State
  const [eqType, setEqType] = useState<EquipmentType>('grow_light');
  const [eqName, setEqName] = useState('Pro-Quantum 240W LED');
  const [eqWatts, setEqWatts] = useState(240);

  // Person Form State
  const [personName, setPersonName] = useState('Grower / Cultivator');
  const [personActivity, setPersonActivity] = useState<PersonActivity>('normal');

  // Pet Form State
  const [petName, setPetName] = useState('Golden Retriever');
  const [petType, setPetType] = useState<PetType>('dog_large');
  const [petBreed, setPetBreed] = useState('Golden Retriever');

  if (!isOpen) return null;

  const handleCreateTent = () => {
    const newTentId = `tent-${Date.now()}`;
    const isCustom = tentBrandFilter === 'Custom';

    const tentName = tentFriendlyName.trim() || (isCustom 
      ? customTentName 
      : `${selectedCatalogTent.brand} ${selectedCatalogTent.modelName}`);

    const dimensions: Dimensions = isCustom
      ? { length: Number(customLength) || 4, width: Number(customWidth) || 4, height: Number(customHeight) || 6.5, unit: 'ft' }
      : selectedCatalogTent.dimensions;

    const newTent: Tent = {
      id: newTentId,
      name: tentName,
      brand: isCustom ? 'Custom' : selectedCatalogTent.brand,
      modelName: isCustom ? undefined : selectedCatalogTent.modelName,
      mylarRating: isCustom ? '600D Mylar' : selectedCatalogTent.mylarRating,
      poleDiameter: isCustom ? '16mm Steel' : selectedCatalogTent.poleDiameter,
      ventPorts: isCustom ? 'Dual Cinch Ports' : selectedCatalogTent.ventPorts,
      dimensions,
      position: getDefaultSpatialPosition('tent', room.dimensions, room.tents.length),
      climate: {
        tempF: room.climate.tempF,
        tempC: room.climate.tempC,
        rh: room.climate.rh,
        lightPPFD: 0,
        vpdKpa: calculateVPD(room.climate.tempF, room.climate.rh, 0),
        co2Ppm: room.climate.co2Ppm || 420
      },
      exhaustFanSpeed: 0, // Defaults to 0! No running fan in an empty tent
      items: []
    };

    onAddTent(newTent);
    onClose();
  };

  const handleCreatePlant = () => {
    const now = simTime || Date.now();
    const keyDates: PlantKeyDates = {
      plantedDate: now
    };

    let calculatedAgeDays = 0;
    let initialHeight = 2;
    let initialCanopy = 2;

    if (propagationType === 'seed') {
      if (plantStage === 'germination') {
        calculatedAgeDays = 0;
        initialHeight = 1;
        initialCanopy = 1;
      } else if (plantStage === 'seedling') {
        calculatedAgeDays = germinationDays;
        keyDates.plantedDate = now - calculatedAgeDays * 86400000;
        keyDates.sproutedDate = now;
        keyDates.seedlingDate = now;
        initialHeight = 4;
        initialCanopy = 3;
      } else if (plantStage === 'mature_seedling') {
        calculatedAgeDays = germinationDays + seedlingDays;
        keyDates.plantedDate = now - calculatedAgeDays * 86400000;
        keyDates.sproutedDate = now - seedlingDays * 86400000;
        keyDates.seedlingDate = now - seedlingDays * 86400000;
        keyDates.matureSeedlingDate = now;
        initialHeight = 10;
        initialCanopy = 8;
      } else if (plantStage === 'vegetative') {
        calculatedAgeDays = germinationDays + seedlingDays + matureSeedlingDays;
        keyDates.plantedDate = now - calculatedAgeDays * 86400000;
        keyDates.sproutedDate = now - (seedlingDays + matureSeedlingDays) * 86400000;
        keyDates.seedlingDate = now - (seedlingDays + matureSeedlingDays) * 86400000;
        keyDates.matureSeedlingDate = now - matureSeedlingDays * 86400000;
        keyDates.vegetativeDate = now;
        initialHeight = 22;
        initialCanopy = 18;
      } else if (plantStage === 'flowering') {
        calculatedAgeDays = germinationDays + seedlingDays + matureSeedlingDays + vegDays;
        keyDates.plantedDate = now - calculatedAgeDays * 86400000;
        keyDates.sproutedDate = now - (seedlingDays + matureSeedlingDays + vegDays) * 86400000;
        keyDates.seedlingDate = now - (seedlingDays + matureSeedlingDays + vegDays) * 86400000;
        keyDates.matureSeedlingDate = now - (matureSeedlingDays + vegDays) * 86400000;
        keyDates.vegetativeDate = now - vegDays * 86400000;
        keyDates.floweringDate = now;
        initialHeight = 34;
        initialCanopy = 26;
      }
    } else {
      // Cutting / Clone
      if (plantStage === 'rooting') {
        calculatedAgeDays = 0;
        initialHeight = 4;
        initialCanopy = 3;
      } else if (plantStage === 'seedling') {
        calculatedAgeDays = rootingDays;
        keyDates.plantedDate = now - calculatedAgeDays * 86400000;
        keyDates.rootedDate = now;
        keyDates.seedlingDate = now;
        initialHeight = 6;
        initialCanopy = 4;
      } else if (plantStage === 'mature_seedling') {
        calculatedAgeDays = rootingDays + seedlingDays;
        keyDates.plantedDate = now - calculatedAgeDays * 86400000;
        keyDates.rootedDate = now - seedlingDays * 86400000;
        keyDates.seedlingDate = now - seedlingDays * 86400000;
        keyDates.matureSeedlingDate = now;
        initialHeight = 12;
        initialCanopy = 9;
      } else if (plantStage === 'vegetative') {
        calculatedAgeDays = rootingDays + seedlingDays + matureSeedlingDays;
        keyDates.plantedDate = now - calculatedAgeDays * 86400000;
        keyDates.rootedDate = now - (seedlingDays + matureSeedlingDays) * 86400000;
        keyDates.seedlingDate = now - (seedlingDays + matureSeedlingDays) * 86400000;
        keyDates.matureSeedlingDate = now - matureSeedlingDays * 86400000;
        keyDates.vegetativeDate = now;
        initialHeight = 24;
        initialCanopy = 20;
      } else if (plantStage === 'flowering') {
        calculatedAgeDays = rootingDays + seedlingDays + matureSeedlingDays + vegDays;
        keyDates.plantedDate = now - calculatedAgeDays * 86400000;
        keyDates.rootedDate = now - (seedlingDays + matureSeedlingDays + vegDays) * 86400000;
        keyDates.seedlingDate = now - (seedlingDays + matureSeedlingDays + vegDays) * 86400000;
        keyDates.matureSeedlingDate = now - (matureSeedlingDays + vegDays) * 86400000;
        keyDates.vegetativeDate = now - vegDays * 86400000;
        keyDates.floweringDate = now;
        initialHeight = 36;
        initialCanopy = 28;
      }
    }

    const isHop = plantSpecies === 'Hops';
    const hopData = isHop ? HOP_CULTIVARS[selectedHopIdx] : null;
    const isPepper = plantSpecies === 'Chili Pepper';
    const pepperData = isPepper ? PEPPER_CULTIVARS[selectedPepperIdx] : null;

    const initialPh = (growingMedium === 'hydroton_clay_pebbles' || growingMedium === 'rockwool_cubes' || growingMedium === 'aeroponic_mist' || systemType === 'dwc' || systemType === 'ebb_and_flow' || systemType === 'aeroponics') ? 5.8 : 6.4;
    const initialEc = nutrientProgram === 'water_only_flush' ? 300 : nutrientProgram === 'salt_mineral_ab' ? 1100 : 850;

    const newPlant: PlantItem = {
      id: `plant-${Date.now()}`,
      name: plantName || (isHop && hopData ? `${hopData.name} Bine` : isPepper && pepperData ? `${pepperData.name} Pepper` : `${plantSpecies} Pot`),
      category: 'plant',
      species: plantSpecies,
      strainName: isHop && hopData 
        ? `${hopData.variety} (${hopData.aromaProfile})` 
        : isPepper && pepperData
          ? `${pepperData.variety} (${pepperData.scovilleRating})`
          : (plantStrain || plantSpecies),
      propagationType,
      stage: plantStage,
      stageProgress: plantStage === 'germination' || plantStage === 'rooting' ? 0 : 15,
      ageDays: calculatedAgeDays,
      currentStageDays: 0,
      keyDates,
      germinationDaysExpected: germinationDays,
      rootingDaysExpected: rootingDays,
      seedlingDaysExpected: seedlingDays,
      matureSeedlingDaysExpected: matureSeedlingDays,
      vegetativeDaysExpected: vegDays,
      floweringDaysExpected: flowerDays,
      ripeningDaysExpected: ripenDays,
      stageRequirements: DEFAULT_STAGE_REQUIREMENTS,
      health: 98,
      soilMoisture: plantStage === 'germination' || plantStage === 'rooting' ? 82 : 72,
      rootTempF: plantStage === 'germination' || plantStage === 'rooting' ? (isPepper ? 82.0 : 74.0) : 68.0,
      nutrientLevel: 'balanced',
      heightInches: initialHeight,
      canopyWidthInches: initialCanopy,
      yieldPotentialGrams: isHop ? (hopData?.expectedYieldGrams || 400) : isPepper ? (pepperData?.expectedYieldGrams || 350) : plantSpecies === 'Cannabis' ? 130 : plantSpecies === 'Tomato' ? 220 : 85,
      isHarvested: false,
      dimensions: getDefaultItemDimensions({
        category: 'plant',
        species: plantSpecies,
        stage: plantStage
      }),
      position: (() => {
        const targetDims = selectedDestinationTentId && selectedDestinationTentId !== 'room' 
          ? (room.tents.find(t => t.id === selectedDestinationTentId)?.dimensions || room.dimensions)
          : room.dimensions;
        const count = selectedDestinationTentId && selectedDestinationTentId !== 'room'
          ? (room.tents.find(t => t.id === selectedDestinationTentId)?.items.length || 0)
          : room.items.length;
        return getDefaultSpatialPosition('plant', targetDims, count);
      })(),
      notes: `${propagationType === 'seed' ? 'Planted from seed for germination' : isHop ? 'Planted from dormant rhizome cutting' : 'Started from fresh vegetative cutting/clone'}.`,
      systemType,
      containerType,
      containerVolumeGallons: containerVolume,
      growingMedium,
      nutrientProgram,
      soilPh: initialPh,
      ecTdsPpm: initialEc,
      microbialHealth: (growingMedium === 'living_organic_soil' || growingMedium === 'native_garden_loam') ? 95 : 40,
      aerationOxygenPct: (systemType === 'dwc' || systemType === 'aeroponics' || containerType === 'fabric_pot') ? 92 : 76,
      reservoirTempF: (systemType === 'dwc' || systemType === 'ebb_and_flow') ? 68.0 : undefined,
      alphaAcidsPct: isHop && hopData ? parseFloat(hopData.alphaAcids) || 7.5 : undefined,
      scovilleHeatUnits: isPepper && pepperData ? pepperData.scovilleHeatUnits : undefined,
    };
    onAddItem(newPlant, selectedDestinationTentId === 'room' ? null : selectedDestinationTentId);
    onClose();
  };

  const handleCreateMushroom = () => {
    const targetDims = selectedDestinationTentId && selectedDestinationTentId !== 'room' 
      ? (room.tents.find(t => t.id === selectedDestinationTentId)?.dimensions || room.dimensions)
      : room.dimensions;
    const count = selectedDestinationTentId && selectedDestinationTentId !== 'room'
      ? (room.tents.find(t => t.id === selectedDestinationTentId)?.items.length || 0)
      : room.items.length;

    const newMushroom: MushroomItem = {
      id: `shroom-${Date.now()}`,
      name: mushroomName || `${mushroomSpecies} Culture`,
      category: 'mushroom',
      species: mushroomSpecies,
      strainName: `${mushroomSpecies} Premium Spores`,
      stage: 'pinning',
      stageProgress: 15,
      ageDays: 14,
      health: 96,
      substrateMoisture: 88,
      myceliumColonization: 95,
      flushCount: 0,
      yieldPotentialGrams: 280,
      isHarvested: false,
      containerType: mushroomContainer,
      dimensions: getDefaultItemDimensions({ category: 'mushroom', containerType: mushroomContainer }),
      position: getDefaultSpatialPosition('mushroom', targetDims, count)
    };
    onAddItem(newMushroom, selectedDestinationTentId === 'room' ? null : selectedDestinationTentId);
    onClose();
  };

  const handleCreateEquipment = () => {
    const targetDims = selectedDestinationTentId && selectedDestinationTentId !== 'room' 
      ? (room.tents.find(t => t.id === selectedDestinationTentId)?.dimensions || room.dimensions)
      : room.dimensions;
    const count = selectedDestinationTentId && selectedDestinationTentId !== 'room'
      ? (room.tents.find(t => t.id === selectedDestinationTentId)?.items.length || 0)
      : room.items.length;

    const newEq: EquipmentItem = {
      id: `eq-${Date.now()}`,
      name: eqName || `${eqType.replace('_', ' ')}`,
      category: 'equipment',
      type: eqType,
      powerOn: true,
      powerWatts: Number(eqWatts) || (eqType === 'co2_bag' ? 0 : 25),
      setting: 75,
      targetRh: eqType === 'humidifier' ? 65 : eqType === 'dehumidifier' ? 50 : undefined,
      targetCo2Ppm: eqType === 'co2_regulator' ? 1200 : undefined,
      schedule: eqType === 'grow_light' ? { enabled: true, onHour: 6, offHour: 0 } : undefined,
      dimensions: getDefaultItemDimensions({ category: 'equipment', type: eqType }),
      position: getDefaultSpatialPosition('equipment', targetDims, count, eqType)
    };
    onAddItem(newEq, selectedDestinationTentId === 'room' ? null : selectedDestinationTentId);
    onClose();
  };

  const handleCreatePerson = () => {
    const activitySpecs: Record<PersonActivity, { co2: number; watts: number; moisture: number; label: string }> = {
      resting: { co2: 15, watts: 75, moisture: 0.8, label: 'Resting / Seated' },
      normal: { co2: 22, watts: 100, moisture: 1.2, label: 'Normal Care & Inspection' },
      active: { co2: 32, watts: 140, moisture: 1.8, label: 'Active Trellising & Pruning' },
      exercising: { co2: 50, watts: 210, moisture: 2.5, label: 'Heavy Exertion & Moving Pots' }
    };
    const spec = activitySpecs[personActivity];
    const targetDims = selectedDestinationTentId && selectedDestinationTentId !== 'room' 
      ? (room.tents.find(t => t.id === selectedDestinationTentId)?.dimensions || room.dimensions)
      : room.dimensions;
    const count = selectedDestinationTentId && selectedDestinationTentId !== 'room'
      ? (room.tents.find(t => t.id === selectedDestinationTentId)?.items.length || 0)
      : room.items.length;

    const newPerson: PersonItem = {
      id: `person-${Date.now()}`,
      name: personName.trim() || 'Cultivator',
      category: 'person',
      activity: personActivity,
      co2RateLitersPerHour: spec.co2,
      heatOutputWatts: spec.watts,
      moistureLitersPerDay: spec.moisture,
      dimensions: getDefaultItemDimensions({ category: 'person' }),
      position: getDefaultSpatialPosition('person', targetDims, count),
      notes: `Biological occupant (${spec.label}) exhaling ~${spec.co2} L/hr CO₂ with ${spec.watts}W metabolic heat.`
    };
    onAddItem(newPerson, selectedDestinationTentId === 'room' ? null : selectedDestinationTentId);
    onClose();
  };

  const handleCreatePet = () => {
    const petSpecs: Record<PetType, { co2: number; watts: number; moisture: number; label: string }> = {
      dog_large: { co2: 10, watts: 45, moisture: 0.6, label: 'Large Dog (50-85 lbs)' },
      dog_medium: { co2: 6, watts: 28, moisture: 0.4, label: 'Medium Dog (25-50 lbs)' },
      dog_small: { co2: 3.5, watts: 18, moisture: 0.25, label: 'Small Dog / Puppy (<25 lbs)' },
      cat: { co2: 2.2, watts: 12, moisture: 0.18, label: 'Domestic Cat (8-15 lbs)' }
    };
    const spec = petSpecs[petType];
    const targetDims = selectedDestinationTentId && selectedDestinationTentId !== 'room' 
      ? (room.tents.find(t => t.id === selectedDestinationTentId)?.dimensions || room.dimensions)
      : room.dimensions;
    const count = selectedDestinationTentId && selectedDestinationTentId !== 'room'
      ? (room.tents.find(t => t.id === selectedDestinationTentId)?.items.length || 0)
      : room.items.length;

    const newPet: PetItem = {
      id: `pet-${Date.now()}`,
      name: petName.trim() || spec.label,
      category: 'pet',
      petType,
      breed: petBreed.trim() || undefined,
      co2RateLitersPerHour: spec.co2,
      heatOutputWatts: spec.watts,
      moistureLitersPerDay: spec.moisture,
      dimensions: getDefaultItemDimensions({ category: 'pet', petType }),
      position: getDefaultSpatialPosition('pet', targetDims, count),
      notes: `Pet occupant exhaling ~${spec.co2} L/hr CO₂ with ${spec.watts}W body warmth.`
    };
    onAddItem(newPet, selectedDestinationTentId === 'room' ? null : selectedDestinationTentId);
    onClose();
  };

  const filteredCatalog = TENT_CATALOG.filter(t => {
    if (tentBrandFilter === 'all') return true;
    return t.brand === tentBrandFilter;
  });

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-zinc-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Add to Grow Operation</h3>
              <p className="text-xs text-zinc-400">Choose standard brand tents, crops, or climate gear</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className={`grid gap-2 my-4 ${targetTentId ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-6'}`}>
          {!targetTentId && (
            <button
              onClick={() => setActiveTab('tent')}
              className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                activeTab === 'tent'
                  ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Tent</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('plant')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              activeTab === 'plant'
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Flower2 className="w-3.5 h-3.5" />
            <span>Plant</span>
          </button>

          <button
            onClick={() => setActiveTab('mushroom')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              activeTab === 'mushroom'
                ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sprout className="w-3.5 h-3.5" />
            <span>Fungi</span>
          </button>

          <button
            onClick={() => setActiveTab('equipment')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              activeTab === 'equipment'
                ? 'bg-teal-600 border-teal-500 text-white shadow-sm'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Gear</span>
          </button>

          <button
            onClick={() => setActiveTab('person')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              activeTab === 'person'
                ? 'bg-violet-600 border-violet-500 text-white shadow-sm'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Person</span>
          </button>

          <button
            onClick={() => setActiveTab('pet')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              activeTab === 'pet'
                ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Dog className="w-3.5 h-3.5" />
            <span>Pet</span>
          </button>
        </div>

        {/* Destination Target (for non-tent items) */}
        {activeTab !== 'tent' && (
          <div className="mb-4 bg-zinc-950/70 border border-zinc-800 rounded-xl p-3">
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Select Placement Destination:
            </label>
            <select
              value={selectedDestinationTentId}
              onChange={e => setSelectedDestinationTentId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-750 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="room">{room.name} (Freestanding Room Floor)</option>
              {room.tents.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.dimensions.length}x{t.dimensions.width}ft)</option>
              ))}
            </select>
          </div>
        )}

        {/* 1. STANDARD TENT CATALOG TAB */}
        {activeTab === 'tent' && (
          <div className="space-y-4">
            {/* Brand Filter Pills */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
              {(['AC Infinity', 'Spider Farmer', 'all', 'Custom'] as const).map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setTentBrandFilter(b as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tentBrandFilter === b
                      ? b === 'AC Infinity'
                        ? 'bg-sky-600 text-white'
                        : b === 'Spider Farmer'
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-750 text-white'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {b === 'all' ? 'All Models' : b}
                </button>
              ))}
            </div>

            {tentBrandFilter !== 'Custom' ? (
              <div className="space-y-3">
                <span className="text-xs text-zinc-400 block">
                  Select official factory tent enclosure from inventory:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {filteredCatalog.map(item => {
                    const isSelected = selectedCatalogTent.id === item.id;
                    const vol = Math.round(item.dimensions.length * item.dimensions.width * item.dimensions.height);
                    const isACI = item.brand === 'AC Infinity';

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedCatalogTent(item)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? isACI 
                              ? 'bg-sky-950/70 border-sky-500 shadow-md ring-1 ring-sky-500/30' 
                              : 'bg-amber-950/70 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-mono uppercase tracking-wider font-bold px-1.5 py-0.2 rounded ${
                              isACI ? 'bg-sky-950 border border-sky-800 text-sky-300' : 'bg-amber-950 border border-amber-800 text-amber-300'
                            }`}>
                              {item.brand}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-zinc-200">
                              {item.dimensionsInches}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-zinc-100 flex items-center justify-between">
                            <span>{item.modelName}</span>
                            <span className="text-[10px] font-mono text-zinc-400">{vol} cu ft</span>
                          </h4>

                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-tight">
                            {item.description}
                          </p>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-zinc-850 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                          <span>{item.mylarRating.split(' ')[0]} Mylar · {item.poleDiameter.split(' ')[0]}</span>
                          <span className={isSelected ? 'text-sky-400 font-bold flex items-center gap-0.5' : 'text-zinc-500'}>
                            {isSelected ? '✓ Selected' : 'Click to Pick'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Name for the Tent */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-200 block">
                    Tent Custom Name / Label (Displayed in Simulation &amp; 2D Game):
                  </label>
                  <input
                    type="text"
                    value={tentFriendlyName}
                    onChange={e => setTentFriendlyName(e.target.value)}
                    placeholder="e.g. Veg Tent #1, Propagation Nursery, Flower Tent 4x4"
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-400">
                    Selected Model: <span className="font-mono text-zinc-300 font-semibold">{selectedCatalogTent.brand} {selectedCatalogTent.modelName} ({selectedCatalogTent.dimensionsInches})</span>
                  </p>
                </div>

                {/* Selected Tent Highlight Bar */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-sky-400 block">Hardware Spec</span>
                    <strong className="text-zinc-200 font-bold">{selectedCatalogTent.brand} {selectedCatalogTent.modelName}</strong>
                    <span className="text-zinc-400 block text-[11px]">{selectedCatalogTent.recommendedUse}</span>
                  </div>
                  <button
                    onClick={handleCreateTent}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white shadow-md shadow-sky-950/50"
                  >
                    Deploy Tent
                  </button>
                </div>
              </div>
            ) : (
              /* Custom Dimensions Form */
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Custom Tent Name</label>
                  <input
                    type="text"
                    value={customTentName}
                    onChange={e => setCustomTentName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">Length (ft)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="2"
                      max="20"
                      value={customLength}
                      onChange={e => setCustomLength(parseFloat(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">Width (ft)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="2"
                      max="20"
                      value={customWidth}
                      onChange={e => setCustomWidth(parseFloat(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">Height (ft)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="3"
                      max="12"
                      value={customHeight}
                      onChange={e => setCustomHeight(parseFloat(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTent}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-md"
                  >
                    Build Custom Tent
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. PLANT FORM */}
        {activeTab === 'plant' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Botanical Species</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['Cannabis', 'Hops', 'Tomato', 'Chili Pepper', 'Basil'] as PlantSpecies[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPlantSpecies(s);
                      if (s === 'Hops') {
                        const h = HOP_CULTIVARS[selectedHopIdx];
                        setPlantName(`${h.name} Bine`);
                        setPlantStrain(h.variety);
                        setContainerType('raised_bed_cedar');
                        setSystemType('raised_bed');
                        setContainerVolume(30);
                        setGrowingMedium('living_organic_soil');
                        setNutrientProgram('organic_living_soil');
                        setVegDays(45);
                        setFlowerDays(h.floweringDays);
                      } else if (s === 'Cannabis') {
                        setPlantName('Gorilla Glue #4');
                        setPlantStrain('Sour Dubb x Chem Sister');
                      } else if (s === 'Tomato') {
                        setPlantName('Cherokee Purple');
                        setPlantStrain('Heirloom Beefsteak');
                        setGerminationDays(6);
                        setVegDays(28);
                        setFlowerDays(45);
                      } else if (s === 'Chili Pepper') {
                        const p = PEPPER_CULTIVARS[selectedPepperIdx];
                        setPlantName(`${p.name} Pepper`);
                        setPlantStrain(p.variety);
                        setGerminationDays(p.germinationDaysExpected);
                        setSeedlingDays(p.seedlingDaysExpected);
                        setMatureSeedlingDays(p.matureSeedlingDaysExpected);
                        setVegDays(p.vegetativeDaysExpected);
                        setFlowerDays(p.floweringDaysExpected);
                        setRipenDays(p.ripeningDaysExpected);
                      } else {
                        setPlantName('Sweet Genovese Basil');
                        setPlantStrain('Ocimum basilicum');
                        setGerminationDays(5);
                        setVegDays(21);
                        setFlowerDays(30);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-left flex items-center justify-between ${
                      plantSpecies === s
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span>{s === 'Hops' ? '🍺 Hops' : s === 'Chili Pepper' ? '🌶️ Chili Pepper' : s}</span>
                    {plantSpecies === s && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>

            {plantSpecies === 'Hops' && (
              <div className="p-3 bg-amber-950/20 border border-amber-800/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>🍺 Craft Hop Cultivars (Humulus lupulus)</span>
                  </label>
                  <span className="text-[10px] text-amber-400/80 font-mono">Trellis Bine Climber</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {HOP_CULTIVARS.map((hop, idx) => (
                    <button
                      key={hop.name}
                      type="button"
                      onClick={() => {
                        setSelectedHopIdx(idx);
                        setPlantName(`${hop.name} Bine`);
                        setPlantStrain(hop.variety);
                        setFlowerDays(hop.floweringDays);
                      }}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        selectedHopIdx === idx
                          ? 'bg-amber-900/40 border-amber-500 text-amber-200 ring-1 ring-amber-500/50'
                          : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-zinc-100">
                        <span>{hop.name.replace(' Hops', '')}</span>
                        <span className="text-[10px] text-amber-400 font-mono">{hop.alphaAcids}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1 line-clamp-1">{hop.aromaProfile}</div>
                      <div className="text-[9px] text-zinc-500 mt-0.5 capitalize">{hop.growthVigor} vigor · {hop.floweringDays}d bloom</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {plantSpecies === 'Chili Pepper' && (
              <div className="p-3 bg-red-950/20 border border-red-800/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                    <span>🌶️ Hot Pepper &amp; Chili Cultivars (Capsicum)</span>
                  </label>
                  <span className="text-[10px] text-red-400/80 font-mono">Heat Mat 80-86°F Recommended</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PEPPER_CULTIVARS.map((pepper, idx) => (
                    <button
                      key={pepper.name}
                      type="button"
                      onClick={() => {
                        setSelectedPepperIdx(idx);
                        setPlantName(`${pepper.name} Pepper`);
                        setPlantStrain(pepper.variety);
                        setGerminationDays(pepper.germinationDaysExpected);
                        setSeedlingDays(pepper.seedlingDaysExpected);
                        setMatureSeedlingDays(pepper.matureSeedlingDaysExpected);
                        setVegDays(pepper.vegetativeDaysExpected);
                        setFlowerDays(pepper.floweringDaysExpected);
                        setRipenDays(pepper.ripeningDaysExpected);
                      }}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        selectedPepperIdx === idx
                          ? 'bg-red-950/60 border-red-500 text-red-100 ring-1 ring-red-500/50 shadow-sm'
                          : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-zinc-100">
                        <span>{pepper.name}</span>
                        <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${pepper.heatBadgeColor}`}>
                          {pepper.scovilleRating.split(' ')[0]} SHU
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1 line-clamp-1">{pepper.description}</div>
                      <div className="text-[9px] text-zinc-500 mt-0.5 font-mono">
                        {pepper.germinationDaysExpected}d germ @ {pepper.optimalGerminationTempF}°F · {pepper.floweringDaysExpected}d bloom
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Plant Name</label>
                <input
                  type="text"
                  value={plantName}
                  onChange={e => setPlantName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Strain / Lineage</label>
                <input
                  type="text"
                  value={plantStrain}
                  onChange={e => setPlantStrain(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>
            </div>

            {/* Propagation Method Selection */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Propagation Origin</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPropagationType('seed');
                    if (plantStage === 'rooting') setPlantStage('germination');
                  }}
                  className={`p-2.5 rounded-xl text-xs font-medium border text-left transition-all ${
                    propagationType === 'seed'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <span>🌱 From Seed</span>
                    {propagationType === 'seed' && <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
                  </div>
                  <span className="text-[10px] text-zinc-400 block">Sown for germination; tracks sprouted milestone date.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPropagationType('cutting');
                    if (plantStage === 'germination') setPlantStage('rooting');
                  }}
                  className={`p-2.5 rounded-xl text-xs font-medium border text-left transition-all ${
                    propagationType === 'cutting'
                      ? 'bg-teal-950 border-teal-500 text-teal-200 ring-1 ring-teal-500/50'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <span>✂️ From Cutting / Clone</span>
                    {propagationType === 'cutting' && <Check className="w-3.5 h-3.5 text-teal-400 ml-auto" />}
                  </div>
                  <span className="text-[10px] text-zinc-400 block">Taken from mother plant; tracks rooted milestone date.</span>
                </button>
              </div>
            </div>

            {/* Starting Lifecycle Stage */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-300">Starting Lifecycle Stage</label>
                <span className="text-[10px] font-mono text-emerald-400">
                  {plantStage.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {(propagationType === 'seed' 
                  ? [
                      { id: 'germination', label: 'Germination', desc: 'Day 0 Seed' },
                      { id: 'seedling', label: 'Seedling', desc: 'Early Sprout' },
                      { id: 'mature_seedling', label: 'Mature Seedling', desc: 'True Leaves' },
                      { id: 'vegetative', label: 'Vegetative', desc: 'Foliage Veg' },
                      { id: 'flowering', label: 'Flowering', desc: 'Bloom Cycle' }
                    ]
                  : [
                      { id: 'rooting', label: 'Rooting', desc: 'Fresh Clone' },
                      { id: 'seedling', label: 'Rooted Clone', desc: 'Roots Struck' },
                      { id: 'mature_seedling', label: 'Mature Clone', desc: 'Established' },
                      { id: 'vegetative', label: 'Vegetative', desc: 'Active Veg' },
                      { id: 'flowering', label: 'Flowering', desc: 'Bloom Cycle' }
                    ]
                ).map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setPlantStage(st.id as PlantStage)}
                    className={`py-2 px-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                      plantStage === st.id
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="font-semibold block truncate text-[11px]">{st.label}</span>
                    <span className="text-[9px] text-zinc-500 block truncate">{st.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Key Date Log Preview Banner */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Initial Milestone Date:
                </span>
                <span className="font-mono text-zinc-200 font-bold">
                  {formatSimDateTime(simTime || Date.now())}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {propagationType === 'seed' 
                  ? `Sowing date logged as ${formatSimDateTime(simTime || Date.now())}. The simulation will automatically calculate when the seed sprouts, enters early seedling, mature seedling, and vegetative phase based on your tent's root warmth, moisture, and VPD.`
                  : `Cutting date logged as ${formatSimDateTime(simTime || Date.now())}. The simulation tracks rooting success based on humidity dome moisture, gentle lighting, and root substrate warmth.`}
              </p>
            </div>

            {/* Cultivar Stage Durations (Expandable) */}
            <div className="border border-zinc-800 rounded-xl bg-zinc-950/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedDurations(!showAdvancedDurations)}
                className="w-full px-3 py-2 flex items-center justify-between text-xs text-zinc-300 hover:bg-zinc-900/50 transition-colors"
              >
                <span className="font-semibold flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                  Cultivar Stage Durations &amp; Phenotype Timings
                </span>
                <span className="text-[11px] text-emerald-400 font-mono">
                  {showAdvancedDurations ? '▲ Hide' : '▼ Customize Days'}
                </span>
              </button>

              {showAdvancedDurations && (
                <div className="p-3 pt-1 border-t border-zinc-850 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {propagationType === 'seed' ? (
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">Germination (Days)</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={germinationDays}
                          onChange={e => setGerminationDays(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">Rooting (Days)</label>
                        <input
                          type="number"
                          min="3"
                          max="30"
                          value={rootingDays}
                          onChange={e => setRootingDays(Math.max(3, parseInt(e.target.value) || 3))}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">Seedling Phase (Days)</label>
                      <input
                        type="number"
                        min="3"
                        max="25"
                        value={seedlingDays}
                        onChange={e => setSeedlingDays(Math.max(3, parseInt(e.target.value) || 3))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">Mature Seedling (Days)</label>
                      <input
                        type="number"
                        min="4"
                        max="30"
                        value={matureSeedlingDays}
                        onChange={e => setMatureSeedlingDays(Math.max(4, parseInt(e.target.value) || 4))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">Vegetative (Days)</label>
                      <input
                        type="number"
                        min="10"
                        max="90"
                        value={vegDays}
                        onChange={e => setVegDays(Math.max(10, parseInt(e.target.value) || 10))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">Flowering Bloom (Days)</label>
                      <input
                        type="number"
                        min="30"
                        max="120"
                        value={flowerDays}
                        onChange={e => setFlowerDays(Math.max(30, parseInt(e.target.value) || 30))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">Ripening Window (Days)</label>
                      <input
                        type="number"
                        min="5"
                        max="30"
                        value={ripenDays}
                        onChange={e => setRipenDays(Math.max(5, parseInt(e.target.value) || 5))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono text-zinc-200"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    * Ideal duration under standard conditions. Suboptimal VPD, cold roots, or low PPFD will proportionally slow down progress in the physics loop.
                  </span>
                </div>
              )}
            </div>

            {/* Cultivation System & Soil Dynamics Customizer */}
            <div className="border border-zinc-800 rounded-xl bg-zinc-950/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSoilCustomizer(!showSoilCustomizer)}
                className="w-full px-3 py-2 flex items-center justify-between text-xs text-zinc-300 hover:bg-zinc-900/50 transition-colors"
              >
                <span className="font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Cultivation System, Container &amp; Soil Dynamics
                </span>
                <span className="text-[11px] text-emerald-400 font-mono">
                  {showSoilCustomizer ? '▲ Collapse' : '▼ Customize Soil / Hydro'}
                </span>
              </button>

              {showSoilCustomizer && (
                <div className="p-3 pt-1 border-t border-zinc-800/80 space-y-3 text-xs">
                  {/* System Type */}
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Cultivation System</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { id: 'soil_container', label: 'Soil Container', desc: 'Fabric / Plastic Pot' },
                        { id: 'raised_bed', label: 'Cedar Raised Bed', desc: 'Outdoor / Living Soil' },
                        { id: 'in_ground', label: 'In-Ground Soil', desc: 'Direct Garden Earth' },
                        { id: 'dwc', label: 'DWC Hydroponics', desc: 'Aerated Res Bucket' },
                        { id: 'ebb_and_flow', label: 'Ebb & Flow', desc: 'Flood & Drain Table' },
                        { id: 'drip_hydro', label: 'Drip Hydro', desc: 'Automated Drippers' },
                        { id: 'aeroponics', label: 'Aeroponics', desc: 'Misted Root Chamber' },
                        { id: 'wick_system', label: 'Wick System', desc: 'Passive Sub-Irrigated' },
                      ].map(sys => (
                        <button
                          key={sys.id}
                          type="button"
                          onClick={() => {
                            setSystemType(sys.id as CultivationSystemType);
                            if (sys.id === 'dwc') {
                              setContainerType('dwc_reservoir_bucket');
                              setGrowingMedium('hydroton_clay_pebbles');
                              setNutrientProgram('salt_mineral_ab');
                              setContainerVolume(5);
                            } else if (sys.id === 'raised_bed') {
                              setContainerType('raised_bed_cedar');
                              setGrowingMedium('living_organic_soil');
                              setNutrientProgram('organic_living_soil');
                              setContainerVolume(50);
                            } else if (sys.id === 'in_ground') {
                              setContainerType('in_ground_earth');
                              setGrowingMedium('native_garden_loam');
                              setNutrientProgram('organic_living_soil');
                              setContainerVolume(100);
                            }
                          }}
                          className={`p-1.5 rounded-lg border text-left transition-all ${
                            systemType === sys.id
                              ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <div className="font-semibold text-[11px] truncate">{sys.label}</div>
                          <div className="text-[9px] text-zinc-500 truncate">{sys.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Container & Volume */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Container Vessel</label>
                      <select
                        value={containerType}
                        onChange={e => setContainerType(e.target.value as ContainerType)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"
                      >
                        <option value="fabric_pot">Fabric Smart Pot (High Aeration)</option>
                        <option value="plastic_nursery_pot">Plastic Nursery Pot</option>
                        <option value="terracotta_pot">Clay Terracotta Pot (Breathable)</option>
                        <option value="raised_bed_cedar">Cedar Raised Garden Bed</option>
                        <option value="in_ground_earth">In-Ground Garden Trench</option>
                        <option value="dwc_reservoir_bucket">5-Gal DWC Aerated Reservoir</option>
                        <option value="flood_drain_tray">Hydroponic Flood Tray</option>
                        <option value="aeroponic_chamber">Aeroponic Mist Chamber</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        Volume Capacity ({containerVolume} Gallons)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          step="1"
                          value={containerVolume}
                          onChange={e => setContainerVolume(Number(e.target.value))}
                          className="flex-1 accent-emerald-500"
                        />
                        <span className="font-mono text-xs font-bold text-emerald-400 w-12 text-right">
                          {containerVolume} gal
                        </span>
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        {[3, 5, 10, 25, 50, 100].map(vol => (
                          <button
                            key={vol}
                            type="button"
                            onClick={() => setContainerVolume(vol)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                              containerVolume === vol
                                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {vol}g
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Medium & Nutrient Program */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Substrate / Growing Medium</label>
                      <select
                        value={growingMedium}
                        onChange={e => setGrowingMedium(e.target.value as GrowingMedium)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"
                      >
                        <option value="living_organic_soil">Living Organic Soil (High Microbes &amp; Buffering)</option>
                        <option value="coco_perlite">70/30 Coco Coir &amp; Perlite (Fast Growth, Fast Drain)</option>
                        <option value="peat_potting_mix">Peat Moss / Pro-Mix Blend</option>
                        <option value="native_garden_loam">Native Garden Loam (Outdoor Garden Bed)</option>
                        <option value="hydroton_clay_pebbles">Expanded Clay Hydroton Pebbles (DWC/Hydro)</option>
                        <option value="rockwool_cubes">Rockwool Horticultural Matrix</option>
                        <option value="aeroponic_mist">Aeroponic Oxygenated Mist</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Nutrient &amp; Biology Program</label>
                      <select
                        value={nutrientProgram}
                        onChange={e => setNutrientProgram(e.target.value as NutrientProgram)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"
                      >
                        <option value="organic_living_soil">Organic Living Soil (Mycorrhizae &amp; Bio-Buffering)</option>
                        <option value="salt_mineral_ab">Mineral Salts A+B (Chelated Hydroponic Formulation)</option>
                        <option value="bloom_booster_pk">Phosphorus-Potassium PK Bloom Booster</option>
                        <option value="compost_tea_inoculant">Active Aerated Compost Tea (AACT)</option>
                        <option value="water_only_flush">Plain Dechlorinated RO Water</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
                    <span>
                      {growingMedium.includes('soil') || growingMedium.includes('loam') 
                        ? '🌱 Soil Buffer active: Ideal pH 6.2 - 6.8 · Higher microbial resistance & drought resilience.' 
                        : '💧 Hydroponic dynamic: Ideal pH 5.6 - 6.2 · Direct root uptake, rapid growth, requires EC monitoring.'}
                    </span>
                    <span className="font-mono text-emerald-400 shrink-0 ml-2">
                      Vol: {containerVolume} gal
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlant}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-950/40"
              >
                Add {propagationType === 'seed' ? 'Seed' : 'Cutting'} to {selectedDestinationTentId === 'room' ? 'Room' : 'Tent'}
              </button>
            </div>
          </div>
        )}

        {/* 3. MUSHROOM FORM */}
        {activeTab === 'mushroom' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Mycology Strain</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Lion\'s Mane', 'Golden Oyster', 'Shiitake', 'Reishi', 'Medicinal'] as MushroomSpecies[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setMushroomSpecies(s);
                      setMushroomName(`${s} Fruiting Culture`);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border text-left flex items-center justify-between ${
                      mushroomSpecies === s
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span>{s}</span>
                    {mushroomSpecies === s && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Culture Name</label>
                <input
                  type="text"
                  value={mushroomName}
                  onChange={e => setMushroomName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Container Format</label>
                <select
                  value={mushroomContainer}
                  onChange={e => setMushroomContainer(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                >
                  <option value="monotub">Bulk Monotub (High yield)</option>
                  <option value="fruiting_block">Sawdust Fruiting Block</option>
                  <option value="grow_bag">Filtered Unicorn Grow Bag</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMushroom}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-md shadow-amber-950/40"
              >
                Inoculate Substrate
              </button>
            </div>
          </div>
        )}

        {/* 4. EQUIPMENT FORM */}
        {activeTab === 'equipment' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Equipment Category</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'grow_light', label: 'Grow Light' },
                  { type: 'exhaust_fan', label: 'Inline Fan' },
                  { type: 'co2_regulator', label: 'CO₂ Regulator' },
                  { type: 'humidifier', label: 'Humidifier' },
                  { type: 'dehumidifier', label: 'Dehumidifier' },
                  { type: 'heat_mat', label: 'Root Heat Mat' },
                  { type: 'heater', label: 'Heater' },
                  { type: 'co2_bag', label: 'CO₂ ExHale Bag' },
                  { type: 'oscillating_fan', label: 'Air Circulator' }
                ].map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setEqType(opt.type as any);
                      if (opt.type === 'grow_light') {
                        setEqName('Full-Spectrum 300W LED');
                        setEqWatts(300);
                      } else if (opt.type === 'exhaust_fan') {
                        setEqName('6" EC Duct Fan');
                        setEqWatts(65);
                      } else if (opt.type === 'co2_regulator') {
                        setEqName('Digital CO₂ Solenoid Regulator');
                        setEqWatts(15);
                      } else if (opt.type === 'co2_bag') {
                        setEqName('ExHale Mycelium CO₂ Bag');
                        setEqWatts(0);
                      } else if (opt.type === 'heat_mat') {
                        setEqName('Waterproof Seedling Heat Mat');
                        setEqWatts(25);
                      } else if (opt.type === 'humidifier') {
                        setEqName('Sonic Fogger');
                        setEqWatts(50);
                      } else if (opt.type === 'dehumidifier') {
                        setEqName('50-Pint Dehumidifier');
                        setEqWatts(350);
                      } else {
                        setEqName('Ceramic Heater');
                        setEqWatts(500);
                      }
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center ${
                      eqType === opt.type
                        ? 'bg-blue-950 border-blue-500 text-blue-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Device Name</label>
                <input
                  type="text"
                  value={eqName}
                  onChange={e => setEqName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Rated Power (Watts)</label>
                <input
                  type="number"
                  min="5"
                  max="3000"
                  value={eqWatts}
                  onChange={e => setEqWatts(parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEquipment}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-md shadow-teal-950/40"
              >
                Install Device
              </button>
            </div>
          </div>
        )}

        {/* 5. PERSON (HUMAN OCCUPANT) FORM */}
        {activeTab === 'person' && (
          <div className="space-y-4">
            <div className="p-3 bg-violet-950/40 border border-violet-800/60 rounded-xl flex items-start gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20 text-violet-300 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <h4 className="font-bold text-zinc-100">Biological Human Respiration</h4>
                <p className="text-zinc-300 mt-0.5">
                  Humans exhale between 15 and 50 liters of pure CO₂ per hour and emit ~100W of metabolic warmth.
                  Adding a person physically enriches room CO₂ without needing bottled gas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Person Name / Role</label>
                <input
                  type="text"
                  value={personName}
                  onChange={e => setPersonName(e.target.value)}
                  placeholder="e.g. Lead Cultivator, Grower Alex"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Activity Level</label>
                <select
                  value={personActivity}
                  onChange={e => setPersonActivity(e.target.value as PersonActivity)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                >
                  <option value="resting">Resting / Seated (15 L/h CO₂, 75W Heat)</option>
                  <option value="normal">Normal Inspection &amp; Care (22 L/h CO₂, 100W Heat)</option>
                  <option value="active">Active Trellising &amp; Pruning (32 L/h CO₂, 140W Heat)</option>
                  <option value="exercising">Heavy Exertion &amp; Soil Mixing (50 L/h CO₂, 210W Heat)</option>
                </select>
              </div>
            </div>

            {/* Respiration & Heat Specs Preview */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400 font-bold block">
                Live Environmental Dynamics
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">CO₂ Exhalation</span>
                  <span className="font-mono font-bold text-violet-300">
                    {personActivity === 'resting' ? '15' : personActivity === 'normal' ? '22' : personActivity === 'active' ? '32' : '50'} L / hour
                  </span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Metabolic Heat</span>
                  <span className="font-mono font-bold text-amber-300">
                    {personActivity === 'resting' ? '75W' : personActivity === 'normal' ? '100W' : personActivity === 'active' ? '140W' : '210W'}
                  </span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Respiration Moisture</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {personActivity === 'resting' ? '0.8L' : personActivity === 'normal' ? '1.2L' : personActivity === 'active' ? '1.8L' : '2.5L'} / day
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                In a typical 16×14ft room ({Math.round(room.dimensions.length * room.dimensions.width * room.dimensions.height)} cu ft), one person raises CO₂ by ~200–450 PPM above ambient outside air.
              </p>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePerson}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white shadow-md shadow-violet-950/40"
              >
                Add Person to {selectedDestinationTentId === 'room' ? 'Room' : 'Tent'}
              </button>
            </div>
          </div>
        )}

        {/* 6. PET FORM */}
        {activeTab === 'pet' && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-300 shrink-0">
                <Dog className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <h4 className="font-bold text-zinc-100">Biological Pet Respiration</h4>
                <p className="text-zinc-300 mt-0.5">
                  Dogs and cats naturally exhale CO₂ and radiate body heat proportional to their body mass.
                  Pets inside the lung room or facility gently elevate baseline CO₂ levels.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Pet Name</label>
                <input
                  type="text"
                  value={petName}
                  onChange={e => setPetName(e.target.value)}
                  placeholder="e.g. Barnaby, Luna, Cooper"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Pet Type / Size</label>
                <select
                  value={petType}
                  onChange={e => {
                    const newType = e.target.value as PetType;
                    setPetType(newType);
                    if (newType === 'dog_large') setPetBreed('Golden Retriever');
                    else if (newType === 'dog_medium') setPetBreed('Border Collie');
                    else if (newType === 'dog_small') setPetBreed('French Bulldog');
                    else if (newType === 'cat') setPetBreed('Domestic Shorthair');
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                >
                  <option value="dog_large">Large Dog (50–85 lbs)</option>
                  <option value="dog_medium">Medium Dog (25–50 lbs)</option>
                  <option value="dog_small">Small Dog / Puppy (&lt;25 lbs)</option>
                  <option value="cat">Domestic Cat (8–15 lbs)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Breed / Description (Optional)</label>
              <input
                type="text"
                value={petBreed}
                onChange={e => setPetBreed(e.target.value)}
                placeholder="e.g. Golden Retriever, Tabby Cat, Husky"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
              />
            </div>

            {/* Pet Environmental Impact Preview */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold block">
                Pet Atmospheric Telemetry
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">CO₂ Exhalation</span>
                  <span className="font-mono font-bold text-rose-300">
                    {petType === 'dog_large' ? '10' : petType === 'dog_medium' ? '6' : petType === 'dog_small' ? '3.5' : '2.2'} L / hour
                  </span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Body Warmth</span>
                  <span className="font-mono font-bold text-amber-300">
                    {petType === 'dog_large' ? '45W' : petType === 'dog_medium' ? '28W' : petType === 'dog_small' ? '18W' : '12W'}
                  </span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Respiration Vapor</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {petType === 'dog_large' ? '0.6L' : petType === 'dog_medium' ? '0.4L' : petType === 'dog_small' ? '0.25L' : '0.18L'} / day
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePet}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40"
              >
                Add Pet to {selectedDestinationTentId === 'room' ? 'Room' : 'Tent'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

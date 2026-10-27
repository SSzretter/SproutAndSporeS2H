/**
 * Simulation type definitions for Sprout & Spore Grow Simulator
 */
export type { SeedGeneticTraits, SporeGeneticTraits } from '../utils/genetics';

export interface Dimensions {
  length: number; // in feet (or unit)
  width: number;
  height: number;
  unit: 'ft' | 'in' | 'cm';
}

/**
 * Item/tent placement inside its host container (room, tent, or outdoor garden).
 * For items, (x, y) is the CENTER of the item's footprint and z is the elevation of its base.
 * For tents, (x, y) is the tent's back-left corner within the room.
 */
export interface Position3D {
  x: number; // in feet from left/west container boundary (0 <= x <= length)
  y: number; // in feet from back/north container boundary (0 <= y <= width)
  z: number; // in feet from floor/elevation (0 <= z <= height)
}

export interface Climate {
  tempF: number;
  tempC: number;
  rh: number; // 0 - 100 %
  lightPPFD: number; // micromoles / m^2 / s
  vpdKpa: number; // Vapor pressure deficit in kPa
  co2Ppm: number; // Carbon dioxide in parts per million (400 - 5000 ppm)
}

export type WeatherType = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'clear_night';

export interface OutsideConditions {
  tempF: number;
  tempC: number;
  rh: number;
  lightPPFD: number;
  co2Ppm: number; // Atmospheric ambient baseline ~420 ppm
  weather: WeatherType;
  windMph: number;
  pressureHpa: number;
  isLiveApi?: boolean;
}

export interface OutdoorLocation {
  zipCode: string;
  cityName: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
  isLiveWeather: boolean;
  lastFetchedTime?: number;
  statusText?: string;
  customCo2Ppm?: number;
}

export type PlantSpecies = 'Cannabis' | 'Tomato' | 'Chili Pepper' | 'Basil' | 'Hops';
export type PropagationType = 'seed' | 'cutting';
export type PlantStage = 
  | 'germination' 
  | 'rooting' 
  | 'seedling' 
  | 'mature_seedling' 
  | 'vegetative' 
  | 'flowering' 
  | 'ripening' 
  | 'ready';

export type CultivationSystemType = 
  | 'soil_container'     // Living Organic Soil in Potted Container
  | 'raised_bed'          // Deep Raised Wooden Bed
  | 'in_ground'           // Native Garden Earth / Topsoil Patch
  | 'dwc'                 // Deep Water Culture Hydroponics
  | 'ebb_and_flow'        // Flood & Drain Hydroponics
  | 'drip_hydro'          // Top-Feed Drip / Dutch Bucket
  | 'aeroponics'          // High-Pressure Aeroponic Root Chamber
  | 'wick_system';        // Sub-Irrigated Planter / Passive Wick

export type ContainerType = 
  | 'fabric_pot'          // Breathable Smart Fabric Pot (aerates roots, air-prunes)
  | 'plastic_nursery_pot' // Rigid Plastic Nursery Pot
  | 'terracotta_pot'      // Porous Earthenware Terracotta
  | 'raised_bed_cedar'    // Cedar Wood Raised Bed Box
  | 'in_ground_earth'     // Direct In-Ground Earth Bed
  | 'dwc_reservoir_bucket'// 5-Gallon DWC Deep Water Reservoir Bucket with Net Pot & Air Stone
  | 'flood_drain_tray'    // Hydroponic Ebb & Flow Flood Tray
  | 'aeroponic_chamber';  // Sealed Aeroponic Mist Chamber

export type GrowingMedium = 
  | 'living_organic_soil' // Super Soil with Compost, Worm Castings, Biochar & Mycorrhizae
  | 'coco_perlite'        // 70% Coco Coir / 30% Perlite (inert, rapid drainage)
  | 'peat_potting_mix'    // Peat Moss + Perlite + Dolomite Lime (Pro-Mix)
  | 'native_garden_loam'  // Mineral-Rich Outdoor Garden Loam
  | 'hydroton_clay_pebbles' // Expanded Clay Pellets (LECA for DWC / Ebb&Flow)
  | 'rockwool_cubes'      // Grodan Rockwool Blocks
  | 'aeroponic_mist';     // Bare Suspended Roots in Oxygenated Mist

export type NutrientProgram = 
  | 'organic_living_soil' // Slow-Release Organic Amendments & Compost Teas
  | 'salt_mineral_ab'     // 2-Part Mineral Synthetic Salt Nutrients (A & B)
  | 'bloom_booster_pk'    // High Phosphorus & Potassium Bloom Enhancer
  | 'compost_tea_inoculant' // Microbial Aerated Compost Tea with Mycorrhizae
  | 'water_only_flush';   // Pure pH-Balanced Water Flush

export interface PlantKeyDates {
  plantedDate: number; // Date seed sown or cutting taken (ms timestamp)
  sproutedDate?: number; // Date sprouted (for seeds)
  rootedDate?: number; // Date rooted (for cuttings/clones)
  seedlingDate?: number; // Early seedling phase entered
  matureSeedlingDate?: number; // Mature seedling phase entered
  vegetativeDate?: number; // Vegetative phase entered
  floweringDate?: number; // Flowering triggered / bloom initiated
  ripeningDate?: number; // Late flower trichome ripening
  readyDate?: number; // Ready for harvest
  harvestedDate?: number; // Date harvested
}

export interface StageConditionRequirements {
  tempMinF: number;
  tempMaxF: number;
  tempOptimalF: number;
  rhMin: number;
  rhMax: number;
  rhOptimal: number;
  vpdMin: number;
  vpdMax: number;
  vpdOptimal: number;
  ppfdMin: number;
  ppfdOptimal: number;
  soilMoistureMin: number;
  soilMoistureOptimal: number;
  targetPhotoperiodHours: number;
  summary: string;
}

export interface PlantItem {
  id: string;
  name: string;
  category: 'plant';
  species: PlantSpecies;
  strainName: string;
  propagationType: PropagationType; // 'seed' | 'cutting'
  stage: PlantStage;
  stageProgress: number; // 0 - 100%
  ageDays: number;
  currentStageDays?: number; // Days spent in current active stage
  keyDates: PlantKeyDates;
  
  // Cultivar milestone duration specs (expected days in ideal conditions):
  germinationDaysExpected?: number; // e.g. 4-6 days (or rootingDaysExpected for cuttings)
  rootingDaysExpected?: number;    // e.g. 10-14 days for clones
  seedlingDaysExpected?: number;   // e.g. 8 days
  matureSeedlingDaysExpected?: number; // e.g. 10 days
  vegetativeDaysExpected?: number; // e.g. 28 days
  floweringDaysExpected?: number;  // e.g. 60 days
  ripeningDaysExpected?: number;   // e.g. 10 days
  stageRequirements?: Partial<Record<PlantStage, StageConditionRequirements>>;

  // Container, Medium & System Customization:
  systemType?: CultivationSystemType;
  containerType?: ContainerType;
  containerVolumeGallons?: number; // 1, 3, 5, 7, 10, 15, 25, 50, 100
  containerDimensions?: Dimensions; // Physical pot / bed / bucket size (ft), derived from containerType + volume
  growingMedium?: GrowingMedium;
  nutrientProgram?: NutrientProgram;

  // Real-time Soil & Hydroponic Dynamics:
  soilPh?: number;             // 5.2 - 7.5 (soil optimal 6.2 - 6.8; hydro optimal 5.6 - 6.2)
  ecTdsPpm?: number;           // 200 - 2400 PPM (salt concentration / nutrient strength)
  microbialHealth?: number;    // 0 - 100% (vitality of mycorrhizal and beneficial rhizobacteria colonies)
  aerationOxygenPct?: number;  // 0 - 100% (root zone oxygenation / dissolved oxygen)
  drainageRate?: number;       // 0 - 100%
  reservoirTempF?: number;     // For hydro systems: 64-68°F optimal

  // Botanical metrics:
  health: number; // 0 - 100%
  soilMoisture: number; // 0 - 100%
  rootTempF: number; // Root zone temperature influenced by ambient/floor/heat mat
  nutrientLevel: 'low' | 'balanced' | 'high';
  heightInches: number;
  canopyWidthInches: number;
  yieldPotentialGrams: number;
  isHarvested: boolean;
  dimensions: Dimensions; // Overall envelope: max(pot, canopy) footprint × (pot height + plant height). Recomputed as the plant grows.
  position?: Position3D; // Coordinates (x, y, z) in feet within host container
  notes?: string;
  lastWateredTime?: number;
  lastFedTime?: number;
  alphaAcidsPct?: number; // Specific to Hops brewing potential (e.g. 4.5% - 14.0%)
  scovilleHeatUnits?: number; // Capsaicin pungency for Chili Peppers (e.g. 2,500 - 2,200,000 SHU)
  traits?: import('../utils/genetics').SeedGeneticTraits; // Genetic variability, viability, vigor, and phenotype traits
}

export type MushroomSpecies = 'Golden Oyster' | 'Lion\'s Mane' | 'Shiitake' | 'Reishi' | 'Medicinal';
export type MushroomStage = 'colonizing' | 'pinning' | 'fruiting' | 'mature' | 'ready';
export type MushroomContainer = 'monotub' | 'grow_bag' | 'fruiting_block';

export interface MushroomItem {
  id: string;
  name: string;
  category: 'mushroom';
  species: MushroomSpecies;
  strainName: string;
  stage: MushroomStage;
  stageProgress: number; // 0 - 100%
  ageDays: number;
  health: number; // 0 - 100%
  substrateMoisture: number; // 0 - 100%
  substrateTempF?: number; // Live substrate temperature (follows the air, plus any heat mat underneath)
  myceliumColonization: number; // 0 - 100%
  flushCount: number;
  yieldPotentialGrams: number;
  isHarvested: boolean;
  containerType: MushroomContainer;
  containerDimensions?: Dimensions; // Physical monotub / bag / block size (ft)
  dimensions: Dimensions; // Overall envelope: container footprint × (container height + fruit body height)
  position?: Position3D; // Coordinates (x, y, z) in feet within host container
  notes?: string;
  lastMistedTime?: number;
  traits?: import('../utils/genetics').SporeGeneticTraits; // Spore genetics, viability, pinning density, and colonizing vigor
}

export type EquipmentType = 
  | 'grow_light' 
  | 'exhaust_fan' 
  | 'humidifier' 
  | 'dehumidifier' 
  | 'heater' 
  | 'oscillating_fan'
  | 'co2_regulator'
  | 'co2_bag'
  | 'heat_mat'
  | 'portable_ac'    // Room A/C: removes heat (BTU rating) and moisture, vents its own heat outside
  | 'hvac_register'; // Supply register from the house's central system: heated / cooled air at a CFM

export type EquipmentControlMode = 'auto' | 'manual' | 'schedule' | 'cycle';

export interface EquipmentAutoTriggers {
  tempTriggerHighF?: number;     // e.g. 78°F or 80°F (ramp fan up to cool)
  tempTriggerLowF?: number;      // e.g. 68°F (ramp down/off to prevent overcooling)
  rhTriggerHigh?: number;         // e.g. 65% in flower (exhaust fan evacuates excess humidity)
  rhTriggerLow?: number;          // e.g. 80% for mushrooms or 50% for veg (protection floor: throttles fan to save humidity)
  co2TriggerHighPpm?: number;     // e.g. 950 PPM for mushrooms (triggers FAE evacuation fan)
  co2TriggerLowPpm?: number;      // e.g. 380 PPM (triggers fan to draw fresh lung room air for depleted plants)
  minSpeedPercent?: number;       // Baseline idle speed (0 - 100%, default 0% or 10%)
  maxSpeedPercent?: number;       // Ceiling speed (0 - 100%, default 100%)
  cycleOnMinutes?: number;        // For cycle mode: minutes ON (e.g. 3 mins)
  cycleOffMinutes?: number;       // For cycle mode: minutes OFF (e.g. 20 mins)
}

// Humidifier/fogger water-reservoir conditioning: 'none' lets the water drift to the air around the unit
export type InlineFanDuctSize = 4 | 6;

export type ControllerPriority = 'humidity_first' | 'temperature_first' | 'balanced_auto' | 'co2_enrichment';

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'equipment';
  type: EquipmentType;
  powerOn: boolean;
  powerWatts: number;
  setting: number; // 0 - 100 (%)
  controlMode?: EquipmentControlMode; // 'auto' | 'manual' | 'schedule' | 'cycle'
  autoTriggers?: EquipmentAutoTriggers;
  targetRh?: number; // For humidifier/dehumidifier humidistat (e.g. 60%)
  targetTempF?: number; // For heater thermostat
  targetCo2Ppm?: number; // For CO2 injection solenoid (e.g. 1200 PPM)
  flowRateCfm?: number; // CFM for fans or CO2 delivery
  schedule?: {
    enabled: boolean;
    onHour: number; // 0 - 23
    offHour: number; // 0 - 23
  };
  interlockStatus?: string; // Reason when arbitrated/suppressed by central controller
  effectiveSetting?: number; // Live arbitrated power percentage (0 - 100%)
  ductedToTentId?: string; // Humidifier / CO2 controller in room.items whose output is piped into this tent through a hose
  reservoirTempF?: number; // Live humidifier water temperature (follows the air around the unit, plus any wrapped heat mat)
  reservoirLevelL?: number; // Humidifier water left in the tank (litres); drains while misting, refilled by hand
  reservoirCapacityL?: number; // Humidifier tank size (litres); must fit in the unit's body (see getMaxReservoirLiters)
  bucketLevelL?: number; // Dehumidifier condensate in its collection bucket (litres); fills while extracting, emptied by hand
  bucketCapacityL?: number; // Dehumidifier bucket size (litres); must fit in the unit's body (see getMaxBucketCapacityL)
  drainHoseConnected?: boolean; // Dehumidifier drains continuously through a hose, so its bucket never fills
  waterFlowLph?: number; // Live water use (humidifier) or collection (dehumidifier) over the last tick, L/h
  ductSizeIn?: InlineFanDuctSize; // Inline (exhaust) fan duct / port diameter in inches
  exhaustTo?: 'room' | 'outdoors'; // Exhaust fan: where its duct discharges (default: into the room)
  coolingCapacityBtu?: number; // Portable A/C rated cooling (BTU/h); defaults from the name ("8,000 BTU")
  registerMode?: 'cool' | 'heat' | 'auto' | 'off'; // HVAC register: what the house system supplies through it
  attachedToId?: string; // Heat mat: the tent id (under its floor tray) or the item it sits under / is wrapped around
  dimensions: Dimensions;
  position?: Position3D; // Coordinates (x, y, z) in feet within host container
  notes?: string;
}

export type PersonActivity = 'resting' | 'normal' | 'active' | 'exercising';

export type PersonRole = 
  | 'resident'      // Lives on-site, relaxes, roams the facility/living spaces, breathes CO2
  | 'grower'        // Master Grower: monitors plant health, waters dry pots, applies nutrients, prunes
  | 'technician'    // Equipment Tech: refills humidifier tanks, empties dehumidifier buckets, balances hardware
  | 'harvester'     // Harvester / Trimmer: checks crop maturity, harvests ready plants & mushrooms into inventory
  | 'caretaker';    // General Hand: all-rounder who waters crops, mists mushrooms, maintains equipment, and harvests

export interface NpcInventoryItem {
  id: string;
  name: string;
  type: 'tool' | 'supply' | 'harvest' | 'personal';
  description?: string;
  quantity?: number;
  unit?: string;
  icon?: string;
  acquiredAt?: number;
  harvestRecord?: HarvestRecord; // Attached full harvest record if this is a harvested crop
}

export interface NpcInventory {
  items: NpcInventoryItem[];
  maxSlots?: number;
}

export interface NpcActionLogEntry {
  id: string;
  timestamp: number;
  actionType: 'water' | 'feed' | 'mist' | 'refill_humidifier' | 'empty_dehumidifier' | 'adjust_equipment' | 'harvest' | 'inspect' | 'rest' | 'patrol';
  title: string;
  details: string;
  targetName?: string;
  targetId?: string;
  locationName?: string;
  result?: 'success' | 'info' | 'warning';
}

export interface NpcWorkerSettings {
  autoWork: boolean; // default true for worker roles, false for resident
  waterThresholdPct?: number; // e.g. 45% soil moisture
  mistThresholdPct?: number; // e.g. 45% substrate moisture
  refillHumidifierBelowL?: number; // e.g. 1.5 L
  emptyDehumidifierAbovePct?: number; // e.g. 80%
  autoHarvestCrops?: boolean; // whether to harvest ready crops
  workCadenceMinutes?: number; // frequency of autonomous rounds
}

export interface PersonItem {
  id: string;
  name: string;
  category: 'person';
  activity: PersonActivity;
  role: PersonRole;
  customTitle?: string;
  workerSettings?: NpcWorkerSettings;
  currentAction?: string;
  currentActionTimer?: number;
  currentActionTargetId?: string;
  actionLog?: NpcActionLogEntry[];
  inventory?: NpcInventory;
  co2RateLitersPerHour: number; // e.g. resting: 15 L/h, normal: 22 L/h, active: 32 L/h, exercising: 50 L/h
  heatOutputWatts: number; // metabolic heat: 75W - 200W
  moistureLitersPerDay: number; // respiration/perspiration: 0.8L - 2.5L/day
  dimensions: Dimensions;
  position?: Position3D; // Coordinates (x, y, z) in feet within host container
  notes?: string;
  shirtColor?: string;
  hatColor?: string;
  hairColor?: string;
}

export type PetType = 'dog_large' | 'dog_medium' | 'dog_small' | 'cat';

export interface PetItem {
  id: string;
  name: string;
  category: 'pet';
  petType: PetType;
  breed?: string;
  co2RateLitersPerHour: number; // e.g. large dog: 10 L/h, medium dog: 6 L/h, small dog: 3.5 L/h, cat: 2.2 L/h
  heatOutputWatts: number; // metabolic heat: 12W - 45W
  moistureLitersPerDay: number; // 0.18L - 0.6L/day
  dimensions: Dimensions;
  position?: Position3D; // Coordinates (x, y, z) in feet within host container
  notes?: string;
}

export type Item = PlantItem | MushroomItem | EquipmentItem | PersonItem | PetItem;

export type TentBrand = 'AC Infinity' | 'Spider Farmer' | 'Gorilla Grow' | 'Custom';

export interface Tent {
  id: string;
  name: string;
  brand?: TentBrand;
  modelName?: string;
  mylarRating?: string;
  poleDiameter?: string;
  ventPorts?: string;
  dimensions: Dimensions;
  position?: Position3D; // Coordinates (x, y, z) in feet within host room
  climate: Climate;
  items: Item[];
  exhaustFanSpeed: number; // 0 - 100%
  effectiveFanSpeed?: number; // 0 - 100% arbitrated by central controller
  controllerPriority?: ControllerPriority; // 'humidity_first' | 'temperature_first' | 'balanced_auto' | 'co2_enrichment'
  activeInterlocks?: string[]; // Live interlock status messages (e.g. "Exhaust suspended: Humidifier misting")
  activePreset?: 'veg' | 'flower' | 'mushroom' | 'custom';
}

export type ConstructionStandard = 'colonial_2005' | 'modern_tight' | 'older_drafty' | 'insulated_basement';

export type RoomEnvironmentType = 'indoor' | 'outdoor_garden' | 'greenhouse';
export type GardenLayoutConfig = 
  | 'raised_beds_courtyard' // Multiple cedar raised beds (4x8 ft) with gravel walkways
  | 'hop_yard_trellis'      // Craft/commercial hop yard with 16ft bines on coir twine
  | 'in_ground_permaculture' // Deep tilled organic soil patch with woodchip paths
  | 'patio_container_deck'   // Sunny deck with fabric smart pots, terracotta, & DWC tubs
  | 'greenhouse_polytunnel'; // High-tunnel hoop house solar greenhouse

export interface Room {
  id: string;
  name: string;
  dimensions: Dimensions;
  climate: Climate;
  tents: Tent[];
  items: Item[]; // Items placed directly in the room (outside tents)
  environmentType?: RoomEnvironmentType; // 'indoor' | 'outdoor_garden' | 'greenhouse'
  gardenConfig?: GardenLayoutConfig;
  gardenBedCount?: number;
  trellisHeightFt?: number;
  constructionStandard?: ConstructionStandard; // Default 'colonial_2005'
  wallRValue?: number; // R-19 exterior walls for 2005 colonial
  airChangesPerHour?: number; // 0.35 ACH
  foundationType?: 'conditioned_basement' | 'slab_on_grade' | 'second_floor' | 'attic';
  adjacentSpaceTempF?: number; // Rest of the house around an indoor room (interior walls, floor/ceiling); default 70°F
  roomCo2BaselinePpm?: number; // Baseline outdoor fresh air infiltration (420 ppm)
  controllerPriority?: ControllerPriority;
  activeInterlocks?: string[];
}

export type JournalCategory = 'crop' | 'care' | 'automation' | 'alert' | 'note' | 'general';

export interface JournalEntry {
  id: string;
  time: number;
  type: 'info' | 'warning' | 'success' | 'action';
  category?: JournalCategory;
  title: string;
  message: string;
  author?: string;
  tentName?: string;
}

export interface HarvestRecord {
  id: string;
  name: string;
  species: string;
  strainName?: string;
  type: 'plant' | 'mushroom';
  yieldGrams: number;
  dateStr: string;
  timeStr?: string;
  timestamp?: number;
  quality: 'Legendary' | 'Excellent' | 'Good' | 'Fair';
  health?: number;
  containerType?: string;
  growingMedium?: string;
  originRoomName?: string;
  originTentName?: string;
  cureStatus?: 'Fresh Cut' | 'Drying' | 'Curing' | 'Cured & Ready';
  estimatedValue?: number;
  potencyNote?: string;
  notes?: string;
}

export interface SimulationState {
  simTime: number; // timestamp in ms (default 2 months ago from current date)
  startTime: number;
  speed: number; // 0 = paused, 1, 5, 30, 120, 720
  outside: OutsideConditions;
  outdoorLocation: OutdoorLocation;
  rooms?: Room[]; // All facility rooms
  activeRoomId?: string; // Currently active room ID
  room: Room; // Active room (for backwards compatibility and direct access)
  tempUnit: 'F' | 'C';
  selectedType: 'room' | 'tent' | 'item' | null;
  selectedId: string | null;
  selectedParentTentId?: string | null; // If selected item is inside a tent
  journal: JournalEntry[];
  harvests: HarvestRecord[];
}

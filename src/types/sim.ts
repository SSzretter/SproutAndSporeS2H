/**
 * Simulation type definitions for Sprout & Spore Grow Simulator
 */

export interface Dimensions {
  length: number; // in feet (or unit)
  width: number;
  height: number;
  unit: 'ft' | 'in' | 'cm';
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

export type PlantSpecies = 'Cannabis' | 'Tomato' | 'Chili Pepper' | 'Basil';
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

  health: number; // 0 - 100%
  soilMoisture: number; // 0 - 100%
  rootTempF: number; // Root zone temperature influenced by ambient/floor/heat mat
  nutrientLevel: 'low' | 'balanced' | 'high';
  heightInches: number;
  canopyWidthInches: number;
  yieldPotentialGrams: number;
  isHarvested: boolean;
  dimensions: Dimensions;
  notes?: string;
  lastWateredTime?: number;
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
  myceliumColonization: number; // 0 - 100%
  flushCount: number;
  yieldPotentialGrams: number;
  isHarvested: boolean;
  containerType: MushroomContainer;
  dimensions: Dimensions;
  notes?: string;
  lastMistedTime?: number;
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
  | 'heat_mat';

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
  dimensions: Dimensions;
  notes?: string;
}

export type PersonActivity = 'resting' | 'normal' | 'active' | 'exercising';

export interface PersonItem {
  id: string;
  name: string;
  category: 'person';
  activity: PersonActivity;
  co2RateLitersPerHour: number; // e.g. resting: 15 L/h, normal: 22 L/h, active: 32 L/h, exercising: 50 L/h
  heatOutputWatts: number; // metabolic heat: 75W - 200W
  moistureLitersPerDay: number; // respiration/perspiration: 0.8L - 2.5L/day
  dimensions: Dimensions;
  notes?: string;
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
  climate: Climate;
  items: Item[];
  exhaustFanSpeed: number; // 0 - 100%
  effectiveFanSpeed?: number; // 0 - 100% arbitrated by central controller
  controllerPriority?: ControllerPriority; // 'humidity_first' | 'temperature_first' | 'balanced_auto' | 'co2_enrichment'
  activeInterlocks?: string[]; // Live interlock status messages (e.g. "Exhaust suspended: Humidifier misting")
  activePreset?: 'veg' | 'flower' | 'mushroom' | 'custom';
}

export type ConstructionStandard = 'colonial_2005' | 'modern_tight' | 'older_drafty' | 'insulated_basement';

export interface Room {
  id: string;
  name: string;
  dimensions: Dimensions;
  climate: Climate;
  tents: Tent[];
  items: Item[]; // Items placed directly in the room (outside tents)
  constructionStandard?: ConstructionStandard; // Default 'colonial_2005'
  wallRValue?: number; // R-19 exterior walls for 2005 colonial
  airChangesPerHour?: number; // 0.35 ACH
  foundationType?: 'conditioned_basement' | 'slab_on_grade' | 'second_floor' | 'attic';
  hvacMode?: 'central_ac_active' | 'passive_drift' | 'heating_active';
  hvacCoolingSetpointF?: number; // Default 72°F
  hvacHeatingSetpointF?: number; // Default 68°F
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
  type: 'plant' | 'mushroom';
  yieldGrams: number;
  dateStr: string;
  quality: 'Legendary' | 'Excellent' | 'Good' | 'Fair';
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

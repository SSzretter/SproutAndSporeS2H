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
}

export type PlantSpecies = 'Cannabis' | 'Tomato' | 'Chili Pepper' | 'Basil';
export type PlantStage = 'seedling' | 'vegetative' | 'flowering' | 'ripening' | 'ready';

export interface PlantItem {
  id: string;
  name: string;
  category: 'plant';
  species: PlantSpecies;
  strainName: string;
  stage: PlantStage;
  stageProgress: number; // 0 - 100%
  ageDays: number;
  health: number; // 0 - 100%
  soilMoisture: number; // 0 - 100%
  rootTempF: number; // Root zone temperature influenced by ambient/floor
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

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'equipment';
  type: EquipmentType;
  powerOn: boolean;
  powerWatts: number;
  setting: number; // 0 - 100 (%)
  targetRh?: number; // For humidifier/dehumidifier humidistat (e.g. 60%)
  targetTempF?: number; // For heater thermostat
  targetCo2Ppm?: number; // For CO2 injection solenoid (e.g. 1200 PPM)
  flowRateCfm?: number; // CFM for fans or CO2 delivery
  schedule?: {
    enabled: boolean;
    onHour: number; // 0 - 23
    offHour: number; // 0 - 23
  };
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
}

export interface JournalEntry {
  id: string;
  time: number;
  type: 'info' | 'warning' | 'success' | 'action';
  title: string;
  message: string;
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
  room: Room;
  tempUnit: 'F' | 'C';
  selectedType: 'room' | 'tent' | 'item' | null;
  selectedId: string | null;
  selectedParentTentId?: string | null; // If selected item is inside a tent
  journal: JournalEntry[];
  harvests: HarvestRecord[];
}

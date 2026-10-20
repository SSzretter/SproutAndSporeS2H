import { SimulationState, Room, Tent, PlantItem, MushroomItem, EquipmentItem, OutdoorLocation } from '../types/sim';
import { simulateOutsideConditions, calculateVPD } from './physics';

const STORAGE_KEY = 'sprout_spore_grow_sim_v2';

export const DEFAULT_OUTDOOR_LOCATION: OutdoorLocation = {
  zipCode: '01507',
  cityName: 'Charlton',
  state: 'MA',
  country: 'US',
  lat: 42.137,
  lon: -71.970,
  isLiveWeather: true,
  statusText: 'Open-Meteo Hourly API (Cached)'
};

/**
 * Creates the initial default simulation state
 * The date for a new sim defaults to starting 2 months ago from the current date.
 */
export function createDefaultSimulationState(): SimulationState {
  const startDate = new Date('2026-08-20T08:00:00');
  const simTime = startDate.getTime();

  const outside = simulateOutsideConditions(simTime);

  // Tent A: AC Infinity CLOUDLAB 844 (4x4)
  const tentAEquipment: EquipmentItem[] = [
    {
      id: 'eq-led-480',
      name: 'Pro-Spectrum 480W LED Bar',
      category: 'equipment',
      type: 'grow_light',
      powerOn: true,
      powerWatts: 480,
      setting: 80,
      schedule: { enabled: true, onHour: 6, offHour: 0 }, // 18/6 light schedule
      dimensions: { length: 3.5, width: 3.5, height: 0.3, unit: 'ft' },
      notes: 'Full spectrum Samsung LM301H diodes + 660nm deep red for canopy penetration.'
    },
    {
      id: 'eq-fan-tentA',
      name: '6" Inline EC Exhaust Fan',
      category: 'equipment',
      type: 'exhaust_fan',
      powerOn: true,
      powerWatts: 65,
      setting: 60,
      dimensions: { length: 1.2, width: 0.8, height: 0.8, unit: 'ft' },
      notes: 'Exhausts hot canopy air into room scrubbed through activated carbon.'
    },
    {
      id: 'eq-humid-tentA',
      name: 'Ultrasonic 6L Humidifier',
      category: 'equipment',
      type: 'humidifier',
      powerOn: true,
      powerWatts: 45,
      setting: 50,
      targetRh: 62,
      dimensions: { length: 0.8, width: 0.8, height: 1.2, unit: 'ft' },
      notes: 'Maintains optimal VPD during vegetative growth.'
    },
    {
      id: 'eq-co2-tentA',
      name: 'Digital CO2 Solenoid Controller',
      category: 'equipment',
      type: 'co2_regulator',
      powerOn: true,
      powerWatts: 15,
      setting: 100,
      targetCo2Ppm: 1200,
      dimensions: { length: 0.8, width: 0.6, height: 1.4, unit: 'ft' },
      notes: 'Connected to 20lb CO2 tank. Enriches canopy to 1200 PPM under 480W LED.'
    }
  ];

  const tentAPlants: PlantItem[] = [
    {
      id: 'plant-nl-01',
      name: 'Northern Lights #5',
      category: 'plant',
      species: 'Cannabis',
      strainName: 'Northern Lights Feminized',
      stage: 'flowering',
      stageProgress: 42,
      ageDays: 38,
      health: 96,
      soilMoisture: 68,
      rootTempF: 68.2,
      nutrientLevel: 'balanced',
      heightInches: 32,
      canopyWidthInches: 26,
      yieldPotentialGrams: 140,
      isHarvested: false,
      dimensions: { length: 2.0, width: 2.0, height: 2.7, unit: 'ft' },
      notes: 'Rich terpene production, tight nodal spacing under the 480W LED.',
      lastWateredTime: simTime - 3600000 * 8
    },
    {
      id: 'plant-gelato-02',
      name: 'Gelato #33 (Larry Bird)',
      category: 'plant',
      species: 'Cannabis',
      strainName: 'Sunset Sherbet x Thin Mint GSC',
      stage: 'vegetative',
      stageProgress: 78,
      ageDays: 24,
      health: 98,
      soilMoisture: 72,
      rootTempF: 67.8,
      nutrientLevel: 'balanced',
      heightInches: 24,
      canopyWidthInches: 22,
      yieldPotentialGrams: 120,
      isHarvested: false,
      dimensions: { length: 1.8, width: 1.8, height: 2.0, unit: 'ft' },
      notes: 'Topped at node 4 for an even four-mainline canopy.',
      lastWateredTime: simTime - 3600000 * 12
    },
    {
      id: 'plant-tom-03',
      name: 'Sweet 100 Cherry Tomato',
      category: 'plant',
      species: 'Tomato',
      strainName: 'Heirloom Super Sweet 100',
      stage: 'flowering',
      stageProgress: 60,
      ageDays: 32,
      health: 94,
      soilMoisture: 64,
      rootTempF: 68.6,
      nutrientLevel: 'balanced',
      heightInches: 36,
      canopyWidthInches: 20,
      yieldPotentialGrams: 220,
      isHarvested: false,
      dimensions: { length: 1.7, width: 1.7, height: 3.0, unit: 'ft' },
      notes: 'Prolific yellow blossom trusses forming along the trellis.',
      lastWateredTime: simTime - 3600000 * 6
    }
  ];

  const tentA: Tent = {
    id: 'tent-01',
    name: 'AC Infinity CLOUDLAB 844 (4x4)',
    brand: 'AC Infinity',
    modelName: 'CLOUDLAB 844',
    mylarRating: '2000D Diamond Mylar',
    poleDiameter: '22mm Steel Poles',
    ventPorts: 'Dual 6", 8" & 10" Cinch Ports',
    dimensions: { length: 4, width: 4, height: 6.7, unit: 'ft' },
    climate: {
      tempF: 75.4,
      tempC: 24.1,
      rh: 62,
      lightPPFD: 680,
      vpdKpa: calculateVPD(75.4, 62, 680),
      co2Ppm: 1180
    },
    exhaustFanSpeed: 60,
    items: [...tentAEquipment, ...tentAPlants]
  };

  // Tent B: Spider Farmer SF-3x3 Mycology Chamber
  const tentBEquipment: EquipmentItem[] = [
    {
      id: 'eq-led-shroom',
      name: 'Ambient 6500K Myco LED',
      category: 'equipment',
      type: 'grow_light',
      powerOn: true,
      powerWatts: 40,
      setting: 30,
      schedule: { enabled: true, onHour: 7, offHour: 19 }, // 12/12 light schedule
      dimensions: { length: 2.0, width: 0.5, height: 0.2, unit: 'ft' },
      notes: 'Provides directional light cues for cap orientation without heat drying.'
    },
    {
      id: 'eq-fogger-shroom',
      name: 'Commercial Sonic Mist Fogger',
      category: 'equipment',
      type: 'humidifier',
      powerOn: true,
      powerWatts: 80,
      setting: 85,
      targetRh: 92,
      dimensions: { length: 1.2, width: 1.0, height: 1.5, unit: 'ft' },
      notes: 'Ultrasonic fine cold droplet mist piped into top shelf.'
    },
    {
      id: 'eq-fae-shroom',
      name: '4" FAE Cycle Exhaust Fan',
      category: 'equipment',
      type: 'exhaust_fan',
      powerOn: true,
      powerWatts: 28,
      setting: 40,
      dimensions: { length: 0.8, width: 0.8, height: 0.8, unit: 'ft' },
      notes: 'Evacuates heavy CO2 to trigger pinhead formation.'
    }
  ];

  const tentBMushrooms: MushroomItem[] = [
    {
      id: 'shroom-oyster-01',
      name: 'Golden Oyster Monotub',
      category: 'mushroom',
      species: 'Golden Oyster',
      strainName: 'Pleurotus citrinopileatus',
      stage: 'fruiting',
      stageProgress: 65,
      ageDays: 19,
      health: 98,
      substrateMoisture: 88,
      myceliumColonization: 100,
      flushCount: 1,
      yieldPotentialGrams: 320,
      isHarvested: false,
      containerType: 'monotub',
      dimensions: { length: 1.8, width: 1.2, height: 0.9, unit: 'ft' },
      notes: 'Vibrant yellow umbrella caps unfurling in dense clusters.',
      lastMistedTime: simTime - 3600000 * 3
    },
    {
      id: 'shroom-lions-02',
      name: 'Lion\'s Mane Fruiting Block',
      category: 'mushroom',
      species: 'Lion\'s Mane',
      strainName: 'Hericium erinaceus',
      stage: 'pinning',
      stageProgress: 45,
      ageDays: 14,
      health: 95,
      substrateMoisture: 84,
      myceliumColonization: 95,
      flushCount: 0,
      yieldPotentialGrams: 280,
      isHarvested: false,
      containerType: 'fruiting_block',
      dimensions: { length: 0.9, width: 0.9, height: 1.1, unit: 'ft' },
      notes: 'Snowy pom-poms with delicate icicle-like spines beginning to cascade.',
      lastMistedTime: simTime - 3600000 * 5
    }
  ];

  const tentB: Tent = {
    id: 'tent-02',
    name: 'Spider Farmer SF-3x3 (Martha)',
    brand: 'Spider Farmer',
    modelName: 'SF-3x3 Grow Tent',
    mylarRating: '1680D Oxford Reflective Mylar',
    poleDiameter: '19mm Steel Rods',
    ventPorts: 'Dual 6" & 8" Duct Ports',
    dimensions: { length: 3, width: 3, height: 6, unit: 'ft' },
    climate: {
      tempF: 68.2,
      tempC: 20.1,
      rh: 90,
      lightPPFD: 85,
      vpdKpa: calculateVPD(68.2, 90, 85),
      co2Ppm: 820
    },
    exhaustFanSpeed: 40,
    items: [...tentBEquipment, ...tentBMushrooms]
  };

  // Main Room Equipment (free-standing in room)
  const roomEquipment: EquipmentItem[] = [
    {
      id: 'eq-room-dehumid',
      name: 'Commercial 50-Pint Room Dehumidifier',
      category: 'equipment',
      type: 'dehumidifier',
      powerOn: true,
      powerWatts: 420,
      setting: 65,
      targetRh: 52,
      dimensions: { length: 1.5, width: 1.2, height: 2.2, unit: 'ft' },
      notes: 'Keeps main lung room humidity balanced and prevents wall condensation.'
    },
    {
      id: 'eq-room-fan',
      name: 'Oscillating Room Air Circulator',
      category: 'equipment',
      type: 'oscillating_fan',
      powerOn: true,
      powerWatts: 55,
      setting: 70,
      dimensions: { length: 1.4, width: 1.4, height: 3.8, unit: 'ft' },
      notes: 'Prevents microclimate dead zones in the primary room space.'
    }
  ];

  const initialRoom: Room = {
    id: 'room-main',
    name: 'Colonial Basement Cultivation Suite',
    dimensions: { length: 16, width: 14, height: 8.5, unit: 'ft' },
    constructionStandard: 'colonial_2005',
    wallRValue: 19, // R-19 exterior walls for 2005 colonial
    airChangesPerHour: 0.35, // 0.35 ACH
    foundationType: 'conditioned_basement',
    hvacMode: 'central_ac_active',
    hvacCoolingSetpointF: 72.0,
    hvacHeatingSetpointF: 68.0,
    roomCo2BaselinePpm: 420, // Clean outdoor baseline when unoccupied
    climate: {
      tempF: 71.0,
      tempC: 21.7,
      rh: 52,
      lightPPFD: 15,
      vpdKpa: calculateVPD(71.0, 52, 15),
      co2Ppm: 420
    },
    tents: [tentA, tentB],
    items: roomEquipment
  };

  return {
    simTime,
    startTime: simTime,
    speed: 1, // 1x normal speed
    outside,
    outdoorLocation: DEFAULT_OUTDOOR_LOCATION,
    rooms: [initialRoom],
    activeRoomId: initialRoom.id,
    room: initialRoom,
    tempUnit: 'F',
    selectedType: 'room',
    selectedId: initialRoom.id,
    selectedParentTentId: null,
    journal: [
      {
        id: 'j-01',
        time: simTime,
        type: 'info',
        title: 'Simulation Initialized',
        message: 'Grow simulator initialized with 2005 Colonial House physics (R-19 walls, 0.35 ACH infiltration, Central AC at 72°F) in Charlton, MA.'
      },
      {
        id: 'j-02',
        time: simTime,
        type: 'success',
        title: 'CO2 Matrix Active',
        message: 'Carbon dioxide sensors online: Ambient 420 PPM, Unoccupied Room at 420 PPM baseline. Add growers or pets to simulate biological respiration.'
      }
    ],
    harvests: []
  };
}

/**
 * Loads simulation state from local storage or returns fresh default state
 */
export function loadSimulation(): SimulationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultSimulationState();
    }
    const state: SimulationState = JSON.parse(raw);
    
    // Migration checks for new properties
    if (!state.outside || !state.outside.co2Ppm) {
      state.outside = {
        ...state.outside,
        co2Ppm: 420
      };
    }

    // Migration for multi-room support
    if (!state.rooms || !Array.isArray(state.rooms) || state.rooms.length === 0) {
      state.rooms = [state.room];
      state.activeRoomId = state.room.id;
    } else {
      if (!state.activeRoomId) {
        state.activeRoomId = state.rooms[0].id;
      }
      const active = state.rooms.find(r => r.id === state.activeRoomId);
      if (active) {
        state.room = active;
      } else {
        state.room = state.rooms[0];
        state.activeRoomId = state.rooms[0].id;
      }
    }

    if (!state.room.constructionStandard) {
      state.room.constructionStandard = 'colonial_2005';
      state.room.wallRValue = 19;
      state.room.airChangesPerHour = 0.35;
      state.room.foundationType = 'conditioned_basement';
      state.room.hvacMode = 'central_ac_active';
      state.room.hvacCoolingSetpointF = 72;
      state.room.hvacHeatingSetpointF = 68;
    }

    if (state.room.roomCo2BaselinePpm === 600 || !state.room.roomCo2BaselinePpm) {
      state.room.roomCo2BaselinePpm = 420;
    }

    if (!state.room.climate.co2Ppm) {
      state.room.climate.co2Ppm = 420;
    }

    const hasBiologicalOccupant = state.room.items.some(i => i.category === 'person' || i.category === 'pet');
    if (!hasBiologicalOccupant && (state.room.climate.co2Ppm === 610 || state.room.climate.co2Ppm === 620)) {
      state.room.climate.co2Ppm = 420;
    }

    state.room.tents = state.room.tents.map(t => {
      let tentCo2 = t.climate.co2Ppm;
      if (!tentCo2 || tentCo2 < 350) {
        tentCo2 = t.items.some(i => i.category === 'mushroom') 
          ? 820 
          : Math.max(380, state.room.climate.co2Ppm - 30);
      }
      return {
        ...t,
        climate: {
          ...t.climate,
          co2Ppm: tentCo2
        },
        items: t.items.map(i => {
          if (i.category === 'plant') {
            return {
              ...i,
              rootTempF: (i as PlantItem).rootTempF || 68.2
            };
          }
          return i;
        })
      };
    });

    return state;
  } catch (err) {
    console.error('Failed to parse saved simulation, creating default:', err);
    return createDefaultSimulationState();
  }
}

/**
 * Saves simulation state to local storage
 */
export function saveSimulation(state: SimulationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save simulation to local storage:', err);
  }
}

/**
 * Resets simulation state
 */
export function resetSimulation(): SimulationState {
  localStorage.removeItem(STORAGE_KEY);
  return createDefaultSimulationState();
}

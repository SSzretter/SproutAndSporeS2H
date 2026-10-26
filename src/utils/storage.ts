import { SimulationState, Room, Tent, PlantItem, MushroomItem, EquipmentItem, OutdoorLocation, Position3D, Item } from '../types/sim';
import { simulateOutsideConditions, calculateVPD } from './physics';
import { getDefaultSpatialPosition, getDefaultItemDimensions, syncItemGeometry } from './spatial';
import { migrateEquipmentLinks } from './equipmentLinks';
import { createHvacRegister, migrateRoomClimateControl } from './roomThermal';

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
      controlMode: 'schedule',
      schedule: { enabled: true, onHour: 6, offHour: 0 }, // 18/6 light schedule
      dimensions: { length: 3.5, width: 3.5, height: 0.3, unit: 'ft' },
      position: { x: 2.0, y: 2.0, z: 5.6 }, // Centered overhead
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
      controlMode: 'auto',
      autoTriggers: {
        tempTriggerHighF: 78,
        rhTriggerHigh: 68,
        rhTriggerLow: 45,
        co2TriggerHighPpm: 1500,
        co2TriggerLowPpm: 380,
        minSpeedPercent: 0, // Off until a trigger needs it; idling would vent heat & humidity for nothing
        maxSpeedPercent: 70
      },
      dimensions: { length: 1.2, width: 0.8, height: 0.8, unit: 'ft' },
      position: { x: 3.2, y: 3.2, z: 5.8 }, // Top corner duct port
      notes: 'Smart controller adjusts speed based on canopy heat, excess RH, and CO2.'
    },
    {
      id: 'eq-humid-tentA',
      name: 'Ultrasonic 6L Humidifier',
      category: 'equipment',
      type: 'humidifier',
      powerOn: true,
      powerWatts: 45,
      setting: 50,
      controlMode: 'auto',
      targetRh: 62,
      dimensions: { length: 0.8, width: 0.8, height: 1.2, unit: 'ft' },
      position: { x: 0.6, y: 3.2, z: 0 }, // Floor back-left corner
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
      controlMode: 'auto',
      targetCo2Ppm: 1200,
      dimensions: { length: 0.8, width: 0.6, height: 1.4, unit: 'ft' },
      position: { x: 0.6, y: 0.6, z: 0 }, // Floor front-left corner
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
      propagationType: 'seed',
      stage: 'flowering',
      stageProgress: 42,
      ageDays: 38,
      currentStageDays: 6,
      keyDates: {
        plantedDate: simTime - 38 * 86400000,
        sproutedDate: simTime - 34 * 86400000,
        seedlingDate: simTime - 34 * 86400000,
        matureSeedlingDate: simTime - 26 * 86400000,
        vegetativeDate: simTime - 18 * 86400000,
        floweringDate: simTime - 6 * 86400000
      },
      germinationDaysExpected: 4,
      seedlingDaysExpected: 8,
      matureSeedlingDaysExpected: 8,
      vegetativeDaysExpected: 28,
      floweringDaysExpected: 56,
      ripeningDaysExpected: 10,
      health: 96,
      soilMoisture: 68,
      rootTempF: 68.2,
      nutrientLevel: 'balanced',
      heightInches: 32,
      canopyWidthInches: 26,
      yieldPotentialGrams: 140,
      isHarvested: false,
      dimensions: { length: 2.0, width: 2.0, height: 2.7, unit: 'ft' },
      position: { x: 1.2, y: 1.5, z: 0 },
      notes: 'Rich terpene production, tight nodal spacing under the 480W LED.',
      lastWateredTime: simTime - 3600000 * 8
    },
    {
      id: 'plant-gelato-02',
      name: 'Gelato #33 (Larry Bird)',
      category: 'plant',
      species: 'Cannabis',
      strainName: 'Sunset Sherbet x Thin Mint GSC',
      propagationType: 'cutting',
      stage: 'vegetative',
      stageProgress: 78,
      ageDays: 24,
      currentStageDays: 6,
      keyDates: {
        plantedDate: simTime - 24 * 86400000,
        rootedDate: simTime - 14 * 86400000,
        seedlingDate: simTime - 14 * 86400000,
        matureSeedlingDate: simTime - 7 * 86400000,
        vegetativeDate: simTime - 6 * 86400000
      },
      rootingDaysExpected: 10,
      seedlingDaysExpected: 7,
      matureSeedlingDaysExpected: 8,
      vegetativeDaysExpected: 28,
      floweringDaysExpected: 60,
      ripeningDaysExpected: 10,
      health: 98,
      soilMoisture: 72,
      rootTempF: 67.8,
      nutrientLevel: 'balanced',
      heightInches: 24,
      canopyWidthInches: 22,
      yieldPotentialGrams: 120,
      isHarvested: false,
      dimensions: { length: 1.8, width: 1.8, height: 2.0, unit: 'ft' },
      position: { x: 2.8, y: 1.5, z: 0 },
      notes: 'Topped at node 4 for an even four-mainline canopy.',
      lastWateredTime: simTime - 3600000 * 12
    },
    {
      id: 'plant-tom-03',
      name: 'Sweet 100 Cherry Tomato',
      category: 'plant',
      species: 'Tomato',
      strainName: 'Heirloom Super Sweet 100',
      propagationType: 'seed',
      stage: 'flowering',
      stageProgress: 60,
      ageDays: 32,
      currentStageDays: 4,
      keyDates: {
        plantedDate: simTime - 32 * 86400000,
        sproutedDate: simTime - 28 * 86400000,
        seedlingDate: simTime - 28 * 86400000,
        matureSeedlingDate: simTime - 20 * 86400000,
        vegetativeDate: simTime - 12 * 86400000,
        floweringDate: simTime - 4 * 86400000
      },
      germinationDaysExpected: 4,
      seedlingDaysExpected: 8,
      matureSeedlingDaysExpected: 8,
      vegetativeDaysExpected: 25,
      floweringDaysExpected: 45,
      ripeningDaysExpected: 14,
      health: 94,
      soilMoisture: 64,
      rootTempF: 68.6,
      nutrientLevel: 'balanced',
      heightInches: 36,
      canopyWidthInches: 20,
      yieldPotentialGrams: 220,
      isHarvested: false,
      dimensions: { length: 1.7, width: 1.7, height: 3.0, unit: 'ft' },
      position: { x: 2.0, y: 2.8, z: 0 },
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
    position: { x: 2.5, y: 2.0, z: 0 }, // Safe buffer from left doorway and back wall
    climate: {
      tempF: 75.4,
      tempC: 24.1,
      rh: 62,
      lightPPFD: 680,
      vpdKpa: calculateVPD(75.4, 62, 680),
      co2Ppm: 1180
    },
    exhaustFanSpeed: 60,
    controllerPriority: 'balanced_auto',
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
      controlMode: 'schedule',
      schedule: { enabled: true, onHour: 7, offHour: 19 }, // 12/12 light schedule
      dimensions: { length: 2.0, width: 0.5, height: 0.2, unit: 'ft' },
      position: { x: 1.5, y: 1.5, z: 5.5 },
      notes: 'Provides directional light cues for cap orientation without heat drying.'
    },
    {
      id: 'eq-fogger-shroom',
      name: 'Commercial Sonic Mist Fogger',
      category: 'equipment',
      type: 'humidifier',
      powerOn: true,
      powerWatts: 80,
      setting: 90,
      controlMode: 'auto',
      targetRh: 92,
      dimensions: { length: 1.2, width: 1.0, height: 1.5, unit: 'ft' },
      position: { x: 0.5, y: 2.3, z: 0 },
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
      controlMode: 'auto',
      autoTriggers: {
        tempTriggerHighF: 76,
        rhTriggerHigh: 98,
        rhTriggerLow: 82,
        co2TriggerHighPpm: 920,
        minSpeedPercent: 0,
        maxSpeedPercent: 45,
        cycleOnMinutes: 3,
        cycleOffMinutes: 15
      },
      dimensions: { length: 0.8, width: 0.8, height: 0.8, unit: 'ft' },
      position: { x: 2.4, y: 2.4, z: 5.2 },
      notes: 'Intelligent FAE evacuation fan: monitors CO2 build-up and pauses when humidifier is active.'
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
      position: { x: 1.5, y: 1.0, z: 0 },
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
      position: { x: 1.5, y: 2.2, z: 2.0 },
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
    position: { x: 8.5, y: 2.0, z: 0 }, // Positioned side-by-side with tentA with generous aisle
    climate: {
      tempF: 68.2,
      tempC: 20.1,
      rh: 90,
      lightPPFD: 85,
      vpdKpa: calculateVPD(68.2, 90, 85),
      co2Ppm: 820
    },
    exhaustFanSpeed: 40,
    controllerPriority: 'humidity_first',
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
      position: { x: 14.0, y: 11.0, z: 0 }, // Along perimeter wall
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
      position: { x: 1.8, y: 10.5, z: 0 },
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
    adjacentSpaceTempF: 70, // Rest of the house around the basement suite
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
  // Cooling comes from a visible ceiling register on the house's central system (no hidden HVAC)
  initialRoom.items = [...initialRoom.items, createHvacRegister(initialRoom, 'cool', 72)];

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

    const migrateTent = (t: Tent, tIdx: number, roomDimensions: any): Tent => {
      const isShroomTent = t.items.some(i => i.category === 'mushroom');
      let tentCo2 = t.climate.co2Ppm;
      if (!tentCo2 || tentCo2 < 350) {
        tentCo2 = isShroomTent 
          ? 820 
          : Math.max(380, state.room.climate.co2Ppm - 30);
      }

      let tentRh = t.climate.rh;
      const hasActiveMushroomFogger = t.items.some(
        i => i.category === 'equipment' && i.type === 'humidifier' && (i as EquipmentItem).powerOn && ((i as EquipmentItem).targetRh || (i as EquipmentItem).setting || 0) >= 75
      ) || isShroomTent;

      if (hasActiveMushroomFogger && (!tentRh || tentRh < 75)) {
        tentRh = 90;
      }

      const controllerPriority = t.controllerPriority || (isShroomTent ? 'humidity_first' : 'balanced_auto');
      const tentPos = t.position || getDefaultSpatialPosition('tent', roomDimensions, tIdx);

      return {
        ...t,
        position: tentPos,
        controllerPriority,
        climate: {
          ...t.climate,
          rh: tentRh,
          vpdKpa: calculateVPD(t.climate.tempF, tentRh, t.climate.lightPPFD || 0),
          co2Ppm: tentCo2
        },
        items: t.items.map((i, iIdx) => {
          const itemPos = i.position || getDefaultSpatialPosition(i.category, t.dimensions, iIdx, (i as any).type);
          const itemDims = i.dimensions || getDefaultItemDimensions({
            category: i.category,
            type: (i as any).type,
            species: (i as any).species,
            stage: (i as any).stage,
            containerType: (i as any).containerType,
            petType: (i as any).petType
          });

          if (i.category === 'plant') {
            const p = i as PlantItem;
            const age = p.ageDays || 10;
            const sim = state.simTime || Date.now();
            const isSeed = (p.propagationType || 'seed') === 'seed';
            const keyDates = p.keyDates || {
              plantedDate: sim - age * 86400000,
              ...(p.stage !== 'germination' && p.stage !== 'rooting' ? {
                sproutedDate: isSeed ? sim - Math.max(1, age - 4) * 86400000 : undefined,
                rootedDate: !isSeed ? sim - Math.max(1, age - 10) * 86400000 : undefined,
                seedlingDate: sim - Math.max(1, age - 4) * 86400000
              } : {}),
              ...(['mature_seedling', 'vegetative', 'flowering', 'ripening', 'ready'].includes(p.stage) ? {
                matureSeedlingDate: sim - Math.max(1, age - 12) * 86400000
              } : {}),
              ...(['vegetative', 'flowering', 'ripening', 'ready'].includes(p.stage) ? {
                vegetativeDate: sim - Math.max(1, age - 20) * 86400000
              } : {}),
              ...(['flowering', 'ripening', 'ready'].includes(p.stage) ? {
                floweringDate: sim - Math.max(1, age - 35) * 86400000
              } : {}),
              ...(['ripening', 'ready'].includes(p.stage) ? {
                ripeningDate: sim - Math.max(1, age - 48) * 86400000
              } : {}),
              ...(p.stage === 'ready' ? {
                readyDate: sim - 86400000
              } : {})
            };

            return {
              ...p,
              dimensions: itemDims,
              position: itemPos,
              propagationType: p.propagationType || 'seed',
              keyDates,
              currentStageDays: p.currentStageDays ?? Math.min(age, 5),
              germinationDaysExpected: p.germinationDaysExpected || 4,
              rootingDaysExpected: p.rootingDaysExpected || 10,
              seedlingDaysExpected: p.seedlingDaysExpected || 8,
              matureSeedlingDaysExpected: p.matureSeedlingDaysExpected || 8,
              vegetativeDaysExpected: p.vegetativeDaysExpected || 28,
              floweringDaysExpected: p.floweringDaysExpected || 56,
              ripeningDaysExpected: p.ripeningDaysExpected || 10,
              rootTempF: p.rootTempF || 68.2
            };
          }
          if (i.category === 'equipment') {
            const eq = i as EquipmentItem;
            if (eq.type === 'exhaust_fan') {
              return {
                ...eq,
                dimensions: itemDims,
                position: itemPos,
                controlMode: eq.controlMode || 'auto',
                autoTriggers: eq.autoTriggers || (isShroomTent ? {
                  tempTriggerHighF: 76,
                  rhTriggerHigh: 98,
                  rhTriggerLow: 82,
                  co2TriggerHighPpm: 920,
                  minSpeedPercent: 0,
                  maxSpeedPercent: 50,
                  cycleOnMinutes: 3,
                  cycleOffMinutes: 15
                } : {
                  tempTriggerHighF: 78,
                  rhTriggerHigh: 68,
                  rhTriggerLow: 45,
                  co2TriggerHighPpm: 1500,
                  co2TriggerLowPpm: 380,
                  minSpeedPercent: 0,
                  maxSpeedPercent: 70
                })
              };
            }
            if (eq.type === 'grow_light') {
              return {
                ...eq,
                dimensions: itemDims,
                position: itemPos,
                controlMode: eq.controlMode || 'schedule',
                schedule: eq.schedule || { enabled: true, onHour: 6, offHour: 0 }
              };
            }
            if (eq.type === 'humidifier' || eq.type === 'dehumidifier' || eq.type === 'co2_regulator') {
              return {
                ...eq,
                dimensions: itemDims,
                position: itemPos,
                controlMode: eq.controlMode || 'auto'
              };
            }
            return {
              ...eq,
              dimensions: itemDims,
              position: itemPos
            };
          }
          return {
            ...i,
            dimensions: itemDims,
            position: itemPos
          };
        })
      };
    };

    state.rooms = state.rooms.map(rm => ({
      ...rm,
      items: rm.items.map((i, iIdx) => ({
        ...i,
        dimensions: i.dimensions || getDefaultItemDimensions({
          category: i.category,
          type: (i as any).type,
          species: (i as any).species,
          stage: (i as any).stage,
          containerType: (i as any).containerType,
          petType: (i as any).petType
        }),
        position: i.position || getDefaultSpatialPosition(i.category, rm.dimensions, iIdx, (i as any).type)
      })),
      tents: rm.tents.map((t, tIdx) => migrateTent(t, tIdx, rm.dimensions))
    }));

    // Backfill crop container sizes and growth-based dimensions (plants saved before pots had physical size)
    state.rooms = state.rooms.map(rm => ({
      ...rm,
      items: rm.items.map(syncItemGeometry),
      tents: rm.tents.map(t => ({ ...t, items: t.items.map(syncItemGeometry) }))
    }));

    // Backfill humidifier reservoir fields and drop dangling hose links (tent deleted / unit moved into a tent)
    state.rooms = state.rooms.map(rm => migrateEquipmentLinks(migrateRoomClimateControl(rm)));
    state.room = state.rooms.find(r => r.id === state.activeRoomId) || state.rooms[0];

    // Ensure backwards compatibility for harvest records
    if (Array.isArray(state.harvests)) {
      state.harvests = state.harvests.map(h => ({
        ...h,
        timeStr: h.timeStr || (h.timestamp ? new Date(h.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '10:00 AM'),
        cureStatus: h.cureStatus || 'Cured & Ready',
        originRoomName: h.originRoomName || state.room.name
      }));
    } else {
      state.harvests = [];
    }

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

import { 
  Room, 
  Tent, 
  Item, 
  PlantItem, 
  MushroomItem, 
  EquipmentItem, 
  PersonItem, 
  PersonRole, 
  PersonActivity,
  NpcInventory, 
  NpcInventoryItem, 
  NpcActionLogEntry, 
  NpcWorkerSettings,
  HarvestRecord 
} from '../types/sim';
import {
  adjustToTargets, DEFAULT_NUTRIENT_EC_PPM, DEFAULT_NUTRIENT_PH, getFeedingReservoir, getNutrientCapacityL, getNutrientLevelL,
  isNutrientReservoir, mixFreshSolution, topOffWithWater
} from './nutrientReservoirs';
import {
  calculateTrayMicroclimate, getRackSlotCode, getRackTiers, getTrayMistWetness, isGrowRack, isTrayDomed, isTrayWet, mistRackTray
} from './growRacks';

const DAY_MS = 86400000;
// Seed / seedling trays: don't mist the same tray again sooner than this
const TRAY_MIST_COOLDOWN_MS = 3 * 60 * 60 * 1000;
// Stages that need a damp surface and humid air (seeds, cuttings, new seedlings)
const MIST_STAGES = new Set(['germination', 'rooting', 'seedling']);
// A reservoir's solution is dosed back to target once it drifts this far
const RESERVOIR_EC_TOLERANCE = 0.15; // of the target strength
const RESERVOIR_PH_TOLERANCE = 0.3;

/** What a reservoir needs right now, if anything: a full change, a top-off + dose, or just a dose. */
export function getReservoirServiceNeed(eq: EquipmentItem, simTime: number, settings: NpcWorkerSettings): 'change' | 'top_off' | 'dose' | null {
  const changeDays = settings.reservoirChangeDays ?? 14;
  const lastChange = eq.lastSolutionChangeTime ?? 0;
  if (simTime - lastChange >= changeDays * DAY_MS) return 'change';
  if (getNutrientLevelL(eq) / getNutrientCapacityL(eq) < (settings.refillReservoirBelowPct ?? 35) / 100) return 'top_off';
  const targetEc = eq.nutrientTargetEcPpm ?? DEFAULT_NUTRIENT_EC_PPM;
  const targetPh = eq.nutrientTargetPh ?? DEFAULT_NUTRIENT_PH;
  if (Math.abs((eq.nutrientEcPpm ?? targetEc) - targetEc) > targetEc * RESERVOIR_EC_TOLERANCE) return 'dose';
  if (Math.abs((eq.nutrientPh ?? targetPh) - targetPh) > RESERVOIR_PH_TOLERANCE) return 'dose';
  return null;
}

/** Carries out a reservoir service and describes it for the logs. */
export function serviceReservoir(eq: EquipmentItem, need: 'change' | 'top_off' | 'dose', simTime: number, ambientTempF: number): { eq: EquipmentItem; title: string; details: string; action: string } {
  const capacity = getNutrientCapacityL(eq);
  const level = getNutrientLevelL(eq);
  const ec = eq.nutrientTargetEcPpm ?? DEFAULT_NUTRIENT_EC_PPM;
  const ph = (eq.nutrientTargetPh ?? DEFAULT_NUTRIENT_PH).toFixed(1);
  if (need === 'change') {
    return {
      eq: mixFreshSolution(eq, simTime),
      title: `Changed solution in ${eq.name}`,
      details: `Dumped ${level.toFixed(1)} L of spent solution and mixed ${capacity} L fresh at ${ec} ppm, pH ${ph}.`,
      action: `Mixing fresh solution in ${eq.name}`
    };
  }
  if (need === 'top_off') {
    return {
      eq: adjustToTargets(topOffWithWater(eq, ambientTempF)),
      title: `Topped off ${eq.name}`,
      details: `Topped off ${eq.name} from ${level.toFixed(1)} L to ${capacity} L and dosed it back to ${ec} ppm, pH ${ph}.`,
      action: `Topping off ${eq.name}`
    };
  }
  return {
    eq: adjustToTargets(eq),
    title: `Dosed ${eq.name}`,
    details: `Solution had drifted to ${Math.round(eq.nutrientEcPpm ?? 0)} ppm, pH ${(eq.nutrientPh ?? 0).toFixed(2)}; dosed nutrients and pH back to ${ec} ppm, pH ${ph}.`,
    action: `Dosing ${eq.name}`
  };
}

export interface RoleMeta {
  role: PersonRole;
  title: string;
  badge: string;
  color: string;
  shirtColor: string;
  hatColor: string;
  description: string;
  defaultActivity: PersonActivity;
}

export const ROLE_METADATA: Record<PersonRole, RoleMeta> = {
  resident: {
    role: 'resident',
    title: 'Resident / Living Here',
    badge: '🏡 Resident',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    shirtColor: '#7c3aed',
    hatColor: '#4c1d95',
    description: 'Lives on-site, enjoys the green living space, relaxes, and naturally enriches ambient CO₂.',
    defaultActivity: 'normal'
  },
  grower: {
    role: 'grower',
    title: 'Master Grower / Botanist',
    badge: '🌱 Master Grower',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    shirtColor: '#059669',
    hatColor: '#ca8a04',
    description: 'Plant care specialist: monitors root zones, waters thirsty pots, replenishes nutrients, and prunes.',
    defaultActivity: 'active'
  },
  technician: {
    role: 'technician',
    title: 'Equipment & Climate Tech',
    badge: '🔧 Equipment Tech',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    shirtColor: '#d97706',
    hatColor: '#f59e0b',
    description: 'Hardware specialist: refills humidifier tanks, empties dehumidifier buckets, tops off, doses and changes nutrient reservoirs.',
    defaultActivity: 'active'
  },
  harvester: {
    role: 'harvester',
    title: 'Crop Harvester & Trimmer',
    badge: '✂️ Harvester & Trimmer',
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    shirtColor: '#0d9488',
    hatColor: '#115e59',
    description: 'Harvest specialist: scouts ready plants and mushrooms, cuts & collects yields directly into inventory.',
    defaultActivity: 'active'
  },
  caretaker: {
    role: 'caretaker',
    title: 'Facility Caretaker / Hand',
    badge: '🧹 Facility Caretaker',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    shirtColor: '#2563eb',
    hatColor: '#1e40af',
    description: 'All-around worker: waters plants, mists mushrooms, services equipment and nutrient reservoirs, and harvests ripe crops.',
    defaultActivity: 'active'
  }
};

/**
 * Returns a starter inventory tailored to the person's role
 */
export function getDefaultNpcInventory(role: PersonRole): NpcInventory {
  const now = Date.now();
  switch (role) {
    case 'grower':
      return {
        maxSlots: 16,
        items: [
          {
            id: `inv-tool-${now}-1`,
            name: 'Pro Brass Watering Wand',
            type: 'tool',
            icon: '🚿',
            description: 'Gentle aerated shower wand for root-zone soaking without compacting living soil.',
            acquiredAt: now
          },
          {
            id: `inv-tool-${now}-2`,
            name: 'Precision Pruning Snips',
            type: 'tool',
            icon: '✂️',
            description: 'Ultra-sharp Japanese stainless steel snips for defoliation and selective pruning.',
            acquiredAt: now
          },
          {
            id: `inv-tool-${now}-3`,
            name: 'Digital Soil pH & EC Pen',
            type: 'tool',
            icon: '🌡️',
            description: 'Accurate combo probe for monitoring runoff conductivity and root medium pH.',
            acquiredAt: now
          },
          {
            id: `inv-sup-${now}-4`,
            name: 'Organic Microbe & Kelp Blend',
            type: 'supply',
            icon: '🧪',
            quantity: 5,
            unit: 'bottles',
            description: 'Cold-water kelp extract with beneficial mycorrhizae for root vitality.',
            acquiredAt: now
          }
        ]
      };

    case 'technician':
      return {
        maxSlots: 16,
        items: [
          {
            id: `inv-tool-${now}-1`,
            name: 'Insulated HVAC Tool Kit',
            type: 'tool',
            icon: '🔧',
            description: 'Multi-bit driver, duct clamps, zip ties, and precision pliers for tent maintenance.',
            acquiredAt: now
          },
          {
            id: `inv-tool-${now}-2`,
            name: 'Hot-Wire Anemometer Airflow Gauge',
            type: 'tool',
            icon: '💨',
            description: 'Measures CFM airflow across inline fans and ducting transitions.',
            acquiredAt: now
          },
          {
            id: `inv-sup-${now}-3`,
            name: 'RO Pure Water Refill Jug',
            type: 'supply',
            icon: '💧',
            quantity: 10,
            unit: 'liters',
            description: '0 PPM reverse-osmosis distilled water for ultrasonic humidifiers.',
            acquiredAt: now
          },
          {
            id: `inv-sup-${now}-4`,
            name: 'Condensate Drain Hose (1/2" ID)',
            type: 'supply',
            icon: '🚰',
            quantity: 1,
            unit: 'spool',
            description: 'Food-grade silicone tubing for direct continuous dehumidifier drainage.',
            acquiredAt: now
          }
        ]
      };

    case 'harvester':
      return {
        maxSlots: 20,
        items: [
          {
            id: `inv-tool-${now}-1`,
            name: 'Titanium Curved Trimming Shears',
            type: 'tool',
            icon: '✂️',
            description: 'Ergonomic non-stick fluorocarbon blades for precision sugar-leaf manicuring.',
            acquiredAt: now
          },
          {
            id: `inv-tool-${now}-2`,
            name: 'Jeweler 60x LED Trichome Loupe',
            type: 'tool',
            icon: '🔍',
            description: 'Optical microscope for inspecting trichome milky vs amber cloudiness.',
            acquiredAt: now
          },
          {
            id: `inv-sup-${now}-3`,
            name: 'Aroma-Sealed Harvest Bins',
            type: 'supply',
            icon: '📦',
            quantity: 4,
            unit: 'totes',
            description: 'Clean food-grade collection bins with humidity monitoring cards.',
            acquiredAt: now
          }
        ]
      };

    case 'caretaker':
      return {
        maxSlots: 16,
        items: [
          {
            id: `inv-tool-${now}-1`,
            name: 'Universal Watering Can (5L)',
            type: 'tool',
            icon: '🚰',
            description: 'Long-spout balanced watering can for reaching deep into dense tent corners.',
            acquiredAt: now
          },
          {
            id: `inv-tool-${now}-2`,
            name: 'Continuous Ultra-Fine Mister',
            type: 'tool',
            icon: '🌫️',
            description: 'Produces micro-droplet mist for mushroom fruiting blocks and humidity boosting.',
            acquiredAt: now
          },
          {
            id: `inv-tool-${now}-3`,
            name: 'Technician Multi-Tool',
            type: 'tool',
            icon: '🛠️',
            description: 'Compact pocket tool with wire cutters, hex wrench, and duct knife.',
            acquiredAt: now
          },
          {
            id: `inv-tool-${now}-4`,
            name: 'Multi-Cutter Harvest Snips',
            type: 'tool',
            icon: '✂️',
            description: 'Quick-release snips for stem harvest and pruning.',
            acquiredAt: now
          }
        ]
      };

    case 'resident':
    default:
      return {
        maxSlots: 8,
        items: [
          {
            id: `inv-pers-${now}-1`,
            name: 'Facility Notebook & Pen',
            type: 'personal',
            icon: '📓',
            description: 'Notes on ambient room conditions, aroma observations, and daily musings.',
            acquiredAt: now
          },
          {
            id: `inv-pers-${now}-2`,
            name: 'Thermal Coffee Tumbler',
            type: 'personal',
            icon: '☕',
            description: 'Hot pour-over coffee for quiet mornings checking the plants.',
            acquiredAt: now
          }
        ]
      };
  }
}

/**
 * Returns default worker settings for a person based on their role
 */
export function getDefaultWorkerSettings(role: PersonRole): NpcWorkerSettings {
  if (role === 'resident') {
    return {
      autoWork: false,
      waterThresholdPct: 40,
      mistThresholdPct: 40,
      refillHumidifierBelowL: 1.5,
      emptyDehumidifierAbovePct: 80,
      refillReservoirBelowPct: 35,
      reservoirChangeDays: 14,
      autoHarvestCrops: false,
      workCadenceMinutes: 15
    };
  }
  return {
    autoWork: true,
    waterThresholdPct: 45,
    mistThresholdPct: 45,
    refillHumidifierBelowL: 2.0,
    emptyDehumidifierAbovePct: 75,
    refillReservoirBelowPct: 35,
    reservoirChangeDays: 14,
    autoHarvestCrops: role === 'harvester' || role === 'caretaker',
    workCadenceMinutes: 5
  };
}

/**
 * Ensures that an existing or newly loaded PersonItem has full NPC worker fields
 */
export function ensurePersonNpcFields(person: PersonItem): PersonItem {
  const role: PersonRole = person.role || 'resident';
  const meta = ROLE_METADATA[role] || ROLE_METADATA.resident;

  // Self-heal stale active action strings from earlier saves (e.g. stuck "Emptying ..." or "Watering ...")
  let cleanAction = person.currentAction;
  const isStaleAction = cleanAction && (
    cleanAction.startsWith('Emptying') ||
    cleanAction.startsWith('Watering') ||
    cleanAction.startsWith('Misting') ||
    cleanAction.startsWith('Refilling') ||
    cleanAction.startsWith('Mixing') ||
    cleanAction.startsWith('Topping') ||
    cleanAction.startsWith('Dosing') ||
    cleanAction.startsWith('Feeding') ||
    cleanAction.startsWith('Harvest') ||
    cleanAction.startsWith('Serviced')
  );

  const defaultIdle = role === 'resident'
    ? 'Resting in living space'
    : role === 'technician'
    ? 'Standby: Monitoring equipment & ducting'
    : role === 'grower'
    ? 'Monitoring root zones & canopy health'
    : role === 'harvester'
    ? 'Scouting ripening flowers & mushrooms'
    : 'Patrolling facility zones';

  if (!cleanAction || isStaleAction) {
    cleanAction = defaultIdle;
  }

  return {
    ...person,
    role,
    customTitle: person.customTitle || meta.title,
    workerSettings: person.workerSettings || getDefaultWorkerSettings(role),
    actionLog: person.actionLog || [
      {
        id: `act-init-${Date.now()}`,
        timestamp: Date.now() - 3600000,
        actionType: 'patrol',
        title: 'Assigned to Facility',
        details: `Assigned as ${meta.badge}. Ready for facility duties and ambient enrichment.`,
        result: 'info'
      }
    ],
    inventory: person.inventory || getDefaultNpcInventory(role),
    currentAction: cleanAction,
    shirtColor: person.shirtColor || meta.shirtColor,
    hatColor: person.hatColor || meta.hatColor
  };
}

/**
 * Flavorful resident activities when relaxing
 */
const RESIDENT_FLAVOR_ACTIONS = [
  'Relaxing with coffee near the plants',
  'Observing trichome sheen in the canopy',
  'Checking ambient temperature & humidity',
  'Listening to the gentle hum of the exhaust fans',
  'Writing notes in the facility journal',
  'Stretching in the fresh oxygenated air',
  'Inspecting the aromatic terpene profiles',
  'Admiring the mushroom fruiting blocks'
];

export interface NpcSimulationResult {
  updatedRoom: Room;
  journalEvents: Array<{
    type: 'info' | 'success' | 'warning' | 'action';
    category: 'automation' | 'crop' | 'care';
    title: string;
    message: string;
    author: string;
  }>;
}

/**
 * Runs the autonomous NPC worker loop for a room during a simulation tick
 */
export function simulateNpcRoomTick(
  room: Room,
  simTime: number,
  elapsedMinutes: number
): NpcSimulationResult {
  const journalEvents: NpcSimulationResult['journalEvents'] = [];

  // Deep clone items so we can safely mutate during worker actions
  const nextRoomItems = [...room.items];
  const nextTents = room.tents.map(t => ({
    ...t,
    items: [...t.items]
  }));

  // Helper to find all plants across room and tents
  const getAllPlants = () => {
    const list: Array<{ plant: PlantItem; tent?: Tent; isRoomLevel: boolean }> = [];
    nextRoomItems.forEach(i => {
      if (i.category === 'plant') list.push({ plant: i as PlantItem, isRoomLevel: true });
    });
    nextTents.forEach(t => {
      t.items.forEach(i => {
        if (i.category === 'plant') list.push({ plant: i as PlantItem, tent: t, isRoomLevel: false });
      });
    });
    return list;
  };

  // Plants a nutrient reservoir waters and feeds: workers leave them to it
  const isReservoirFed = (plant: PlantItem) =>
    !!getFeedingReservoir(plant, [...nextRoomItems, ...nextTents.flatMap(t => t.items)]);

  // Helper to find all mushrooms across room and tents
  const getAllMushrooms = () => {
    const list: Array<{ mushroom: MushroomItem; tent?: Tent; isRoomLevel: boolean }> = [];
    nextRoomItems.forEach(i => {
      if (i.category === 'mushroom') list.push({ mushroom: i as MushroomItem, isRoomLevel: true });
    });
    nextTents.forEach(t => {
      t.items.forEach(i => {
        if (i.category === 'mushroom') list.push({ mushroom: i as MushroomItem, tent: t, isRoomLevel: false });
      });
    });
    return list;
  };

  // Helper to find all equipment across room and tents
  const getAllEquipment = () => {
    const list: Array<{ eq: EquipmentItem; tent?: Tent; isRoomLevel: boolean }> = [];
    nextRoomItems.forEach(i => {
      if (i.category === 'equipment') list.push({ eq: i as EquipmentItem, isRoomLevel: true });
    });
    nextTents.forEach(t => {
      t.items.forEach(i => {
        if (i.category === 'equipment') list.push({ eq: i as EquipmentItem, tent: t, isRoomLevel: false });
      });
    });
    return list;
  };

  // Helper to process an individual NPC
  const processPerson = (personRaw: PersonItem, hostTent?: Tent): PersonItem => {
    const person = ensurePersonNpcFields(personRaw);
    const settings = person.workerSettings || getDefaultWorkerSettings(person.role);

    // If resident: periodic peaceful action updates
    if (person.role === 'resident' || !settings.autoWork) {
      // Rotate flavorful resident status occasionally
      if (Math.random() < 0.15 || !person.currentAction || person.currentAction.startsWith('On standby')) {
        const randAct = RESIDENT_FLAVOR_ACTIONS[Math.floor(Math.random() * RESIDENT_FLAVOR_ACTIONS.length)];
        return {
          ...person,
          currentAction: randAct
        };
      }
      return person;
    }

    // Worker role autonomous actions!
    const role = person.role;
    const actionLog = [...(person.actionLog || [])];
    const inventory = {
      maxSlots: person.inventory?.maxSlots || 16,
      items: [...(person.inventory?.items || [])]
    };

    const addLog = (entry: Omit<NpcActionLogEntry, 'id' | 'timestamp'>) => {
      actionLog.unshift({
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: simTime,
        ...entry
      });
      // Keep up to 60 logs
      if (actionLog.length > 60) actionLog.length = 60;
    };

    let acted = false;

    // Check if worker was in the middle of a task that has now finished its realistic duration (~2.5 min)
    const lastLog = actionLog[0];
    const lastActionAgeMs = lastLog ? simTime - lastLog.timestamp : Infinity;
    const isWorkingOnTask = Boolean(
      person.currentAction && (
        person.currentAction.startsWith('Emptying') ||
        person.currentAction.startsWith('Watering') ||
        person.currentAction.startsWith('Refilling') ||
        person.currentAction.startsWith('Mixing') ||
        person.currentAction.startsWith('Topping') ||
        person.currentAction.startsWith('Dosing') ||
        person.currentAction.startsWith('Misting') ||
        person.currentAction.startsWith('Feeding') ||
        person.currentAction.startsWith('Harvest') ||
        person.currentAction.startsWith('Serviced')
      )
    );

    const taskDurationExpired = person.currentActionUntil 
      ? simTime >= person.currentActionUntil 
      : lastActionAgeMs > 2.5 * 60 * 1000;

    if (isWorkingOnTask && !taskDurationExpired) {
      // Worker is actively performing the task during this 2.5 min window
      return person;
    }

    // 1. TEND DRY PLANTS (Grower, Caretaker)
    if (!acted && (role === 'grower' || role === 'caretaker')) {
      const waterThreshold = settings.waterThresholdPct ?? 45;
      const thirsty = getAllPlants().find(p => !p.plant.isHarvested && (p.plant.soilMoisture ?? 50) < waterThreshold && !isReservoirFed(p.plant));
      if (thirsty) {
        const p = thirsty.plant;
        const prevMoisture = Math.round(p.soilMoisture ?? 0);
        p.soilMoisture = 85;
        p.lastWateredTime = simTime;
        p.health = Math.min(100, (p.health || 80) + 4);
        
        const loc = thirsty.tent ? thirsty.tent.name : room.name;
        const details = `Watered ${p.name} in ${loc} with pH-balanced water. Soil moisture raised from ${prevMoisture}% to 85%.`;
        addLog({
          actionType: 'water',
          title: `Watered ${p.name}`,
          details,
          targetName: p.name,
          targetId: p.id,
          locationName: loc,
          result: 'success'
        });

        journalEvents.push({
          type: 'action',
          category: 'care',
          title: `${person.name} Watered ${p.name}`,
          message: details,
          author: person.name
        });

        acted = true;
        return {
          ...person,
          currentAction: `Watering ${p.name} (${loc})`,
          currentActionUntil: simTime + 2.5 * 60 * 1000,
          currentActionTargetId: p.id,
          actionLog,
          inventory
        };
      }

      // Check low nutrients
      const hungry = getAllPlants().find(p => !p.plant.isHarvested && p.plant.nutrientLevel === 'low' && !isReservoirFed(p.plant));
      if (hungry) {
        const p = hungry.plant;
        p.nutrientLevel = 'balanced';
        p.lastFedTime = simTime;
        const loc = hungry.tent ? hungry.tent.name : room.name;
        const details = `Applied organic nutrient feed to ${p.name} in ${loc}. Vitality restored to balanced.`;
        addLog({
          actionType: 'feed',
          title: `Fed Nutrients to ${p.name}`,
          details,
          targetName: p.name,
          targetId: p.id,
          locationName: loc,
          result: 'success'
        });

        journalEvents.push({
          type: 'action',
          category: 'care',
          title: `${person.name} Fed Nutrients to ${p.name}`,
          message: details,
          author: person.name
        });

        acted = true;
        return {
          ...person,
          currentAction: `Feeding nutrients to ${p.name}`,
          currentActionUntil: simTime + 2.5 * 60 * 1000,
          currentActionTargetId: p.id,
          actionLog,
          inventory
        };
      }
    }

    // 2. MIST DRY MUSHROOMS (Grower, Caretaker)
    if (!acted && (role === 'grower' || role === 'caretaker')) {
      const mistThreshold = settings.mistThresholdPct ?? 45;
      const dryShroom = getAllMushrooms().find(m => !m.mushroom.isHarvested && (m.mushroom.substrateMoisture ?? 50) < mistThreshold);
      if (dryShroom) {
        const m = dryShroom.mushroom;
        const prevMoist = Math.round(m.substrateMoisture ?? 0);
        m.substrateMoisture = 90;
        m.lastMistedTime = simTime;
        m.health = Math.min(100, (m.health || 80) + 5);

        const loc = dryShroom.tent ? dryShroom.tent.name : room.name;
        const details = `Misted ${m.name} in ${loc}. Substrate hydration restored from ${prevMoist}% to 90%.`;
        addLog({
          actionType: 'mist',
          title: `Misted ${m.name}`,
          details,
          targetName: m.name,
          targetId: m.id,
          locationName: loc,
          result: 'success'
        });

        journalEvents.push({
          type: 'action',
          category: 'care',
          title: `${person.name} Misted ${m.name}`,
          message: details,
          author: person.name
        });

        acted = true;
        return {
          ...person,
          currentAction: `Misting ${m.name} (${loc})`,
          currentActionUntil: simTime + 2.5 * 60 * 1000,
          currentActionTargetId: m.id,
          actionLog,
          inventory
        };
      }
    }

    // 2b. MIST SEED / SEEDLING TRAYS (Grower, Caretaker): when the cell surfaces dry out, or the air
    // under a dome has lost its humidity
    if (!acted && (role === 'grower' || role === 'caretaker')) {
      const surfaceThreshold = (settings.mistThresholdPct ?? 45) + 20;
      const containers: Array<{ tent?: Tent }> = [{}, ...nextTents.map(tent => ({ tent }))];
      for (const { tent } of containers) {
        const items = tent ? tent.items : nextRoomItems;
        const climate = (tent ?? room).climate;
        const floorHeatMatActive = items.some(i => i.category === 'equipment' && i.type === 'heat_mat' && i.powerOn);
        for (const rack of items) {
          if (!isGrowRack(rack)) continue;
          const tiers = getRackTiers(rack);
          for (let ti = 0; ti < tiers.length; ti++) {
            for (let tr = 0; tr < tiers[ti].trays; tr++) {
              const young = items.filter((i): i is PlantItem =>
                i.category === 'plant' && !i.isHarvested && i.rackSlot?.rackId === rack.id && i.rackSlot.tier === ti && i.rackSlot.tray === tr && MIST_STAGES.has(i.stage)
              );
              if (young.length === 0) continue;
              const lastMist = tiers[ti].mistedAt?.[tr] ?? 0;
              if (simTime - lastMist < TRAY_MIST_COOLDOWN_MS || getTrayMistWetness(rack, ti, tr, simTime) > 0.2) continue;
              const domed = isTrayDomed(rack, ti, tr);
              const micro = calculateTrayMicroclimate({
                rack, tierIndex: ti, trayIndex: tr, ambientClimate: climate, floorHeatMatActive,
                overheadLightPpfd: climate.lightPPFD, hasWetMedia: isTrayWet(rack, items, ti, tr), simTime
              });
              const driest = Math.min(...young.map(p => p.soilMoisture));
              if (driest >= surfaceThreshold && !(domed && micro.rh < 80)) continue;

              // Like the other worker actions, update the items in place: the people are being mapped over these lists
              mistRackTray(rack.id, items, ti, tr, simTime).forEach((next, i) => {
                if (next !== items[i]) Object.assign(items[i], next);
              });

              const code = getRackSlotCode(rack, { rackId: rack.id, tier: ti, tray: tr, cell: 0 }).split('-')[0];
              const loc = tent ? tent.name : room.name;
              const why = driest < surfaceThreshold ? `surface moisture down to ${Math.round(driest)}%` : `dome humidity down to ${micro.rh}%`;
              const details = `Misted tray ${code} on ${rack.name} in ${loc} (${young.length} seed${young.length === 1 ? '' : 's'}/seedling${young.length === 1 ? '' : 's'}, ${why}).`;
              addLog({
                actionType: 'mist',
                title: `Misted tray ${code}`,
                details,
                targetName: rack.name,
                targetId: rack.id,
                locationName: loc,
                result: 'success'
              });
              journalEvents.push({
                type: 'action',
                category: 'care',
                title: `${person.name} Misted tray ${code}`,
                message: details,
                author: person.name
              });
              acted = true;
              return {
                ...person,
                currentAction: `Misting tray ${code} (${loc})`,
                currentActionUntil: simTime + 2.5 * 60 * 1000,
                currentActionTargetId: rack.id,
                actionLog,
                inventory
              };
            }
          }
        }
      }
    }

    // 3. SERVICE EQUIPMENT (Technician, Caretaker)
    if (!acted && (role === 'technician' || role === 'caretaker')) {
      // Check low humidifiers
      const refillLimit = settings.refillHumidifierBelowL ?? 1.8;
      const emptyHumidifier = getAllEquipment().find(e => 
        e.eq.type === 'humidifier' && 
        e.eq.reservoirLevelL !== undefined && 
        e.eq.reservoirLevelL < refillLimit
      );

      if (emptyHumidifier) {
        const eq = emptyHumidifier.eq;
        const cap = eq.reservoirCapacityL || 4.5;
        const prevL = (eq.reservoirLevelL || 0).toFixed(1);
        eq.reservoirLevelL = cap;

        const loc = emptyHumidifier.tent ? emptyHumidifier.tent.name : room.name;
        const details = `Refilled reservoir for ${eq.name} in ${loc} from ${prevL}L to full (${cap}L) with 0 PPM RO water.`;
        addLog({
          actionType: 'refill_humidifier',
          title: `Refilled ${eq.name}`,
          details,
          targetName: eq.name,
          targetId: eq.id,
          locationName: loc,
          result: 'success'
        });

        journalEvents.push({
          type: 'action',
          category: 'automation',
          title: `${person.name} Refilled ${eq.name}`,
          message: details,
          author: person.name
        });

        acted = true;
        return {
          ...person,
          currentAction: `Refilling ${eq.name} (${loc})`,
          currentActionUntil: simTime + 2.5 * 60 * 1000,
          currentActionTargetId: eq.id,
          actionLog,
          inventory
        };
      }

      // Nutrient reservoirs: change the solution when it's due, top off + dose when low, dose when it drifts
      const reservoirJob = getAllEquipment()
        .filter(e => isNutrientReservoir(e.eq))
        .map(e => ({ ...e, need: getReservoirServiceNeed(e.eq, simTime, settings) }))
        .find(e => e.need !== null);
      if (reservoirJob && reservoirJob.need) {
        const loc = reservoirJob.tent ? reservoirJob.tent.name : room.name;
        const done = serviceReservoir(reservoirJob.eq, reservoirJob.need, simTime, (reservoirJob.tent ?? room).climate.tempF);
        // Updated in place, like the other jobs: the room's item lists are rebuilt around the workers
        Object.assign(reservoirJob.eq, done.eq);
        addLog({
          actionType: 'service_reservoir',
          title: done.title,
          details: `${done.details} (${loc})`,
          targetName: reservoirJob.eq.name,
          targetId: reservoirJob.eq.id,
          locationName: loc,
          result: 'success'
        });
        journalEvents.push({
          type: 'action',
          category: 'automation',
          title: `${person.name}: ${done.title}`,
          message: `${done.details} (${loc})`,
          author: person.name
        });
        acted = true;
        return {
          ...person,
          currentAction: `${done.action} (${loc})`,
          currentActionUntil: simTime + 2.5 * 60 * 1000,
          currentActionTargetId: reservoirJob.eq.id,
          actionLog,
          inventory
        };
      }

      // Check full dehumidifiers needing bucket empty
      const fullDehum = getAllEquipment().find(e => 
        e.eq.type === 'dehumidifier' && 
        !e.eq.drainHoseConnected && 
        e.eq.bucketLevelL !== undefined && 
        e.eq.bucketLevelL >= (e.eq.bucketCapacityL || 3.0) * (settings.emptyDehumidifierAbovePct ? settings.emptyDehumidifierAbovePct / 100 : 0.75)
      );

      if (fullDehum) {
        const eq = fullDehum.eq;
        const prevL = (eq.bucketLevelL || 0).toFixed(1);
        eq.bucketLevelL = 0;

        const loc = fullDehum.tent ? fullDehum.tent.name : room.name;
        const details = `Emptied ${prevL}L condensate bucket on ${eq.name} in ${loc}. Full extraction capacity restored.`;
        addLog({
          actionType: 'empty_dehumidifier',
          title: `Emptied ${eq.name} Bucket`,
          details,
          targetName: eq.name,
          targetId: eq.id,
          locationName: loc,
          result: 'success'
        });

        journalEvents.push({
          type: 'action',
          category: 'automation',
          title: `${person.name} Emptied ${eq.name} Bucket`,
          message: details,
          author: person.name
        });

        acted = true;
        return {
          ...person,
          currentAction: `Emptying ${eq.name} bucket (${loc})`,
          currentActionUntil: simTime + 2.5 * 60 * 1000,
          currentActionTargetId: eq.id,
          actionLog,
          inventory
        };
      }
    }

    // 4. HARVEST MATURE CROPS (Harvester, Caretaker)
    if (!acted && (role === 'harvester' || role === 'caretaker') && settings.autoHarvestCrops !== false) {
      // Check ready plant
      const readyPlant = getAllPlants().find(p => !p.plant.isHarvested && p.plant.stage === 'ready');
      if (readyPlant) {
        const p = readyPlant.plant;
        p.isHarvested = true;
        const yieldGrams = Math.round(p.yieldPotentialGrams * (0.85 + (p.health / 100) * 0.25));
        const quality: HarvestRecord['quality'] = p.health >= 90 ? 'Legendary' : p.health >= 75 ? 'Excellent' : p.health >= 55 ? 'Good' : 'Fair';
        const loc = readyPlant.tent ? readyPlant.tent.name : room.name;

        const dateStr = new Date(simTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = new Date(simTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const record: HarvestRecord = {
          id: `h-npc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: p.name,
          species: p.species,
          strainName: p.strainName,
          type: 'plant',
          yieldGrams,
          quality,
          health: p.health,
          dateStr,
          timeStr,
          timestamp: simTime,
          originRoomName: room.name,
          originTentName: readyPlant.tent?.name,
          cureStatus: 'Fresh Cut',
          notes: `Harvested by worker ${person.name} (${person.role}). Stored in personal field satchel.`
        };

        // Add to person inventory as a harvested crop item
        inventory.items.push({
          id: `inv-harv-${Date.now()}`,
          name: `${p.name} (${yieldGrams}g)`,
          type: 'harvest',
          icon: '🌿',
          description: `${quality} grade ${p.species} harvest. Fresh cut flowers.`,
          quantity: yieldGrams,
          unit: 'g',
          acquiredAt: simTime,
          harvestRecord: record
        });

        const details = `Harvested ${p.name} in ${loc}. Cut & bagged ${yieldGrams}g of ${quality} grade flower into personal inventory.`;
        addLog({
          actionType: 'harvest',
          title: `Harvested ${p.name}`,
          details,
          targetName: p.name,
          targetId: p.id,
          locationName: loc,
          result: 'success'
        });

        journalEvents.push({
          type: 'success',
          category: 'crop',
          title: `${person.name} Harvested ${p.name}!`,
          message: details,
          author: person.name
        });

        acted = true;
        return {
          ...person,
          currentAction: `Harvested ${p.name} (+${yieldGrams}g)`,
          currentActionTargetId: p.id,
          actionLog,
          inventory
        };
      }

      // Check ready mushroom
      const readyMushroom = getAllMushrooms().find(m => 
        !m.mushroom.isHarvested && 
        (m.mushroom.stage === 'ready' || (m.mushroom.stage === 'mature' && m.mushroom.stageProgress >= 90))
      );
      if (readyMushroom) {
        const m = readyMushroom.mushroom;
        m.isHarvested = true;
        const yieldGrams = Math.round(m.yieldPotentialGrams * (0.8 + (m.health / 100) * 0.3));
        const quality: HarvestRecord['quality'] = m.health >= 88 ? 'Legendary' : m.health >= 70 ? 'Excellent' : 'Good';
        const loc = readyMushroom.tent ? readyMushroom.tent.name : room.name;

        const dateStr = new Date(simTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = new Date(simTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const record: HarvestRecord = {
          id: `h-npc-shroom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: m.name,
          species: m.species,
          strainName: m.strainName,
          type: 'mushroom',
          yieldGrams,
          quality,
          health: m.health,
          dateStr,
          timeStr,
          timestamp: simTime,
          originRoomName: room.name,
          originTentName: readyMushroom.tent?.name,
          cureStatus: 'Fresh Cut',
          notes: `Mushroom flush picked by ${person.name} (${person.role}).`
        };

        inventory.items.push({
          id: `inv-harv-m-${Date.now()}`,
          name: `${m.name} (${yieldGrams}g)`,
          type: 'harvest',
          icon: '🍄',
          description: `${quality} quality ${m.species} fruit body flush.`,
          quantity: yieldGrams,
          unit: 'g',
          acquiredAt: simTime,
          harvestRecord: record
        });

        const details = `Harvested ${m.name} in ${loc}. Picked ${yieldGrams}g of ${quality} grade fruit body into satchel.`;
        addLog({
          actionType: 'harvest',
          title: `Harvested ${m.name}`,
          details,
          targetName: m.name,
          targetId: m.id,
          locationName: loc,
          result: 'success'
        });

        journalEvents.push({
          type: 'success',
          category: 'crop',
          title: `${person.name} Harvested ${m.name}!`,
          message: details,
          author: person.name
        });

        acted = true;
        return {
          ...person,
          currentAction: `Harvested ${m.name} (+${yieldGrams}g)`,
          currentActionTargetId: m.id,
          actionLog,
          inventory
        };
      }
    }

    // If nothing needed attention (or task duration completed), set proper monitoring / standby status
    const idleAction = role === 'grower'
      ? 'Monitoring root zones & canopy health'
      : role === 'technician'
      ? 'Standby: Monitoring equipment & ducting'
      : role === 'harvester'
      ? 'Scouting ripening flowers & mushrooms'
      : 'Patrolling facility zones';

    return {
      ...person,
      currentAction: idleAction,
      currentActionUntil: undefined,
      currentActionTargetId: undefined,
      actionLog,
      inventory
    };
  };

  // Process room-level persons
  const updatedRoomItems = nextRoomItems.map(item => {
    if (item.category === 'person') {
      return processPerson(item as PersonItem);
    }
    return item;
  });

  // Process tent-level persons
  const updatedTents = nextTents.map(tent => {
    const updatedTentItems = tent.items.map(item => {
      if (item.category === 'person') {
        return processPerson(item as PersonItem, tent);
      }
      return item;
    });
    return {
      ...tent,
      items: updatedTentItems
    };
  });

  return {
    updatedRoom: {
      ...room,
      items: updatedRoomItems,
      tents: updatedTents
    },
    journalEvents
  };
}

/**
 * Transfers all harvest items from an NPC's personal bag into the facility's master harvest log
 */
export function transferNpcHarvestsToFacility(person: PersonItem): {
  updatedPerson: PersonItem;
  harvests: HarvestRecord[];
  transferredCount: number;
} {
  const currentInv = person.inventory || { maxSlots: 16, items: [] };
  const harvestedItems = currentInv.items.filter(i => i.type === 'harvest' && i.harvestRecord);
  const remainingItems = currentInv.items.filter(i => !(i.type === 'harvest' && i.harvestRecord));

  const harvests: HarvestRecord[] = harvestedItems.map(i => i.harvestRecord!);

  const actionLog = [...(person.actionLog || [])];
  if (harvests.length > 0) {
    const totalGrams = harvests.reduce((acc, h) => acc + h.yieldGrams, 0);
    actionLog.unshift({
      id: `act-xfer-${Date.now()}`,
      timestamp: Date.now(),
      actionType: 'patrol',
      title: 'Transferred Harvests to Facility',
      details: `Offloaded ${harvests.length} crop bundles (${totalGrams}g total) from personal bag into master storage.`,
      result: 'success'
    });
  }

  return {
    updatedPerson: {
      ...person,
      inventory: {
        ...currentInv,
        items: remainingItems
      },
      actionLog
    },
    harvests,
    transferredCount: harvests.length
  };
}

/**
 * Immediate manual directive command dispatched to an NPC
 */
export function executeNpcDirective(
  person: PersonItem,
  directive: 'water_all' | 'service_equipment' | 'harvest_all' | 'take_break',
  room: Room,
  simTime: number
): {
  updatedPerson: PersonItem;
  updatedRoom: Room;
  message: string;
  harvests?: HarvestRecord[];
} {
  const p = ensurePersonNpcFields(person);
  const actionLog = [...(p.actionLog || [])];
  const inventory = {
    maxSlots: p.inventory?.maxSlots || 16,
    items: [...(p.inventory?.items || [])]
  };

  const nextRoomItems = [...room.items];
  const nextTents = room.tents.map(t => ({
    ...t,
    items: [...t.items]
  }));

  if (directive === 'water_all') {
    let wateredCount = 0;
    const allItems = [...nextRoomItems, ...nextTents.flatMap(t => t.items)];
    const waterPlant = (plant: PlantItem) => {
      // Plants on a nutrient reservoir are watered by its pump
      if (getFeedingReservoir(plant, allItems)) return;
      if (!plant.isHarvested && (plant.soilMoisture || 0) < 80) {
        plant.soilMoisture = 85;
        plant.lastWateredTime = simTime;
        wateredCount++;
      }
    };

    nextRoomItems.forEach(i => {
      if (i.category === 'plant') waterPlant(i as PlantItem);
      if (i.category === 'mushroom') {
        const m = i as MushroomItem;
        if (!m.isHarvested && (m.substrateMoisture || 0) < 80) {
          m.substrateMoisture = 90;
          m.lastMistedTime = simTime;
          wateredCount++;
        }
      }
    });

    nextTents.forEach(t => {
      t.items.forEach(i => {
        if (i.category === 'plant') waterPlant(i as PlantItem);
        if (i.category === 'mushroom') {
          const m = i as MushroomItem;
          if (!m.isHarvested && (m.substrateMoisture || 0) < 80) {
            m.substrateMoisture = 90;
            m.lastMistedTime = simTime;
            wateredCount++;
          }
        }
      });
    });

    actionLog.unshift({
      id: `act-dir-${Date.now()}`,
      timestamp: simTime,
      actionType: 'water',
      title: 'Manual Directive: Water All Crops',
      details: `Dispatched by operator to water all crops. Watered & hydrated ${wateredCount} plants/mushrooms.`,
      result: 'success'
    });

    return {
      updatedPerson: {
        ...p,
        currentAction: `Watered ${wateredCount} crops on command`,
        actionLog
      },
      updatedRoom: {
        ...room,
        items: nextRoomItems,
        tents: nextTents
      },
      message: `${p.name} watered ${wateredCount} plants and mushrooms.`
    };
  }

  if (directive === 'service_equipment') {
    let servicedCount = 0;
    const settings = p.workerSettings || getDefaultWorkerSettings(p.role);
    const serviceReservoirIn = (items: Item[], ambientTempF: number) => {
      items.forEach((item, i) => {
        if (!isNutrientReservoir(item)) return;
        const need = getReservoirServiceNeed(item, simTime, settings) ?? (getNutrientLevelL(item) < getNutrientCapacityL(item) - 0.05 ? 'top_off' : null);
        if (!need) return;
        items[i] = serviceReservoir(item, need, simTime, ambientTempF).eq;
        servicedCount++;
      });
    };
    serviceReservoirIn(nextRoomItems, room.climate.tempF);
    nextTents.forEach(t => serviceReservoirIn(t.items, t.climate.tempF));
    const serviceEq = (eq: EquipmentItem) => {
      if (eq.type === 'humidifier' && eq.reservoirLevelL !== undefined) {
        eq.reservoirLevelL = eq.reservoirCapacityL || 4.5;
        servicedCount++;
      }
      if (eq.type === 'dehumidifier' && eq.bucketLevelL !== undefined && !eq.drainHoseConnected) {
        eq.bucketLevelL = 0;
        servicedCount++;
      }
    };

    nextRoomItems.forEach(i => { if (i.category === 'equipment') serviceEq(i as EquipmentItem); });
    nextTents.forEach(t => { t.items.forEach(i => { if (i.category === 'equipment') serviceEq(i as EquipmentItem); }); });

    actionLog.unshift({
      id: `act-dir-${Date.now()}`,
      timestamp: simTime,
      actionType: 'refill_humidifier',
      title: 'Manual Directive: Service Equipment',
      details: `Serviced and topped off / emptied ${servicedCount} equipment reservoirs and buckets.`,
      result: 'success'
    });

    return {
      updatedPerson: {
        ...p,
        currentAction: `Serviced ${servicedCount} hardware units`,
        actionLog
      },
      updatedRoom: {
        ...room,
        items: nextRoomItems,
        tents: nextTents
      },
      message: `${p.name} serviced ${servicedCount} humidifiers, dehumidifiers and nutrient reservoirs.`
    };
  }

  if (directive === 'harvest_all') {
    const harvested: HarvestRecord[] = [];
    const dateStr = new Date(simTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = new Date(simTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const checkAndHarvest = (item: Item, locName: string) => {
      if (item.category === 'plant') {
        const pl = item as PlantItem;
        if (!pl.isHarvested && (pl.stage === 'ready' || (pl.stage === 'ripening' && pl.stageProgress >= 85))) {
          pl.isHarvested = true;
          const yieldGrams = Math.round(pl.yieldPotentialGrams * (0.85 + (pl.health / 100) * 0.25));
          const quality: HarvestRecord['quality'] = pl.health >= 88 ? 'Legendary' : pl.health >= 70 ? 'Excellent' : 'Good';
          const rec: HarvestRecord = {
            id: `h-dir-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: pl.name,
            species: pl.species,
            strainName: pl.strainName,
            type: 'plant',
            yieldGrams,
            quality,
            health: pl.health,
            dateStr,
            timeStr,
            timestamp: simTime,
            originRoomName: room.name,
            originTentName: locName,
            cureStatus: 'Fresh Cut',
            notes: `Harvested via manual directive by ${p.name}.`
          };
          harvested.push(rec);
          inventory.items.push({
            id: `inv-h-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: `${pl.name} (${yieldGrams}g)`,
            type: 'harvest',
            icon: '🌿',
            description: `${quality} grade ${pl.species} flowers.`,
            quantity: yieldGrams,
            unit: 'g',
            acquiredAt: simTime,
            harvestRecord: rec
          });
        }
      } else if (item.category === 'mushroom') {
        const m = item as MushroomItem;
        if (!m.isHarvested && (m.stage === 'ready' || (m.stage === 'mature' && m.stageProgress >= 80))) {
          m.isHarvested = true;
          const yieldGrams = Math.round(m.yieldPotentialGrams * (0.8 + (m.health / 100) * 0.3));
          const quality: HarvestRecord['quality'] = m.health >= 85 ? 'Legendary' : 'Excellent';
          const rec: HarvestRecord = {
            id: `h-shroom-dir-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: m.name,
            species: m.species,
            strainName: m.strainName,
            type: 'mushroom',
            yieldGrams,
            quality,
            health: m.health,
            dateStr,
            timeStr,
            timestamp: simTime,
            originRoomName: room.name,
            originTentName: locName,
            cureStatus: 'Fresh Cut',
            notes: `Harvested via directive by ${p.name}.`
          };
          harvested.push(rec);
          inventory.items.push({
            id: `inv-hm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: `${m.name} (${yieldGrams}g)`,
            type: 'harvest',
            icon: '🍄',
            description: `${quality} flush of ${m.species}.`,
            quantity: yieldGrams,
            unit: 'g',
            acquiredAt: simTime,
            harvestRecord: rec
          });
        }
      }
    };

    nextRoomItems.forEach(i => checkAndHarvest(i, room.name));
    nextTents.forEach(t => t.items.forEach(i => checkAndHarvest(i, t.name)));

    actionLog.unshift({
      id: `act-dir-${Date.now()}`,
      timestamp: simTime,
      actionType: 'harvest',
      title: 'Manual Directive: Harvest All Ready Crops',
      details: `Harvested ${harvested.length} ripe crops. Bagged into personal worker inventory.`,
      result: 'success'
    });

    return {
      updatedPerson: {
        ...p,
        currentAction: `Harvested ${harvested.length} ripe crops on command`,
        actionLog,
        inventory
      },
      updatedRoom: {
        ...room,
        items: nextRoomItems,
        tents: nextTents
      },
      message: `${p.name} harvested ${harvested.length} crops into personal inventory.`,
      harvests: harvested
    };
  }

  // take_break
  actionLog.unshift({
    id: `act-break-${Date.now()}`,
    timestamp: simTime,
    actionType: 'rest',
    title: 'Directive: Taking a Break',
    details: 'Stepped away to relax and rest in the facility.',
    result: 'info'
  });

  return {
    updatedPerson: {
      ...p,
      activity: 'resting',
      currentAction: 'Taking a well-deserved break',
      actionLog
    },
    updatedRoom: room,
    message: `${p.name} is now resting.`
  };
}

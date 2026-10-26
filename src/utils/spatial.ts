import { Dimensions, Position3D, Item, Tent, Room, PlantItem, MushroomItem, EquipmentItem, PersonItem, PetItem } from '../types/sim';
import { getAttachedPosition } from './equipmentLinks';

/**
 * Returns realistic physical dimensions (L × W × H in feet) for any object
 * based on its category, equipment type, plant species/stage, or container.
 */
export function getDefaultItemDimensions(params: {
  category: 'plant' | 'mushroom' | 'equipment' | 'person' | 'pet';
  type?: string;
  species?: string;
  stage?: string;
  containerType?: string;
  petType?: string;
}): Dimensions {
  const { category, type, species, stage, containerType, petType } = params;

  if (category === 'plant') {
    const isHop = species === 'Hops';
    const isChili = species === 'Chili Pepper';
    const isBasil = species === 'Basil';
    const isTomato = species === 'Tomato';

    if (stage === 'germination' || stage === 'rooting') {
      return { length: 0.35, width: 0.35, height: 0.2, unit: 'ft' }; // 4" Seedling cell plug / Rockwool cube
    }
    if (stage === 'seedling') {
      return { length: 0.5, width: 0.5, height: 0.5, unit: 'ft' }; // 0.5 gal starter pot / humidity dome
    }
    if (stage === 'mature_seedling') {
      return { length: 0.8, width: 0.8, height: 0.9, unit: 'ft' }; // 1 gal nursery pot
    }
    if (stage === 'vegetative') {
      if (isHop) return { length: 1.5, width: 1.5, height: 4.5, unit: 'ft' };
      if (isTomato) return { length: 1.8, width: 1.8, height: 2.6, unit: 'ft' };
      if (isChili) return { length: 1.4, width: 1.4, height: 1.8, unit: 'ft' };
      if (isBasil) return { length: 1.0, width: 1.0, height: 1.2, unit: 'ft' };
      return { length: 1.8, width: 1.8, height: 2.2, unit: 'ft' }; // Cannabis vegetative bush
    }
    // flowering / ripening / ready
    if (isHop) return { length: 2.2, width: 2.2, height: 8.5, unit: 'ft' }; // Vigorous tall bine on trellis
    if (isTomato) return { length: 2.0, width: 2.0, height: 4.2, unit: 'ft' }; // Indeterminate tomato cage
    if (isChili) return { length: 1.6, width: 1.6, height: 2.5, unit: 'ft' }; // Loaded pepper bush
    if (isBasil) return { length: 1.2, width: 1.2, height: 1.5, unit: 'ft' };
    return { length: 2.2, width: 2.2, height: 3.2, unit: 'ft' }; // Full flowering canopy
  }

  if (category === 'mushroom') {
    if (containerType === 'monotub') {
      return { length: 2.0, width: 1.3, height: 1.0, unit: 'ft' }; // Standard 66-quart monotub
    }
    if (containerType === 'grow_bag') {
      return { length: 0.7, width: 0.6, height: 1.2, unit: 'ft' }; // Gusseted fruiting filter bag
    }
    return { length: 0.8, width: 0.7, height: 0.9, unit: 'ft' }; // Hardwood fruiting block
  }

  if (category === 'equipment') {
    switch (type) {
      case 'grow_light':
        return { length: 2.5, width: 1.6, height: 0.3, unit: 'ft' }; // Quantum LED board / bar array
      case 'exhaust_fan':
        return { length: 1.2, width: 0.8, height: 0.8, unit: 'ft' }; // 6" Inline duct fan
      case 'humidifier':
        return { length: 0.9, width: 0.9, height: 1.4, unit: 'ft' }; // 6L ultrasonic tower
      case 'dehumidifier':
        return { length: 1.4, width: 1.1, height: 2.0, unit: 'ft' }; // 50-pint compressor
      case 'heater':
        return { length: 0.9, width: 0.9, height: 1.5, unit: 'ft' }; // Ceramic space heater
      case 'oscillating_fan':
        return { length: 0.9, width: 0.8, height: 1.2, unit: 'ft' }; // Clip-on oscillating fan
      case 'co2_regulator':
        return { length: 0.8, width: 0.8, height: 2.2, unit: 'ft' }; // 20lb aluminum tank + dual gauge solenoid
      case 'co2_bag':
        return { length: 0.8, width: 0.4, height: 1.3, unit: 'ft' }; // ExHale mycelial CO2 bag
      case 'heat_mat':
        return { length: 1.7, width: 0.8, height: 0.05, unit: 'ft' }; // 10" x 20.75" seedling heat mat
      default:
        return { length: 1.2, width: 1.0, height: 1.0, unit: 'ft' };
    }
  }

  if (category === 'person') {
    return { length: 1.8, width: 1.2, height: 5.8, unit: 'ft' };
  }

  if (category === 'pet') {
    if (petType === 'cat') return { length: 1.2, width: 0.6, height: 0.9, unit: 'ft' };
    if (petType === 'dog_small') return { length: 1.2, width: 0.7, height: 1.0, unit: 'ft' };
    if (petType === 'dog_medium') return { length: 1.8, width: 0.9, height: 1.5, unit: 'ft' };
    return { length: 2.5, width: 1.2, height: 2.2, unit: 'ft' }; // large dog
  }

  return { length: 1.5, width: 1.5, height: 1.5, unit: 'ft' };
}

const CUBIC_FT_PER_GALLON = 0.1337;
const roundFt = (v: number) => Math.round(v * 100) / 100;

/**
 * Default root-zone volume when a plant has no explicit containerVolumeGallons.
 */
export function getDefaultContainerVolumeGallons(containerType?: string): number {
  if (containerType === 'raised_bed_cedar') return 50;
  if (containerType === 'in_ground_earth') return 100;
  return 5;
}

/**
 * Physical size (L × W × H in feet) of a plant's pot / bed / bucket, derived from its
 * type and root-zone volume. Round pots are modeled as cylinders (L = W = diameter);
 * beds, trays and chambers as boxes.
 */
export function getPlantContainerDimensions(containerType?: string, volumeGallons?: number): Dimensions {
  const gallons = Math.max(0.25, volumeGallons || getDefaultContainerVolumeGallons(containerType));
  const cuFt = gallons * CUBIC_FT_PER_GALLON;

  // Box-shaped containers: fixed depth, square footprint sized to hold the volume
  const box = (depthFt: number, visibleHeightFt: number = depthFt): Dimensions => {
    const side = Math.sqrt(cuFt / depthFt);
    return { length: roundFt(side), width: roundFt(side), height: roundFt(visibleHeightFt), unit: 'ft' };
  };
  // Cylinders: diameter = ratio × height
  const cylinder = (diameterToHeight: number): Dimensions => {
    const h = Math.cbrt(cuFt / (Math.PI * Math.pow(diameterToHeight / 2, 2)));
    const d = h * diameterToHeight;
    return { length: roundFt(d), width: roundFt(d), height: roundFt(h), unit: 'ft' };
  };

  switch (containerType) {
    case 'raised_bed_cedar':
      return box(1.0);
    case 'in_ground_earth':
      return box(1.0, 0.2); // Root zone dug 1ft deep; only a low soil mound shows above grade
    case 'flood_drain_tray':
      return box(0.5);
    case 'aeroponic_chamber':
      return box(1.2);
    case 'dwc_reservoir_bucket':
      return cylinder(0.85); // 5gal bucket ≈ 12" Ø × 14" tall
    case 'terracotta_pot':
    case 'plastic_nursery_pot':
      return cylinder(1.1);
    case 'fabric_pot':
    default:
      return cylinder(1.2); // 5gal fabric pot ≈ 12" Ø × 10" tall
  }
}

/**
 * Physical size of a mushroom fruiting container (monotub / grow bag / block).
 */
export function getMushroomContainerDimensions(containerType?: string): Dimensions {
  return getDefaultItemDimensions({ category: 'mushroom', containerType });
}

/**
 * Overall envelope of a plant: the larger of pot and canopy for the footprint,
 * and pot height + plant height (measured from the soil surface) for the height.
 */
export function computePlantDimensions(plant: PlantItem): Dimensions {
  const pot = plant.containerDimensions || getPlantContainerDimensions(plant.containerType, plant.containerVolumeGallons);
  const canopyFt = Math.max(0, plant.canopyWidthInches || 0) / 12;
  const heightFt = Math.max(0, plant.heightInches || 0) / 12;
  return {
    length: roundFt(Math.max(pot.length, canopyFt)),
    width: roundFt(Math.max(pot.width, canopyFt)),
    height: roundFt(pot.height + heightFt),
    unit: 'ft'
  };
}

/** Height of the fruit bodies above the substrate surface by stage (ft). */
export function getMushroomFruitHeightFt(shroom: MushroomItem): number {
  const progress = Math.max(0, Math.min(100, shroom.stageProgress || 0)) / 100;
  switch (shroom.stage) {
    case 'colonizing': return 0;
    case 'pinning': return 0.05 + 0.1 * progress;
    case 'fruiting': return 0.15 + 0.25 * progress;
    default: return 0.45; // mature / ready
  }
}

export function computeMushroomDimensions(shroom: MushroomItem): Dimensions {
  const container = shroom.containerDimensions || getMushroomContainerDimensions(shroom.containerType);
  return {
    length: container.length,
    width: container.width,
    height: roundFt(container.height + getMushroomFruitHeightFt(shroom)),
    unit: 'ft'
  };
}

/**
 * Ensures crops carry a container size and that their overall dimensions reflect
 * current growth. Non-crop items are returned unchanged.
 */
export function syncItemGeometry<T extends Item>(item: T): T {
  if (item.category === 'plant') {
    const plant = item as PlantItem;
    const containerDimensions = plant.containerDimensions || getPlantContainerDimensions(plant.containerType, plant.containerVolumeGallons);
    const synced = { ...plant, containerDimensions };
    return { ...synced, dimensions: computePlantDimensions(synced) } as T;
  }
  if (item.category === 'mushroom') {
    const shroom = item as MushroomItem;
    const containerDimensions = shroom.containerDimensions || getMushroomContainerDimensions(shroom.containerType);
    const synced = { ...shroom, containerDimensions };
    return { ...synced, dimensions: computeMushroomDimensions(synced) } as T;
  }
  return item;
}

/**
 * Keeps an item's footprint (centered on position.x/y) inside its host container
 * and its body below the container ceiling. Items larger than the container are centered.
 */
export function clampItemPosition(position: Position3D, itemDims: Dimensions, containerDims: Dimensions): Position3D {
  const clampAxis = (v: number, half: number, max: number) =>
    half * 2 >= max ? max / 2 : Math.max(half, Math.min(max - half, v));
  return {
    x: roundFt(clampAxis(position.x, itemDims.length / 2, containerDims.length)),
    y: roundFt(clampAxis(position.y, itemDims.width / 2, containerDims.width)),
    z: roundFt(Math.max(0, Math.min(Math.max(0, containerDims.height - itemDims.height), position.z)))
  };
}

/**
 * Calculates a sensible default 3D position (X, Y, Z in feet) for a new item or tent
 * within its host container to prevent overlapping and clipping through walls.
 */
export function getDefaultSpatialPosition(
  category: 'tent' | 'plant' | 'mushroom' | 'equipment' | 'person' | 'pet',
  containerDimensions: Dimensions,
  index: number = 0,
  equipmentType?: string
): Position3D {
  const cL = Math.max(3, containerDimensions.length);
  const cW = Math.max(3, containerDimensions.width);
  const cH = Math.max(4, containerDimensions.height);

  // 1. TENT INSIDE A ROOM
  if (category === 'tent') {
    // Keep at least 2.5ft buffer from left doorway and 2.0ft buffer from back wall
    const cols = Math.max(1, Math.floor((cL - 3) / 4.5));
    const col = index % cols;
    const row = Math.floor(index / cols);

    const x = Math.min(cL - 3.5, 2.5 + col * 4.8);
    const y = Math.min(cW - 3.5, 2.0 + row * 4.5);
    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      z: 0 // Tents rest on the floor
    };
  }

  // 2. EQUIPMENT
  if (category === 'equipment') {
    if (equipmentType === 'grow_light') {
      // Hanging light: centered overhead near ceiling
      return {
        x: Number((cL / 2).toFixed(1)),
        y: Number((cW / 2).toFixed(1)),
        z: Number(Math.max(1, cH - 1.2).toFixed(1))
      };
    }
    if (equipmentType === 'exhaust_fan') {
      // Top rear corner for duct port
      return {
        x: Number(Math.max(0.5, cL - 0.8).toFixed(1)),
        y: Number(Math.max(0.5, cW - 0.8).toFixed(1)),
        z: Number(Math.max(1, cH - 0.9).toFixed(1))
      };
    }
    if (equipmentType === 'co2_bag') {
      // Hanging above canopy
      return {
        x: Number((cL * 0.3).toFixed(1)),
        y: Number((cW * 0.3).toFixed(1)),
        z: Number(Math.max(1, cH - 1.5).toFixed(1))
      };
    }
    if (equipmentType === 'oscillating_fan') {
      // Mid-canopy pole clip
      return {
        x: 0.5,
        y: 0.5,
        z: Number((cH * 0.5).toFixed(1))
      };
    }
    if (equipmentType === 'heat_mat') {
      // Floor under seedling trays
      return {
        x: 0.8,
        y: 0.8,
        z: 0
      };
    }
    // Humidifier / Dehumidifier / Heater / CO2 Tank on floor corner
    const corners = [
      { x: 0.8, y: cW - 0.9 },
      { x: cL - 0.9, y: 0.8 },
      { x: 0.8, y: 0.8 },
      { x: cL - 0.9, y: cW - 0.9 }
    ];
    const pt = corners[index % corners.length];
    return {
      x: Number(pt.x.toFixed(1)),
      y: Number(pt.y.toFixed(1)),
      z: 0
    };
  }

  // 3. PLANTS & MUSHROOMS (Grid layout on floor)
  const cols = Math.min(3, Math.max(1, Math.floor(cL / 1.5)));
  const col = index % cols;
  const row = Math.floor(index / cols);

  const stepX = cL / (cols + 1);
  const stepY = cW / (Math.ceil((index + 1) / cols) + 1);

  const x = Math.min(cL - 0.8, Math.max(0.6, (col + 1) * stepX));
  const y = Math.min(cW - 0.8, Math.max(0.6, (row + 1) * stepY));

  return {
    x: Number(x.toFixed(1)),
    y: Number(y.toFixed(1)),
    z: 0 // Plants sit on floor/stand
  };
}

/** An occupied volume in a container: footprint centered at (x, y), from z up to z + h (feet). */
interface OccupiedBox {
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
}

// Clearance kept between neighbouring items' footprints when auto-placing
const PLACEMENT_GAP_FT = 0.1;
// Resolution of the free-space search grid
const PLACEMENT_STEP_FT = 0.25;

function itemBox(item: Item): OccupiedBox | null {
  if (!item.position) return null;
  return { x: item.position.x, y: item.position.y, z: item.position.z || 0, ...item.dimensions };
}

/**
 * Finds a spot for a new item where its footprint (and height span) doesn't overlap anything
 * already in its container. Tent items avoid the tent's other items; room / garden items avoid
 * the room's floor items and its tents. Starts from the item's own default position and, if that
 * is taken, moves to the nearest free spot that fits inside the walls. Elevation (z) is kept, so
 * a ceiling light only conflicts with other ceiling gear, not with the plants below it.
 * If the container is full, the item goes where it overlaps the least.
 */
export function placeItemInFreeSpace<T extends Item>(item: T, room: Room, tent?: Tent): T {
  const container = tent ? tent.dimensions : room.dimensions;
  const existing = tent ? tent.items : room.items;
  const dims = item.dimensions;

  // A heat mat attached to something lives under / around it rather than in its own spot
  const attachedPos = getAttachedPosition(item, existing, tent);
  if (attachedPos) return { ...item, position: attachedPos };

  const obstacles: OccupiedBox[] = existing
    .filter(other => other.id !== item.id && !getAttachedPosition(other, existing, tent))
    .map(itemBox)
    .filter((box): box is OccupiedBox => box !== null);
  if (!tent) {
    // Tents are solid obstacles for anything placed on the room floor (position = back-left corner)
    for (const t of room.tents) {
      const pos = t.position || { x: 0, y: 0, z: 0 };
      obstacles.push({
        x: pos.x + t.dimensions.length / 2,
        y: pos.y + t.dimensions.width / 2,
        z: pos.z || 0,
        ...t.dimensions
      });
    }
  }

  const preferred = clampItemPosition(
    item.position || getDefaultSpatialPosition(item.category, container, existing.length, item.category === 'equipment' ? item.type : undefined),
    dims,
    container
  );
  const z = preferred.z;

  // Footprint area (sq ft, gap included) shared with obstacles whose height span overlaps the item's
  const overlapArea = (x: number, y: number) => obstacles.reduce((sum, o) => {
    if (z >= o.z + o.height || o.z >= z + dims.height) return sum;
    const ox = (dims.length + o.length) / 2 + PLACEMENT_GAP_FT - Math.abs(x - o.x);
    const oy = (dims.width + o.width) / 2 + PLACEMENT_GAP_FT - Math.abs(y - o.y);
    return ox > 0 && oy > 0 ? sum + ox * oy : sum;
  }, 0);

  if (overlapArea(preferred.x, preferred.y) === 0) return { ...item, position: preferred };

  // Scan every spot where the footprint fits inside the walls; take the free one nearest the preferred spot
  const axis = (size: number, max: number) => {
    const half = size / 2;
    if (half * 2 >= max) return [max / 2];
    const values: number[] = [];
    for (let v = half; v <= max - half + 1e-6; v += PLACEMENT_STEP_FT) values.push(roundFt(v));
    return values;
  };
  // Prefer no overlap, then the least overlap; among equals, the spot nearest the preferred one
  let best = { x: preferred.x, y: preferred.y, overlap: overlapArea(preferred.x, preferred.y), dist: 0 };
  for (const x of axis(dims.length, container.length)) {
    for (const y of axis(dims.width, container.width)) {
      const overlap = overlapArea(x, y);
      const dist = Math.hypot(x - preferred.x, y - preferred.y);
      if (overlap < best.overlap - 1e-6 || (Math.abs(overlap - best.overlap) <= 1e-6 && dist < best.dist)) {
        best = { x, y, overlap, dist };
      }
    }
  }

  return { ...item, position: { x: best.x, y: best.y, z } };
}

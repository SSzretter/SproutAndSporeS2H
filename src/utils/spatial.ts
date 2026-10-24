import { Dimensions, Position3D, Item, Tent, Room, PlantItem, MushroomItem, EquipmentItem, PersonItem, PetItem } from '../types/sim';

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
export const CANVAS_GRID_SIZE = 40; // 40 pixels = 1 foot (1 square = 1 foot)
export const CANVAS_FLOOR_ORIGIN_X = 60; // Inner face of left wall (where X = 0 begins)
export const CANVAS_FLOOR_ORIGIN_Y = 50; // Inner face of top wall (where Y = 0 begins)
export const CANVAS_MAX_FLOOR_X = 940; // Inner face of right wall (60 + 22 * 40 = 940)
export const CANVAS_MAX_FLOOR_Y = 610; // Inner face of bottom wall (50 + 14 * 40 = 610)

/**
 * Calculates safe 2D canvas pixel coordinates for a Tent inside a room
 * guaranteeing exact 1:1 scale with the gridlines (1 square = 1 foot).
 * A 4x4 tent with X=1, Y=2 is placed exactly 1 square from the left wall,
 * 2 squares from the top wall, and spans exactly 4x4 squares.
 */
export function getSafeTentCanvasPosition(
  tent: Tent,
  room: Room,
  tentIndex: number,
  canvasWidth: number = 1000,
  canvasHeight: number = 650
): { x: number; y: number; width: number; height: number } {
  const tentLengthFt = Math.max(1, tent.dimensions?.length || 4);
  const tentWidthFt = Math.max(1, tent.dimensions?.width || 4);

  // Exact true-scale dimensions in pixels (1 grid square = 1 foot):
  const width = Math.round(tentLengthFt * CANVAS_GRID_SIZE);
  const height = Math.round(tentWidthFt * CANVAS_GRID_SIZE);

  let leftX: number;
  let topY: number;

  if (tent.position && typeof tent.position.x === 'number' && typeof tent.position.y === 'number') {
    // Exact 1:1 grid alignment: X feet from left wall, Y feet from top wall
    leftX = CANVAS_FLOOR_ORIGIN_X + tent.position.x * CANVAS_GRID_SIZE;
    topY = CANVAS_FLOOR_ORIGIN_Y + tent.position.y * CANVAS_GRID_SIZE;
  } else {
    // Fallback clean integer grid placement (1ft, 7ft, 13ft...)
    const col = tentIndex % 3;
    const row = Math.floor(tentIndex / 3);
    const defaultXFt = 1 + col * 6;
    const defaultYFt = 1 + row * 6;
    leftX = CANVAS_FLOOR_ORIGIN_X + defaultXFt * CANVAS_GRID_SIZE;
    topY = CANVAS_FLOOR_ORIGIN_Y + defaultYFt * CANVAS_GRID_SIZE;
  }

  // Ensure tent remains strictly within room floor boundaries
  leftX = Math.max(CANVAS_FLOOR_ORIGIN_X, Math.min(CANVAS_MAX_FLOOR_X - width, leftX));
  topY = Math.max(CANVAS_FLOOR_ORIGIN_Y, Math.min(CANVAS_MAX_FLOOR_Y - height, topY));

  // Center coordinate for canvas transform
  const cx = Math.round(leftX + width / 2);
  const cy = Math.round(topY + height / 2);

  return {
    x: cx,
    y: cy,
    width,
    height
  };
}

/**
 * Calculates canvas pixel coordinates for a crop or equipment item inside a tent
 * matching true foot coordinates inside the tent.
 */
export function getSafeTentItemCanvasPosition(
  item: Item,
  tent: Tent,
  tentCanvasX: number,
  tentCanvasY: number,
  itemIndex: number,
  totalItems: number
): { x: number; y: number } {
  const tentLengthFt = Math.max(1, tent.dimensions?.length || 4);
  const tentWidthFt = Math.max(1, tent.dimensions?.width || 4);
  const width = Math.round(tentLengthFt * CANVAS_GRID_SIZE);
  const height = Math.round(tentWidthFt * CANVAS_GRID_SIZE);

  const halfW = width / 2;
  const halfH = height / 2;
  const tentLeft = tentCanvasX - halfW;
  const tentTop = tentCanvasY - halfH;

  // Interior padding to keep sprites inside tent shell
  const padX = Math.min(14, width * 0.12);
  const padY = Math.min(14, height * 0.12);
  const innerMinX = tentLeft + padX;
  const innerMaxX = tentLeft + width - padX;
  const innerMinY = tentTop + padY;
  const innerMaxY = tentTop + height - padY;

  if (item.position && typeof item.position.x === 'number' && typeof item.position.y === 'number') {
    // True scale within tent: item position is in feet from the tent's top-left corner
    const px = tentLeft + item.position.x * CANVAS_GRID_SIZE;
    const py = tentTop + item.position.y * CANVAS_GRID_SIZE;

    return {
      x: Math.round(Math.max(innerMinX, Math.min(innerMaxX, px))),
      y: Math.round(Math.max(innerMinY, Math.min(innerMaxY, py)))
    };
  }

  // Fallback distribution
  if (totalItems <= 1) {
    return { x: tentCanvasX, y: tentCanvasY };
  }
  if (totalItems <= 4) {
    const cols = 2;
    const col = itemIndex % cols;
    const row = Math.floor(itemIndex / cols);
    const spacingX = (innerMaxX - innerMinX) / 2;
    const spacingY = (innerMaxY - innerMinY) / 2;
    return {
      x: Math.round(innerMinX + spacingX * (col + 0.5)),
      y: Math.round(innerMinY + spacingY * (row + 0.5))
    };
  }

  const cols = Math.min(3, Math.ceil(Math.sqrt(totalItems)));
  const rows = Math.ceil(totalItems / cols);
  const col = itemIndex % cols;
  const row = Math.floor(itemIndex / cols);
  const stepX = (innerMaxX - innerMinX) / Math.max(1, cols - 1);
  const stepY = (innerMaxY - innerMinY) / Math.max(1, rows - 1);

  return {
    x: Math.round(innerMinX + col * stepX),
    y: Math.round(innerMinY + row * stepY)
  };
}

import { Item, Tent, Room } from '../../types/sim';
import { getAttachedPosition } from '../../utils/equipmentLinks';

/**
 * 3D world mapping. One world unit = 1 foot.
 * Room floor coordinates map as: room x → world X, room y → world Z, elevation z → world Y (up).
 * The room's back-left floor corner is the world origin.
 */
export type Vec3 = [number, number, number];

/** Tent back-left corner in world space, kept inside the room's floor. */
export function tentWorldOrigin(tent: Tent, room: Room): Vec3 {
  const pos = tent.position || { x: 1, y: 1, z: 0 };
  const maxX = Math.max(0, room.dimensions.length - tent.dimensions.length);
  const maxZ = Math.max(0, room.dimensions.width - tent.dimensions.width);
  return [Math.min(maxX, Math.max(0, pos.x)), pos.z || 0, Math.min(maxZ, Math.max(0, pos.y))];
}

/**
 * World position of an item's footprint center at its base elevation.
 * Items without a saved position fall back to the center of their container.
 */
export function itemWorldPosition(item: Item, room: Room, tent?: Tent): Vec3 {
  const container = tent ? tent.dimensions : room.dimensions;
  // Attached heat mats follow whatever they sit under / are wrapped around
  const pos = getAttachedPosition(item, tent ? tent.items : room.items, tent)
    || item.position
    || { x: container.length / 2, y: container.width / 2, z: 0 };
  if (!tent) return [pos.x, pos.z || 0, pos.y];
  const [tx, ty, tz] = tentWorldOrigin(tent, room);
  return [tx + pos.x, ty + (pos.z || 0), tz + pos.y];
}

/** Ceiling-mounted items (lights, duct fans) hang from their container's top. */
export function isCeilingMounted(item: Item, containerHeightFt: number): boolean {
  if (item.category === 'plant' && item.rackSlot) return false; // Sits on a rack shelf, however high
  const z = item.position?.z || 0;
  return z > 0 && z + item.dimensions.height >= containerHeightFt - 1.0;
}

/** Small deterministic pseudo-random generator so each plant keeps its own shape between frames. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import { Dimensions, EquipmentItem, Item, Position3D, RackSlot, RackTier, TrayInsertType } from '../types/sim';

/**
 * Grow racks: multi-tier shelves of standard 1020 trays (10" × 20"). Each shelf holds one or more
 * trays side by side along the rack's length, and every tray on a shelf uses the same insert
 * (cell plug tray or square pots). Each cell holds its own PlantItem, linked by `rackSlot`; its
 * position, cell size and container come from the rack (see syncRackedPlants in spatial.ts).
 *
 * Rack coordinates: position is the footprint center (like any item), trays run along the length
 * (x), the tray's short side runs across the width (y), and shelf 0 is the bottom one.
 */

const IN = 1 / 12;
const roundFt = (v: number) => Math.round(v * 1000) / 1000;

// Outer size of a 1020 tray: 10.75" × 21.5" × 2.5"
export const TRAY_1020 = { lengthFt: 21.5 * IN, widthFt: 10.75 * IN, heightFt: 2.5 * IN };

// Rack frame: posts / shelf lip around the trays, and the bottom shelf's height off the floor
const FRAME_MARGIN_FT = 0.1;
const BOTTOM_SHELF_FT = 4 * IN;
// Cells sit on the tray floor
const TRAY_FLOOR_FT = 0.25 * IN;

export interface TrayInsertSpec {
  label: string;
  kind: 'cell' | 'pot';
  cols: number;     // across the tray's 10" side
  rows: number;     // along the tray's 20" side
  cellSizeIn: number;  // top opening (square)
  depthIn: number;
}

export const TRAY_INSERTS: Record<TrayInsertType, TrayInsertSpec> = {
  cells_32: { label: '32-cell insert', kind: 'cell', cols: 4, rows: 8, cellSizeIn: 2.4, depthIn: 2.3 },
  cells_50: { label: '50-cell insert', kind: 'cell', cols: 5, rows: 10, cellSizeIn: 2.0, depthIn: 2.3 },
  cells_72: { label: '72-cell insert', kind: 'cell', cols: 6, rows: 12, cellSizeIn: 1.6, depthIn: 2.25 },
  cells_128: { label: '128-cell plug tray', kind: 'cell', cols: 8, rows: 16, cellSizeIn: 1.25, depthIn: 1.9 },
  cells_200: { label: '200-cell plug tray', kind: 'cell', cols: 10, rows: 20, cellSizeIn: 1.0, depthIn: 1.75 },
  pots_4in_8: { label: '8 × 4" square pots', kind: 'pot', cols: 2, rows: 4, cellSizeIn: 4, depthIn: 3.5 },
  pots_3_5in_18: { label: '18 × 3.5" square pots', kind: 'pot', cols: 3, rows: 6, cellSizeIn: 3.5, depthIn: 3.5 }
};

export const TRAY_INSERT_TYPES = Object.keys(TRAY_INSERTS) as TrayInsertType[];

export interface GrowRackPreset {
  name: string;
  tiers: number;
  traysPerTier: number;
  tierSpacingFt: number;
  insert: TrayInsertType;
}

export const GROW_RACK_PRESETS: GrowRackPreset[] = [
  { name: '5-Tier 1020 Seedling Rack', tiers: 5, traysPerTier: 1, tierSpacingFt: 1.0, insert: 'cells_72' },
  { name: '4-Tier Wire Shelf (48" × 18")', tiers: 4, traysPerTier: 2, tierSpacingFt: 1.5, insert: 'cells_72' },
  { name: '3-Tier Propagation Cart', tiers: 3, traysPerTier: 2, tierSpacingFt: 1.25, insert: 'pots_3_5in_18' }
];

export function isGrowRack(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && item.type === 'grow_rack';
}

export function createRackTiers(preset: Pick<GrowRackPreset, 'tiers' | 'traysPerTier' | 'insert'>): RackTier[] {
  return Array.from({ length: preset.tiers }, () => ({ trays: preset.traysPerTier, insert: preset.insert }));
}

export function getRackTiers(rack: EquipmentItem): RackTier[] {
  return rack.rackTiers && rack.rackTiers.length > 0 ? rack.rackTiers : [{ trays: 1, insert: 'cells_72' }];
}

export function getRackTierSpacingFt(rack: EquipmentItem): number {
  return Math.max(0.5, rack.rackTierSpacingFt || 1.0);
}

export function getInsertCellCount(insert: TrayInsertType): number {
  const spec = TRAY_INSERTS[insert];
  return spec.cols * spec.rows;
}

/** Root-zone volume of one cell / pot (gal); cells taper, so ~70% of the square prism. */
export function getInsertCellVolumeGallons(insert: TrayInsertType): number {
  const spec = TRAY_INSERTS[insert];
  return (spec.cellSizeIn * spec.cellSizeIn * spec.depthIn * 0.7) / 231;
}

export function getInsertCellDimensions(insert: TrayInsertType): Dimensions {
  const spec = TRAY_INSERTS[insert];
  const side = roundFt(spec.cellSizeIn * IN);
  return { length: side, width: side, height: roundFt(spec.depthIn * IN), unit: 'ft' };
}

/** Rack footprint and height: the widest shelf's trays plus the frame, shelves stacked at the spacing. */
export function getRackDimensions(rack: EquipmentItem): Dimensions {
  const tiers = getRackTiers(rack);
  const maxTrays = Math.max(1, ...tiers.map(t => t.trays));
  return {
    length: roundFt(maxTrays * TRAY_1020.lengthFt + FRAME_MARGIN_FT * 2),
    width: roundFt(TRAY_1020.widthFt + FRAME_MARGIN_FT * 2),
    height: roundFt(BOTTOM_SHELF_FT + tiers.length * getRackTierSpacingFt(rack)),
    unit: 'ft'
  };
}

/** Height of a shelf's surface above the rack's base (ft). */
export function getTierShelfHeightFt(rack: EquipmentItem, tier: number): number {
  return BOTTOM_SHELF_FT + tier * getRackTierSpacingFt(rack);
}

export function getTierCellCount(tier: RackTier): number {
  return tier.trays * getInsertCellCount(tier.insert);
}

export function getRackCapacity(rack: EquipmentItem): number {
  return getRackTiers(rack).reduce((sum, t) => sum + getTierCellCount(t), 0);
}

export function isValidRackSlot(rack: EquipmentItem, slot: RackSlot): boolean {
  const tier = getRackTiers(rack)[slot.tier];
  return !!tier && slot.tray >= 0 && slot.tray < tier.trays && slot.cell >= 0 && slot.cell < getInsertCellCount(tier.insert);
}

export function rackSlotKey(slot: Pick<RackSlot, 'tier' | 'tray' | 'cell'>): string {
  return `${slot.tier}:${slot.tray}:${slot.cell}`;
}

/** Base center of a cell / pot in the rack's container coordinates. */
export function getRackSlotPosition(rack: EquipmentItem, slot: RackSlot): Position3D {
  const tier = getRackTiers(rack)[slot.tier];
  const spec = TRAY_INSERTS[tier.insert];
  const base = rack.position || { x: 0, y: 0, z: 0 };
  const row = Math.floor(slot.cell / spec.cols);
  const col = slot.cell % spec.cols;
  const trayStartX = base.x - (tier.trays * TRAY_1020.lengthFt) / 2 + slot.tray * TRAY_1020.lengthFt;
  return {
    x: roundFt(trayStartX + ((row + 0.5) * TRAY_1020.lengthFt) / spec.rows),
    y: roundFt(base.y - TRAY_1020.widthFt / 2 + ((col + 0.5) * TRAY_1020.widthFt) / spec.cols),
    z: roundFt((base.z || 0) + getTierShelfHeightFt(rack, slot.tier) + TRAY_FLOOR_FT)
  };
}

/** Cell label within its tray: row letter along the 20" side, column number across, e.g. "C4". */
export function getCellLabel(insert: TrayInsertType, cell: number): string {
  const spec = TRAY_INSERTS[insert];
  return `${String.fromCharCode(65 + Math.floor(cell / spec.cols))}${(cell % spec.cols) + 1}`;
}

/** Short code for a slot, e.g. "S2-C4" (shelf 2) or "S2T1-C4" when the shelf holds several trays. */
export function getRackSlotCode(rack: EquipmentItem, slot: RackSlot): string {
  const tier = getRackTiers(rack)[slot.tier];
  if (!tier) return '?';
  return `S${slot.tier + 1}${tier.trays > 1 ? `T${slot.tray + 1}` : ''}-${getCellLabel(tier.insert, slot.cell)}`;
}

export function describeRackSlot(rack: EquipmentItem, slot: RackSlot): string {
  const tier = getRackTiers(rack)[slot.tier];
  if (!tier) return rack.name;
  const cell = getCellLabel(tier.insert, slot.cell);
  return `${rack.name} · shelf ${slot.tier + 1}${tier.trays > 1 ? `, tray ${slot.tray + 1}` : ''} · ${TRAY_INSERTS[tier.insert].kind} ${cell}`;
}

/** Plants on this rack, keyed by slot. */
export function getRackOccupancy(rack: EquipmentItem, items: Item[]): Map<string, Item> {
  const occupied = new Map<string, Item>();
  for (const item of items) {
    if (item.category === 'plant' && item.rackSlot?.rackId === rack.id) occupied.set(rackSlotKey(item.rackSlot), item);
  }
  return occupied;
}

/** Free slots in reading order, optionally limited to one shelf and / or one tray on it. */
export function getFreeRackSlots(rack: EquipmentItem, items: Item[], tier?: number, tray?: number): RackSlot[] {
  const occupied = getRackOccupancy(rack, items);
  const free: RackSlot[] = [];
  getRackTiers(rack).forEach((t, ti) => {
    if (tier !== undefined && ti !== tier) return;
    for (let tr = 0; tr < t.trays; tr++) {
      if (tray !== undefined && tr !== tray) continue;
      for (let c = 0; c < getInsertCellCount(t.insert); c++) {
        const slot = { rackId: rack.id, tier: ti, tray: tr, cell: c };
        if (!occupied.has(rackSlotKey(slot))) free.push(slot);
      }
    }
  });
  return free;
}

/** Count of plants on a given shelf (and tray). */
export function countRackPlants(rack: EquipmentItem, items: Item[], tier: number, tray?: number): number {
  let n = 0;
  for (const item of items) {
    if (item.category !== 'plant' || item.rackSlot?.rackId !== rack.id || item.rackSlot.tier !== tier) continue;
    if (tray === undefined || item.rackSlot.tray === tray) n++;
  }
  return n;
}

export function isRackedPlant(item: Item): boolean {
  return item.category === 'plant' && !!item.rackSlot;
}

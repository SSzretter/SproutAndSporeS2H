import { Dimensions, EquipmentItem, Item, Position3D, RackSlot, RackTier, TrayInsertType, Climate, PlantStage } from '../types/sim';

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
// Standard 1020 propagation dome: 7" tall (or 2.5" low dome)
export const TRAY_1020 = {
  lengthFt: 21.5 * IN, // 1.7917 ft (21.5 inches along long side)
  widthFt: 10.75 * IN,  // 0.8958 ft (10.75 inches along short side)
  heightFt: 2.5 * IN,   // 0.2083 ft (2.5 inches tray depth)
  domeHeightFt: 7.0 * IN // 0.5833 ft (7.0 inches standard propagation dome)
};

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
  cells_18: { label: '18-cell jumbo insert', kind: 'cell', cols: 3, rows: 6, cellSizeIn: 3.0, depthIn: 3.0 },
  cells_24: { label: '24-cell insert', kind: 'cell', cols: 4, rows: 6, cellSizeIn: 2.5, depthIn: 2.5 },
  cells_32: { label: '32-cell insert', kind: 'cell', cols: 4, rows: 8, cellSizeIn: 2.4, depthIn: 2.3 },
  cells_50: { label: '50-cell insert', kind: 'cell', cols: 5, rows: 10, cellSizeIn: 2.0, depthIn: 2.3 },
  cells_72: { label: '72-cell insert', kind: 'cell', cols: 6, rows: 12, cellSizeIn: 1.6, depthIn: 2.25 },
  cells_98: { label: '98-site rockwool sheet', kind: 'cell', cols: 7, rows: 14, cellSizeIn: 1.4, depthIn: 1.5 },
  cells_128: { label: '128-cell plug tray', kind: 'cell', cols: 8, rows: 16, cellSizeIn: 1.25, depthIn: 1.9 },
  cells_200: { label: '200-cell plug tray', kind: 'cell', cols: 10, rows: 20, cellSizeIn: 1.0, depthIn: 1.75 },
  pots_4in_8: { label: '8 × 4" square pots', kind: 'pot', cols: 2, rows: 4, cellSizeIn: 4, depthIn: 3.5 },
  pots_3_5in_18: { label: '18 × 3.5" square pots', kind: 'pot', cols: 3, rows: 6, cellSizeIn: 3.5, depthIn: 3.5 },
  microgreens_mesh: { label: 'Open 1020 flood mat / mesh', kind: 'cell', cols: 1, rows: 1, cellSizeIn: 10.0, depthIn: 1.5 }
};

export const TRAY_INSERT_TYPES = Object.keys(TRAY_INSERTS) as TrayInsertType[];

export interface GrowRackPreset {
  name: string;
  tiers: number;
  traysPerTier: number;
  tierSpacingFt: number;
  insert: TrayInsertType;
  rackType?: 'standard' | 'ebb_and_flow';
  trayLayout?: 'side_by_side' | 'end_to_end';
  integratedReservoirL?: number;
  floodsPerDay?: number;
  desc?: string;
}

export const GROW_RACK_PRESETS: GrowRackPreset[] = [
  {
    name: 'AC Infinity 2-Tier Propagation Shelf (36" × 24")',
    tiers: 2,
    traysPerTier: 3,
    tierSpacingFt: 0.85,
    insert: 'cells_72',
    rackType: 'standard',
    trayLayout: 'side_by_side',
    desc: '2-tier propagation rack engineered for 36" × 24" × 24" (3x2x2) tents. Fits 3 1020 trays on bottom and 3 on top (6 trays total).'
  },
  {
    name: 'Rootrimmer 5-Level Ebb & Flow Unit',
    tiers: 5,
    traysPerTier: 1,
    tierSpacingFt: 1.0,
    insert: 'cells_72',
    rackType: 'ebb_and_flow',
    integratedReservoirL: 60,
    floodsPerDay: 6,
    desc: '5 vertical flood levels (5 × 1020 trays) with automated flood manifold & bottom tank'
  },
  {
    name: 'Commercial 4-Tier Ebb & Flow Rack (48" × 24")',
    tiers: 4,
    traysPerTier: 2,
    tierSpacingFt: 1.5,
    insert: 'cells_50',
    rackType: 'ebb_and_flow',
    integratedReservoirL: 100,
    floodsPerDay: 4,
    desc: 'Heavy-duty 4-tier rack holding 8 total 1020 flood trays for high-throughput ebb & flow'
  },
  {
    name: '5-Tier 1020 Seedling Rack',
    tiers: 5,
    traysPerTier: 1,
    tierSpacingFt: 1.0,
    insert: 'cells_72',
    rackType: 'standard',
    desc: 'Standard 5-shelf wire frame holding 5 1020 flat trays for seed starting'
  },
  {
    name: '4-Tier Wire Shelf (48" × 18")',
    tiers: 4,
    traysPerTier: 2,
    tierSpacingFt: 1.5,
    insert: 'cells_72',
    rackType: 'standard',
    desc: 'Standard commercial wire shelf holding 8 1020 trays'
  },
  {
    name: '3-Tier Propagation Cart',
    tiers: 3,
    traysPerTier: 2,
    tierSpacingFt: 1.25,
    insert: 'pots_3_5in_18',
    rackType: 'standard',
    desc: 'Caster-mounted nursery rack with square pots'
  }
];

export function isGrowRack(item: Item): item is EquipmentItem {
  return item.category === 'equipment' && item.type === 'grow_rack';
}

export function isEbbAndFlowRack(eq: EquipmentItem): boolean {
  return isGrowRack(eq) && eq.rackType === 'ebb_and_flow';
}

export function getRack1020TrayCount(rack: EquipmentItem): number {
  const tiers = getRackTiers(rack);
  return tiers.reduce((sum, t) => sum + (t.trays || 1), 0);
}

export function createRackTiers(preset: Pick<GrowRackPreset, 'tiers' | 'traysPerTier' | 'insert'>): RackTier[] {
  return Array.from({ length: preset.tiers }, () => ({
    trays: preset.traysPerTier,
    insert: preset.insert,
    domes: Array(preset.traysPerTier).fill(false),
    domeVentsOpen: Array(preset.traysPerTier).fill(false),
    domeHeightsIn: Array(preset.traysPerTier).fill(7)
  }));
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
  const isSideBySide = rack.trayLayout === 'side_by_side';
  const trayLenX = isSideBySide ? TRAY_1020.widthFt : TRAY_1020.lengthFt;
  const trayWidY = isSideBySide ? TRAY_1020.lengthFt : TRAY_1020.widthFt;
  return {
    length: roundFt(maxTrays * trayLenX + FRAME_MARGIN_FT * 2),
    width: roundFt(trayWidY + FRAME_MARGIN_FT * 2),
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
  const isSideBySide = rack.trayLayout === 'side_by_side';

  const trayLenX = isSideBySide ? TRAY_1020.widthFt : TRAY_1020.lengthFt;
  const trayWidY = isSideBySide ? TRAY_1020.lengthFt : TRAY_1020.widthFt;
  const trayStartX = base.x - (tier.trays * trayLenX) / 2 + slot.tray * trayLenX;

  const row = Math.floor(slot.cell / spec.cols);
  const col = slot.cell % spec.cols;

  let cellX = 0;
  let cellY = 0;
  if (isSideBySide) {
    // 10.75" side is across X (col: 0..cols-1)
    // 21.5" side is along Y (row: 0..rows-1)
    cellX = trayStartX + ((col + 0.5) * trayLenX) / spec.cols;
    cellY = base.y - trayWidY / 2 + ((row + 0.5) * trayWidY) / spec.rows;
  } else {
    // 21.5" side is along X (row: 0..rows-1)
    // 10.75" side is across Y (col: 0..cols-1)
    cellX = trayStartX + ((row + 0.5) * trayLenX) / spec.rows;
    cellY = base.y - trayWidY / 2 + ((col + 0.5) * trayWidY) / spec.cols;
  }

  return {
    x: roundFt(cellX),
    y: roundFt(cellY),
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

// ---------------------------------------------------------------------------
// Humidity Dome per 1020 Tray Helpers & Microclimate Physics
// ---------------------------------------------------------------------------

export function isTrayDomed(rack: EquipmentItem, tierIndex: number, trayIndex: number): boolean {
  const tier = rack.rackTiers?.[tierIndex];
  return !!tier?.domes?.[trayIndex];
}

export function isTrayDomeVented(rack: EquipmentItem, tierIndex: number, trayIndex: number): boolean {
  const tier = rack.rackTiers?.[tierIndex];
  return !!tier?.domeVentsOpen?.[trayIndex];
}

export function setTrayDome(
  rack: EquipmentItem,
  tierIndex: number,
  trayIndex: number,
  domed: boolean,
  ventOpen: boolean = false
): EquipmentItem {
  const tiers = getRackTiers(rack);
  const nextTiers = tiers.map((t, ti) => {
    if (ti !== tierIndex) return t;
    const domes = [...(t.domes || [])];
    while (domes.length < t.trays) domes.push(false);
    domes[trayIndex] = domed;

    const domeVentsOpen = [...(t.domeVentsOpen || [])];
    while (domeVentsOpen.length < t.trays) domeVentsOpen.push(false);
    domeVentsOpen[trayIndex] = ventOpen;

    const domeHeightsIn = [...(t.domeHeightsIn || [])];
    while (domeHeightsIn.length < t.trays) domeHeightsIn.push(7);
    if (domed && !domeHeightsIn[trayIndex]) domeHeightsIn[trayIndex] = 7;

    return { ...t, domes, domeVentsOpen, domeHeightsIn };
  });
  return { ...rack, rackTiers: nextTiers };
}

export interface TrayMicroclimate {
  hasDome: boolean;
  ventsOpen: boolean;
  tempF: number;
  rh: number;
  vpdKpa: number;
  lightPPFD: number;
  soilMoistureEvapMultiplier: number;
  tierElevationFt: number;
  conductedMatHeatF: number;
  statusLabel: string;
  warning?: string;
  isOverheating: boolean;
  isDampingOffRisk: boolean;
}

function calcSimpleVPD(tempF: number, rh: number, lightPPFD: number = 0): number {
  const tempC = ((tempF - 32) * 5) / 9;
  const leafOffsetC = lightPPFD > 50 ? -1.8 : -0.2;
  const leafTempC = tempC + leafOffsetC;
  const svpLeaf = 0.61078 * Math.exp((17.27 * leafTempC) / (leafTempC + 237.3));
  const avpAir = (0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3))) * (Math.max(0, Math.min(100, rh)) / 100);
  return Math.max(0.01, parseFloat((svpLeaf - avpAir).toFixed(2)));
}

/**
 * Calculates the exact microclimate inside an individual 1020 tray based on:
 * - Shelf height (tier 0 near floor heat mat vs tier 1 near ceiling lights)
 * - Heat mat conduction
 * - Overhead light PPFD & shelf shading
 * - Humidity dome moisture retention (88-96% closed vs 75-85% vented)
 * - Greenhouse solar oven effect under lighting
 * - Damping-off and thermal shock risk indicators
 */
export function calculateTrayMicroclimate(params: {
  rack: EquipmentItem;
  tierIndex: number;
  trayIndex: number;
  ambientClimate: Climate;
  floorHeatMatActive: boolean;
  floorHeatMatRiseF?: number;
  overheadLightPpfd?: number;
  plantStage?: PlantStage;
}): TrayMicroclimate {
  const {
    rack,
    tierIndex,
    trayIndex,
    ambientClimate,
    floorHeatMatActive,
    floorHeatMatRiseF = 8,
    overheadLightPpfd = 0,
    plantStage
  } = params;

  const tiers = getRackTiers(rack);
  const tier = tiers[tierIndex] || tiers[0];
  const hasDome = !!tier?.domes?.[trayIndex];
  const ventsOpen = !!tier?.domeVentsOpen?.[trayIndex];

  // 1. Height & Heat Mat Gradient:
  // Tier 0 is at bottom (shelf height ~0.33ft = 4"), receiving 85% conducted warmth from a floor heat mat.
  // Tier 1 is higher up (~1.18ft), receiving only 20% residual convective warmth.
  const tierElevationFt = getTierShelfHeightFt(rack, tierIndex);
  const matShare = tierIndex === 0 ? 0.85 : 0.20;
  const conductedMatHeatF = floorHeatMatActive ? floorHeatMatRiseF * matShare : 0;

  // 2. Light distribution by tier height:
  // Top tier receives direct overhead light; lower tiers receive ~30% PPFD due to shelf shading.
  const isTopTier = tierIndex === tiers.length - 1;
  const effectivePpfd = isTopTier ? overheadLightPpfd : Math.round(overheadLightPpfd * 0.3);

  // 3. Ambient temperature & dome greenhouse effect:
  let effectiveTempF = ambientClimate.tempF + conductedMatHeatF;
  let effectiveRh = ambientClimate.rh;

  let warning: string | undefined;
  let isOverheating = false;
  let isDampingOffRisk = false;

  if (hasDome) {
    if (ventsOpen) {
      // Vents cracked open: humidity elevated to 75% - 85% RH, slight air exchange
      effectiveRh = Math.min(88, Math.max(75, ambientClimate.rh + 22));
      effectiveTempF += 1.5;
    } else {
      // Vents closed: sealed moisture trap (88% - 96% RH)
      effectiveRh = Math.min(96, Math.max(88, ambientClimate.rh + 36));
      effectiveTempF += 3.0;
    }

    // Solar greenhouse oven effect under strong light:
    if (effectivePpfd > 120) {
      const solarRise = Math.min(8, (effectivePpfd - 120) * 0.035);
      effectiveTempF += solarRise;
    }

    // Check Negative Scenarios:
    // A. Overheating:
    if (effectiveTempF > 88) {
      isOverheating = true;
      warning = `Greenhouse overheating under dome (${effectiveTempF.toFixed(1)}°F > 88°F)! Crack vents open or dim/raise lights.`;
    }

    // B. Damping-Off Fungal Risk:
    // When seedlings have emerged (cotyledons/first leaves) and dome is still on with high humidity
    if ((plantStage === 'seedling' || plantStage === 'mature_seedling' || plantStage === 'vegetative') && !ventsOpen) {
      isDampingOffRisk = true;
      warning = `High damping-off fungal risk! Seedling emerged under closed dome. Open vents or remove dome to prevent stem rot.`;
    } else if ((plantStage === 'seedling' || plantStage === 'mature_seedling') && ventsOpen && effectiveRh > 80) {
      isDampingOffRisk = true;
      warning = `Transition to open air: Seedlings require moderate humidity (65-70%) to build sturdy vascular stems.`;
    }
  }

  const vpdKpa = calcSimpleVPD(effectiveTempF, effectiveRh, effectivePpfd);
  const soilMoistureEvapMultiplier = hasDome ? (ventsOpen ? 0.35 : 0.15) : 1.0;

  let statusLabel = 'Ambient Enclosure';
  if (hasDome) {
    statusLabel = ventsOpen ? 'Dome (Vented Microclimate)' : 'Dome (Sealed Microclimate)';
  }

  return {
    hasDome,
    ventsOpen,
    tempF: parseFloat(effectiveTempF.toFixed(1)),
    rh: Math.round(effectiveRh),
    vpdKpa,
    lightPPFD: effectivePpfd,
    soilMoistureEvapMultiplier,
    tierElevationFt,
    conductedMatHeatF: parseFloat(conductedMatHeatF.toFixed(1)),
    statusLabel,
    warning,
    isOverheating,
    isDampingOffRisk
  };
}

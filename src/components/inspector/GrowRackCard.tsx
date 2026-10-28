import React from 'react';
import { Layers, Plus, Minus, Sprout } from 'lucide-react';
import { EquipmentItem, PlantItem, PlantStage, RackTier, TrayInsertType } from '../../types/sim';
import {
  countRackPlants, getCellLabel, getInsertCellCount, getRackCapacity, getRackOccupancy, getRackTiers,
  getRackTierSpacingFt, rackSlotKey, TRAY_INSERTS, TRAY_INSERT_TYPES
} from '../../utils/growRacks';
import type { ItemSectionProps, EquipmentLocals } from './types';

// Cell colors in the tray map, by growth stage
const STAGE_CELL_COLOR: Record<PlantStage, string> = {
  germination: 'bg-amber-700',
  rooting: 'bg-amber-700',
  seedling: 'bg-lime-600',
  mature_seedling: 'bg-green-500',
  vegetative: 'bg-emerald-500',
  flowering: 'bg-fuchsia-500',
  ripening: 'bg-orange-500',
  ready: 'bg-yellow-400'
};

export const GrowRackCard: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, onUpdateItem, onSelectItem, onOpenAddItem, eq } = props;
  if (eq.type !== 'grow_rack') return null;

  const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
  const containerItems = hostTent ? hostTent.items : room.items;
  const tiers = getRackTiers(eq);
  const occupancy = getRackOccupancy(eq, containerItems);
  const capacity = getRackCapacity(eq);

  const setTiers = (next: RackTier[]) => onUpdateItem({ ...eq, rackTiers: next } as EquipmentItem, selectedParentTentId);
  const updateTier = (index: number, patch: Partial<RackTier>) => setTiers(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  const topOccupied = countRackPlants(eq, containerItems, tiers.length - 1) > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">{tiers.length} shelves · {tiers.reduce((n, t) => n + t.trays, 0)} trays (1020)</span>
        </div>
        <span className="font-mono text-xs font-bold text-emerald-400">{occupancy.size} / {capacity} sown</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
        <label className="flex items-center gap-2">
          <span>Shelf spacing</span>
          <input
            type="number"
            min="0.5"
            max="3"
            step="0.25"
            value={getRackTierSpacingFt(eq)}
            onChange={e => onUpdateItem({ ...eq, rackTierSpacingFt: Math.max(0.5, Math.min(3, parseFloat(e.target.value) || 1)) }, selectedParentTentId)}
            className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-200"
          />
          <span className="text-zinc-500">ft</span>
        </label>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setTiers([...tiers, { ...tiers[tiers.length - 1] }])}
            disabled={tiers.length >= 8}
            className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1 disabled:opacity-40"
          >
            <Plus className="w-3 h-3" /> Shelf
          </button>
          <button
            type="button"
            onClick={() => setTiers(tiers.slice(0, -1))}
            disabled={tiers.length <= 1 || topOccupied}
            title={topOccupied ? 'The top shelf still has plants on it' : undefined}
            className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1 disabled:opacity-40"
          >
            <Minus className="w-3 h-3" /> Shelf
          </button>
          <button
            type="button"
            onClick={() => onOpenAddItem(selectedParentTentId || undefined, eq.id)}
            disabled={occupancy.size >= capacity}
            className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] flex items-center gap-1 disabled:opacity-40"
          >
            <Sprout className="w-3 h-3" /> Sow Seeds
          </button>
        </div>
      </div>

      {/* Shelves, top shelf first like the real rack */}
      <div className="space-y-2.5">
        {tiers.map((tier, ti) => ({ tier, ti })).reverse().map(({ tier, ti }) => {
          const spec = TRAY_INSERTS[tier.insert];
          const sown = countRackPlants(eq, containerItems, ti);
          const lastTrayOccupied = countRackPlants(eq, containerItems, ti, tier.trays - 1) > 0;
          return (
            <div key={ti} className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-2.5 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                <span className="font-semibold text-zinc-100">Shelf {ti + 1}</span>
                <select
                  value={tier.insert}
                  disabled={sown > 0}
                  title={sown > 0 ? 'Empty this shelf before changing its insert' : undefined}
                  onChange={e => updateTier(ti, { insert: e.target.value as TrayInsertType })}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-60"
                >
                  {TRAY_INSERT_TYPES.map(t => (
                    <option key={t} value={t}>{TRAY_INSERTS[t].label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateTier(ti, { trays: tier.trays - 1 })}
                    disabled={tier.trays <= 1 || lastTrayOccupied}
                    className="p-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
                    title={lastTrayOccupied ? 'The last tray still has plants in it' : 'Remove a tray'}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono">{tier.trays} tray{tier.trays > 1 ? 's' : ''}</span>
                  <button
                    type="button"
                    onClick={() => updateTier(ti, { trays: tier.trays + 1 })}
                    disabled={tier.trays >= 4}
                    className="p-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
                    title="Add a tray"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="ml-auto font-mono text-emerald-400">{sown} / {tier.trays * getInsertCellCount(tier.insert)}</span>
              </div>

              {/* Tray maps: the 20" side runs left to right */}
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: tier.trays }, (_, tr) => (
                  <div
                    key={tr}
                    className="grid gap-px bg-zinc-800 p-px rounded"
                    style={{ gridTemplateColumns: `repeat(${spec.rows}, minmax(0, 1fr))`, width: `${Math.min(220, spec.rows * 14)}px` }}
                  >
                    {Array.from({ length: spec.cols * spec.rows }, (_, i) => {
                      // Display row = column across the tray, display column = row along it
                      const cell = (i % spec.rows) * spec.cols + Math.floor(i / spec.rows);
                      const plant = occupancy.get(rackSlotKey({ tier: ti, tray: tr, cell })) as PlantItem | undefined;
                      const label = getCellLabel(tier.insert, cell);
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={!plant}
                          onClick={() => plant && onSelectItem(plant.id, selectedParentTentId)}
                          title={plant ? `${label}: ${plant.name} · ${plant.stage.replace('_', ' ')} · ${plant.health}% health` : `${label}: empty`}
                          className={`aspect-square ${plant ? `${STAGE_CELL_COLOR[plant.stage]} hover:ring-1 hover:ring-white ${plant.health < 50 ? 'opacity-50' : ''}` : 'bg-zinc-950'}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <span className="text-[10px] text-zinc-500 block">
        Click a cell to inspect that plant. Each cell is its own plant with its own genetics; pot up keepers from their inspector.
      </span>
    </div>
  );
};

import React from 'react';
import { Layers, Plus, Minus, Sprout, Waves, Droplets, Shield, Wind, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { EquipmentItem, PlantItem, PlantStage, RackTier, TrayInsertType } from '../../types/sim';
import {
  countRackPlants, getCellLabel, getInsertCellCount, getRackCapacity, getRackOccupancy, getRackTiers,
  getRackTierSpacingFt, isEbbAndFlowRack, rackSlotKey, TRAY_INSERTS, TRAY_INSERT_TYPES,
  GROW_RACK_PRESETS, createRackTiers, getRackDimensions, isTrayDomed, isTrayDomeVented, setTrayDome,
  calculateTrayMicroclimate, isTrayWet, mistRackTray, getRackTrayLayout, describeTrayLayout, DEFAULT_BOTTOM_SHELF_FT
} from '../../utils/growRacks';
import { CommitNumberInput } from '../CommitNumberInput';
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
  const { room, selectedParentTentId, onUpdateItem, onSelectItem, onOpenAddItem, eq, simTime = Date.now() } = props;
  if (eq.type !== 'grow_rack') return null;

  const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
  const containerItems = hostTent ? hostTent.items : room.items;
  const tiers = getRackTiers(eq);
  const occupancy = getRackOccupancy(eq, containerItems);
  const capacity = getRackCapacity(eq);
  const isEbb = isEbbAndFlowRack(eq);
  const total1020Trays = tiers.reduce((n, t) => n + t.trays, 0);
  const isSideBySide = getRackTrayLayout(eq) === 'side_by_side';
  const dims = getRackDimensions(eq);
  const ambientClimate = hostTent ? hostTent.climate : room.climate;
  const hasFloorHeatMat = containerItems.some(i => i.category === 'equipment' && i.type === 'heat_mat' && i.powerOn);

  const setTiers = (next: RackTier[]) => {
    const updated = { ...eq, rackTiers: next } as EquipmentItem;
    onUpdateItem({ ...updated, dimensions: getRackDimensions(updated) }, selectedParentTentId);
  };

  const updateTier = (index: number, patch: Partial<RackTier>) => {
    setTiers(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  // Mist one tray: the rack records it and every sown cell's surface gets damper
  const handleMistTray = (tierIndex: number, trayIndex: number) => {
    const misted = mistRackTray(eq.id, containerItems, tierIndex, trayIndex, simTime);
    misted.forEach((item, i) => {
      if (item !== containerItems[i]) onUpdateItem(item, selectedParentTentId);
    });
  };

  const topOccupied = countRackPlants(eq, containerItems, tiers.length - 1) > 0;

  const handleManualFlood = () => {
    // Water every plant currently on this rack
    const rackedPlantIds = new Set(
      containerItems
        .filter((i): i is PlantItem => i.category === 'plant' && i.rackSlot?.rackId === eq.id)
        .map(p => p.id)
    );

    rackedPlantIds.forEach(id => {
      const p = containerItems.find(i => i.id === id) as PlantItem;
      if (p) {
        onUpdateItem({
          ...p,
          soilMoisture: 92,
          ecTdsPpm: 900,
          soilPh: 5.8,
          aerationOxygenPct: 90,
          rootTempF: 68.0,
          lastWateredTime: Date.now()
        }, selectedParentTentId);
      }
    });

    onUpdateItem({
      ...eq,
      notes: `${eq.notes ? eq.notes + ' · ' : ''}Manual flood cycle executed.`
    }, selectedParentTentId);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-3">
      {/* Rack Header & Footprint Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-zinc-100">{eq.name}</h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {dims.length}′ × {dims.width}′ × {dims.height}′
            </span>
          </div>
          <p className="text-[10px] text-zinc-400">
            {tiers.length} levels · {total1020Trays} × 1020 trays · {isSideBySide ? 'Side-by-Side' : 'End-to-End'} ({describeTrayLayout(getRackTrayLayout(eq), tiers[0]?.trays || 1)})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-emerald-400">{occupancy.size} / {capacity} sown</span>
        </div>
      </div>

      {/* Quick Preset Selector */}
      <div className="space-y-1">
        <label className="text-[10px] font-mono uppercase text-zinc-400 block">Quick Rack Presets:</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {GROW_RACK_PRESETS.map(p => {
            const isMatch = eq.name === p.name || (tiers.length === p.tiers && tiers[0]?.trays === p.traysPerTier && getRackTrayLayout(eq) === getRackTrayLayout(p));
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  const nextEq: EquipmentItem = {
                    ...eq,
                    name: p.name,
                    trayLayout: getRackTrayLayout(p),
                    rackTierSpacingFt: p.tierSpacingFt,
                    rackBottomShelfFt: p.bottomShelfFt ?? DEFAULT_BOTTOM_SHELF_FT,
                    rackType: p.rackType || 'standard',
                    integratedReservoirL: p.integratedReservoirL,
                    ebbFlowFloodsPerDay: p.floodsPerDay,
                    rackTiers: createRackTiers({ tiers: p.tiers, traysPerTier: p.traysPerTier, insert: p.insert })
                  };
                  onUpdateItem({ ...nextEq, dimensions: getRackDimensions(nextEq) }, selectedParentTentId);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  isMatch
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
                }`}
              >
                {p.name.includes('Propagation') ? 'AC Infinity 3x2 (2-Tier · 6 Trays)' : p.name.split('(')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Architecture Controls: Orientation & Shelf Spacing */}
      <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-300 font-semibold">1020 Orientation:</span>
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  const updated = { ...eq, trayLayout: 'side_by_side' as const };
                  onUpdateItem({ ...updated, dimensions: getRackDimensions(updated) }, selectedParentTentId);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                  isSideBySide ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...eq, trayLayout: 'end_to_end' as const };
                  onUpdateItem({ ...updated, dimensions: getRackDimensions(updated) }, selectedParentTentId);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                  !isSideBySide ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                End-to-End
              </button>
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-zinc-300">
            <span className="text-[11px] text-zinc-400">Shelf Spacing:</span>
            <CommitNumberInput
              min={0.5}
              max={3}
              step={0.05}
              value={getRackTierSpacingFt(eq)}
              onCommit={val => {
                const updated = { ...eq, rackTierSpacingFt: val };
                onUpdateItem({ ...updated, dimensions: getRackDimensions(updated) }, selectedParentTentId);
              }}
              className="w-16 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-xs font-mono text-zinc-200 text-center"
            />
            <span className="text-zinc-500 text-[11px]">ft</span>
          </label>
        </div>

        {dims.length <= 3.05 && dims.width <= 2.05 && dims.height <= 2.05 && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Optimal Fit for AC Infinity 36" × 24" × 24" (3x2x2) Propagation Tent</span>
          </div>
        )}
      </div>

      {/* Ebb & Flow Flood Unit Badge & Banner */}
      {isEbb ? (
        <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-cyan-200">Ebb &amp; Flow Flood Unit ({total1020Trays} × 1020 Trays)</div>
              <div className="text-[10px] text-cyan-400">
                {eq.integratedReservoirL || 60}L bottom tank · {eq.ebbFlowFloodsPerDay || 6} floods/day (15m flood cycle)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualFlood}
            className="px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
          >
            <Droplets className="w-3.5 h-3.5" /> Run Flood Cycle
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onUpdateItem({
              ...eq,
              rackType: 'ebb_and_flow',
              integratedReservoirL: 60,
              ebbFlowIntegratedPump: true,
              ebbFlowFloodsPerDay: 6,
              ebbFlowFloodDurationMin: 15,
              powerWatts: 25
            }, selectedParentTentId)}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
          >
            <Waves className="w-3 h-3" /> Upgrade to Ebb &amp; Flow Flood Unit
          </button>
        </div>
      )}

      {/* Shelves & Trays Controls Bar */}
      <div className="flex items-center justify-between text-xs text-zinc-300 pt-1">
        <span className="font-semibold text-zinc-200">Shelves &amp; Individual 1020 Trays</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const newTier: RackTier = {
                trays: tiers[0]?.trays ?? 3,
                insert: tiers[0]?.insert ?? 'cells_72',
                domes: Array(tiers[0]?.trays ?? 3).fill(false),
                domeVentsOpen: Array(tiers[0]?.trays ?? 3).fill(false),
                domeHeightsIn: Array(tiers[0]?.trays ?? 3).fill(7)
              };
              setTiers([...tiers, newTier]);
            }}
            disabled={tiers.length >= 6}
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
            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40 ml-1"
          >
            <Sprout className="w-3.5 h-3.5" /> Sow Seeds
          </button>
        </div>
      </div>

      {/* Shelves List: Top shelf first like the physical rack */}
      <div className="space-y-3">
        {tiers.map((tier, ti) => ({ tier, ti })).reverse().map(({ tier, ti }) => {
          const spec = TRAY_INSERTS[tier.insert];
          const sown = countRackPlants(eq, containerItems, ti);
          const isTop = ti === tiers.length - 1;
          const isBottom = ti === 0;

          return (
            <div key={ti} className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 space-y-2.5">
              {/* Shelf Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-zinc-100">
                    Shelf {ti + 1}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {isBottom ? 'Bottom Level (Near Heat Mat / Floor)' : isTop ? 'Top Level (Near Overhead Light)' : 'Middle Shelf'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
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
                      onClick={() => updateTier(ti, { trays: Math.max(1, tier.trays - 1) })}
                      disabled={tier.trays <= 1 || countRackPlants(eq, containerItems, ti, tier.trays - 1) > 0}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-xs text-zinc-300">{tier.trays} trays</span>
                    <button
                      type="button"
                      onClick={() => updateTier(ti, { trays: Math.min(4, tier.trays + 1) })}
                      disabled={tier.trays >= 4}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Trays on this Shelf: Each tray rendered individually */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {Array.from({ length: tier.trays }, (_, tr) => {
                  const domed = isTrayDomed(eq, ti, tr);
                  const vented = isTrayDomeVented(eq, ti, tr);
                  const sownInTray = countRackPlants(eq, containerItems, ti, tr);
                  const trayMicro = calculateTrayMicroclimate({
                    rack: eq,
                    tierIndex: ti,
                    trayIndex: tr,
                    ambientClimate,
                    floorHeatMatActive: hasFloorHeatMat,
                    overheadLightPpfd: ambientClimate.lightPPFD,
                    hasWetMedia: isTrayWet(eq, containerItems, ti, tr),
                    simTime
                  });
                  const mistedAt = tier.mistedAt?.[tr];
                  const mistedMinAgo = mistedAt ? Math.max(0, Math.round((simTime - mistedAt) / 60000)) : null;

                  return (
                    <div
                      key={tr}
                      className={`rounded-lg border p-2.5 space-y-2 transition-all ${
                        domed
                          ? 'bg-indigo-950/30 border-indigo-700/50 ring-1 ring-indigo-500/30'
                          : 'bg-zinc-900/90 border-zinc-800'
                      }`}
                    >
                      {/* Tray Title Bar */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-zinc-200">Tray {tr + 1}</span>
                          <span className="text-[10px] font-mono text-zinc-400">({sownInTray}/{spec.cols * spec.rows})</span>
                        </div>
                        <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMistTray(ti, tr)}
                          title={mistedMinAgo === null ? 'Mist this tray: dampens the surface and raises humidity under the dome' : `Last misted ${mistedMinAgo < 120 ? `${mistedMinAgo} min` : `${Math.round(mistedMinAgo / 60)} h`} ago`}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-teal-300 hover:bg-teal-900/60 transition-all flex items-center gap-1"
                        >
                          <Droplets className="w-3 h-3" />
                          <span>Mist</span>
                        </button>
                        {/* Humidity Dome Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextEq = setTrayDome(eq, ti, tr, !domed, vented);
                            onUpdateItem(nextEq, selectedParentTentId);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all flex items-center gap-1 ${
                            domed
                              ? 'bg-indigo-700 text-white shadow-sm'
                              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{domed ? 'Dome: ON' : '+ Add Dome'}</span>
                        </button>
                        </div>
                      </div>

                      {/* Dome Controls & Microclimate Info */}
                      {domed && (
                        <div className="space-y-1.5 bg-indigo-950/50 p-2 rounded-lg border border-indigo-800/40 text-[10px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-indigo-200 font-medium flex items-center gap-1">
                              <Shield className="w-3 h-3 text-indigo-400" />
                              <span>7" Humidity Dome</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextEq = setTrayDome(eq, ti, tr, true, !vented);
                                onUpdateItem(nextEq, selectedParentTentId);
                              }}
                              className={`px-1.5 py-0.5 rounded font-mono transition-all flex items-center gap-1 ${
                                vented
                                  ? 'bg-sky-900 text-sky-200 border border-sky-700'
                                  : 'bg-indigo-900 text-indigo-200 border border-indigo-700'
                              }`}
                            >
                              <Wind className="w-2.5 h-2.5" />
                              <span>{vented ? 'Vents: OPEN' : 'Vents: CLOSED'}</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between font-mono text-[9px] text-indigo-300">
                            <span>Microclimate: {trayMicro.tempF}°F · {trayMicro.rh}% RH{mistedMinAgo !== null && mistedMinAgo < 24 * 60 ? ` · misted ${mistedMinAgo < 120 ? `${mistedMinAgo}m` : `${Math.round(mistedMinAgo / 60)}h`} ago` : ''}</span>
                            <span>{trayMicro.vpdKpa} kPa VPD</span>
                          </div>

                          {trayMicro.warning && (
                            <div className="text-[9px] text-amber-300 bg-amber-950/60 p-1 rounded border border-amber-800/50 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                              <span>{trayMicro.warning}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cell Grid Map */}
                      <div
                        className="grid gap-px bg-zinc-800 p-px rounded max-w-full overflow-x-auto"
                        style={{ gridTemplateColumns: `repeat(${spec.rows}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: spec.cols * spec.rows }, (_, i) => {
                          const cell = (i % spec.rows) * spec.cols + Math.floor(i / spec.rows);
                          const plant = occupancy.get(rackSlotKey({ tier: ti, tray: tr, cell })) as PlantItem | undefined;
                          const label = getCellLabel(tier.insert, cell);
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={!plant}
                              onClick={() => plant && onSelectItem(plant.id, selectedParentTentId)}
                              title={plant ? `${label}: ${plant.name} · ${plant.stage.replace('_', ' ')} · ${plant.health}% health${domed ? ' · Under Dome' : ''}` : `${label}: empty cell`}
                              className={`aspect-square min-w-[7px] ${
                                plant
                                  ? `${STAGE_CELL_COLOR[plant.stage]} hover:ring-1 hover:ring-white ${plant.health < 50 ? 'opacity-50' : ''}`
                                  : 'bg-zinc-950'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <span className="text-[10px] text-zinc-500 block">
        💡 Trays are individually domed. For seed germination, add a dome and keep vents closed for 90%+ RH. Once seedlings emerge, crack vents open or remove dome to prevent damping-off.
      </span>
    </div>
  );
};

import React from 'react';
import { Droplets, FlaskConical, Thermometer } from 'lucide-react';
import { EquipmentItem, PlantItem, ReservoirFeedTarget } from '../../types/sim';
import { getRackTiers, isGrowRack } from '../../utils/growRacks';
import {
  adjustToTargets, DEFAULT_NUTRIENT_EC_PPM, DEFAULT_NUTRIENT_PH, describeFeedTargets, getNutrientCapacityL, getNutrientLevelL,
  isNutrientReservoirEmpty, LOW_ROOT_OXYGEN_PCT, mixFreshSolution, RESERVOIR_FED_SYSTEMS, topOffWithWater
} from '../../utils/nutrientReservoirs';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const NutrientReservoirCard: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, simTime, onUpdateItem, onLogJournalEntry, eq } = props;
  if (eq.type !== 'nutrient_reservoir') return null;

  const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
  // Feed lines can run to the room floor or into any tent in the room
  const locations = [{ name: `${room.name} floor`, items: room.items }, ...room.tents.map(t => ({ name: t.name, items: t.items }))];
  const roomItems = locations.flatMap(l => l.items);
  const ambientF = (hostTent ?? room).climate.tempF;
  const capacity = getNutrientCapacityL(eq);
  const level = getNutrientLevelL(eq);
  const fill = level / capacity;
  const empty = isNutrientReservoirEmpty(eq);
  const flood = (eq.pumpMode ?? 'flood') === 'flood';
  const targets = eq.feedTargets ?? [];

  const update = (patch: Partial<EquipmentItem>) => onUpdateItem({ ...eq, ...patch }, selectedParentTentId);
  const log = (title: string, message: string) => onLogJournalEntry?.({ title, message, type: 'action', category: 'care' });

  // Feed lines: a rack's line can reach every shelf or chosen shelves; plants get their own line
  const racks = locations.flatMap(l => l.items.filter(isGrowRack).map(rack => ({ rack, where: l.name })));
  const plants = locations.flatMap(l => l.items
    .filter((i): i is PlantItem => i.category === 'plant' && !i.rackSlot && !i.isHarvested)
    .map(plant => ({ plant, where: l.name })));
  const setTargets = (next: ReservoirFeedTarget[]) => update({ feedTargets: next });
  const rackWhole = (rackId: string) => targets.some(t => t.id === rackId && t.tier === undefined);
  const shelfFed = (rackId: string, tier: number) => rackWhole(rackId) || targets.some(t => t.id === rackId && t.tier === tier);
  const toggleShelf = (rackId: string, tier: number, shelves: number) => {
    const fed = Array.from({ length: shelves }, (_, i) => shelfFed(rackId, i) !== (i === tier));
    const others = targets.filter(t => t.id !== rackId);
    if (fed.every(Boolean)) setTargets([...others, { id: rackId }]);
    else setTargets([...others, ...fed.flatMap((on, i) => (on ? [{ id: rackId, tier: i }] : []))]);
  };

  const ecOk = (eq.nutrientEcPpm ?? 0) >= 400 && (eq.nutrientEcPpm ?? 0) <= 1800;
  const phOk = (eq.nutrientPh ?? 7) >= 5.5 && (eq.nutrientPh ?? 7) <= 6.5;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-3">
      {/* Tank */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-300">
          <span className="flex items-center gap-1.5 font-semibold"><Droplets className="w-3.5 h-3.5 text-sky-400" /> Nutrient Solution</span>
          <span className={`font-mono font-bold ${empty ? 'text-rose-400' : fill < 0.25 ? 'text-amber-400' : 'text-sky-300'}`}>
            {level.toFixed(1)} / {capacity} L {empty ? '· EMPTY' : `(${Math.round(fill * 100)}%)`}
          </span>
        </div>
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${empty ? 'bg-rose-500' : fill < 0.25 ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${fill * 100}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="bg-zinc-950 rounded-lg p-1.5 text-center">
            <span className="block text-zinc-500 text-[9px] uppercase font-mono">EC</span>
            <span className={`font-mono font-bold ${ecOk ? 'text-emerald-400' : 'text-amber-400'}`}>{Math.round(eq.nutrientEcPpm ?? 0)} ppm</span>
          </div>
          <div className="bg-zinc-950 rounded-lg p-1.5 text-center">
            <span className="block text-zinc-500 text-[9px] uppercase font-mono">pH</span>
            <span className={`font-mono font-bold ${phOk ? 'text-emerald-400' : 'text-amber-400'}`}>{(eq.nutrientPh ?? DEFAULT_NUTRIENT_PH).toFixed(2)}</span>
          </div>
          <div className="bg-zinc-950 rounded-lg p-1.5 text-center">
            <span className="block text-zinc-500 text-[9px] uppercase font-mono">Water</span>
            <span className={`font-mono font-bold ${(eq.reservoirTempF ?? ambientF) > 74 ? 'text-amber-400' : 'text-zinc-200'}`}>{(eq.reservoirTempF ?? ambientF).toFixed(1)}°F</span>
          </div>
        </div>
        <div className="flex justify-between text-[11px] text-zinc-400">
          <span>Dissolved oxygen</span>
          <span className={`font-mono font-bold ${(eq.dissolvedOxygenPct ?? 100) < LOW_ROOT_OXYGEN_PCT ? 'text-rose-400' : (eq.dissolvedOxygenPct ?? 100) < 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {Math.round(eq.dissolvedOxygenPct ?? 100)}%
          </span>
        </div>
        <span className="text-[10px] text-zinc-500 block">
          Plants are drinking {((eq.waterFlowLph ?? 0) * 24).toFixed(2)} L/day. EC climbs as they take more water than salts; pH drifts up over days.
        </span>
      </div>

      {/* Mix targets & actions */}
      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300"><FlaskConical className="w-3.5 h-3.5 text-violet-400" /> Mix Targets</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
          <label className="space-y-1">
            <span className="flex justify-between">EC <span className="font-mono text-zinc-200">{eq.nutrientTargetEcPpm ?? DEFAULT_NUTRIENT_EC_PPM} ppm</span></span>
            <input type="range" min="200" max="2400" step="50" value={eq.nutrientTargetEcPpm ?? DEFAULT_NUTRIENT_EC_PPM}
              onChange={e => update({ nutrientTargetEcPpm: parseInt(e.target.value) })} className="w-full accent-violet-500" />
          </label>
          <label className="space-y-1">
            <span className="flex justify-between">pH <span className="font-mono text-zinc-200">{(eq.nutrientTargetPh ?? DEFAULT_NUTRIENT_PH).toFixed(1)}</span></span>
            <input type="range" min="5.0" max="7.0" step="0.1" value={eq.nutrientTargetPh ?? DEFAULT_NUTRIENT_PH}
              onChange={e => update({ nutrientTargetPh: parseFloat(e.target.value) })} className="w-full accent-violet-500" />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button"
            onClick={() => { onUpdateItem(mixFreshSolution(eq, simTime), selectedParentTentId); log(`🧪 Fresh solution: ${eq.name}`, `Dumped and refilled ${capacity} L at ${eq.nutrientTargetEcPpm ?? DEFAULT_NUTRIENT_EC_PPM} ppm, pH ${(eq.nutrientTargetPh ?? DEFAULT_NUTRIENT_PH).toFixed(1)}.`); }}
            className="px-2 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-[11px] font-semibold">
            Change &amp; Mix Fresh
          </button>
          <button type="button" disabled={level >= capacity - 0.05}
            onClick={() => { onUpdateItem(topOffWithWater(eq, ambientF), selectedParentTentId); log(`💧 Topped off: ${eq.name}`, `Added ${(capacity - level).toFixed(1)} L of plain water.`); }}
            className="px-2 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-white text-[11px] font-semibold disabled:opacity-40">
            Top Off (Water)
          </button>
          <button type="button" disabled={empty}
            onClick={() => { onUpdateItem(adjustToTargets(eq), selectedParentTentId); log(`⚗️ Dosed: ${eq.name}`, `Adjusted the tank to ${eq.nutrientTargetEcPpm ?? DEFAULT_NUTRIENT_EC_PPM} ppm, pH ${(eq.nutrientTargetPh ?? DEFAULT_NUTRIENT_PH).toFixed(1)}.`); }}
            className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold disabled:opacity-40">
            Dose to Targets
          </button>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          Tank size
          <input type="number" min="5" max="1000" value={capacity}
            onChange={e => {
              const liters = Math.max(5, Math.min(1000, parseInt(e.target.value) || 5));
              update({ nutrientCapacityL: liters, nutrientLevelL: Math.min(liters, level) });
            }}
            className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-200" />
          L <span className="text-zinc-500">(≈ {(capacity / 3.785).toFixed(1)} gal)</span>
        </label>
      </div>

      {/* Water temperature & oxygen */}
      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300"><Thermometer className="w-3.5 h-3.5 text-orange-400" /> Water Conditioning</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
          <label className="space-y-1">
            <span>Chiller / heater</span>
            <select value={eq.waterConditioning ?? 'none'} onChange={e => update({ waterConditioning: e.target.value as EquipmentItem['waterConditioning'] })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200">
              <option value="none">None (follows the air)</option>
              <option value="chiller">Water chiller (1/10 HP)</option>
              <option value="heater">Aquarium heater (200 W)</option>
              <option value="both">Chiller + heater</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="flex justify-between">Hold water at <span className="font-mono text-zinc-200">{eq.waterTargetTempF ?? 66}°F</span></span>
            <input type="range" min="58" max="78" step="1" value={eq.waterTargetTempF ?? 66}
              disabled={(eq.waterConditioning ?? 'none') === 'none'}
              onChange={e => update({ waterTargetTempF: parseInt(e.target.value) })} className="w-full accent-orange-500 disabled:opacity-40" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-zinc-300">
          <input type="checkbox" className="accent-sky-500" checked={!!eq.airStone} onChange={e => update({ airStone: e.target.checked })} />
          Air pump + air stone (5 W)
          <span className="text-zinc-500">keeps the solution oxygenated; warm water holds less</span>
        </label>
        {(eq.conditioningWatts ?? 0) > 1 && (
          <span className="text-[10px] text-zinc-500 block">Chiller / heater putting {Math.round(eq.conditioningWatts ?? 0)} W of heat into the air.</span>
        )}
      </div>

      {/* Pump */}
      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between text-xs text-zinc-300">
          <span className="font-semibold">Pump</span>
          <select value={eq.pumpMode ?? 'flood'} onChange={e => update({ pumpMode: e.target.value as 'flood' | 'continuous' })}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200">
            <option value="flood">Flood timer (ebb &amp; flow, drip)</option>
            <option value="continuous">Continuous (RDWC, aeroponics)</option>
          </select>
        </div>
        {flood && (
          <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
            <label className="space-y-1">
              <span>Floods / day</span>
              <input type="number" min="1" max="24" value={eq.floodsPerDay ?? 6}
                onChange={e => update({ floodsPerDay: Math.max(1, Math.min(24, parseInt(e.target.value) || 1)) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 font-mono text-zinc-200" />
            </label>
            <label className="space-y-1">
              <span>Minutes each</span>
              <input type="number" min="1" max="60" value={eq.floodMinutes ?? 15}
                onChange={e => update({ floodMinutes: Math.max(1, Math.min(60, parseInt(e.target.value) || 1)) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 font-mono text-zinc-200" />
            </label>
            <label className="space-y-1">
              <span>First at (hour)</span>
              <input type="number" min="0" max="23" value={eq.floodStartHour ?? 6}
                onChange={e => update({ floodStartHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 font-mono text-zinc-200" />
            </label>
          </div>
        )}
      </div>

      {/* Feed lines */}
      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between text-xs text-zinc-300">
          <span className="font-semibold">Feed Lines</span>
          <span className="text-[11px] font-mono text-sky-300">{describeFeedTargets(eq, roomItems)}</span>
        </div>
        {racks.length === 0 && plants.length === 0 && (
          <span className="text-[11px] text-zinc-500 block">Nothing in this room to connect: add a grow rack or hydro plants.</span>
        )}
        {racks.map(({ rack, where }) => {
          const shelves = getRackTiers(rack).length;
          return (
            <div key={rack.id} className="bg-zinc-950/70 rounded-lg p-2 space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] text-zinc-200 font-semibold">
                <input type="checkbox" className="accent-sky-500" checked={rackWhole(rack.id)}
                  onChange={e => setTargets([...targets.filter(t => t.id !== rack.id), ...(e.target.checked ? [{ id: rack.id }] : [])])} />
                {rack.name}: every shelf <span className="font-normal text-zinc-500">({where})</span>
              </label>
              <div className="flex flex-wrap gap-1.5 pl-5">
                {Array.from({ length: shelves }, (_, i) => (
                  <label key={i} className="flex items-center gap-1 text-[10px] text-zinc-400">
                    <input type="checkbox" className="accent-sky-500" checked={shelfFed(rack.id, i)} onChange={() => toggleShelf(rack.id, i, shelves)} />
                    Shelf {i + 1}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {plants.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {plants.map(({ plant: p, where }) => {
              const hydro = !!p.systemType && RESERVOIR_FED_SYSTEMS.includes(p.systemType);
              return (
                <label key={p.id} className="flex items-center gap-2 text-[11px] text-zinc-300">
                  <input type="checkbox" className="accent-sky-500" checked={targets.some(t => t.id === p.id)}
                    onChange={e => setTargets(e.target.checked ? [...targets, { id: p.id }] : targets.filter(t => t.id !== p.id))} />
                  {p.name}
                  <span className={`text-[10px] ${hydro ? 'text-sky-400' : 'text-zinc-500'}`}>{(p.systemType || 'soil_container').replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-zinc-500">· {where}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

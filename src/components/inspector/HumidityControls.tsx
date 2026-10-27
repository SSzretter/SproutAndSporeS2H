import React from 'react';
import { Power } from 'lucide-react';
import { Room, EquipmentItem } from '../../types/sim';
import { getDuctTargetTent, HOSE_DELIVERY_EFFICIENCY } from '../../utils/equipmentLinks';
import type { ItemSectionProps, EquipmentLocals } from './types';

export const HumidityControls: React.FC<ItemSectionProps & Pick<EquipmentLocals, 'eq'>> = (props) => {
  const { room, selectedParentTentId, onUpdateItem, eq } = props;

  return (
    <>
      {/* 3. HUMIDIFIER & DEHUMIDIFIER CONTROLS */}
      {(eq.type === 'humidifier' || eq.type === 'dehumidifier') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs text-zinc-300">
              <span>Target Humidity Set-Point</span>
              <span className="font-mono font-bold text-cyan-400">{eq.targetRh ?? 60}% RH</span>
            </div>
            <input
              type="range"
              min="30"
              max="98"
              value={eq.targetRh ?? 60}
              onChange={e => {
                onUpdateItem({
                  ...eq,
                  targetRh: parseInt(e.target.value)
                }, selectedParentTentId);
              }}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>Veg (60-70%)</span>
              <span>Flower (45-55%)</span>
              <span>Mushroom (85-95%)</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs text-zinc-300">
              <span>Output Mist Rate / Capacity</span>
              <span className="font-mono font-bold text-cyan-400">{eq.setting}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={eq.setting}
              onChange={e => {
                onUpdateItem({
                  ...eq,
                  setting: parseInt(e.target.value)
                }, selectedParentTentId);
              }}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <span className="text-[10px] text-zinc-500 block">
              Power Consumption: {Math.round(eq.powerWatts * (eq.setting / 100))} Watts
            </span>
          </div>
        </div>
      )}

      {/* 3b. HOSE DUCTING (humidifiers & CO2 controllers kept outside a tent) */}
      {(eq.type === 'humidifier' || eq.type === 'co2_regulator') && (() => {
        const isMist = eq.type === 'humidifier';
        const isRoomLevel = !selectedParentTentId;
        const ductTent = getDuctTargetTent(room, eq);
        const hostTent = selectedParentTentId ? room.tents.find(t => t.id === selectedParentTentId) : undefined;
        return (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs text-zinc-300">
              <span>{isMist ? 'Mist Hose / Ducting' : 'CO₂ Injection Tubing'}</span>
              <span className={`font-mono font-bold ${ductTent ? 'text-cyan-400' : 'text-zinc-500'}`}>
                {ductTent ? `→ ${ductTent.name}` : hostTent ? 'In tent' : 'Room air'}
              </span>
            </div>
            {isRoomLevel ? (
              <>
                <select
                  value={ductTent?.id ?? ''}
                  onChange={e => {
                    const next: EquipmentItem = { ...eq };
                    if (e.target.value) next.ductedToTentId = e.target.value;
                    else delete next.ductedToTentId;
                    onUpdateItem(next, selectedParentTentId);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">{isMist ? 'No hose — mists into the room' : 'No tubing — injects into the room'}</option>
                  {room.tents.map(t => (
                    <option key={t.id} value={t.id}>{isMist ? 'Hose into' : 'Tubing into'} {t.name}</option>
                  ))}
                </select>
                <span className="text-[10px] text-zinc-500 block">
                  {ductTent
                    ? isMist
                      ? `Sits outside the tent; mist is piped into ${ductTent.name} and runs on that tent's controller (~${Math.round((1 - HOSE_DELIVERY_EFFICIENCY) * 100)}% lost to hose condensation).`
                      : `Tank and solenoid sit outside the tent; CO₂ is injected into ${ductTent.name} and runs on that tent's controller.`
                    : room.tents.length > 0
                      ? `Run ${isMist ? 'a hose' : 'tubing'} into a tent to free up tent floor space.`
                      : `Add a tent to this room to ${isMist ? 'duct mist' : 'inject CO₂'} into it.`}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-zinc-500 block">
                {isMist ? 'Mists' : 'Injects'} directly into {hostTent?.name ?? 'this tent'}. Place the unit in the room to {isMist ? 'duct it in through a hose' : 'feed it through tubing'} instead.
              </span>
            )}
          </div>
        );
      })()}
    </>
  );
};

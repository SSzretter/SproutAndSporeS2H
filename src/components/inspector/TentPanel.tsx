import React from 'react';
import { Home, Check, Trash2, ArrowLeft, Edit3, Sliders, ChevronRight, Move } from 'lucide-react';
import { Room, Tent, Item, Dimensions } from '../../types/sim';
import { VpdBadge } from '../VpdBadge';
import { TENT_CATALOG } from '../../utils/tentCatalog';
import { getTentEnvelope, TENT_FABRIC_OPTIONS } from '../../utils/tentEnvelope';
import { TentExhaustFanCard } from './TentExhaustFanCard';
import { TentItemsSection } from './TentItemsSection';
import { isRackedPlant } from '../../utils/growRacks';
import type { TentSectionProps } from './types';

export const TentPanel: React.FC<TentSectionProps> = (props) => {
  const { room, tempUnit, onUpdateTent, onDeleteTent, onDeleteItem, onSelectRoom, isEditingName, setIsEditingName, editedName, setEditedName, filterTab, showDeleteConfirm, setShowDeleteConfirm, quickItemToDelete, setQuickItemToDelete, currentTent, handleTentDimensionChange, handleTentPositionChange } = props;
  const tentVol = Math.round(currentTent.dimensions.length * currentTent.dimensions.width * currentTent.dimensions.height);
  const isShroomTent = currentTent.items.some(i => i.category === 'mushroom');

  const filteredTentItems = currentTent.items.filter(item => {
    if (isRackedPlant(item)) return false; // Listed in their rack's tray map instead
    if (filterTab === 'all') return true;
    if (filterTab === 'plants') return item.category === 'plant';
    if (filterTab === 'mushrooms') return item.category === 'mushroom';
    if (filterTab === 'equipment') return item.category === 'equipment';
    if (filterTab === 'people') return item.category === 'person';
    if (filterTab === 'pets') return item.category === 'pet';
    return false;
  });

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <button 
            onClick={onSelectRoom}
            className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            <Home className="w-3.5 h-3.5" /> {room.name}
          </button>
          <ChevronRight className="w-3 h-3 text-zinc-600" />
          <span className="text-emerald-400 font-semibold">{currentTent.name}</span>
        </div>
        <button
          onClick={onSelectRoom}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Room
        </button>
      </div>

      {/* Tent Header & Dimensions Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  className="bg-zinc-950 border border-emerald-500 rounded-lg px-2.5 py-1 text-sm font-bold text-zinc-100 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (editedName.trim() && currentTent) {
                      onUpdateTent({ ...currentTent, name: editedName.trim() });
                    }
                    setIsEditingName(false);
                  }}
                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-100">{currentTent.name}</h3>
                <button
                  onClick={() => {
                    setEditedName(currentTent!.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                  title="Rename Tent"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              title="Delete this Tent"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Standard Brand Model Info */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${
                    currentTent.brand === 'AC Infinity'
                      ? 'bg-sky-950 border border-sky-800 text-sky-300'
                      : currentTent.brand === 'Spider Farmer'
                        ? 'bg-amber-950 border border-amber-800 text-amber-300'
                        : 'bg-zinc-800 text-zinc-300'
                  }`}>
                  {currentTent.brand || 'Custom Enclosure'}
                </span>
                <span className="text-xs font-semibold text-zinc-200">
                  {currentTent.modelName || 'Standard Grow Tent'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-mono text-zinc-400">
                  Switch to Model:
                </label>
                <select
                  onChange={(e) => {
                    const selected = TENT_CATALOG.find(t => t.id === e.target.value);
                    if (selected && currentTent) {
                      onUpdateTent({
                        ...currentTent,
                        name: currentTent.name, // Preserves the user-defined custom tent name
                        brand: selected.brand,
                        modelName: selected.modelName,
                        mylarRating: selected.mylarRating,
                        poleDiameter: selected.poleDiameter,
                        ventPorts: selected.ventPorts,
                        dimensions: selected.dimensions
                      });
                    }
                  }}
                  defaultValue=""
                  className="bg-zinc-900 border border-zinc-750 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="" disabled>Select Factory Tent...</option>
                  <optgroup label="AC Infinity CLOUDLAB Series">
                    {TENT_CATALOG.filter(t => t.brand === 'AC Infinity').map(t => (
                      <option key={t.id} value={t.id}>{t.modelName} ({t.shortCode})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Spider Farmer Series">
                    {TENT_CATALOG.filter(t => t.brand === 'Spider Farmer').map(t => (
                      <option key={t.id} value={t.id}>{t.modelName} ({t.shortCode})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Gorilla Grow Tent Series">
                    {TENT_CATALOG.filter(t => t.brand === 'Gorilla Grow').map(t => (
                      <option key={t.id} value={t.id}>{t.modelName} ({t.shortCode})</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Hardware Specs Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-zinc-400">
              <select
                aria-label="Tent fabric"
                value={currentTent.mylarRating || '600D Mylar'}
                onChange={e => onUpdateTent({ ...currentTent, mylarRating: e.target.value })}
                className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300 focus:outline-none focus:border-emerald-500"
              >
                {[...new Set([currentTent.mylarRating || '600D Mylar', ...TENT_FABRIC_OPTIONS])].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300">
                {currentTent.poleDiameter || '22mm Steel Frame'}
              </span>
              <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400">
                {currentTent.ventPorts || 'Dual Cinch Ports'}
              </span>
            </div>
            {(() => {
              const env = getTentEnvelope(currentTent);
              return (
                <p className="text-[10px] text-zinc-500 leading-snug">
                  Heat loss: U {env.uValue.toFixed(2)} BTU/h·ft²·°F ({env.label}), {env.leakAch} air changes/h with the fan off.
                  Liner and seals matter far more than fabric weight.
                </p>
              );
            })()}
          </div>

          {/* Editable Dimensions: L x W x H */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Tent Physical Dimensions (L × W × H)
              </span>
              <span className="font-mono text-emerald-400 text-xs">
                Volume: {tentVol} cu ft ({Math.round(tentVol * 0.0283)} m³)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Length (ft)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="20"
                  value={currentTent.dimensions.length}
                  onChange={e => handleTentDimensionChange('length', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Width (ft)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="20"
                  value={currentTent.dimensions.width}
                  onChange={e => handleTentDimensionChange('width', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Height (ft)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="3"
                  max="12"
                  value={currentTent.dimensions.height}
                  onChange={e => handleTentDimensionChange('height', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Editable 3D Position in Host Room: X, Y, Z */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-sky-400" />
                3D Spatial Position in {room.name} (X, Y, Z)
              </span>
              <span className="font-mono text-sky-400 text-xs">
                Room: {room.dimensions.length}′ × {room.dimensions.width}′
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  X: West→East (ft)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={Math.max(0, room.dimensions.length - currentTent.dimensions.length)}
                  value={currentTent.position?.x ?? 2.5}
                  onChange={e => handleTentPositionChange('x', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Y: North→South (ft)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={Math.max(0, room.dimensions.width - currentTent.dimensions.width)}
                  value={currentTent.position?.y ?? 2.0}
                  onChange={e => handleTentPositionChange('y', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Z: Elevation (ft)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={Math.max(0, room.dimensions.height - currentTent.dimensions.height)}
                  value={currentTent.position?.z ?? 0}
                  onChange={e => handleTentPositionChange('z', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-zinc-400">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  handleTentPositionChange('x', 2.5);
                  handleTentPositionChange('y', 2.0);
                  handleTentPositionChange('z', 0);
                }}
                className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
              >
                Wall Clearance
              </button>
              <button
                type="button"
                onClick={() => {
                  const cx = Math.max(0, parseFloat(((room.dimensions.length - currentTent.dimensions.length) / 2).toFixed(1)));
                  const cy = Math.max(0, parseFloat(((room.dimensions.width - currentTent.dimensions.width) / 2).toFixed(1)));
                  handleTentPositionChange('x', cx);
                  handleTentPositionChange('y', cy);
                  handleTentPositionChange('z', 0);
                }}
                className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
              >
                Center Enclosure
              </button>
            </div>
          </div>

          <TentExhaustFanCard {...props} isShroomTent={isShroomTent} />
        </div>

        {/* Tent Microclimate Panel */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
              Tent Sensor Telemetry
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Temperature</span>
                <span className="font-mono font-bold text-zinc-100">
                  {tempUnit === 'F' ? `${currentTent.climate.tempF.toFixed(1)}°F` : `${currentTent.climate.tempC.toFixed(1)}°C`}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Relative Humidity</span>
                <span className="font-mono font-bold text-zinc-100">{currentTent.climate.rh}% RH</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Vapor Pressure Deficit</span>
                <span className="font-mono font-bold text-emerald-400">{currentTent.climate.vpdKpa.toFixed(2)} kPa</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Canopy CO₂</span>
                <span className="font-mono font-bold text-emerald-400">{currentTent.climate.co2Ppm || 600} PPM</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Canopy Light</span>
                <span className="font-mono font-bold text-yellow-400">{currentTent.climate.lightPPFD} PPFD</span>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800">
            <VpdBadge vpd={currentTent.climate.vpdKpa} target={isShroomTent ? 'mushroom' : 'plant'} showDetails />
          </div>
        </div>
      </div>

      <TentItemsSection {...props} filteredTentItems={filteredTentItems} />

      {/* Quick Item Deletion Confirmation Modal in Tent View */}
      {quickItemToDelete && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setQuickItemToDelete(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-zinc-100">
                  Remove Item from Tent
                </h4>
                <p className="text-xs text-zinc-400">
                  Are you sure you want to remove <span className="font-semibold text-zinc-200">{quickItemToDelete.name}</span>?
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              This item will be removed from the tent immediately and its effects will cease.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickItemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteItem(quickItemToDelete.id, quickItemToDelete.parentTentId);
                  setQuickItemToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-colors"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              Delete {currentTent.name}?
            </h3>
            <p className="text-sm text-zinc-400 mt-2">
              This will remove the tent and all {currentTent.items.length} items (plants, mushrooms, and equipment) inside it.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteTent(currentTent!.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors shadow-lg shadow-rose-900/30"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

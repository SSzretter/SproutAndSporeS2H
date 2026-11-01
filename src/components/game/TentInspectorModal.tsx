import React, { useState } from 'react';
import { getTentEnvelope } from '../../utils/tentEnvelope';
import { 
  X, 
  Box, 
  Sliders, 
  Move, 
  Wind, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Zap, 
  Sprout, 
  Droplets, 
  Layers,
  Thermometer,
  Shield
} from 'lucide-react';
import { Tent, Room, EquipmentItem, ControllerPriority } from '../../types/sim';
import { TENT_CATALOG } from '../../utils/tentCatalog';

interface TentInspectorModalProps {
  tent: Tent;
  room: Room;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTent: (updatedTent: Tent) => void;
  onDeleteTent: (tentId: string) => void;
  onOpenAddItem: (tentId: string) => void;
}

export const TentInspectorModal: React.FC<TentInspectorModalProps> = ({
  tent,
  room,
  isOpen,
  onClose,
  onUpdateTent,
  onDeleteTent,
  onOpenAddItem
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(tent.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  const tentVol = Math.round(tent.dimensions.length * tent.dimensions.width * tent.dimensions.height);
  const installedExhaustFan = tent.items.find(
    i => i.category === 'equipment' && i.type === 'exhaust_fan'
  ) as EquipmentItem | undefined;

  const plantsCount = tent.items.filter(i => i.category === 'plant').length;
  const shroomsCount = tent.items.filter(i => i.category === 'mushroom').length;
  const equipmentCount = tent.items.filter(i => i.category === 'equipment').length;

  const handleDimensionChange = (key: 'length' | 'width' | 'height', val: number) => {
    if (isNaN(val) || val <= 0) return;
    onUpdateTent({
      ...tent,
      dimensions: {
        ...tent.dimensions,
        [key]: parseFloat(val.toFixed(1))
      }
    });
  };

  const handlePositionChange = (axis: 'x' | 'y' | 'z', val: number) => {
    if (isNaN(val)) return;
    const curPos = tent.position || { x: 2.5, y: 2.0, z: 0 };
    onUpdateTent({
      ...tent,
      position: {
        ...curPos,
        [axis]: Math.max(0, parseFloat(val.toFixed(1)))
      }
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Box className="w-5 h-5" />
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  className="bg-zinc-950 border border-emerald-500 rounded-lg px-2.5 py-1 text-base font-bold text-zinc-100 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (editedName.trim()) {
                      onUpdateTent({ ...tent, name: editedName.trim() });
                    }
                    setIsEditingName(false);
                  }}
                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-100">{tent.name}</h3>
                <button
                  onClick={() => {
                    setEditedName(tent.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Rename Tent"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              title="Delete this Tent"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Climate Telemetry Strip */}
        <div className="grid grid-cols-4 gap-2 text-center bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3">
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Temperature</span>
            <span className="text-sm font-bold text-amber-300 font-mono">{tent.climate.tempF.toFixed(1)}°F</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Humidity</span>
            <span className="text-sm font-bold text-cyan-300 font-mono">{tent.climate.rh.toFixed(1)}% RH</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">VPD Deficit</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">{tent.climate.vpdKpa.toFixed(2)} kPa</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">CO₂ Level</span>
            <span className="text-sm font-bold text-purple-300 font-mono">{Math.round(tent.climate.co2Ppm)} ppm</span>
          </div>
        </div>

        {/* Factory Brand & Model Specifications */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${
                tent.brand === 'AC Infinity'
                  ? 'bg-sky-950 border border-sky-800 text-sky-300'
                  : tent.brand === 'Spider Farmer'
                    ? 'bg-amber-950 border border-amber-800 text-amber-300'
                    : 'bg-zinc-800 text-zinc-300'
              }`}>
                {tent.brand || 'Custom Enclosure'}
              </span>
              <span className="text-xs font-semibold text-zinc-200">
                {tent.modelName || 'Standard Grow Tent'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-mono text-zinc-400">Switch Model:</label>
              <select
                onChange={(e) => {
                  const selected = TENT_CATALOG.find(t => t.id === e.target.value);
                  if (selected) {
                    onUpdateTent({
                      ...tent,
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
                <option value="" disabled>Select Factory Tent Model...</option>
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

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-zinc-400">
            <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300">
              {tent.mylarRating || '1680D Mylar'}
            </span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300">
              {tent.poleDiameter || '22mm Steel Frame'}
            </span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400">
              {tent.ventPorts || 'Dual Cinch Ports'}
            </span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400" title={getTentEnvelope(tent).label}>
              U {getTentEnvelope(tent).uValue.toFixed(2)} · {getTentEnvelope(tent).leakAch} ACH leak
            </span>
          </div>
        </div>

        {/* Physical Dimensions (L × W × H) */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              Physical Dimensions (L × W × H)
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
                value={tent.dimensions.length}
                onChange={e => handleDimensionChange('length', parseFloat(e.target.value))}
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
                value={tent.dimensions.width}
                onChange={e => handleDimensionChange('width', parseFloat(e.target.value))}
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
                value={tent.dimensions.height}
                onChange={e => handleDimensionChange('height', parseFloat(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* 3D Spatial Position within Room */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-sky-400" />
              3D Spatial Position in {room.name} (X, Y, Z)
            </span>
            <span className="font-mono text-sky-400 text-xs">
              Room Size: {room.dimensions.length}′ × {room.dimensions.width}′
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
                max={Math.max(0, room.dimensions.length - tent.dimensions.length)}
                value={tent.position?.x ?? 2.5}
                onChange={e => handlePositionChange('x', parseFloat(e.target.value))}
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
                max={Math.max(0, room.dimensions.width - tent.dimensions.width)}
                value={tent.position?.y ?? 2.0}
                onChange={e => handlePositionChange('y', parseFloat(e.target.value))}
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
                max={Math.max(0, room.dimensions.height - tent.dimensions.height)}
                value={tent.position?.z ?? 0}
                onChange={e => handlePositionChange('z', parseFloat(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-zinc-400">Position Presets:</span>
            <button
              type="button"
              onClick={() => {
                handlePositionChange('x', 2.5);
                handlePositionChange('y', 2.0);
                handlePositionChange('z', 0);
              }}
              className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
            >
              Wall Clearance
            </button>
            <button
              type="button"
              onClick={() => {
                const cx = Math.max(0, parseFloat(((room.dimensions.length - tent.dimensions.length) / 2).toFixed(1)));
                const cy = Math.max(0, parseFloat(((room.dimensions.width - tent.dimensions.width) / 2).toFixed(1)));
                handlePositionChange('x', cx);
                handlePositionChange('y', cy);
                handlePositionChange('z', 0);
              }}
              className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
            >
              Center Room
            </button>
          </div>
        </div>

        {/* Exhaust Fan & Ventilation Controller */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
          {installedExhaustFan ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200">
                      Exhaust Fan: {installedExhaustFan.name}
                    </span>
                    <p className="text-[10px] text-zinc-400">Pulls conditioned lung room air through intake ports</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    {tent.exhaustFanSpeed || 0}%
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    ({Math.round(((tent.exhaustFanSpeed || 0) / 100) * 205)} CFM)
                  </span>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={tent.exhaustFanSpeed || 0}
                onChange={e => {
                  const newSpeed = parseInt(e.target.value);
                  const updatedItems = tent.items.map(it => {
                    if (it.id === installedExhaustFan.id) {
                      return {
                        ...it,
                        setting: newSpeed,
                        powerOn: newSpeed > 0
                      };
                    }
                    return it;
                  });
                  onUpdateTent({
                    ...tent,
                    exhaustFanSpeed: newSpeed,
                    items: updatedItems
                  });
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wind className="w-4 h-4 text-zinc-500" />
                <div>
                  <span className="text-xs font-semibold text-zinc-300">
                    Passive Airflow (No Exhaust Fan Installed)
                  </span>
                  <p className="text-[10px] text-zinc-400">
                    Passive mesh exchange (~0.05 ACH). Install an exhaust fan to enable powered ventilation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddItem(tent.id);
                }}
                className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Fan</span>
              </button>
            </div>
          )}
        </div>

        {/* Central Controller Automation Priority */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Controller Automation Priority
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['balanced_auto', 'humidity_first', 'temperature_first', 'co2_enrichment'] as ControllerPriority[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onUpdateTent({ ...tent, controllerPriority: mode })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                  (tent.controllerPriority || 'balanced_auto') === mode
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mode === 'balanced_auto' && 'Balanced Auto'}
                {mode === 'humidity_first' && 'Humidity First'}
                {mode === 'temperature_first' && 'Temp First'}
                {mode === 'co2_enrichment' && 'CO₂ Priority'}
              </button>
            ))}
          </div>
        </div>

        {/* Enclosure Contents Summary & Quick Add */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-mono text-zinc-300">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Sprout className="w-4 h-4" /> {plantsCount} Plants
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="text-sm">🍄</span> {shroomsCount} Mushrooms
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Zap className="w-4 h-4" /> {equipmentCount} Devices
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddItem(tent.id);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item to Tent</span>
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-60 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-zinc-100">Delete {tent.name}?</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    This will remove the tent and all {tent.items.length} items inside it from the simulation.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTent(tent.id);
                    setShowDeleteConfirm(false);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { Home, Sun, Check, Trash2, Edit3, Plus, Sliders, ChevronRight, Sparkles, Building } from 'lucide-react';
import { Room, Tent, Item, Dimensions } from '../../types/sim';
import { VpdBadge } from '../VpdBadge';
import { RoomItemsSection } from './RoomItemsSection';
import { isRackedPlant } from '../../utils/growRacks';
import type { InspectorContext } from './types';

export const RoomPanel: React.FC<InspectorContext> = (props) => {
  const { room, rooms, outdoorCo2Ppm, tempUnit, onUpdateRoom, onDeleteTent, onDeleteItem, onDeleteRoom, onOpenAddRoom, onOpenLocationModal, isEditingName, setIsEditingName, editedName, setEditedName, filterTab, setShowDeleteRoomConfirm, quickItemToDelete, setQuickItemToDelete, handleRoomDimensionChange } = props;
  const roomVolume = Math.round(room.dimensions.length * room.dimensions.width * room.dimensions.height);
    
  const allRoomItems = [
    ...room.tents.map(t => ({ ...t, kind: 'tent' as const })),
    // Plants in grow rack trays are listed in their rack's tray map instead
    ...room.items.filter(i => !isRackedPlant(i)).map(i => ({ ...i, kind: 'item' as const }))
  ];

  const filteredItems = allRoomItems.filter(item => {
    if (filterTab === 'all') return true;
    if (filterTab === 'tents') return item.kind === 'tent';
    if (item.kind === 'item') {
      if (filterTab === 'plants') return item.category === 'plant';
      if (filterTab === 'mushrooms') return item.category === 'mushroom';
      if (filterTab === 'equipment') return item.category === 'equipment';
      if (filterTab === 'people') return item.category === 'person';
      if (filterTab === 'pets') return item.category === 'pet';
    }
    return false;
  });

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            <Home className="w-3.5 h-3.5" /> Room
          </span>
          <ChevronRight className="w-3 h-3 text-zinc-600" />
          <span className="text-zinc-200 font-medium">{room.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 border border-zinc-700">
            2005 Colonial House Specification
          </span>
        </div>
      </div>

      {/* Room Header & Dimensions Editor */}
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
                    if (editedName.trim()) {
                      onUpdateRoom({ ...room, name: editedName.trim() });
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
                <h3 className="text-lg font-bold text-zinc-100">{room.name}</h3>
                <button
                  onClick={() => {
                    setEditedName(room.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                  title="Rename Room"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                {room.tents.length} Tents Active · {room.items.length} Direct Items
              </span>
              {onOpenAddRoom && (
                <button
                  type="button"
                  onClick={onOpenAddRoom}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                  title="Add a new room to facility"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ Room</span>
                </button>
              )}
              {onDeleteRoom && rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteRoomConfirm(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/60 transition-colors"
                  title={`Delete room: ${room.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete Room</span>
                </button>
              )}
            </div>
          </div>

          {/* Editable Dimensions: L x W x H */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Room Physical Enclosure (L × W × H)
              </span>
              <span className="font-mono text-emerald-400 text-xs">
                Volume: {roomVolume.toLocaleString()} cu ft ({Math.round(roomVolume * 0.0283)} m³)
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
                  min="4"
                  max="100"
                  value={room.dimensions.length}
                  onChange={e => handleRoomDimensionChange('length', parseFloat(e.target.value))}
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
                  min="4"
                  max="100"
                  value={room.dimensions.width}
                  onChange={e => handleRoomDimensionChange('width', parseFloat(e.target.value))}
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
                  min="6"
                  max="30"
                  value={room.dimensions.height}
                  onChange={e => handleRoomDimensionChange('height', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* PHYSICAL ENVIRONMENT SPECIFICATIONS (OUTDOOR GARDEN vs GREENHOUSE vs INDOOR ENVELOPE) */}
          {room.environmentType === 'outdoor_garden' ? (
            <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  Outdoor Garden &amp; Open Atmosphere Physics
                </span>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                  Open Sky · No Building Envelope
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Outdoor Microclimate & Terroir details */}
                <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Solar Exposure:</span>
                    <span className="font-mono text-amber-300 font-semibold">100% Daylight (0–1600+ PPFD)</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Thermal Envelope:</span>
                    <span className="font-mono text-zinc-300 font-semibold">None (Direct Ambient Drift)</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Natural Precipitation:</span>
                    <span className="font-mono text-sky-300 font-semibold">Natural Rainfall Hydration</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Garden Configuration:</span>
                    <span className="font-mono text-emerald-400 capitalize">
                      {room.gardenConfig ? room.gardenConfig.replace(/_/g, ' ') : 'Hop Yard Trellis'}
                    </span>
                  </div>
                </div>

                {/* Atmospheric Circulation & Ambient CO2 */}
                <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Air Circulation:</span>
                    <span className="font-mono text-zinc-200 font-semibold">Unrestricted Ambient Breeze</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Ambient Outdoor CO₂:</span>
                    <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                      <span>{outdoorCo2Ppm} PPM</span>
                      {onOpenLocationModal && (
                        <button
                          type="button"
                          onClick={onOpenLocationModal}
                          className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-sans font-normal border border-zinc-700 transition-colors"
                          title="Configure Outdoor Atmospheric Baseline in Weather Settings"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-300/80 bg-zinc-950/60 p-2 rounded border border-zinc-850">
                    Open-air garden: Crops transpire freely under outdoor solar PPFD, natural rain hydrates containers and soil, and temperatures mirror local ambient weather. No building envelope or heating / cooling equipment; it follows the local weather.
                  </div>
                </div>
              </div>
            </div>
          ) : room.environmentType === 'greenhouse' ? (
            <div className="bg-teal-950/20 border border-teal-800/50 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  Solar Greenhouse &amp; Glazing Microclimate
                </span>
                <span className="text-[10px] font-mono text-teal-300 bg-teal-950/80 border border-teal-800 px-2 py-0.5 rounded">
                  Polycarbonate Glazing · Solar Gain
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Greenhouse Glazing Spec */}
                <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Glazing Material:</span>
                    <span className="font-mono text-teal-300 font-semibold">Twin-Wall Polycarbonate (R-3)</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Solar Transmittance:</span>
                    <span className="font-mono text-zinc-200 font-semibold">82% Sunlight PPFD</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Passive Solar Heat Gain:</span>
                    <span className="font-mono text-amber-300 font-semibold">+1.5°F to +5.5°F Daylight Boost</span>
                  </div>
                </div>

                {/* Greenhouse Ventilation */}
                <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Passive Ridge Louvers:</span>
                    <span className="font-mono text-zinc-200 font-semibold">2.0 ACH Natural Exchange</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Outdoor CO₂ Baseline:</span>
                    <span className="font-mono text-emerald-400 font-bold">{outdoorCo2Ppm} PPM</span>
                  </div>
                  <div className="text-[10px] text-teal-300/80 bg-zinc-950/60 p-2 rounded border border-zinc-850">
                    High-tunnel greenhouse: Shields crops from severe wind and excessive rain while harvesting natural solar photons and thermal gain.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* INDOOR ROOM: RESIDENTIAL BUILDING ENVELOPE & HVAC */
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-sky-400" />
                  Building Envelope &amp; {room.constructionStandard === 'modern_tight' ? 'Modern High-Performance' : room.constructionStandard === 'older_drafty' ? 'Older Home' : '2005 Colonial House'} Physics
                </span>
                <span className="text-[10px] font-mono text-sky-300 bg-sky-950/80 border border-sky-850 px-2 py-0.5 rounded">
                  IECC 2003/2006 Code
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Construction Spec details */}
                <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Exterior Wall Insulation:</span>
                    <span className="font-mono text-zinc-200 font-semibold">R-{room.wallRValue || 19} (U-{(1 / Math.max(1, room.wallRValue || 19)).toFixed(3)})</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Outdoor Air Infiltration:</span>
                    <span className="font-mono text-zinc-200 font-semibold">{room.airChangesPerHour || 0.35} ACH (Fresh Air)</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Foundation Coupling:</span>
                    <select
                      value={room.foundationType || 'conditioned_basement'}
                      onChange={e => onUpdateRoom({ ...room, foundationType: e.target.value as any })}
                      className="bg-zinc-950 border border-zinc-750 rounded px-1.5 py-0.5 text-[11px] text-zinc-200"
                    >
                      <option value="conditioned_basement">Basement Suite (R-10 Concrete)</option>
                      <option value="slab_on_grade">1st Floor Living (Slab on Grade)</option>
                      <option value="second_floor">2nd Floor Bedroom Space</option>
                      <option value="attic">Attic / Bonus Room (Unconditioned)</option>
                    </select>
                  </div>
                </div>

                {/* Surroundings & the heating / cooling equipment actually in the room (no hidden HVAC) */}
                <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <label htmlFor={`adjacent-${room.id}`}>Rest of house (adjacent spaces):</label>
                    <div className="flex items-center gap-1">
                      <input
                        id={`adjacent-${room.id}`}
                        type="number"
                        min="35"
                        max="95"
                        value={room.adjacentSpaceTempF ?? 70}
                        onChange={e => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) onUpdateRoom({ ...room, adjacentSpaceTempF: Math.max(35, Math.min(95, value)) });
                        }}
                        className="w-14 bg-zinc-950 border border-zinc-750 rounded px-1.5 py-0.5 text-right font-mono text-[11px] text-zinc-200"
                      />
                      <span>°F</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 bg-zinc-950/60 p-2 rounded border border-zinc-850">
                    {(() => {
                      const climateGear = room.items.filter(i => i.category === 'equipment' && (i.type === 'heater' || i.type === 'portable_ac' || i.type === 'hvac_register'));
                      return climateGear.length === 0
                        ? 'No heating or cooling equipment: temperature drifts with the outdoors, the ground and the rest of the house, plus heat from lights and gear. Add a heater, portable A/C or HVAC register to control it.'
                        : `Heating / cooling: ${climateGear.map(i => i.name).join(', ')}.`;
                    })()}
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                    <span>Outdoor Air Infiltration CO₂:</span>
                    <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
                      <span>{outdoorCo2Ppm} PPM</span>
                      {onOpenLocationModal && (
                        <button
                          type="button"
                          onClick={onOpenLocationModal}
                          className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-sans font-normal border border-zinc-700 transition-colors"
                          title="Configure Outdoor Atmospheric Baseline in Weather Settings"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 bg-zinc-950/60 p-2 rounded border border-zinc-850">
                    {(() => {
                      const people = room.items.filter(i => i.category === 'person');
                      const pets = room.items.filter(i => i.category === 'pet');
                      if (people.length === 0 && pets.length === 0) {
                        return 'Unoccupied: room CO₂ comes from tent exhaust (mushroom respiration, CO₂ injection); outdoor air leaking in pulls it back toward the outdoor level.';
                      }
                      return `Active Occupancy: ${people.length} People, ${pets.length} Pets exhaling biological CO₂ and radiating body warmth into the lung room.`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Room Live Climate Panel */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
              {room.environmentType === 'outdoor_garden' 
                ? 'Garden Atmosphere Telemetry (Outdoor)' 
                : room.environmentType === 'greenhouse' 
                  ? 'Greenhouse Atmosphere Telemetry' 
                  : 'Indoor Envelope Telemetry'}
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Temperature</span>
                <span className="font-mono font-bold text-zinc-100">
                  {tempUnit === 'F' ? `${room.climate.tempF.toFixed(1)}°F` : `${room.climate.tempC.toFixed(1)}°C`}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Relative Humidity</span>
                <span className="font-mono font-bold text-zinc-100">{room.climate.rh}% RH</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Vapor Pressure Deficit</span>
                <span className="font-mono font-bold text-emerald-400">{room.climate.vpdKpa.toFixed(2)} kPa</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Ambient CO₂</span>
                <span className="font-mono font-bold text-emerald-400">{Math.round(room.climate.co2Ppm || 420)} PPM</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Ambient PPFD</span>
                <span className="font-mono font-bold text-zinc-100">{room.climate.lightPPFD} µmol</span>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800">
            <VpdBadge vpd={room.climate.vpdKpa} target="plant" showDetails />
          </div>
        </div>
      </div>

      <RoomItemsSection {...props} filteredItems={filteredItems} />

      {/* Quick Item Deletion Confirmation Modal */}
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
                  Remove {quickItemToDelete.kind === 'tent' ? 'Tent' : 'Item'}
                </h4>
                <p className="text-xs text-zinc-400">
                  Are you sure you want to remove <span className="font-semibold text-zinc-200">{quickItemToDelete.name}</span>?
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              {quickItemToDelete.kind === 'tent'
                ? 'This will dismantle the enclosure and remove all internal equipment and crops located inside it from the facility.'
                : 'This item will be removed immediately and its environmental impact (respiration, power, or climate modulation) will stop.'}
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
                  if (quickItemToDelete.kind === 'tent') {
                    onDeleteTent(quickItemToDelete.id);
                  } else {
                    onDeleteItem(quickItemToDelete.id, quickItemToDelete.parentTentId);
                  }
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
    </div>
  );
};

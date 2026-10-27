import React from 'react';
import { Home, Check, Trash2, ArrowLeft, Edit3, Sliders, ChevronRight, Dog, Cat, Move } from 'lucide-react';
import { CropGrowth3DViewer } from '../game3d/CropGrowth3DViewer';
import { Room, Item, PlantItem, MushroomItem, PersonItem, PetItem, PetType, Dimensions, PlantStage } from '../../types/sim';
import { NpcDossier } from '../NpcDossier';
import { PlantCard } from './PlantCard';
import { MushroomCard } from './MushroomCard';
import { EquipmentCard } from './EquipmentCard';
import type { ItemSectionProps } from './types';

export const ItemPanel: React.FC<ItemSectionProps> = (props) => {
  const { room, selectedParentTentId, simTime, onUpdateRoom, onUpdateItem, onDeleteItem, onDeleteRoom, onSelectRoom, onSelectTent, onAddHarvestsToFacility, isEditingName, setIsEditingName, editedName, setEditedName, showDeleteConfirm, setShowDeleteConfirm, showDeleteRoomConfirm, setShowDeleteRoomConfirm, show3dGrowthTimelapse, setShow3dGrowthTimelapse, currentTent, currentItem, handleItemDimensionChange, handleItemPositionChange } = props;
  const parentName = currentTent ? currentTent.name : room.name;
  const isCropItem = currentItem.category === 'plant' || currentItem.category === 'mushroom';
  const itemSizeDims = (currentItem.category === 'plant' || currentItem.category === 'mushroom') && currentItem.containerDimensions
    ? currentItem.containerDimensions
    : currentItem.dimensions;

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
          {currentTent && (
            <>
              <button 
                onClick={() => onSelectTent(currentTent!.id)}
                className="hover:text-emerald-400 transition-colors"
              >
                {currentTent.name}
              </button>
              <ChevronRight className="w-3 h-3 text-zinc-600" />
            </>
          )}
          <span className="text-emerald-400 font-semibold">{currentItem.name}</span>
        </div>

        <button
          onClick={() => {
            if (currentTent) onSelectTent(currentTent.id);
            else onSelectRoom();
          }}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to {parentName}
        </button>
      </div>

      {/* Item Title & Dimensions Editor */}
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
                    if (editedName.trim() && currentItem) {
                      onUpdateItem({ ...currentItem, name: editedName.trim() }, selectedParentTentId);
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
                <h3 className="text-lg font-bold text-zinc-100">{currentItem.name}</h3>
                <button
                  onClick={() => {
                    setEditedName(currentItem!.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                  title="Rename Item"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              title="Delete this Item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Editable Dimensions: L x W x H */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                {isCropItem ? 'Pot / Container Dimensions (L × W × H)' : 'Item Dimensions (L × W × H)'}
              </span>
              <span className="font-mono text-emerald-400 text-xs">
                Footprint: {(currentItem.dimensions.length * currentItem.dimensions.width).toFixed(2)} sq ft
              </span>
            </div>
            {isCropItem && (
              <div className="text-[10px] font-mono text-zinc-400">
                Overall with {currentItem.category === 'plant' ? 'canopy' : 'fruit bodies'}: {currentItem.dimensions.length}′ × {currentItem.dimensions.width}′ × {currentItem.dimensions.height}′
                {currentItem.category === 'plant' && (
                  <> · plant {currentItem.heightInches.toFixed(0)}″ tall, {currentItem.canopyWidthInches.toFixed(0)}″ canopy</>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Length ({itemSizeDims.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="20"
                  value={itemSizeDims.length}
                  onChange={e => handleItemDimensionChange('length', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Width ({itemSizeDims.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="20"
                  value={itemSizeDims.width}
                  onChange={e => handleItemDimensionChange('width', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Height ({itemSizeDims.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="20"
                  value={itemSizeDims.height}
                  onChange={e => handleItemDimensionChange('height', parseFloat(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-750 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Editable 3D Position in Enclosure: X, Y, Z */}
          {(() => {
            const containerName = currentTent ? currentTent.name : room.name;
            const containerDims = currentTent ? currentTent.dimensions : room.dimensions;
            const curPos = currentItem.position || { x: 1.0, y: 1.0, z: 0 };

            return (
              <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-sky-400" />
                    3D Spatial Position in {containerName} (X, Y, Z)
                  </span>
                  <span className="font-mono text-sky-400 text-xs">
                    Enclosure: {containerDims.length}′ × {containerDims.width}′ × {containerDims.height}′
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                      X Offset (ft)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={containerDims.length}
                      value={curPos.x}
                      onChange={e => handleItemPositionChange('x', parseFloat(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                      Y Depth (ft)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={containerDims.width}
                      value={curPos.y}
                      onChange={e => handleItemPositionChange('y', parseFloat(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                      Z Elevation (ft)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={containerDims.height}
                      value={curPos.z}
                      onChange={e => handleItemPositionChange('z', parseFloat(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-750 focus:border-sky-500 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-zinc-400">Position Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleItemPositionChange('z', 0);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                  >
                    Floor (Z=0)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleItemPositionChange('z', Math.max(0, parseFloat((containerDims.height - 1.2).toFixed(1))));
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                  >
                    Ceiling / Hanging (Z={Math.max(0, parseFloat((containerDims.height - 1.2).toFixed(1)))}′)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleItemPositionChange('z', 2.5);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                  >
                    Bench / Shelf (Z=2.5′)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleItemPositionChange('x', parseFloat((containerDims.length / 2).toFixed(1)));
                      handleItemPositionChange('y', parseFloat((containerDims.width / 2).toFixed(1)));
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-750 transition-colors"
                  >
                    Center Alignment
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Notes Field */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
              Cultivator Notes
            </label>
            <textarea
              value={currentItem.notes || ''}
              onChange={e => {
                if (currentItem) {
                  onUpdateItem({
                    ...currentItem,
                    notes: e.target.value
                  }, selectedParentTentId);
                }
              }}
              placeholder="Log nutrient feedings, training techniques, or observations..."
              className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
        </div>

        {/* Location & Move Card */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
              Placement Location
            </span>
            <div className="text-xs text-zinc-300 space-y-2">
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Current Container:</span>
                <span className="font-semibold text-emerald-400">{parentName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Category:</span>
                <span className="font-mono capitalize text-zinc-200">{currentItem.category}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400">
            <span>All changes automatically saved to browser storage.</span>
          </div>
        </div>
      </div>

      {/* SPECIFIC ACTIONS & GAUGES BASED ON ITEM TYPE */}
      <PlantCard {...props} />

      <MushroomCard {...props} />

      <EquipmentCard {...props} />

      {/* SPECIFIC ACTIONS & GAUGES FOR PERSON */}
      {currentItem.category === 'person' && (() => {
        const person = currentItem as PersonItem;
        return (
          <div className="space-y-4">
            <NpcDossier
              person={person}
              room={room}
              selectedParentTentId={selectedParentTentId}
              onUpdatePerson={(updated) => onUpdateItem(updated, selectedParentTentId)}
              onUpdateRoom={onUpdateRoom}
              onAddHarvestsToFacility={onAddHarvestsToFacility}
              simTime={simTime || Date.now()}
            />

            {/* Removal Button Banner */}
            <div className="flex items-center justify-between p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-rose-300 block">Remove Person from Facility</span>
                <span className="text-[11px] text-zinc-400">Biological respiration, worker routines, and body heat emission will immediately stop.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950/40"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Person</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* SPECIFIC ACTIONS & GAUGES FOR PET */}
      {currentItem.category === 'pet' && (() => {
        const pet = currentItem as PetItem;
        return (
          <div className="bg-zinc-950/80 border border-rose-950 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                {pet.petType === 'cat' ? <Cat className="w-5 h-5 text-rose-400" /> : <Dog className="w-5 h-5 text-rose-400" />}
                <h4 className="text-sm font-bold text-zinc-100">Biological Pet Companion &amp; Respiration</h4>
              </div>
              <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
                {pet.petType.replace('_', ' ')}
              </span>
            </div>

            {/* Pet Telemetry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>CO₂ Exhalation Rate</span>
                  <span className="font-mono font-bold text-rose-400">{pet.co2RateLitersPerHour} L/hr</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Naturally exhales carbon dioxide into {parentName} during breath cycles.
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Body Warmth</span>
                  <span className="font-mono font-bold text-amber-400">{pet.heatOutputWatts} Watts</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Radiates warm body temperature into the ambient air.
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Respiration Vapor</span>
                  <span className="font-mono font-bold text-cyan-400">{pet.moistureLitersPerDay} L/day</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Exhaled breath vapor slightly modulates indoor humidity.
                </div>
              </div>
            </div>

            {/* Pet Type Selector */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 space-y-2">
              <label className="text-xs font-semibold text-zinc-200 block">
                Adjust Pet Classification:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { type: 'dog_large', label: 'Large Dog (50-85 lbs)', co2: 10, watts: 45, moisture: 0.6 },
                  { type: 'dog_medium', label: 'Medium Dog (25-50 lbs)', co2: 6, watts: 28, moisture: 0.4 },
                  { type: 'dog_small', label: 'Small Dog (<25 lbs)', co2: 3.5, watts: 18, moisture: 0.25 },
                  { type: 'cat', label: 'Domestic Cat (8-15 lbs)', co2: 2.2, watts: 12, moisture: 0.18 },
                ].map(spec => (
                  <button
                    key={spec.type}
                    type="button"
                    onClick={() => {
                      onUpdateItem({
                        ...pet,
                        petType: spec.type as PetType,
                        co2RateLitersPerHour: spec.co2,
                        heatOutputWatts: spec.watts,
                        moistureLitersPerDay: spec.moisture,
                        notes: `Pet occupant (${spec.label}) exhaling ~${spec.co2} L/hr CO₂ with ${spec.watts}W heat.`
                      }, selectedParentTentId);
                    }}
                    className={`p-2 rounded-xl text-xs text-left border transition-all ${
                        pet.petType === spec.type
                          ? 'bg-rose-950 border-rose-500 text-rose-200 ring-1 ring-rose-500'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                  >
                    <span className="font-semibold block">{spec.label.split(' ')[0]} {spec.label.split(' ')[1]}</span>
                    <span className="font-mono text-[10px] text-zinc-400 block mt-0.5">{spec.co2} L/h · {spec.watts}W</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Removal Button Banner */}
            <div className="flex items-center justify-between p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-rose-300 block">Remove Pet from Facility</span>
                <span className="text-[11px] text-zinc-400">Biological respiration and body heat emission will immediately stop.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-950/40"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Pet</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              Delete {currentItem.name}?
            </h3>
            <p className="text-sm text-zinc-400 mt-2">
              Are you sure you want to remove this {currentItem.category} from {parentName}?
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
                  onDeleteItem(currentItem!.id, selectedParentTentId);
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

      {/* Delete Room Confirmation Modal */}
      {showDeleteRoomConfirm && onDeleteRoom && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              Delete Room: {room.name}?
            </h3>
            <p className="text-sm text-zinc-400 mt-2">
              Are you sure you want to delete this room? All {room.tents.length} tents, crops, mushrooms, and equipment located in this room will be permanently removed.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteRoomConfirm(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRoom(room.id);
                  setShowDeleteRoomConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors shadow-lg shadow-rose-900/30"
              >
                Confirm Delete Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3D Crop Growth Timelapse Modal */}
      {show3dGrowthTimelapse && currentItem && (currentItem.category === 'plant' || currentItem.category === 'mushroom') && (
        <CropGrowth3DViewer
          crop={currentItem as PlantItem | MushroomItem}
          isOpen={show3dGrowthTimelapse}
          onClose={() => setShow3dGrowthTimelapse(false)}
          onApplyStage={(stage, progress) => {
            if (currentItem!.category === 'plant') {
              onUpdateItem({
                ...currentItem!,
                stage: stage as PlantStage,
                stageProgress: Math.round(progress)
              }, selectedParentTentId);
            } else {
              onUpdateItem({
                ...currentItem!,
                stage: stage as MushroomItem['stage'],
                stageProgress: Math.round(progress)
              }, selectedParentTentId);
            }
          }}
        />
      )}
    </div>
  );
};

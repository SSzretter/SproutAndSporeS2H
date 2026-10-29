import React, { useState } from 'react';
import { Tent, Item, EquipmentItem, Dimensions } from '../types/sim';
import { clampItemPosition } from '../utils/spatial';
import { getRackDimensions } from '../utils/growRacks';
import { RoomPanel } from './inspector/RoomPanel';
import { TentPanel } from './inspector/TentPanel';
import { ItemPanel } from './inspector/ItemPanel';
import type { ItemInspectorProps, InspectorContext } from './inspector/types';

export const ItemInspector: React.FC<ItemInspectorProps> = ({
  room,
  rooms = [],
  outdoorCo2Ppm = 420,
  selectedType,
  selectedId,
  selectedParentTentId,
  tempUnit,
  simTime,
  onLogJournalEntry,
  onUpdateRoom,
  onUpdateTent,
  onUpdateItem,
  onDeleteTent,
  onDeleteItem,
  onDeleteRoom,
  onOpenAddRoom,
  onOpenLocationModal,
  onSelectRoom,
  onSelectTent,
  onSelectItem,
  onOpenAddItem,
  onHarvestPlant,
  onHarvestMushroom,
  onAddHarvestsToFacility,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'tents' | 'plants' | 'mushrooms' | 'equipment' | 'people' | 'pets'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteRoomConfirm, setShowDeleteRoomConfirm] = useState(false);
  const [quickItemToDelete, setQuickItemToDelete] = useState<{ id: string; name: string; kind: 'tent' | 'item'; parentTentId?: string | null } | null>(null);
  const [show3dGrowthTimelapse, setShow3dGrowthTimelapse] = useState(false);

  // Find currently selected tent if any
  let currentTent: Tent | undefined = undefined;
  if (selectedType === 'tent') {
    currentTent = room.tents.find(t => t.id === selectedId);
  } else if (selectedParentTentId) {
    currentTent = room.tents.find(t => t.id === selectedParentTentId);
  }

  // Find currently selected item if any
  let currentItem: Item | undefined = undefined;
  if (selectedType === 'item') {
    if (selectedParentTentId && currentTent) {
      currentItem = currentTent.items.find(i => i.id === selectedId);
    } else {
      currentItem = room.items.find(i => i.id === selectedId);
    }
  }

  // Dimension change helper for Room
  const handleRoomDimensionChange = (key: keyof Dimensions, value: number) => {
    if (isNaN(value) || value <= 0) return;
    onUpdateRoom({
      ...room,
      dimensions: {
        ...room.dimensions,
        [key]: parseFloat(value.toFixed(1))
      }
    });
  };

  // Dimension change helper for Tent
  const handleTentDimensionChange = (key: keyof Dimensions, value: number) => {
    if (!currentTent || isNaN(value) || value <= 0) return;
    onUpdateTent({
      ...currentTent,
      dimensions: {
        ...currentTent.dimensions,
        [key]: parseFloat(value.toFixed(1))
      }
    });
  };

  // Dimension change helper for Item
  // Crops (plants & mushrooms) edit their pot/container size; their overall dimensions are derived from it plus growth.
  const handleItemDimensionChange = (key: keyof Dimensions, value: number) => {
    if (!currentItem || isNaN(value) || value <= 0) return;
    if (currentItem.category === 'plant' || currentItem.category === 'mushroom') {
      const container = currentItem.containerDimensions || currentItem.dimensions;
      onUpdateItem({
        ...currentItem,
        containerDimensions: {
          ...container,
          [key]: parseFloat(value.toFixed(2))
        }
      }, selectedParentTentId);
      return;
    }
    if (currentItem.category === 'equipment' && currentItem.type === 'grow_rack') {
      const eq = currentItem as EquipmentItem;
      if (key === 'height') {
        const tierCount = Math.max(1, eq.rackTiers?.length || 1);
        const spacing = Math.max(0.4, Math.min(2.5, (value - 0.33) / tierCount));
        const updated = { ...eq, rackTierSpacingFt: parseFloat(spacing.toFixed(2)) };
        onUpdateItem({ ...updated, dimensions: getRackDimensions(updated) }, selectedParentTentId);
        return;
      }
      onUpdateItem({
        ...currentItem,
        dimensions: {
          ...currentItem.dimensions,
          [key]: parseFloat(value.toFixed(2))
        }
      }, selectedParentTentId);
      return;
    }
    onUpdateItem({
      ...currentItem,
      dimensions: {
        ...currentItem.dimensions,
        [key]: parseFloat(value.toFixed(1))
      }
    }, selectedParentTentId);
  };

  // Position change helper for Tent
  const handleTentPositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!currentTent || isNaN(value)) return;
    const currentPos = currentTent.position || { x: 2.5, y: 2.0, z: 0 };
    onUpdateTent({
      ...currentTent,
      position: {
        ...currentPos,
        [axis]: Math.max(0, parseFloat(value.toFixed(1)))
      }
    });
  };

  // Position change helper for Item
  const handleItemPositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!currentItem || isNaN(value)) return;
    const currentPos = currentItem.position || { x: 1.0, y: 1.0, z: 0 };
    const containerDims = currentTent ? currentTent.dimensions : room.dimensions;
    onUpdateItem({
      ...currentItem,
      position: clampItemPosition(
        { ...currentPos, [axis]: Math.max(0, parseFloat(value.toFixed(1))) },
        currentItem.dimensions,
        containerDims
      )
    }, selectedParentTentId);
  };

  const ctx: InspectorContext = {
    room, rooms, outdoorCo2Ppm, selectedType, selectedId, selectedParentTentId, tempUnit, simTime, onLogJournalEntry,
    onUpdateRoom, onUpdateTent, onUpdateItem, onDeleteTent, onDeleteItem, onDeleteRoom, onOpenAddRoom, onOpenLocationModal,
    onSelectRoom, onSelectTent, onSelectItem, onOpenAddItem, onHarvestPlant, onHarvestMushroom, onAddHarvestsToFacility,
    isEditingName, setIsEditingName, editedName, setEditedName, filterTab, setFilterTab,
    showDeleteConfirm, setShowDeleteConfirm, showDeleteRoomConfirm, setShowDeleteRoomConfirm,
    quickItemToDelete, setQuickItemToDelete, show3dGrowthTimelapse, setShow3dGrowthTimelapse,
    currentTent, currentItem,
    handleRoomDimensionChange, handleTentDimensionChange, handleItemDimensionChange, handleTentPositionChange, handleItemPositionChange,
  };

  // 1. RENDER INSPECTOR WHEN ROOM IS SELECTED
  if (selectedType === 'room' || (!selectedType && selectedId === room.id)) {
    return <RoomPanel {...ctx} />;
  }

  // 2. RENDER INSPECTOR WHEN TENT IS SELECTED
  if (selectedType === 'tent' && currentTent) {
    return <TentPanel {...ctx} currentTent={currentTent} />;
  }

  // 3. RENDER INSPECTOR WHEN SPECIFIC ITEM IS SELECTED
  if (selectedType === 'item' && currentItem) {
    return <ItemPanel {...ctx} currentItem={currentItem} />;
  }

  return null;
};

import React from 'react';
import {
  Room,
  Tent,
  Item,
  PlantItem,
  MushroomItem,
  EquipmentItem,
  Dimensions,
  Climate,
  EquipmentControlMode,
  EquipmentAutoTriggers,
  JournalEntry,
  JournalCategory,
  HarvestRecord,
  StageConditionRequirements,
} from '../../types/sim';
import { evaluatePlantStageSuitability } from '../../utils/plantLifecycle';

export interface ItemInspectorProps {
  room: Room;
  rooms?: Room[];
  outdoorCo2Ppm?: number;
  selectedType: 'room' | 'tent' | 'item' | null;
  selectedId: string | null;
  selectedParentTentId?: string | null;
  tempUnit: 'F' | 'C';
  onUpdateRoom: (room: Room) => void;
  onUpdateTent: (tent: Tent) => void;
  onUpdateItem: (item: Item, parentTentId?: string | null) => void;
  onDeleteTent: (tentId: string) => void;
  onDeleteItem: (itemId: string, parentTentId?: string | null) => void;
  onDeleteRoom?: (roomId: string) => void;
  onOpenAddRoom?: () => void;
  onOpenLocationModal?: () => void;
  onSelectRoom: () => void;
  onSelectTent: (tentId: string) => void;
  onSelectItem: (itemId: string, parentTentId?: string | null) => void;
  onOpenAddItem: (tentId?: string, rackId?: string) => void; // rackId: open on the Plant tab, sowing into that grow rack
  onHarvestPlant: (plant: PlantItem, tentId?: string) => void;
  onHarvestMushroom: (mushroom: MushroomItem, tentId?: string) => void;
  onAddHarvestsToFacility?: (harvests: HarvestRecord[]) => void;
  simTime?: number;
  onLogJournalEntry?: (entry: { title: string; message: string; type: JournalEntry['type']; category?: JournalCategory }) => void;
}

export type InspectorFilterTab = 'all' | 'tents' | 'plants' | 'mushrooms' | 'equipment' | 'people' | 'pets';

export interface QuickItemToDelete {
  id: string;
  name: string;
  kind: 'tent' | 'item';
  parentTentId?: string | null;
}

// Everything the ItemInspector shell owns (props with defaults applied, UI state, selection and edit helpers),
// passed down to each section component.
export interface InspectorContext extends Omit<ItemInspectorProps, 'rooms' | 'outdoorCo2Ppm'> {
  rooms: Room[];
  outdoorCo2Ppm: number;
  isEditingName: boolean;
  setIsEditingName: React.Dispatch<React.SetStateAction<boolean>>;
  editedName: string;
  setEditedName: React.Dispatch<React.SetStateAction<string>>;
  filterTab: InspectorFilterTab;
  setFilterTab: React.Dispatch<React.SetStateAction<InspectorFilterTab>>;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  showDeleteRoomConfirm: boolean;
  setShowDeleteRoomConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  quickItemToDelete: QuickItemToDelete | null;
  setQuickItemToDelete: React.Dispatch<React.SetStateAction<QuickItemToDelete | null>>;
  show3dGrowthTimelapse: boolean;
  setShow3dGrowthTimelapse: React.Dispatch<React.SetStateAction<boolean>>;
  currentTent?: Tent;
  currentItem?: Item;
  handleRoomDimensionChange: (key: keyof Dimensions, value: number) => void;
  handleTentDimensionChange: (key: keyof Dimensions, value: number) => void;
  handleItemDimensionChange: (key: keyof Dimensions, value: number) => void;
  handleTentPositionChange: (axis: 'x' | 'y' | 'z', value: number) => void;
  handleItemPositionChange: (axis: 'x' | 'y' | 'z', value: number) => void;
}

export type TentSectionProps = InspectorContext & { currentTent: Tent };
export type ItemSectionProps = InspectorContext & { currentItem: Item };

export type RoomListEntry = (Tent & { kind: 'tent' }) | (Item & { kind: 'item' });

// Values computed at the top of each panel and shared with its sub-sections.
export interface RoomLocals {
  roomVolume: number;
  allRoomItems: RoomListEntry[];
  filteredItems: RoomListEntry[];
}

export interface TentLocals {
  tentVol: number;
  isShroomTent: boolean;
  filteredTentItems: Item[];
}

export interface PlantMilestone {
  id: string;
  label: string;
  date?: number;
  icon: string;
  reached: boolean;
}

export interface PlantLocals {
  plant: PlantItem;
  enclosureClimate: Climate;
  isSeed: boolean;
  growLight: EquipmentItem | undefined;
  photoperiodHours: number;
  suitability: ReturnType<typeof evaluatePlantStageSuitability>;
  expectedDays: number;
  currentStageDays: number;
  req: StageConditionRequirements;
  milestones: PlantMilestone[];
}

export interface EquipmentLocals {
  eq: EquipmentItem;
  currentMode: EquipmentControlMode;
  triggers: EquipmentAutoTriggers;
  formatHour: (h: number) => string;
  onH: number;
  offH: number;
  dayLength: number;
  nightLength: number;
}

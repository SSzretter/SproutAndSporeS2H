import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  SimulationState, 
  Room, 
  Tent, 
  Item, 
  PlantItem, 
  MushroomItem, 
  EquipmentItem,
  HarvestRecord,
  JournalEntry,
  JournalCategory
} from '../../types/sim';
import { GameScene, HoverTarget, FloatingText, Doorway, PlayerState } from '../game3d/GameScene';
import { itemWorldPosition, tentWorldOrigin, Vec3 } from '../game3d/coords';
import { soundEffects } from './AudioEffects';
import { PlantVisualizerModal } from './PlantVisualizerModal';
import { TentInspectorModal } from './TentInspectorModal';
import { PlayerInventoryModal } from './PlayerInventoryModal';
import { ItemInspector } from '../ItemInspector';
import { broadcastSimulationState } from '../../utils/syncChannel';
import { migrateHumidifierDucting } from '../../utils/humidifierDucting';
import { 
  Volume2, 
  VolumeX, 
  Monitor, 
  ExternalLink, 
  Play, 
  Pause, 
  FastForward, 
  Layers, 
  Sparkles, 
  Droplets, 
  Scissors, 
  Plus, 
  Search, 
  ArrowLeft, 
  Award, 
  Package, 
  ChevronRight, 
  Maximize2,
  X,
  Box,
  Home,
  Sliders
} from 'lucide-react';

// Walking speed of the cultivator: ~6 ft/s at 60 ticks per second
const WALK_SPEED_FT_PER_TICK = 0.1;
// How far (ft, beyond a crop's footprint edge) the cultivator can reach with E / Space
const REACH_FT = 3;
// Doorways are 3ft wide openings centered on the left/right walls
const DOOR_HALF_WIDTH_FT = 1.5;

/** Where the cultivator appears when entering a room: front-center of the floor. */
function getSpawnPoint(room: Room) {
  const x = room.dimensions.length / 2;
  const y = room.dimensions.width * 0.75;
  return { x, y, targetX: x, targetY: y };
}

interface GameWorldProps {
  state: SimulationState;
  onUpdateState: (updater: (prev: SimulationState) => SimulationState) => void;
  onOpenAddItem: (tentId?: string) => void;
  onOpenAddRoom: () => void;
  onOpenHarvestModal: () => void;
  onSwitchToDashboard: () => void;
  onUpdateRoom?: (room: Room) => void;
  onUpdateTent?: (tent: Tent) => void;
  onUpdateItem?: (item: Item, parentTentId?: string | null) => void;
  onDeleteTent?: (tentId: string) => void;
  onDeleteItem?: (itemId: string, parentTentId?: string | null) => void;
  onDeleteRoom?: (roomId: string) => void;
  onHarvestPlant?: (plant: PlantItem, tentId?: string) => void;
  onHarvestMushroom?: (mushroom: MushroomItem, tentId?: string) => void;
  onLogJournalEntry?: (entry: { title: string; message: string; type: JournalEntry['type']; category?: JournalCategory }) => void;
}

type ToolType = 'inspect' | 'water' | 'harvest' | 'feed' | 'mist' | 'build';

export const GameWorld: React.FC<GameWorldProps> = ({
  state,
  onUpdateState,
  onOpenAddItem,
  onOpenAddRoom,
  onOpenHarvestModal,
  onSwitchToDashboard,
  onUpdateRoom,
  onUpdateTent,
  onUpdateItem,
  onDeleteTent,
  onDeleteItem,
  onDeleteRoom,
  onHarvestPlant,
  onHarvestMushroom,
  onLogJournalEntry
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const cameraYawRef = useRef(0);

  // Sound state
  const [isMuted, setIsMuted] = useState(() => soundEffects.isMuted());
  const toggleMute = () => {
    const next = soundEffects.toggleMute();
    setIsMuted(next);
  };

  // Selected tool hotbar
  const [activeTool, setActiveTool] = useState<ToolType>('inspect');

  // Currently inspected crop in modal
  const [inspectedCrop, setInspectedCrop] = useState<{
    item: PlantItem | MushroomItem;
    parentTentId?: string;
  } | null>(null);

  // Player cultivator avatar state (room-floor feet)
  const playerRef = useRef<PlayerState>({
    ...getSpawnPoint((state.rooms && state.rooms.find(r => r.id === (state.activeRoomId || state.room.id))) || state.room),
    facing: 0,
    isMoving: false,
    walkFrame: 0,
    stepTimer: 0
  });

  // Currently inspected target in the In-Game Pro Inspector (Tent, Item, or Room)
  const [inGameInspectorTarget, setInGameInspectorTarget] = useState<{
    type: 'tent' | 'item' | 'room';
    id: string;
    parentTentId?: string | null;
  } | null>(null);

  // Player Harvest Inventory Modal state
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  // Tent, Item, and Room update & delete handlers for 3D game mode
  const handleUpdateTentFromGame = (updatedTent: Tent) => {
    if (onUpdateTent) {
      onUpdateTent(updatedTent);
    } else {
      onUpdateState(prev => {
        const activeRId = prev.activeRoomId || prev.room.id;
        const rooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
        const nextRooms = rooms.map(rm => {
          if (!rm.tents.some(t => t.id === updatedTent.id)) return rm;
          return {
            ...rm,
            tents: rm.tents.map(t => t.id === updatedTent.id ? updatedTent : t)
          };
        });
        const nextActiveRoom = nextRooms.find(r => r.id === activeRId) || nextRooms[0];
        const nextState: SimulationState = {
          ...prev,
          rooms: nextRooms,
          room: nextActiveRoom
        };
        broadcastSimulationState(nextState);
        return nextState;
      });
    }
  };

  const handleDeleteTentFromGame = (tentId: string) => {
    if (onDeleteTent) {
      onDeleteTent(tentId);
    } else {
      onUpdateState(prev => {
        const activeRId = prev.activeRoomId || prev.room.id;
        const rooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
        const nextRooms = rooms.map(rm => {
          if (!rm.tents.some(t => t.id === tentId)) return rm;
          // Unlink any humidifier hoses that fed the removed tent
          return migrateHumidifierDucting({
            ...rm,
            tents: rm.tents.filter(t => t.id !== tentId)
          });
        });
        const nextActiveRoom = nextRooms.find(r => r.id === activeRId) || nextRooms[0];
        const nextState: SimulationState = {
          ...prev,
          rooms: nextRooms,
          room: nextActiveRoom
        };
        broadcastSimulationState(nextState);
        return nextState;
      });
    }
    setInGameInspectorTarget(null);
  };

  const handleUpdateItemFromGame = (updatedItem: Item, parentTentId?: string | null) => {
    if (onUpdateItem) {
      onUpdateItem(updatedItem, parentTentId);
    } else {
      onUpdateState(prev => {
        const activeRId = prev.activeRoomId || prev.room.id;
        const rooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
        const nextRooms = rooms.map(rm => {
          if (parentTentId) {
            if (!rm.tents.some(t => t.id === parentTentId)) return rm;
            return {
              ...rm,
              tents: rm.tents.map(t => {
                if (t.id === parentTentId) {
                  return {
                    ...t,
                    items: t.items.map(it => it.id === updatedItem.id ? updatedItem : it)
                  };
                }
                return t;
              })
            };
          } else {
            if (!rm.items.some(it => it.id === updatedItem.id)) return rm;
            return {
              ...rm,
              items: rm.items.map(it => it.id === updatedItem.id ? updatedItem : it)
            };
          }
        });
        const nextActiveRoom = nextRooms.find(r => r.id === activeRId) || nextRooms[0];
        const nextState: SimulationState = {
          ...prev,
          rooms: nextRooms,
          room: nextActiveRoom
        };
        broadcastSimulationState(nextState);
        return nextState;
      });
    }
  };

  const handleDeleteItemFromGame = (itemId: string, parentTentId?: string | null) => {
    if (onDeleteItem) {
      onDeleteItem(itemId, parentTentId);
    } else {
      onUpdateState(prev => {
        const next = removeCropFromSimulation(prev, itemId, parentTentId || undefined);
        broadcastSimulationState(next);
        return next;
      });
    }
    if (parentTentId) {
      setInGameInspectorTarget({ type: 'tent', id: parentTentId, parentTentId: null });
    } else {
      setInGameInspectorTarget(null);
    }
  };

  const handleUpdateRoomFromGame = (updatedRoom: Room) => {
    if (onUpdateRoom) {
      onUpdateRoom(updatedRoom);
    } else {
      onUpdateState(prev => {
        const rooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
        const nextRooms = rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);
        const nextState: SimulationState = {
          ...prev,
          rooms: nextRooms,
          room: prev.activeRoomId === updatedRoom.id ? updatedRoom : prev.room
        };
        broadcastSimulationState(nextState);
        return nextState;
      });
    }
  };

  const handleDeleteRoomFromGame = (roomId: string) => {
    if (onDeleteRoom) {
      onDeleteRoom(roomId);
    }
    setInGameInspectorTarget(null);
  };

  // Hovered interactable object in the 3D world (the tooltip follows the mouse)
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);

  // Floating notifications / action popups (e.g. "+30% Hydrated", "Harvested 85g!"), anchored in room feet
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);

  const addFloatingText = (text: string, x: number, y: number, color = '#34d399') => {
    const id = `float-${Date.now()}-${Math.random()}`;
    setFloatingTexts(prev => [...prev, { id, text, x, y, color, createdAt: Date.now() }]);
  };

  // Active room reference
  const currentRoom = (state.rooms && state.rooms.find(r => r.id === (state.activeRoomId || state.room.id))) || state.room;
  const allRooms = state.rooms && state.rooms.length > 0 ? state.rooms : [state.room];

  // Immediate notification when a new item is added to any tent or room
  const prevItemsTotalRef = useRef<number>(-1);
  useEffect(() => {
    const totalItems = currentRoom.items.length + currentRoom.tents.reduce((sum, t) => sum + t.items.length, 0);
    if (prevItemsTotalRef.current !== -1 && totalItems > prevItemsTotalRef.current) {
      soundEffects.playClick();
      addFloatingText('✨ New Item Added to Facility!', playerRef.current.x, playerRef.current.y, '#34d399');
    }
    prevItemsTotalRef.current = totalItems;
  }, [currentRoom]);

  // Travel to room helper
  const handleTravelToRoom = (roomId: string) => {
    soundEffects.playDoor();
    onUpdateState(prev => {
      const targetRoom = (prev.rooms && prev.rooms.find(r => r.id === roomId)) || prev.room;
      const nextState: SimulationState = {
        ...prev,
        activeRoomId: roomId,
        room: targetRoom,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'action',
            category: 'general',
            title: 'Cultivator Traveled Rooms',
            message: `Walked through facility corridor into ${targetRoom.name}.`
          }
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
    // Enter the new room at its front-center
    const targetRoom = allRooms.find(r => r.id === roomId);
    if (targetRoom) Object.assign(playerRef.current, getSpawnPoint(targetRoom));
  };

  // Keyboard navigation (WASD / Arrows + Hotkeys 1-6 + E / Space)
  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture inputs if typing inside an input/textarea/select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'Escape') {
        if (inGameInspectorTarget) {
          setInGameInspectorTarget(null);
          return;
        }
        if (inspectedCrop) {
          setInspectedCrop(null);
          return;
        }
        if (isInventoryOpen) {
          setIsInventoryOpen(false);
          return;
        }
      }

      // If an inspection modal is open, avoid hotkey / movement interference
      if (inGameInspectorTarget || inspectedCrop || isInventoryOpen) return;

      keysPressed[e.key.toLowerCase()] = true;

      // Hotbar tool shortcuts
      if (e.key === '1') setActiveTool('inspect');
      if (e.key === '2') setActiveTool('water');
      if (e.key === '3') setActiveTool('harvest');
      if (e.key === '4') setActiveTool('feed');
      if (e.key === '5') setActiveTool('mist');
      if (e.key === '6') setActiveTool('build');

      // Interaction key [E] or [Space]
      if (e.key.toLowerCase() === 'e' || e.key === ' ') {
        e.preventDefault();
        triggerProximityAction();
      }

      // [T] to inspect nearby tent properties & internal items
      if (e.key.toLowerCase() === 't') {
        inspectNearbyTent();
      }

      // [I] to toggle Player Harvest Inventory
      if (e.key.toLowerCase() === 'i') {
        setIsInventoryOpen(prev => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Continuous movement loop (room feet). WASD moves relative to the camera's view direction.
    const moveInterval = setInterval(() => {
      const p = playerRef.current;

      if (inGameInspectorTarget || inspectedCrop || isInventoryOpen) {
        p.isMoving = false;
        return;
      }

      let forward = 0;
      let strafe = 0;
      if (keysPressed['w'] || keysPressed['arrowup']) forward += 1;
      if (keysPressed['s'] || keysPressed['arrowdown']) forward -= 1;
      if (keysPressed['d'] || keysPressed['arrowright']) strafe += 1;
      if (keysPressed['a'] || keysPressed['arrowleft']) strafe -= 1;
      const usingKeys = forward !== 0 || strafe !== 0;

      let dx = 0;
      let dy = 0;
      if (usingKeys) {
        // Camera sits at (sin yaw, cos yaw) from its target: forward = away from it, right = (cos, -sin)
        const yaw = cameraYawRef.current;
        dx = -Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
        dy = -Math.cos(yaw) * forward - Math.sin(yaw) * strafe;
        const len = Math.hypot(dx, dy) || 1;
        dx = (dx / len) * WALK_SPEED_FT_PER_TICK;
        dy = (dy / len) * WALK_SPEED_FT_PER_TICK;
      } else {
        // Walk toward the clicked floor target
        const dist = Math.hypot(p.targetX - p.x, p.targetY - p.y);
        if (dist > 0.1) {
          const step = Math.min(WALK_SPEED_FT_PER_TICK, dist);
          dx = ((p.targetX - p.x) / dist) * step;
          dy = ((p.targetY - p.y) / dist) * step;
        }
      }

      if (dx === 0 && dy === 0) {
        p.isMoving = false;
        return;
      }

      const margin = 0.6;
      const clampX = (x: number) => Math.max(margin, Math.min(currentRoom.dimensions.length - margin, x));
      const clampY = (y: number) => Math.max(margin, Math.min(currentRoom.dimensions.width - margin, y));
      // Tents are solid: try the full step, then slide along whichever axis is free
      const candidates = [[p.x + dx, p.y + dy], [p.x + dx, p.y], [p.x, p.y + dy]];
      // (If already standing inside a tent, e.g. spawned there, let the cultivator walk out.)
      const startsInside = isInsideTent(p.x, p.y);
      const next = candidates.map(([x, y]) => [clampX(x), clampY(y)]).find(([x, y]) => startsInside || !isInsideTent(x, y));
      if (!next || (next[0] === p.x && next[1] === p.y)) {
        // Fully blocked: stop walking toward an unreachable click target
        p.targetX = p.x;
        p.targetY = p.y;
        p.isMoving = false;
        return;
      }
      dx = next[0] - p.x;
      dy = next[1] - p.y;
      p.x = next[0];
      p.y = next[1];
      if (usingKeys) {
        p.targetX = p.x;
        p.targetY = p.y;
      }
      p.facing = Math.atan2(dx, dy);
      p.isMoving = true;
      p.walkFrame += 0.2;
      p.stepTimer += 1;
      if (p.stepTimer > 14) {
        p.stepTimer = 0;
        soundEffects.playStep();
      }

      // Walking into a doorway travels to the room beyond it
      const door = getDoorwayAt(p.x, p.y);
      if (door && door.roomId !== 'ADD_ROOM') {
        handleTravelToRoom(door.roomId);
      }
    }, 1000 / 60);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveInterval);
    };
  }, [currentRoom, inGameInspectorTarget, inspectedCrop, isInventoryOpen]);

  // Proximity action: find nearest interactable crop (within reach of its footprint) or tent
  const triggerProximityAction = () => {
    const p = playerRef.current;
    const candidates: Array<{ item: Item; tent?: Tent }> = [
      ...currentRoom.tents.flatMap(tent => tent.items.map(item => ({ item, tent }))),
      ...currentRoom.items.map(item => ({ item, tent: undefined }))
    ];

    let closest: { item: PlantItem | MushroomItem; tentId?: string; dist: number; x: number; y: number } | null = null;
    for (const { item, tent } of candidates) {
      if (item.category !== 'plant' && item.category !== 'mushroom') continue;
      const [x, , y] = itemWorldPosition(item, currentRoom, tent);
      const dist = Math.hypot(p.x - x, p.y - y);
      const reach = REACH_FT + Math.max(item.dimensions.length, item.dimensions.width) / 2;
      if (dist < reach && (!closest || dist < closest.dist)) {
        closest = { item, tentId: tent?.id, dist, x, y };
      }
    }

    if (closest) {
      applyToolToCrop(closest.item, closest.tentId, closest.x, closest.y);
      return;
    }

    // Otherwise inspect nearest tent
    inspectNearbyTent();
  };

  const inspectNearbyTent = () => {
    const p = playerRef.current;
    let closestTent: Tent | null = null;
    let minDist = Infinity;

    for (const tent of currentRoom.tents) {
      const [ox, , oz] = tentWorldOrigin(tent, currentRoom);
      const cx = ox + tent.dimensions.length / 2;
      const cy = oz + tent.dimensions.width / 2;
      const dist = Math.hypot(p.x - cx, p.y - cy);
      const reach = REACH_FT + Math.max(tent.dimensions.length, tent.dimensions.width) / 2;
      if (dist < reach && dist < minDist) {
        minDist = dist;
        closestTent = tent;
      }
    }

    if (closestTent) {
      soundEffects.playClick();
      setInGameInspectorTarget({
        type: 'tent',
        id: closestTent.id,
        parentTentId: null
      });
      addFloatingText('Opening Tent & Items Inspector ⛺', playerRef.current.x, playerRef.current.y, '#6ee7b7');
    }
  };

  // Apply active hotbar tool to a crop
  const applyToolToCrop = (
    crop: PlantItem | MushroomItem, 
    tentId?: string, 
    popupX?: number, 
    popupY?: number
  ) => {
    const px = popupX ?? playerRef.current.x;
    const py = popupY ?? playerRef.current.y;

    if (activeTool === 'inspect') {
      soundEffects.playClick();
      setInspectedCrop({ item: crop, parentTentId: tentId });
    } else if (activeTool === 'water') {
      soundEffects.playWater();
      onUpdateState(prev => {
        const next = updateCropInSimulation(prev, crop.id, tentId, (item) => {
          if (item.category === 'plant') {
            const p = item as PlantItem;
            return {
              ...p,
              soilMoisture: Math.min(100, Math.round(p.soilMoisture + 35)),
              health: Math.min(100, Math.round(p.health + 3))
            };
          } else if (item.category === 'mushroom') {
            const m = item as MushroomItem;
            return {
              ...m,
              substrateMoisture: Math.min(100, Math.round(m.substrateMoisture + 30)),
              health: Math.min(100, Math.round(m.health + 4))
            };
          }
          return item;
        });
        next.journal.push({
          id: `j-${Date.now()}`,
          time: next.simTime,
          type: 'action',
          category: 'care',
          title: `💧 Watered ${crop.name}`,
          message: `Supplied fresh hydration via watering can. Moisture restored to optimal zone.`
        });
        broadcastSimulationState(next);
        return next;
      });
      addFloatingText('+35% Hydrated 💧', px, py, '#38bdf8');
    } else if (activeTool === 'feed') {
      soundEffects.playWater();
      onUpdateState(prev => {
        const next = updateCropInSimulation(prev, crop.id, tentId, (item) => {
          if (item.category === 'plant') {
            const p = item as PlantItem;
            return {
              ...p,
              nutrientLevel: 'balanced',
              health: Math.min(100, Math.round(p.health + 6))
            };
          }
          return item;
        });
        next.journal.push({
          id: `j-${Date.now()}`,
          time: next.simTime,
          type: 'action',
          category: 'care',
          title: `🧪 Fed Organic Nutrients: ${crop.name}`,
          message: `Administered balanced vegetative/bloom formula. Plant vitality reinforced.`
        });
        broadcastSimulationState(next);
        return next;
      });
      addFloatingText('+Nutrients & Vitality 🧪', px, py, '#a78bfa');
    } else if (activeTool === 'mist') {
      soundEffects.playWater();
      onUpdateState(prev => {
        const next = updateCropInSimulation(prev, crop.id, tentId, (item) => {
          if (item.category === 'plant') {
            const p = item as PlantItem;
            return {
              ...p,
              soilMoisture: Math.min(100, Math.round(p.soilMoisture + 10))
            };
          } else if (item.category === 'mushroom') {
            const m = item as MushroomItem;
            return {
              ...m,
              substrateMoisture: Math.min(100, Math.round(m.substrateMoisture + 15)),
              health: Math.min(100, Math.round(m.health + 3))
            };
          }
          return item;
        });
        broadcastSimulationState(next);
        return next;
      });
      addFloatingText('Fine Mist Applied 💨', px, py, '#2dd4bf');
    } else if (activeTool === 'harvest') {
      const isReady = crop.category === 'plant' 
        ? ((crop as PlantItem).stage === 'ready' || ((crop as PlantItem).stage === 'ripening' && (crop as PlantItem).stageProgress > 70))
        : ((crop as MushroomItem).stage === 'ready' || (crop as MushroomItem).stage === 'mature');

      if (!isReady) {
        soundEffects.playClick();
        addFloatingText('Not Ready to Harvest Yet! 🌱', px, py, '#f87171');
        return;
      }

      soundEffects.playHarvest();
      const yieldGrams = Math.round(crop.yieldPotentialGrams || 120);
      const quality = crop.health > 85 ? 'Legendary' : crop.health > 70 ? 'Excellent' : 'Good';
      const simDate = new Date(state.simTime);
      const dateStr = simDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = simDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const isPlant = crop.category === 'plant';
      const plantItem = isPlant ? (crop as PlantItem) : null;
      const shroomItem = !isPlant ? (crop as MushroomItem) : null;
      const strainName = plantItem?.strainName || shroomItem?.strainName;
      const containerType = plantItem?.containerType || plantItem?.systemType || shroomItem?.containerType;
      const growingMedium = plantItem?.growingMedium;
      const originTent = tentId ? currentRoom.tents.find(t => t.id === tentId) : null;

      const potencyNote = isPlant
        ? (crop.species === 'Hops' 
            ? `${plantItem?.alphaAcidsPct || 8.5}% Alpha Acids` 
            : crop.species === 'Chili Pepper' 
              ? `${(plantItem?.scovilleHeatUnits || 45000).toLocaleString()} SHU` 
              : `${crop.health > 85 ? '26%' : crop.health > 70 ? '22%' : '18%'} Cannabinoids`)
        : `${crop.health > 85 ? 'High' : 'Optimal'} Beta-Glucans`;

      const estimatedValue = Math.round(yieldGrams * (quality === 'Legendary' ? 12 : quality === 'Excellent' ? 9 : 6));

      const harvestRecord: HarvestRecord = {
        id: `h-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: crop.name,
        species: crop.species,
        strainName,
        type: isPlant ? 'plant' : 'mushroom',
        yieldGrams,
        dateStr,
        timeStr,
        timestamp: state.simTime,
        quality,
        health: crop.health,
        containerType,
        growingMedium,
        originRoomName: currentRoom.name,
        originTentName: originTent ? originTent.name : 'Room Floor / Garden',
        cureStatus: 'Fresh Cut',
        estimatedValue,
        potencyNote,
        notes: crop.notes
      };

      onUpdateState(prev => {
        const next = removeCropFromSimulation(prev, crop.id, tentId);
        next.harvests = [harvestRecord, ...prev.harvests];
        next.journal.push({
          id: `j-${Date.now()}`,
          time: next.simTime,
          type: 'success',
          category: 'crop',
          title: `🏆 Harvest Completed: ${crop.name}`,
          message: `Yielded ${yieldGrams}g (${(yieldGrams / 28.3495).toFixed(1)} oz) of ${quality} grade ${crop.species}. Added to player harvest inventory!`
        });
        broadcastSimulationState(next);
        return next;
      });

      addFloatingText(`✨ Harvested ${yieldGrams}g (${quality})!`, px, py, '#fbbf24');
    } else if (activeTool === 'build') {
      onOpenAddItem(tentId);
    }
  };

  // Helper to update crop deep in rooms/tents
  const updateCropInSimulation = (
    simState: SimulationState, 
    cropId: string, 
    tentId?: string, 
    updater?: (item: Item) => Item
  ): SimulationState => {
    if (!updater) return simState;

    const currentRooms = simState.rooms && simState.rooms.length > 0 ? simState.rooms : [simState.room];
    const activeRId = simState.activeRoomId || simState.room.id;

    const updatedRooms = currentRooms.map(rm => {
      if (rm.id !== activeRId) return rm;

      if (tentId) {
        return {
          ...rm,
          tents: rm.tents.map(t => {
            if (t.id !== tentId) return t;
            return {
              ...t,
              items: t.items.map(it => it.id === cropId ? updater(it) : it)
            };
          })
        };
      } else {
        return {
          ...rm,
          items: rm.items.map(it => it.id === cropId ? updater(it) : it)
        };
      }
    });

    const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];

    return {
      ...simState,
      rooms: updatedRooms,
      room: updatedActiveRoom
    };
  };

  // Helper to remove crop upon harvest
  const removeCropFromSimulation = (
    simState: SimulationState, 
    cropId: string, 
    tentId?: string
  ): SimulationState => {
    const currentRooms = simState.rooms && simState.rooms.length > 0 ? simState.rooms : [simState.room];
    const activeRId = simState.activeRoomId || simState.room.id;

    const updatedRooms = currentRooms.map(rm => {
      if (rm.id !== activeRId) return rm;

      if (tentId) {
        return {
          ...rm,
          tents: rm.tents.map(t => {
            if (t.id !== tentId) return t;
            return {
              ...t,
              items: t.items.filter(it => it.id !== cropId)
            };
          })
        };
      } else {
        return {
          ...rm,
          items: rm.items.filter(it => it.id !== cropId)
        };
      }
    });

    const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];

    return {
      ...simState,
      rooms: updatedRooms,
      room: updatedActiveRoom
    };
  };

  // Canvas Mouse Click handler (Walk to or interact with item)
  // ---- 3D scene interactions ----
  const handleSceneClickItem = (item: Item, tentId: string | undefined, worldPos: Vec3) => {
    const [x, , y] = worldPos;
    if (item.category === 'plant' || item.category === 'mushroom') {
      applyToolToCrop(item, tentId, x, y);
      return;
    }
    soundEffects.playClick();
    if (item.category === 'equipment' && activeTool !== 'inspect') {
      const eq = item as EquipmentItem;
      onUpdateState(prev => {
        const next = updateCropInSimulation(prev, eq.id, tentId, (it) => ({
          ...it,
          powerOn: !(it as EquipmentItem).powerOn
        }));
        broadcastSimulationState(next);
        return next;
      });
      addFloatingText(`${eq.name}: ${!eq.powerOn ? 'ON ⚡' : 'Standby / OFF'}`, x, y, !eq.powerOn ? '#34d399' : '#94a3b8');
      return;
    }
    // Equipment (with the Inspect tool), people and pets open the inspector
    setInGameInspectorTarget({ type: 'item', id: item.id, parentTentId: tentId || null });
  };

  const handleSceneHover = (next: HoverTarget | null) => {
    const idOf = (t: HoverTarget | null) => !t ? null
      : t.kind === 'item' ? t.item.id
      : t.kind === 'tent' ? t.tent.id
      : t.door.roomId;
    setHoverTarget(prev => (idOf(prev) === idOf(next) ? prev : next));
  };

  const handleSceneClickTent = (tent: Tent) => {
    soundEffects.playClick();
    setInGameInspectorTarget({ type: 'tent', id: tent.id, parentTentId: null });
  };

  const handleSceneClickDoor = (door: Doorway) => {
    if (door.roomId === 'ADD_ROOM') {
      onOpenAddRoom();
    } else {
      handleTravelToRoom(door.roomId);
    }
  };

  const handleSceneClickFloor = (x: number, y: number) => {
    playerRef.current.targetX = x;
    playerRef.current.targetY = y;
  };

  // Tooltip follows the mouse without re-rendering the scene
  const handleWorldMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    lastMouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (tooltipRef.current) {
      tooltipRef.current.style.left = `${lastMouseRef.current.x + 14}px`;
      tooltipRef.current.style.top = `${lastMouseRef.current.y - 34}px`;
    }
  };

  const hoveredId = !hoverTarget ? null
    : hoverTarget.kind === 'item' ? hoverTarget.item.id
    : hoverTarget.kind === 'tent' ? hoverTarget.tent.id
    : hoverTarget.door.roomId;

  const hoverTitle = (() => {
    if (!hoverTarget) return null;
    if (hoverTarget.kind === 'tent') return `${hoverTarget.tent.name} [Click to Edit Tent & Items]`;
    if (hoverTarget.kind === 'door') {
      return hoverTarget.door.roomId === 'ADD_ROOM' ? '➕ Add a New Room [Click]' : `${hoverTarget.door.label} [Click or Walk Through]`;
    }
    // Read the live item so the tooltip reflects changes made while hovering (e.g. power toggled)
    const item = [...currentRoom.items, ...currentRoom.tents.flatMap(t => t.items)].find(i => i.id === hoverTarget.item.id) || hoverTarget.item;
    if (item.category === 'plant' || item.category === 'mushroom') {
      return `${item.name} (${item.stage}) [Click to Inspect & Care]`;
    }
    if (item.category === 'equipment') {
      return `⚙️ ${item.name} (${item.powerOn ? 'ON' : 'OFF'} • ${item.powerWatts}W) [Inspect to Edit • Click to Toggle]`;
    }
    return `${item.category === 'person' ? '👤' : '🐾'} ${item.name} [Click to Edit]`;
  })();

  // Doorways to other rooms on the left/right walls (or an Add Room portal)
  const getRoomDoorways = (): Doorway[] => {
    const otherRooms = allRooms.filter(r => r.id !== currentRoom.id);
    const doors: Doorway[] = [];
    if (otherRooms.length > 0) {
      doors.push({ roomId: otherRooms[0].id, label: `🚪 ${otherRooms[0].name}`, side: 'left' });
    }
    if (otherRooms.length > 1) {
      doors.push({ roomId: otherRooms[1].id, label: `🚪 ${otherRooms[1].name}`, side: 'right' });
    } else {
      doors.push({ roomId: 'ADD_ROOM', label: '➕ New Room', side: 'right' });
    }
    return doors;
  };

  // Is a point inside any tent's footprint (padded by the cultivator's body radius)?
  const isInsideTent = (x: number, y: number): boolean => {
    const pad = 0.35;
    return currentRoom.tents.some(tent => {
      const [ox, , oz] = tentWorldOrigin(tent, currentRoom);
      return x > ox - pad && x < ox + tent.dimensions.length + pad && y > oz - pad && y < oz + tent.dimensions.width + pad;
    });
  };

  const getDoorwayAt = (x: number, y: number): Doorway | null => {
    const { length: L, width: W } = currentRoom.dimensions;
    if (Math.abs(y - W / 2) > DOOR_HALF_WIDTH_FT) return null;
    const side = x <= 0.7 ? 'left' : x >= L - 0.7 ? 'right' : null;
    return side ? getRoomDoorways().find(d => d.side === side) || null : null;
  };

  // Clean expired floating texts
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setFloatingTexts(prev => prev.filter(t => now - t.createdAt < 2200));
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Pop out game to second screen
  const handlePopOutToScreen2 = () => {
    soundEffects.playClick();
    const width = 1280;
    const height = 800;
    const left = window.screen.availWidth ? window.screen.availWidth : 0;
    window.open(
      window.location.origin + window.location.pathname + '#game',
      'SproutSporeGameWindow',
      `width=${width},height=${height},left=${left},top=100,resizable=yes,scrollbars=yes`
    );
  };

  return (
    <div className="relative w-full h-screen bg-zinc-950 flex flex-col select-none overflow-hidden font-sans">
      {/* Top Game Bar */}
      <header className="h-14 bg-zinc-900/90 border-b border-zinc-800 px-4 flex items-center justify-between z-20 shadow-md">
        {/* Left: Room Badge & Travel Selector */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSwitchToDashboard}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
            title="Return to Pro Telemetry Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <div className="h-5 w-px bg-zinc-800" />

          {/* Current Room Selector */}
          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800">
            <span className="text-emerald-400 text-xs">🏠</span>
            <select
              value={currentRoom.id}
              onChange={(e) => handleTravelToRoom(e.target.value)}
              className="bg-transparent text-xs font-bold text-zinc-100 outline-none cursor-pointer"
            >
              {allRooms.map(rm => (
                <option key={rm.id} value={rm.id} className="bg-zinc-900 text-zinc-200">
                  {rm.name}
                </option>
              ))}
            </select>
          </div>

          {/* Climate Metrics Quick Bar */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-amber-300">
              🌡️ {state.tempUnit === 'F' ? `${currentRoom.climate.tempF.toFixed(1)}°F` : `${currentRoom.climate.tempC.toFixed(1)}°C`}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-cyan-300">
              💧 {currentRoom.climate.rh.toFixed(1)}% RH
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-emerald-300">
              🌿 {currentRoom.climate.vpdKpa.toFixed(2)} kPa
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-purple-300">
              🌫️ {Math.round(currentRoom.climate.co2Ppm)} ppm
            </span>
          </div>
        </div>

        {/* Center: Sim Clock Controls */}
        <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1 rounded-xl border border-zinc-800">
          <span className="text-xs font-mono text-zinc-300">
            {new Date(state.simTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' '}
            {new Date(state.simTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          <button
            onClick={() => {
              soundEffects.playClick();
              onUpdateState(prev => {
                const next = { ...prev, speed: prev.speed === 0 ? 5 : 0 };
                broadcastSimulationState(next);
                return next;
              });
            }}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors"
            title={state.speed === 0 ? 'Resume Simulation' : 'Pause Simulation'}
          >
            {state.speed === 0 ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          <span className="text-[11px] font-mono font-bold text-zinc-400">
            {state.speed === 0 ? 'PAUSED' : `${state.speed}x`}
          </span>

          <button
            onClick={() => {
              soundEffects.playClick();
              onUpdateState(prev => {
                const nextSpeed = prev.speed === 1 ? 5 : prev.speed === 5 ? 30 : prev.speed === 30 ? 120 : 1;
                const next = { ...prev, speed: nextSpeed };
                broadcastSimulationState(next);
                return next;
              });
            }}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Cycle Speed (1x, 5x, 30x, 120x)"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Sound, Player Inventory, Dual-Screen Popout */}
        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              isMuted 
                ? 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300' 
                : 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
            }`}
            title={isMuted ? 'Unmute Game SFX' : 'Mute Game SFX'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Player Harvest Inventory Button (Replaces Vault Button) */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setIsInventoryOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-750/70 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm hover:scale-[1.02]"
            title="Open Cultivator Harvest Inventory [I]"
          >
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span>Inventory ({state.harvests.length})</span>
          </button>

          {/* Dual Screen Popout */}
          <button
            onClick={handlePopOutToScreen2}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-colors shadow-sm"
            title="Pop out video game to Screen 2 while keeping simulator on Screen 1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Pop Out to Screen 2 ↗</span>
          </button>
        </div>
      </header>

      {/* Main 3D World */}
      <div
        ref={containerRef}
        onMouseMove={handleWorldMouseMove}
        className={`relative flex-1 w-full bg-zinc-950 overflow-hidden ${hoverTarget ? 'cursor-pointer' : 'cursor-crosshair'}`}
      >
        <GameScene
          room={currentRoom}
          simTime={state.simTime}
          doorways={getRoomDoorways()}
          hoveredId={hoveredId}
          floatingTexts={floatingTexts}
          playerRef={playerRef}
          cameraYawRef={cameraYawRef}
          onHover={handleSceneHover}
          onClickItem={handleSceneClickItem}
          onClickTent={handleSceneClickTent}
          onClickDoor={handleSceneClickDoor}
          onClickFloor={handleSceneClickFloor}
        />

        {/* Hover Tooltip Overlay */}
        {hoverTitle && (
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none z-30 px-2.5 py-1 rounded bg-zinc-900/95 border border-zinc-700 text-zinc-100 text-xs font-semibold shadow-xl whitespace-nowrap"
            style={{ left: `${lastMouseRef.current.x + 14}px`, top: `${lastMouseRef.current.y - 34}px` }}
          >
            {hoverTitle}
          </div>
        )}

        {/* Proximity Action Prompt badge */}
        <div className="absolute top-4 left-6 z-10 bg-zinc-900/85 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 shadow-md">
          <div className="font-bold text-zinc-200 flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cultivator Controls</span>
          </div>
          <div className="space-y-0.5 text-[11px] text-zinc-400 font-mono">
            <div><span className="text-zinc-200 font-semibold">[WASD / Click floor]</span> Walk around</div>
            <div><span className="text-zinc-200 font-semibold">[Left Click]</span> Interact with objects</div>
            <div><span className="text-zinc-200 font-semibold">[Right Drag]</span> Rotate camera</div>
            <div><span className="text-zinc-200 font-semibold">[Middle Drag]</span> Pan camera (re-centers when you walk)</div>
            <div><span className="text-zinc-200 font-semibold">[Scroll]</span> Zoom</div>
            <div><span className="text-zinc-200 font-semibold">[E / Space]</span> Interact / Water / Harvest</div>
            <div><span className="text-zinc-200 font-semibold">[Click Tent / T]</span> Edit Tent &amp; Inspect Internal Items</div>
            <div><span className="text-zinc-200 font-semibold">[I]</span> Harvest Inventory</div>
            <div><span className="text-zinc-200 font-semibold">[1 - 6]</span> Switch Hotbar Tool</div>
            <div className="pt-0.5 text-emerald-400"><span className="text-zinc-200 font-semibold">[Grid]</span> 1 Square = 1 Foot (1:1 Scale)</div>
          </div>
        </div>

        {/* Dual Screen Real-Time Sync Indicator */}
        <div className="absolute top-4 right-6 z-10 bg-zinc-900/85 backdrop-blur border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-emerald-400 shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Screen Sync: Active</span>
        </div>
      </div>

      {/* Bottom Tool Hotbar */}
      <footer className="h-16 bg-zinc-900/95 border-t border-zinc-800 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-1 sm:gap-2 mx-auto">
          {/* Tool 1: Inspect */}
          <button
            onClick={() => { soundEffects.playClick(); setActiveTool('inspect'); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'inspect'
                ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400/50 scale-105'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center rounded bg-zinc-950/40 text-[10px]">1</span>
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Inspect &amp; Timelapse</span>
          </button>

          {/* Tool 2: Water */}
          <button
            onClick={() => { soundEffects.playClick(); setActiveTool('water'); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'water'
                ? 'bg-sky-600 text-white shadow-lg ring-2 ring-sky-400/50 scale-105'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center rounded bg-zinc-950/40 text-[10px]">2</span>
            <Droplets className="w-4 h-4 text-sky-300" />
            <span className="hidden sm:inline">Water Can</span>
          </button>

          {/* Tool 3: Harvest */}
          <button
            onClick={() => { soundEffects.playClick(); setActiveTool('harvest'); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'harvest'
                ? 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-400/50 scale-105'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center rounded bg-zinc-950/40 text-[10px]">3</span>
            <Scissors className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Harvest Shears</span>
          </button>

          {/* Tool 4: Feed */}
          <button
            onClick={() => { soundEffects.playClick(); setActiveTool('feed'); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'feed'
                ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400/50 scale-105'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center rounded bg-zinc-950/40 text-[10px]">4</span>
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span className="hidden sm:inline">Feed Nutrients</span>
          </button>

          {/* Tool 5: Mist */}
          <button
            onClick={() => { soundEffects.playClick(); setActiveTool('mist'); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'mist'
                ? 'bg-teal-600 text-white shadow-lg ring-2 ring-teal-400/50 scale-105'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center rounded bg-zinc-950/40 text-[10px]">5</span>
            <span className="text-sm">💨</span>
            <span className="hidden sm:inline">Mist Canopy</span>
          </button>

          {/* Tool 6: Place / Build */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTool('build');
              onOpenAddItem();
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTool === 'build'
                ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400/50 scale-105'
                : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center rounded bg-zinc-950/40 text-[10px]">6</span>
            <Plus className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Place Tent/Item</span>
          </button>
        </div>
      </footer>

      {/* Plant Visualizer & Growth Timelapse Modal */}
      {inspectedCrop && (
        <PlantVisualizerModal
          item={inspectedCrop.item}
          enclosureClimate={currentRoom.climate}
          isOpen={true}
          onClose={() => setInspectedCrop(null)}
          onOpenFullInspector={() => {
            const cropId = inspectedCrop.item.id;
            const parentTentId = inspectedCrop.parentTentId;
            setInspectedCrop(null);
            setInGameInspectorTarget({
              type: 'item',
              id: cropId,
              parentTentId: parentTentId || null
            });
          }}
          onWater={(crop) => applyToolToCrop(crop, inspectedCrop.parentTentId)}
          onFeed={(plant) => applyToolToCrop(plant, inspectedCrop.parentTentId)}
          onPrune={(plant) => {
            soundEffects.playSnip();
            onUpdateState(prev => {
              const next = updateCropInSimulation(prev, plant.id, inspectedCrop.parentTentId, (item) => {
                if (item.category === 'plant') {
                  return {
                    ...item,
                    health: Math.min(100, item.health + 4),
                    yieldPotentialGrams: Math.min(420, (item.yieldPotentialGrams || 120) + 15)
                  };
                }
                return item;
              });
              broadcastSimulationState(next);
              return next;
            });
            addFloatingText('+Pruned Main Canopy ✂', playerRef.current.x, playerRef.current.y, '#34d399');
          }}
          onHarvest={(crop) => {
            applyToolToCrop(crop, inspectedCrop.parentTentId);
            setInspectedCrop(null);
          }}
        />
      )}

      {/* 3D Mode Pro Inspector Modal: Tent & Internal Items Manager */}
      {inGameInspectorTarget && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
          onClick={() => setInGameInspectorTarget(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Modal Navigation & Action Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-950/90 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  {inGameInspectorTarget.type === 'tent' ? (
                    <Box className="w-5 h-5" />
                  ) : inGameInspectorTarget.type === 'item' ? (
                    <Layers className="w-5 h-5" />
                  ) : (
                    <Home className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                      Grow Space &amp; Tent Inspector
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {inGameInspectorTarget.type === 'tent' 
                        ? '⛺ Tent & Internal Items' 
                        : inGameInspectorTarget.type === 'item' 
                          ? '🌿 Item Editor & Controls' 
                          : '🏠 Room Properties'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    {inGameInspectorTarget.type === 'tent'
                      ? 'Inspect tent microclimate, tweak exhaust fan speeds, and click individual items below to edit them.'
                      : inGameInspectorTarget.type === 'item'
                        ? 'Edit growth stage, health, watering, equipment power/mode/schedules, or care for crops.'
                        : 'Adjust room dimensions, HVAC, insulation, and ambient parameters.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInGameInspectorTarget(null)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-750 transition-colors shadow-sm"
                >
                  <span>Done / Back to Game</span>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Complete Dashboard ItemInspector */}
            <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-zinc-900/60">
              <ItemInspector
                room={currentRoom}
                rooms={allRooms}
                outdoorCo2Ppm={state.outside.co2Ppm || state.outdoorLocation?.customCo2Ppm || 420}
                selectedType={inGameInspectorTarget.type}
                selectedId={inGameInspectorTarget.id}
                selectedParentTentId={inGameInspectorTarget.parentTentId}
                tempUnit={state.tempUnit}
                onSelectRoom={() => {
                  soundEffects.playClick();
                  setInGameInspectorTarget({ type: 'room', id: currentRoom.id, parentTentId: null });
                }}
                onSelectTent={(tentId) => {
                  soundEffects.playClick();
                  setInGameInspectorTarget({ type: 'tent', id: tentId, parentTentId: null });
                }}
                onSelectItem={(itemId, parentTentId) => {
                  soundEffects.playClick();
                  setInGameInspectorTarget({ 
                    type: 'item', 
                    id: itemId, 
                    parentTentId: parentTentId || (inGameInspectorTarget.type === 'tent' ? inGameInspectorTarget.id : null) 
                  });
                }}
                onUpdateRoom={handleUpdateRoomFromGame}
                onUpdateTent={handleUpdateTentFromGame}
                onUpdateItem={handleUpdateItemFromGame}
                onDeleteTent={handleDeleteTentFromGame}
                onDeleteItem={handleDeleteItemFromGame}
                onDeleteRoom={handleDeleteRoomFromGame}
                onOpenAddRoom={onOpenAddRoom}
                onOpenAddItem={(tentId) => {
                  setInGameInspectorTarget(null);
                  onOpenAddItem(tentId);
                }}
                onHarvestPlant={(plant, tentId) => {
                  if (onHarvestPlant) {
                    onHarvestPlant(plant, tentId);
                  } else {
                    applyToolToCrop(plant, tentId);
                  }
                }}
                onHarvestMushroom={(mushroom, tentId) => {
                  if (onHarvestMushroom) {
                    onHarvestMushroom(mushroom, tentId);
                  } else {
                    applyToolToCrop(mushroom, tentId);
                  }
                }}
                simTime={state.simTime}
                onLogJournalEntry={onLogJournalEntry}
              />
            </div>
          </div>
        </div>
      )}

      {/* Player Harvest Inventory Modal */}
      {isInventoryOpen && (
        <PlayerInventoryModal
          harvests={state.harvests}
          isOpen={isInventoryOpen}
          onClose={() => setIsInventoryOpen(false)}
          onUpdateHarvestRecord={(updatedRecord) => {
            onUpdateState(prev => {
              const nextState: SimulationState = {
                ...prev,
                harvests: prev.harvests.map(h => h.id === updatedRecord.id ? updatedRecord : h)
              };
              broadcastSimulationState(nextState);
              return nextState;
            });
          }}
          onDeleteHarvestRecord={(recordId) => {
            soundEffects.playClick();
            onUpdateState(prev => {
              const nextState: SimulationState = {
                ...prev,
                harvests: prev.harvests.filter(h => h.id !== recordId)
              };
              broadcastSimulationState(nextState);
              return nextState;
            });
          }}
        />
      )}
    </div>
  );
};

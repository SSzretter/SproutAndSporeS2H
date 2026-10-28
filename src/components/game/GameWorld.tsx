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
  JournalCategory,
  Position3D
} from '../../types/sim';
import { GameScene, HoverTarget, FloatingText, Doorway, PlayerState } from '../game3d/GameScene';
import { WallSide } from '../../types/sim';
import { OUTSIDE_DOOR_ID, resolveRoomDoorways, getDoorSpawnPoint, getOppositeWall, getWallDisplayName } from '../../utils/roomDoorways';
import { itemWorldPosition, tentWorldOrigin, Vec3 } from '../game3d/coords';
import { soundEffects } from './AudioEffects';
import { TentInspectorModal } from './TentInspectorModal';
import { PlayerInventoryModal } from './PlayerInventoryModal';
import { ItemInspector } from '../ItemInspector';
import { broadcastSimulationState } from '../../utils/syncChannel';
import { getCropIssues } from '../../utils/cropIssues';
import { syncRoomRacks } from '../../utils/spatial';
import { getEquipmentActivity } from '../../utils/equipmentStatus';
import { migrateEquipmentLinks, getReservoirLiters, getReservoirLevelL, isReservoirEmpty, refillReservoir, getBucketCapacityL, getBucketLevelL, isBucketFull, emptyBucket } from '../../utils/equipmentLinks';
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
  Sliders,
  Gauge
} from 'lucide-react';

// Walking speed of the cultivator: ~6 ft/s at 60 ticks per second
const WALK_SPEED_FT_PER_TICK = 0.1;
// How far (ft, beyond a crop's footprint edge) the cultivator can reach with E / Space
const REACH_FT = 3;
// Doorways are 3ft wide openings centered on the left/right walls
const DOOR_HALF_WIDTH_FT = 1.5;

/** Where the cultivator appears when entering a room: front-center of the floor. */
function getSpawnPoint(room: Room): { x: number; y: number; targetX: number; targetY: number; facing: number } {
  const x = room.dimensions.length / 2;
  const y = room.dimensions.width * 0.75;
  return { x, y, targetX: x, targetY: y, facing: Math.PI };
}

interface GameWorldProps {
  state: SimulationState;
  onUpdateState: (updater: (prev: SimulationState) => SimulationState) => void;
  onOpenAddItem: (tentId?: string, rackId?: string) => void;
  onOpenAddRoom: (sourceWall?: WallSide) => void;
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
  const lastDoorTravelTimeRef = useRef<number>(0);
  const lastAdjustActionTimeRef = useRef<number>(0);
  const cameraYawRef = useRef(0);

  // Sound state
  const [isMuted, setIsMuted] = useState(() => soundEffects.isMuted());

  // Controls help: shown for a few seconds on entry, then collapses to a chip. Hovering peeks at it;
  // clicking the chip or pressing [H] pins it open (remembered per browser).
  const [controlsIntro, setControlsIntro] = useState(true);
  const [controlsHover, setControlsHover] = useState(false);
  const [controlsPinned, setControlsPinned] = useState(() => {
    try {
      return localStorage.getItem('sprout_spore_controls_pinned') === 'true';
    } catch {
      return false;
    }
  });
  const toggleControlsPinned = () => {
    setControlsIntro(false);
    setControlsPinned(prev => {
      try {
        localStorage.setItem('sprout_spore_controls_pinned', String(!prev));
      } catch {
        // Not persisted; the toggle still works for this session
      }
      return !prev;
    });
  };
  useEffect(() => {
    const timer = setTimeout(() => setControlsIntro(false), 6000);
    return () => clearTimeout(timer);
  }, []);
  const controlsExpanded = controlsPinned || controlsHover || controlsIntro;

  // Live climate readouts over each tent (remembered per browser; storage may be unavailable)
  const [showTentStats, setShowTentStats] = useState(() => {
    try {
      return localStorage.getItem('sprout_spore_show_tent_stats') !== 'false';
    } catch {
      return true;
    }
  });
  const toggleTentStats = () => {
    setShowTentStats(prev => {
      try {
        localStorage.setItem('sprout_spore_show_tent_stats', String(!prev));
      } catch {
        // Not persisted; the toggle still works for this session
      }
      return !prev;
    });
  };
  const toggleMute = () => {
    const next = soundEffects.toggleMute();
    setIsMuted(next);
  };

  // Selected tool hotbar
  const [activeTool, setActiveTool] = useState<ToolType>('inspect');

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
          // Unlink any hoses that fed the removed tent
          return migrateEquipmentLinks({
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
  // Left-click selection: stays until something else (or empty floor) is clicked, or Esc.
  // The wheel raises / lowers it and middle-drag slides it.
  const [selection, setSelection] = useState<{ kind: 'item'; id: string; tentId?: string } | { kind: 'tent'; id: string } | null>(null);

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
  const handleTravelToRoom = (roomId: string, fromWall?: WallSide) => {
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
            message: `Walked through facility door into ${targetRoom.name}.`
          }
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
    // Enter the new room at its corresponding return door threshold
    const targetRoom = allRooms.find(r => r.id === roomId);
    if (targetRoom) {
      const spawn = fromWall 
        ? getDoorSpawnPoint(targetRoom, getOppositeWall(fromWall)) 
        : getSpawnPoint(targetRoom);
      playerRef.current.x = spawn.x;
      playerRef.current.y = spawn.y;
      playerRef.current.targetX = spawn.x;
      playerRef.current.targetY = spawn.y;
      playerRef.current.facing = spawn.facing;
      lastDoorTravelTimeRef.current = Date.now();
    }
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
        if (isInventoryOpen) {
          setIsInventoryOpen(false);
          return;
        }
        setSelection(null);
      }

      // If an inspection modal is open, avoid hotkey / movement interference
      if (inGameInspectorTarget || isInventoryOpen) return;

      keysPressed[e.key.toLowerCase()] = true;

      // Hotbar tool shortcuts
      if (e.key === '1') setActiveTool('inspect');
      if (e.key === '2') setActiveTool('water');
      if (e.key === '3') setActiveTool('harvest');
      if (e.key === '4') setActiveTool('feed');
      if (e.key === '5') setActiveTool('mist');
      // Place is a one-shot action: open the Add dialog and stay on Inspect, so later clicks inspect again
      if (e.key === '6') { setActiveTool('inspect'); onOpenAddItem(); }

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

      // [H] to pin / unpin the controls help
      if (e.key.toLowerCase() === 'h') {
        toggleControlsPinned();
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

      if (inGameInspectorTarget || isInventoryOpen) {
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

      // Walking into a doorway travels to the room beyond it or opens builder
      const now = Date.now();
      if (now - lastDoorTravelTimeRef.current > 1200) {
        const door = getDoorwayAt(p.x, p.y);
        if (door && door.roomId !== OUTSIDE_DOOR_ID) {
          lastDoorTravelTimeRef.current = now;
          if (door.roomId === 'ADD_ROOM') {
            onOpenAddRoom(door.side);
          } else {
            handleTravelToRoom(door.roomId, door.side);
          }
        }
      }
    }, 1000 / 60);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveInterval);
    };
  }, [currentRoom, inGameInspectorTarget, isInventoryOpen]);

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
      setInGameInspectorTarget({ type: 'item', id: crop.id, parentTentId: tentId || null });
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
    }).map(rm => (rm.id === activeRId ? syncRoomRacks(rm) : rm)); // dragging a rack carries its trays' plants

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
    // For farming crop actions (watering/feeding/misting/harvesting plants & mushrooms with hotbar tools)
    if ((item.category === 'plant' || item.category === 'mushroom') && activeTool !== 'inspect') {
      applyToolToCrop(item, tentId, x, y);
      return;
    }

    // Left click selects it; right click opens its properties
    soundEffects.playClick();
    setSelection({ kind: 'item', id: item.id, tentId });
  };

  const handleSceneRightClickItem = (item: Item, tentId: string | undefined) => {
    soundEffects.playClick();
    setSelection({ kind: 'item', id: item.id, tentId });
    setInGameInspectorTarget({ type: 'item', id: item.id, parentTentId: tentId || null });
  };

  const handleSceneRightClickTent = (tent: Tent) => {
    soundEffects.playClick();
    setSelection({ kind: 'tent', id: tent.id });
    setInGameInspectorTarget({ type: 'tent', id: tent.id, parentTentId: null });
  };

  const handleSceneHover = (next: HoverTarget | null) => {
    // While the user is actively wheel-scrolling or dragging an object, ignore transient pointerout events
    if (!next && Date.now() - lastAdjustActionTimeRef.current < 1200) {
      return;
    }
    const idOf = (t: HoverTarget | null) => !t ? null
      : t.kind === 'item' ? t.item.id
      : t.kind === 'tent' ? t.tent.id
      : t.door.roomId;
    setHoverTarget(prev => (idOf(prev) === idOf(next) ? prev : next));
  };

  // Real-time item repositioning via scroll wheel (Z height) and middle-drag (X, Y)
  const handleUpdateItemPosition = useCallback((
    itemId: string,
    tentId: string | undefined,
    newPos: Position3D,
    label?: string
  ) => {
    lastAdjustActionTimeRef.current = Date.now();
    onUpdateState(prev => {
      const next = updateCropInSimulation(prev, itemId, tentId, (item) => ({
        ...item,
        position: newPos
      }));
      broadcastSimulationState(next);
      return next;
    });

    if (label) {
      const tent = tentId ? currentRoom.tents.find(t => t.id === tentId) : undefined;
      const item = tent ? tent.items.find(i => i.id === itemId) : currentRoom.items.find(i => i.id === itemId);
      if (item) {
        const [wx, , wz] = itemWorldPosition(item, currentRoom, tent);
        setFloatingTexts(prev => {
          const filtered = prev.filter(t => t.id !== 'item-pos-adjust');
          return [...filtered, { id: 'item-pos-adjust', text: label, x: wx, y: wz, color: '#38bdf8', createdAt: Date.now() }];
        });
      }
    }
  }, [onUpdateState, currentRoom]);

  // Real-time tent repositioning via middle-drag (X, Y) and scroll wheel (Z height)
  // Everything inside the tent shifts smoothly with the tent while preserving relative coordinates
  const handleUpdateTentPosition = useCallback((
    tentId: string,
    newPos: Position3D,
    label?: string
  ) => {
    lastAdjustActionTimeRef.current = Date.now();
    onUpdateState(prev => {
      const activeRId = prev.activeRoomId || prev.room.id;
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(rm => {
        if (rm.id !== activeRId) return rm;
        return {
          ...rm,
          tents: rm.tents.map(t => t.id === tentId ? { ...t, position: newPos } : t)
        };
      });
      const updatedActive = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];
      const next = {
        ...prev,
        rooms: updatedRooms,
        room: updatedActive
      };
      broadcastSimulationState(next);
      return next;
    });

    if (label) {
      setFloatingTexts(prev => {
        const filtered = prev.filter(t => t.id !== 'tent-pos-adjust');
        return [...filtered, {
          id: 'tent-pos-adjust',
          text: label,
          x: newPos.x + 2,
          y: newPos.y + 2,
          color: '#34d399',
          createdAt: Date.now()
        }];
      });
    }
  }, [onUpdateState]);

  const handleSceneClickTent = (tent: Tent) => {
    soundEffects.playClick();
    setSelection({ kind: 'tent', id: tent.id });
  };

  const handleSceneClickDoor = (door: Doorway) => {
    setSelection(null);
    if (door.roomId === OUTSIDE_DOOR_ID) {
      const p = playerRef.current;
      addFloatingText('🌳 Door to the outside', p.x, p.y, '#bae6fd');
    } else if (door.roomId === 'ADD_ROOM') {
      onOpenAddRoom(door.side);
    } else {
      handleTravelToRoom(door.roomId, door.side);
    }
  };

  const handleSceneClickFloor = (x: number, y: number) => {
    // With something selected, a floor click only deselects; otherwise it walks there
    if (selection) {
      setSelection(null);
      return;
    }
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

  const selectedTarget: HoverTarget | null = (() => {
    if (!selection) return null;
    if (selection.kind === 'tent') {
      const tent = currentRoom.tents.find(t => t.id === selection.id);
      return tent ? { kind: 'tent', tent } : null;
    }
    const host = selection.tentId ? currentRoom.tents.find(t => t.id === selection.tentId) : undefined;
    const item = (host ? host.items : currentRoom.items).find(i => i.id === selection.id);
    return item ? { kind: 'item', item, tentId: selection.tentId } : null;
  })();
  const selectedName = !selectedTarget ? null : selectedTarget.kind === 'item' ? selectedTarget.item.name : selectedTarget.kind === 'tent' ? selectedTarget.tent.name : null;

  const hoveredId = !hoverTarget ? null
    : hoverTarget.kind === 'item' ? hoverTarget.item.id
    : hoverTarget.kind === 'tent' ? hoverTarget.tent.id
    : hoverTarget.door.roomId;

  const hoverTitle = (() => {
    if (!hoverTarget) return null;
    if (hoverTarget.kind === 'tent') {
      const pos = hoverTarget.tent.position || { x: 1, y: 1 };
      return `🎪 ${hoverTarget.tent.name} (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})ft [Click: Select • Right-click: Edit Tent]`;
    }
    if (hoverTarget.kind === 'door') {
      if (hoverTarget.door.roomId === OUTSIDE_DOOR_ID) return '🌳 Exterior door to the outside';
      return hoverTarget.door.roomId === 'ADD_ROOM' ? '➕ Add a New Room [Click]' : `${hoverTarget.door.label} [Click or Walk Through]`;
    }
    // Read the live item so the tooltip reflects changes made while hovering (e.g. power toggled)
    const item = [...currentRoom.items, ...currentRoom.tents.flatMap(t => t.items)].find(i => i.id === hoverTarget.item.id) || hoverTarget.item;
    if (item.category === 'plant' || item.category === 'mushroom') {
      const host = hoverTarget.tentId ? currentRoom.tents.find(t => t.id === hoverTarget.tentId) : undefined;
      const issues = getCropIssues(item, (host ?? currentRoom).climate, host ? host.items : currentRoom.items, !host && currentRoom.environmentType === 'outdoor_garden', [...currentRoom.items, ...currentRoom.tents.flatMap(t => t.items)]);
      const problems = issues.length > 0 ? ` — ${issues.map(i => `${i.severity === 'critical' ? '⛔' : '⚠'} ${i.label}`).join(', ')}` : '';
      const zHeight = item.position?.z ? ` • Z: ${item.position.z.toFixed(1)}ft` : '';
      return `${item.name} (${item.stage})${zHeight}${problems} [${activeTool === 'inspect' ? 'Click: Select' : 'Click: Use Tool'} • Right-click: Edit]`;
    }
    if (item.category === 'equipment') {
      const activity = getEquipmentActivity(item, new Date(state.simTime).getHours());
      const statusIcon = { running: '🟢', idle: '🟡', blocked: '🔴', off: '⚫' }[activity?.activity ?? 'off'];
      const status = `${statusIcon} ${activity?.label ?? 'Off'}`;
      if (item.type === 'humidifier') {
        const water = isReservoirEmpty(item) ? '💧 EMPTY' : `💧 ${Math.round((getReservoirLevelL(item) / getReservoirLiters(item)) * 100)}%`;
        return `⚙️ ${item.name} (${status} • ${water}) [Click: Select • Right-click: Controls & Properties]`;
      }
      if (item.type === 'dehumidifier') {
        const bucket = item.drainHoseConnected ? 'drain hose'
          : isBucketFull(item) ? '🪣 FULL'
          : `🪣 ${Math.round((getBucketLevelL(item) / getBucketCapacityL(item)) * 100)}%`;
        return `⚙️ ${item.name} (${status} • ${bucket}) [Click: Select • Right-click: Controls & Properties]`;
      }
      const vent = item.type === 'exhaust_fan' ? ` • → ${item.exhaustTo === 'outdoors' ? 'outdoors' : 'room'}` : '';
      const zHeight = item.position?.z != null ? ` • Z: ${item.position.z.toFixed(1)}ft` : '';
      return `⚙️ ${item.name} (${status}${zHeight} • ${item.powerWatts}W${vent}) [Click: Select • Right-click: Edit]`;
    }
    return `${item.category === 'person' ? '👤' : '🐾'} ${item.name} [Click: Select • Right-click: Controls]`;
  })();

  // Doorways to other rooms on the left/right walls (or an Add Room portal)
  const getRoomDoorways = (): Doorway[] => {
    return resolveRoomDoorways(currentRoom, allRooms);
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
    const doors = getRoomDoorways();
    const thresh = 1.3;
    const span = 2.0;

    // Left wall
    if (x <= thresh && Math.abs(y - W / 2) <= span) {
      return doors.find(d => d.side === 'left') || null;
    }
    // Right wall
    if (x >= L - thresh && Math.abs(y - W / 2) <= span) {
      return doors.find(d => d.side === 'right') || null;
    }
    // Back wall
    if (y <= thresh && Math.abs(x - L / 2) <= span) {
      return doors.find(d => d.side === 'back') || null;
    }
    // Front wall
    if (y >= W - thresh && Math.abs(x - L / 2) <= span) {
      return doors.find(d => d.side === 'front') || null;
    }
    return null;
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

          {/* Climate Metrics Quick Bar (the room you're in) */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wide text-zinc-500">Room</span>
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
          {/* Tent climate readouts toggle */}
          <button
            onClick={toggleTentStats}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              showTentStats
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
            title={showTentStats ? 'Hide live tent climate readouts' : 'Show live tent climate readouts (temp, RH, VPD, CO₂)'}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tent Stats</span>
          </button>

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
          hoverTarget={hoverTarget}
          selectedTarget={selectedTarget}
          floatingTexts={floatingTexts}
          playerRef={playerRef}
          cameraYawRef={cameraYawRef}
          onHover={handleSceneHover}
          onClickItem={handleSceneClickItem}
          onClickTent={handleSceneClickTent}
          onClickDoor={handleSceneClickDoor}
          onClickFloor={handleSceneClickFloor}
          onRightClickItem={handleSceneRightClickItem}
          onRightClickTent={handleSceneRightClickTent}
          onDeselect={() => setSelection(null)}
          onUpdateItemPosition={handleUpdateItemPosition}
          onUpdateTentPosition={handleUpdateTentPosition}
          tempUnit={state.tempUnit}
          showTentStats={showTentStats}
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

        {/* What is selected and what the mouse does to it */}
        {selectedName && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-amber-500/60 text-xs text-zinc-200 shadow-xl whitespace-nowrap pointer-events-none">
            <span className="font-bold text-amber-300">Selected: {selectedName}</span>
            <span className="text-zinc-400"> · Wheel: height · Middle-drag: move · Right-click: edit · Esc / click floor: deselect</span>
          </div>
        )}

        {/* Controls help: collapses to a chip so it doesn't cover the world */}
        <div
          className="absolute top-4 left-6 z-10"
          onMouseEnter={() => setControlsHover(true)}
          onMouseLeave={() => setControlsHover(false)}
        >
          {controlsExpanded ? (
            <div className="bg-zinc-900/85 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 shadow-md">
              <button
                type="button"
                onClick={toggleControlsPinned}
                className="w-full font-bold text-zinc-200 flex items-center gap-1.5 mb-1"
                title={controlsPinned ? 'Unpin (collapse when the mouse leaves) [H]' : 'Pin open [H]'}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Cultivator Controls</span>
                <span className="ml-auto pl-3 text-[10px] font-mono text-zinc-500">{controlsPinned ? 'pinned · H' : 'click to pin · H'}</span>
              </button>
              <div className="space-y-0.5 text-[11px] text-zinc-400 font-mono">
                <div><span className="text-zinc-200 font-semibold">[WASD / Click floor]</span> Walk around</div>
                <div><span className="text-zinc-200 font-semibold">[Left Click]</span> Select object (floor / Esc deselects)</div>
                <div><span className="text-zinc-200 font-semibold">[Right Click]</span> Edit object properties</div>
                <div><span className="text-zinc-200 font-semibold">[Right Drag]</span> Rotate camera</div>
                <div><span className="text-zinc-200 font-semibold">[Middle Drag]</span> Move selected object, else pan camera</div>
                <div><span className="text-zinc-200 font-semibold">[Scroll]</span> Raise / lower selected object, else zoom</div>
                <div><span className="text-zinc-200 font-semibold">[E / Space]</span> Interact / Water / Harvest</div>
                <div><span className="text-zinc-200 font-semibold">[Right-click Tent / T]</span> Edit Tent &amp; Inspect Internal Items</div>
                <div><span className="text-zinc-200 font-semibold">[I]</span> Harvest Inventory</div>
                <div><span className="text-zinc-200 font-semibold">[1 - 6]</span> Switch Hotbar Tool</div>
                <div><span className="text-zinc-200 font-semibold">[H]</span> Pin / hide this help</div>
                <div className="pt-0.5 text-emerald-400"><span className="text-zinc-200 font-semibold">[Grid]</span> 1 Square = 1 Foot (1:1 Scale)</div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleControlsPinned}
              className="flex items-center gap-1.5 bg-zinc-900/70 backdrop-blur border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 shadow-md transition-colors"
              title="Show controls (hover to peek, click to pin) [H]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Controls</span>
              <span className="font-mono text-zinc-600">H</span>
            </button>
          )}
        </div>

        {/* Sim clock, outdoor conditions (outside the building) and the dual-screen sync indicator */}
        <div className="absolute top-4 right-6 z-10 flex flex-col items-end gap-2 pointer-events-none">
          {(() => {
            const simDate = new Date(state.simTime);
            const hour = simDate.getHours();
            const outside = state.outside;
            const location = state.outdoorLocation;
            const weatherIcon: Record<string, string> = { sunny: '☀️', partly_cloudy: '⛅', cloudy: '☁️', rainy: '🌧️', clear_night: '🌙' };
            const weatherLabel = (outside.weather || 'sunny').replace('_', ' ');
            const fmtTemp = (f: number, c: number) => (state.tempUnit === 'F' ? `${f.toFixed(1)}°F` : `${c.toFixed(1)}°C`);
            return (
              <>
                <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-3 py-1.5 shadow-md text-right">
                  <div className="text-sm font-bold font-mono text-zinc-100 leading-tight">
                    {hour >= 6 && hour < 20 ? '☀️' : '🌙'} {simDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <div className="text-[11px] text-zinc-400 leading-tight">
                    {simDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 shadow-md text-xs min-w-[190px]">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Outdoors</span>
                    <span className="text-[10px] text-zinc-500 truncate max-w-[130px]" title={location.isLiveWeather ? 'Live weather' : 'Regional climate normals'}>
                      {location.cityName}{location.state ? `, ${location.state}` : ''}{location.isLiveWeather ? '' : ' (est.)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                    <span className="text-base leading-none">{weatherIcon[outside.weather] ?? '☀️'}</span>
                    <span className="capitalize">{weatherLabel}</span>
                    <span className="ml-auto font-mono text-amber-300">{fmtTemp(outside.tempF, outside.tempC)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 mt-1 font-mono text-[11px]">
                    <span className="text-cyan-300">💧 {Math.round(outside.rh)}%</span>
                    <span className="text-purple-300">🌫️ {Math.round(outside.co2Ppm || 420)}</span>
                    <span className="text-zinc-300">💨 {Math.round(outside.windMph)} mph</span>
                  </div>
                </div>
              </>
            );
          })()}
          <div className="bg-zinc-900/85 backdrop-blur border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-emerald-400 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Screen Sync: Active</span>
          </div>
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
              setActiveTool('inspect');
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
                onAddHarvestsToFacility={(harvests) => {
                  onUpdateState(prev => {
                    const next: SimulationState = {
                      ...prev,
                      harvests: [...harvests, ...prev.harvests]
                    };
                    broadcastSimulationState(next);
                    return next;
                  });
                }}
                onOpenAddItem={(tentId, rackId) => {
                  setInGameInspectorTarget(null);
                  onOpenAddItem(tentId, rackId);
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

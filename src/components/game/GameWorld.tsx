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
import { drawPlantToScale, drawMushroomToScale } from './PlantSprites';
import { drawSpriteToScale, drawSpriteFitted, drawItemFootprint, drawItemLabel, getItemScreenBox, isPointInItemBox, isOverheadItem, feetToPx, feetToVerticalPx } from './scaleRender';
import { soundEffects } from './AudioEffects';
import { PlantVisualizerModal } from './PlantVisualizerModal';
import { TentInspectorModal } from './TentInspectorModal';
import { PlayerInventoryModal } from './PlayerInventoryModal';
import { ItemInspector } from '../ItemInspector';
import { 
  getSafeTentCanvasPosition, 
  getSafeTentItemCanvasPosition,
  CANVAS_GRID_SIZE,
  CANVAS_FLOOR_ORIGIN_X,
  CANVAS_FLOOR_ORIGIN_Y,
  CANVAS_MAX_FLOOR_X,
  CANVAS_MAX_FLOOR_Y
} from '../../utils/spatial';
import { broadcastSimulationState } from '../../utils/syncChannel';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Player cultivator avatar state (in room coordinates)
  const playerRef = useRef({
    x: 240,
    y: 280,
    targetX: 240,
    targetY: 280,
    facing: 'down' as 'down' | 'up' | 'left' | 'right',
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

  // Tent, Item, and Room update & delete handlers for 2D game mode
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
          return {
            ...rm,
            tents: rm.tents.filter(t => t.id !== tentId)
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

  // Hovered interactable object in world
  const [hoveredObject, setHoveredObject] = useState<{
    type: 'tent' | 'plant' | 'mushroom' | 'door' | 'equipment' | 'occupant';
    id: string;
    parentTentId?: string;
    title: string;
    x: number;
    y: number;
  } | null>(null);

  // Floating notifications / action popups (e.g. "+30% Hydrated", "Harvested 85g!")
  const [floatingTexts, setFloatingTexts] = useState<Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    createdAt: number;
  }>>([]);

  const addFloatingText = (text: string, x: number, y: number, color = '#34d399') => {
    const id = `float-${Date.now()}-${Math.random()}`;
    setFloatingTexts(prev => [...prev, { id, text, x, y, color, createdAt: Date.now() }]);
  };

  // Active room reference
  const currentRoom = (state.rooms && state.rooms.find(r => r.id === (state.activeRoomId || state.room.id))) || state.room;
  const allRooms = state.rooms && state.rooms.length > 0 ? state.rooms : [state.room];

  // Live refs to guarantee immediate 60FPS canvas repaints without closure lag
  const currentRoomRef = useRef(currentRoom);
  currentRoomRef.current = currentRoom;

  const stateRef = useRef(state);
  stateRef.current = state;

  const hoveredObjectRef = useRef(hoveredObject);
  hoveredObjectRef.current = hoveredObject;

  const floatingTextsRef = useRef(floatingTexts);
  floatingTextsRef.current = floatingTexts;

  // Immediate notification when a new item is added to any tent or room
  const prevItemsTotalRef = useRef<number>(-1);
  useEffect(() => {
    const totalItems = currentRoom.items.length + currentRoom.tents.reduce((sum, t) => sum + t.items.length, 0);
    if (prevItemsTotalRef.current !== -1 && totalItems > prevItemsTotalRef.current) {
      soundEffects.playClick();
      addFloatingText('✨ New Item Added to Facility!', playerRef.current.x, playerRef.current.y - 45, '#34d399');
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
    // Reset player position near entrance door
    playerRef.current.x = 240;
    playerRef.current.y = 280;
    playerRef.current.targetX = 240;
    playerRef.current.targetY = 280;
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

    // Continuous movement loop
    const moveInterval = setInterval(() => {
      const p = playerRef.current;

      if (inGameInspectorTarget || inspectedCrop || isInventoryOpen) {
        p.isMoving = false;
        return;
      }

      const speed = 4.2;
      let dx = 0;
      let dy = 0;

      if (keysPressed['w'] || keysPressed['arrowup']) dy -= speed;
      if (keysPressed['s'] || keysPressed['arrowdown']) dy += speed;
      if (keysPressed['a'] || keysPressed['arrowleft']) dx -= speed;
      if (keysPressed['d'] || keysPressed['arrowright']) dx += speed;

      if (dx !== 0 || dy !== 0) {
        // Diagonal normalization
        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }

        // Room boundaries (inside walls)
        const minX = 75;
        const maxX = 925;
        const minY = 65;
        const maxY = 595;

        p.x = Math.max(minX, Math.min(maxX, p.x + dx));
        p.y = Math.max(minY, Math.min(maxY, p.y + dy));
        p.targetX = p.x;
        p.targetY = p.y;
        p.isMoving = true;

        if (Math.abs(dx) > Math.abs(dy)) {
          p.facing = dx > 0 ? 'right' : 'left';
        } else {
          p.facing = dy > 0 ? 'down' : 'up';
        }

        p.walkFrame += 0.2;
        p.stepTimer += 1;
        if (p.stepTimer > 14) {
          p.stepTimer = 0;
          soundEffects.playStep();
        }
      } else {
        // Handle mouse click target interpolation
        const distSq = (p.targetX - p.x) ** 2 + (p.targetY - p.y) ** 2;
        if (distSq > 16) {
          const angle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
          p.x += Math.cos(angle) * speed;
          p.y += Math.sin(angle) * speed;
          p.isMoving = true;
          p.walkFrame += 0.2;
          p.stepTimer += 1;
          if (p.stepTimer > 14) {
            p.stepTimer = 0;
            soundEffects.playStep();
          }

          if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
            p.facing = Math.cos(angle) > 0 ? 'right' : 'left';
          } else {
            p.facing = Math.sin(angle) > 0 ? 'down' : 'up';
          }
        } else {
          p.isMoving = false;
        }
      }
    }, 1000 / 60);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveInterval);
    };
  }, [currentRoom, inGameInspectorTarget, inspectedCrop, isInventoryOpen]);

  // Proximity action: find nearest interactable crop or tent
  const triggerProximityAction = () => {
    const p = playerRef.current;

    // Nearest crop (inside tents or on the room floor) by distance to its footprint edge
    let closestCrop: { item: PlantItem | MushroomItem; tentId?: string; dist: number; wx: number; wy: number } | null = null;
    for (const placed of getPlacedRoomItems(currentRoom)) {
      if (placed.item.category !== 'plant' && placed.item.category !== 'mushroom') continue;
      const reachPx = 90 + feetToPx(Math.max(placed.item.dimensions.length, placed.item.dimensions.width)) / 2;
      const dist = Math.hypot(p.x - placed.x, p.y - placed.y);
      if (dist < reachPx && (!closestCrop || dist < closestCrop.dist)) {
        closestCrop = { item: placed.item as PlantItem | MushroomItem, tentId: placed.tentId, dist, wx: placed.x, wy: placed.y };
      }
    }

    if (closestCrop) {
      const target: { item: PlantItem | MushroomItem; tentId?: string; wx: number; wy: number } = closestCrop;
      applyToolToCrop(target.item, target.tentId, target.wx, target.wy);
      return;
    }

    // Otherwise inspect nearest tent
    inspectNearbyTent();
  };

  const inspectNearbyTent = () => {
    const p = playerRef.current;
    let closestTent: Tent | null = null;
    let minDist = 150;

    for (let tIdx = 0; tIdx < currentRoom.tents.length; tIdx++) {
      const tent = currentRoom.tents[tIdx];
      const tentPos = getSafeTentCanvasPosition(tent, currentRoom, tIdx, 1000, 650);
      const dist = Math.hypot(p.x - tentPos.x, p.y - tentPos.y);
      if (dist < minDist) {
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
      addFloatingText('Opening Tent & Items Inspector ⛺', playerRef.current.x, playerRef.current.y - 40, '#6ee7b7');
    }
  };

  // Apply active hotbar tool to a crop
  const applyToolToCrop = (
    crop: PlantItem | MushroomItem, 
    tentId?: string, 
    popupX?: number, 
    popupY?: number
  ) => {
    const px = popupX || playerRef.current.x;
    const py = popupY || playerRef.current.y - 30;

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

      addFloatingText(`✨ Harvested ${yieldGrams}g (${quality})!`, px, py - 10, '#fbbf24');
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
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check if clicked on a Doorway
    const doorways = getRoomDoorways();
    for (const d of doorways) {
      if (
        clickX >= d.x && clickX <= d.x + d.width &&
        clickY >= d.y && clickY <= d.y + d.height
      ) {
        if (d.roomId === 'ADD_ROOM') {
          onOpenAddRoom();
        } else {
          handleTravelToRoom(d.roomId);
        }
        return;
      }
    }

    // Check if clicked on an Item (Crop, Equipment, or Occupant)
    const clickedItem = findItemAtPosition(clickX, clickY);
    if (clickedItem) {
      if (clickedItem.type === 'crop') {
        applyToolToCrop(clickedItem.item as PlantItem | MushroomItem, clickedItem.tentId, clickX, clickY);
        return;
      } else if (clickedItem.type === 'equipment') {
        const eq = clickedItem.item as EquipmentItem;
        if (activeTool === 'inspect') {
          soundEffects.playClick();
          setInGameInspectorTarget({
            type: 'item',
            id: eq.id,
            parentTentId: clickedItem.tentId || null
          });
          return;
        } else {
          soundEffects.playClick();
          onUpdateState(prev => {
            const next = updateCropInSimulation(prev, eq.id, clickedItem.tentId, (item) => ({
              ...item,
              powerOn: !(item as EquipmentItem).powerOn
            }));
            broadcastSimulationState(next);
            return next;
          });
          addFloatingText(`${eq.name}: ${!eq.powerOn ? 'ON ⚡' : 'Standby / OFF'}`, clickX, clickY - 15, !eq.powerOn ? '#34d399' : '#94a3b8');
          return;
        }
      } else if (clickedItem.type === 'occupant') {
        soundEffects.playClick();
        setInGameInspectorTarget({
          type: 'item',
          id: clickedItem.item.id,
          parentTentId: clickedItem.tentId || null
        });
        return;
      }
    }

    // Check if clicked on a Tent (Open properties & internal items inspector)
    const clickedTent = findTentAtPosition(clickX, clickY);
    if (clickedTent) {
      soundEffects.playClick();
      setInGameInspectorTarget({
        type: 'tent',
        id: clickedTent.id,
        parentTentId: null
      });
      return;
    }

    // Otherwise, set walk destination
    playerRef.current.targetX = clickX;
    playerRef.current.targetY = clickY;
  };

  // Canvas Mouse Move (for tooltips and hover rings)
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const hoveredItem = findItemAtPosition(mouseX, mouseY);
    if (hoveredItem) {
      if (hoveredItem.type === 'crop') {
        const crop = hoveredItem.item as PlantItem | MushroomItem;
        setHoveredObject({
          type: crop.category === 'plant' ? 'plant' : 'mushroom',
          id: crop.id,
          parentTentId: hoveredItem.tentId,
          title: `${crop.name} (${crop.stage}) [Click to Inspect & Care]`,
          x: mouseX,
          y: mouseY
        });
        return;
      } else if (hoveredItem.type === 'equipment') {
        const eq = hoveredItem.item as EquipmentItem;
        setHoveredObject({
          type: 'equipment',
          id: eq.id,
          parentTentId: hoveredItem.tentId,
          title: `⚙️ ${eq.name} (${eq.powerOn ? 'ON' : 'OFF'} • ${eq.powerWatts}W) [Inspect to Edit • Click to Toggle]`,
          x: mouseX,
          y: mouseY
        });
        return;
      } else if (hoveredItem.type === 'occupant') {
        const occ = hoveredItem.item;
        setHoveredObject({
          type: 'occupant',
          id: occ.id,
          parentTentId: hoveredItem.tentId,
          title: `${occ.category === 'person' ? '👤' : '🐾'} ${occ.name} [Click to Edit]`,
          x: mouseX,
          y: mouseY
        });
        return;
      }
    }

    const tent = findTentAtPosition(mouseX, mouseY);
    if (tent) {
      setHoveredObject({
        type: 'tent',
        id: tent.id,
        title: `${tent.name} [Click to Edit Tent & Items]`,
        x: mouseX,
        y: mouseY
      });
      return;
    }

    setHoveredObject(null);
  };

  // Helper to get all doorways leading to other rooms
  const getRoomDoorways = () => {
    const doors: Array<{
      roomId: string;
      label: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    const otherRooms = allRooms.filter(r => r.id !== currentRoom.id);
    
    // Left doorway: first other room
    if (otherRooms.length > 0) {
      doors.push({
        roomId: otherRooms[0].id,
        label: `🚪 ${otherRooms[0].name}`,
        x: 10,
        y: 220,
        width: 50,
        height: 120
      });
    }

    // Right doorway: second other room or Add Room portal
    if (otherRooms.length > 1) {
      doors.push({
        roomId: otherRooms[1].id,
        label: `🚪 ${otherRooms[1].name}`,
        x: 940,
        y: 220,
        width: 50,
        height: 120
      });
    } else {
      doors.push({
        roomId: 'ADD_ROOM',
        label: `➕ New Room`,
        x: 940,
        y: 220,
        width: 50,
        height: 120
      });
    }

    return doors;
  };

  // Helper to find any item (crop, equipment, occupant) under cursor.
  // Uses each item's true-scale screen box; front-most (last drawn) wins.
  const findItemAtPosition = (x: number, y: number) => {
    // Floor-level items take priority so crops under a ceiling light stay clickable
    const placedItems = getPlacedRoomItems(currentRoom);
    const hitOrder = [
      ...placedItems.filter(p => !p.overhead).reverse(),
      ...placedItems.filter(p => p.overhead).reverse()
    ];
    for (const { item, tentId, x: px, y: py, overhead } of hitOrder) {
      if (!isPointInItemBox(getItemScreenBox(item, px, py, overhead), x, y)) continue;
      if (item.category === 'plant' || item.category === 'mushroom') {
        return { item: item as PlantItem | MushroomItem, type: 'crop' as const, tentId, x: px, y: py };
      }
      if (item.category === 'equipment') {
        return { item: item as EquipmentItem, type: 'equipment' as const, tentId, x: px, y: py };
      }
      return { item, type: 'occupant' as const, tentId, x: px, y: py };
    }
    return null;
  };

  // Helper to find tent under cursor
  const findTentAtPosition = (x: number, y: number) => {
    for (let tIdx = 0; tIdx < currentRoom.tents.length; tIdx++) {
      const tent = currentRoom.tents[tIdx];
      const tentPos = getSafeTentCanvasPosition(tent, currentRoom, tIdx, 1000, 650);
      const tx = tentPos.x;
      const ty = tentPos.y;
      const width = tentPos.width;
      const height = tentPos.height;

      if (
        x >= tx - width / 2 && x <= tx + width / 2 &&
        y >= ty - height / 2 && y <= ty + height / 2
      ) {
        return { ...tent, x: tx, y: ty, width, height };
      }
    }
    return null;
  };

  // Main 60FPS Game Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const room = currentRoomRef.current;
      const simTime = stateRef.current.simTime;
      const hovered = hoveredObjectRef.current;
      const floatList = floatingTextsRef.current;

      // 1. Draw Architectural Floor & Walls
      drawRoomEnvironment(ctx, canvas.width, canvas.height, room, simTime);

      // 2. Draw Doorways / Travel Portals
      drawDoorways(ctx, getRoomDoorways(), time);

      // 3. Draw Facility Tents
      room.tents.forEach((tent, tIdx) => {
        const tentPos = getSafeTentCanvasPosition(tent, room, tIdx, canvas.width, canvas.height);
        drawTentStructure(ctx, tent, tentPos.x, tentPos.y, tentPos.width, tentPos.height, hovered?.id === tent.id, time);
      });

      // 4. Draw every item (in tents and on the room floor) at true scale, back-to-front
      getPlacedRoomItems(room).forEach(placed => {
        drawPlacedItem(ctx, placed, hovered?.id === placed.item.id, time);
      });

      // 5. Draw Player Avatar
      drawCultivatorAvatar(ctx, playerRef.current);

      // 6. Draw Floating Notifications & Sparkles
      drawFloatingPopups(ctx, floatList);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

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

      {/* Main 2D Canvas Container */}
      <div 
        ref={containerRef} 
        className="relative flex-1 w-full bg-zinc-950 flex items-center justify-center overflow-hidden cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          width={1000}
          height={650}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          className="max-w-full max-h-full rounded-xl shadow-2xl border border-zinc-800/80"
        />

        {/* Hover Tooltip Overlay */}
        {hoveredObject && (
          <div 
            className="absolute pointer-events-none z-30 px-2.5 py-1 rounded bg-zinc-900/95 border border-zinc-700 text-zinc-100 text-xs font-semibold shadow-xl"
            style={{
              left: `${Math.min(window.innerWidth - 180, Math.max(20, hoveredObject.x - 40))}px`,
              top: `${Math.max(70, hoveredObject.y - 45)}px`
            }}
          >
            {hoveredObject.title}
          </div>
        )}

        {/* Proximity Action Prompt badge */}
        <div className="absolute top-4 left-6 z-10 bg-zinc-900/85 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 shadow-md">
          <div className="font-bold text-zinc-200 flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cultivator Controls</span>
          </div>
          <div className="space-y-0.5 text-[11px] text-zinc-400 font-mono">
            <div><span className="text-zinc-200 font-semibold">[WASD / Click]</span> Walk around</div>
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
            addFloatingText('+Pruned Main Canopy ✂', playerRef.current.x, playerRef.current.y - 30, '#34d399');
          }}
          onHarvest={(crop) => {
            applyToolToCrop(crop, inspectedCrop.parentTentId);
            setInspectedCrop(null);
          }}
        />
      )}

      {/* 2D Mode Pro Inspector Modal: Tent & Internal Items Manager */}
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

// ==========================================
// PROCEDURAL CANVAS DRAWING HELPERS
// ==========================================

function drawRoomEnvironment(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  room: Room,
  simTime: number
) {
  const isOutdoor = room.environmentType === 'outdoor_garden';
  const isGreenhouse = room.environmentType === 'greenhouse';

  if (isOutdoor) {
    // 1. Lush Green Lawn / Soil Turf Base
    const grassGrad = ctx.createLinearGradient(0, 0, 0, height);
    grassGrad.addColorStop(0, '#14532d');
    grassGrad.addColorStop(1, '#166534');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 0, width, height);

    // Floor grid lines starting at CANVAS_FLOOR_ORIGIN_X and CANVAS_FLOOR_ORIGIN_Y
    ctx.lineWidth = 1;
    for (let x = CANVAS_FLOOR_ORIGIN_X; x <= CANVAS_MAX_FLOOR_X; x += CANVAS_GRID_SIZE) {
      const ft = Math.round((x - CANVAS_FLOOR_ORIGIN_X) / CANVAS_GRID_SIZE);
      ctx.strokeStyle = ft % 5 === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(x, CANVAS_FLOOR_ORIGIN_Y);
      ctx.lineTo(x, CANVAS_MAX_FLOOR_Y);
      ctx.stroke();
    }
    for (let y = CANVAS_FLOOR_ORIGIN_Y; y <= CANVAS_MAX_FLOOR_Y; y += CANVAS_GRID_SIZE) {
      const ft = Math.round((y - CANVAS_FLOOR_ORIGIN_Y) / CANVAS_GRID_SIZE);
      ctx.strokeStyle = ft % 5 === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(CANVAS_FLOOR_ORIGIN_X, y);
      ctx.lineTo(CANVAS_MAX_FLOOR_X, y);
      ctx.stroke();
    }

    // Flagstone garden walkway
    ctx.fillStyle = '#52525b';
    ctx.fillRect(CANVAS_FLOOR_ORIGIN_X, 350, CANVAS_MAX_FLOOR_X - CANVAS_FLOOR_ORIGIN_X, 38);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(CANVAS_FLOOR_ORIGIN_X, 350, CANVAS_MAX_FLOOR_X - CANVAS_FLOOR_ORIGIN_X, 38);
    for (let px = CANVAS_FLOOR_ORIGIN_X + 25; px < CANVAS_MAX_FLOOR_X - 25; px += 45) {
      ctx.beginPath();
      ctx.moveTo(px, 350);
      ctx.lineTo(px, 388);
      ctx.stroke();
    }

    // Wooden Trellis Posts & Top Cable Wire across garden rows
    ctx.strokeStyle = '#78350f'; // Cedar wood posts
    ctx.lineWidth = 6;
    for (let postX = CANVAS_FLOOR_ORIGIN_X + 60; postX <= CANVAS_MAX_FLOOR_X - 60; postX += 160) {
      ctx.beginPath();
      ctx.moveTo(postX, 100);
      ctx.lineTo(postX, 260);
      ctx.stroke();
    }
    // High-tension trellis wire cable connecting tops
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(CANVAS_FLOOR_ORIGIN_X + 30, 105);
    ctx.lineTo(CANVAS_MAX_FLOOR_X - 30, 105);
    ctx.stroke();

    // Cedar Wood Garden Fence Perimeter
    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, 0, width, CANVAS_FLOOR_ORIGIN_Y);
    ctx.fillRect(0, 0, CANVAS_FLOOR_ORIGIN_X, height);
    ctx.fillRect(CANVAS_MAX_FLOOR_X, 0, width - CANVAS_MAX_FLOOR_X, height);
    ctx.fillRect(0, CANVAS_MAX_FLOOR_Y, width, height - CANVAS_MAX_FLOOR_Y);

    // Fence pickets
    ctx.fillStyle = '#78350f';
    for (let fx = 10; fx < width; fx += 25) {
      ctx.fillRect(fx, 4, 18, 36);
      ctx.fillRect(fx, CANVAS_MAX_FLOOR_Y + 4, 18, 26);
    }

    // Natural sunlight / night tint based on live light PPFD
    const ppfd = room.climate.lightPPFD || 0;
    if (ppfd > 600) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
      ctx.fillRect(0, 0, width, height);
    } else if (ppfd < 60) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(0, 0, width, height);
    }
    return;
  }

  if (isGreenhouse) {
    // Slate gravel floor
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    // Floor grid lines
    ctx.lineWidth = 1;
    for (let x = CANVAS_FLOOR_ORIGIN_X; x <= CANVAS_MAX_FLOOR_X; x += CANVAS_GRID_SIZE) {
      const ft = Math.round((x - CANVAS_FLOOR_ORIGIN_X) / CANVAS_GRID_SIZE);
      ctx.strokeStyle = ft % 5 === 0 ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.08)';
      ctx.beginPath();
      ctx.moveTo(x, CANVAS_FLOOR_ORIGIN_Y);
      ctx.lineTo(x, CANVAS_MAX_FLOOR_Y);
      ctx.stroke();
    }
    for (let y = CANVAS_FLOOR_ORIGIN_Y; y <= CANVAS_MAX_FLOOR_Y; y += CANVAS_GRID_SIZE) {
      const ft = Math.round((y - CANVAS_FLOOR_ORIGIN_Y) / CANVAS_GRID_SIZE);
      ctx.strokeStyle = ft % 5 === 0 ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.08)';
      ctx.beginPath();
      ctx.moveTo(CANVAS_FLOOR_ORIGIN_X, y);
      ctx.lineTo(CANVAS_MAX_FLOOR_X, y);
      ctx.stroke();
    }

    // Galvanized steel hoop arches
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    for (let archX = CANVAS_FLOOR_ORIGIN_X + 80; archX < CANVAS_MAX_FLOOR_X - 40; archX += 160) {
      ctx.beginPath();
      ctx.moveTo(archX, CANVAS_FLOOR_ORIGIN_Y);
      ctx.lineTo(archX, CANVAS_MAX_FLOOR_Y);
      ctx.stroke();
    }

    // Polycarbonate greenhouse frame border
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, width, CANVAS_FLOOR_ORIGIN_Y);
    ctx.fillRect(0, 0, CANVAS_FLOOR_ORIGIN_X, height);
    ctx.fillRect(CANVAS_MAX_FLOOR_X, 0, width - CANVAS_MAX_FLOOR_X, height);
    ctx.fillRect(0, CANVAS_MAX_FLOOR_Y, width, height - CANVAS_MAX_FLOOR_Y);
    return;
  }

  // 1. Concrete / Parquet Floor Pattern (Indoor Grow Room)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, width, height);

  // Floor grid tiles starting from CANVAS_FLOOR_ORIGIN_X and CANVAS_FLOOR_ORIGIN_Y
  // 1 square = 1 foot (40px)
  for (let x = CANVAS_FLOOR_ORIGIN_X; x <= CANVAS_MAX_FLOOR_X; x += CANVAS_GRID_SIZE) {
    const ft = Math.round((x - CANVAS_FLOOR_ORIGIN_X) / CANVAS_GRID_SIZE);
    const isMajor = ft % 5 === 0;
    ctx.strokeStyle = isMajor ? '#3f3f46' : '#27272a';
    ctx.lineWidth = isMajor ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x, CANVAS_FLOOR_ORIGIN_Y);
    ctx.lineTo(x, CANVAS_MAX_FLOOR_Y);
    ctx.stroke();

    // Subtle foot label every 5ft at top wall edge
    if (isMajor && ft > 0 && ft < 22) {
      ctx.fillStyle = '#52525b';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${ft}ft`, x, CANVAS_FLOOR_ORIGIN_Y - 6);
    }
  }

  for (let y = CANVAS_FLOOR_ORIGIN_Y; y <= CANVAS_MAX_FLOOR_Y; y += CANVAS_GRID_SIZE) {
    const ft = Math.round((y - CANVAS_FLOOR_ORIGIN_Y) / CANVAS_GRID_SIZE);
    const isMajor = ft % 5 === 0;
    ctx.strokeStyle = isMajor ? '#3f3f46' : '#27272a';
    ctx.lineWidth = isMajor ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(CANVAS_FLOOR_ORIGIN_X, y);
    ctx.lineTo(CANVAS_MAX_FLOOR_X, y);
    ctx.stroke();

    // Subtle foot label every 5ft at left wall edge
    if (isMajor && ft > 0 && ft < 14) {
      ctx.fillStyle = '#52525b';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${ft}ft`, CANVAS_FLOOR_ORIGIN_X - 6, y + 3);
    }
  }

  // 2. Room Border Walls (Inner faces at 60, 50, 940, 610)
  ctx.fillStyle = '#27272a';
  ctx.fillRect(0, 0, width, CANVAS_FLOOR_ORIGIN_Y); // Top wall: 0 to 50
  ctx.fillRect(0, 0, CANVAS_FLOOR_ORIGIN_X, height); // Left wall: 0 to 60
  ctx.fillRect(CANVAS_MAX_FLOOR_X, 0, width - CANVAS_MAX_FLOOR_X, height); // Right wall: 940 to 1000
  ctx.fillRect(0, CANVAS_MAX_FLOOR_Y, width, height - CANVAS_MAX_FLOOR_Y); // Bottom wall: 610 to 650

  // Wall Baseboards
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(CANVAS_FLOOR_ORIGIN_X, CANVAS_FLOOR_ORIGIN_Y - 4, CANVAS_MAX_FLOOR_X - CANVAS_FLOOR_ORIGIN_X, 4);
  ctx.fillRect(CANVAS_FLOOR_ORIGIN_X, CANVAS_MAX_FLOOR_Y, CANVAS_MAX_FLOOR_X - CANVAS_FLOOR_ORIGIN_X, 4);
  ctx.fillRect(CANVAS_FLOOR_ORIGIN_X - 4, CANVAS_FLOOR_ORIGIN_Y, 4, CANVAS_MAX_FLOOR_Y - CANVAS_FLOOR_ORIGIN_Y);
  ctx.fillRect(CANVAS_MAX_FLOOR_X, CANVAS_FLOOR_ORIGIN_Y, 4, CANVAS_MAX_FLOOR_Y - CANVAS_FLOOR_ORIGIN_Y);

  // Ceiling Ventilation Duct running across top
  ctx.fillStyle = '#52525b';
  ctx.fillRect(CANVAS_FLOOR_ORIGIN_X + 20, 16, (CANVAS_MAX_FLOOR_X - CANVAS_FLOOR_ORIGIN_X) - 40, 18);
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 2;
  ctx.strokeRect(CANVAS_FLOOR_ORIGIN_X + 20, 16, (CANVAS_MAX_FLOOR_X - CANVAS_FLOOR_ORIGIN_X) - 40, 18);

  // Duct vent grates
  for (let vx = CANVAS_FLOOR_ORIGIN_X + 80; vx < CANVAS_MAX_FLOOR_X - 80; vx += 120) {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(vx, 20, 24, 10);
  }
}

function drawDoorways(
  ctx: CanvasRenderingContext2D,
  doorways: Array<{ roomId: string; label: string; x: number; y: number; width: number; height: number }>,
  time: number
) {
  doorways.forEach(d => {
    // Door Portal Opening
    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.fillRect(d.x, d.y, d.width, d.height);

    // Glowing door frame
    const pulse = (Math.sin(time * 0.005) + 1) / 2;
    ctx.strokeStyle = `rgba(52, 211, 153, ${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(d.x, d.y, d.width, d.height);

    // Signboard above door
    ctx.fillStyle = '#18181b';
    ctx.fillRect(d.x - 20, d.y - 25, d.width + 40, 20);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.strokeRect(d.x - 20, d.y - 25, d.width + 40, 20);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.label, d.x + d.width / 2, d.y - 15);
    ctx.restore();
  });
}

function drawTentStructure(
  ctx: CanvasRenderingContext2D,
  tent: Tent,
  x: number,
  y: number,
  width: number,
  height: number,
  isHovered: boolean,
  time: number
) {
  const halfW = width / 2;
  const halfH = height / 2;

  ctx.save();
  ctx.translate(x, y);

  // Tent Outer Shell Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(-halfW + 4, -halfH + 6, width, height, 10);
  ctx.fill();

  // Tent Diamond Mylar Shell (Dark Oxford exterior)
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.roundRect(-halfW, -halfH, width, height, 8);
  ctx.fill();

  // Highlight outline when hovered
  if (isHovered) {
    ctx.shadowColor = 'rgba(52, 211, 153, 0.5)';
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = isHovered ? '#34d399' : '#3f3f46';
  ctx.lineWidth = isHovered ? 2.5 : 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Duct Port on Top Right with exhaust vent ring
  const ductX = halfW - Math.min(22, width * 0.18);
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.arc(ductX, -halfH, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(ductX, -halfH, 8, 0, Math.PI * 2);
  ctx.fill();

  // Internal reflective diamond mylar + warm LED grow light glow (Always visible)
  ctx.save();
  // Inner floor
  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.roundRect(-halfW + 6, -halfH + 6, width - 12, height - 12, 6);
  ctx.fill();

  // Warm overhead LED light cone glow
  const lightGlow = ctx.createRadialGradient(0, -halfH + 25, 8, 0, 0, Math.min(halfW, halfH) * 1.15);
  lightGlow.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
  lightGlow.addColorStop(0.7, 'rgba(254, 240, 138, 0.08)');
  lightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = lightGlow;
  ctx.beginPath();
  ctx.roundRect(-halfW + 6, -halfH + 6, width - 12, height - 12, 6);
  ctx.fill();

  // Hanging Quantum Board LED Light
  const ledW = Math.min(width * 0.55, 85);
  const ledH = 7;
  ctx.fillStyle = '#d4d4d8';
  ctx.fillRect(-ledW / 2, -halfH + 10, ledW, ledH);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(-ledW / 2 + 2, -halfH + 14, ledW - 4, 3);

  // Hanging wire cables
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-ledW / 2 + 4, -halfH + 6);
  ctx.lineTo(-ledW / 2 + 4, -halfH + 10);
  ctx.moveTo(ledW / 2 - 4, -halfH + 6);
  ctx.lineTo(ledW / 2 - 4, -halfH + 10);
  ctx.stroke();

  ctx.restore();

  // Tent Title & Climate HUD badge above tent
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.roundRect(-halfW, -halfH - 24, width, 20, 5);
  ctx.fill();
  ctx.strokeStyle = isHovered ? '#34d399' : '#3f3f46';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = isHovered ? '#6ee7b7' : '#e4e4e7';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  const itemCount = tent.items.length;
  const countLabel = itemCount > 0 ? ` (${itemCount})` : '';
  const tentLabel = isHovered ? `⚙️ ${tent.name}${countLabel}` : `⛺ ${tent.name}${countLabel}`;
  ctx.fillText(tentLabel, -halfW + 6, -halfH - 11);

  if (width >= 130) {
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#34d399';
    const tentTemp = `${tent.climate.tempF.toFixed(0)}°F`;
    const tentRh = `${tent.climate.rh.toFixed(0)}%`;
    ctx.fillText(`${tentTemp} | ${tentRh}`, halfW - 6, -halfH - 11);
  }

  ctx.restore();
}

// Helper to calculate coordinates for crops placed on the room floor / outdoor garden
function getRoomCropCoordinates(
  room: Room,
  cropIndex: number,
  totalCrops: number,
  canvasWidth: number = 1000
): { x: number; y: number } {
  if (room.environmentType === 'outdoor_garden' || room.environmentType === 'greenhouse') {
    const colsPerRow = Math.min(6, Math.max(3, Math.ceil(totalCrops / 2)));
    const col = cropIndex % colsPerRow;
    const row = Math.floor(cropIndex / colsPerRow);
    return {
      x: CANVAS_FLOOR_ORIGIN_X + (2 + col * 3) * CANVAS_GRID_SIZE,
      y: CANVAS_FLOOR_ORIGIN_Y + (3 + row * 4) * CANVAS_GRID_SIZE
    };
  }
  return {
    x: CANVAS_FLOOR_ORIGIN_X + (16 + (cropIndex % 3) * 2) * CANVAS_GRID_SIZE,
    y: CANVAS_FLOOR_ORIGIN_Y + (8 + Math.floor(cropIndex / 3) * 2) * CANVAS_GRID_SIZE
  };
}

interface PlacedItem {
  item: Item;
  tentId?: string;
  x: number; // screen px of the footprint center on the floor
  y: number;
  overhead: boolean; // ceiling-mounted: drawn top-down in the overhead layer
}

// Screen placement of every item in a room (tent contents + room floor) in draw order:
// floor-level items back-to-front, then the overhead (ceiling-mounted) layer.
function getPlacedRoomItems(room: Room): PlacedItem[] {
  const placed: PlacedItem[] = [];
  const isCrop = (it: Item) => it.category === 'plant' || it.category === 'mushroom';
  const isOccupant = (it: Item) => it.category === 'person' || it.category === 'pet';

  room.tents.forEach((tent, tIdx) => {
    const tentPos = getSafeTentCanvasPosition(tent, room, tIdx, 1000, 650);
    [tent.items.filter(isCrop), tent.items.filter(it => it.category === 'equipment'), tent.items.filter(isOccupant)].forEach(group => {
      group.forEach((item, idx) => {
        const pos = getSafeTentItemCanvasPosition(item, tent, tentPos.x, tentPos.y, idx, group.length);
        placed.push({ item, tentId: tent.id, x: pos.x, y: pos.y, overhead: isOverheadItem(item, tent.dimensions.height) });
      });
    });
  });

  const fromPosition = (item: Item) => item.position && typeof item.position.x === 'number' && typeof item.position.y === 'number'
    ? {
        x: Math.round(CANVAS_FLOOR_ORIGIN_X + item.position.x * CANVAS_GRID_SIZE),
        y: Math.round(CANVAS_FLOOR_ORIGIN_Y + item.position.y * CANVAS_GRID_SIZE)
      }
    : null;

  const overheadInRoom = (item: Item) => isOverheadItem(item, room.dimensions.height);
  const roomCrops = room.items.filter(isCrop);
  roomCrops.forEach((item, idx) => {
    placed.push({ item, overhead: overheadInRoom(item), ...(fromPosition(item) || getRoomCropCoordinates(room, idx, roomCrops.length)) });
  });
  room.items.filter(it => it.category === 'equipment').forEach((item, idx) => {
    placed.push({ item, overhead: overheadInRoom(item), ...(fromPosition(item) || { x: CANVAS_FLOOR_ORIGIN_X + (idx + 1) * 3 * CANVAS_GRID_SIZE, y: CANVAS_MAX_FLOOR_Y - 40 }) });
  });
  room.items.filter(isOccupant).forEach((item, idx) => {
    placed.push({ item, overhead: false, ...(fromPosition(item) || { x: CANVAS_FLOOR_ORIGIN_X + (idx + 1) * 4 * CANVAS_GRID_SIZE, y: CANVAS_MAX_FLOOR_Y - 40 }) });
  });

  return placed.sort((a, b) => (a.overhead === b.overhead ? a.y - b.y : a.overhead ? 1 : -1));
}

// Draws one item at true scale: floor footprint (L x W), then the upright sprite (L x H) lifted by its z elevation.
function drawPlacedItem(ctx: CanvasRenderingContext2D, placed: PlacedItem, isHovered: boolean, time: number) {
  const { item, x, y } = placed;
  if (placed.overhead) {
    drawOverheadItem(ctx, placed, isHovered, time);
    return;
  }
  const box = getItemScreenBox(item, x, y);

  drawItemFootprint(ctx, item, x, y, isHovered);

  // Hanging / mounted items: dashed drop line from the footprint up to the item's base
  if (box.baseY < y - 4) {
    ctx.save();
    ctx.strokeStyle = 'rgba(161, 161, 170, 0.35)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, box.baseY);
    ctx.stroke();
    ctx.restore();
  }

  if (item.category === 'plant') {
    drawPlantToScale(item, { ctx, x, y: box.baseY, time, highlighted: isHovered });
    return;
  }
  if (item.category === 'mushroom') {
    drawMushroomToScale(item, { ctx, x, y: box.baseY, time, highlighted: isHovered });
    return;
  }

  const widthPx = feetToPx(item.dimensions.length);
  const heightPx = feetToVerticalPx(item.dimensions.height);
  if (item.category === 'equipment') {
    drawSpriteToScale(ctx, {
      key: `equipment|${item.type}`,
      draw: c => drawEquipmentSprite(c, item, 0, 0, isHovered, time, false),
      measure: c => drawEquipmentSprite(c, { ...item, powerOn: false }, 0, 0, false, 0, false),
      anchorX: x,
      anchorY: box.baseY,
      widthPx,
      heightPx
    });
    drawItemLabel(ctx, item.name.length > 12 ? item.name.substring(0, 10) + '..' : item.name, x, box.bottom + 2, isHovered);
    return;
  }

  drawSpriteToScale(ctx, {
    key: `occupant|${item.category}`,
    draw: c => drawOccupantSprite(c, item, 0, 0, isHovered, false),
    anchorX: x,
    anchorY: box.baseY,
    widthPx,
    heightPx
  });
  drawItemLabel(ctx, item.name.length > 10 ? item.name.substring(0, 8) + '..' : item.name, x, box.bottom + 2, isHovered);
}

// Ceiling-mounted item seen from above: dashed to-scale footprint, light pool if lit, fitted sprite and height tag.
function drawOverheadItem(ctx: CanvasRenderingContext2D, placed: PlacedItem, isHovered: boolean, time: number) {
  const { item, x, y } = placed;
  const l = feetToPx(item.dimensions.length);
  const w = feetToPx(item.dimensions.width);

  if (item.category === 'equipment' && item.type === 'grow_light' && item.powerOn) {
    const radius = Math.max(l, w) * 0.75;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.16)');
    glow.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.save();
  ctx.strokeStyle = isHovered ? 'rgba(56, 189, 248, 0.95)' : 'rgba(186, 230, 253, 0.45)';
  ctx.lineWidth = isHovered ? 1.5 : 1;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x - l / 2, y - w / 2, l, w);
  ctx.restore();

  // Translucent so the canopy below stays visible
  ctx.save();
  ctx.globalAlpha = isHovered ? 0.75 : 0.4;
  if (item.category === 'equipment') {
    drawSpriteFitted(ctx, {
      key: `overhead-equipment|${item.type}`,
      draw: c => drawEquipmentSprite(c, { ...item, powerOn: item.type === 'grow_light' ? false : item.powerOn }, 0, 0, isHovered, time, false),
      measure: c => drawEquipmentSprite(c, { ...item, powerOn: false }, 0, 0, false, 0, false),
      cx: x,
      cy: y,
      widthPx: l,
      heightPx: w
    });
  } else if (item.category === 'plant') {
    drawPlantToScale(item, { ctx, x, y: y + w / 2, time, highlighted: isHovered });
  } else if (item.category === 'mushroom') {
    drawMushroomToScale(item, { ctx, x, y: y + w / 2, time, highlighted: isHovered });
  }
  ctx.restore();

  const name = item.name.length > 12 ? item.name.substring(0, 10) + '..' : item.name;
  drawItemLabel(ctx, `${name} ▲${(item.position?.z || 0).toFixed(1)}′`, x, y + w / 2 + 2, isHovered);
}

function drawEquipmentSprite(
  ctx: CanvasRenderingContext2D,
  eq: EquipmentItem,
  x: number,
  y: number,
  isHovered: boolean,
  time: number,
  showLabel: boolean = true
) {
  ctx.save();
  ctx.translate(x, y);

  if (isHovered) {
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
  }

  const powerColor = eq.powerOn ? '#10b981' : '#71717a';

  if (eq.type === 'humidifier') {
    // Humidifier tank & base
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-12, -18, 24, 30, 4);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#38bdf8' : '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Water level window (cyan)
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-6, -10, 12, 16);

    // Power LED
    ctx.fillStyle = powerColor;
    ctx.beginPath();
    ctx.arc(0, 8, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Animated mist plume when powered ON
    if (eq.powerOn) {
      const mistOffset = Math.sin(time * 0.006) * 3;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.6)';
      ctx.beginPath();
      ctx.arc(mistOffset, -24, 5, 0, Math.PI * 2);
      ctx.arc(-mistOffset, -30, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (eq.type === 'dehumidifier') {
    // Dehumidifier cube
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 28, 4);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#38bdf8' : '#52525b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Grille lines
    ctx.fillStyle = '#3f3f46';
    for (let gy = -8; gy <= 4; gy += 4) {
      ctx.fillRect(-10, gy, 20, 2);
    }
    // Power LED
    ctx.fillStyle = powerColor;
    ctx.beginPath();
    ctx.arc(8, 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (eq.type === 'oscillating_fan') {
    // Clip-on oscillating fan
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.roundRect(-3, 6, 6, 8, 2);
    ctx.fill();

    // Fan cage
    ctx.strokeStyle = isHovered ? '#38bdf8' : '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -2, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Blades
    ctx.save();
    ctx.translate(0, -2);
    if (eq.powerOn) {
      ctx.rotate(time * 0.02);
    }
    ctx.fillStyle = eq.powerOn ? '#38bdf8' : '#94a3b8';
    for (let b = 0; b < 3; b++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.ellipse(0, 5, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Fan center hub & LED
    ctx.fillStyle = powerColor;
    ctx.beginPath();
    ctx.arc(0, -2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (eq.type === 'exhaust_fan') {
    // Inline duct fan cylinder
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-15, -10, 30, 20, 5);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#38bdf8' : '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Airflow impeller blades
    ctx.fillStyle = eq.powerOn ? '#38bdf8' : '#94a3b8';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = powerColor;
    ctx.beginPath();
    ctx.arc(10, -5, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (eq.type === 'grow_light') {
    // Hanging LED quantum board
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(-20, -6, 40, 12, 3);
    ctx.fill();

    // LED diodes glowing
    ctx.fillStyle = eq.powerOn ? '#fef08a' : '#94a3b8';
    for (let lx = -14; lx <= 14; lx += 7) {
      ctx.fillRect(lx - 2, -2, 4, 4);
    }
    if (eq.powerOn) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.2)';
      ctx.beginPath();
      ctx.moveTo(-20, 6);
      ctx.lineTo(-28, 22);
      ctx.lineTo(28, 22);
      ctx.lineTo(20, 6);
      ctx.closePath();
      ctx.fill();
    }
  } else if (eq.type === 'heater' || eq.type === 'heat_mat') {
    // Radiant heater
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.roundRect(-10, -14, 20, 28, 4);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#f97316' : '#78350f';
    ctx.stroke();

    // Orange glowing coils
    ctx.fillStyle = eq.powerOn ? '#f97316' : '#78350f';
    for (let hy = -8; hy <= 6; hy += 4) {
      ctx.fillRect(-6, hy, 12, 2);
    }
  } else if (eq.type === 'co2_regulator' || eq.type === 'co2_bag') {
    // CO2 cylinder / bag
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.roundRect(-8, -16, 16, 30, 4);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#34d399' : '#166534';
    ctx.stroke();

    // Brass gauge
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -18, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Generic environmental controller / gear box
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(-12, -12, 24, 24, 3);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#38bdf8' : '#52525b';
    ctx.stroke();

    ctx.fillStyle = powerColor;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mini label beneath device
  if (showLabel) {
    ctx.fillStyle = isHovered ? '#e2e8f0' : '#a1a1aa';
    ctx.font = 'bold 7.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(eq.name.length > 12 ? eq.name.substring(0, 10) + '..' : eq.name, 0, 18);
  }

  ctx.restore();
}

function drawOccupantSprite(
  ctx: CanvasRenderingContext2D,
  occ: Item,
  x: number,
  y: number,
  isHovered: boolean,
  showLabel: boolean = true
) {
  ctx.save();
  ctx.translate(x, y);

  if (occ.category === 'person') {
    // Worker / Cultivator
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.roundRect(-7, -15, 14, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -20, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (occ.category === 'pet') {
    // Cute dog or cat
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(0, -4, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -9, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (showLabel) {
    ctx.fillStyle = isHovered ? '#e2e8f0' : '#d4d4d8';
    ctx.font = 'bold 7.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(occ.name.length > 10 ? occ.name.substring(0, 8) + '..' : occ.name, 0, 10);
  }

  ctx.restore();
}

function drawCultivatorAvatar(
  ctx: CanvasRenderingContext2D,
  player: { x: number; y: number; facing: string; isMoving: boolean; walkFrame: number }
) {
  const { x, y, facing, isMoving, walkFrame } = player;

  ctx.save();
  ctx.translate(x, y);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const legOffset = isMoving ? Math.sin(walkFrame * 2) * 4 : 0;

  // Boots / Legs
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(-7 + legOffset, -2, 5, 8);
  ctx.fillRect(2 - legOffset, -2, 5, 8);

  // Cultivator Work Overalls (Green Garden Apron)
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.roundRect(-9, -20, 18, 20, 4);
  ctx.fill();

  // Pockets on apron
  ctx.fillStyle = '#047857';
  ctx.fillRect(-6, -11, 12, 7);

  // Tools in pocket (tiny shears handle)
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-3, -15, 3, 5);

  // Head
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(0, -26, 7, 0, Math.PI * 2);
  ctx.fill();

  // Cultivator Cap
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(0, -29, 7.5, Math.PI, Math.PI * 2);
  ctx.fill();
  // Cap visor facing direction
  if (facing === 'right') {
    ctx.fillRect(0, -29, 9, 3);
  } else if (facing === 'left') {
    ctx.fillRect(-9, -29, 9, 3);
  } else if (facing === 'down') {
    ctx.fillRect(-6, -26, 12, 3);
  }

  // Eyes
  if (facing === 'down') {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-3, -27, 2, 2);
    ctx.fillRect(2, -27, 2, 2);
  } else if (facing === 'right') {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(2, -27, 2, 2);
  } else if (facing === 'left') {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-4, -27, 2, 2);
  }

  ctx.restore();
}

function drawFloatingPopups(
  ctx: CanvasRenderingContext2D,
  floatingTexts: Array<{ id: string; text: string; x: number; y: number; color: string; createdAt: number }>
) {
  const now = Date.now();
  floatingTexts.forEach(item => {
    const elapsed = now - item.createdAt;
    const progress = elapsed / 2000;
    const floatY = item.y - progress * 40;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.fillStyle = item.color;
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(item.text, item.x, floatY);
    ctx.restore();
  });
}

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
  JournalEntry
} from '../../types/sim';
import { drawPlant, drawMushroom } from './PlantSprites';
import { soundEffects } from './AudioEffects';
import { PlantVisualizerModal } from './PlantVisualizerModal';
import { broadcastSimulationState, subscribeToSimulationSync } from '../../utils/syncChannel';
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
  ChevronRight,
  Maximize2
} from 'lucide-react';

interface GameWorldProps {
  state: SimulationState;
  onUpdateState: (updater: (prev: SimulationState) => SimulationState) => void;
  onOpenAddItem: (tentId?: string) => void;
  onOpenAddRoom: () => void;
  onOpenHarvestModal: () => void;
  onSwitchToDashboard: () => void;
}

type ToolType = 'inspect' | 'water' | 'harvest' | 'feed' | 'mist' | 'build';

export const GameWorld: React.FC<GameWorldProps> = ({
  state,
  onUpdateState,
  onOpenAddItem,
  onOpenAddRoom,
  onOpenHarvestModal,
  onSwitchToDashboard
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

  // Tents unzipped status (tentId -> boolean)
  const [unzippedTents, setUnzippedTents] = useState<Record<string, boolean>>({});

  // Hovered interactable object in world
  const [hoveredObject, setHoveredObject] = useState<{
    type: 'tent' | 'plant' | 'mushroom' | 'door';
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
      // Don't capture inputs if typing inside an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

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

      // [Z] or [O] to toggle zipper on nearby tent
      if (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'o') {
        toggleNearbyTentZipper();
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

        // Room boundaries
        const minX = 70;
        const maxX = 930;
        const minY = 90;
        const maxY = 560;

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
  }, [currentRoom]);

// Helper to calculate clean coordinates for crops inside a tent so they never overflow
function getTentCropCoordinates(
  tentBaseX: number,
  tentBaseY: number,
  cropIndex: number,
  totalCrops: number
): { x: number; y: number } {
  // Tent inner dimensions: 230 width x 180 height (centered at tentBaseX, tentBaseY)
  // Interior canopy floor is between tentBaseY - 15 and tentBaseY + 45
  if (totalCrops <= 3) {
    const spacing = 65;
    const startX = tentBaseX - ((totalCrops - 1) * spacing) / 2;
    return {
      x: startX + cropIndex * spacing,
      y: tentBaseY + 22
    };
  } else {
    const col = cropIndex % 3;
    const row = Math.floor(cropIndex / 3);
    return {
      x: tentBaseX - 60 + col * 60,
      y: tentBaseY - 5 + row * 45
    };
  }
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
    const spacing = Math.min(130, (canvasWidth - 260) / Math.max(1, colsPerRow - 1 || 1));
    return {
      x: 140 + col * spacing,
      y: row === 0 ? 190 : 280 + (row - 1) * 130
    };
  }
  return {
    x: 700 + (cropIndex % 3) * 70,
    y: 400 + Math.floor(cropIndex / 3) * 60
  };
}

  // Proximity action: find nearest interactable item or tent
  const triggerProximityAction = () => {
    const p = playerRef.current;

    // Check all crops inside unzipped tents or room
    let closestCrop: { item: PlantItem | MushroomItem; tentId?: string; dist: number; wx: number; wy: number } | null = null;
    
    for (let tIdx = 0; tIdx < currentRoom.tents.length; tIdx++) {
      const tent = currentRoom.tents[tIdx];
      const tentBaseX = 140 + (tIdx % 3) * 280;
      const tentBaseY = 170 + Math.floor(tIdx / 3) * 230;
      const isUnzipped = unzippedTents[tent.id] ?? true;

      if (isUnzipped) {
        const crops = tent.items.filter(it => it.category === 'plant' || it.category === 'mushroom');
        for (let cIdx = 0; cIdx < crops.length; cIdx++) {
          const item = crops[cIdx];
          const pos = getTentCropCoordinates(tentBaseX, tentBaseY, cIdx, crops.length);
          const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
          if (dist < 90 && (!closestCrop || dist < closestCrop.dist)) {
            closestCrop = { item: item as PlantItem | MushroomItem, tentId: tent.id, dist, wx: pos.x, wy: pos.y };
          }
        }
      }
    }

    // Check room items
    const roomCrops = currentRoom.items.filter(it => it.category === 'plant' || it.category === 'mushroom');
    for (let cIdx = 0; cIdx < roomCrops.length; cIdx++) {
      const item = roomCrops[cIdx];
      const pos = getRoomCropCoordinates(currentRoom, cIdx, roomCrops.length);
      const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (dist < 90 && (!closestCrop || dist < closestCrop.dist)) {
        closestCrop = { item: item as PlantItem | MushroomItem, dist, wx: pos.x, wy: pos.y };
      }
    }

    if (closestCrop) {
      const target: { item: PlantItem | MushroomItem; tentId?: string; wx: number; wy: number } = closestCrop;
      applyToolToCrop(target.item, target.tentId, target.wx, target.wy);
      return;
    }

    // Otherwise toggle nearest tent zipper
    toggleNearbyTentZipper();
  };

  const toggleNearbyTentZipper = () => {
    const p = playerRef.current;
    let closestTent: Tent | null = null;
    let minDist = 140;

    for (let tIdx = 0; tIdx < currentRoom.tents.length; tIdx++) {
      const tent = currentRoom.tents[tIdx];
      const tentBaseX = 140 + (tIdx % 3) * 280;
      const tentBaseY = 170 + Math.floor(tIdx / 3) * 230;
      const dist = Math.hypot(p.x - tentBaseX, p.y - tentBaseY);
      if (dist < minDist) {
        minDist = dist;
        closestTent = tent;
      }
    }

    if (closestTent) {
      const tentId = (closestTent as Tent).id;
      soundEffects.playClick();
      setUnzippedTents(prev => ({
        ...prev,
        [tentId]: !(prev[tentId] ?? true)
      }));
      addFloatingText(
        !(unzippedTents[tentId] ?? true) ? 'Door Zipper Opened 🌿' : 'Door Zipper Sealed 🔒',
        playerRef.current.x,
        playerRef.current.y - 40,
        '#6ee7b7'
      );
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

      const harvestRecord: HarvestRecord = {
        id: `h-${Date.now()}`,
        name: crop.name,
        species: crop.species,
        type: crop.category === 'plant' ? 'plant' : 'mushroom',
        yieldGrams,
        dateStr: new Date(state.simTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        quality
      };

      onUpdateState(prev => {
        const next = removeCropFromSimulation(prev, crop.id, tentId);
        next.harvests = [...next.harvests, harvestRecord];
        next.journal.push({
          id: `j-${Date.now()}`,
          time: next.simTime,
          type: 'success',
          category: 'crop',
          title: `🏆 Harvest Completed: ${crop.name}`,
          message: `Yielded ${yieldGrams}g of ${quality} grade ${crop.species}. Added to facility harvest inventory!`
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

    // Check if clicked on a Crop (inside tent or room)
    const clickedCrop = findCropAtPosition(clickX, clickY);
    if (clickedCrop) {
      applyToolToCrop(clickedCrop.item, clickedCrop.tentId, clickX, clickY);
      return;
    }

    // Check if clicked on a Tent Door flap
    const clickedTent = findTentAtPosition(clickX, clickY);
    if (clickedTent) {
      soundEffects.playClick();
      setUnzippedTents(prev => ({
        ...prev,
        [clickedTent.id]: !(prev[clickedTent.id] ?? true)
      }));
      addFloatingText(
        !(unzippedTents[clickedTent.id] ?? true) ? 'Door Zipper Opened 🌿' : 'Door Zipper Sealed 🔒',
        clickedTent.x + 100,
        clickedTent.y + 40,
        '#6ee7b7'
      );
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

    const crop = findCropAtPosition(mouseX, mouseY);
    if (crop) {
      setHoveredObject({
        type: crop.item.category === 'plant' ? 'plant' : 'mushroom',
        id: crop.item.id,
        parentTentId: crop.tentId,
        title: `${crop.item.name} (${crop.item.stage})`,
        x: mouseX,
        y: mouseY
      });
      return;
    }

    const tent = findTentAtPosition(mouseX, mouseY);
    if (tent) {
      setHoveredObject({
        type: 'tent',
        id: tent.id,
        title: `${tent.name} [Click Zipper]`,
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

  // Helper to find crop under cursor
  const findCropAtPosition = (x: number, y: number) => {
    for (let tIdx = 0; tIdx < currentRoom.tents.length; tIdx++) {
      const tent = currentRoom.tents[tIdx];
      const tentBaseX = 140 + (tIdx % 3) * 280;
      const tentBaseY = 170 + Math.floor(tIdx / 3) * 230;
      const isUnzipped = unzippedTents[tent.id] ?? true;

      if (isUnzipped) {
        const crops = tent.items.filter(it => it.category === 'plant' || it.category === 'mushroom');
        for (let cIdx = 0; cIdx < crops.length; cIdx++) {
          const item = crops[cIdx];
          const pos = getTentCropCoordinates(tentBaseX, tentBaseY, cIdx, crops.length);
          if (Math.hypot(x - pos.x, y - pos.y) < 28) {
            return { item: item as PlantItem | MushroomItem, tentId: tent.id, x: pos.x, y: pos.y };
          }
        }
      }
    }

    const roomCrops = currentRoom.items.filter(it => it.category === 'plant' || it.category === 'mushroom');
    for (let cIdx = 0; cIdx < roomCrops.length; cIdx++) {
      const item = roomCrops[cIdx];
      const pos = getRoomCropCoordinates(currentRoom, cIdx, roomCrops.length);
      if (Math.hypot(x - pos.x, y - pos.y) < 32) {
        return { item: item as PlantItem | MushroomItem, x: pos.x, y: pos.y };
      }
    }

    return null;
  };

  // Helper to find tent under cursor
  const findTentAtPosition = (x: number, y: number) => {
    for (let tIdx = 0; tIdx < currentRoom.tents.length; tIdx++) {
      const tent = currentRoom.tents[tIdx];
      const tx = 140 + (tIdx % 3) * 280;
      const ty = 170 + Math.floor(tIdx / 3) * 230;
      const width = 230;
      const height = 180;

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

      // 1. Draw Architectural Floor & Walls
      drawRoomEnvironment(ctx, canvas.width, canvas.height, currentRoom, state.simTime);

      // 2. Draw Doorways / Travel Portals
      drawDoorways(ctx, getRoomDoorways(), time);

      // 3. Draw Facility Tents & Contents
      currentRoom.tents.forEach((tent, tIdx) => {
        const tx = 140 + (tIdx % 3) * 280;
        const ty = 170 + Math.floor(tIdx / 3) * 230;
        const isUnzipped = unzippedTents[tent.id] ?? true;
        drawTentStructure(ctx, tent, tx, ty, isUnzipped, time);

        // If unzipped, draw plants / mushrooms inside
        if (isUnzipped) {
          const crops = tent.items.filter(it => it.category === 'plant' || it.category === 'mushroom');
          crops.forEach((item, cIdx) => {
            const pos = getTentCropCoordinates(tx, ty, cIdx, crops.length);
            const cropX = pos.x;
            const cropY = pos.y;
            const isHovered = hoveredObject?.id === item.id;

            if (item.category === 'plant') {
              drawPlant(item as PlantItem, {
                ctx,
                x: cropX,
                y: cropY,
                scale: 0.85,
                time,
                highlighted: isHovered
              });
            } else if (item.category === 'mushroom') {
              drawMushroom(item as MushroomItem, {
                ctx,
                x: cropX,
                y: cropY,
                scale: 0.85,
                time,
                highlighted: isHovered
              });
            }
          });
        }
      });

      // 4. Draw Free-standing Room Items (Outdoor Garden Beds, Trellises & freestanding plants)
      const roomCrops = currentRoom.items.filter(it => it.category === 'plant' || it.category === 'mushroom');
      roomCrops.forEach((item, cIdx) => {
        const pos = getRoomCropCoordinates(currentRoom, cIdx, roomCrops.length, canvas.width);
        const cropX = pos.x;
        const cropY = pos.y;
        const isHovered = hoveredObject?.id === item.id;

        if (item.category === 'plant') {
          drawPlant(item as PlantItem, {
            ctx,
            x: cropX,
            y: cropY,
            scale: 0.9,
            time,
            highlighted: isHovered
          });
        } else if (item.category === 'mushroom') {
          drawMushroom(item as MushroomItem, {
            ctx,
            x: cropX,
            y: cropY,
            scale: 0.9,
            time,
            highlighted: isHovered
          });
        }
      });

      // 5. Draw Player Avatar
      drawCultivatorAvatar(ctx, playerRef.current);

      // 6. Draw Floating Notifications & Sparkles
      drawFloatingPopups(ctx, floatingTexts);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [currentRoom, unzippedTents, hoveredObject, floatingTexts, state.simTime]);

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
              🌡️ {state.tempUnit === 'F' ? `${currentRoom.climate.tempF}°F` : `${currentRoom.climate.tempC}°C`}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-cyan-300">
              💧 {currentRoom.climate.rh}% RH
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-emerald-300">
              🌿 {currentRoom.climate.vpdKpa} kPa
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-purple-300">
              🌫️ {currentRoom.climate.co2Ppm} ppm
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

        {/* Right: Sound, Harvest Log, Dual-Screen Popout */}
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

          {/* Harvests */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onOpenHarvestModal();
            }}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Award className="w-3.5 h-3.5" />
            <span>{state.harvests.length} Harvests</span>
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
            <div><span className="text-zinc-200 font-semibold">[Z / O]</span> Unzip / Zip Tent Door</div>
            <div><span className="text-zinc-200 font-semibold">[1 - 6]</span> Switch Hotbar Tool</div>
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

    // Mowed lawn stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = 0; x < width; x += 80) {
      ctx.fillRect(x, 0, 40, height);
    }

    // Flagstone garden walkway
    ctx.fillStyle = '#52525b';
    ctx.fillRect(60, 350, width - 120, 38);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(60, 350, width - 120, 38);
    for (let px = 85; px < width - 120; px += 45) {
      ctx.beginPath();
      ctx.moveTo(px, 350);
      ctx.lineTo(px, 388);
      ctx.stroke();
    }

    // Wooden Trellis Posts & Top Cable Wire across garden rows
    ctx.strokeStyle = '#78350f'; // Cedar wood posts
    ctx.lineWidth = 6;
    for (let postX = 120; postX <= width - 120; postX += 160) {
      ctx.beginPath();
      ctx.moveTo(postX, 100);
      ctx.lineTo(postX, 260);
      ctx.stroke();
    }
    // High-tension trellis wire cable connecting tops
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(90, 105);
    ctx.lineTo(width - 90, 105);
    ctx.stroke();

    // Cedar Wood Garden Fence Perimeter
    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, 0, width, 40);
    ctx.fillRect(0, 0, 40, height);
    ctx.fillRect(width - 40, 0, 40, height);
    ctx.fillRect(0, height - 30, width, 30);

    // Fence pickets
    ctx.fillStyle = '#78350f';
    for (let fx = 10; fx < width; fx += 25) {
      ctx.fillRect(fx, 4, 18, 36);
      ctx.fillRect(fx, height - 30, 18, 26);
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

    // Gravel pea stones
    ctx.fillStyle = '#334155';
    for (let gx = 60; gx < width - 60; gx += 45) {
      for (let gy = 60; gy < height - 60; gy += 45) {
        ctx.beginPath();
        ctx.arc(gx + (gy % 20), gy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Galvanized steel hoop arches
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    for (let archX = 100; archX < width - 60; archX += 180) {
      ctx.beginPath();
      ctx.moveTo(archX, 50);
      ctx.lineTo(archX, height - 35);
      ctx.stroke();
    }

    // Polycarbonate greenhouse frame
    ctx.fillStyle = 'rgba(240, 253, 250, 0.08)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, width, 45);
    ctx.fillRect(0, 0, 45, height);
    ctx.fillRect(width - 45, 0, 45, height);
    ctx.fillRect(0, height - 35, width, 35);
    return;
  }

  // 1. Concrete / Parquet Floor Pattern (Indoor Grow Room)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, width, height);

  // Floor grid tiles
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  const tileSize = 40;
  for (let x = 0; x < width; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 2. Room Border Walls
  ctx.fillStyle = '#27272a';
  ctx.fillRect(0, 0, width, 50); // Top wall
  ctx.fillRect(0, 0, 50, height); // Left wall
  ctx.fillRect(width - 50, 0, 50, height); // Right wall
  ctx.fillRect(0, height - 35, width, 35); // Bottom wall

  // Wall Baseboards
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(50, 46, width - 100, 4);
  ctx.fillRect(50, height - 39, width - 100, 4);

  // Ceiling Ventilation Duct running across top
  ctx.fillStyle = '#52525b';
  ctx.fillRect(80, 16, width - 160, 18);
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 2;
  ctx.strokeRect(80, 16, width - 160, 18);

  // Duct vent grates
  for (let vx = 140; vx < width - 140; vx += 120) {
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
  isUnzipped: boolean,
  time: number
) {
  const width = 230;
  const height = 180;
  const halfW = width / 2;
  const halfH = height / 2;

  ctx.save();
  ctx.translate(x, y);

  // Tent Outer Shell Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.roundRect(-halfW + 6, -halfH + 8, width, height, 12);
  ctx.fill();

  // Tent Diamond Mylar Shell (Dark Oxford exterior)
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.roundRect(-halfW, -halfH, width, height, 10);
  ctx.fill();

  ctx.strokeStyle = isUnzipped ? '#34d399' : '#3f3f46';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Duct Port on Top Right with animated airflow particles
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.arc(halfW - 25, -halfH, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(halfW - 25, -halfH, 10, 0, Math.PI * 2);
  ctx.fill();

  // If unzipped: render internal reflective diamond mylar + warm LED grow light glow
  if (isUnzipped) {
    ctx.save();
    // Inner floor
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(-halfW + 8, -halfH + 8, width - 16, height - 16, 8);
    ctx.fill();

    // Warm overhead LED light cone glow
    const lightGlow = ctx.createRadialGradient(0, -halfH + 30, 10, 0, 0, 110);
    lightGlow.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
    lightGlow.addColorStop(0.7, 'rgba(254, 240, 138, 0.08)');
    lightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lightGlow;
    ctx.beginPath();
    ctx.roundRect(-halfW + 8, -halfH + 8, width - 16, height - 16, 8);
    ctx.fill();

    // Hanging Quantum Board LED Light
    ctx.fillStyle = '#d4d4d8';
    ctx.fillRect(-45, -halfH + 12, 90, 8);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-42, -halfH + 17, 84, 3);

    // Hanging wire cables
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-40, -halfH + 8);
    ctx.lineTo(-40, -halfH + 12);
    ctx.moveTo(40, -halfH + 8);
    ctx.lineTo(40, -halfH + 12);
    ctx.stroke();

    ctx.restore();
  } else {
    // Closed Door Flap with Heavy Duty Zipper
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(-halfW + 10, -halfH + 10, width - 20, height - 20, 8);
    ctx.fill();

    // Zipper line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, -halfH + 10);
    ctx.lineTo(0, halfH - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zipper Pull Tab
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    // Unzip Prompt
    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLICK OR [Z] TO UNZIP', 0, 30);
  }

  // Tent Title & Climate HUD badge above
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.roundRect(-halfW + 6, -halfH - 22, width - 12, 18, 5);
  ctx.fill();
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#e4e4e7';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tent.name, -halfW + 12, -halfH - 9);

  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#34d399';
  ctx.fillText(`${tent.climate.tempF}°F | ${tent.climate.rh}% | ${tent.climate.vpdKpa}kPa`, halfW - 12, -halfH - 9);

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

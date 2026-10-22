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
  OutdoorLocation,
  OutsideConditions 
} from './types/sim';
import { loadSimulation, saveSimulation, resetSimulation } from './utils/storage';
import { simulateEnvironmentTick } from './utils/physics';
import { getCachedHourlyWeather, getOutdoorConditionsForSimTime, CachedWeatherPackage } from './utils/weatherService';
import { HeaderClock } from './components/HeaderClock';
import { ClimateDashboard } from './components/ClimateDashboard';
import { InteractiveFloorplan } from './components/InteractiveFloorplan';
import { ItemInspector } from './components/ItemInspector';
import { AddItemModal } from './components/AddItemModal';
import { HarvestLogModal } from './components/HarvestLogModal';
import { GrowJournal } from './components/GrowJournal';
import { LocationModal } from './components/LocationModal';
import { AddRoomModal } from './components/AddRoomModal';
import { GameWorld } from './components/game/GameWorld';
import { broadcastSimulationState, subscribeToSimulationSync } from './utils/syncChannel';

export default function App() {
  const [state, setState] = useState<SimulationState>(() => loadSimulation());
  const [lastSavedAt, setLastSavedAt] = useState<number>(Date.now());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [addModalTentId, setAddModalTentId] = useState<string | null>(null);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'floorplan'>('dashboard');
  const [viewMode, setViewMode] = useState<'dashboard' | 'game'>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash === '#game' || new URLSearchParams(window.location.search).get('view') === 'game' 
        ? 'game' 
        : 'dashboard';
    }
    return 'dashboard';
  });

  // Ref to hold current state for interval tick without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // Cached hourly weather dataset ref (to avoid repeated network requests during ticks)
  const weatherPackageRef = useRef<CachedWeatherPackage | null>(null);

  // Initial load of cached hourly weather for current location
  useEffect(() => {
    let isMounted = true;
    const loc = state.outdoorLocation;
    getCachedHourlyWeather(loc.lat, loc.lon, state.simTime).then(pkg => {
      if (isMounted) {
        weatherPackageRef.current = pkg;
        // Align current outside conditions with cached hourly dataset
        const currentOutside = getOutdoorConditionsForSimTime(pkg, state.simTime);
        setState(prev => ({
          ...prev,
          outside: currentOutside
        }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [state.outdoorLocation.zipCode]);

  // Auto-save debounced / on-change to browser localStorage
  useEffect(() => {
    saveSimulation(state);
    setLastSavedAt(Date.now());
  }, [state.room, state.rooms, state.activeRoomId, state.outside, state.outdoorLocation, state.tempUnit, state.harvests]);

  // Dual-screen cross-window sync & Hash routing (#game vs dashboard)
  useEffect(() => {
    const handleHash = () => {
      const isGame = window.location.hash === '#game' || new URLSearchParams(window.location.search).get('view') === 'game';
      setViewMode(isGame ? 'game' : 'dashboard');
    };
    window.addEventListener('hashchange', handleHash);

    const unsubscribe = subscribeToSimulationSync((syncedState) => {
      if (syncedState && syncedState.simTime) {
        setState(syncedState);
      }
    });

    return () => {
      window.removeEventListener('hashchange', handleHash);
      unsubscribe();
    };
  }, []);

  // Main Simulation Loop
  useEffect(() => {
    if (state.speed === 0) return;

    const interval = setInterval(() => {
      const cur = stateRef.current;
      if (cur.speed === 0) return;

      const elapsedMinutes = cur.speed;
      const newSimTime = cur.simTime + elapsedMinutes * 60 * 1000;

      // Pull outdoor conditions from cached hourly dataset (zero repeated HTTP requests!)
      const customCo2 = cur.outdoorLocation?.customCo2Ppm ?? cur.outside?.co2Ppm;
      const newOutside = getOutdoorConditionsForSimTime(weatherPackageRef.current, newSimTime, customCo2);

      // Run thermodynamics & biology tick across all facility rooms
      const currentRooms = cur.rooms && cur.rooms.length > 0 ? cur.rooms : [cur.room];
      let activeRoomEvents: any[] = [];
      const updatedRooms = currentRooms.map(rm => {
        const { room: simRoom, events } = simulateEnvironmentTick(
          rm,
          newOutside,
          newSimTime,
          elapsedMinutes
        );
        if (rm.id === (cur.activeRoomId || cur.room.id)) {
          activeRoomEvents = events;
        }
        return simRoom;
      });

      const updatedActiveRoom = updatedRooms.find(r => r.id === (cur.activeRoomId || cur.room.id)) || updatedRooms[0];

      // Append any tick events from active room to journal
      let updatedJournal = cur.journal;
      if (activeRoomEvents.length > 0) {
        const newEntries: JournalEntry[] = activeRoomEvents.map(e => ({
          id: `j-${Date.now()}-${Math.random()}`,
          time: newSimTime,
          type: e.type,
          category: e.category || 'crop',
          tentName: e.tentName,
          title: e.title,
          message: e.message
        }));
        updatedJournal = [...updatedJournal, ...newEntries];
      }

      const nextState: SimulationState = {
        ...cur,
        simTime: newSimTime,
        outside: newOutside,
        rooms: updatedRooms,
        room: updatedActiveRoom,
        journal: updatedJournal
      };

      setState(nextState);
      broadcastSimulationState(nextState);
    }, 1000);

    return () => clearInterval(interval);
  }, [state.speed]);

  // Speed changer
  const handleSetSpeed = useCallback((speed: number) => {
    setState(prev => {
      const next = { ...prev, speed };
      broadcastSimulationState(next);
      return next;
    });
  }, []);

  // Time jump (e.g., +6h, +24h)
  const handleSkipTime = useCallback((hours: number) => {
    setState(prev => {
      const elapsedMinutes = hours * 60;
      const newSimTime = prev.simTime + elapsedMinutes * 60 * 1000;
      const customCo2 = prev.outdoorLocation?.customCo2Ppm ?? prev.outside?.co2Ppm;
      const newOutside = getOutdoorConditionsForSimTime(weatherPackageRef.current, newSimTime, customCo2);
      
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const skipEvents: JournalEntry[] = [];

      const updatedRooms = currentRooms.map(rm => {
        const { room: simRoom, events } = simulateEnvironmentTick(
          rm,
          newOutside,
          newSimTime,
          elapsedMinutes
        );
        if (events && events.length > 0) {
          events.forEach(e => {
            skipEvents.push({
              id: `j-${Date.now()}-${Math.random()}`,
              time: newSimTime,
              type: e.type,
              category: e.category || 'crop',
              tentName: e.tentName || rm.name,
              title: e.title,
              message: e.message
            });
          });
        }
        return simRoom;
      });
      const updatedActiveRoom = updatedRooms.find(r => r.id === (prev.activeRoomId || prev.room.id)) || updatedRooms[0];

      const nextState: SimulationState = {
        ...prev,
        simTime: newSimTime,
        outside: newOutside,
        rooms: updatedRooms,
        room: updatedActiveRoom,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: newSimTime,
            type: 'action',
            category: 'general',
            title: `Time Jump (+${hours} Hours)`,
            message: `Fast-forwarded cultivation simulation by ${hours} hours.`
          },
          ...skipEvents
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Update outdoor location via ZIP Code
  const handleUpdateOutdoorLocation = useCallback(async (newLocation: OutdoorLocation) => {
    // 1. Fetch fresh package (with caching matching simulated month)
    const pkg = await getCachedHourlyWeather(newLocation.lat, newLocation.lon, stateRef.current.simTime, true);
    weatherPackageRef.current = pkg;

    setState(prev => {
      const currentOutside = getOutdoorConditionsForSimTime(pkg, prev.simTime);
      return {
        ...prev,
        outdoorLocation: newLocation,
        outside: currentOutside,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'info',
            title: 'Outdoor Location Updated',
            message: `Bound facility atmospheric envelope to ZIP ${newLocation.zipCode} (${newLocation.cityName}, ${newLocation.state}). Loaded authentic seasonal weather.`
          }
        ]
      };
    });
  }, []);

  // Temperature unit toggle
  const handleToggleTempUnit = useCallback(() => {
    setState(prev => ({ ...prev, tempUnit: prev.tempUnit === 'F' ? 'C' : 'F' }));
  }, []);

  // Reset simulation to default
  const handleResetSim = useCallback(() => {
    const fresh = resetSimulation();
    setState(fresh);
    weatherPackageRef.current = null;
    getCachedHourlyWeather(fresh.outdoorLocation.lat, fresh.outdoorLocation.lon, fresh.simTime).then(pkg => {
      weatherPackageRef.current = pkg;
    });
  }, []);

  // Export JSON save
  const handleExportJson = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sprout-spore-sim-save-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [state]);

  // Import JSON save
  const handleImportJson = useCallback((jsonStr: string) => {
    const parsed = JSON.parse(jsonStr) as SimulationState;
    if (!parsed.room || !parsed.outside) {
      throw new Error('Invalid simulation state format.');
    }
    saveSimulation(parsed);
    setState(parsed);
    if (parsed.outdoorLocation) {
      getCachedHourlyWeather(parsed.outdoorLocation.lat, parsed.outdoorLocation.lon, parsed.simTime).then(pkg => {
        weatherPackageRef.current = pkg;
      });
    }
  }, []);

  // Selection handlers
  const handleSelectRoom = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedType: 'room',
      selectedId: prev.room.id,
      selectedParentTentId: null
    }));
  }, []);

  const handleSelectTent = useCallback((tentId: string) => {
    setState(prev => ({
      ...prev,
      selectedType: 'tent',
      selectedId: tentId,
      selectedParentTentId: null
    }));
  }, []);

  const handleSelectItem = useCallback((itemId: string, parentTentId?: string | null) => {
    setState(prev => ({
      ...prev,
      selectedType: 'item',
      selectedId: itemId,
      selectedParentTentId: parentTentId || null
    }));
  }, []);

  // Update Room
  const handleUpdateRoom = useCallback((updatedRoom: Room) => {
    setState(prev => {
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);
      return {
        ...prev,
        room: updatedRoom,
        rooms: updatedRooms
      };
    });
  }, []);

  // Update Tent
  const handleUpdateTent = useCallback((updatedTent: Tent) => {
    setState(prev => {
      const updatedRoom = {
        ...prev.room,
        tents: prev.room.tents.map(t => t.id === updatedTent.id ? updatedTent : t)
      };
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);
      return {
        ...prev,
        room: updatedRoom,
        rooms: updatedRooms
      };
    });
  }, []);

  // Update Item (Plant, Mushroom, or Equipment)
  const handleUpdateItem = useCallback((updatedItem: Item, parentTentId?: string | null) => {
    setState(prev => {
      let updatedRoom: Room;
      if (parentTentId) {
        updatedRoom = {
          ...prev.room,
          tents: prev.room.tents.map(t => {
            if (t.id === parentTentId) {
              return {
                ...t,
                items: t.items.map(i => i.id === updatedItem.id ? updatedItem : i)
              };
            }
            return t;
          })
        };
      } else {
        // Freestanding in room
        updatedRoom = {
          ...prev.room,
          items: prev.room.items.map(i => i.id === updatedItem.id ? updatedItem : i)
        };
      }

      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);

      return {
        ...prev,
        room: updatedRoom,
        rooms: updatedRooms
      };
    });
  }, []);

  // Delete Item
  const handleDeleteItem = useCallback((itemId: string, parentTentId?: string | null) => {
    setState(prev => {
      let updatedRoom = { ...prev.room };
      if (parentTentId) {
        updatedRoom.tents = updatedRoom.tents.map(t => {
          if (t.id === parentTentId) {
            return {
              ...t,
              items: t.items.filter(i => i.id !== itemId)
            };
          }
          return t;
        });
      } else {
        updatedRoom.items = updatedRoom.items.filter(i => i.id !== itemId);
      }

      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);

      return {
        ...prev,
        room: updatedRoom,
        rooms: updatedRooms,
        selectedType: parentTentId ? 'tent' : 'room',
        selectedId: parentTentId || prev.room.id,
        selectedParentTentId: null
      };
    });
  }, []);

  // Delete Tent
  const handleDeleteTent = useCallback((tentId: string) => {
    setState(prev => {
      const updatedRoom = {
        ...prev.room,
        tents: prev.room.tents.filter(t => t.id !== tentId)
      };
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);

      return {
        ...prev,
        room: updatedRoom,
        rooms: updatedRooms,
        selectedType: 'room',
        selectedId: prev.room.id,
        selectedParentTentId: null
      };
    });
  }, []);

  // Add Tent
  const handleAddTent = useCallback((newTent: Tent) => {
    setState(prev => {
      const updatedRoom = {
        ...prev.room,
        tents: [...prev.room.tents, newTent]
      };
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);

      return {
        ...prev,
        room: updatedRoom,
        rooms: updatedRooms,
        selectedType: 'tent',
        selectedId: newTent.id,
        selectedParentTentId: null,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'success',
            title: 'Tent Deployed',
            message: `${newTent.name} added to ${prev.room.name}.`
          }
        ]
      };
    });
  }, []);

  // Add Item
  const handleAddItem = useCallback((newItem: Item, tentId?: string | null) => {
    setState(prev => {
      let updatedRoom = { ...prev.room };
      if (tentId) {
        updatedRoom.tents = updatedRoom.tents.map(t => {
          if (t.id === tentId) {
            return {
              ...t,
              items: [...t.items, newItem]
            };
          }
          return t;
        });
      } else {
        updatedRoom.items = [...updatedRoom.items, newItem];
      }

      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);

      return {
        ...prev,
        room: updatedRoom,
        rooms: updatedRooms,
        selectedType: 'item',
        selectedId: newItem.id,
        selectedParentTentId: tentId || null,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'info',
            title: `Item Added`,
            message: `${newItem.name} introduced into ${tentId ? 'tent' : 'room'}.`
          }
        ]
      };
    });
  }, []);

  // Add Room
  const handleAddRoom = useCallback((newRoom: Room) => {
    setState(prev => {
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = [...currentRooms, newRoom];
      return {
        ...prev,
        rooms: updatedRooms,
        activeRoomId: newRoom.id,
        room: newRoom,
        selectedType: 'room',
        selectedId: newRoom.id,
        selectedParentTentId: null,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'action',
            title: 'Room Constructed',
            message: `Added new room "${newRoom.name}" (${newRoom.dimensions.length}′×${newRoom.dimensions.width}′×${newRoom.dimensions.height}′) to facility.`
          }
        ]
      };
    });
    setIsAddRoomModalOpen(false);
  }, []);

  // Delete Room
  const handleDeleteRoom = useCallback((roomId: string) => {
    setState(prev => {
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      if (currentRooms.length <= 1) return prev;

      const deletedRoom = currentRooms.find(r => r.id === roomId);
      const remainingRooms = currentRooms.filter(r => r.id !== roomId);
      const nextActiveRoom = prev.activeRoomId === roomId ? remainingRooms[0] : (currentRooms.find(r => r.id === prev.activeRoomId) || remainingRooms[0]);

      return {
        ...prev,
        rooms: remainingRooms,
        activeRoomId: nextActiveRoom.id,
        room: nextActiveRoom,
        selectedType: 'room',
        selectedId: nextActiveRoom.id,
        selectedParentTentId: null,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'warning',
            title: 'Room Decommissioned',
            message: `Removed room "${deletedRoom?.name || roomId}" from facility.`
          }
        ]
      };
    });
  }, []);

  // Select Active Room
  const handleSelectActiveRoom = useCallback((roomId: string) => {
    setState(prev => {
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const targetRoom = currentRooms.find(r => r.id === roomId);
      if (!targetRoom) return prev;
      return {
        ...prev,
        activeRoomId: roomId,
        room: targetRoom,
        selectedType: 'room',
        selectedId: roomId,
        selectedParentTentId: null
      };
    });
  }, []);

  // Update Outdoor Ambient Baseline CO2
  const handleUpdateOutdoorCo2 = useCallback((co2Ppm: number) => {
    setState(prev => {
      const updatedOutside: OutsideConditions = {
        ...prev.outside,
        co2Ppm
      };
      const updatedLocation: OutdoorLocation = {
        ...prev.outdoorLocation,
        customCo2Ppm: co2Ppm
      };
      return {
        ...prev,
        outside: updatedOutside,
        outdoorLocation: updatedLocation,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'action',
            title: 'Outdoor Ambient CO₂ Calibrated',
            message: `Adjusted atmospheric background baseline to ${co2Ppm} PPM.`
          }
        ]
      };
    });
  }, []);

  // Harvest Plant
  const handleHarvestPlant = useCallback((plant: PlantItem, tentId?: string) => {
    const yieldG = Math.max(10, Math.round(plant.yieldPotentialGrams));
    const record: HarvestRecord = {
      id: `harv-${Date.now()}`,
      name: plant.name,
      species: plant.species,
      type: 'plant',
      yieldGrams: yieldG,
      dateStr: new Date(state.simTime).toLocaleDateString(),
      quality: plant.health > 90 ? 'Legendary' : plant.health > 75 ? 'Excellent' : 'Good'
    };

    const reseededPlant: PlantItem = {
      ...plant,
      stage: 'seedling',
      stageProgress: 0,
      ageDays: 1,
      health: 98,
      soilMoisture: 70,
      heightInches: 4,
      canopyWidthInches: 4,
      yieldPotentialGrams: Math.round(plant.yieldPotentialGrams * 1.1)
    };

    handleUpdateItem(reseededPlant, tentId);

    setState(prev => ({
      ...prev,
      harvests: [record, ...prev.harvests],
      journal: [
        ...prev.journal,
        {
          id: `j-${Date.now()}`,
          time: prev.simTime,
          type: 'success',
          title: `Harvest Complete!`,
          message: `Harvested ${yieldG}g of ${plant.name} (${record.quality} quality). Replanted new seedling!`
        }
      ]
    }));
  }, [state.simTime, handleUpdateItem]);

  // Harvest Mushroom Flush
  const handleHarvestMushroom = useCallback((shroom: MushroomItem, tentId?: string) => {
    const yieldG = Math.max(15, Math.round(shroom.yieldPotentialGrams));
    const record: HarvestRecord = {
      id: `harv-${Date.now()}`,
      name: shroom.name,
      species: shroom.species,
      type: 'mushroom',
      yieldGrams: yieldG,
      dateStr: new Date(state.simTime).toLocaleDateString(),
      quality: shroom.health > 88 ? 'Legendary' : 'Excellent'
    };

    const nextFlushShroom: MushroomItem = {
      ...shroom,
      stage: 'pinning',
      stageProgress: 5,
      flushCount: shroom.flushCount + 1,
      health: 95,
      substrateMoisture: Math.max(45, shroom.substrateMoisture - 20),
      yieldPotentialGrams: Math.round(shroom.yieldPotentialGrams * 0.85)
    };

    handleUpdateItem(nextFlushShroom, tentId);

    setState(prev => ({
      ...prev,
      harvests: [record, ...prev.harvests],
      journal: [
        ...prev.journal,
        {
          id: `j-${Date.now()}`,
          time: prev.simTime,
          type: 'success',
          title: `Mushroom Flush Harvested!`,
          message: `Gathered ${yieldG}g of ${shroom.name} caps. Monotub hydrated for flush #${nextFlushShroom.flushCount}!`
        }
      ]
    }));
  }, [state.simTime, handleUpdateItem]);

  // Add custom or care journal entry
  const handleAddJournalEntry = useCallback((entry: { title: string; message: string; type: JournalEntry['type']; category?: JournalCategory }) => {
    setState(prev => {
      const nextState: SimulationState = {
        ...prev,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}-${Math.random()}`,
            time: prev.simTime,
            type: entry.type,
            category: entry.category || 'general',
            title: entry.title,
            message: entry.message,
            author: 'Cultivator'
          }
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Clear all journal entries
  const handleClearJournal = useCallback(() => {
    setState(prev => {
      const nextState: SimulationState = {
        ...prev,
        journal: []
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {viewMode === 'game' ? (
        <GameWorld
          state={state}
          onUpdateState={(updater) => setState(prev => {
            const next = updater(prev);
            broadcastSimulationState(next);
            return next;
          })}
          onOpenAddItem={(tentId) => {
            setAddModalTentId(tentId || null);
            setIsAddModalOpen(true);
          }}
          onOpenAddRoom={() => setIsAddRoomModalOpen(true)}
          onOpenHarvestModal={() => setIsHarvestModalOpen(true)}
          onSwitchToDashboard={() => {
            window.location.hash = '';
            setViewMode('dashboard');
          }}
        />
      ) : (
        <>
          {/* 24-Hour Game Clock & Top Bar */}
          <HeaderClock
            state={state}
            onSetSpeed={handleSetSpeed}
            onSkipTime={handleSkipTime}
            onToggleTempUnit={handleToggleTempUnit}
            onResetSim={handleResetSim}
            onOpenHarvests={() => setIsHarvestModalOpen(true)}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            lastSavedAt={lastSavedAt}
            onSwitchToGame={() => {
              window.location.hash = '#game';
              setViewMode('game');
            }}
            onPopOutGame={() => {
              const width = 1280;
              const height = 800;
              const left = window.screen.availWidth ? window.screen.availWidth : 0;
              window.open(
                window.location.origin + window.location.pathname + '#game',
                'SproutSporeGameWindow',
                `width=${width},height=${height},left=${left},top=100,resizable=yes,scrollbars=yes`
              );
            }}
          />

          {/* Main Workspace Body */}
          <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            {/* Environmental Climate Matrix Dashboard */}
            <ClimateDashboard
              outside={state.outside}
              outdoorLocation={state.outdoorLocation}
              room={state.room}
              rooms={state.rooms || [state.room]}
              activeRoomId={state.activeRoomId || state.room.id}
              selectedId={state.selectedId}
              selectedType={state.selectedType}
              tempUnit={state.tempUnit}
              onSelectRoom={handleSelectRoom}
              onSelectTent={handleSelectTent}
              onSelectActiveRoom={handleSelectActiveRoom}
              onOpenAddRoom={() => setIsAddRoomModalOpen(true)}
              onDeleteRoom={handleDeleteRoom}
              onOpenAddTent={() => {
                setAddModalTentId(null);
                setIsAddModalOpen(true);
              }}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onDeleteTent={handleDeleteTent}
              onUpdateOutdoorCo2={handleUpdateOutdoorCo2}
            />

            {/* View Switcher Tabs: Climate Overview vs 2D Layout Plan */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  Inspection &amp; Items Manager
                </button>
                <button
                  onClick={() => setActiveTab('floorplan')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'floorplan'
                      ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  Interactive Spatial Floorplan
                </button>
              </div>

              <span className="text-xs text-zinc-400 hidden sm:inline">
                Active Target: <strong className="text-zinc-200 uppercase font-mono">{state.selectedType || 'None'}</strong>
              </span>
            </div>

            {/* Spatial Floorplan View */}
            {activeTab === 'floorplan' && (
              <InteractiveFloorplan
                room={state.room}
                rooms={state.rooms || [state.room]}
                activeRoomId={state.activeRoomId || state.room.id}
                selectedId={state.selectedId}
                selectedType={state.selectedType}
                onSelectRoom={handleSelectRoom}
                onSelectTent={handleSelectTent}
                onSelectItem={handleSelectItem}
                onSelectActiveRoom={handleSelectActiveRoom}
                onOpenAddRoom={() => setIsAddRoomModalOpen(true)}
                onDeleteTent={handleDeleteTent}
                onDeleteItem={handleDeleteItem}
              />
            )}

            {/* Item & Room Inspector Panel */}
            <ItemInspector
              room={state.room}
              rooms={state.rooms || [state.room]}
              outdoorCo2Ppm={state.outside.co2Ppm || state.outdoorLocation.customCo2Ppm || 420}
              selectedType={state.selectedType}
              selectedId={state.selectedId}
              selectedParentTentId={state.selectedParentTentId}
              tempUnit={state.tempUnit}
              onSelectRoom={handleSelectRoom}
              onSelectTent={handleSelectTent}
              onSelectItem={handleSelectItem}
              onUpdateRoom={handleUpdateRoom}
              onUpdateTent={handleUpdateTent}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onDeleteTent={handleDeleteTent}
              onDeleteRoom={handleDeleteRoom}
              onOpenAddRoom={() => setIsAddRoomModalOpen(true)}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onOpenAddItem={(tentId) => {
                setAddModalTentId(tentId || null);
                setIsAddModalOpen(true);
              }}
              onHarvestPlant={handleHarvestPlant}
              onHarvestMushroom={handleHarvestMushroom}
              simTime={state.simTime}
              onLogJournalEntry={handleAddJournalEntry}
            />

            {/* Cultivation Journal Drawer */}
            <GrowJournal 
              entries={state.journal} 
              simTime={state.simTime}
              onAddEntry={handleAddJournalEntry}
              onClearEntries={handleClearJournal}
            />
          </main>
        </>
      )}

      {/* Add Item / Tent Modal */}
      <AddItemModal
        room={state.room}
        targetTentId={addModalTentId}
        isOpen={isAddModalOpen}
        simTime={state.simTime}
        onClose={() => setIsAddModalOpen(false)}
        onAddTent={handleAddTent}
        onAddItem={handleAddItem}
      />

      {/* Add Room Modal */}
      <AddRoomModal
        isOpen={isAddRoomModalOpen}
        onClose={() => setIsAddRoomModalOpen(false)}
        onAddRoom={handleAddRoom}
        outdoorCo2Ppm={state.outside.co2Ppm || state.outdoorLocation.customCo2Ppm || 420}
      />

      {/* Location / Zip Code Modal */}
      <LocationModal
        currentLocation={state.outdoorLocation}
        simTime={state.simTime}
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onUpdateLocation={handleUpdateOutdoorLocation}
        outdoorCo2Ppm={state.outside.co2Ppm || state.outdoorLocation.customCo2Ppm || 420}
        onUpdateOutdoorCo2={handleUpdateOutdoorCo2}
      />

      {/* Harvest Log Vault Modal */}
      <HarvestLogModal
        harvests={state.harvests}
        isOpen={isHarvestModalOpen}
        onClose={() => setIsHarvestModalOpen(false)}
      />
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
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
  OutsideConditions,
  Dimensions
} from './types/sim';
import { loadSimulation, saveSimulation, resetSimulation, importSimulationJson } from './utils/storage';
import { simulateEnvironmentTick } from './utils/physics';
import { simulateNpcRoomTick } from './utils/npcWorker';
import { syncItemGeometry, placeItemInFreeSpace, syncRoomRacks, placeNewRoomContents, clampItemPosition } from './utils/spatial';
import { isGrowRack } from './utils/growRacks';
import { migrateEquipmentLinks } from './utils/equipmentLinks';
import { getPlantStageStartSize } from './utils/plantLifecycle';
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
import { broadcastSimulationState, subscribeToSimulationSync } from './utils/syncChannel';
import { WallSide } from './types/sim';
import { connectRooms, findFirstFreeWall, getWallDisplayName } from './utils/roomDoorways';

// The 3D game view (three.js) is only downloaded when the game view is opened
const GameWorld = lazy(() => import('./components/game/GameWorld').then(m => ({ default: m.GameWorld })));

export default function App() {
  const [state, setState] = useState<SimulationState>(() => loadSimulation());
  const [lastSavedAt, setLastSavedAt] = useState<number>(Date.now());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [addRoomSourceWall, setAddRoomSourceWall] = useState<WallSide | null>(null);

  const handleOpenAddRoom = useCallback((wall?: WallSide) => {
    setAddRoomSourceWall(wall || null);
    setIsAddRoomModalOpen(true);
  }, []);
  const [addModalTentId, setAddModalTentId] = useState<string | null>(null);
  const [addModalRackId, setAddModalRackId] = useState<string | null>(null); // Sow straight into this grow rack
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

  // Ensure simulation state is immediately saved to localStorage on tab close, reload, or page hide
  useEffect(() => {
    const handleFlush = () => {
      if (stateRef.current) {
        saveSimulation(stateRef.current);
      }
    };
    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('pagehide', handleFlush);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && stateRef.current) {
        saveSimulation(stateRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      window.removeEventListener('pagehide', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

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
        // Autonomous worker routines & resident behaviors
        const { updatedRoom: npcRoom, journalEvents: npcEvents } = simulateNpcRoomTick(
          simRoom,
          newSimTime,
          elapsedMinutes
        );
        const combinedEvents = [...(events || []), ...npcEvents];
        if (rm.id === (cur.activeRoomId || cur.room.id)) {
          activeRoomEvents = combinedEvents;
        }
        return npcRoom;
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
          tentName: (e as any).tentName,
          title: e.title,
          message: e.message,
          author: (e as any).author
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
        const { updatedRoom: npcRoom, journalEvents: npcEvents } = simulateNpcRoomTick(
          simRoom,
          newSimTime,
          elapsedMinutes
        );
        const combinedEvents = [...(events || []), ...npcEvents];
        if (combinedEvents && combinedEvents.length > 0) {
          combinedEvents.forEach(e => {
            skipEvents.push({
              id: `j-${Date.now()}-${Math.random()}`,
              time: newSimTime,
              type: e.type,
              category: e.category || 'crop',
              tentName: (e as any).tentName || rm.name,
              title: e.title,
              message: e.message,
              author: (e as any).author
            });
          });
        }
        return npcRoom;
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
    const loaded = importSimulationJson(jsonStr);
    setState(loaded);
    broadcastSimulationState(loaded);
    if (loaded.outdoorLocation) {
      getCachedHourlyWeather(loaded.outdoorLocation.lat, loaded.outdoorLocation.lon, loaded.simTime).then(pkg => {
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
      const activeRId = prev.activeRoomId || prev.room.id;
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);
      const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRoom;
      const nextState: SimulationState = {
        ...prev,
        room: updatedActiveRoom,
        rooms: updatedRooms
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Update Tent
  const handleUpdateTent = useCallback((updatedTent: Tent) => {
    setState(prev => {
      const activeRId = prev.activeRoomId || prev.room.id;
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const updatedRooms = currentRooms.map(rm => {
        if (!rm.tents.some(t => t.id === updatedTent.id)) return rm;
        return {
          ...rm,
          tents: rm.tents.map(t => t.id === updatedTent.id ? updatedTent : t)
        };
      });
      const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];
      const nextState: SimulationState = {
        ...prev,
        room: updatedActiveRoom,
        rooms: updatedRooms
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Update Item (Plant, Mushroom, or Equipment)
  const handleUpdateItem = useCallback((editedItem: Item, parentTentId?: string | null) => {
    const updatedItem = syncItemGeometry(editedItem);
    setState(prev => {
      const activeRId = prev.activeRoomId || prev.room.id;
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];

      let targetRoomId = activeRId;
      if (parentTentId) {
        const found = currentRooms.find(r => r.tents.some(t => t.id === parentTentId));
        if (found) targetRoomId = found.id;
      } else {
        const found = currentRooms.find(r => r.items.some(i => i.id === updatedItem.id));
        if (found) targetRoomId = found.id;
      }

      // A rack's size follows its shelves, so keep it inside its walls when that changes
      const fitToContainer = (container: Dimensions): Item =>
        isGrowRack(updatedItem) && updatedItem.position
          ? { ...updatedItem, position: clampItemPosition(updatedItem.position, updatedItem.dimensions, container) }
          : updatedItem;

      const updatedRooms = currentRooms.map(rm => {
        if (rm.id !== targetRoomId) return rm;

        if (parentTentId) {
          return {
            ...rm,
            tents: rm.tents.map(t => {
              if (t.id === parentTentId) {
                const fitted = fitToContainer(t.dimensions);
                return {
                  ...t,
                  items: t.items.map(i => i.id === fitted.id ? fitted : i)
                };
              }
              return t;
            })
          };
        } else {
          const fitted = fitToContainer(rm.dimensions);
          return {
            ...rm,
            items: rm.items.map(i => i.id === fitted.id ? fitted : i)
          };
        }
      }).map(rm => (rm.id === targetRoomId ? syncRoomRacks(rm) : rm)); // moving / reshelving a rack carries its plants

      const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];

      const nextState: SimulationState = {
        ...prev,
        room: updatedActiveRoom,
        rooms: updatedRooms
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Delete Item
  const handleDeleteItem = useCallback((itemId: string, parentTentId?: string | null) => {
    setState(prev => {
      const activeRId = prev.activeRoomId || prev.room.id;
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];

      let targetRoomId = activeRId;
      if (parentTentId) {
        const found = currentRooms.find(r => r.tents.some(t => t.id === parentTentId));
        if (found) targetRoomId = found.id;
      } else {
        const found = currentRooms.find(r => r.items.some(i => i.id === itemId));
        if (found) targetRoomId = found.id;
      }

      // Removing a grow rack also removes the plants sown in its trays
      const keep = (i: Item) => i.id !== itemId && !(i.category === 'plant' && i.rackSlot?.rackId === itemId);

      const updatedRooms = currentRooms.map(rm => {
        if (rm.id !== targetRoomId) return rm;

        if (parentTentId) {
          return {
            ...rm,
            tents: rm.tents.map(t => {
              if (t.id === parentTentId) {
                return {
                  ...t,
                  items: t.items.filter(keep)
                };
              }
              return t;
            })
          };
        } else {
          return {
            ...rm,
            items: rm.items.filter(keep)
          };
        }
      }).map(rm => (rm.id === targetRoomId ? migrateEquipmentLinks(rm) : rm)); // re-home heat mats that were attached to it

      const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];

      const nextState: SimulationState = {
        ...prev,
        room: updatedActiveRoom,
        rooms: updatedRooms,
        selectedType: parentTentId ? 'tent' : 'room',
        selectedId: parentTentId || updatedActiveRoom.id,
        selectedParentTentId: null
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Delete Tent
  const handleDeleteTent = useCallback((tentId: string) => {
    setState(prev => {
      const activeRId = prev.activeRoomId || prev.room.id;
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];

      const updatedRooms = currentRooms.map(rm => {
        if (!rm.tents.some(t => t.id === tentId)) return rm;
        // Unlink any hoses that fed the removed tent
        return migrateEquipmentLinks({
          ...rm,
          tents: rm.tents.filter(t => t.id !== tentId)
        });
      });

      const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];

      const nextState: SimulationState = {
        ...prev,
        room: updatedActiveRoom,
        rooms: updatedRooms,
        selectedType: 'room',
        selectedId: updatedActiveRoom.id,
        selectedParentTentId: null
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Add Tent
  const handleAddTent = useCallback((newTent: Tent) => {
    setState(prev => {
      const activeRId = prev.activeRoomId || prev.room.id;
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];

      const updatedRooms = currentRooms.map(r => {
        if (r.id !== activeRId) return r;
        return {
          ...r,
          tents: [...r.tents, newTent]
        };
      });

      const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];

      const nextState: SimulationState = {
        ...prev,
        room: updatedActiveRoom,
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
            message: `${newTent.name} added to ${updatedActiveRoom.name}.`
          }
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Add Items (Plant, Mushroom, Equipment, Person, or Pet). Several at once when sowing a rack's trays.
  const handleAddItems = useCallback((addedItems: Item[], tentId?: string | null) => {
    if (addedItems.length === 0) return;
    const sizedItems = addedItems.map(syncItemGeometry);
    setState(prev => {
      const activeRId = prev.activeRoomId || prev.room.id;
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];

      // Identify which room contains the target tent, or default to the active room
      let targetRoomId = activeRId;
      if (tentId) {
        const foundRoom = currentRooms.find(r => r.tents.some(t => t.id === tentId));
        if (foundRoom) {
          targetRoomId = foundRoom.id;
        }
      }

      // Put the new item in open space instead of on top of what's already there
      const targetRoom = currentRooms.find(r => r.id === targetRoomId) || currentRooms[0];
      const targetTent = tentId ? targetRoom.tents.find(t => t.id === tentId) : undefined;
      const newItems = sizedItems.map(item => placeItemInFreeSpace(item, targetRoom, targetTent));
      const newItem = newItems[0];

      let destinationName = 'room';

      const updatedRooms = currentRooms.map(r => {
        if (r.id !== targetRoomId) return r;

        if (tentId) {
          return {
            ...r,
            tents: r.tents.map(t => {
              if (t.id === tentId) {
                destinationName = t.name;
                return {
                  ...t,
                  items: [...t.items, ...newItems]
                };
              }
              return t;
            })
          };
        } else {
          destinationName = r.name;
          return {
            ...r,
            items: [...r.items, ...newItems]
          };
        }
      }).map(r => (r.id === targetRoomId ? syncRoomRacks(r) : r)); // seat sown plants in their rack cells

      const updatedActiveRoom = updatedRooms.find(r => r.id === activeRId) || updatedRooms[0];

      const nextState: SimulationState = {
        ...prev,
        room: updatedActiveRoom,
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
            title: newItems.length > 1 ? `Sowed ${newItems.length} × ${newItem.name.replace(/ \(.*\)$/, '')}` : `Item Added: ${newItem.name}`,
            message: newItems.length > 1
              ? `${newItems.length} plants sown into rack trays in ${destinationName}.`
              : `${newItem.name} introduced into ${destinationName}.`
          }
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  const handleAddItem = useCallback((addedItem: Item, tentId?: string | null) => handleAddItems([addedItem], tentId), [handleAddItems]);

  // Add Room
  const handleAddRoom = useCallback((addedRoom: Room) => {
    // Starter tents and gear come without positions: lay them out (lights up top, not on the floor)
    const rawNewRoom: Room = placeNewRoomContents({
      ...addedRoom,
      items: addedRoom.items.map(syncItemGeometry),
      tents: addedRoom.tents.map(t => ({ ...t, items: t.items.map(syncItemGeometry) }))
    });
    setState(prev => {
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const activeR = currentRooms.find(r => r.id === (prev.activeRoomId || prev.room.id)) || currentRooms[0];
      
      let wallToConnect = addRoomSourceWall;
      if (!wallToConnect) {
        wallToConnect = findFirstFreeWall(activeR, currentRooms) || 'right';
      }

      const { updatedSource, updatedTarget } = connectRooms(activeR, rawNewRoom, wallToConnect);
      const updatedRooms = currentRooms.map(r => r.id === updatedSource.id ? updatedSource : r).concat([updatedTarget]);

      const nextState: SimulationState = {
        ...prev,
        rooms: updatedRooms,
        activeRoomId: updatedTarget.id,
        room: updatedTarget,
        selectedType: 'room',
        selectedId: updatedTarget.id,
        selectedParentTentId: null,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'action',
            category: 'general',
            title: `🚪 New Room Built: ${updatedTarget.name}`,
            message: `Connected ${updatedTarget.name} through the ${getWallDisplayName(wallToConnect)} of ${updatedSource.name}.`
          }
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
    setIsAddRoomModalOpen(false);
    setAddRoomSourceWall(null);
  }, [addRoomSourceWall]);

  // Delete Room
  const handleDeleteRoom = useCallback((roomId: string) => {
    setState(prev => {
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      if (currentRooms.length <= 1) return prev;

      const deletedRoom = currentRooms.find(r => r.id === roomId);
      const remainingRooms = currentRooms.filter(r => r.id !== roomId);
      const nextActiveRoom = prev.activeRoomId === roomId ? remainingRooms[0] : (currentRooms.find(r => r.id === prev.activeRoomId) || remainingRooms[0]);

      const nextState: SimulationState = {
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
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Select Active Room
  const handleSelectActiveRoom = useCallback((roomId: string) => {
    setState(prev => {
      const currentRooms = prev.rooms && prev.rooms.length > 0 ? prev.rooms : [prev.room];
      const targetRoom = currentRooms.find(r => r.id === roomId);
      if (!targetRoom) return prev;
      const nextState: SimulationState = {
        ...prev,
        activeRoomId: roomId,
        room: targetRoom,
        selectedType: 'room',
        selectedId: roomId,
        selectedParentTentId: null
      };
      broadcastSimulationState(nextState);
      return nextState;
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
      const nextState: SimulationState = {
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
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

  // Harvest Plant
  const handleHarvestPlant = useCallback((plant: PlantItem, tentId?: string) => {
    const activeR = (state.rooms && state.rooms.find(r => r.id === (state.activeRoomId || state.room.id))) || state.room;
    const yieldG = Math.max(10, Math.round(plant.yieldPotentialGrams));
    const simDate = new Date(state.simTime);
    const dateStr = simDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = simDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const quality = plant.health > 90 ? 'Legendary' : plant.health > 75 ? 'Excellent' : 'Good';
    const originTent = tentId ? activeR.tents.find(t => t.id === tentId) : null;
    const estimatedValue = Math.round(yieldG * (quality === 'Legendary' ? 12 : quality === 'Excellent' ? 9 : 6));

    const potencyNote = plant.species === 'Hops' 
      ? `${plant.alphaAcidsPct || 8.5}% Alpha Acids` 
      : plant.species === 'Chili Pepper' 
        ? `${(plant.scovilleHeatUnits || 45000).toLocaleString()} SHU` 
        : `${plant.health > 85 ? '26%' : plant.health > 70 ? '22%' : '18%'} Cannabinoids`;

    const record: HarvestRecord = {
      id: `harv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: plant.name,
      species: plant.species,
      strainName: plant.strainName,
      type: 'plant',
      yieldGrams: yieldG,
      dateStr,
      timeStr,
      timestamp: state.simTime,
      quality,
      health: plant.health,
      containerType: plant.containerType || plant.systemType,
      growingMedium: plant.growingMedium,
      originRoomName: activeR.name,
      originTentName: originTent ? originTent.name : 'Room Floor / Garden',
      cureStatus: 'Fresh Cut',
      estimatedValue,
      potencyNote,
      notes: plant.notes
    };

    const reseededPlant: PlantItem = {
      ...plant,
      stage: 'seedling',
      stageProgress: 0,
      ageDays: 1,
      health: 98,
      soilMoisture: 70,
      heightInches: getPlantStageStartSize(plant.species, 'seedling', plant.propagationType).heightInches,
      canopyWidthInches: getPlantStageStartSize(plant.species, 'seedling', plant.propagationType).canopyWidthInches,
      yieldPotentialGrams: Math.round(plant.yieldPotentialGrams * 1.1)
    };

    handleUpdateItem(reseededPlant, tentId);

    setState(prev => {
      const nextState: SimulationState = {
        ...prev,
        harvests: [record, ...prev.harvests],
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'success',
            title: `Harvest Complete!`,
            message: `Harvested ${yieldG}g (${(yieldG / 28.3495).toFixed(1)} oz) of ${plant.name} (${record.quality} quality). Added to inventory & replanted new seedling!`
          }
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, [state.simTime, state.room, state.rooms, state.activeRoomId, handleUpdateItem]);

  // Harvest Mushroom Flush
  const handleHarvestMushroom = useCallback((shroom: MushroomItem, tentId?: string) => {
    const activeR = (state.rooms && state.rooms.find(r => r.id === (state.activeRoomId || state.room.id))) || state.room;
    const yieldG = Math.max(15, Math.round(shroom.yieldPotentialGrams));
    const simDate = new Date(state.simTime);
    const dateStr = simDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = simDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const quality = shroom.health > 88 ? 'Legendary' : 'Excellent';
    const originTent = tentId ? activeR.tents.find(t => t.id === tentId) : null;
    const estimatedValue = Math.round(yieldG * (quality === 'Legendary' ? 12 : 9));

    const record: HarvestRecord = {
      id: `harv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: shroom.name,
      species: shroom.species,
      strainName: shroom.strainName,
      type: 'mushroom',
      yieldGrams: yieldG,
      dateStr,
      timeStr,
      timestamp: state.simTime,
      quality,
      health: shroom.health,
      containerType: shroom.containerType,
      originRoomName: activeR.name,
      originTentName: originTent ? originTent.name : 'Room Floor / Garden',
      cureStatus: 'Fresh Cut',
      estimatedValue,
      potencyNote: `${shroom.health > 85 ? 'High' : 'Optimal'} Beta-Glucans`,
      notes: shroom.notes
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

    setState(prev => {
      const nextState: SimulationState = {
        ...prev,
        harvests: [record, ...prev.harvests],
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'success',
            title: `Mushroom Flush Harvested!`,
            message: `Gathered ${yieldG}g of ${shroom.name} caps. Added to inventory & hydrated for flush #${nextFlushShroom.flushCount}!`
          }
        ]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, [state.simTime, state.room, state.rooms, state.activeRoomId, handleUpdateItem]);

  // Add batches of harvests from NPC worker inventories into master facility storage
  const handleAddHarvestsToFacility = useCallback((harvests: HarvestRecord[]) => {
    setState(prev => {
      const nextState: SimulationState = {
        ...prev,
        harvests: [...harvests, ...prev.harvests]
      };
      broadcastSimulationState(nextState);
      return nextState;
    });
  }, []);

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

  const activeRoom = (state.rooms && state.rooms.find(r => r.id === (state.activeRoomId || state.room.id))) || state.room;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {viewMode === 'game' ? (
        <Suspense fallback={<div className="h-screen flex items-center justify-center text-sm text-zinc-400">Loading 3D grow world…</div>}>
          <GameWorld
            state={state}
            onUpdateState={(updater) => setState(prev => {
              const next = updater(prev);
              broadcastSimulationState(next);
              return next;
            })}
            onOpenAddItem={(tentId, rackId) => {
              setAddModalTentId(tentId || null);
              setAddModalRackId(rackId || null);
              setIsAddModalOpen(true);
            }}
            onOpenAddRoom={handleOpenAddRoom}
            onOpenHarvestModal={() => setIsHarvestModalOpen(true)}
            onSwitchToDashboard={() => {
              window.location.hash = '';
              setViewMode('dashboard');
            }}
            onUpdateRoom={handleUpdateRoom}
            onUpdateTent={handleUpdateTent}
            onUpdateItem={handleUpdateItem}
            onDeleteTent={handleDeleteTent}
            onDeleteItem={handleDeleteItem}
            onDeleteRoom={handleDeleteRoom}
            onHarvestPlant={handleHarvestPlant}
            onHarvestMushroom={handleHarvestMushroom}
            onLogJournalEntry={handleAddJournalEntry}
          />
        </Suspense>
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
              room={activeRoom}
              rooms={state.rooms || [state.room]}
              activeRoomId={state.activeRoomId || state.room.id}
              selectedId={state.selectedId}
              selectedType={state.selectedType}
              tempUnit={state.tempUnit}
              onSelectRoom={handleSelectRoom}
              onSelectTent={handleSelectTent}
              onSelectActiveRoom={handleSelectActiveRoom}
              onOpenAddRoom={handleOpenAddRoom}
              onDeleteRoom={handleDeleteRoom}
              onOpenAddTent={() => {
                setAddModalTentId(null);
                setAddModalRackId(null);
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
                room={activeRoom}
                rooms={state.rooms || [state.room]}
                activeRoomId={state.activeRoomId || state.room.id}
                selectedId={state.selectedId}
                selectedType={state.selectedType}
                onSelectRoom={handleSelectRoom}
                onSelectTent={handleSelectTent}
                onSelectItem={handleSelectItem}
                onSelectActiveRoom={handleSelectActiveRoom}
                onOpenAddRoom={handleOpenAddRoom}
                onDeleteTent={handleDeleteTent}
                onDeleteItem={handleDeleteItem}
              />
            )}

            {/* Item & Room Inspector Panel */}
            <ItemInspector
              room={activeRoom}
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
              onOpenAddRoom={handleOpenAddRoom}
              onOpenLocationModal={() => setIsLocationModalOpen(true)}
              onOpenAddItem={(tentId, rackId) => {
                setAddModalTentId(tentId || null);
                setAddModalRackId(rackId || null);
                setIsAddModalOpen(true);
              }}
              onHarvestPlant={handleHarvestPlant}
              onHarvestMushroom={handleHarvestMushroom}
              onAddHarvestsToFacility={handleAddHarvestsToFacility}
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
        room={activeRoom}
        targetTentId={addModalTentId}
        targetRackId={addModalRackId}
        isOpen={isAddModalOpen}
        simTime={state.simTime}
        onClose={() => setIsAddModalOpen(false)}
        onAddTent={handleAddTent}
        onAddItem={handleAddItem}
        onAddItems={handleAddItems}
      />

      {/* Add Room Modal */}
      <AddRoomModal
        isOpen={isAddRoomModalOpen}
        onClose={() => {
          setIsAddRoomModalOpen(false);
          setAddRoomSourceWall(null);
        }}
        onAddRoom={handleAddRoom}
        outdoorCo2Ppm={state.outside.co2Ppm || state.outdoorLocation.customCo2Ppm || 420}
        outsideClimate={state.outside}
        sourceWall={addRoomSourceWall}
        sourceRoomName={activeRoom.name}
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
        onUpdateHarvestRecord={(updatedRecord) => {
          setState(prev => {
            const nextState: SimulationState = {
              ...prev,
              harvests: prev.harvests.map(h => h.id === updatedRecord.id ? updatedRecord : h)
            };
            broadcastSimulationState(nextState);
            return nextState;
          });
        }}
        onDeleteHarvestRecord={(recordId) => {
          setState(prev => {
            const nextState: SimulationState = {
              ...prev,
              harvests: prev.harvests.filter(h => h.id !== recordId)
            };
            broadcastSimulationState(nextState);
            return nextState;
          });
        }}
      />
    </div>
  );
}

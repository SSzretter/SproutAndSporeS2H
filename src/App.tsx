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
  OutdoorLocation 
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

export default function App() {
  const [state, setState] = useState<SimulationState>(() => loadSimulation());
  const [lastSavedAt, setLastSavedAt] = useState<number>(Date.now());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalTentId, setAddModalTentId] = useState<string | null>(null);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'floorplan'>('dashboard');

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
        const currentOutside = getOutdoorConditionsForSimTime(pkg, state.simTime, state.outside.co2Ppm);
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
  }, [state.room, state.outside, state.outdoorLocation, state.tempUnit, state.harvests]);

  // Main Simulation Loop
  useEffect(() => {
    if (state.speed === 0) return;

    const interval = setInterval(() => {
      const cur = stateRef.current;
      if (cur.speed === 0) return;

      const elapsedMinutes = cur.speed;
      const newSimTime = cur.simTime + elapsedMinutes * 60 * 1000;

      // Pull outdoor conditions from cached hourly dataset (zero repeated HTTP requests!)
      const newOutside = getOutdoorConditionsForSimTime(weatherPackageRef.current, newSimTime, cur.outside.co2Ppm);

      // Run thermodynamics & biology tick
      const { room: updatedRoom, events } = simulateEnvironmentTick(
        cur.room,
        newOutside,
        newSimTime,
        elapsedMinutes
      );

      // Append any tick events to journal
      let updatedJournal = cur.journal;
      if (events.length > 0) {
        const newEntries: JournalEntry[] = events.map(e => ({
          id: `j-${Date.now()}-${Math.random()}`,
          time: newSimTime,
          type: e.type,
          title: e.title,
          message: e.message
        }));
        updatedJournal = [...updatedJournal, ...newEntries];
      }

      setState(prev => ({
        ...prev,
        simTime: newSimTime,
        outside: newOutside,
        room: updatedRoom,
        journal: updatedJournal
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.speed]);

  // Speed changer
  const handleSetSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, speed }));
  }, []);

  // Time jump (e.g., +6h, +24h)
  const handleSkipTime = useCallback((hours: number) => {
    setState(prev => {
      const elapsedMinutes = hours * 60;
      const newSimTime = prev.simTime + elapsedMinutes * 60 * 1000;
      const newOutside = getOutdoorConditionsForSimTime(weatherPackageRef.current, newSimTime, prev.outside.co2Ppm);
      const { room: updatedRoom } = simulateEnvironmentTick(
        prev.room,
        newOutside,
        newSimTime,
        elapsedMinutes
      );

      return {
        ...prev,
        simTime: newSimTime,
        outside: newOutside,
        room: updatedRoom,
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: newSimTime,
            type: 'action',
            title: `Time Jump (+${hours} Hours)`,
            message: `Fast-forwarded cultivation simulation by ${hours} hours.`
          }
        ]
      };
    });
  }, []);

  // Update outdoor location via ZIP Code
  const handleUpdateOutdoorLocation = useCallback(async (newLocation: OutdoorLocation) => {
    // 1. Fetch fresh package (with caching matching simulated month)
    const pkg = await getCachedHourlyWeather(newLocation.lat, newLocation.lon, stateRef.current.simTime, true);
    weatherPackageRef.current = pkg;

    setState(prev => {
      const currentOutside = getOutdoorConditionsForSimTime(pkg, prev.simTime, prev.outside.co2Ppm);
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

  // Update Outdoor Atmospheric CO2 Baseline
  const handleUpdateOutdoorCo2 = useCallback((ppm: number) => {
    setState(prev => {
      const newOutside = { ...prev.outside, co2Ppm: ppm };
      return {
        ...prev,
        outside: newOutside,
        room: {
          ...prev.room,
          roomCo2BaselinePpm: ppm,
          climate: { ...prev.room.climate, co2Ppm: ppm }
        },
        rooms: prev.rooms?.map(r => ({
          ...r,
          roomCo2BaselinePpm: ppm,
          climate: { ...r.climate, co2Ppm: ppm }
        })) ?? [],
        journal: [
          ...prev.journal,
          {
            id: `j-${Date.now()}`,
            time: prev.simTime,
            type: 'action',
            title: 'Outdoor CO₂ Baseline Updated',
            message: `Atmospheric CO₂ baseline set to ${ppm} PPM. All rooms will equilibrate to this fresh-air infiltration value.`
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
    setState(prev => ({
      ...prev,
      room: updatedRoom
    }));
  }, []);

  // Update Tent
  const handleUpdateTent = useCallback((updatedTent: Tent) => {
    setState(prev => ({
      ...prev,
      room: {
        ...prev.room,
        tents: prev.room.tents.map(t => t.id === updatedTent.id ? updatedTent : t)
      }
    }));
  }, []);

  // Update Item (Plant, Mushroom, or Equipment)
  const handleUpdateItem = useCallback((updatedItem: Item, parentTentId?: string | null) => {
    setState(prev => {
      if (parentTentId) {
        return {
          ...prev,
          room: {
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
          }
        };
      } else {
        // Freestanding in room
        return {
          ...prev,
          room: {
            ...prev.room,
            items: prev.room.items.map(i => i.id === updatedItem.id ? updatedItem : i)
          }
        };
      }
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

      return {
        ...prev,
        room: updatedRoom,
        selectedType: parentTentId ? 'tent' : 'room',
        selectedId: parentTentId || prev.room.id,
        selectedParentTentId: null
      };
    });
  }, []);

  // Delete Tent
  const handleDeleteTent = useCallback((tentId: string) => {
    setState(prev => ({
      ...prev,
      room: {
        ...prev.room,
        tents: prev.room.tents.filter(t => t.id !== tentId)
      },
      selectedType: 'room',
      selectedId: prev.room.id,
      selectedParentTentId: null
    }));
  }, []);

  // Add Tent
  const handleAddTent = useCallback((newTent: Tent) => {
    setState(prev => ({
      ...prev,
      room: {
        ...prev.room,
        tents: [...prev.room.tents, newTent]
      },
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
    }));
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

      return {
        ...prev,
        room: updatedRoom,
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
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
      />

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Environmental Climate Matrix Dashboard */}
        <ClimateDashboard
          outside={state.outside}
          outdoorLocation={state.outdoorLocation}
          room={state.room}
          selectedId={state.selectedId}
          selectedType={state.selectedType}
          tempUnit={state.tempUnit}
          onSelectRoom={handleSelectRoom}
          onSelectTent={handleSelectTent}
          onOpenAddTent={() => {
            setAddModalTentId(null);
            setIsAddModalOpen(true);
          }}
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
          onDeleteTent={handleDeleteTent}
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
            selectedId={state.selectedId}
            selectedType={state.selectedType}
            onSelectRoom={handleSelectRoom}
            onSelectTent={handleSelectTent}
            onSelectItem={handleSelectItem}
            onDeleteTent={handleDeleteTent}
            onDeleteItem={handleDeleteItem}
          />
        )}

        {/* Item & Room Inspector Panel */}
        <ItemInspector
          room={state.room}
          rooms={state.rooms}
          outdoorCo2Ppm={state.outside.co2Ppm}
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
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
          onOpenAddItem={(tentId) => {
            setAddModalTentId(tentId || null);
            setIsAddModalOpen(true);
          }}
          onHarvestPlant={handleHarvestPlant}
          onHarvestMushroom={handleHarvestMushroom}
        />

        {/* Cultivation Journal Drawer */}
        <GrowJournal entries={state.journal} />
      </main>

      {/* Add Item / Tent Modal */}
      <AddItemModal
        room={state.room}
        targetTentId={addModalTentId}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTent={handleAddTent}
        onAddItem={handleAddItem}
      />

      {/* Location / Zip Code Modal */}
      <LocationModal
        currentLocation={state.outdoorLocation}
        simTime={state.simTime}
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onUpdateLocation={handleUpdateOutdoorLocation}
        outdoorCo2Ppm={state.outside.co2Ppm}
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

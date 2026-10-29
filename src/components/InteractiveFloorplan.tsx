import React, { useState } from 'react';
import { 
  Box, 
  Sprout, 
  Flower2, 
  Sparkles, 
  Wind, 
  Sun, 
  Droplets, 
  Layers, 
  Maximize2,
  Check,
  Zap,
  Info,
  Trash2,
  User,
  Dog,
  Cat,
  Flame,
  Activity
} from 'lucide-react';
import { 
  Room, 
  Tent, 
  Item, 
  PlantItem, 
  MushroomItem, 
  EquipmentItem, 
  PersonItem, 
  PetItem 
} from '../types/sim';
import { ROLE_METADATA } from '../utils/npcWorker';
import { getRackCapacity, getRackOccupancy, isRackedPlant } from '../utils/growRacks';

interface InteractiveFloorplanProps {
  room: Room;
  rooms?: Room[];
  activeRoomId?: string;
  selectedId: string | null;
  selectedType: 'room' | 'tent' | 'item' | null;
  onSelectRoom: () => void;
  onSelectTent: (tentId: string) => void;
  onSelectItem: (itemId: string, parentTentId?: string) => void;
  onSelectActiveRoom?: (roomId: string) => void;
  onOpenAddRoom?: () => void;
  onDeleteTent?: (tentId: string) => void;
  onDeleteItem?: (itemId: string, parentTentId?: string | null) => void;
}

export const InteractiveFloorplan: React.FC<InteractiveFloorplanProps> = ({
  room,
  rooms = [],
  activeRoomId,
  selectedId,
  selectedType,
  onSelectRoom,
  onSelectTent,
  onSelectItem,
  onSelectActiveRoom,
  onOpenAddRoom,
  onDeleteTent,
  onDeleteItem,
}) => {
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; kind: 'tent' | 'item'; parentTentId?: string | null } | null>(null);

  const isRoomSelected = selectedType === 'room' && selectedId === room.id;
  const isOutdoor = room.environmentType === 'outdoor_garden';
  const isGreenhouse = room.environmentType === 'greenhouse';

  const renderPlantGraphic = (plant: PlantItem) => {
    const isReady = plant.stage === 'ready';
    const isFlowering = plant.stage === 'flowering' || plant.stage === 'ripening';

    return (
      <div className="relative flex flex-col items-center group/plant">
        {/* Pot */}
        <div className="relative">
          {plant.species === 'Hops' ? (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover/plant:scale-110 ${
              isReady 
                ? 'bg-amber-500/40 border-2 border-amber-400 text-amber-200 shadow-md shadow-amber-500/30' 
                : isFlowering
                  ? 'bg-emerald-800/60 border border-amber-400/80 text-amber-300'
                  : 'bg-emerald-950/70 border border-emerald-600/70 text-emerald-300'
            }`}>
              <span className="text-xs">🍺</span>
            </div>
          ) : plant.species === 'Cannabis' ? (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover/plant:scale-110 ${
              isReady 
                ? 'bg-amber-500/30 border-2 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20' 
                : isFlowering
                  ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-300'
                  : 'bg-emerald-950/60 border border-emerald-600/70 text-emerald-400'
            }`}>
              <Flower2 className={`w-4 h-4 ${isReady ? 'animate-bounce' : ''}`} />
            </div>
          ) : plant.species === 'Tomato' ? (
            <div className="w-8 h-8 rounded-full bg-rose-950/60 border border-rose-500/70 text-rose-400 flex items-center justify-center transition-transform group-hover/plant:scale-110">
              <span className="text-xs font-bold">🍅</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-teal-950/60 border border-teal-500/70 text-teal-400 flex items-center justify-center transition-transform group-hover/plant:scale-110">
              <Sprout className="w-4 h-4" />
            </div>
          )}

          {/* Health indicator dot */}
          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-zinc-900 ${
            plant.health > 80 ? 'bg-emerald-400' : plant.health > 50 ? 'bg-amber-400' : 'bg-rose-500'
          }`} />
        </div>
        <span className="text-[10px] font-medium text-zinc-300 truncate max-w-[64px] text-center mt-1">
          {plant.name.split(' ')[0]}
        </span>
      </div>
    );
  };

  const renderMushroomGraphic = (shroom: MushroomItem) => {
    return (
      <div className="relative flex flex-col items-center group/shroom">
        <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/70 text-amber-300 flex items-center justify-center transition-transform group-hover/shroom:scale-110 shadow-sm">
          <span className="text-xs">🍄</span>
          {/* Moisture droplet dot */}
          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-zinc-900 ${
            shroom.substrateMoisture > 70 ? 'bg-cyan-400' : 'bg-amber-400'
          }`} />
        </div>
        <span className="text-[10px] font-medium text-amber-200/90 truncate max-w-[64px] text-center mt-1">
          {shroom.species.split(' ')[0]}
        </span>
      </div>
    );
  };

  const renderPersonGraphic = (person: PersonItem) => {
    const roleMeta = ROLE_METADATA[person.role || 'resident'] || ROLE_METADATA.resident;
    const roleIcon = roleMeta.badge.split(' ')[0];
    const isWorking = person.role !== 'resident';
    return (
      <div 
        className="relative flex flex-col items-center group/person"
        title={`${person.name} (${roleMeta.title})\nStatus: ${person.currentAction || 'Idle'}\nCO₂: +${person.co2RateLitersPerHour} L/h | Heat: ${person.heatOutputWatts}W`}
      >
        <div 
          className="w-8 h-8 rounded-full border flex items-center justify-center transition-transform group-hover/person:scale-110 shadow-sm relative"
          style={{ 
            backgroundColor: `${person.shirtColor || roleMeta.shirtColor}33`, 
            borderColor: person.shirtColor || roleMeta.shirtColor 
          }}
        >
          <User className="w-4 h-4" style={{ color: person.shirtColor || '#c084fc' }} />
          <span className="absolute -top-1.5 -right-1.5 text-[11px]" title={roleMeta.title}>
            {roleIcon}
          </span>
          {isWorking && (
            <span className="absolute -bottom-0.5 -left-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-zinc-950" title="Active Worker" />
          )}
        </div>
        <span className="text-[10px] font-medium text-zinc-200 truncate max-w-[70px] text-center mt-1">
          {person.name.split(' ')[0]}
        </span>
      </div>
    );
  };

  const renderPetGraphic = (pet: PetItem) => {
    return (
      <div className="relative flex flex-col items-center group/pet">
        <div className="w-8 h-8 rounded-full bg-rose-950/70 border border-rose-500/80 text-rose-300 flex items-center justify-center transition-transform group-hover/pet:scale-110 shadow-sm">
          {pet.petType === 'cat' ? <Cat className="w-4 h-4 text-rose-300" /> : <Dog className="w-4 h-4 text-rose-300" />}
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-400 border border-zinc-900" title={`+${pet.co2RateLitersPerHour} L/h CO₂`} />
        </div>
        <span className="text-[10px] font-medium text-rose-200 truncate max-w-[64px] text-center mt-1">
          {pet.name.split(' ')[0]}
        </span>
      </div>
    );
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'grow_light': return <Sun className="w-3.5 h-3.5 text-yellow-400" />;
      case 'humidifier':
      case 'dehumidifier': return <Droplets className="w-3.5 h-3.5 text-cyan-400" />;
      case 'nutrient_reservoir': return <Droplets className="w-3.5 h-3.5 text-sky-400" />;
      case 'heater': return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case 'exhaust_fan':
      case 'oscillating_fan': return <Wind className="w-3.5 h-3.5 text-teal-400" />;
      case 'grow_rack': return <Layers className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
      {/* Visual Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-zinc-100">
            Interactive Floorplan &amp; Spatial View
          </h3>
          <span className="text-[11px] text-zinc-400 hidden sm:inline">
            (Click room, tents, or individual items to inspect; click trash icon to remove)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {rooms && rooms.length > 1 && (
            <select
              value={room.id}
              onChange={e => onSelectActiveRoom?.(e.target.value)}
              className="bg-zinc-950 border border-zinc-750 text-xs text-emerald-400 font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500"
              title="Switch Active Room"
            >
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.dimensions.length}′×{r.dimensions.width}′)
                </option>
              ))}
            </select>
          )}

          {onOpenAddRoom && (
            <button
              onClick={onOpenAddRoom}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-800 text-emerald-400 hover:bg-zinc-750 transition-colors"
              title="Add New Room"
            >
              + Room
            </button>
          )}

          <button
            onClick={onSelectRoom}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              isRoomSelected
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            Select Room Floor
          </button>
        </div>
      </div>

      {/* Main Floorplan Container */}
      <div 
        onClick={(e) => {
          // If clicked directly on the room background
          if (e.target === e.currentTarget) {
            onSelectRoom();
          }
        }}
        className={`w-full min-h-[380px] rounded-2xl p-5 border-2 transition-all relative overflow-hidden flex flex-col justify-between ${
          isOutdoor
            ? 'bg-gradient-to-b from-emerald-950/40 via-zinc-950/90 to-amber-950/30'
            : isGreenhouse
              ? 'bg-gradient-to-b from-teal-950/30 via-zinc-950/90 to-emerald-950/20'
              : 'bg-zinc-950/90'
        } ${
          isRoomSelected 
            ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
            : isOutdoor
              ? 'border-emerald-800/60 hover:border-emerald-700'
              : 'border-zinc-800 hover:border-zinc-750'
        }`}
        style={{
          backgroundImage: isOutdoor
            ? 'radial-gradient(circle at 1px 1px, rgba(52, 211, 153, 0.08) 1px, transparent 0)'
            : 'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.04) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      >
        {/* Room Header Label inside canvas */}
        <div className="flex items-center justify-between pointer-events-none mb-3">
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1 pointer-events-auto">
            <span className={`w-2 h-2 rounded-full ${isOutdoor ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="text-xs font-semibold text-zinc-200">
              {room.name} {isOutdoor ? '(☀️ Outdoor Garden)' : isGreenhouse ? '(🌿 Greenhouse Polytunnel)' : ''}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {room.dimensions.length}′ × {room.dimensions.width}′ ({Math.round(room.dimensions.length * room.dimensions.width * room.dimensions.height)} cu ft)
            </span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-400 pointer-events-auto">
            <span>{isOutdoor ? 'Ambient: ' : 'Temp: '}<strong className="text-zinc-200">{room.climate.tempF.toFixed(1)}°F</strong></span>
            <span className="text-zinc-600">·</span>
            <span>RH: <strong className="text-zinc-200">{room.climate.rh}%</strong></span>
            <span className="text-zinc-600">·</span>
            <span>{isOutdoor ? 'Sunlight: ' : 'Light: '}<strong className="text-amber-400 font-mono">{room.climate.lightPPFD || 0} μmol</strong></span>
          </div>
        </div>

        {/* Tents Layout Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 z-10 my-auto">
          {room.tents.map(tent => {
            const isTentSelected = selectedType === 'tent' && selectedId === tent.id;
            const hasLightsOn = (tent.climate?.lightPPFD ?? 0) > 20 || tent.items.some(
              i => i.category === 'equipment' && i.type === 'grow_light' && i.powerOn && (i.effectiveSetting ?? (i.schedule?.enabled === false && i.schedule?.disabledState !== 'on' ? 0 : 100)) > 0
            );
            const isShroomTent = tent.items.some(i => i.category === 'mushroom');

            // Plants in rack trays show as the rack's sown count, not one by one
            const plants = tent.items.filter(i => i.category === 'plant' && !i.rackSlot) as PlantItem[];
            const shrooms = tent.items.filter(i => i.category === 'mushroom') as MushroomItem[];
            const people = tent.items.filter(i => i.category === 'person') as PersonItem[];
            const pets = tent.items.filter(i => i.category === 'pet') as PetItem[];
            const equipment = tent.items.filter(i => i.category === 'equipment') as EquipmentItem[];

            return (
              <div
                key={tent.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTent(tent.id);
                }}
                className={`relative rounded-xl border-2 p-4 transition-all cursor-pointer overflow-hidden ${
                  isTentSelected
                    ? 'border-emerald-400 bg-zinc-900/95 shadow-xl shadow-emerald-950/40'
                    : 'border-zinc-700/80 bg-zinc-900/70 hover:border-zinc-500 hover:bg-zinc-900/90'
                }`}
              >
                {/* Simulated Light Glow Effect */}
                {hasLightsOn && (
                  <div className={`absolute inset-0 pointer-events-none transition-opacity ${
                    isShroomTent 
                      ? 'bg-radial-gradient from-blue-400/10 via-teal-500/5 to-transparent' 
                      : 'bg-radial-gradient from-amber-400/15 via-yellow-500/5 to-transparent'
                  }`} />
                )}

                {/* Tent Frame & Status */}
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${
                      isTentSelected 
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400' 
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}>
                      <Box className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                        {tent.name}
                        {hasLightsOn && (
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" title="Grow lights active" />
                        )}
                      </h4>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {tent.dimensions.length}′ × {tent.dimensions.width}′ × {tent.dimensions.height}′
                        {tent.position && (
                          <span className="text-zinc-500 ml-1 font-mono">· ({tent.position.x}′, {tent.position.y}′, {tent.position.z}′)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      isTentSelected
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                    }`}>
                      {isTentSelected ? 'Selected' : 'Click to Inspect'}
                    </span>
                    {onDeleteTent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete({ id: tent.id, name: tent.name, kind: 'tent' });
                        }}
                        className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                        title={`Remove ${tent.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inside Canopy / Tubs / Occupants Visualization */}
                <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-lg p-3 relative z-10 min-h-[110px] flex flex-col justify-between">
                  <div className="flex flex-wrap items-center justify-around gap-2">
                    {/* Plants in Tent */}
                    {plants.map(plant => {
                      const isItemSelected = selectedType === 'item' && selectedId === plant.id;
                      return (
                        <div
                          key={plant.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(plant.id, tent.id);
                          }}
                          className={`cursor-pointer p-1.5 rounded-xl border transition-all ${
                            isItemSelected
                              ? 'bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-500/30'
                              : 'border-transparent hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          {renderPlantGraphic(plant)}
                        </div>
                      );
                    })}

                    {/* Mushrooms in Tent */}
                    {shrooms.map(shroom => {
                      const isItemSelected = selectedType === 'item' && selectedId === shroom.id;
                      return (
                        <div
                          key={shroom.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(shroom.id, tent.id);
                          }}
                          className={`cursor-pointer p-1.5 rounded-xl border transition-all ${
                            isItemSelected
                              ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-500/30'
                              : 'border-transparent hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          {renderMushroomGraphic(shroom)}
                        </div>
                      );
                    })}

                    {/* People inside Tent */}
                    {people.map(person => {
                      const isItemSelected = selectedType === 'item' && selectedId === person.id;
                      return (
                        <div
                          key={person.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(person.id, tent.id);
                          }}
                          className={`cursor-pointer p-1.5 rounded-xl border transition-all ${
                            isItemSelected
                              ? 'bg-violet-950/70 border-violet-400 ring-2 ring-violet-500/30'
                              : 'border-transparent hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          {renderPersonGraphic(person)}
                        </div>
                      );
                    })}

                    {/* Pets inside Tent */}
                    {pets.map(pet => {
                      const isItemSelected = selectedType === 'item' && selectedId === pet.id;
                      return (
                        <div
                          key={pet.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(pet.id, tent.id);
                          }}
                          className={`cursor-pointer p-1.5 rounded-xl border transition-all ${
                            isItemSelected
                              ? 'bg-rose-950/70 border-rose-400 ring-2 ring-rose-500/30'
                              : 'border-transparent hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          {renderPetGraphic(pet)}
                        </div>
                      );
                    })}

                    {plants.length === 0 && shrooms.length === 0 && people.length === 0 && pets.length === 0 && !tent.items.some(isRackedPlant) && (
                      <div className="text-xs text-zinc-400 py-4 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        <span>Empty tent interior. Add plants, mushroom tubs, or equipment.</span>
                      </div>
                    )}
                  </div>

                  {/* Microclimate status bar inside tent visual */}
                  <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono text-zinc-300">
                      {tent.climate.tempF.toFixed(1)}°F · {tent.climate.rh}% RH
                    </span>
                    <span className="font-mono text-emerald-400">
                      CO₂ {tent.climate.co2Ppm || 420} PPM · VPD {tent.climate.vpdKpa.toFixed(2)} kPa
                    </span>
                  </div>
                </div>

                {/* Equipment Strip */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {equipment.map(eq => {
                      const isItemSelected = selectedType === 'item' && selectedId === eq.id;
                      return (
                        <button
                          key={eq.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(eq.id, tent.id);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 transition-colors ${
                            isItemSelected
                              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                              : eq.powerOn
                                ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                                : 'bg-zinc-900 border-zinc-850 text-zinc-400'
                          }`}
                          title={eq.type === 'grow_rack'
                            ? `${eq.name} (${getRackOccupancy(eq, tent.items).size}/${getRackCapacity(eq)} sown)`
                            : `${eq.name} (${eq.powerOn ? 'ON' : 'OFF'})`}
                        >
                          {getEquipmentIcon(eq.type)}
                          <span>{eq.name.split(' ')[0]}</span>
                          {eq.type === 'grow_rack' && <span className="font-mono text-emerald-400">{getRackOccupancy(eq, tent.items).size}/{getRackCapacity(eq)}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-zinc-400 shrink-0 ml-2">
                    Fan: {tent.exhaustFanSpeed}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Free-standing Room Items & Biological Occupants Floor Strip */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-2 z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <span>Room Floor Items &amp; Occupants ({room.items.filter(i => !isRackedPlant(i)).length}):</span>
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              Total footprint: {room.dimensions.length * room.dimensions.width} sq ft
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {room.items.filter(i => !isRackedPlant(i)).map(item => {
              const isItemSelected = selectedType === 'item' && selectedId === item.id;
              const isPerson = item.category === 'person';
              const isPet = item.category === 'pet';

              let badgeBg = 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700';
              let icon = <Zap className="w-3.5 h-3.5 text-teal-400" />;
              let subtitle = '';

              if (isPerson) {
                const p = item as PersonItem;
                badgeBg = 'bg-violet-950/60 border-violet-850 text-violet-200 hover:border-violet-600';
                icon = <User className="w-3.5 h-3.5 text-violet-400" />;
                subtitle = `+${p.co2RateLitersPerHour}L/h CO₂`;
              } else if (isPet) {
                const pet = item as PetItem;
                badgeBg = 'bg-rose-950/60 border-rose-850 text-rose-200 hover:border-rose-600';
                icon = pet.petType === 'cat' ? <Cat className="w-3.5 h-3.5 text-rose-400" /> : <Dog className="w-3.5 h-3.5 text-rose-400" />;
                subtitle = `+${pet.co2RateLitersPerHour}L/h CO₂`;
              } else if (item.category === 'equipment') {
                const eq = item as EquipmentItem;
                icon = getEquipmentIcon(eq.type);
                subtitle = eq.type === 'grow_rack'
                  ? `${getRackOccupancy(eq, room.items).size}/${getRackCapacity(eq)} sown`
                  : eq.powerOn ? `${eq.powerWatts}W` : 'Standby';
              }

              return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectItem(item.id);
                  }}
                  className={`group/rItem cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition-all ${badgeBg} ${
                    isItemSelected ? 'ring-2 ring-emerald-500 border-emerald-400' : ''
                  }`}
                >
                  {icon}
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-200">{item.name}</span>
                    {subtitle && <span className="text-[9px] text-zinc-400 font-mono">{subtitle}</span>}
                  </div>
                  {onDeleteItem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete({ id: item.id, name: item.name, kind: 'item', parentTentId: null });
                      }}
                      className="opacity-0 group-hover/rItem:opacity-100 p-1 rounded hover:bg-rose-950 hover:text-rose-400 text-zinc-500 transition-opacity ml-1"
                      title={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {room.items.length === 0 && (
              <span className="text-xs text-zinc-500 italic">
                No freestanding equipment or occupants placed on the room floor.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for quick floorplan deletion */}
      {itemToDelete && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setItemToDelete(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-zinc-100 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h4 className="text-sm font-bold text-zinc-100">
                Remove {itemToDelete.kind === 'tent' ? 'Tent' : 'Item'}?
              </h4>
            </div>
            <p className="text-xs text-zinc-300">
              Are you sure you want to remove <strong className="text-zinc-100">{itemToDelete.name}</strong> from the facility?
              {itemToDelete.kind === 'tent' && ' All contents inside this tent will also be removed.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (itemToDelete.kind === 'tent' && onDeleteTent) {
                    onDeleteTent(itemToDelete.id);
                  } else if (onDeleteItem) {
                    onDeleteItem(itemToDelete.id, itemToDelete.parentTentId);
                  }
                  setItemToDelete(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-colors"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

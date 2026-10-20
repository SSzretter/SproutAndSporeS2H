import React, { useState } from 'react';
import { 
  CloudSun, 
  CloudRain, 
  Sun, 
  Moon, 
  Cloud, 
  Thermometer, 
  Droplets, 
  SunMedium, 
  Gauge, 
  Box, 
  Home, 
  Plus, 
  Wind, 
  Sparkles,
  Zap,
  MapPin,
  Database,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Building,
  Trash2,
  User,
  Dog
} from 'lucide-react';
import { Room, Tent, OutsideConditions, WeatherType, OutdoorLocation } from '../types/sim';
import { VpdBadge } from './VpdBadge';

interface ClimateDashboardProps {
  outside: OutsideConditions;
  outdoorLocation: OutdoorLocation;
  room: Room;
  rooms?: Room[];
  activeRoomId?: string;
  selectedId: string | null;
  selectedType: 'room' | 'tent' | 'item' | null;
  tempUnit: 'F' | 'C';
  onSelectRoom: () => void;
  onSelectTent: (tentId: string) => void;
  onSelectActiveRoom?: (roomId: string) => void;
  onOpenAddRoom?: () => void;
  onDeleteRoom?: (roomId: string) => void;
  onOpenAddTent: () => void;
  onOpenLocationModal: () => void;
  onDeleteTent?: (tentId: string) => void;
  onUpdateOutdoorCo2?: (co2Ppm: number) => void;
}

export const ClimateDashboard: React.FC<ClimateDashboardProps> = ({
  outside,
  outdoorLocation,
  room,
  rooms = [],
  activeRoomId,
  selectedId,
  selectedType,
  tempUnit,
  onSelectRoom,
  onSelectTent,
  onSelectActiveRoom,
  onOpenAddRoom,
  onDeleteRoom,
  onOpenAddTent,
  onOpenLocationModal,
  onDeleteTent,
  onUpdateOutdoorCo2,
}) => {
  const [tentToDelete, setTentToDelete] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  const formatTemp = (f: number, c: number) => {
    return tempUnit === 'F' ? `${f.toFixed(1)}°F` : `${c.toFixed(1)}°C`;
  };

  const getWeatherIcon = (w: WeatherType) => {
    switch (w) {
      case 'sunny': return <Sun className="w-5 h-5 text-amber-400" />;
      case 'partly_cloudy': return <CloudSun className="w-5 h-5 text-amber-300" />;
      case 'cloudy': return <Cloud className="w-5 h-5 text-zinc-400" />;
      case 'rainy': return <CloudRain className="w-5 h-5 text-blue-400" />;
      case 'clear_night': return <Moon className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getWeatherLabel = (w: WeatherType) => {
    switch (w) {
      case 'sunny': return 'Sunny & Warm';
      case 'partly_cloudy': return 'Partly Cloudy';
      case 'cloudy': return 'Overcast';
      case 'rainy': return 'Rain & High Humidity';
      case 'clear_night': return 'Clear Night Sky';
    }
  };

  const isRoomSelected = selectedType === 'room' && selectedId === room.id;
  const roomVolume = Math.round(room.dimensions.length * room.dimensions.width * room.dimensions.height);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-emerald-400" />
            Environmental Climate Matrix
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time thermodynamic microclimates (Temp, RH, Light, VPD & CO₂) with 2005 Colonial House physics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Outdoor Location Button */}
          <button
            onClick={onOpenLocationModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sky-400 text-xs font-medium border border-sky-950/80 transition-colors shadow-sm"
            title="Set Outdoor ZIP Code & Atmospheric Baseline CO2"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{outdoorLocation.cityName}, {outdoorLocation.state || 'US'} ({outdoorLocation.zipCode})</span>
          </button>

          {/* Add Room Button */}
          {onOpenAddRoom && (
            <button
              onClick={onOpenAddRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-emerald-400 text-xs font-medium border border-emerald-900/50 hover:border-emerald-700/70 transition-all shadow-sm"
              title="Add New Facility Room"
            >
              <Building className="w-3.5 h-3.5" />
              <span>+ Add Room</span>
            </button>
          )}

          <button
            onClick={onOpenAddTent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-md shadow-emerald-950/40 hover:scale-[1.02]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Standard Tent</span>
          </button>
        </div>
      </div>

      {/* Multi-Room Switcher Bar */}
      {rooms && rooms.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-zinc-900/70 border border-zinc-800 p-2 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold px-2 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-400" />
              <span>Facility Rooms ({rooms.length}):</span>
            </span>

            {rooms.map(r => {
              const isActive = r.id === (activeRoomId || room.id);
              return (
                <div
                  key={r.id}
                  className={`group/rm flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                    isActive
                      ? 'bg-emerald-950/80 border-emerald-500/90 text-emerald-300 font-bold shadow-sm ring-1 ring-emerald-500/50'
                      : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectActiveRoom?.(r.id)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    <Home className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <span className="truncate max-w-[140px]">{r.name}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isActive ? 'bg-emerald-900/70 text-emerald-200' : 'bg-zinc-850 text-zinc-400'}`}>
                      {r.tents.length} {r.tents.length === 1 ? 'tent' : 'tents'}
                    </span>
                  </button>

                  {rooms.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoomToDelete(r);
                      }}
                      className="ml-1 opacity-0 group-hover/rm:opacity-100 p-0.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/50 transition-all"
                      title={`Remove ${r.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {onOpenAddRoom && (
            <button
              type="button"
              onClick={onOpenAddRoom}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-950 hover:bg-zinc-850 text-emerald-400 text-[11px] font-semibold border border-zinc-800 hover:border-emerald-700/60 transition-all ml-auto"
            >
              <Plus className="w-3 h-3" />
              <span>New Room</span>
            </button>
          )}
        </div>
      )}

      {/* Grid of Microclimates: Outside -> Room -> Tents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. OUTSIDE CONDITIONS CARD */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  {getWeatherIcon(outside.weather)}
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400/90 font-semibold">
                    Ambient Weather
                  </span>
                  <h3 className="text-sm font-bold text-zinc-100 truncate max-w-[140px]">
                    {outdoorLocation.cityName || 'Outside'}
                  </h3>
                </div>
              </div>
              <button
                onClick={onOpenLocationModal}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800 text-sky-300 hover:bg-sky-900/80 transition-colors flex items-center gap-1"
                title="Change ZIP Code"
              >
                <MapPin className="w-2.5 h-2.5" />
                {outdoorLocation.zipCode}
              </button>
            </div>

            <div className="text-xs text-zinc-300 font-medium mb-3 flex items-center gap-1.5">
              <span>{getWeatherLabel(outside.weather)}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">{outside.windMph.toFixed(0)} mph wind</span>
            </div>

            {/* Readouts Grid */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Temperature</span>
                </div>
                <div className="text-base font-mono font-bold text-zinc-100">
                  {formatTemp(outside.tempF, outside.tempC)}
                </div>
              </div>

              <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Humidity</span>
                </div>
                <div className="text-base font-mono font-bold text-zinc-100">
                  {outside.rh}% RH
                </div>
              </div>

              <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <SunMedium className="w-3.5 h-3.5 text-amber-300" />
                  <span>Solar</span>
                </div>
                <div className="text-base font-mono font-bold text-zinc-100">
                  {outside.lightPPFD > 0 ? `${outside.lightPPFD} PPFD` : '0 PPFD (Night)'}
                </div>
              </div>

              <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pressure</span>
                </div>
                <div className="text-base font-mono font-bold text-zinc-100">
                  {outside.pressureHpa} hPa
                </div>
              </div>
            </div>

            {/* CO2 Readout Row */}
            <div 
              onClick={onOpenLocationModal}
              className="mt-2 bg-zinc-950/70 border border-zinc-850 hover:border-sky-700/80 rounded-xl px-2.5 py-1.5 flex items-center justify-between cursor-pointer group/co2 transition-all" 
              title="Click to configure Outdoor Atmospheric Baseline CO₂ in the weather & location modal"
            >
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Wind className="w-3.5 h-3.5 text-sky-400 group-hover/co2:text-sky-300 transition-colors" />
                <span>Ambient CO₂</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-zinc-100 group-hover/co2:text-sky-300 transition-colors">
                  {outside.co2Ppm || 420} <span className="text-[10px] text-zinc-400 font-normal">PPM</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-850 group-hover/co2:border-sky-600 transition-colors">
                  Outdoor Source
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Database className="w-3 h-3 text-sky-400" />
              {outdoorLocation.isLiveWeather ? 'Open-Meteo Hourly' : 'Simulated Diurnal'}
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">Cached Locally</span>
          </div>
        </div>

        {/* 2. CURRENT ROOM CONDITIONS CARD (2005 Colonial House) */}
        <div 
          onClick={onSelectRoom}
          className={`cursor-pointer rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all group ${
            isRoomSelected
              ? 'bg-zinc-900 border-2 border-emerald-500 shadow-emerald-950/40'
              : 'bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
          }`}
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border transition-colors ${
                  isRoomSelected 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 group-hover:text-emerald-400'
                }`}>
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                      Lung Room
                    </span>
                    <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      2005 Colonial R-19
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors truncate max-w-[150px]">
                    {room.name}
                  </h3>
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                isRoomSelected
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {isRoomSelected ? 'Active' : 'Select'}
              </span>
            </div>

            <div className="text-xs text-zinc-400 mb-3 flex items-center gap-2">
              <span className="font-mono">{room.dimensions.length}′ × {room.dimensions.width}′ × {room.dimensions.height}′</span>
              <span className="text-zinc-600">·</span>
              <span className="text-emerald-400/90 font-mono">{roomVolume} cu ft</span>
              <span className="text-zinc-600">·</span>
              <span>{room.tents.length} Tents</span>
            </div>

            {/* Readouts Grid */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Temperature</span>
                </div>
                <div className="text-base font-mono font-bold text-zinc-100">
                  {formatTemp(room.climate.tempF, room.climate.tempC)}
                </div>
              </div>

              <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Humidity</span>
                </div>
                <div className="text-base font-mono font-bold text-zinc-100">
                  {room.climate.rh}% RH
                </div>
              </div>

              <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <SunMedium className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Light</span>
                </div>
                <div className="text-base font-mono font-bold text-zinc-100">
                  {room.climate.lightPPFD} PPFD
                </div>
              </div>

              <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>VPD</span>
                </div>
                <div className="text-base font-mono font-bold text-zinc-100">
                  {room.climate.vpdKpa.toFixed(2)} kPa
                </div>
              </div>
            </div>

            {/* Dynamic Room CO2 Readout Row */}
            {(() => {
              const peopleInRoom = room.items.filter(i => i.category === 'person');
              const petsInRoom = room.items.filter(i => i.category === 'pet');
              const totalOccupants = peopleInRoom.length + petsInRoom.length;
              
              let co2BadgeText = 'Unoccupied · 420 PPM';
              let co2BadgeTitle = 'Room has no people or pets. Standard 0.35 ACH fresh air infiltration maintains clean outdoor ambient equilibrium (~420 PPM).';
              let co2BadgeClass = 'bg-zinc-800 text-zinc-400 border border-zinc-750';

              if (totalOccupants > 0) {
                const parts: string[] = [];
                if (peopleInRoom.length > 0) parts.push(`${peopleInRoom.length} ${peopleInRoom.length === 1 ? 'Person' : 'People'}`);
                if (petsInRoom.length > 0) parts.push(`${petsInRoom.length} ${petsInRoom.length === 1 ? 'Pet' : 'Pets'}`);
                co2BadgeText = `${parts.join(', ')} Respiration`;
                co2BadgeTitle = `${parts.join(' and ')} actively exhaling biological CO₂ and radiating body warmth into the room envelope.`;
                co2BadgeClass = 'bg-violet-950/80 text-violet-300 border border-violet-800';
              }

              return (
                <div className="mt-2 bg-zinc-950/70 border border-zinc-850 rounded-xl px-2.5 py-1.5 flex items-center justify-between" title={co2BadgeTitle}>
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                    <Wind className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Room CO₂</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-100">
                      {room.climate.co2Ppm || 420} <span className="text-[10px] text-zinc-400 font-normal">PPM</span>
                    </span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${co2BadgeClass}`}>
                      {co2BadgeText}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
            <VpdBadge vpd={room.climate.vpdKpa} target="plant" />
            <span className="text-[11px] text-zinc-400">
              {room.items.length} Room Items
            </span>
          </div>
        </div>

        {/* 3. GROW TENTS CARDS */}
        {room.tents.map(tent => {
          const isTentSelected = selectedType === 'tent' && selectedId === tent.id;
          const tentVol = Math.round(tent.dimensions.length * tent.dimensions.width * tent.dimensions.height);
          const isShroomTent = tent.items.some(i => i.category === 'mushroom');
          const plantsCount = tent.items.filter(i => i.category === 'plant').length;
          const shroomsCount = tent.items.filter(i => i.category === 'mushroom').length;

          const isACI = tent.brand === 'AC Infinity';
          const isSF = tent.brand === 'Spider Farmer';

          const tentCo2 = tent.climate.co2Ppm || (isShroomTent ? 820 : 1100);
          const hasActiveCo2Regulator = tent.items.some(
            i => i.category === 'equipment' && i.type === 'co2_regulator' && i.powerOn
          );
          
          let co2Badge = { text: 'Normal', color: 'bg-zinc-800 text-zinc-300', title: '' };
          if (!isShroomTent) {
            if (hasActiveCo2Regulator) {
              co2Badge = { 
                text: 'CO₂ Injected', 
                color: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800',
                title: 'CO₂ Regulator is actively injecting cylinder gas up to target setpoint'
              };
            } else if (tentCo2 < (room.climate.co2Ppm || 420) - 15) {
              co2Badge = { 
                text: 'Plant Drawdown', 
                color: 'bg-teal-950/80 text-teal-300 border border-teal-800',
                title: 'Plants are actively absorbing and consuming CO₂ during photosynthesis'
              };
            } else if (tentCo2 >= 1000) {
              co2Badge = { 
                text: 'Enriched', 
                color: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800',
                title: 'High CO₂ canopy concentration'
              };
            } else {
              co2Badge = { 
                text: 'Lung Air Exchange', 
                color: 'bg-zinc-800 text-zinc-300 border border-zinc-750',
                title: 'Exhaust fan keeps tent equalized with host room air'
              };
            }
          } else {
            co2Badge = { 
              text: tentCo2 <= 1000 ? 'FAE Pinning' : 'Fungi Respiration', 
              color: 'bg-indigo-950/80 text-indigo-300 border border-indigo-800',
              title: 'Mushrooms exhale CO₂ 24/7 as living respiring fungal organisms'
            };
          }

          return (
            <div
              key={tent.id}
              onClick={() => onSelectTent(tent.id)}
              className={`cursor-pointer rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all group ${
                isTentSelected
                  ? 'bg-zinc-900 border-2 border-emerald-500 shadow-emerald-950/40'
                  : 'bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
              }`}
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl border transition-colors ${
                      isTentSelected
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : isACI
                          ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                          : isSF
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                    }`}>
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono uppercase tracking-wider font-bold px-1.5 py-0.2 rounded ${
                          isACI 
                            ? 'bg-sky-950 border border-sky-800 text-sky-300' 
                            : isSF 
                              ? 'bg-amber-950 border border-amber-800 text-amber-300' 
                              : 'bg-zinc-800 text-zinc-300'
                        }`}>
                          {tent.brand || 'Tent'}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {tent.mylarRating ? tent.mylarRating.split(' ')[0] : 'Mylar'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors truncate max-w-[170px] mt-0.5">
                        {tent.name}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      isTentSelected
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}>
                      {isTentSelected ? 'Active' : 'Inspect'}
                    </span>
                    {onDeleteTent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTentToDelete(tent.id);
                        }}
                        className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                        title={`Remove ${tent.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-zinc-400 mb-3 flex items-center gap-2">
                  <span className="font-mono">{tent.dimensions.length}′ × {tent.dimensions.width}′ × {tent.dimensions.height}′</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-emerald-400/90 font-mono">{tentVol} cu ft</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-300">
                    {plantsCount > 0 ? `${plantsCount}P` : ''}
                    {plantsCount > 0 && shroomsCount > 0 ? ' ' : ''}
                    {shroomsCount > 0 ? `${shroomsCount}M` : ''}
                  </span>
                </div>

                {/* Readouts Grid */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Temperature</span>
                    </div>
                    <div className="text-base font-mono font-bold text-zinc-100">
                      {formatTemp(tent.climate.tempF, tent.climate.tempC)}
                    </div>
                  </div>

                  <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                      <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Humidity</span>
                    </div>
                    <div className="text-base font-mono font-bold text-zinc-100">
                      {tent.climate.rh}% RH
                    </div>
                  </div>

                  <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                      <SunMedium className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Light</span>
                    </div>
                    <div className="text-base font-mono font-bold text-zinc-100">
                      {tent.climate.lightPPFD} PPFD
                    </div>
                  </div>

                  <div className="bg-zinc-950/70 border border-zinc-850 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                      <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                      <span>VPD</span>
                    </div>
                    <div className="text-base font-mono font-bold text-zinc-100">
                      {tent.climate.vpdKpa.toFixed(2)} kPa
                    </div>
                  </div>
                </div>

                {/* CO2 Readout Row */}
                <div className="mt-2 bg-zinc-950/70 border border-zinc-850 rounded-xl px-2.5 py-1.5 flex items-center justify-between" title={co2Badge.title}>
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                    <Wind className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Canopy CO₂</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-100">
                      {tentCo2} <span className="text-[10px] text-zinc-400 font-normal">PPM</span>
                    </span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${co2Badge.color}`} title={co2Badge.title}>
                      {co2Badge.text}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                <VpdBadge vpd={tent.climate.vpdKpa} target={isShroomTent ? 'mushroom' : 'plant'} />
                <span className="text-[11px] text-zinc-400">
                  {tent.items.length} Items
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Tent Confirmation Modal */}
      {tentToDelete && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setTentToDelete(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-zinc-100">Remove Tent</h4>
                <p className="text-xs text-zinc-400">
                  Are you sure you want to dismantle <span className="font-semibold text-zinc-200">{room.tents.find(t => t.id === tentToDelete)?.name}</span>?
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              Removing this tent will take down the reflective canvas structure and delete all internal grow lights, fans, and crops contained inside it.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTentToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteTent) onDeleteTent(tentToDelete);
                  setTentToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-colors"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Room Confirmation Modal */}
      {roomToDelete && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setRoomToDelete(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-zinc-100">Delete Facility Room</h4>
                <p className="text-xs text-zinc-400">
                  Are you sure you want to remove <span className="font-semibold text-zinc-200">{roomToDelete.name}</span>?
                </p>
              </div>
            </div>
            <div className="text-xs text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
              <p>This action will completely decommission this room and delete:</p>
              <ul className="list-disc list-inside text-rose-300/90 font-mono text-[11px] pt-1 space-y-0.5">
                <li>{roomToDelete.tents.length} grow {roomToDelete.tents.length === 1 ? 'tent' : 'tents'} and all crops inside</li>
                <li>{roomToDelete.items.length} freestanding room items &amp; occupants</li>
                <li>Physical dimensions ({roomToDelete.dimensions.length}′ × {roomToDelete.dimensions.width}′)</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteRoom) onDeleteRoom(roomToDelete.id);
                  setRoomToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-colors"
              >
                Delete Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

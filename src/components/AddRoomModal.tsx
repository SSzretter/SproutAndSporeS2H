import React, { useState } from 'react';
import { 
  Building2, 
  X, 
  Plus, 
  Check, 
  Layers, 
  Sliders, 
  Home, 
  Bed, 
  Car, 
  Compass, 
  Sparkles,
  Wind,
  ThermometerSnowflake,
  ShieldAlert
} from 'lucide-react';
import { Room, ConstructionStandard, Dimensions, Climate } from '../types/sim';
import { calculateVPD } from '../utils/physics';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRoom: (room: Room) => void;
  outdoorCo2Ppm?: number;
}

interface RoomPreset {
  id: string;
  name: string;
  desc: string;
  icon: any;
  dimensions: Dimensions;
  constructionStandard: ConstructionStandard;
  foundationType: 'conditioned_basement' | 'slab_on_grade' | 'second_floor' | 'attic';
  wallRValue: number;
  airChangesPerHour: number;
  hvacMode: 'central_ac_active' | 'passive_drift' | 'heating_active';
  hvacCoolingSetpointF: number;
  hvacHeatingSetpointF: number;
}

const ROOM_PRESETS: RoomPreset[] = [
  {
    id: 'preset-basement',
    name: 'Conditioned Basement',
    desc: 'Cool below-grade thermal mass, concrete foundation, tight R-19 insulation.',
    icon: Home,
    dimensions: { length: 20, width: 15, height: 8, unit: 'ft' },
    constructionStandard: 'colonial_2005',
    foundationType: 'conditioned_basement',
    wallRValue: 19,
    airChangesPerHour: 0.35,
    hvacMode: 'central_ac_active',
    hvacCoolingSetpointF: 72,
    hvacHeatingSetpointF: 68
  },
  {
    id: 'preset-bedroom',
    name: 'Spare Bedroom (2nd Floor)',
    desc: 'Above-ground living space, standard residential drywall & central HVAC ducting.',
    icon: Bed,
    dimensions: { length: 12, width: 12, height: 8, unit: 'ft' },
    constructionStandard: 'colonial_2005',
    foundationType: 'second_floor',
    wallRValue: 19,
    airChangesPerHour: 0.40,
    hvacMode: 'central_ac_active',
    hvacCoolingSetpointF: 72,
    hvacHeatingSetpointF: 68
  },
  {
    id: 'preset-garage',
    name: 'Garage Workshop',
    desc: 'Slab-on-grade, higher natural air exchange (0.65 ACH), seasonal ambient swing.',
    icon: Car,
    dimensions: { length: 24, width: 20, height: 10, unit: 'ft' },
    constructionStandard: 'older_drafty',
    foundationType: 'slab_on_grade',
    wallRValue: 13,
    airChangesPerHour: 0.65,
    hvacMode: 'passive_drift',
    hvacCoolingSetpointF: 78,
    hvacHeatingSetpointF: 60
  },
  {
    id: 'preset-attic',
    name: 'Attic / Bonus Room',
    desc: 'Upper roofline microclimate, high solar exposure, R-25 insulated rafter deck.',
    icon: Compass,
    dimensions: { length: 16, width: 14, height: 7.5, unit: 'ft' },
    constructionStandard: 'colonial_2005',
    foundationType: 'attic',
    wallRValue: 25,
    airChangesPerHour: 0.45,
    hvacMode: 'central_ac_active',
    hvacCoolingSetpointF: 70,
    hvacHeatingSetpointF: 66
  }
];

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  isOpen,
  onClose,
  onAddRoom,
  outdoorCo2Ppm = 420
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-bedroom');
  const [roomName, setRoomName] = useState<string>('Spare Bedroom Grow Room');
  const [length, setLength] = useState<number>(12);
  const [width, setWidth] = useState<number>(12);
  const [height, setHeight] = useState<number>(8);
  const [foundationType, setFoundationType] = useState<'conditioned_basement' | 'slab_on_grade' | 'second_floor' | 'attic'>('second_floor');
  const [constructionStandard, setConstructionStandard] = useState<ConstructionStandard>('colonial_2005');
  const [wallRValue, setWallRValue] = useState<number>(19);
  const [airChangesPerHour, setAirChangesPerHour] = useState<number>(0.40);
  const [hvacMode, setHvacMode] = useState<'central_ac_active' | 'passive_drift' | 'heating_active'>('central_ac_active');
  const [starterSetup, setStarterSetup] = useState<'empty' | 'starter_veg'>('empty');

  if (!isOpen) return null;

  const handleSelectPreset = (preset: RoomPreset) => {
    setSelectedPresetId(preset.id);
    setRoomName(preset.name);
    setLength(preset.dimensions.length);
    setWidth(preset.dimensions.width);
    setHeight(preset.dimensions.height);
    setFoundationType(preset.foundationType);
    setConstructionStandard(preset.constructionStandard);
    setWallRValue(preset.wallRValue);
    setAirChangesPerHour(preset.airChangesPerHour);
    setHvacMode(preset.hvacMode);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = roomName.trim() || 'New Facility Room';
    const roomId = `room-${Date.now()}`;

    const initialClimate: Climate = {
      tempF: hvacMode === 'central_ac_active' ? 72.0 : 70.0,
      tempC: hvacMode === 'central_ac_active' ? 22.2 : 21.1,
      rh: 50,
      lightPPFD: 10,
      vpdKpa: calculateVPD(72.0, 50, 10),
      co2Ppm: outdoorCo2Ppm // Infiltrates from ambient outdoor air baseline
    };

    const newRoom: Room = {
      id: roomId,
      name: cleanName,
      dimensions: {
        length: Math.max(6, Math.min(60, Number(length) || 12)),
        width: Math.max(6, Math.min(60, Number(width) || 12)),
        height: Math.max(6, Math.min(20, Number(height) || 8)),
        unit: 'ft'
      },
      climate: initialClimate,
      tents: [],
      items: [],
      constructionStandard,
      foundationType,
      wallRValue,
      airChangesPerHour,
      hvacMode,
      hvacCoolingSetpointF: 72.0,
      hvacHeatingSetpointF: 68.0,
      roomCo2BaselinePpm: outdoorCo2Ppm
    };

    if (starterSetup === 'starter_veg') {
      newRoom.tents.push({
        id: `tent-${Date.now()}-starter`,
        name: 'Starter Veg 4x4 Tent',
        brand: 'AC Infinity',
        modelName: 'CLOUDLAB 844',
        dimensions: { length: 4, width: 4, height: 6.67, unit: 'ft' },
        climate: {
          tempF: 74.5,
          tempC: 23.6,
          rh: 60,
          lightPPFD: 450,
          vpdKpa: calculateVPD(74.5, 60, 450),
          co2Ppm: outdoorCo2Ppm
        },
        items: [
          {
            id: `eq-light-${Date.now()}`,
            name: '300W LED Quantum Bar',
            category: 'equipment',
            type: 'grow_light',
            powerOn: true,
            powerWatts: 300,
            setting: 70,
            schedule: { enabled: true, onHour: 6, offHour: 0 },
            dimensions: { length: 3, width: 3, height: 0.3, unit: 'ft' }
          },
          {
            id: `eq-fan-${Date.now()}`,
            name: '4" EC Inline Exhaust Fan',
            category: 'equipment',
            type: 'exhaust_fan',
            powerOn: true,
            powerWatts: 45,
            setting: 50,
            dimensions: { length: 1, width: 0.7, height: 0.7, unit: 'ft' }
          }
        ],
        exhaustFanSpeed: 50,
        activePreset: 'veg'
      });
    }

    onAddRoom(newRoom);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-zinc-100 my-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Add New Cultivation Room</h3>
              <p className="text-xs text-zinc-400">Expand your facility with an additional lung room or dedicated growing space</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Cards */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-zinc-300 block uppercase tracking-wider font-mono">
            Select Architectural Template:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ROOM_PRESETS.map(preset => {
              const Icon = preset.icon;
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/70 shadow-sm ring-1 ring-emerald-500/50'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-850 text-zinc-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-200">{preset.name}</h4>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{preset.desc}</p>
                    <div className="mt-2 text-[10px] font-mono text-zinc-500 flex gap-2">
                      <span>{preset.dimensions.length}×{preset.dimensions.width}×{preset.dimensions.height} ft</span>
                      <span>·</span>
                      <span>{preset.airChangesPerHour} ACH</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Room Form */}
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          {/* Room Name */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Room Identifier / Name:
            </label>
            <input
              type="text"
              required
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              placeholder="e.g. Spare Bedroom, Garage Workshop"
            />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Length (ft):</label>
              <input
                type="number"
                min="6"
                max="60"
                step="0.5"
                value={length}
                onChange={e => setLength(parseFloat(e.target.value) || 12)}
                className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-1.5 text-sm font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Width (ft):</label>
              <input
                type="number"
                min="6"
                max="60"
                step="0.5"
                value={width}
                onChange={e => setWidth(parseFloat(e.target.value) || 12)}
                className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-1.5 text-sm font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Height (ft):</label>
              <input
                type="number"
                min="6"
                max="20"
                step="0.5"
                value={height}
                onChange={e => setHeight(parseFloat(e.target.value) || 8)}
                className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-1.5 text-sm font-mono text-zinc-100"
              />
            </div>
          </div>

          {/* Envelope & Infiltration Specs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-950/70 border border-zinc-850 p-3 rounded-xl">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Central HVAC Behavior:</label>
              <select
                value={hvacMode}
                onChange={e => setHvacMode(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-750 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
              >
                <option value="central_ac_active">Active Central A/C (72°F)</option>
                <option value="heating_active">Active Central Heat (68°F)</option>
                <option value="passive_drift">Passive Envelope Drift (HVAC Off)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Building Infiltration (ACH):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={airChangesPerHour}
                  onChange={e => setAirChangesPerHour(parseFloat(e.target.value) || 0.35)}
                  className="w-24 bg-zinc-900 border border-zinc-750 rounded-lg px-2 py-1 text-xs font-mono text-zinc-200"
                />
                <span className="text-[11px] text-zinc-400">ACH (Fresh Air Turnover)</span>
              </div>
            </div>
          </div>

          {/* Outdoor Fresh Air Infiltration Notice */}
          <div className="p-3 bg-sky-950/20 border border-sky-900/40 rounded-xl text-xs text-sky-300/90 flex items-start gap-2.5">
            <Wind className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-sky-200">Outdoor Atmospheric Equilibrium:</span>
              <p className="text-[11px] text-sky-300/80 mt-0.5">
                This room will naturally exchange air with the outdoor atmosphere at <strong>{outdoorCo2Ppm} PPM CO₂</strong> baseline. Occupant people, pets, and tent exhausts will dynamically alter its lung room climate.
              </p>
            </div>
          </div>

          {/* Starter Equipment Toggle */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Initial Equipment Layout:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStarterSetup('empty')}
                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                  starterSetup === 'empty'
                    ? 'bg-zinc-800 text-zinc-100 border-emerald-500/60'
                    : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                }`}
              >
                <span className="block font-semibold">Empty Room</span>
                <span className="text-[11px] text-zinc-500">Add tents and items manually</span>
              </button>
              <button
                type="button"
                onClick={() => setStarterSetup('starter_veg')}
                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                  starterSetup === 'starter_veg'
                    ? 'bg-zinc-800 text-zinc-100 border-emerald-500/60'
                    : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                }`}
              >
                <span className="block font-semibold">Include 4x4 Veg Tent</span>
                <span className="text-[11px] text-zinc-500">Pre-wired with 300W LED & 4" fan</span>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

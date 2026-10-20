import React, { useState } from 'react';
import { MapPin, X, Search, Check, CloudSun, Loader2, Database, Sparkles, Navigation } from 'lucide-react';
import { OutdoorLocation } from '../types/sim';
import { lookupZipCode, getCachedHourlyWeather } from '../utils/weatherService';

interface LocationModalProps {
  currentLocation: OutdoorLocation;
  simTime: number;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLocation: (newLocation: OutdoorLocation) => Promise<void>;
}

const PRESET_ZIPS = [
  { zip: '01507', label: 'Charlton, MA', desc: 'Central Mass / Summer Temperate' },
  { zip: '80202', label: 'Denver, CO', desc: 'Mile-High / Arid Alpine' },
  { zip: '97201', label: 'Portland, OR', desc: 'Pacific NW / High Ambient RH' },
  { zip: '90210', label: 'Beverly Hills, CA', desc: 'SoCal / Warm & Sunny' },
  { zip: '10001', label: 'New York, NY', desc: 'Northeast / Four Seasons' },
  { zip: '78701', label: 'Austin, TX', desc: 'Texas / Hot Midday Sun' },
  { zip: '33101', label: 'Miami, FL', desc: 'Subtropical / Constant High RH' },
  { zip: '98101', label: 'Seattle, WA', desc: 'Puget Sound / Temperate Maritime' },
];

export const LocationModal: React.FC<LocationModalProps> = ({
  currentLocation,
  simTime,
  isOpen,
  onClose,
  onUpdateLocation,
}) => {
  const [zipInput, setZipInput] = useState(currentLocation.zipCode || '01507');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleApplyZip = async (zipToUse: string) => {
    const clean = zipToUse.trim().slice(0, 5);
    if (clean.length < 5) {
      setErrorMsg('Please enter a valid 5-digit US ZIP code.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Geocode ZIP
      const geo = await lookupZipCode(clean);

      // 2. Fetch and cache hourly weather from Open-Meteo matching the simulated season/month
      const weatherPkg = await getCachedHourlyWeather(geo.lat, geo.lon, simTime, true);

      const newLoc: OutdoorLocation = {
        zipCode: clean,
        cityName: geo.city,
        state: geo.state,
        country: 'US',
        lat: geo.lat,
        lon: geo.lon,
        isLiveWeather: weatherPkg.source === 'Open-Meteo',
        lastFetchedTime: Date.now(),
        statusText: weatherPkg.source === 'Open-Meteo'
          ? 'Open-Meteo Hourly API (Cached)'
          : 'Atmospheric Physics (Cached)'
      };

      await onUpdateLocation(newLoc);
      setSuccessMsg(`Bound to ${geo.city}, ${geo.state} (${clean}). Cached ${weatherPkg.hourly.length} hourly datapoints.`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resolve location or weather data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-zinc-100 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Outdoor Location &amp; Weather Feed</h3>
              <p className="text-xs text-zinc-400">Set ZIP code for live hourly outdoor weather data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Location Card */}
        <div className="bg-zinc-950/80 border border-zinc-850 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-sky-400 font-semibold block">
              Active Outdoor Station
            </span>
            <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 mt-0.5">
              <span>{currentLocation.cityName}, {currentLocation.state}</span>
              <span className="text-xs font-mono text-zinc-400">({currentLocation.zipCode})</span>
            </div>
            <span className="text-[11px] text-zinc-400">
              Coordinates: {currentLocation.lat.toFixed(2)}°N, {Math.abs(currentLocation.lon).toFixed(2)}°W
            </span>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 border border-emerald-800 text-emerald-300">
              <Database className="w-2.5 h-2.5" />
              Cached Feed
            </span>
            <span className="text-[10px] text-zinc-500 block mt-1 font-mono">
              Zero redundant calls
            </span>
          </div>
        </div>

        {/* Zip Code Input Form */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 block">
            Enter 5-Digit US Postal / ZIP Code:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={5}
                value={zipInput}
                onChange={e => setZipInput(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 80202, 90210, 97201"
                className="w-full bg-zinc-950 border border-zinc-750 focus:border-sky-500 rounded-xl px-3.5 py-2 text-sm font-mono text-zinc-100 focus:outline-none"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleApplyZip(zipInput);
                }}
              />
            </div>
            <button
              onClick={() => handleApplyZip(zipInput)}
              disabled={loading || zipInput.length < 5}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Apply ZIP</span>
                </>
              )}
            </button>
          </div>
          {errorMsg && <p className="text-xs text-rose-400 mt-1">{errorMsg}</p>}
          {successMsg && <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {successMsg}</p>}
        </div>

        {/* Quick Regional Presets */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-zinc-400 block">
            Or Quick-Select Cultivation Climate Region:
          </span>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {PRESET_ZIPS.map(p => {
              const isSelected = currentLocation.zipCode === p.zip;
              return (
                <button
                  key={p.zip}
                  type="button"
                  onClick={() => {
                    setZipInput(p.zip);
                    handleApplyZip(p.zip);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-sky-950/70 border-sky-500 text-sky-200'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">{p.label}</span>
                    <span className="text-[10px] font-mono text-zinc-400">{p.zip}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Caching Architecture Notice */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-400">
          <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Hourly forecast table is cached in your browser. Simulation ticks pull locally without re-requesting.
          </span>
        </div>
      </div>
    </div>
  );
};

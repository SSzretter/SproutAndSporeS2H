import React from 'react';
import { Sliders, Shield, Droplets, Wind, AlertTriangle, Layers, Flame } from 'lucide-react';
import type { ItemSectionProps, PlantLocals } from './types';

export const PlantStageAuditCard: React.FC<ItemSectionProps & Pick<PlantLocals, 'plant' | 'enclosureClimate' | 'photoperiodHours' | 'suitability' | 'req' | 'trayMicro' | 'rack'>> = (props) => {
  const { plant, enclosureClimate, photoperiodHours, suitability, req, trayMicro, rack } = props;

  return (
    <>
      {/* 3. Stage Conditions vs Live Enclosure Environment Audit */}
      <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="text-sm font-bold text-zinc-100">
                Stage Condition Requirements &amp; Live Physics Audit
              </h4>
              <p className="text-[11px] text-zinc-400">{req.summary}</p>
            </div>
          </div>
          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                    suitability.status === 'optimal'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : suitability.status === 'acceptable'
                        ? 'bg-teal-950 text-teal-300 border border-teal-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
            {suitability.overallScore.toFixed(2)}x Growth Rate ({suitability.status.toUpperCase()})
          </span>
        </div>

        {/* Tray Microclimate & Humidity Dome Banner (when plant is placed on a grow rack) */}
        {trayMicro && (
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {trayMicro.hasDome ? (
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Shield className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400">
                    <Layers className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <span>1020 Tray Microclimate: {trayMicro.statusLabel}</span>
                    {trayMicro.hasDome && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                        trayMicro.ventsOpen
                          ? 'bg-sky-950 text-sky-300 border border-sky-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {trayMicro.ventsOpen ? 'Vents Open' : 'Sealed Dome'}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Shelf {plant.rackSlot ? plant.rackSlot.tier + 1 : 1} · Tray {plant.rackSlot ? plant.rackSlot.tray + 1 : 1}
                    {trayMicro.conductedMatHeatF > 0 && ` · +${trayMicro.conductedMatHeatF}°F conducted mat warmth`}
                    {trayMicro.hasDome && ` · Evaporation ${(trayMicro.soilMoistureEvapMultiplier * 100).toFixed(0)}% of open air`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px]">
                <div className="text-right">
                  <span className="text-zinc-500 block text-[9px] uppercase">Tray Interior</span>
                  <span className="font-bold text-emerald-400">{trayMicro.tempF}°F · {trayMicro.rh}% RH</span>
                </div>
              </div>
            </div>

            {/* Overheating or Damping-Off Warning Alerts */}
            {trayMicro.warning && (
              <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                trayMicro.isOverheating
                  ? 'bg-rose-950/40 border border-rose-900/60 text-rose-300'
                  : 'bg-amber-950/40 border border-amber-900/60 text-amber-300'
              }`}>
                {trayMicro.isOverheating ? <Flame className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span className="font-medium">{trayMicro.warning}</span>
              </div>
            )}
          </div>
        )}

        {/* Audit Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Temp */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-zinc-400 font-medium block">Air Temp</span>
            <div className="font-mono font-bold text-zinc-100 text-sm">
              {enclosureClimate.tempF.toFixed(1)}°F
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Target: {req.tempMinF}-{req.tempMaxF}°F
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.tempStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-rose-950 text-rose-400'
                    }`}>
              {suitability.tempStatus.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Humidity */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-zinc-400 font-medium block">Humidity (RH)</span>
            <div className="font-mono font-bold text-zinc-100 text-sm">
              {enclosureClimate.rh}%
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Target: {req.rhMin}-{req.rhMax}%
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.rhStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-amber-950 text-amber-400'
                    }`}>
              {suitability.rhStatus.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* VPD */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-zinc-400 font-medium block">VPD Deficit</span>
            <div className="font-mono font-bold text-zinc-100 text-sm">
              {enclosureClimate.vpdKpa} kPa
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Target: {req.vpdMin}-{req.vpdMax} kPa
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.vpdStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-amber-950 text-amber-400'
                    }`}>
              {suitability.vpdStatus.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* PPFD */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-zinc-400 font-medium block">Light PPFD</span>
            <div className="font-mono font-bold text-zinc-100 text-sm">
              {enclosureClimate.lightPPFD} μmol
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Opt: ~{req.ppfdOptimal} μmol
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.ppfdStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-rose-950 text-rose-400'
                    }`}>
              {suitability.ppfdStatus.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Root Zone */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-zinc-400 font-medium block">Root Zone Temp</span>
            <div className="font-mono font-bold text-zinc-100 text-sm">
              {(plant.rootTempF || 68).toFixed(1)}°F
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Target: 68-75°F
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.rootTempStatus === 'ideal' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-amber-950 text-amber-400'
                    }`}>
              {suitability.rootTempStatus.toUpperCase()}
            </span>
          </div>

          {/* Photoperiod */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-zinc-400 font-medium block">Photoperiod</span>
            <div className="font-mono font-bold text-zinc-100 text-sm">
              {photoperiodHours}h Light
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Req: {req.targetPhotoperiodHours}h Light
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded block text-center ${
                      suitability.photoperiodStatus === 'aligned' 
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-rose-950 text-rose-400'
                    }`}>
              {suitability.photoperiodStatus === 'aligned' ? 'ALIGNED' : 'MISALIGNED'}
            </span>
          </div>
        </div>

        {suitability.limitingFactor && (
          <div className="p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-lg text-xs text-amber-300 flex items-center gap-2">
            <span className="font-bold">⚠️ Limiting Factor:</span>
            <span>{suitability.limitingFactor}</span>
          </div>
        )}
      </div>
    </>
  );
};

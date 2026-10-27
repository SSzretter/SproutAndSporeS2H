import React from 'react';
import { Sliders } from 'lucide-react';
import type { ItemSectionProps, PlantLocals } from './types';

export const PlantStageAuditCard: React.FC<ItemSectionProps & Pick<PlantLocals, 'plant' | 'enclosureClimate' | 'photoperiodHours' | 'suitability' | 'req'>> = (props) => {
  const { plant, enclosureClimate, photoperiodHours, suitability, req } = props;

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

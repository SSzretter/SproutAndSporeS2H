import React from 'react';
import type { ItemSectionProps, PlantLocals } from './types';

export const PlantHopsCard: React.FC<ItemSectionProps & Pick<PlantLocals, 'plant'>> = (props) => {
  const { plant } = props;

  return (
    <>
      {/* 5. Craft Hop Trellis & Brewing Alpha Acid Profile */}
      {plant.species === 'Hops' && (
        <div className="bg-gradient-to-r from-amber-950/30 to-zinc-950 border border-amber-800/70 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-900/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍺</span>
              <div>
                <h4 className="text-sm font-bold text-amber-200">
                  Craft Hop Trellis Bine &amp; Brewing Quality (Humulus lupulus)
                </h4>
                <p className="text-[11px] text-amber-400/80">
                  Twining Bine Height: {(plant.heightInches / 12).toFixed(1)} ft · Trellis Target: 14 - 16 ft
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-950 border border-amber-800">
                {(plant.alphaAcidsPct || 7.0).toFixed(1)}% Alpha Acids (AA)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
              <div className="text-zinc-400 text-[10px] uppercase font-mono">Brewing Profile</div>
              <div className="font-bold text-zinc-200 mt-0.5">
                {(plant.alphaAcidsPct || 7) >= 11 ? 'High-Alpha Bittering' : (plant.alphaAcidsPct || 7) >= 6 ? 'Dual Purpose Bittering & Aroma' : 'Noble Fine Aroma'}
              </div>
              <div className="text-[10px] text-amber-400/90 mt-1">
                Ideal for IPAs, Pale Ales, and Craft Lagers
              </div>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
              <div className="text-zinc-400 text-[10px] uppercase font-mono">Lupulin Resin Glands</div>
              <div className="font-bold text-emerald-300 mt-0.5">
                {['flowering', 'ripening', 'ready'].includes(plant.stage) 
                  ? '✨ Golden Strobile Cones Active' 
                  : '🌿 Vegetative Bine Vigorous Extension'}
              </div>
              <div className="text-[10px] text-zinc-400 mt-1">
                Cone density: {plant.stage === 'flowering' ? 'Dense papery strobiles' : plant.stage === 'ripening' ? 'Fragrant lupulin dust' : 'Climbing trellis twine'}
              </div>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
              <div className="text-zinc-400 text-[10px] uppercase font-mono">Climbing Trellis Progress</div>
              <div className="flex items-center justify-between font-mono text-zinc-200 text-xs mt-0.5">
                <span>{plant.heightInches.toFixed(0)}″</span>
                <span>192″ Max (16′)</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-amber-500 rounded-full" 
                  style={{ width: `${Math.min(100, (plant.heightInches / 192) * 100)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

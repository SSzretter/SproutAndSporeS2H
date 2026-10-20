import React from 'react';
import { Award, X, Sparkles, Scale, Calendar, CheckCircle2 } from 'lucide-react';
import { HarvestRecord } from '../types/sim';

interface HarvestLogModalProps {
  harvests: HarvestRecord[];
  isOpen: boolean;
  onClose: () => void;
}

export const HarvestLogModal: React.FC<HarvestLogModalProps> = ({ harvests, isOpen, onClose }) => {
  if (!isOpen) return null;

  const totalGrams = harvests.reduce((acc, h) => acc + h.yieldGrams, 0);
  const totalOunces = (totalGrams / 28.3495).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-zinc-100 max-h-[85vh] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Cultivation Harvest Vault</h3>
                <p className="text-xs text-zinc-400">Record of dried yields and mycology flushes</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3 my-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                Total Harvested Mass
              </span>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {totalGrams.toFixed(1)} g <span className="text-xs text-zinc-400 font-sans">({totalOunces} oz)</span>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                Completed Cycles
              </span>
              <div className="text-lg font-bold font-mono text-amber-400">
                {harvests.length} Batches
              </div>
            </div>
          </div>

          {/* Harvest List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {harvests.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                No crops have been harvested yet. Nurture your plants and mushrooms to harvest readiness!
              </div>
            ) : (
              harvests.map(h => (
                <div
                  key={h.id}
                  className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{h.type === 'plant' ? '🌿' : '🍄'}</span>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">{h.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span>{h.species}</span>
                        <span className="text-zinc-600">·</span>
                        <span>{h.dateStr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-amber-400">
                      +{h.yieldGrams.toFixed(0)} g
                    </div>
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                      {h.quality}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  FastForward, 
  RotateCcw, 
  Download, 
  Upload, 
  Sun, 
  Moon, 
  Clock, 
  Award,
  Package,
  Calendar,
  Sparkles,
  Save,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  Gamepad2,
  ExternalLink
} from 'lucide-react';
import { SimulationState } from '../types/sim';

interface HeaderClockProps {
  state: SimulationState;
  onSetSpeed: (speed: number) => void;
  onSkipTime: (hours: number) => void;
  onToggleTempUnit: () => void;
  onResetSim: () => void;
  onOpenHarvests: () => void;
  onExportJson: () => void;
  onImportJson: (jsonStr: string) => void;
  lastSavedAt: number;
  onSwitchToGame?: () => void;
  onPopOutGame?: () => void;
}

export const HeaderClock: React.FC<HeaderClockProps> = ({
  state,
  onSetSpeed,
  onSkipTime,
  onToggleTempUnit,
  onResetSim,
  onOpenHarvests,
  onExportJson,
  onImportJson,
  lastSavedAt,
  onSwitchToGame,
  onPopOutGame
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const date = new Date(state.simTime);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const isDay = hour >= 6 && hour < 20;

  // Days elapsed since start
  const daysElapsed = Math.floor((state.simTime - state.startTime) / (1000 * 60 * 60 * 24)) + 1;

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const speedOptions = [
    { value: 0, label: 'Pause', icon: Pause },
    { value: 1, label: '1x (1m/s)' },
    { value: 5, label: '5x' },
    { value: 30, label: '30x' },
    { value: 120, label: '120x' },
    { value: 720, label: '720x' },
  ];

  const handleImportSubmit = () => {
    try {
      if (!importText.trim()) return;
      onImportJson(importText);
      setShowImportModal(false);
      setImportText('');
      setImportError('');
    } catch (e: any) {
      setImportError(e.message || 'Invalid JSON save state');
    }
  };

  const handleRestoreBackup = () => {
    try {
      const backup = localStorage.getItem('sprout_spore_grow_sim_v2_backup');
      if (!backup) {
        setImportError('No secondary backup snapshot found in this browser origin.');
        return;
      }
      onImportJson(backup);
      setShowImportModal(false);
      setImportText('');
      setImportError('');
    } catch (e: any) {
      setImportError(e.message || 'Failed to restore backup snapshot');
    }
  };

  return (
    <header className="bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur sticky top-0 z-40 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-zinc-100">
                Sprout &amp; Spore
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 font-semibold uppercase tracking-wider">
                Grow Sim
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Indoor Botany &amp; Mycology Climate Laboratory
            </p>
          </div>
        </div>

        {/* 24-Hour Game Clock Display */}
        <div className="flex items-center gap-3 bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-1.5 shadow-sm">
          <div className="flex items-center gap-2">
            {isDay ? (
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400" title="Day Photoperiod">
                <Sun className="w-4 h-4 animate-spin-slow" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400" title="Night Cycle">
                <Moon className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-lg font-bold tracking-wider text-emerald-400">
                  {formattedTime}
                </span>
                <span className="text-[11px] font-mono font-medium text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded">
                  24H
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Calendar className="w-3 h-3 text-zinc-400" />
                <span>{formattedDate}</span>
                <span className="text-zinc-600">·</span>
                <span className="text-emerald-400 font-medium">Day {daysElapsed}</span>
              </div>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-zinc-800 hidden md:block" />

          {/* Speed & Pause Controls */}
          <div className="flex items-center gap-1">
            {speedOptions.map(opt => {
              const isActive = state.speed === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onSetSpeed(opt.value)}
                  className={`px-2 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white'
                  }`}
                  title={`Speed: ${opt.label}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Quick Skip Buttons */}
          <div className="hidden lg:flex items-center gap-1 pl-1 border-l border-zinc-800">
            <button
              onClick={() => onSkipTime(6)}
              className="px-1.5 py-1 rounded text-[11px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Fast forward 6 hours"
            >
              +6h
            </button>
            <button
              onClick={() => onSkipTime(24)}
              className="px-1.5 py-1 rounded text-[11px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Fast forward 24 hours (1 full day)"
            >
              +1d
            </button>
          </div>
        </div>

        {/* Global Controls & Tools */}
        <div className="flex items-center gap-2">
          {/* Temperature unit switch */}
          <button
            onClick={onToggleTempUnit}
            className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-xs font-mono font-medium text-zinc-300 hover:text-white transition-colors"
            title="Toggle Temperature Unit"
          >
            °{state.tempUnit}
          </button>

          {/* Harvests Inventory Button */}
          <button
            onClick={onOpenHarvests}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/50 hover:bg-emerald-900/40 text-emerald-300 text-xs font-medium transition-colors"
            title="Open Cultivator Harvest Inventory"
          >
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Inventory</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
              {state.harvests.length}
            </span>
          </button>

          {/* 3D Video Game Mode Button */}
          {onSwitchToGame && (
            <button
              onClick={onSwitchToGame}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-all shadow-sm"
              title="Switch to 3D Video Game Mode (Walk rooms, place tents, inspect & harvest)"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>3D Game Mode</span>
            </button>
          )}

          {/* Screen 2 Pop Out */}
          {onPopOutGame && (
            <button
              onClick={onPopOutGame}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700/80 text-zinc-200 text-xs font-semibold transition-colors"
              title="Pop out 3D Game to Screen 2 in separate window (100% live synced)"
            >
              <ExternalLink className="w-3 h-3 text-emerald-400" />
              <span>Screen 2 ↗</span>
            </button>
          )}

          {/* Save Status */}
          <div 
            className="hidden xl:flex items-center gap-1 text-[11px] text-zinc-400 px-2 py-1 rounded bg-zinc-900/60 border border-zinc-850"
            title="Auto-saves to browser localStorage on every tick"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Saved</span>
          </div>

          {/* Export JSON */}
          <button
            onClick={onExportJson}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Export Simulation Save State (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Import JSON */}
          <button
            onClick={() => setShowImportModal(true)}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Import Simulation Save State (JSON)"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Reset Simulation */}
          <button
            onClick={() => setShowResetConfirm(true)}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-rose-950/50 hover:border-rose-800/50 text-zinc-400 hover:text-rose-400 transition-colors"
            title="Reset Simulation (Default 2 Months Ago Start)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-400" />
              Reset Simulation to Default?
            </h3>
            <p className="text-sm text-zinc-400 mt-2">
              This will reset the game clock back to <strong>Aug 20, 2026</strong> (2 months prior to current date), restoring the default 2-tent layout with fresh seedlings and mycelium tubs.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetSim();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors shadow-lg shadow-rose-900/30"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-zinc-100">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-400" />
              Import Simulation Save
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Paste a previously exported JSON simulation state to restore all tents, plants, and timestamps.
            </p>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="Paste JSON here..."
              className="mt-3 w-full h-44 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500 resize-none"
            />
            {importError && (
              <p className="text-xs text-rose-400 mt-2">{importError}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRestoreBackup}
                className="px-3 py-2 rounded-xl bg-cyan-950/70 border border-cyan-800/80 hover:bg-cyan-900 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Restore from the automatic secondary rolling backup in localStorage"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Auto-Backup
              </button>
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSubmit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-900/30"
                >
                  Load State
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

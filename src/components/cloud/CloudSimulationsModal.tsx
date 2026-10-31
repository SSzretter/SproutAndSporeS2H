import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Cloud, 
  CloudRain, 
  CloudUpload, 
  CloudDownload, 
  Plus, 
  Trash2, 
  RefreshCw, 
  LogOut, 
  Calendar, 
  FolderSync, 
  Check, 
  Copy, 
  AlertTriangle, 
  Database, 
  Sprout, 
  Loader2, 
  Layers, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { SimulationState } from '../../types/sim';
import { 
  CloudSimulationSummary, 
  SUPABASE_SETUP_SQL 
} from '../../lib/supabase';
import { 
  listUserSimulations, 
  loadUserSimulation, 
  saveNewSimulation, 
  overwriteSimulation, 
  deleteSimulation, 
  signOut,
  extractFacilityMetrics
} from '../../services/cloudSimService';

interface CloudSimulationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  currentSimState: SimulationState;
  onLoadSimulation: (loadedState: SimulationState, saveName: string) => void;
  onNotify?: (message: string, type: 'success' | 'warning' | 'info') => void;
}

export const CloudSimulationsModal: React.FC<CloudSimulationsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAuth,
  currentSimState,
  onLoadSimulation,
  onNotify
}) => {
  const [simulations, setSimulations] = useState<CloudSimulationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // New Save Form
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [newSaveName, setNewSaveName] = useState('');
  const [newSaveDesc, setNewSaveDesc] = useState('');
  const [isSubmittingSave, setIsSubmittingSave] = useState(false);

  // Overwrite Confirm
  const [overwriteTarget, setOverwriteTarget] = useState<CloudSimulationSummary | null>(null);
  const [isSubmittingOverwrite, setIsSubmittingOverwrite] = useState(false);

  // Load Confirm
  const [loadTarget, setLoadTarget] = useState<CloudSimulationSummary | null>(null);
  const [isSubmittingLoad, setIsSubmittingLoad] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<CloudSimulationSummary | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const currentMetrics = extractFacilityMetrics(currentSimState);

  const fetchSimulations = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMsg(null);
    setIsTableMissing(false);

    try {
      const result = await listUserSimulations();
      if (result.error) {
        setErrorMsg(result.error);
        if (result.isTableMissing) {
          setIsTableMissing(true);
        }
      } else {
        setSimulations(result.data || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retrieve simulations.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchSimulations();
      // Initialize default save name
      const dateStr = new Date(currentSimState.simTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setNewSaveName(`${currentMetrics.facilityName} (${dateStr})`);
    }
  }, [isOpen, currentUser, fetchSimulations, currentSimState.simTime, currentMetrics.facilityName]);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCreateNewSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSaveName.trim()) return;

    setIsSubmittingSave(true);
    setErrorMsg(null);

    try {
      const result = await saveNewSimulation(newSaveName, newSaveDesc, currentSimState);
      if (result.error) {
        setErrorMsg(result.error);
        if (result.isTableMissing) setIsTableMissing(true);
      } else {
        setIsSavingNew(false);
        setNewSaveDesc('');
        onNotify?.(`Saved "${newSaveName}" to Supabase cloud!`, 'success');
        await fetchSimulations();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save simulation to cloud.');
    } finally {
      setIsSubmittingSave(false);
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!overwriteTarget) return;
    setIsSubmittingOverwrite(true);
    setErrorMsg(null);

    try {
      const result = await overwriteSimulation(overwriteTarget.id, currentSimState);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        onNotify?.(`Updated cloud save "${overwriteTarget.name}" with current state.`, 'success');
        setOverwriteTarget(null);
        await fetchSimulations();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to overwrite simulation.');
    } finally {
      setIsSubmittingOverwrite(false);
    }
  };

  const handleConfirmLoad = async () => {
    if (!loadTarget) return;
    setIsSubmittingLoad(true);
    setErrorMsg(null);

    try {
      const result = await loadUserSimulation(loadTarget.id);
      if (result.error || !result.data) {
        setErrorMsg(result.error || 'Could not load simulation record.');
      } else {
        onLoadSimulation(result.data.data, result.data.name);
        setLoadTarget(null);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load simulation.');
    } finally {
      setIsSubmittingLoad(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmittingDelete(true);
    setErrorMsg(null);

    try {
      const result = await deleteSimulation(deleteTarget.id);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        onNotify?.(`Deleted "${deleteTarget.name}" from cloud.`, 'info');
        setDeleteTarget(null);
        await fetchSimulations();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete simulation.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
    onNotify?.('Signed out of Supabase Cloud.', 'info');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-zinc-100 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">
                  Cloud Simulations Manager
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-400 font-semibold uppercase">
                  Supabase
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Store, load, and manage multiple simulation states across devices
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Account Bar */}
        <div className="px-5 py-2.5 bg-zinc-950/70 border-b border-zinc-850 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-700/60 border border-emerald-500/40 flex items-center justify-center text-[11px] font-bold text-emerald-200 uppercase">
                {currentUser.email ? currentUser.email.charAt(0) : 'U'}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-200 font-medium">
                  {currentUser.email}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  (UID: {currentUser.id.substring(0, 8)}...)
                </span>
              </div>
            </div>
          ) : (
            <div className="text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Not logged in to cloud</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {currentUser ? (
              <>
                <button
                  onClick={fetchSimulations}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-zinc-100 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Refresh cloud simulations"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-rose-950/50 hover:text-rose-300 text-zinc-400 flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span>Log In / Sign Up</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Missing Table Supabase Guide */}
          {isTableMissing && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-300 text-sm">
                    Supabase Database Setup Required
                  </h4>
                  <p className="text-amber-400/90 mt-1 leading-relaxed">
                    The <code className="bg-amber-950/80 px-1 py-0.5 rounded text-amber-300 font-mono">simulations</code> table hasn't been created in this Supabase project yet. Simply copy the ready-to-run SQL schema below and paste it into your Supabase Dashboard SQL editor:
                  </p>
                </div>
              </div>

              <div className="relative">
                <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-300 max-h-36 overflow-y-auto overflow-x-auto whitespace-pre">
                  {SUPABASE_SETUP_SQL}
                </pre>
                <button
                  onClick={handleCopySql}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1.5 shadow"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-amber-400/80">
                After running the SQL script in your Supabase dashboard, click the <strong>Refresh</strong> button above to start saving!
              </p>
            </div>
          )}

          {/* General Error Notice */}
          {errorMsg && !isTableMissing && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* If user is not logged in */}
          {!currentUser ? (
            <div className="p-8 text-center rounded-2xl bg-zinc-950/40 border border-zinc-800/60">
              <CloudUpload className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-zinc-200">
                Cloud Sync Requires an Account
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                Log in via Email/Password, Magic Link, or Google to save multiple simulations and restore them on any computer.
              </p>
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-lg shadow-emerald-900/30 inline-flex items-center gap-2"
              >
                <span>Log In to Supabase</span>
              </button>
            </div>
          ) : (
            <>
              {/* Save Current Facility Section */}
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800">
                {!isSavingNew ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <CloudUpload className="w-4 h-4 text-emerald-400" />
                        <span>Current Facility Snapshot</span>
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {currentMetrics.facilityName} &bull; {currentMetrics.roomCount} {currentMetrics.roomCount === 1 ? 'Room' : 'Rooms'} &bull; {currentMetrics.plantCount} Plants &bull; {currentMetrics.mushroomCount} Tubs
                      </p>
                    </div>

                    <button
                      onClick={() => setIsSavingNew(true)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Current State to Cloud</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateNewSave} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                        <CloudUpload className="w-4 h-4 text-emerald-400" />
                        <span>Save Current Facility as New Simulation</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsSavingNew(false)}
                        className="text-zinc-400 hover:text-zinc-200 text-xs"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                          Simulation Name
                        </label>
                        <input
                          type="text"
                          value={newSaveName}
                          onChange={e => setNewSaveName(e.target.value)}
                          placeholder="e.g. Master Grow - Veg & Bloom"
                          required
                          className="w-full bg-zinc-900 border border-zinc-750 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                          Notes / Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={newSaveDesc}
                          onChange={e => setNewSaveDesc(e.target.value)}
                          placeholder="e.g. Week 4 flower with co2 boost"
                          className="w-full bg-zinc-900 border border-zinc-750 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-zinc-500 font-mono">
                        Contains {currentMetrics.roomCount} rooms, {currentMetrics.plantCount} plants, {currentMetrics.mushroomCount} mushrooms
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsSavingNew(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingSave}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {isSubmittingSave ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CloudUpload className="w-3.5 h-3.5" />
                          )}
                          <span>Save to Cloud</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* Saved Simulations List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderSync className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Your Cloud Saves ({simulations.length})</span>
                  </h3>
                  <span className="text-[11px] text-zinc-500">
                    Auto-synced with Supabase
                  </span>
                </div>

                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                    <span className="text-xs">Fetching cloud saves...</span>
                  </div>
                ) : simulations.length === 0 ? (
                  <div className="py-10 text-center rounded-xl bg-zinc-950/30 border border-zinc-800/60 p-6">
                    <CloudRain className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                    <h4 className="text-xs font-semibold text-zinc-300">
                      No cloud saves found
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Use the "Save Current State to Cloud" button above to store your first facility save.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {simulations.map(sim => {
                      const simDate = sim.sim_time ? new Date(sim.sim_time).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Sim Start';

                      const updatedDate = new Date(sim.updated_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <div
                          key={sim.id}
                          className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs text-zinc-100 truncate">
                                {sim.name}
                              </h4>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-400 font-mono">
                                {simDate}
                              </span>
                            </div>

                            {sim.description && (
                              <p className="text-[11px] text-zinc-400 line-clamp-1">
                                {sim.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400 font-medium pt-0.5">
                              <span className="flex items-center gap-1 text-zinc-300">
                                <Layers className="w-3 h-3 text-emerald-400" />
                                {sim.room_count} {sim.room_count === 1 ? 'room' : 'rooms'}
                              </span>
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Sprout className="w-3 h-3" />
                                {sim.plant_count} plants
                              </span>
                              {sim.mushroom_count > 0 && (
                                <span className="flex items-center gap-1 text-amber-400">
                                  <Sparkles className="w-3 h-3" />
                                  {sim.mushroom_count} mushrooms
                                </span>
                              )}
                              <span className="text-zinc-400">
                                Saved: {updatedDate}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-850">
                            <button
                              onClick={() => setLoadTarget(sim)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                              title="Load this simulation into workspace"
                            >
                              <CloudDownload className="w-3.5 h-3.5" />
                              <span>Load</span>
                            </button>

                            <button
                              onClick={() => setOverwriteTarget(sim)}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-medium transition-colors"
                              title="Overwrite this slot with your current simulation state"
                            >
                              <span>Overwrite</span>
                            </button>

                            <button
                              onClick={() => setDeleteTarget(sim)}
                              className="p-1.5 rounded-lg bg-zinc-850 hover:bg-rose-950/60 hover:border-rose-800/60 text-zinc-400 hover:text-rose-400 transition-colors"
                              title="Delete from cloud"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Load Confirmation Dialog */}
        {loadTarget && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <CloudDownload className="w-5 h-5 text-emerald-400" />
                Load "{loadTarget.name}"?
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Loading this simulation will replace the active facility state in your current browser session. Any un-saved changes in your local facility will be superseded.
              </p>
              <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 space-y-1">
                <div><strong>Facility:</strong> {loadTarget.facility_name || 'Indoor Lab'}</div>
                <div><strong>Scale:</strong> {loadTarget.room_count} rooms, {loadTarget.plant_count} plants, {loadTarget.mushroom_count} tubs</div>
                <div><strong>In-game Date:</strong> {loadTarget.sim_time ? new Date(loadTarget.sim_time).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLoadTarget(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLoad}
                  disabled={isSubmittingLoad}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                >
                  {isSubmittingLoad ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Load Simulation</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overwrite Confirmation Dialog */}
        {overwriteTarget && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Overwrite Cloud Save?
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Are you sure you want to overwrite <strong>"{overwriteTarget.name}"</strong> with the currently active facility state? The previous cloud snapshot for this slot will be updated.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOverwriteTarget(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOverwrite}
                  disabled={isSubmittingOverwrite}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg shadow-amber-900/30 disabled:opacity-50"
                >
                  {isSubmittingOverwrite ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Overwrite</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-zinc-100">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                Delete "{deleteTarget.name}"?
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                This will permanently delete this simulation save from your Supabase cloud storage. This action cannot be undone.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmittingDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-900/30 disabled:opacity-50"
                >
                  {isSubmittingDelete ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Delete Save</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

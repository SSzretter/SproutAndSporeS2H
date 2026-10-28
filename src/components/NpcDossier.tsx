import React, { useState, useMemo } from 'react';
import { 
  User, 
  Briefcase, 
  Sprout, 
  Wrench, 
  Scissors, 
  Home, 
  ClipboardList, 
  Package, 
  Droplets, 
  Zap, 
  Thermometer, 
  Activity, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  ArrowRightLeft, 
  Play, 
  Pause, 
  Coffee, 
  Sparkles, 
  Clock, 
  Shield, 
  Sliders, 
  Search,
  Check,
  ChevronRight,
  Flame,
  Award
} from 'lucide-react';
import { 
  PersonItem, 
  PersonRole, 
  PersonActivity, 
  Room, 
  Tent, 
  HarvestRecord, 
  NpcInventoryItem, 
  NpcActionLogEntry 
} from '../types/sim';
import { 
  ROLE_METADATA, 
  ensurePersonNpcFields, 
  executeNpcDirective, 
  transferNpcHarvestsToFacility,
  getDefaultNpcInventory,
  getDefaultWorkerSettings
} from '../utils/npcWorker';

interface NpcDossierProps {
  person: PersonItem;
  room: Room;
  selectedParentTentId?: string | null;
  onUpdatePerson: (updated: PersonItem) => void;
  onUpdateRoom?: (updatedRoom: Room) => void;
  onAddHarvestsToFacility?: (harvests: HarvestRecord[]) => void;
  simTime?: number;
}

export const NpcDossier: React.FC<NpcDossierProps> = ({
  person: initialPerson,
  room,
  selectedParentTentId,
  onUpdatePerson,
  onUpdateRoom,
  onAddHarvestsToFacility,
  simTime = Date.now()
}) => {
  const person = ensurePersonNpcFields(initialPerson);
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'inventory' | 'settings'>('overview');
  const [logFilter, setLogFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const roleMeta = ROLE_METADATA[person.role] || ROLE_METADATA.resident;

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Switch role handler
  const handleRoleChange = (newRole: PersonRole) => {
    const meta = ROLE_METADATA[newRole];
    const updated: PersonItem = {
      ...person,
      role: newRole,
      customTitle: meta.title,
      workerSettings: getDefaultWorkerSettings(newRole),
      shirtColor: meta.shirtColor,
      hatColor: meta.hatColor,
      activity: meta.defaultActivity,
      currentAction: newRole === 'resident' ? 'Resting in facility space' : 'On standby for duties',
      actionLog: [
        {
          id: `act-role-${Date.now()}`,
          timestamp: simTime,
          actionType: 'patrol',
          title: `Role Reassigned to ${meta.title}`,
          details: `Worker role changed to ${meta.badge}. New autonomous task profile active.`,
          result: 'info'
        },
        ...(person.actionLog || [])
      ]
    };
    onUpdatePerson(updated);
    showFeedback(`Role changed to ${meta.title}`);
  };

  // Toggle autonomous work
  const handleToggleAutoWork = () => {
    const curSettings = person.workerSettings || getDefaultWorkerSettings(person.role);
    const updated: PersonItem = {
      ...person,
      workerSettings: {
        ...curSettings,
        autoWork: !curSettings.autoWork
      }
    };
    onUpdatePerson(updated);
  };

  // Dispatch manual directive
  const handleDirective = (directive: 'water_all' | 'service_equipment' | 'harvest_all' | 'take_break') => {
    const res = executeNpcDirective(person, directive, room, simTime);
    onUpdatePerson(res.updatedPerson);
    if (onUpdateRoom) {
      onUpdateRoom(res.updatedRoom);
    }
    if (res.harvests && res.harvests.length > 0 && onAddHarvestsToFacility) {
      // Prompt user or keep in personal bag
    }
    showFeedback(res.message);
  };

  // Transfer harvests from worker's bag to facility
  const handleTransferHarvests = () => {
    const res = transferNpcHarvestsToFacility(person);
    if (res.transferredCount === 0) {
      showFeedback('No harvested crops in inventory to transfer.');
      return;
    }
    onUpdatePerson(res.updatedPerson);
    if (onAddHarvestsToFacility) {
      onAddHarvestsToFacility(res.harvests);
    }
    showFeedback(`Transferred ${res.transferredCount} harvest bundle(s) to facility harvest storage!`);
  };

  // Filtered action logs
  const filteredLogs = useMemo(() => {
    const logs = person.actionLog || [];
    return logs.filter(log => {
      if (logFilter !== 'all' && log.actionType !== logFilter) return false;
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase();
        return (
          log.title.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          (log.targetName && log.targetName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [person.actionLog, logFilter, logSearch]);

  // Inventory stats
  const invItems = person.inventory?.items || [];
  const harvestItems = invItems.filter(i => i.type === 'harvest');
  const toolItems = invItems.filter(i => i.type === 'tool' || i.type === 'supply');
  const totalHarvestGrams = harvestItems.reduce((acc, it) => acc + (it.quantity || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Banner & Profile Header */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Visual Avatar Emblem */}
            <div 
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border shadow-lg relative shrink-0 transition-transform hover:scale-105"
              style={{ 
                backgroundColor: `${person.shirtColor || '#7c3aed'}25`, 
                borderColor: `${person.shirtColor || '#7c3aed'}60` 
              }}
            >
              <User 
                className="w-7 h-7 sm:w-8 sm:h-8" 
                style={{ color: person.shirtColor || '#a855f7' }} 
              />
              <span className="absolute -bottom-1 -right-1 text-base sm:text-lg">
                {person.role === 'resident' ? '🏡' : person.role === 'grower' ? '🌱' : person.role === 'technician' ? '🔧' : person.role === 'harvester' ? '✂️' : '🧹'}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-100 tracking-tight">{person.name}</h3>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${roleMeta.color}`}>
                  {roleMeta.badge}
                </span>
                {person.workerSettings?.autoWork && person.role !== 'resident' && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Auto-Tending Active
                  </span>
                )}
              </div>
              
              <div className="text-xs text-zinc-400 mt-0.5 flex flex-wrap items-center gap-2">
                <span>{person.customTitle || roleMeta.title}</span>
                <span>•</span>
                <span className="text-zinc-500">
                  {selectedParentTentId ? `Inside Tent` : `Room Floor`}
                </span>
                <span>•</span>
                <span className="text-violet-400 font-mono">+{person.co2RateLitersPerHour} L/h CO₂</span>
              </div>
            </div>
          </div>

          {/* Quick Directives & Action Banner */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            {person.role !== 'resident' && (
              <button
                type="button"
                onClick={handleToggleAutoWork}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  person.workerSettings?.autoWork
                    ? 'bg-emerald-950/80 border-emerald-600/80 text-emerald-300 hover:bg-emerald-900/80'
                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title="Toggle autonomous work routine on simulation ticks"
              >
                {person.workerSettings?.autoWork ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Work</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Work</span>
                  </>
                )}
              </button>
            )}

            {harvestItems.length > 0 && (
              <button
                type="button"
                onClick={handleTransferHarvests}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all shadow-sm"
                title="Transfer gathered harvests to facility storage"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Deposit Harvests ({harvestItems.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Live "Doing Right Now" Status Bar */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 font-medium">Currently:</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-200 font-medium shadow-inner">
              <span className={`w-2 h-2 rounded-full ${person.currentAction?.startsWith('Standby') || person.currentAction?.startsWith('Monitoring') || person.currentAction?.startsWith('Inspecting') || person.currentAction?.startsWith('Resting') ? 'bg-emerald-400' : 'bg-cyan-400 animate-ping'}`} />
              <span>{person.currentAction || 'Inspecting grow room environment'}</span>
            </div>
          </div>

          {actionFeedback && (
            <div className="text-xs font-medium text-emerald-400 animate-in fade-in flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{actionFeedback}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
        {[
          { id: 'overview', label: 'Role & Directives', icon: Briefcase },
          { id: 'actions', label: `Action Log (${person.actionLog?.length || 0})`, icon: ClipboardList },
          { id: 'inventory', label: `Personal Bag (${invItems.length})`, icon: Package },
          { id: 'settings', label: 'Metabolic & Tuning', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & ROLE SELECTION */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Role Selection Grid */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Assigned Occupation &amp; Facility Role
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Select how this person behaves inside the facility and what tasks they prioritize.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(Object.keys(ROLE_METADATA) as PersonRole[]).map(r => {
                const meta = ROLE_METADATA[r];
                const isSelected = person.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleChange(r)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-zinc-900 border-violet-500 ring-1 ring-violet-500 shadow-md'
                        : 'bg-zinc-950/90 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                        <span>{meta.badge.split(' ')[0]}</span>
                        <span>{meta.badge.split(' ').slice(1).join(' ')}</span>
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-violet-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual Task Directives Grid */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Immediate Directives &amp; Work Orders
              </h4>
              <p className="text-[11px] text-zinc-400">
                Command {person.name} to execute a facility round right now.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleDirective('water_all')}
                className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-700/80 hover:border-cyan-500/50 text-left transition-all group"
              >
                <div className="flex items-center gap-2 text-cyan-400 mb-1">
                  <Droplets className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Water All Crops</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Hydrate all dry plants and mist mushrooms in the facility.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDirective('service_equipment')}
                className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-700/80 hover:border-amber-500/50 text-left transition-all group"
              >
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <Wrench className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Service Hardware</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Refill humidifier water and empty dehumidifier drain buckets.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDirective('harvest_all')}
                className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-700/80 hover:border-emerald-500/50 text-left transition-all group"
              >
                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                  <Scissors className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Harvest Ready</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Cut and bag all mature flowering plants and mushrooms into sack.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDirective('take_break')}
                className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-700/80 hover:border-purple-500/50 text-left transition-all group"
              >
                <div className="flex items-center gap-2 text-purple-400 mb-1">
                  <Coffee className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Take a Break</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Rest in living quarters, drink coffee, and recover stamina.
                </p>
              </button>
            </div>
          </div>

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Recent Actions Logged</span>
                <span className="font-mono text-zinc-200 font-bold">{person.actionLog?.length || 0}</span>
              </div>
              <div className="text-[11px] text-zinc-500">
                Logged watering, refills, harvests, and checkups.
              </div>
            </div>

            <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Harvests in Bag</span>
                <span className="font-mono text-emerald-400 font-bold">{harvestItems.length} ({totalHarvestGrams}g)</span>
              </div>
              <div className="text-[11px] text-zinc-500">
                Fresh cut crops ready to transfer to master facility log.
              </div>
            </div>

            <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Biological Exhalation</span>
                <span className="font-mono text-violet-400 font-bold">+{person.co2RateLitersPerHour} L/h CO₂</span>
              </div>
              <div className="text-[11px] text-zinc-500">
                Enriches room carbon dioxide naturally without gas bottles.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTION LOG ("What they have done & are doing") */}
      {activeTab === 'actions' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-zinc-950/80 border border-zinc-800 p-2.5 rounded-xl">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Actions' },
                { id: 'water', label: '💧 Watering' },
                { id: 'mist', label: '🌫️ Misting' },
                { id: 'refill_humidifier', label: '🔧 Equipment' },
                { id: 'harvest', label: '✂️ Harvests' },
                { id: 'patrol', label: '🚶 Duties' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLogFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    logFilter === f.id
                      ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-sm'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search action logs..."
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-zinc-900 border border-zinc-700/80 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Action Log List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center bg-zinc-950/40 border border-zinc-800/80 rounded-xl">
                <ClipboardList className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-medium">No recorded actions matching your filter.</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  As the simulation runs or when you issue work directives, this person's tasks are recorded here.
                </p>
              </div>
            ) : (
              filteredLogs.map(log => {
                const isWater = log.actionType === 'water';
                const isMist = log.actionType === 'mist';
                const isHardware = log.actionType === 'refill_humidifier' || log.actionType === 'empty_dehumidifier' || log.actionType === 'adjust_equipment';
                const isHarvest = log.actionType === 'harvest';
                const isFeed = log.actionType === 'feed';

                const icon = isWater ? '💧' : isMist ? '🌫️' : isHardware ? '🔧' : isHarvest ? '✂️' : isFeed ? '🧪' : '📋';
                const badgeColor = isHarvest 
                  ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300' 
                  : isWater 
                  ? 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300' 
                  : isHardware 
                  ? 'bg-amber-950/80 border-amber-700/60 text-amber-300' 
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300';

                const timeFormatted = new Date(log.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800/90 hover:border-zinc-700 transition-all flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm shrink-0">
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-200">{log.title}</span>
                          {log.locationName && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                              {log.locationName}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                          {timeFormatted}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PERSONAL INVENTORY ("Tools & Harvests") */}
      {activeTab === 'inventory' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Top Capacity & Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-950/80 border border-zinc-800 p-3.5 rounded-xl">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Carried Gear &amp; Harvest Satchel
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {invItems.length} / {person.inventory?.maxSlots || 16} Slots
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Workers carry tools to tend crops and bag harvested yields in their inventory.
              </p>
            </div>

            {harvestItems.length > 0 && (
              <button
                type="button"
                onClick={handleTransferHarvests}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transfer {harvestItems.length} Harvest(s) to Facility Storage ({totalHarvestGrams}g)</span>
              </button>
            )}
          </div>

          {/* Harvested Crops Section */}
          {harvestItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Scissors className="w-3.5 h-3.5" />
                <span>Gathered Crop Yields (In Bag)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {harvestItems.map(item => {
                  const rec = item.harvestRecord;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-emerald-900/50 hover:border-emerald-700/80 transition-all flex items-center justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{item.icon || '🌿'}</span>
                        <div>
                          <div className="text-xs font-bold text-zinc-100">{item.name}</div>
                          <div className="text-[11px] text-zinc-400">
                            {rec?.quality && (
                              <span className="text-amber-400 font-semibold mr-1.5">★ {rec.quality}</span>
                            )}
                            <span>{rec?.species || 'Crop'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-mono font-bold text-emerald-400 block">
                          +{item.quantity || 0}g
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          {rec?.originTentName || 'Facility'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tools & Equipment Carried */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
              <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
              <span>Equipped Tools &amp; Supplies</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {toolItems.map(item => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all flex items-start gap-3"
                >
                  <span className="text-xl p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
                    {item.icon || '🛠️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-200">{item.name}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                      {item.description || 'Worker maintenance equipment.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: METABOLIC & TUNING */}
      {activeTab === 'settings' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Autonomous Worker Triggers & Thresholds */}
          {person.role !== 'resident' && (
            <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Autonomous Work Triggers
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Fine-tune the moisture and hardware thresholds that trigger this worker.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1">
                    <span>Water Soil Below</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {person.workerSettings?.waterThresholdPct || 45}% Moisture
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="65"
                    step="5"
                    value={person.workerSettings?.waterThresholdPct || 45}
                    onChange={e => {
                      const val = Number(e.target.value);
                      onUpdatePerson({
                        ...person,
                        workerSettings: {
                          ...(person.workerSettings || getDefaultWorkerSettings(person.role)),
                          waterThresholdPct: val
                        }
                      });
                    }}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Worker waters potted plants when moisture drops below this value.
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1">
                    <span>Refill Humidifiers Below</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {person.workerSettings?.refillHumidifierBelowL || 2.0} Liters
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.5"
                    value={person.workerSettings?.refillHumidifierBelowL || 2.0}
                    onChange={e => {
                      const val = Number(e.target.value);
                      onUpdatePerson({
                        ...person,
                        workerSettings: {
                          ...(person.workerSettings || getDefaultWorkerSettings(person.role)),
                          refillHumidifierBelowL: val
                        }
                      });
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Worker fetches RO water when humidifier reservoir gets this low.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Respiration & Biological Exhalation */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Biological Respiration &amp; Exhalation
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>CO₂ Exhalation</span>
                  <span className="font-mono font-bold text-violet-400">{person.co2RateLitersPerHour} L/hr</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Adds natural carbon dioxide to the space during cellular respiration.
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Body Heat</span>
                  <span className="font-mono font-bold text-amber-400">{person.heatOutputWatts} Watts</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Thermal radiation contributes sensible heat to the thermal balance.
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>Moisture Emission</span>
                  <span className="font-mono font-bold text-cyan-400">{person.moistureLitersPerDay} L/day</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Exhaled breath vapor gently humidifies the air.
                </div>
              </div>
            </div>

            {/* Activity Level Selector */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-zinc-200 block mb-2">
                Physical Exertion Level:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { level: 'resting', label: 'Resting / Seated', co2: 15, watts: 75, moisture: 0.8 },
                  { level: 'normal', label: 'Normal Inspection', co2: 22, watts: 100, moisture: 1.2 },
                  { level: 'active', label: 'Active Trellising', co2: 32, watts: 140, moisture: 1.8 },
                  { level: 'exercising', label: 'Heavy Exertion', co2: 50, watts: 210, moisture: 2.5 },
                ].map(spec => (
                  <button
                    key={spec.level}
                    type="button"
                    onClick={() => {
                      onUpdatePerson({
                        ...person,
                        activity: spec.level as PersonActivity,
                        co2RateLitersPerHour: spec.co2,
                        heatOutputWatts: spec.watts,
                        moistureLitersPerDay: spec.moisture
                      });
                    }}
                    className={`p-2.5 rounded-xl text-xs text-left border transition-all ${
                      person.activity === spec.level
                        ? 'bg-violet-950 border-violet-500 text-violet-200 ring-1 ring-violet-500'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <span className="font-semibold block">{spec.label}</span>
                    <span className="font-mono text-[10px] text-zinc-400 block mt-0.5">
                      {spec.co2} L/h · {spec.watts}W
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

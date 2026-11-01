import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  ChevronUp, 
  ChevronDown, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Sparkles, 
  Filter, 
  Search, 
  Plus, 
  Trash2, 
  Download,
  FileText,
  Clock,
  X
} from 'lucide-react';
import { JournalEntry, JournalCategory } from '../types/sim';

interface GrowJournalProps {
  entries: JournalEntry[];
  simTime?: number;
  onAddEntry?: (entry: { title: string; message: string; type: JournalEntry['type']; category: JournalCategory }) => void;
  onClearEntries?: () => void;
}

export const GrowJournal: React.FC<GrowJournalProps> = ({ 
  entries, 
  simTime = Date.now(),
  onAddEntry, 
  onClearEntries 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // New Note Form State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteMessage, setNoteMessage] = useState('');
  const [noteCategory, setNoteCategory] = useState<JournalCategory>('note');
  const [noteType, setNoteType] = useState<JournalEntry['type']>('action');

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getIcon = (type: JournalEntry['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'action': return <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      default: return <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
  };

  const getCategoryBadge = (cat?: JournalCategory) => {
    switch (cat) {
      case 'crop':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">Crop</span>;
      case 'care':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-950/60 text-sky-400 border border-sky-800/40">Care</span>;
      case 'automation':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-950/60 text-purple-400 border border-purple-800/40">Auto</span>;
      case 'alert':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-950/60 text-amber-400 border border-amber-800/40">Alert</span>;
      case 'note':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-950/60 text-blue-400 border border-blue-800/40">Note</span>;
      default:
        return null;
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      // Category filter
      if (activeCategory !== 'all' && e.category !== activeCategory) {
        // Fallback: if category is not explicitly set, match by type
        if (activeCategory === 'alert' && e.type !== 'warning') return false;
        if (activeCategory === 'care' && e.type !== 'action') return false;
        if (activeCategory !== 'alert' && activeCategory !== 'care') return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.message.toLowerCase().includes(q) ||
          (e.tentName && e.tentName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [entries, activeCategory, searchQuery]);

  const handleAddCustomNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    if (onAddEntry) {
      onAddEntry({
        title: noteTitle.trim(),
        message: noteMessage.trim() || 'Grower observation logged.',
        type: noteType,
        category: noteCategory
      });
    }

    setNoteTitle('');
    setNoteMessage('');
    setIsNoteModalOpen(false);
  };

  const handleExportJournal = () => {
    const textContent = entries
      .map(e => `[${new Date(e.time).toISOString()}] [${(e.category || e.type).toUpperCase()}] ${e.title}\n${e.message}\n`)
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprout_spore_grow_journal_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between text-left hover:bg-zinc-850/30 transition-colors">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-zinc-200">Grow Log &amp; Event Journal</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
            {entries.length} Entries
          </span>
          <span className="hidden sm:inline text-[11px] text-zinc-500 ml-2">
            Tracks germination, flowering, watering, controller triggers &amp; custom grower logs
          </span>
        </button>

        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          {onAddEntry && (
            <button
              onClick={() => {
                setIsOpen(true);
                setIsNoteModalOpen(true);
              }}
              className="px-2 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              title="Add a custom grower observation note"
            >
              <Plus className="w-3 h-3" />
              <span>+ Add Note</span>
            </button>
          )}

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-zinc-800 p-3 bg-zinc-950/40 space-y-2.5">
          {/* Controls Bar: Categories & Search */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Events' },
                { id: 'crop', label: '🌱 Crops' },
                { id: 'care', label: '💧 Care' },
                { id: 'automation', label: '⚙️ Auto' },
                { id: 'alert', label: '⚠️ Alerts' },
                { id: 'note', label: '📝 Notes' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                    activeCategory === cat.id
                      ? 'bg-emerald-600 text-zinc-950 font-bold'
                      : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Search journal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-6 pr-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-36 sm:w-48"
                />
              </div>

              <button
                onClick={handleExportJournal}
                className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Export Journal to TXT file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {onClearEntries && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all journal entries?')) {
                      onClearEntries();
                    }
                  }}
                  className="p-1.5 rounded-lg bg-zinc-850 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 transition-colors"
                  title="Clear Journal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Entries Feed */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs pr-1">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-xs">
                No journal entries matching filter.
              </div>
            ) : (
              filteredEntries.slice().reverse().map(e => (
                <div
                  key={e.id}
                  className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors flex items-start gap-2.5"
                >
                  <div className="mt-0.5">{getIcon(e.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-zinc-200 text-xs">{e.title}</span>
                        {getCategoryBadge(e.category)}
                        {e.tentName && (
                          <span className="text-[10px] text-zinc-500 font-mono">[{e.tentName}]</span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                        {formatTime(e.time)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{e.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Custom Grower Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-zinc-100">Log Grower Observation</h3>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomNote} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Title / Milestone</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Topped main colas, LST ties adjusted"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['note', 'care', 'crop'] as JournalCategory[]).map(cat => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setNoteCategory(cat)}
                      className={`py-1.5 rounded-lg border font-medium capitalize text-center ${
                        noteCategory === cat
                          ? 'bg-emerald-600 text-zinc-950 border-emerald-500 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Notes / Observations</label>
                <textarea
                  rows={3}
                  placeholder="Record light distance, odor development, trichome clarity, nutrient ppm adjustments..."
                  value={noteMessage}
                  onChange={(e) => setNoteMessage(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

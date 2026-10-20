import React, { useState } from 'react';
import { BookOpen, ChevronUp, ChevronDown, AlertTriangle, Info, CheckCircle2, Sparkles } from 'lucide-react';
import { JournalEntry } from '../types/sim';

interface GrowJournalProps {
  entries: JournalEntry[];
}

export const GrowJournal: React.FC<GrowJournalProps> = ({ entries }) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getIcon = (type: JournalEntry['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'action': return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
      default: return <Info className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-zinc-850/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-zinc-200">Grow Log &amp; Event Journal</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
            {entries.length} Entries
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          <span>{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3 border-t border-zinc-800 max-h-48 overflow-y-auto space-y-2 text-xs">
          {entries.slice().reverse().map(e => (
            <div
              key={e.id}
              className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-850 flex items-start gap-2.5"
            >
              <div className="mt-0.5">{getIcon(e.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-200 text-xs truncate">{e.title}</span>
                  <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">{formatTime(e.time)}</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{e.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { Cloud, UserCheck, LogIn } from 'lucide-react';
import { User } from '@supabase/supabase-js';

interface CloudAccountButtonProps {
  currentUser: User | null;
  onClick: () => void;
}

export const CloudAccountButton: React.FC<CloudAccountButtonProps> = ({
  currentUser,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
        currentUser
          ? 'bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 hover:bg-emerald-900/60 shadow-sm'
          : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300'
      }`}
      title={currentUser ? `Cloud connected: ${currentUser.email}` : 'Sign in to Supabase to manage & sync cloud saves'}
    >
      <div className="relative flex items-center justify-center">
        <Cloud className="w-3.5 h-3.5" />
        {currentUser && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-pulse" />
        )}
      </div>

      <span className="max-w-[120px] sm:max-w-[160px] truncate">
        {currentUser ? (
          currentUser.email ? currentUser.email.split('@')[0] : 'Cloud Active'
        ) : (
          'Cloud Saves'
        )}
      </span>
    </button>
  );
};

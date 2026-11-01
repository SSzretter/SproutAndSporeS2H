import React from 'react';
import { getVpdZone } from '../utils/physics';

interface VpdBadgeProps {
  vpd: number;
  target?: 'plant' | 'mushroom';
  showDetails?: boolean;
}

export const VpdBadge: React.FC<VpdBadgeProps> = ({ vpd, target = 'plant', showDetails = false }) => {
  const { label, color, bgColor, description } = getVpdZone(vpd, target);

  return (
    <div className="inline-flex flex-col">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgColor} ${color}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        <span className="font-semibold">{vpd.toFixed(2)} kPa</span>
        <span className="opacity-80">· {label}</span>
      </div>
      {showDetails && (
        <span className="text-[11px] text-zinc-400 mt-1 max-w-[200px] leading-tight">
          {description}
        </span>
      )}
    </div>
  );
};

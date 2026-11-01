import React from 'react';

/**
 * Number field that lets you type freely and only applies the value on blur or Enter, clamped to
 * [min, max]. A controlled input that clamps on every keystroke turns "clear, then type 3" into 1
 * and then 13 → max, so small integer fields become impossible to edit.
 */
export const CommitNumberInput: React.FC<{
  value: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  onCommit: (value: number) => void;
  className?: string;
}> = ({ value, min, max, step, integer, onCommit, className }) => {
  const commit = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = integer ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
    if (!Number.isFinite(parsed)) {
      e.target.value = String(value);
      return;
    }
    const next = Math.max(min, Math.min(max, parsed));
    e.target.value = String(next);
    if (next !== value) onCommit(next);
  };

  return (
    <input
      // Re-mount when the value changes from outside so the field shows it
      key={value}
      type="number"
      min={min}
      max={max}
      step={step ?? (integer ? 1 : 'any')}
      defaultValue={value}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={className}
    />
  );
};

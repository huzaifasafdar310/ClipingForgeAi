import React from 'react';
import { cn } from '@/lib/utils';

export type AspectRatio = '9:16' | '1:1' | '16:9';

interface AspectRatioSwitcherProps {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
}

export const AspectRatioSwitcher: React.FC<AspectRatioSwitcherProps> = ({
  value,
  onChange,
}) => {
  const ratios: Array<{ id: AspectRatio; label: string; iconClass: string }> = [
    { id: '9:16', label: '9:16 Portrait', iconClass: 'w-3.5 h-6' },
    { id: '1:1', label: '1:1 Square', iconClass: 'w-5 h-5' },
    { id: '16:9', label: '16:9 Landscape', iconClass: 'w-6 h-3.5' },
  ];

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
        Aspect Ratio Reframe
      </label>
      <div className="grid grid-cols-3 gap-2">
        {ratios.map((r) => {
          const isActive = value === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(r.id)}
              className={cn(
                'p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all',
                isActive
                  ? 'border-primary bg-primary/10 text-primary shadow-glow-sm'
                  : 'border-border-subtle bg-surface-2 text-muted-foreground hover:text-foreground hover:border-border-muted'
              )}
            >
              <div className={cn('border-2 border-current rounded-sm', r.iconClass)} />
              <span>{r.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

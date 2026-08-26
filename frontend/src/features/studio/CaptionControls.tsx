import React from 'react';
import { CaptionStyle } from '@/types/api';
import { cn } from '@/lib/utils';

interface CaptionControlsProps {
  currentStyle: CaptionStyle;
  fontSize: number;
  onStyleChange: (style: CaptionStyle) => void;
  onFontSizeChange: (size: number) => void;
}

export const CaptionControls: React.FC<CaptionControlsProps> = ({
  currentStyle,
  fontSize,
  onStyleChange,
  onFontSizeChange,
}) => {
  const presets: Array<{
    id: CaptionStyle;
    name: string;
    description: string;
    previewClass: string;
  }> = [
    {
      id: 'tiktok_pop',
      name: 'Hormozi Bold',
      description: 'Electric yellow, uppercase pop & glow',
      previewClass: 'bg-black text-primary font-black border border-primary/40',
    },
    {
      id: 'minimal',
      name: 'Minimalist Box',
      description: 'White text with dark translucent box',
      previewClass: 'bg-surface-3 text-white font-bold',
    },
    {
      id: 'bounce',
      name: 'Kinetic Cyber',
      description: 'Cyan italics, animated bounce scale',
      previewClass: 'bg-cyan-950 text-cyan-300 font-black italic border border-cyan-400/40',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Caption Presets */}
      <div className="space-y-2">
        <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
          Kinetic Caption Preset
        </label>
        <div className="space-y-2">
          {presets.map((preset) => {
            const isActive = currentStyle === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => onStyleChange(preset.id)}
                className={cn(
                  'p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3',
                  isActive
                    ? 'border-primary bg-primary/10 shadow-glow-sm'
                    : 'border-border-subtle bg-surface-2 hover:border-border-muted'
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-xs shrink-0',
                    preset.previewClass
                  )}
                >
                  Aa
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{preset.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {preset.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Font Size Slider */}
      <div className="space-y-2 pt-2 border-t border-border-subtle">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-foreground">Caption Font Size</span>
          <span className="font-mono text-primary font-semibold">{fontSize}px</span>
        </div>
        <input
          type="range"
          min="14"
          max="36"
          value={fontSize}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          className="w-full accent-primary cursor-pointer h-2 bg-surface-3 rounded-lg appearance-none"
        />
      </div>
    </div>
  );
};

import React from 'react';
import { Play, Pause } from 'lucide-react';
import { formatSecondsToTimestamp } from '@/lib/utils';

interface TimelineScrubberProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  segmentLabel?: string;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentTime,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  segmentLabel,
}) => {
  const safeDuration = Math.max(1, duration);
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(pct * safeDuration);
  };

  return (
    <div className="bg-surface-1 rounded-2xl border border-border-subtle p-3 space-y-2">
      {/* Time & Segment Header */}
      <div className="flex justify-between items-center text-xs font-mono">
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            className="w-7 h-7 rounded-lg bg-surface-2 hover:bg-primary hover:text-black flex items-center justify-center text-primary transition-colors border border-border-subtle"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>
          <div className="flex items-baseline gap-1">
            <span className="text-foreground font-bold">
              {formatSecondsToTimestamp(currentTime)}
            </span>
            <span className="text-muted-foreground">
              / {formatSecondsToTimestamp(safeDuration)}
            </span>
          </div>
        </div>

        {segmentLabel && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {segmentLabel}
          </span>
        )}
      </div>

      {/* Interactive Timeline Tracks */}
      <div
        onClick={handleTimelineClick}
        className="relative w-full h-12 bg-surface-0 rounded-xl overflow-hidden flex flex-col justify-between p-1.5 cursor-pointer border border-border-subtle group hover:border-border-muted transition-colors"
      >
        {/* Progress Fill Indicator */}
        <div
          style={{ width: `${progressPct}%` }}
          className="absolute top-0 bottom-0 left-0 bg-primary/20 border-r-2 border-primary pointer-events-none transition-all duration-75 shadow-glow-sm"
        />

        {/* Video Track */}
        <div className="h-4 bg-surface-2 rounded-lg flex items-center px-2 text-[9px] font-mono text-muted-foreground z-10">
          🎬 Video Track (9:16 Portrait)
        </div>

        {/* Audio / Subtitle Track */}
        <div className="h-4 bg-secondary/15 rounded-lg flex items-center px-2 text-[9px] font-mono text-secondary z-10">
          🔊 Audio & Synchronized Captions
        </div>
      </div>
    </div>
  );
};

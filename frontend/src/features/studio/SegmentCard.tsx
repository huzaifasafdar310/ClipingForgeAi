import React from 'react';
import { Flame } from 'lucide-react';
import { Clip } from '@/types/api';
import { cn, calculateViralScore } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface SegmentCardProps {
  clip: Clip;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}

export const SegmentCard: React.FC<SegmentCardProps> = ({
  clip,
  index,
  isActive,
  onSelect,
}) => {
  const viralScore = calculateViralScore(index);

  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-3.5 rounded-xl border cursor-pointer transition-all space-y-1.5',
        isActive
          ? 'bg-surface-2 border-primary shadow-glow-sm'
          : 'bg-surface-1 border-border-subtle hover:border-border-muted hover:bg-surface-2'
      )}
    >
      <div className="flex justify-between items-center text-[10px] font-mono">
        <Badge variant={isActive ? 'primary' : 'default'} className="gap-1 text-[10px]">
          <Flame className="w-3 h-3 fill-current" />
          <span>{viralScore}% Viral Hook</span>
        </Badge>
        <span className="text-muted-foreground">
          {clip.startTime} - {clip.endTime}
        </span>
      </div>

      <h4 className="text-xs font-bold text-foreground truncate">{clip.title}</h4>

      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
        {clip.reasoning || clip.description || 'AI highlighted conversational moment'}
      </p>
    </div>
  );
};

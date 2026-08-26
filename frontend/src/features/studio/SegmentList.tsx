import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Video as VideoIcon, Plus } from 'lucide-react';
import { Clip } from '@/types/api';
import { SegmentCard } from './SegmentCard';
import { Button } from '@/components/ui/Button';

interface SegmentListProps {
  clips: Clip[];
  activeClipId: number | null;
  onSelectClip: (clip: Clip) => void;
}

export const SegmentList: React.FC<SegmentListProps> = ({
  clips,
  activeClipId,
  onSelectClip,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-border-subtle p-4 overflow-y-auto space-y-3">
      <div className="flex justify-between items-center pb-3 border-b border-border-subtle shrink-0">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> AI Segments
          </h3>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            {clips.length} viral moment{clips.length !== 1 ? 's' : ''} detected
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-mono text-[10px] font-bold">
          AI Ranked
        </span>
      </div>

      <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
        {clips.length === 0 ? (
          <div className="p-6 rounded-2xl bg-surface-2 border border-border-subtle text-center space-y-3">
            <VideoIcon className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No active clips loaded.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/app')}
              className="w-full text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Analyze a Video</span>
            </Button>
          </div>
        ) : (
          clips.map((clip, index) => (
            <SegmentCard
              key={clip.id}
              clip={clip}
              index={index}
              isActive={clip.id === activeClipId}
              onSelect={() => onSelectClip(clip)}
            />
          ))
        )}
      </div>
    </div>
  );
};

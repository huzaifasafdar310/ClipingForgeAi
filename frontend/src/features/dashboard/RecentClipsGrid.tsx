import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Edit3, Download, Flame, Video as VideoIcon } from 'lucide-react';
import { Clip } from '@/types/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { calculateViralScore } from '@/lib/utils';

interface RecentClipsGridProps {
  clips: Clip[];
  onSelectClip: (clip: Clip) => void;
  isLoading?: boolean;
}

export const RecentClipsGrid: React.FC<RecentClipsGridProps> = ({
  clips,
  onSelectClip,
  isLoading,
}) => {
  const navigate = useNavigate();

  const handleDownload = (clipId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = api.getClipDownloadUrl(clipId);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clip_${clipId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-56 rounded-2xl bg-surface-1 animate-pulse border border-border-subtle" />
        ))}
      </div>
    );
  }

  if (!clips || clips.length === 0) {
    return (
      <Card className="p-8 text-center flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center text-muted-foreground">
          <VideoIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">No recent clips found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Submit a YouTube link or upload a local video above to extract clips.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {clips.slice(0, 4).map((clip, index) => {
        const viralScore = calculateViralScore(index);
        return (
          <Card
            key={clip.id}
            glow
            onClick={() => onSelectClip(clip)}
            className="overflow-hidden p-0 flex flex-col justify-between cursor-pointer group"
          >
            {/* Thumbnail / Video Preview Placeholder */}
            <div className="relative h-40 bg-surface-0 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-black/80 to-transparent z-10" />

              <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/40 group-hover:scale-110 transition-transform z-20 shadow-glow-sm">
                <Play className="w-5 h-5 fill-primary text-primary ml-0.5" />
              </div>

              {/* Badges */}
              <div className="absolute top-3 left-3 z-20">
                <Badge variant="primary" className="gap-1 shadow-md">
                  <Flame className="w-3 h-3 fill-primary text-primary" />
                  <span>{viralScore}% Viral</span>
                </Badge>
              </div>

              <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-white text-[10px] font-mono border border-white/10">
                {clip.startTime} - {clip.endTime}
              </div>
            </div>

            {/* Metadata & Actions */}
            <div className="p-4 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                  {clip.title}
                </h3>
                <p className="text-xs text-muted-foreground font-mono line-clamp-1 mt-0.5">
                  {clip.reasoning || clip.description || 'AI highlighted hook segment'}
                </p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-border-subtle text-xs">
                <Badge
                  variant={clip.status === 'completed' ? 'success' : 'default'}
                  className="uppercase text-[10px]"
                >
                  {clip.status || 'analyzed'}
                </Badge>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onSelectClip(clip)}
                    className="h-8 px-2.5 text-[11px]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => handleDownload(clip.id, e)}
                    className="h-8 px-2.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

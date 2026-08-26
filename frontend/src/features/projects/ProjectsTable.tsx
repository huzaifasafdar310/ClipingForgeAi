import React, { useState } from 'react';
import { Edit3, Download, Trash2, Video as VideoIcon } from 'lucide-react';
import { Clip } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

interface ProjectsTableProps {
  clips: Clip[];
  onOpenInStudio: (clip: Clip) => void;
  onClipsChanged?: () => void;
  isLoading?: boolean;
}

export const ProjectsTable: React.FC<ProjectsTableProps> = ({
  clips,
  onOpenInStudio,
  onClipsChanged,
  isLoading,
}) => {
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleDelete = async (clipId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this clip?')) return;
    
    setDeletingId(clipId);
    try {
      await api.deleteClip(clipId);
      onClipsChanged?.();
    } catch (err: any) {
      alert(`Could not delete clip: ${err?.message || err}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border-subtle p-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-surface-2 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!clips || clips.length === 0) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border-subtle p-12 text-center flex flex-col items-center justify-center space-y-3">
        <VideoIcon className="w-10 h-10 text-muted-foreground" />
        <div>
          <p className="text-sm font-bold text-foreground">No project clips found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Analyze a YouTube video or upload a video file to view clips here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 rounded-2xl border border-border-subtle overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-2 font-mono uppercase text-muted-foreground border-b border-border-subtle">
            <tr>
              <th className="p-4 font-semibold">Clip / Video</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Timestamps</th>
              <th className="p-4 font-semibold">Privacy</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle font-medium text-foreground">
            {clips.map((clip) => (
              <tr
                key={clip.id}
                onClick={() => onOpenInStudio(clip)}
                className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
              >
                {/* Clip details */}
                <td className="p-4 flex items-center gap-3">
                  <div className="w-10 h-8 rounded-lg bg-surface-0 flex items-center justify-center font-bold text-primary border border-border-subtle text-[10px] shrink-0">
                    9:16
                  </div>
                  <div className="min-w-0 max-w-xs sm:max-w-md">
                    <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {clip.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                      {clip.reasoning || clip.description || ''}
                    </p>
                  </div>
                </td>

                {/* Status */}
                <td className="p-4">
                  <Badge
                    variant={clip.status === 'completed' ? 'success' : 'default'}
                    className="uppercase text-[10px]"
                  >
                    {clip.status || 'analyzed'}
                  </Badge>
                </td>

                {/* Timestamps */}
                <td className="p-4 font-mono text-muted-foreground text-[11px]">
                  {clip.startTime} - {clip.endTime}
                </td>

                {/* Privacy */}
                <td className="p-4 font-mono text-muted-foreground text-[11px] uppercase">
                  {clip.privacyStatus || 'public'}
                </td>

                {/* Actions */}
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInStudio(clip);
                      }}
                      className="h-8 px-2.5 text-xs font-semibold"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      title="Download MP4"
                      onClick={(e) => handleDownload(clip.id, e)}
                      className="h-8 px-2.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete Clip"
                      disabled={deletingId === clip.id}
                      onClick={(e) => handleDelete(clip.id, e)}
                      className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

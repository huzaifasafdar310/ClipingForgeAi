import React, { useState, useEffect } from 'react';
import { Download, UploadCloud, Undo, Share2 } from 'lucide-react';
import { Clip, CaptionStyle } from '@/types/api';
import { AspectRatio, AspectRatioSwitcher } from './AspectRatioSwitcher';
import { SegmentList } from './SegmentList';
import { VideoPlayer } from './VideoPlayer';
import { TimelineScrubber } from './TimelineScrubber';
import { CaptionControls } from './CaptionControls';
import { MetadataEditor } from './MetadataEditor';
import { ExportModal } from './ExportModal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface StudioEditorProps {
  clips: Clip[];
  initialActiveClipId?: number | null;
  onClipsUpdated?: (clips: Clip[]) => void;
  onStartUploadJob?: (clips: Clip[]) => void;
}

export const StudioEditor: React.FC<StudioEditorProps> = ({
  clips: initialClips,
  initialActiveClipId,
  onClipsUpdated,
  onStartUploadJob,
}) => {
  const { isAuthenticated, login } = useAuth();
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [activeClipId, setActiveClipId] = useState<number | null>(
    initialActiveClipId || (initialClips.length > 0 ? initialClips[0].id : null)
  );

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('tiktok_pop');
  const [fontSize, setFontSize] = useState<number>(22);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);

  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Sync incoming clips
  useEffect(() => {
    setClips(initialClips);
    if (!activeClipId && initialClips.length > 0) {
      setActiveClipId(initialClips[0].id);
    }
  }, [initialClips]);

  const activeClip = clips.find((c) => c.id === activeClipId) || (clips.length > 0 ? clips[0] : null);

  // Update active clip caption style in DB
  const handleCaptionStyleChange = async (style: CaptionStyle) => {
    setCaptionStyle(style);
    if (activeClip) {
      const updatedClips = clips.map((c) =>
        c.id === activeClip.id ? { ...c, caption_style: style } : c
      );
      setClips(updatedClips);
      onClipsUpdated?.(updatedClips);

      try {
        await api.updateClipCaptionStyle(activeClip.id, { caption_style: style });
      } catch (err) {
        console.warn('Caption style sync note:', err);
      }
    }
  };

  const handleUpdateClipMetadata = (updates: Partial<Clip>) => {
    if (!activeClip) return;
    const updatedClips = clips.map((c) =>
      c.id === activeClip.id ? { ...c, ...updates } : c
    );
    setClips(updatedClips);
    onClipsUpdated?.(updatedClips);
  };

  const handleDirectDownload = () => {
    if (!activeClip) return;
    const url = api.getClipDownloadUrl(activeClip.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clip_${activeClip.id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePostToYouTube = () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    if (activeClip && onStartUploadJob) {
      onStartUploadJob([activeClip]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-96px)] bg-surface-1 border border-border-subtle rounded-3xl overflow-hidden shadow-2xl">
      {/* Top Action Bar */}
      <div className="h-14 bg-surface-2 border-b border-border-subtle px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono bg-surface-0 px-3 py-1 rounded-lg text-primary border border-border-subtle font-bold">
            {aspectRatio} Reframe
          </span>
          <span className="text-xs font-bold text-foreground hidden md:inline truncate max-w-sm">
            {activeClip?.title || 'Clip Studio Workspace'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDirectDownload}
            disabled={!activeClip}
            className="text-xs font-mono"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download MP4</span>
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={handlePostToYouTube}
            disabled={!activeClip}
            className="text-xs font-bold"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Post to YouTube</span>
          </Button>
        </div>
      </div>

      {/* 3-Column Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-surface-0">
        {/* Left Column: Segments List (3 Cols) */}
        <div className="lg:col-span-3 h-full overflow-hidden">
          <SegmentList
            clips={clips}
            activeClipId={activeClip?.id || null}
            onSelectClip={(c) => {
              setActiveClipId(c.id);
              setCurrentTime(0);
              setIsPlaying(false);
            }}
          />
        </div>

        {/* Center Column: Video Stage & Timeline (6 Cols) */}
        <div className="lg:col-span-6 flex flex-col justify-between p-4 overflow-hidden bg-surface-0/60 border-r border-border-subtle">
          <VideoPlayer
            clip={activeClip}
            aspectRatio={aspectRatio}
            captionStyle={captionStyle}
            fontSize={fontSize}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onDurationChange={(d) => setDuration(d)}
          />

          <TimelineScrubber
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSeek={(t) => {
              setCurrentTime(t);
            }}
            segmentLabel={
              activeClip ? `Segment: ${activeClip.startTime} - ${activeClip.endTime}` : undefined
            }
          />
        </div>

        {/* Right Column: Properties & Caption Customizer (3 Cols) */}
        <div className="lg:col-span-3 h-full bg-surface-1 p-4 overflow-y-auto space-y-5">
          <AspectRatioSwitcher
            value={aspectRatio}
            onChange={(r) => setAspectRatio(r)}
          />

          <CaptionControls
            currentStyle={captionStyle}
            fontSize={fontSize}
            onStyleChange={handleCaptionStyleChange}
            onFontSizeChange={(size) => setFontSize(size)}
          />

          {activeClip && (
            <MetadataEditor
              clip={activeClip}
              onUpdate={handleUpdateClipMetadata}
            />
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        clip={activeClip}
        onDownload={handleDirectDownload}
        onUploadYouTube={handlePostToYouTube}
      />
    </div>
  );
};

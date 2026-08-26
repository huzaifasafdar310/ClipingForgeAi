import React, { useState, useRef } from 'react';
import { Sparkles, Link as LinkIcon, Upload, Bot } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface QuickIngestCardProps {
  onAnalyzeYoutube: (url: string, numClips: number, suffix: string) => void;
  onSelectLocalFile: (file: File, numClips: number) => void;
  isAnalyzing?: boolean;
}

export const QuickIngestCard: React.FC<QuickIngestCardProps> = ({
  onAnalyzeYoutube,
  onSelectLocalFile,
  isAnalyzing,
}) => {
  const [url, setUrl] = useState('');
  const [numClips, setNumClips] = useState(5);
  const [captionSuffix, setCaptionSuffix] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAnalyzeYoutube(url.trim(), numClips, captionSuffix.trim());
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSelectLocalFile(e.target.files[0], numClips);
    }
  };

  return (
    <div className="relative rounded-3xl overflow-hidden p-6 sm:p-10 border border-border-subtle shadow-2xl bg-gradient-to-b from-surface-2/70 to-surface-1">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/mov,video/avi,video/mkv,video/webm"
        className="hidden"
      />

      <div className="relative z-10 max-w-3xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary text-black flex items-center justify-center font-bold shadow-glow-sm">
          <Bot className="w-6 h-6" />
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-foreground">
          Generate viral clips in seconds.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Paste any YouTube URL or drop your local video file. ClipAI scores high-engagement segments, frames vertical 9:16 crops, and formats animated captions.
        </p>

        {/* URL Form */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative flex items-center">
              <span className="absolute left-3.5 text-muted-foreground">
                <LinkIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube link (e.g. https://www.youtube.com/watch?v=...)"
                disabled={isAnalyzing}
                className="w-full bg-surface-0 text-foreground text-sm rounded-xl py-3 pl-10 pr-4 border border-border-subtle outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={numClips}
                onChange={(e) => setNumClips(Number(e.target.value))}
                disabled={isAnalyzing}
                className="bg-surface-0 text-foreground text-xs font-mono rounded-xl py-3 px-3 border border-border-subtle outline-none focus:border-primary cursor-pointer disabled:opacity-50"
              >
                <option value={3}>3 Clips</option>
                <option value={5}>5 Clips</option>
                <option value={7}>7 Clips</option>
                <option value={10}>10 Clips</option>
              </select>

              <Button
                type="submit"
                isLoading={isAnalyzing}
                size="md"
                className="h-11 px-6 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                <span>Auto-Clip</span>
              </Button>
            </div>
          </div>

          {/* Suffix & Local Video Trigger */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs pt-1">
            <div className="flex-1 w-full flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                Optional Caption Suffix:
              </span>
              <input
                type="text"
                value={captionSuffix}
                onChange={(e) => setCaptionSuffix(e.target.value)}
                placeholder="e.g. Subscribe for part 2! #viral #fyp"
                disabled={isAnalyzing}
                className="w-full bg-surface-0 text-xs text-foreground rounded-lg py-1.5 px-3 border border-border-subtle outline-none focus:border-primary"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isAnalyzing}
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto h-9 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Or Upload Local Video</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Link as LinkIcon, Upload, ArrowRight, PlayCircle, Music, Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface LandingHeroProps {
  onAnalyzeYoutube: (url: string) => void;
  onSelectLocalFile: (file: File) => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onAnalyzeYoutube,
  onSelectLocalFile,
}) => {
  const [url, setUrl] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAnalyzeYoutube(url.trim());
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSelectLocalFile(e.target.files[0]);
    }
  };

  return (
    <section className="relative pt-32 pb-20 px-4 md:px-8 min-h-[90vh] flex flex-col items-center justify-center text-center overflow-hidden">
      {/* Background Gradients */}
      <div
        className="absolute inset-0 z-0 opacity-25 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(250,204,21,0.2) 0%, rgba(7,10,17,0) 70%)',
        }}
      />
      <div
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(241, 245, 249, 0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/mov,video/avi,video/mkv,video/webm"
        className="hidden"
      />

      <div className="relative z-10 max-w-4xl w-full mx-auto flex flex-col items-center gap-8">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          ClipAI 2.0 Live • AI Highlight Scoring & Kinetic Subtitles
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-foreground leading-[1.1] drop-shadow-md">
          1 long video,
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-yellow-200 to-secondary">
            10 viral clips.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl font-normal leading-relaxed">
          AI video intelligence that extracts high-retention hooks, crops speakers to 9:16 portrait, animates captions, and automates multi-platform short video publishing.
        </p>

        {/* Interactive Ingest Form */}
        <div className="w-full max-w-2xl flex flex-col gap-3">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center bg-surface-1/90 border border-border-muted rounded-2xl p-2 shadow-2xl focus-within:ring-2 focus-within:ring-primary transition-all"
          >
            <span className="text-muted-foreground ml-3 mr-2">
              <LinkIcon className="w-5 h-5" />
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube link (e.g. https://youtube.com/watch?v=...)"
              className="flex-1 bg-transparent border-none outline-none text-foreground text-sm sm:text-base placeholder:text-muted-foreground/50 h-12"
            />
            <Button type="submit" size="lg" className="shrink-0">
              <Sparkles className="w-4 h-4" />
              <span>Generate Clips</span>
            </Button>
          </form>

          {/* Supported Formats & Local File Trigger */}
          <div className="flex flex-wrap items-center justify-between text-xs font-mono text-muted-foreground px-2 gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <PlayCircle className="w-3.5 h-3.5 text-red-400" /> YouTube Shorts
              </span>
              <span className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-cyan-400" /> TikTok
              </span>
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-pink-400" /> Instagram Reels
              </span>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hover:text-primary underline underline-offset-4 flex items-center gap-1 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Or upload local MP4/MOV file
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

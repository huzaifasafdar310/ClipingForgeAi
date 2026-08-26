import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Flame, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const LiveDemoSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto space-y-24">
      {/* Demo 1: Smart Reframe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-mono rounded-full border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" /> AI Speaker Centering
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground leading-tight">
            Never manually crop horizontal footage again.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Our pipeline automatically tracks faces and conversational centerpoints, formatting 16:9 widescreen footage into high-fidelity 9:16 vertical video suitable for mobile feeds.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/app')}
            className="mt-2"
          >
            Launch Studio Workspace
          </Button>
        </div>

        <div className="bg-surface-1 rounded-3xl p-8 border border-border-muted shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="w-64 h-[360px] bg-black rounded-2xl border-2 border-primary/40 flex flex-col items-center justify-between p-4 shadow-glow-sm relative">
            <div className="flex justify-between items-center w-full z-10 text-[10px] font-mono text-primary">
              <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md">9:16 Vertical</span>
              <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md">1080x1920</span>
            </div>

            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400/20 to-yellow-600/30 border border-primary flex items-center justify-center my-auto animate-pulse">
              <span className="text-3xl font-black text-primary">AI</span>
            </div>

            <div className="bg-black/80 backdrop-blur-md p-2.5 rounded-xl border border-white/10 text-center w-full z-10">
              <p className="text-xs font-black uppercase text-primary drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">
                "THIS 1 TRICK SCALED MY CLIPS 10X!" 🔥
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Demo 2: Kinetic Subtitles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1 bg-surface-1 rounded-3xl p-8 border border-border-muted shadow-2xl flex flex-col items-center justify-center text-center relative">
          <div className="w-full py-16 px-4 bg-surface-0 rounded-2xl border border-border-subtle flex flex-col items-center justify-center gap-4">
            <span className="text-3xl sm:text-5xl font-black italic tracking-tight text-foreground">
              THIS IS <span className="text-primary drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">VIRAL</span> 🔥
            </span>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-xs text-primary font-mono font-bold">
                Hormozi Kinetic
              </span>
              <span className="px-3 py-1 bg-secondary/10 border border-secondary/30 rounded-full text-xs text-secondary font-mono font-bold">
                Whisper Timestamps
              </span>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary text-xs font-mono rounded-full border border-secondary/20">
            <Flame className="w-3.5 h-3.5" /> Kinetic Auto-Captions
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-foreground leading-tight">
            Subtitles that pop & keep viewers watching.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Whisper transcription generates millisecond word timestamps burned with hardware-accelerated FFmpeg ASS subtitle filters.
          </p>
          <Button
            size="lg"
            variant="cyan"
            onClick={() => navigate('/app')}
            className="mt-2"
          >
            Try Caption Presets
          </Button>
        </div>
      </div>
    </section>
  );
};

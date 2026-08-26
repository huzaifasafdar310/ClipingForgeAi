import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Film } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const CTAFooter: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer className="w-full py-20 bg-surface-0 border-t border-border-subtle text-center px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 p-2 rounded-2xl bg-surface-1 border border-border-subtle text-foreground text-xs font-mono">
          <Film className="w-4 h-4 text-primary" />
          <span>Automated AI Video Repurposing Pipeline</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-black text-foreground">
          Stop editing for hours. Start clipping today.
        </h2>

        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          AI highlight extraction, kinetic caption burn-in, and one-click YouTube Shorts publishing.
        </p>

        <Button
          size="lg"
          onClick={() => navigate('/app')}
          className="text-sm font-bold uppercase tracking-wider px-8 py-4 rounded-full shadow-glow hover:scale-105 transition-transform"
        >
          <span>Open Studio Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </Button>

        <div className="pt-8 border-t border-border-subtle text-xs font-mono text-muted-foreground">
          © {new Date().getFullYear()} ClipAI Studio. Powered by Groq LLaMA 3.3, Whisper & FFmpeg.
        </div>
      </div>
    </footer>
  );
};

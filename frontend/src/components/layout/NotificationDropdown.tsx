import React, { useState, useRef, useEffect } from 'react';
import { Bell, Sparkles, CheckCircle2 } from 'lucide-react';

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setHasUnread(false);
        }}
        className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground border border-border-subtle hover:border-border-muted transition-colors relative"
      >
        <Bell className="w-5 h-5" />
        {hasUnread && (
          <>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-1 border border-border-muted rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Notifications
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[10px] text-primary hover:underline font-mono"
            >
              Close
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">AI Highlight Engine Active</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Groq LLaMA 3.3 70B & Whisper ASR initialized for 45–60s Shorts.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">Range Streaming Enabled</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Direct segment slicing enabled via yt-dlp.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

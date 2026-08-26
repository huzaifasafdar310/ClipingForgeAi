import React from 'react';
import { Share2, PlayCircle, Music, Camera, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

interface PublishHubProps {
  onOpenConnectModal?: () => void;
}

export const PublishHub: React.FC<PublishHubProps> = ({ onOpenConnectModal }) => {
  const { isAuthenticated, login, isLoggingIn } = useAuth();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Share2 className="w-5 h-5 text-secondary" />
          <span>Publish Hub</span>
        </h2>
        {onOpenConnectModal && (
          <button
            onClick={onOpenConnectModal}
            className="text-xs font-mono text-primary hover:underline"
          >
            + Manage
          </button>
        )}
      </div>

      <Card className="space-y-4 p-5">
        {/* YouTube Shorts */}
        <div className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">YouTube Shorts</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                {isAuthenticated ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                    <span className="text-status-success font-mono">Connected</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span>Disconnected</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {isAuthenticated ? (
            <span className="text-[10px] font-mono text-status-success px-2 py-1 bg-status-success/15 rounded-lg border border-status-success/30 font-bold">
              Active
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={login}
              isLoading={isLoggingIn}
              className="text-[10px] font-mono font-bold h-7 px-2.5"
            >
              Connect
            </Button>
          )}
        </div>

        {/* TikTok Channel */}
        <div className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-between opacity-85">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-black text-white border border-border-muted flex items-center justify-center shadow-md">
              <Music className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">TikTok Creator</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Coming Soon</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-amber-400/90 px-2 py-1 bg-amber-400/10 rounded-lg border border-amber-400/25 font-bold">
            Coming Soon
          </span>
        </div>

        {/* Instagram Reels */}
        <div className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-between opacity-85">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-yellow-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Instagram Reels</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Coming Soon</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-amber-400/90 px-2 py-1 bg-amber-400/10 rounded-lg border border-amber-400/25 font-bold">
            Coming Soon
          </span>
        </div>

        {onOpenConnectModal && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenConnectModal}
            className="w-full text-xs font-mono uppercase tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add More Channels</span>
          </Button>
        )}
      </Card>
    </div>
  );
};

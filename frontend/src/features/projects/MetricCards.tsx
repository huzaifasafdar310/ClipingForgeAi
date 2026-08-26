import React from 'react';
import { Scissors, CheckCircle, Video as VideoIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface MetricCardsProps {
  totalClips: number;
  completedClips: number;
  totalProjects: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totalClips,
  completedClips,
  totalProjects,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Total Clips */}
      <Card className="p-5 space-y-2">
        <div className="flex justify-between items-center text-xs font-mono text-muted-foreground uppercase">
          <span>Total Clips Generated</span>
          <Scissors className="w-4 h-4 text-primary" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-foreground">{totalClips}</span>
          <span className="text-xs font-bold text-primary">Viral Highlights</span>
        </div>
        <div className="w-full h-8 pt-2">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 25">
            <path d="M0 20 Q 25 5, 50 15 T 100 4" fill="none" stroke="#facc15" strokeWidth="2.5" />
          </svg>
        </div>
      </Card>

      {/* Card 2: Completed Processing */}
      <Card className="p-5 space-y-2">
        <div className="flex justify-between items-center text-xs font-mono text-muted-foreground uppercase">
          <span>Completed Exports</span>
          <CheckCircle className="w-4 h-4 text-secondary" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-foreground">{completedClips}</span>
          <span className="text-xs font-bold text-secondary">Exported & Ready</span>
        </div>
        <div className="w-full h-8 flex items-end gap-1.5 pt-2">
          <div className="flex-1 bg-surface-3 h-3 rounded-t" />
          <div className="flex-1 bg-surface-3 h-5 rounded-t" />
          <div className="flex-1 bg-surface-3 h-4 rounded-t" />
          <div className="flex-1 bg-secondary h-8 rounded-t shadow-glow-cyan" />
          <div className="flex-1 bg-surface-3 h-6 rounded-t" />
          <div className="flex-1 bg-surface-3 h-7 rounded-t" />
        </div>
      </Card>

      {/* Card 3: Projects Count */}
      <Card className="p-5 space-y-2">
        <div className="flex justify-between items-center text-xs font-mono text-muted-foreground uppercase">
          <span>Total Video Projects</span>
          <VideoIcon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-foreground">{totalProjects}</span>
          <span className="text-xs font-bold text-primary">Source Jobs</span>
        </div>
        <div className="w-full h-8 pt-2">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 25">
            <path d="M0 15 Q 35 25, 70 8 T 100 18" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
          </svg>
        </div>
      </Card>
    </div>
  );
};

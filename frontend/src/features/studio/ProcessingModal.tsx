import React from 'react';
import { Bot, CheckCircle2, Loader2, Circle, AlertCircle, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  sourceLabel?: string;
  currentStep: number; // 1 to 4
  progress: number; // 0 to 100
  statusMessage: string;
  error?: string | null;
  onRetry?: () => void;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
  isOpen,
  onClose,
  title = 'ClipAI Neural Pipeline',
  sourceLabel,
  currentStep,
  progress,
  statusMessage,
  error,
  onRetry,
}) => {
  const steps = [
    { label: 'Downloading & Ingesting Stream (1080p60)' },
    { label: 'Whisper ASR: Transcribing Speech & Topic Spikes' },
    { label: 'Groq AI: Scoring Virality Hooks & Highlights' },
    { label: 'Formatting 9:16 Kinetic Subtitles & SEO Metadata' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={error ? onClose : () => {}}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-black flex items-center justify-center font-bold shadow-glow-sm">
            <Bot className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {sourceLabel && (
              <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                {sourceLabel}
              </p>
            )}
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep || progress === 100;
            const isCurrent = stepNum === currentStep && progress < 100 && !error;

            return (
              <div
                key={idx}
                className={`flex items-center gap-3 text-xs font-medium transition-colors ${
                  isCompleted
                    ? 'text-status-success'
                    : isCurrent
                    ? 'text-primary'
                    : 'text-muted-foreground/60'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                )}
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-surface-3 h-2 rounded-full overflow-hidden">
            <div
              style={{ width: `${progress}%` }}
              className={`h-full transition-all duration-300 ${
                error ? 'bg-status-error' : 'bg-primary shadow-glow-sm'
              }`}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className={error ? 'text-status-error font-medium' : 'text-muted-foreground'}>
              {error ? `Pipeline Notice: ${error}` : statusMessage}
            </span>
            <span className="text-primary font-bold">{progress}%</span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-status-error/10 border border-status-error/30 rounded-2xl space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-status-error">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">Pipeline could not complete</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {error}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry} className="text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={onClose} className="text-xs font-bold">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

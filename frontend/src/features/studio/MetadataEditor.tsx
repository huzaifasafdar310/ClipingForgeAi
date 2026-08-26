import React from 'react';
import { Clip, PrivacyStatus } from '@/types/api';

interface MetadataEditorProps {
  clip: Clip;
  onUpdate: (updates: Partial<Clip>) => void;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({ clip, onUpdate }) => {
  return (
    <div className="space-y-3 pt-3 border-t border-border-subtle">
      {/* Title */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
          Clip Title
        </label>
        <input
          type="text"
          value={clip.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full bg-surface-0 text-xs text-foreground p-2.5 rounded-xl border border-border-subtle outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
          Caption / Description
        </label>
        <textarea
          rows={3}
          value={clip.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full bg-surface-0 text-xs text-foreground p-2.5 rounded-xl border border-border-subtle outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all leading-relaxed font-mono"
        />
      </div>

      {/* Privacy Status */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
          YouTube Privacy Status
        </label>
        <select
          value={clip.privacyStatus || 'public'}
          onChange={(e) => onUpdate({ privacyStatus: e.target.value as PrivacyStatus })}
          className="w-full bg-surface-0 text-xs text-foreground p-2.5 rounded-xl border border-border-subtle outline-none focus:border-primary cursor-pointer font-medium"
        >
          <option value="public">🌐 Public (Instant Viral Reach)</option>
          <option value="unlisted">🔗 Unlisted (Review via Link)</option>
          <option value="private">🔒 Private (Draft Mode)</option>
        </select>
      </div>
    </div>
  );
};

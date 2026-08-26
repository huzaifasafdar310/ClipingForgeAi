import React, { useState } from 'react';
import { Download, UploadCloud, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Clip } from '@/types/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: Clip | null;
  onDownload: () => void;
  onUploadYouTube: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  clip,
  onDownload,
  onUploadYouTube,
}) => {
  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('1080p');
  const [downloadChecked, setDownloadChecked] = useState(true);
  const [uploadChecked, setUploadChecked] = useState(false);

  const handleExport = () => {
    onClose();
    if (downloadChecked) onDownload();
    if (uploadChecked) onUploadYouTube();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export & Publish Clip"
      description="Configure rendering parameters, direct local download, and automated channel posting."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Format & Resolution */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-surface-2 rounded-xl border border-primary/30">
            <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full bg-surface-0 text-xs text-foreground rounded-lg p-2 border border-border-subtle outline-none font-medium"
            >
              <option value="mp4">MP4 (H.264 High)</option>
              <option value="webm">WebM (Fast Stream)</option>
            </select>
          </div>

          <div className="p-3 bg-surface-2 rounded-xl border border-border-subtle">
            <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">
              Resolution
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full bg-surface-0 text-xs text-foreground rounded-lg p-2 border border-border-subtle outline-none font-medium"
            >
              <option value="1080p">1080x1920 (HD Shorts)</option>
              <option value="720p">720x1280 (Fast Export)</option>
            </select>
          </div>
        </div>

        {/* Options */}
        <div className="bg-surface-2 p-4 rounded-2xl border border-border-subtle space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Export Destinations
          </h4>

          <label className="flex items-center justify-between text-xs text-foreground cursor-pointer select-none">
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" /> Direct MP4 Cut Download
            </span>
            <input
              type="checkbox"
              checked={downloadChecked}
              onChange={(e) => setDownloadChecked(e.target.checked)}
              className="accent-primary w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-foreground cursor-pointer select-none">
            <span className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-secondary" /> Auto-Publish to YouTube Shorts
            </span>
            <input
              type="checkbox"
              checked={uploadChecked}
              onChange={(e) => setUploadChecked(e.target.checked)}
              className="accent-primary w-4 h-4 rounded cursor-pointer"
            />
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleExport}>
            <Check className="w-4 h-4" />
            <span>Render & Export</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};

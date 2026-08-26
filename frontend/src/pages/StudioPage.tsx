import React, { useState } from 'react';
import { StudioEditor } from '@/features/studio/StudioEditor';
import { ProcessingModal } from '@/features/studio/ProcessingModal';
import { Clip } from '@/types/api';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface StudioPageProps {
  clips: Clip[];
  activeClipId: number | null;
  onClipsUpdated: (clips: Clip[]) => void;
}

export const StudioPage: React.FC<StudioPageProps> = ({
  clips,
  activeClipId,
  onClipsUpdated,
}) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState(10);
  const [uploadStatus, setUploadStatus] = useState('Initiating background queue...');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleStartUploadJob = async (selectedClips: Clip[]) => {
    if (!user?.accessToken) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadStep(1);
    setUploadProgress(15);
    setUploadStatus('Sending job to background worker...');

    try {
      const res = await api.startUploadJob(selectedClips, user.accessToken);
      const jobId = res.job_id;

      // Real-time polling
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.getJobStatus(jobId);
          if (statusRes.status === 'processing') {
            setUploadStep(2);
            setUploadProgress(50);
            setUploadStatus('Rendering 9:16 crop & burning kinetic subtitles...');
          } else if (statusRes.status === 'completed') {
            clearInterval(pollInterval);
            setUploadStep(4);
            setUploadProgress(100);
            setUploadStatus('Upload complete! Published as YouTube Short.');

            if (statusRes.results && statusRes.results.length > 0) {
              onClipsUpdated(statusRes.results);
            }
          } else if (statusRes.status === 'failed') {
            clearInterval(pollInterval);
            setUploadError(statusRes.error_message || 'Background processing failed.');
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setUploadError(err.message || 'Polling connection error.');
        }
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to initialize upload job.');
    }
  };

  return (
    <div className="h-full">
      <StudioEditor
        clips={clips}
        initialActiveClipId={activeClipId}
        onClipsUpdated={onClipsUpdated}
        onStartUploadJob={handleStartUploadJob}
      />

      {/* Upload Job Processing Modal */}
      <ProcessingModal
        isOpen={isUploading}
        onClose={() => setIsUploading(false)}
        title="YouTube Shorts Publishing Pipeline"
        currentStep={uploadStep}
        progress={uploadProgress}
        statusMessage={uploadStatus}
        error={uploadError}
      />
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';
import { MetricCards } from '@/features/projects/MetricCards';
import { FilterToolbar, ProjectCategory } from '@/features/projects/FilterToolbar';
import { ProjectsTable } from '@/features/projects/ProjectsTable';
import { ProcessingModal } from '@/features/studio/ProcessingModal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { Clip } from '@/types/api';

interface ProjectsPageProps {
  onSelectStudioClip: (clip: Clip) => void;
  onClipsLoaded: (clips: Clip[]) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  onSelectStudioClip,
  onClipsLoaded,
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('all');

  const [isProcessing, setIsProcessing] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('');
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(10);
  const [statusMessage, setStatusMessage] = useState('Ingesting stream...');
  const [error, setError] = useState<string | null>(null);

  // Fetch projects from backend
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  const handleSelectLocalFile = async (file: File) => {
    setSourceLabel(`Local: ${file.name}`);
    setIsProcessing(true);
    setError(null);
    setStep(1);
    setProgress(20);
    setStatusMessage('Uploading and extracting highlight segments...');

    try {
      const res = await api.analyzeLocalVideo(file, 5);
      setProgress(100);
      setStep(4);
      setStatusMessage('Upload complete!');

      setTimeout(() => {
        setIsProcessing(false);
        onClipsLoaded(res.clips);
        refetch();
        navigate('/app/studio');
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Local video upload failed.');
    }
  };

  // Filter clips
  const filteredClips = (data?.clips || []).filter((clip) => {
    const matchesCategory =
      category === 'all' ||
      (category === 'analyzed' && clip.status !== 'completed') ||
      (category === 'completed' && clip.status === 'completed');

    const matchesSearch =
      searchQuery === '' ||
      clip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (clip.reasoning || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (clip.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files?.[0]) handleSelectLocalFile(e.target.files[0]);
        }}
        accept="video/mp4,video/mov,video/avi,video/mkv,video/webm"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Projects & Video Library</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            Manage analyzed highlights, export downloads, and historical video jobs.
          </p>
        </div>

        <Button
          size="md"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs uppercase font-bold"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Video File</span>
        </Button>
      </div>

      {/* Metric Cards */}
      <MetricCards
        totalClips={data?.stats?.total_clips || 0}
        completedClips={data?.stats?.completed_clips || 0}
        totalProjects={data?.stats?.total_projects || 0}
      />

      {/* Filter Toolbar */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={category}
        onCategoryChange={setCategory}
      />

      {/* Projects Table */}
      <ProjectsTable
        clips={filteredClips}
        onOpenInStudio={(clip) => {
          onSelectStudioClip(clip);
          navigate('/app/studio');
        }}
        isLoading={isLoading}
      />

      {/* Upload Processing Modal */}
      <ProcessingModal
        isOpen={isProcessing}
        onClose={() => setIsProcessing(false)}
        sourceLabel={sourceLabel}
        currentStep={step}
        progress={progress}
        statusMessage={statusMessage}
        error={error}
      />
    </div>
  );
};

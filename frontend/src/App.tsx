import React, { useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudioPage } from '@/pages/StudioPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { AuthErrorModal } from '@/components/common/AuthErrorModal';
import { Clip } from '@/types/api';

// Layout wrapper for all /app surfaces
const AppLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header onToggleSidebar={() => setIsMobileDrawerOpen(true)} />
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      <div className="pt-16 flex flex-1 min-h-[calc(100vh-64px)]">
        <Sidebar />
        <main className="flex-1 bg-background overflow-y-auto p-4 lg:p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [currentClips, setCurrentClips] = useState<Clip[]>([]);
  const [activeClipId, setActiveClipId] = useState<number | null>(null);

  const handleClipsLoaded = (clips: Clip[]) => {
    setCurrentClips(clips);
    if (clips.length > 0) {
      setActiveClipId(clips[0].id);
    }
  };

  const handleSelectStudioClip = (clip: Clip) => {
    // If not already in currentClips, add it
    if (!currentClips.some((c) => c.id === clip.id)) {
      setCurrentClips((prev) => [clip, ...prev]);
    }
    setActiveClipId(clip.id);
  };

  return (
    <>
      <Routes>
      {/* Surface 1: Marketing / Landing */}
      <Route path="/" element={<LandingPage onClipsLoaded={handleClipsLoaded} />} />

      {/* Surface 2: App Shell */}
      <Route
        path="/app"
        element={
          <AppLayout>
            <DashboardPage
              onClipsLoaded={handleClipsLoaded}
              onSelectStudioClip={handleSelectStudioClip}
            />
          </AppLayout>
        }
      />
      <Route
        path="/app/dashboard"
        element={
          <AppLayout>
            <DashboardPage
              onClipsLoaded={handleClipsLoaded}
              onSelectStudioClip={handleSelectStudioClip}
            />
          </AppLayout>
        }
      />
      <Route
        path="/app/studio"
        element={
          <AppLayout>
            <StudioPage
              clips={currentClips}
              activeClipId={activeClipId}
              onClipsUpdated={setCurrentClips}
            />
          </AppLayout>
        }
      />
      <Route
        path="/app/projects"
        element={
          <AppLayout>
            <ProjectsPage
              onSelectStudioClip={handleSelectStudioClip}
              onClipsLoaded={handleClipsLoaded}
            />
          </AppLayout>
        }
      />
      <Route
        path="/app/schedule"
        element={
          <AppLayout>
            <SchedulePage />
          </AppLayout>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <AuthErrorModal />
  </>
  );
};

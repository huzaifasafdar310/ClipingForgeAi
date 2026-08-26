import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Film, Zap, Menu, LogIn, CheckCircle, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NotificationDropdown } from './NotificationDropdown';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, login, isLoggingIn } = useAuth();

  const getBreadcrumb = () => {
    switch (location.pathname) {
      case '/app/studio':
        return 'Clip Studio Editor';
      case '/app/projects':
        return 'Projects & Library';
      case '/app':
      case '/app/dashboard':
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface-0/90 backdrop-blur-xl z-40 border-b border-border-subtle flex items-center justify-between px-4 lg:px-8">
      {/* Left: Brand & Breadcrumbs */}
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-2"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-black font-bold shadow-glow-sm group-hover:scale-105 transition-transform">
            <Film className="w-4 h-4" />
          </div>
          <span className="text-lg font-black tracking-tight text-foreground">
            Clip<span className="text-primary">AI</span>
          </span>
        </Link>

        <span className="hidden sm:inline text-xs font-mono text-muted-foreground/40">/</span>
        <span className="hidden sm:inline text-xs font-mono uppercase text-primary font-semibold">
          {getBreadcrumb()}
        </span>
      </div>

      {/* Right: Actions & Auth */}
      <div className="flex items-center gap-3">
        {location.pathname !== '/app' && location.pathname !== '/app/dashboard' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/app')}
            className="hidden md:flex items-center gap-1.5 font-mono text-xs"
          >
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>New Video</span>
          </Button>
        )}

        <NotificationDropdown />

        {/* YouTube Auth Badge */}
        <div className="pl-3 border-l border-border-subtle">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 border border-border-subtle text-xs">
              <CheckCircle className="w-3.5 h-3.5 text-status-success" />
              <span className="font-mono text-[11px] text-foreground hidden sm:inline">
                YouTube Connected
              </span>
            </div>
          ) : (
            <Button
              size="sm"
              variant="danger"
              onClick={login}
              isLoading={isLoggingIn}
              className="text-xs font-semibold"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect YouTube</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

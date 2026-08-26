import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Film, Library, CalendarClock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/app' },
    { label: 'Clip Studio Editor', icon: Film, path: '/app/studio' },
    { label: 'Projects & Library', icon: Library, path: '/app/projects' },
    { label: 'Auto-Pilot & Schedule', icon: CalendarClock, path: '/app/schedule' },
  ];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-surface-1 border-r border-border-subtle p-5 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left">
        <div>
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle">
            <span className="text-base font-black text-foreground">Navigation</span>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1.5 text-sm">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/app'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all',
                      isActive
                        ? 'bg-primary text-black font-bold shadow-glow-sm'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    )
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-2 border border-border-subtle text-xs text-muted-foreground font-mono">
          <span className="text-primary font-bold">ClipAI Studio</span> v2.0
        </div>
      </div>
    </div>
  );
};

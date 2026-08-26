import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Film, Library, CalendarClock, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sidebar: React.FC = () => {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/app' },
    { label: 'Clip Studio Editor', icon: Film, path: '/app/studio' },
    { label: 'Projects & Library', icon: Library, path: '/app/projects' },
    { label: 'Auto-Pilot & Schedule', icon: CalendarClock, path: '/app/schedule' },
  ];

  return (
    <aside className="w-64 bg-surface-1 border-r border-border-subtle flex flex-col justify-between p-4 fixed lg:sticky top-16 h-[calc(100vh-64px)] z-30 hidden lg:flex">
      {/* Navigation Links */}
      <nav className="space-y-1.5 text-xs font-medium">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/app'}
              className={({ isActive }) =>
                cn(
                  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left font-medium',
                  isActive
                    ? 'bg-primary text-black font-bold shadow-glow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* AI Pipeline Health Card */}
      <div className="p-4 rounded-2xl bg-surface-2 border border-border-subtle space-y-2">
        <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-primary" /> AI Engine
          </span>
          <span className="text-status-success font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            READY
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div className="bg-primary h-full w-full shadow-[0_0_8px_#facc15]" />
        </div>
        <p className="text-[10px] text-muted-foreground/80 font-mono">
          Whisper ASR • Groq LLaMA 3 • FFmpeg
        </p>
      </div>
    </aside>
  );
};

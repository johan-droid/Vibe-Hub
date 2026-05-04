import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  FileCode2,
  Gauge,
  MessageSquare,
  Moon,
  Route,
  Settings,
  ShieldCheck,
  Sidebar as SidebarIcon,
  Sun,
  Fingerprint,
  Layers3,
  Cpu,
  Brain,
  Globe,
  Lock,
  ChevronRight,
  Search,
  Command,
  Bell,
  HelpCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import { IconButton } from './IconButton';

export default function Titlebar({ onOpenSettings }) {
  const {
    theme, toggleTheme,
    user, isThinking
  } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      className="relative z-50 flex h-14 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest/95 px-4 text-on-surface shadow-sm backdrop-blur-md md:px-6"
    >
      <div className="flex min-w-0 items-center gap-5">
        <button onClick={() => navigate('/')} className="group flex min-w-0 items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-on-primary shadow-sm transition-transform group-hover:scale-[1.03]">
            <motion.div 
              className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100"
              animate={isThinking ? { opacity: [0.1, 0.4, 0.1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <Brain size={19} className="relative z-10" />
            {isThinking && (
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-primary" />
            )}
          </div>
          <div className="hidden min-w-0 sm:block text-left">
            <span className="block text-base font-black leading-none tracking-tight text-on-surface">Selina</span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Workspace</span>
          </div>
        </button>

        <div className="group relative hidden w-[22rem] items-center lg:flex">
           <Search size={15} className="absolute left-3.5 text-on-surface-variant transition-colors group-focus-within:text-primary" />
           <input 
             type="text" 
             placeholder="Search workspace..." 
             className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-low pl-10 pr-14 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/55 transition-all focus:border-primary/40 focus:bg-surface-container-lowest focus:outline-none"
           />
           <div className="absolute right-2.5 flex items-center gap-1 rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-on-surface-variant">
              <Command size={10} />
              <span className="text-[9px] font-bold uppercase">K</span>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 lg:flex">
           <div className="flex items-center gap-2">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-google-green" />
                <div className="absolute inset-0 animate-pulse rounded-full bg-google-green blur-[4px]" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Secure Node</span>
           </div>
           <div className="h-4 w-px bg-outline-variant" />
           <div className="flex items-center gap-2 text-primary">
              <Globe size={12} className="opacity-60" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-75">West-1</span>
           </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            icon={Bell}
            variant="ghost"
            className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          />
          <IconButton
            icon={HelpCircle}
            variant="ghost"
            className="hidden text-on-surface-variant hover:bg-surface-container hover:text-on-surface sm:flex"
          />
          <div className="mx-1 h-5 w-px bg-outline-variant" />
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            onClick={toggleTheme}
            variant="ghost"
            className="text-on-surface-variant hover:bg-primary/5 hover:text-primary"
            aria-label="Toggle theme"
          />
          <IconButton
            icon={Settings}
            onClick={onOpenSettings}
            variant="ghost"
            className="text-on-surface-variant hover:bg-primary/5 hover:text-primary"
            aria-label="Settings"
          />
        </div>
        
        {user?.avatarUrl && (
          <button className="ml-1 h-9 w-9 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-0.5 shadow-sm transition-all hover:scale-[1.03]">
             <img src={user.avatarUrl} alt={user.name} className="h-full w-full rounded-md object-cover" />
          </button>
        )}
      </div>
    </div>
  );
}

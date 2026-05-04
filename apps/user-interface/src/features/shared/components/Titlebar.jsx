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
  ChevronRight
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
      className="relative z-50 flex h-16 shrink-0 items-center justify-between bg-white border-b border-black/[0.03] px-8 text-on-surface shadow-sm backdrop-blur-md"
    >
      <div className="flex min-w-0 items-center gap-10">
        {/* Brand Section */}
        <button onClick={() => navigate('/')} className="flex min-w-0 items-center gap-4 group">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-primary text-on-primary shadow-xl shadow-primary/10 overflow-hidden group-hover:scale-105 transition-transform">
            <motion.div 
              className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
              animate={isThinking ? { opacity: [0.1, 0.3, 0.1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <Brain size={20} className="relative z-10" />
            {isThinking && (
              <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-google-blue animate-pulse" />
            )}
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter leading-none text-on-surface">Selina</span>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-[8px] font-black tracking-[0.4em] text-google-blue uppercase opacity-60">
                   Professional Workspace
                 </span>
              </div>
            </div>
          </div>
        </button>

        {/* Breadcrumb / Status */}
        <div className="hidden md:flex items-center gap-4 text-sm font-semibold text-on-surface-variant/40">
           <div className="h-4 w-[1px] bg-black/[0.05]" />
           <div className="flex items-center gap-3">
              <Globe size={14} className="text-google-blue opacity-40" />
              <span className="uppercase tracking-[0.2em] text-[10px] font-black">Production Node</span>
              <ChevronRight size={12} className="opacity-20" />
              <span className="text-on-surface uppercase tracking-[0.1em] text-[10px] font-black">
                {location.pathname === '/dashboard' ? 'Overview' : location.pathname.split('/').pop().toUpperCase()}
              </span>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Connection Status Badge */}
        <div className="hidden lg:flex items-center gap-4 px-5 py-2 rounded-2xl bg-[#faf8f5] border border-black/[0.03] shadow-inner group">
           <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-google-green animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface/40">Live Sync Active</span>
           </div>
           <div className="h-4 w-[1px] bg-black/[0.05]" />
           <div className="flex items-center gap-3 text-google-blue">
              <Cpu size={12} className="opacity-60" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Compute Hub 01</span>
           </div>
        </div>

        <div className="mx-2 h-6 w-[1px] bg-black/[0.05]" />

        <div className="flex items-center gap-2">
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            onClick={toggleTheme}
            variant="ghost"
            className="!h-10 !w-10 rounded-[1.2rem] text-on-surface-variant/30 hover:text-google-blue hover:bg-google-blue/5 transition-all"
            aria-label="Toggle theme"
          />
          <IconButton
            icon={Settings}
            onClick={onOpenSettings}
            variant="ghost"
            className="!h-10 !w-10 rounded-[1.2rem] text-on-surface-variant/30 hover:text-google-blue hover:bg-google-blue/5 transition-all"
            aria-label="Settings"
          />
        </div>
        
        {user?.avatarUrl && (
          <button className="ml-3 h-11 w-11 rounded-[1.2rem] overflow-hidden border border-black/[0.05] shadow-sm hover:scale-105 active:scale-95 transition-all ring-offset-2 hover:ring-2 ring-google-blue/20">
             <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
          </button>
        )}
      </div>
    </div>
  );
}

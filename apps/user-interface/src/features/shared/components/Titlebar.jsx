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
      className="relative z-50 flex h-20 shrink-0 items-center justify-between bg-white border-b border-black/[0.03] px-10 text-on-surface shadow-sm backdrop-blur-md"
    >
      <div className="flex min-w-0 items-center gap-12">
        {/* Brand Section */}
        <button onClick={() => navigate('/')} className="flex min-w-0 items-center gap-5 group">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.3rem] bg-google-blue text-white shadow-2xl shadow-google-blue/20 overflow-hidden group-hover:scale-105 transition-transform">
            <motion.div 
              className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
              animate={isThinking ? { opacity: [0.1, 0.4, 0.1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <Brain size={24} className="relative z-10" />
            {isThinking && (
              <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-white bg-google-blue animate-pulse" />
            )}
          </div>
          <div className="hidden min-w-0 sm:block text-left">
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter leading-none text-on-surface">Selina</span>
              <div className="flex items-center gap-2 mt-2">
                 <span className="text-[9px] font-black tracking-[0.4em] text-google-blue uppercase opacity-60">
                   Workspace v4.1
                 </span>
              </div>
            </div>
          </div>
        </button>

        {/* Global Search Bar (Premium Mock) */}
        <div className="hidden lg:flex items-center group relative w-96">
           <Search size={16} className="absolute left-6 text-on-surface-variant/20 group-focus-within:text-google-blue transition-colors" />
           <input 
             type="text" 
             placeholder="Search workspace..." 
             className="w-full h-12 bg-[#faf8f5] border border-black/[0.03] rounded-2xl pl-14 pr-16 text-xs font-bold text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:border-google-blue/30 focus:bg-white focus:shadow-2xl focus:shadow-black/[0.02] transition-all"
           />
           <div className="absolute right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-black/[0.05] shadow-sm opacity-40 group-hover:opacity-100 transition-opacity">
              <Command size={10} />
              <span className="text-[9px] font-black uppercase">K</span>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Node Connectivity Segment */}
        <div className="hidden lg:flex items-center gap-5 px-6 py-2.5 rounded-2xl bg-[#faf8f5] border border-black/[0.03] shadow-inner group">
           <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-google-green" />
                <div className="absolute inset-0 bg-google-green blur-[4px] rounded-full animate-pulse" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface/40">Secure Node</span>
           </div>
           <div className="h-4 w-[1px] bg-black/[0.05]" />
           <div className="flex items-center gap-3 text-google-blue">
              <Globe size={12} className="opacity-60" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">West-1</span>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <IconButton
            icon={Bell}
            variant="ghost"
            className="!h-11 !w-11 rounded-[1.2rem] text-on-surface-variant/30 hover:text-on-surface hover:bg-black/5"
          />
          <IconButton
            icon={HelpCircle}
            variant="ghost"
            className="!h-11 !w-11 rounded-[1.2rem] text-on-surface-variant/30 hover:text-on-surface hover:bg-black/5"
          />
          <div className="mx-2 h-6 w-[1px] bg-black/[0.05]" />
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            onClick={toggleTheme}
            variant="ghost"
            className="!h-11 !w-11 rounded-[1.2rem] text-on-surface-variant/30 hover:text-google-blue hover:bg-google-blue/5 transition-all"
            aria-label="Toggle theme"
          />
          <IconButton
            icon={Settings}
            onClick={onOpenSettings}
            variant="ghost"
            className="!h-11 !w-11 rounded-[1.2rem] text-on-surface-variant/30 hover:text-google-blue hover:bg-google-blue/5 transition-all"
            aria-label="Settings"
          />
        </div>
        
        {user?.avatarUrl && (
          <button className="ml-3 h-12 w-12 rounded-[1.4rem] overflow-hidden border border-black/[0.05] shadow-lg hover:scale-105 active:scale-95 transition-all ring-offset-4 hover:ring-2 ring-google-blue/20 p-0.5 bg-white">
             <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover rounded-[1.2rem]" />
          </button>
        )}
      </div>
    </div>
  );
}

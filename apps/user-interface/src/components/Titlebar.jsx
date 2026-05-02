import React from 'react';
import { Settings, Sidebar as SidebarIcon, MessageSquare, Cpu, Layers, Sun, Moon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { IconButton } from './ui/IconButton';
import { Surface } from './ui/Surface';
import { Chip } from './ui/Chip';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Titlebar — Material 3 Command Bar
 * The primary orchestration anchor for the workspace.
 */
export default function Titlebar({ onOpenSettings }) {
  const { 
    vfsStatus, 
    sidebarCollapsed, setSidebarCollapsed,
    chatCollapsed, setChatCollapsed,
    activeTab, setActiveTab,
    theme, toggleTheme
  } = useStore();

  return (
    <Surface 
      elevation={2} 
      shape="none" 
      className="h-16 border-b border-outline-variant/20 flex items-center justify-between px-8 select-none z-50 bg-surface-container-low/50 backdrop-blur-2xl"
    >
      <div className="flex items-center gap-8">
        {/* Brand */}
        <div className="flex items-center gap-4 group cursor-pointer">
          <Surface 
            elevation={4} 
            shape="lg" 
            className="w-10 h-10 bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 group-hover:rotate-12 transition-transform duration-700 ease-emphasized"
          >
            <Cpu size={22} className="text-on-primary" />
          </Surface>
          <div className="flex flex-col">
            <span className="headline-small font-black tracking-tighter text-on-surface leading-none">
              VIBE HUB
            </span>
            <span className="label-small font-bold tracking-[0.3em] text-primary uppercase opacity-60">
              Neural_Core
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-outline-variant/30 mx-2" />

        {/* Tab Switching (M3 Segmented Button Style) */}
        <Surface elevation={0} shape="full" className="flex items-center bg-surface-container-high/40 p-1 border border-outline-variant/10">
          {[
            { id: 'diff', label: 'Projection', icon: Layers },
            { id: 'editor', label: 'Workspace', icon: SidebarIcon }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative group h-9 flex items-center px-6 rounded-full transition-all duration-500 overflow-hidden"
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="active-tab-bg"
                  className="absolute inset-0 bg-primary rounded-full -z-10 shadow-lg shadow-primary/20"
                />
              )}
              <tab.icon 
                size={14} 
                className={`transition-colors duration-500 ${activeTab === tab.id ? 'text-on-primary' : 'text-on-surface-variant opacity-40'}`} 
              />
              <span className={`ml-3 label-medium font-bold transition-colors duration-500 ${activeTab === tab.id ? 'text-on-primary' : 'text-on-surface-variant opacity-40'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </Surface>
      </div>

      <div className="flex items-center gap-6">
        {/* VFS Status */}
        <Chip 
          label={vfsStatus} 
          variant="tonal"
          color={vfsStatus === 'ready' ? 'secondary' : 'error'}
          icon={Cpu}
        />

        <div className="flex items-center gap-2">
          <IconButton 
            icon={theme === 'dark' ? Sun : Moon} 
            onClick={toggleTheme}
            variant="standard"
            size="md"
            className="text-on-surface-variant hover:text-primary transition-transform duration-700 hover:rotate-45"
          />
          <div className="w-px h-4 bg-outline-variant/30 mx-1" />
          <IconButton 
            icon={SidebarIcon} 
            active={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            variant="tonal"
            size="md"
          />
          <IconButton 
            icon={MessageSquare} 
            active={!chatCollapsed}
            onClick={() => setChatCollapsed(!chatCollapsed)}
            variant="tonal"
            size="md"
          />
          <div className="w-px h-6 bg-outline-variant/30 mx-3" />
          <IconButton 
            icon={Settings} 
            onClick={onOpenSettings}
            variant="standard"
            size="lg"
            className="bg-surface-container-highest/50 hover:rotate-90 transition-transform duration-700"
          />
        </div>
      </div>
    </Surface>
  );
}

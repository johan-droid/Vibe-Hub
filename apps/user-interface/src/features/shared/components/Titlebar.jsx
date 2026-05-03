import React from 'react';
import { Settings, Sidebar as SidebarIcon, MessageSquare, Cpu, Layers, Sun, Moon, Activity } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { IconButton } from './IconButton';
import { Surface } from './Surface';
import { Chip } from './Chip';
import { motion } from 'framer-motion';

/**
 * Titlebar anchors the workspace with compact navigation and reliable status.
 */
export default function Titlebar({ onOpenSettings }) {
  const {
    vfsStatus = 'idle',
    sidebarCollapsed, setSidebarCollapsed,
    chatCollapsed, setChatCollapsed,
    activeTab, setActiveTab,
    theme, toggleTheme,
    user,
  } = useStore();

  const statusLabel = vfsStatus === 'ready' ? 'Workspace ready' : vfsStatus === 'booting' ? 'Booting VFS' : 'Local session';

  return (
    <Surface
      elevation={0}
      shape="none"
      className="h-16 border-b border-outline-variant/30 bg-surface-container-lowest/82 backdrop-blur-2xl flex items-center justify-between px-4 md:px-6 select-none z-50"
    >
      <div className="flex min-w-0 items-center gap-4 md:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10">
            <Cpu size={20} />
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-2">
              <span className="title-small leading-none">Vibe Hub</span>
              <span className="h-1.5 w-1.5 rounded-full bg-tertiary animate-soft-pulse" />
            </div>
            <span className="label-small mt-1 block truncate text-on-surface-variant">{user?.name || 'Selina Workspace'}</span>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-outline-variant/40 md:block" />

        <div className="hidden items-center rounded-full border border-outline-variant/35 bg-surface-container-low p-1 md:flex">
          {[
            { id: 'diff', label: 'Projection', icon: Layers },
            { id: 'editor', label: 'Editor', icon: SidebarIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex h-9 items-center gap-2 rounded-full px-4 text-on-surface-variant transition hover:text-on-surface"
            >
              {activeTab === tab.id && (
                <motion.div layoutId="active-tab-bg" className="absolute inset-0 rounded-full bg-primary/15 ring-1 ring-primary/25" />
              )}
              <tab.icon size={14} className="relative z-10" />
              <span className="relative z-10 label-small">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Chip
          label={statusLabel}
          variant="tonal"
          color={vfsStatus === 'ready' ? 'secondary' : 'primary'}
          icon={Activity}
          className="hidden sm:inline-flex"
        />
        <IconButton
          icon={theme === 'dark' ? Sun : Moon}
          onClick={toggleTheme}
          variant="standard"
          size="md"
          className="text-on-surface-variant hover:text-primary"
          aria-label="Toggle theme"
          title="Toggle theme"
        />
        <IconButton
          icon={SidebarIcon}
          active={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          variant="tonal"
          size="md"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        />
        <IconButton
          icon={MessageSquare}
          active={!chatCollapsed}
          onClick={() => setChatCollapsed(!chatCollapsed)}
          variant="tonal"
          size="md"
          aria-label="Toggle chat"
          title="Toggle chat"
        />
        <IconButton
          icon={Settings}
          onClick={onOpenSettings}
          variant="standard"
          size="md"
          className="border border-outline-variant/30 bg-surface-container-low hover:text-primary"
          aria-label="Settings"
          title="Settings"
        />
      </div>
    </Surface>
  );
}

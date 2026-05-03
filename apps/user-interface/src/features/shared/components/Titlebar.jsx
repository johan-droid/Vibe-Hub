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
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { IconButton } from './IconButton';
import { Surface } from './Surface';
import { Chip } from './Chip';

const NAV_ITEMS = [
  { label: 'Overview', path: '/dashboard', icon: Gauge, tab: 'dashboard' },
  { label: 'Workbench', path: '/dashboard/editor', icon: FileCode2, tab: 'editor' },
  { label: 'Activity', path: '/dashboard/activity', icon: Activity, tab: 'dashboard' },
  { label: 'Runtime', path: '/dashboard/runtime', icon: Bot, tab: 'dashboard' },
  { label: 'Skills', path: '/dashboard/skills', icon: Route, tab: 'dashboard' },
  { label: 'Security', path: '/dashboard/security', icon: ShieldCheck, tab: 'dashboard' },
];

function isActivePath(currentPath, itemPath) {
  if (itemPath === '/dashboard') return currentPath === '/dashboard' || currentPath === '/dashboard/';
  return currentPath.startsWith(itemPath);
}

/**
 * Titlebar anchors the workspace with route-backed navigation and live status.
 */
export default function Titlebar({ onOpenSettings }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    vfsStatus = 'idle',
    sidebarCollapsed, setSidebarCollapsed,
    chatCollapsed, setChatCollapsed,
    activeTab, setActiveTab,
    theme, toggleTheme,
    user,
  } = useStore();

  const statusLabel = vfsStatus === 'ready' ? 'Workspace ready' : vfsStatus === 'booting' ? 'Loading files' : 'Session active';

  const goTo = (item) => {
    setActiveTab(item.tab);
    navigate(item.path);
  };

  return (
    <Surface
      elevation={0}
      shape="none"
      className="z-50 flex h-16 items-center justify-between border-b border-[#e3d8c5] bg-[#fffaf2] px-4 text-[#17201b] shadow-[0_8px_30px_-28px_rgba(27,32,26,0.5)] md:px-6"
    >
      <div className="flex min-w-0 items-center gap-4 md:gap-6">
        <button type="button" onClick={() => goTo(NAV_ITEMS[0])} className="flex min-w-0 items-center gap-3 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1f6f5b] text-white">
            <Bot size={20} />
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-2">
              <span className="title-small leading-none">Selina</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#d8892f]" />
            </div>
            <span className="mt-1 block truncate text-xs font-medium text-[#6c6f68]">
              {user?.name || user?.email || 'Agent workspace'}
            </span>
          </div>
        </button>

        <div className="hidden h-8 w-px bg-[#e3d8c5] md:block" />

        <div className="hidden items-center gap-1 rounded-full bg-[#f4ecdf] p-1 ring-1 ring-[#e3d8c5] xl:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(location.pathname, item.path) || (item.tab === activeTab && item.path === '/dashboard/editor' && activeTab === 'editor');
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => goTo(item)}
                className={`flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                  active
                    ? 'bg-[#17201b] text-white'
                    : 'text-[#5d6259] hover:bg-white hover:text-[#17201b]'
                }`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
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
          className="text-[#5d6259] hover:text-[#1f6f5b]"
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
          className="border border-[#e3d8c5] bg-white hover:text-[#1f6f5b]"
          aria-label="Settings"
          title="Settings"
        />
      </div>
    </Surface>
  );
}

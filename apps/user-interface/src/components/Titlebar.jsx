import React from 'react';
import { Settings, Sidebar as SidebarIcon, MessageSquare, Terminal, Layout, Cpu, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Titlebar({ onOpenSettings }) {
  const { 
    vfsStatus, 
    sidebarCollapsed, setSidebarCollapsed,
    chatCollapsed, setChatCollapsed,
    activeTab, setActiveTab
  } = useStore();

  return (
    <div className="h-12 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between px-4 select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-900/20">
            <Cpu size={14} className="text-white" />
          </div>
          <span className="font-mono text-sm font-bold tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
            VIBE_HUB_
          </span>
        </div>

        <div className="h-4 w-[1px] bg-zinc-800 mx-2" />

        <div className="flex items-center gap-1 bg-zinc-900/50 rounded-lg p-0.5 border border-zinc-800">
          <button 
            onClick={() => setActiveTab('diff')}
            className={`px-3 py-1 text-[10px] font-mono leading-none rounded-md transition-all ${activeTab === 'diff' ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            CHANGES.DIFF
          </button>
          <button 
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1 text-[10px] font-mono leading-none rounded-md transition-all ${activeTab === 'editor' ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            EDITOR.VFS
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-mono transition-all ${
          vfsStatus === 'ready' 
            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' 
            : 'bg-amber-500/5 border-amber-500/20 text-amber-500 animate-pulse'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${vfsStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {vfsStatus.toUpperCase()}
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-md transition-colors ${sidebarCollapsed ? 'text-zinc-600 hover:text-zinc-400' : 'text-cyan-500 bg-cyan-500/5'}`}
          >
            <SidebarIcon size={16} />
          </button>
          <button 
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className={`p-1.5 rounded-md transition-colors ${chatCollapsed ? 'text-zinc-600 hover:text-zinc-400' : 'text-cyan-500 bg-cyan-500/5'}`}
          >
            <MessageSquare size={16} />
          </button>
          <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
          <button 
            onClick={onOpenSettings}
            className="p-1.5 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-900 rounded-md"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

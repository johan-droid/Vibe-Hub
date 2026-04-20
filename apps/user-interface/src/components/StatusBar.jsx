import React from 'react';
import { Github, Zap, Brain, Activity, Wifi } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function StatusBar() {
  const { vfsStatus, effortLevel, repoUrl } = useStore();

  return (
    <div className="h-6 bg-cyan-600 flex items-center justify-between px-3 text-[10px] font-medium text-cyan-50 select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 hover:bg-white/10 px-2 h-full cursor-pointer transition-colors">
          <Activity size={12} />
          <span>VFS_{vfsStatus.toUpperCase()}</span>
        </div>
        {repoUrl && (
          <div className="flex items-center gap-1.5 hover:bg-white/10 px-2 h-full cursor-pointer transition-colors max-w-[200px] truncate">
            <Github size={12} />
            <span className="truncate">{repoUrl.split('/').pop()}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 hover:bg-white/10 px-2 h-full cursor-pointer transition-colors uppercase tracking-wider">
          <Brain size={12} />
          <span>EFFORT: {effortLevel}</span>
        </div>
        <div className="flex items-center gap-1.5 hover:bg-white/10 px-2 h-full cursor-pointer transition-colors">
          <Zap size={12} />
          <span>SWARM_MODE: RECURRENT</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 h-full">
          <Wifi size={12} className="text-cyan-200" />
          <span>STABLE</span>
        </div>
      </div>
    </div>
  );
}

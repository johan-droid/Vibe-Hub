import React, { useState } from 'react';
import { X, Globe, Lock, ShieldCheck, Cpu, Palette, Box } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsModal({ isOpen, onClose }) {
  const { repoUrl, githubPat, setSettings, logout } = useStore();
  const [activeTab, setActiveTab] = useState('agent');
  const [localRepo, setLocalRepo] = useState(repoUrl);
  const [localPat, setLocalPat] = useState(githubPat);

  if (!isOpen) return null;

  const handleSave = () => {
    setSettings({ repoUrl: localRepo, githubPat: localPat });
    onClose();
  };

  const tabs = [
    { id: 'agent', icon: Cpu, label: 'Agent_Config' },
    { id: 'git', icon: Box, label: 'VFS_Control' },
    { id: 'appearance', icon: Palette, label: 'System_Theme' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl h-[500px] glass rounded-3xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex"
      >
        {/* Left Nav */}
        <div className="w-48 bg-black/40 border-r border-white/5 p-4 flex flex-col gap-1">
          <div className="mb-6 px-4 py-2">
             <div className="flex items-center gap-2 text-cyan-500">
                <ShieldCheck size={18} />
                <span className="font-mono text-sm font-bold tracking-tight">VIBE_SYS</span>
             </div>
          </div>

          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === tab.id 
                ? 'bg-cyan-600/10 text-cyan-400 border border-cyan-500/20' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-cyan-400' : 'text-zinc-600'} />
              <span className="text-[10px] font-mono leading-none tracking-widest uppercase">{tab.label}</span>
            </button>
          ))}

          <div className="mt-auto p-2">
            <button 
              onClick={() => {
                if(confirm("Wipe all locally stored data including keys and logs?")) {
                  logout();
                  window.location.reload();
                }
              }}
              className="w-full px-4 py-3 rounded-xl text-[10px] font-mono uppercase text-red-500/50 hover:bg-red-500/5 hover:text-red-500 transition-all border border-transparent hover:border-red-500/10"
            >
              Emergency_Purge
            </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-[0.2em]">{tabs.find(t => t.id === activeTab).label}</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-500">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'agent' && (
                <motion.div 
                  key="agent"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest pl-1">Primary_Model</label>
                       <span className="text-[9px] font-mono text-cyan-500/50 uppercase">Auto_Resolved</span>
                    </div>
                    <div className="bg-black/50 border border-zinc-800 rounded-2xl px-4 py-4 text-sm text-zinc-300 font-mono flex items-center justify-between">
                       <span>gemini-1.5-flash-latest</span>
                       <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                  </div>

                  <div className="bg-zinc-900/30 rounded-2xl p-5 border border-white/5 space-y-3">
                    <div className="flex items-center gap-3 text-cyan-400">
                       <Box size={16} />
                       <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Self_Correction_Depth</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-mono italic">
                      "Adjust the maximum number of recursive repair passes for complex codebase-wide refactors."
                    </p>
                  </div>
                </motion.div>
              )}

              {activeTab === 'git' && (
                <motion.div 
                  key="git"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                      <Globe size={11} /> Remote_Repository
                    </label>
                    <input 
                      type="text"
                      value={localRepo}
                      onChange={(e) => setLocalRepo(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      className="w-full bg-black/50 border border-zinc-800 rounded-2xl px-4 py-4 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all font-mono placeholder:text-zinc-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                      <Lock size={11} /> Auth_Token (PAT)
                    </label>
                    <input 
                      type="password"
                      value={localPat}
                      onChange={(e) => setLocalPat(e.target.value)}
                      placeholder="ghp_********************"
                      className="w-full bg-black/50 border border-zinc-800 rounded-2xl px-4 py-4 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all font-mono placeholder:text-zinc-800"
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === 'appearance' && (
                <motion.div key="appearance" className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4">
                   <Palette size={48} className="opacity-10" />
                   <div className="text-[10px] font-mono uppercase tracking-[0.4em]">system_standard_v dark</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 bg-black/40 border-t border-white/5 flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-[11px] font-mono font-bold text-zinc-500 hover:text-white transition-colors uppercase"
            >
              Close
            </button>
            <button 
              onClick={handleSave}
              className="px-8 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20 uppercase tracking-widest text-[11px]"
            >
              Commit_Changes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

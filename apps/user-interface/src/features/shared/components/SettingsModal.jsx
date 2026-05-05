import React, { useState } from 'react';
import { X, Globe, Lock, ShieldCheck, Cpu, Palette, Box, Trash2, LogOut, Settings as SettingsIcon, Fingerprint, ChevronRight, Sparkles, HardDrive, Shield } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { api } from '../../../services/api';

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
    { id: 'agent', icon: Cpu, label: 'Intelligence', desc: 'AI model and reasoning engine configurations.' },
    { id: 'git', icon: Box, label: 'Repository', desc: 'Manage your project source and credentials.' },
    { id: 'appearance', icon: Palette, label: 'Aesthetics', desc: 'Visual theme and workspace density.' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-xl"
      />
      
      {/* Modal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-4xl h-[680px] overflow-hidden rounded-[3rem] bg-[#faf8f5] shadow-3xl shadow-black/20 border border-black/[0.05] flex"
      >
        {/* Navigation Sidebar */}
        <div className="w-80 bg-white border-r border-black/[0.03] flex flex-col p-10">
          <div className="mb-12 flex items-center gap-5">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-google-blue/5 text-google-blue shadow-sm">
              <SettingsIcon size={22} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-on-surface leading-none">Settings</span>
              <span className="mt-2 text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em]">Workspace Core</span>
            </div>
          </div>

          <nav className="flex flex-col gap-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative group h-14 flex items-center px-5 rounded-[1.5rem] transition-all duration-500"
              >
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="settings-tab-pill"
                    className="absolute inset-0 bg-google-blue/[0.05] border border-google-blue/10 rounded-[1.5rem] -z-10"
                  />
                )}
                <tab.icon 
                  size={20} 
                  className={`transition-colors duration-500 ${activeTab === tab.id ? 'text-google-blue' : 'text-on-surface-variant/30 group-hover:text-on-surface'}`} 
                />
                <span className={`ml-5 text-sm font-bold transition-colors duration-500 ${activeTab === tab.id ? 'text-on-surface' : 'text-on-surface-variant/40 group-hover:text-on-surface'}`}>
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <ChevronRight size={14} className="ml-auto text-google-blue opacity-40" />
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-6">
            <div className="p-6 rounded-[2rem] bg-google-red/5 border border-google-red/10 group overflow-hidden relative">
               <div className="absolute -right-4 -top-4 w-12 h-12 bg-google-red/10 blur-[20px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
               <p className="text-[10px] font-black text-google-red uppercase tracking-widest mb-3">Critical Zone</p>
               <Button
                variant="text"
                size="sm"
                fullWidth
                onClick={() => {
                  if(confirm("Are you sure you want to purge all local session data? This cannot be undone.")) {
                    api.logout()
                      .catch(() => {})
                      .finally(() => {
                        logout();
                        window.location.reload();
                      });
                  }
                }}
                className="!justify-start !p-0 !text-google-red/60 hover:!text-google-red font-black uppercase tracking-widest text-[9px]"
              >
                Purge Neural Session
              </Button>
            </div>
            <p className="text-[9px] font-black text-on-surface-variant/20 text-center uppercase tracking-widest">Selina Engine v4.1.2_Stable</p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-20 px-12 flex items-center justify-between border-b border-black/[0.03] bg-white/30 backdrop-blur-sm">
            <div className="flex flex-col">
              <h2 className="text-lg font-black text-on-surface leading-none">{tabs.find(t => t.id === activeTab).label}</h2>
              <p className="mt-2 text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-widest">{tabs.find(t => t.id === activeTab).desc}</p>
            </div>
            <IconButton icon={X} variant="ghost" onClick={onClose} className="opacity-20 hover:opacity-100 hover:bg-black/5 rounded-xl transition-all" />
          </header>

          <div className="flex-1 overflow-y-auto p-12 scrollbar-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-10"
              >
                {activeTab === 'agent' && (
                  <div className="space-y-10">
                    <div className="space-y-5">
                      <label className="text-[10px] font-black text-google-blue uppercase tracking-[0.4em] ml-2">Active Specialist</label>
                      <div className="p-8 rounded-[2.5rem] bg-white border border-black/[0.03] shadow-sm flex items-center justify-between group hover:border-google-blue/20 transition-all duration-500">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-google-blue/5 text-google-blue group-hover:scale-110 transition-transform">
                            <Cpu size={28} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xl font-black text-on-surface tracking-tight">Gemini 1.5 Flash</span>
                            <span className="mt-1 text-[10px] font-black text-google-green uppercase tracking-widest">Online / Performance Optimized</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-google-green/5 text-google-green border border-google-green/10 text-[9px] font-black uppercase tracking-widest">
                           <div className="h-1.5 w-1.5 rounded-full bg-google-green animate-pulse" />
                           Ready
                        </div>
                      </div>
                    </div>

                    <div className="p-10 rounded-[3rem] bg-google-blue/[0.02] border border-google-blue/10 relative overflow-hidden group">
                      <div className="absolute -right-10 -top-10 w-40 h-40 bg-google-blue/5 blur-[50px] rounded-full group-hover:scale-125 transition-transform duration-700" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-4 text-google-blue mb-6">
                           <Shield size={22} />
                           <span className="text-xs font-black uppercase tracking-[0.3em]">Agent Protocols</span>
                        </div>
                        <p className="text-base text-on-surface-variant/60 leading-relaxed font-semibold">
                          Your workspace agents follow strict architectural guidelines. Every code modification is analyzed for performance impacts and potential security regressions before being suggested.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'git' && (
                  <div className="space-y-10">
                    <div className="space-y-5">
                      <label className="text-[10px] font-black text-google-red uppercase tracking-[0.4em] ml-2">Source Control Link</label>
                      <div className="relative group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-google-blue opacity-30 group-focus-within:opacity-100 group-focus-within:scale-110 transition-all">
                          <Globe size={20} />
                        </div>
                        <input 
                          type="text"
                          value={localRepo}
                          onChange={(e) => setLocalRepo(e.target.value)}
                          placeholder="Repository URL (GitHub/GitLab)"
                          className="w-full h-18 bg-white border border-black/[0.03] rounded-[1.8rem] pl-16 pr-8 text-base font-bold text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:border-google-blue/30 focus:shadow-2xl focus:shadow-black/[0.02] transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-5">
                      <label className="text-[10px] font-black text-google-yellow uppercase tracking-[0.4em] ml-2">Authentication Key</label>
                      <div className="relative group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-google-blue opacity-30 group-focus-within:opacity-100 group-focus-within:scale-110 transition-all">
                          <Fingerprint size={20} />
                        </div>
                        <input 
                          type="password"
                          value={localPat}
                          onChange={(e) => setLocalPat(e.target.value)}
                          placeholder="Personal Access Token (ghp_...)"
                          className="w-full h-18 bg-white border border-black/[0.03] rounded-[1.8rem] pl-16 pr-8 text-base font-bold text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:border-google-blue/30 focus:shadow-2xl focus:shadow-black/[0.02] transition-all font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-3 px-4 text-[10px] font-semibold text-on-surface-variant/30 italic">
                         <Lock size={12} />
                         <span>Credentials are encrypted and stored in your local enclave.</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'appearance' && (
                  <div className="h-full flex flex-col items-center justify-center gap-8 py-20">
                     <div className="relative">
                        <div className="w-28 h-28 flex items-center justify-center rounded-[2.5rem] border border-black/[0.03] bg-white shadow-2xl shadow-black/[0.05]">
                          <Palette size={48} className="text-google-blue opacity-10" />
                        </div>
                        <motion.div animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute inset-0 bg-google-blue blur-[40px] rounded-full -z-10" />
                     </div>
                     <div className="text-center space-y-3">
                       <h3 className="text-xl font-black text-on-surface">Coffee Milky Pro</h3>
                       <p className="text-[10px] font-black text-on-surface-variant/20 uppercase tracking-[0.4em]">High Fidelity Adaptive Theme</p>
                     </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action Footer */}
          <footer className="h-24 px-12 flex items-center justify-end gap-6 border-t border-black/[0.03] bg-white/50 backdrop-blur-md">
            <button onClick={onClose} className="text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant/40 hover:text-on-surface transition-colors">
              Cancel
            </button>
            <Button variant="filled" size="lg" onClick={handleSave} className="h-14 px-10 rounded-2xl bg-google-blue shadow-2xl shadow-google-blue/20 border-none font-black uppercase tracking-widest text-xs">
              Save Configuration
            </Button>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}

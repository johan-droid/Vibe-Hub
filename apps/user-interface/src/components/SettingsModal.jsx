import React, { useState } from 'react';
import { X, Globe, Lock, ShieldCheck, Cpu, Palette, Box, Trash2, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Surface } from './ui/Surface';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

/**
 * SettingsModal — Material 3 Command Center
 * A professional, high-fidelity configuration interface.
 */
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
    { id: 'agent', icon: Cpu, label: 'Intelligence' },
    { id: 'git', icon: Box, label: 'Repository' },
    { id: 'appearance', icon: Palette, label: 'Aesthetics' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-scrim/60 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        className="relative w-full max-w-3xl h-[600px] overflow-hidden"
      >
        <Surface elevation={3} shape="3xl" className="w-full h-full border border-outline-variant/30 flex shadow-[0_48px_96px_-24px_rgba(0,0,0,0.6)]">
          {/* Navigation Rail */}
          <Surface elevation={1} className="w-64 bg-surface-container-low border-r border-outline-variant/20 flex flex-col p-6">
            <div className="mb-10 flex items-center gap-3 px-2">
              <Surface elevation={2} shape="md" className="w-10 h-10 flex items-center justify-center bg-primary">
                <SettingsIcon size={20} className="text-on-primary" />
              </Surface>
              <div className="flex flex-col">
                <span className="label-large font-bold text-on-surface">Settings</span>
                <span className="label-small text-on-surface-variant opacity-60 uppercase tracking-tighter">Vibe_Sys v2.0</span>
              </div>
            </div>

            <nav className="flex flex-col gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative group h-12 flex items-center px-4 rounded-xl transition-all duration-300"
                >
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="tab-pill"
                      className="absolute inset-0 bg-primary-container rounded-xl -z-10"
                    />
                  )}
                  <tab.icon 
                    size={20} 
                    className={`transition-colors duration-300 ${activeTab === tab.id ? 'text-on-primary-container' : 'text-on-surface-variant opacity-60'}`} 
                  />
                  <span className={`ml-4 label-medium font-bold transition-colors duration-300 ${activeTab === tab.id ? 'text-on-primary-container' : 'text-on-surface-variant opacity-60'}`}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </nav>

            <div className="mt-auto">
              <Button
                variant="tonal"
                size="sm"
                fullWidth
                leadingIcon={LogOut}
                onClick={() => {
                  if(confirm("Purge all local session data?")) {
                    logout();
                    window.location.reload();
                  }
                }}
                className="!text-error !bg-error/5 hover:!bg-error/10"
              >
                Purge Session
              </Button>
            </div>
          </Surface>

          {/* Content Area */}
          <div className="flex-1 flex flex-col bg-surface-container-lowest">
            <header className="h-16 px-8 flex items-center justify-between border-b border-outline-variant/20">
              <h2 className="title-medium font-bold text-on-surface">{tabs.find(t => t.id === activeTab).label}</h2>
              <IconButton icon={X} variant="ghost" size="sm" onClick={onClose} className="opacity-40 hover:opacity-100" />
            </header>

            <div className="flex-1 overflow-y-auto p-10 scrollbar-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="space-y-8"
                >
                  {activeTab === 'agent' && (
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="label-large text-on-surface-variant font-bold ml-1">AI Orchestrator</label>
                        <Surface elevation={1} shape="xl" className="p-5 border border-outline-variant/30 flex items-center justify-between bg-surface-container-high/40">
                          <div className="flex items-center gap-4">
                            <Surface shape="full" className="w-10 h-10 flex items-center justify-center bg-secondary/10">
                              <Cpu size={20} className="text-secondary" />
                            </Surface>
                            <div className="flex flex-col">
                              <span className="body-medium font-mono text-on-surface">gemini-1.5-flash-v2</span>
                              <span className="label-small text-on-surface-variant opacity-40">Active / Optimized for Latency</span>
                            </div>
                          </div>
                          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)]" />
                        </Surface>
                      </div>

                      <div className="space-y-4 p-6 rounded-2xl bg-primary-container/10 border border-primary/10">
                        <div className="flex items-center gap-3 text-primary">
                           <ShieldCheck size={20} />
                           <span className="title-small font-bold uppercase tracking-widest">Autonomous Boundaries</span>
                        </div>
                        <p className="body-medium text-on-surface-variant leading-relaxed opacity-70">
                          The system operates under strict agentic protocols. Every mutation is surgical, 
                          minimizing codebase disruption while maximizing architectural integrity.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'git' && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="label-large text-on-surface-variant font-bold ml-1">Remote Target</label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary opacity-40 group-focus-within:opacity-100 transition-opacity">
                            <Globe size={18} />
                          </div>
                          <input 
                            type="text"
                            value={localRepo}
                            onChange={(e) => setLocalRepo(e.target.value)}
                            placeholder="https://github.com/user/repository"
                            className="w-full h-14 bg-surface-container-high border border-outline-variant/30 rounded-2xl pl-12 pr-6 body-large text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="label-large text-on-surface-variant font-bold ml-1">Access Credential</label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary opacity-40 group-focus-within:opacity-100 transition-opacity">
                            <Lock size={18} />
                          </div>
                          <input 
                            type="password"
                            value={localPat}
                            onChange={(e) => setLocalPat(e.target.value)}
                            placeholder="Personal Access Token (ghp_...)"
                            className="w-full h-14 bg-surface-container-high border border-outline-variant/30 rounded-2xl pl-12 pr-6 body-large text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
                          />
                        </div>
                        <p className="label-small text-on-surface-variant opacity-40 ml-1 italic">
                          Tokens are encrypted and stored locally in your browser's IndexedDB.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'appearance' && (
                    <div className="h-full flex flex-col items-center justify-center gap-6 py-20">
                       <Surface elevation={1} shape="2xl" className="w-24 h-24 flex items-center justify-center border border-outline-variant/20 bg-surface-container-high">
                         <Palette size={40} className="text-primary opacity-20" />
                       </Surface>
                       <div className="text-center space-y-2">
                         <h3 className="title-medium text-on-surface opacity-40">System Aesthetics</h3>
                         <p className="label-medium text-on-surface-variant opacity-30">Vibe_Hub Dark Standard (Material 3 Dynamic)</p>
                       </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <footer className="h-20 px-8 flex items-center justify-end gap-3 border-t border-outline-variant/20 bg-surface-container-low/30 backdrop-blur-md">
              <Button variant="text" size="md" onClick={onClose}>
                Dismiss
              </Button>
              <Button variant="filled" size="md" onClick={handleSave} className="shadow-lg shadow-primary/20">
                Commit Changes
              </Button>
            </footer>
          </div>
        </Surface>
      </motion.div>
    </div>
  );
}

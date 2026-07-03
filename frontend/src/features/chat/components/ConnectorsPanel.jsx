import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plug, 
  Link2, 
  FileUp, 
  Github, 
  ExternalLink, 
  Settings2, 
  CheckCircle2, 
  AlertCircle,
  X,
  Plus,
  Activity
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { Button } from '../../shared/components/Button';
import ApiClient from '../../../services/api';

export default function ConnectorsPanel() {
  const { uploadedFiles, linkedProjects, addProject, setProjects, addUploadedFile } = useStore();
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [mcpServers, setMcpServers] = useState([]);
  const api = new ApiClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reposRes, mcpRes] = await Promise.all([
          api.listRepos(),
          api.listMcpServers()
        ]);
        if (reposRes.success) setProjects(reposRes.repos);
        if (mcpRes.success) setMcpServers(mcpRes.servers);
      } catch (e) {
        console.error("Failed to fetch connectors", e);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex h-full flex-col bg-surface-container-lowest text-on-surface border-l border-outline-variant/30">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-2">
          <Plug size={16} className="text-primary" />
          <span className="text-xs font-black uppercase tracking-[0.15em]">Connectors</span>
        </div>
        <button type="button" aria-label="Connector Settings" className="p-2 hover:bg-surface-container-low rounded-lg transition-colors">
          <Settings2 size={16} className="text-on-surface-variant" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-none">
        {/* Repo Linking */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">Repositories</h3>
            <Github size={14} className="text-on-surface-variant/20" />
          </div>
          <div className="space-y-3">
            <div className="relative">
              <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full h-10 bg-surface-container-low border border-outline-variant/20 rounded-xl pl-4 pr-10 text-xs font-medium focus:outline-none focus:border-primary/40 focus:bg-surface-container-lowest transition-all"
              />
              <button 
                type="button"
                aria-label="Link Repository"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-on-primary rounded-lg shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                disabled={loading || !repoUrl}
                onClick={async () => {
                  if (repoUrl) {
                    setLoading(true);
                    try {
                      const res = await api.linkRepo(repoUrl);
                      if (res.success) {
                        addProject(res.project);
                        setRepoUrl('');
                      }
                    } catch (e) {
                      console.error("Failed to link repo", e);
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
              >
                {loading ? <Activity size={14} className="animate-spin" /> : <Link2 size={14} />}
              </button>
            </div>
            
            <div className="space-y-2">
              {linkedProjects.map(project => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-surface-container-low/40 rounded-xl border border-outline-variant/10">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Github size={14} className="text-on-surface-variant" />
                    <span className="text-xs font-bold truncate">{project.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-google-green" />
                    <button type="button" aria-label={`Remove repository ${project.name}`} className="text-on-surface-variant/40 hover:text-google-red transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MCP Servers */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">MCP Systems</h3>
            <Button variant="tonal" size="xs" className="!h-6 !px-2 !rounded-lg border-none bg-primary/10 text-primary">
              <Plus size={12} className="mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-3">
            {mcpServers.map(server => (
              <div key={server.id} className="group p-3 bg-surface-container-low/40 rounded-xl border border-outline-variant/10 hover:border-primary/20 transition-all">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold">{server.name}</span>
                  <div className={`h-1.5 w-1.5 rounded-full ${server.status === 'connected' ? 'bg-google-green shadow-[0_0_8px_rgba(52,168,83,0.5)]' : 'bg-on-surface-variant/30'}`} />
                </div>
                <p className="text-[10px] font-medium text-on-surface-variant/60 leading-relaxed">{server.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* File Assets */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">File Assets</h3>
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={(e) => {
                const file = e.target.files[0];
                if (file) addUploadedFile({ id: Date.now().toString(), name: file.name, size: file.size });
              }} />
              <FileUp size={14} className="text-on-surface-variant/40 hover:text-primary transition-colors" />
            </label>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {uploadedFiles.map(file => (
              <div key={file.id} className="flex items-center gap-3 p-2.5 bg-surface-container-low/40 rounded-xl border border-outline-variant/10 group">
                <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileUp size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate">{file.name}</p>
                  <p className="text-[9px] font-medium text-on-surface-variant/40">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" aria-label={`Remove file ${file.name}`} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-google-red/10 hover:text-google-red rounded-lg transition-all">
                  <X size={12} />
                </button>
              </div>
            ))}
            
            {uploadedFiles.length === 0 && (
              <div className="border-2 border-dashed border-outline-variant/20 rounded-2xl p-6 text-center">
                <FileUp size={24} className="mx-auto mb-3 text-on-surface-variant/10" />
                <p className="text-[10px] font-medium text-on-surface-variant/30">Drop files to index</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Connection Info */}
      <div className="p-4 bg-surface-container-low/30 border-t border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AlertCircle size={14} className="text-google-yellow" />
            <div className="absolute inset-0 bg-google-yellow/20 blur-sm rounded-full" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-variant/80">Local sandbox isolation active</span>
        </div>
      </div>
    </div>
  );
}

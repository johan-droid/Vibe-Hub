import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  FolderGit2,
  GitPullRequest,
  LayoutPanelLeft,
  Loader2,
  PanelRight,
  PlugZap,
  RefreshCw,
  Settings2,
  TerminalSquare,
} from 'lucide-react';
import { useAgent } from '../hooks/useAgent';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useStore } from '../store/useStore';
import { initializeVfsSocket, useVfsStore } from '../store/useVfsStore';
import { api } from '../services/api';
import { ResizeHandle } from '../features/shared/components/ResizeHandle';
import SettingsModal from '../features/shared/components/SettingsModal';
import ApprovalGateModal from '../features/dashboard/components/ApprovalGateModal';
import ActivityFeed from '../features/dashboard/components/ActivityFeed';
import ChatHistorySidebar from '../features/chat/components/ChatHistorySidebar';
import ChatInterface from '../features/chat/components/ChatInterface';
import TerminalSessionsPanel from '../features/terminal/components/TerminalSessionsPanel';
import DiffViewer from '../features/editor/components/DiffViewer';

const MIN_LEFT = 260;
const MAX_LEFT = 420;
const MIN_RIGHT = 340;
const MAX_RIGHT = 560;
const DEFAULT_LEFT = 290;
const DEFAULT_RIGHT = 420;

function Pill({ icon: Icon, label, value, tone = 'default' }) {
  const toneClass = tone === 'warning'
    ? 'border-amber-400/25 bg-amber-400/10 text-amber-200'
    : 'border-outline-variant/50 bg-surface-container-low text-on-surface-variant';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClass}`}>
      <Icon size={13} />
      <span>{label}</span>
      {value !== undefined && value !== null && <span className="text-on-surface">{value}</span>}
    </div>
  );
}

function ContextSection({ title, action, children }) {
  return (
    <section className="rounded-3xl border border-outline-variant/50 bg-surface-container-lowest">
      <header className="flex items-center justify-between border-b border-outline-variant/40 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{title}</h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ContextPanel({ repos, uploads, mcpServers, diagnostics, loading, compact = false, onRefresh }) {
  return (
    <div className={`space-y-4 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-outline-variant/50 bg-surface-container-low px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <FolderGit2 size={16} className="text-primary" />
            Repositories
          </div>
          <p className="mt-2 text-2xl font-semibold text-on-surface">{repos.length}</p>
          <p className="mt-1 text-xs text-on-surface-variant">Cloned and indexed for agent context.</p>
        </div>

        <div className="rounded-3xl border border-outline-variant/50 bg-surface-container-low px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <PlugZap size={16} className="text-primary" />
            MCP Tools
          </div>
          <p className="mt-2 text-2xl font-semibold text-on-surface">{diagnostics?.toolCount ?? 0}</p>
          <p className="mt-1 text-xs text-on-surface-variant">Across {diagnostics?.serverCount ?? mcpServers.length} connected servers.</p>
        </div>
      </div>

      <ContextSection
        title="Live Context"
        action={
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-outline-variant/50 p-2 text-on-surface-variant transition hover:text-on-surface"
            aria-label="Refresh context"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">Repositories</p>
            {repos.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No repositories linked yet.</p>
            ) : (
              <div className="space-y-2">
                {repos.map((repo) => (
                  <div key={repo.id} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low px-3 py-3">
                    <div className="text-sm font-semibold text-on-surface">{repo.name}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">{repo.path}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">Uploads</p>
            {uploads.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No files or images imported yet.</p>
            ) : (
              <div className="space-y-2">
                {uploads.slice(-10).map((file) => (
                  <div key={file.id} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low px-3 py-3">
                    <div className="text-sm font-semibold text-on-surface">{file.name}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">{file.path || 'Imported into the workspace'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">MCP Connectors</p>
            {mcpServers.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No MCP servers are registered yet.</p>
            ) : (
              <div className="space-y-2">
                {mcpServers.map((server) => (
                  <div key={server.name} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-on-surface">{server.name}</div>
                      <span className={`inline-flex h-2.5 w-2.5 rounded-full ${server.status === 'connected' ? 'bg-emerald-400' : server.status === 'degraded' ? 'bg-amber-300' : 'bg-red-400'}`} />
                    </div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      {server.toolCount || 0} tools
                      {server.lastError ? ` · ${server.lastError}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ContextSection>
    </div>
  );
}

export default function Workspace() {
  const isMobile = useMediaQuery('(max-width: 900px)');
  const { sendPrompt, sendPlanApproval } = useAgent();
  const {
    user,
    sidebarCollapsed,
    setSidebarCollapsed,
    chatCollapsed,
    setChatCollapsed,
    orchestratorEvents,
    linkedProjects,
    uploadedFiles,
    terminalPanelVisible,
    toggleTerminalPanel,
    pendingApproval,
    settings,
    setProjects,
    diffData,
  } = useStore();
  const { pendingFiles, activeDiff, fetchPendingFiles } = useVfsStore();

  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('activity');
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpDiagnostics, setMcpDiagnostics] = useState(null);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  const pendingDiffCount = pendingFiles.length + (Array.isArray(diffData) ? diffData.length : diffData ? 1 : 0);
  const effectiveExperienceMode = settings.workflow?.experienceMode || 'professional';

  const refreshConnections = useCallback(async () => {
    setConnectionsLoading(true);
    try {
      const [repoResponse, serverResponse, diagnosticsResponse] = await Promise.all([
        api.listRepos(),
        api.listMcpServers(),
        api.mcpDiagnostics(),
      ]);

      if (repoResponse?.success) {
        setProjects(repoResponse.repos || []);
      }
      if (serverResponse?.success) {
        setMcpServers(serverResponse.servers || []);
      }
      if (diagnosticsResponse?.success || diagnosticsResponse?.diagnostics) {
        setMcpDiagnostics(diagnosticsResponse.diagnostics || diagnosticsResponse);
      }
      await fetchPendingFiles();
    } catch (error) {
      console.error('Failed to refresh workspace connections:', error);
    } finally {
      setConnectionsLoading(false);
    }
  }, [fetchPendingFiles, setProjects]);

  useEffect(() => {
    initializeVfsSocket(user?.id || null);
  }, [user?.id]);

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  useEffect(() => {
    if ((activeDiff || diffData) && chatCollapsed) {
      setChatCollapsed(false);
    }
  }, [activeDiff, chatCollapsed, diffData, setChatCollapsed]);

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
      setChatCollapsed(true);
      setMobileInspectorOpen(false);
    }
  }, [isMobile, setChatCollapsed, setSidebarCollapsed]);

  const onLeftDrag = useCallback((delta) => {
    setLeftWidth((current) => Math.max(MIN_LEFT, Math.min(MAX_LEFT, current + delta)));
  }, []);

  const onRightDrag = useCallback((delta) => {
    setRightWidth((current) => Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, current - delta)));
  }, []);

  const liveEventCount = orchestratorEvents.length;
  const latestEvent = useMemo(() => orchestratorEvents[orchestratorEvents.length - 1] || null, [orchestratorEvents]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-surface text-on-surface">
      <header className="border-b border-outline-variant/50 bg-surface-container-low/80 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/50 bg-surface-container-low text-on-surface-variant transition hover:text-on-surface"
              aria-label="Toggle history panel"
            >
              <LayoutPanelLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-on-surface">Workspace</h1>
              <p className="text-sm text-on-surface-variant">
                {latestEvent?.summary || (isMobile ? 'Chat and review updates.' : 'Chat, clone, diff, and review changes from one place.')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isMobile && (
              <>
                <Pill icon={Activity} label="Events" value={liveEventCount} />
                <Pill icon={GitPullRequest} label="Pending Diffs" value={pendingDiffCount} tone={pendingDiffCount > 0 ? 'warning' : 'default'} />
                <Pill icon={FolderGit2} label="Repos" value={linkedProjects.length} />
                <Pill icon={PlugZap} label="MCP Servers" value={mcpDiagnostics?.serverCount ?? mcpServers.length} />

                <button
                  type="button"
                  onClick={toggleTerminalPanel}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/50 bg-surface-container-low text-on-surface-variant transition hover:text-on-surface"
                  aria-label="Toggle terminal panel"
                >
                  <TerminalSquare size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setChatCollapsed((value) => !value)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/50 bg-surface-container-low text-on-surface-variant transition hover:text-on-surface"
                  aria-label="Toggle live inspector"
                >
                  <PanelRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/50 bg-surface-container-low text-on-surface-variant transition hover:text-on-surface"
                  aria-label="Open settings"
                >
                  <Settings2 size={18} />
                </button>
              </>
            )}

            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileInspectorOpen((value) => !value)}
                className="flex h-10 items-center gap-2 rounded-2xl border border-outline-variant/50 bg-surface-container-low px-3 text-sm font-medium text-on-surface-variant transition hover:text-on-surface"
                aria-label="Toggle activity panel"
              >
                <PanelRight size={16} />
                {mobileInspectorOpen ? 'Hide activity' : 'Show activity'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && !isMobile && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: leftWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="relative flex h-full shrink-0 overflow-hidden border-r border-outline-variant/50 bg-surface-container-lowest"
            >
              <ChatHistorySidebar />
              <ResizeHandle direction="horizontal" onDrag={onLeftDrag} className="absolute right-0 top-0 h-full" />
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ChatInterface onSend={sendPrompt} onContextChange={refreshConnections} />
          <AnimatePresence initial={false}>
            {terminalPanelVisible && <TerminalSessionsPanel />}
          </AnimatePresence>

          {isMobile && mobileInspectorOpen && (
            <div className="border-t border-outline-variant/50 bg-surface-container-lowest">
              <div className="flex items-center gap-2 border-b border-outline-variant/40 px-3 py-3">
                {[
                  { id: 'activity', label: 'Activity' },
                  { id: 'context', label: 'Context' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInspectorTab(tab.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      inspectorTab === tab.id
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-outline-variant/50 bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="max-h-[42vh] overflow-y-auto">
                {inspectorTab === 'activity' && (
                  <ActivityFeed
                    agentLoopStatus={{ history: orchestratorEvents, currentIteration: 0 }}
                    events={orchestratorEvents}
                    experienceMode={effectiveExperienceMode}
                    onExpandTerminal={toggleTerminalPanel}
                  />
                )}

                {inspectorTab === 'context' && (
                  <ContextPanel
                    repos={linkedProjects}
                    uploads={uploadedFiles}
                    mcpServers={mcpServers}
                    diagnostics={mcpDiagnostics}
                    loading={connectionsLoading}
                    compact
                    onRefresh={refreshConnections}
                  />
                )}
              </div>
            </div>
          )}
        </main>

        <AnimatePresence initial={false}>
          {!chatCollapsed && !isMobile && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: rightWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="relative flex h-full shrink-0 overflow-hidden border-l border-outline-variant/50 bg-surface-container-lowest"
            >
              <ResizeHandle direction="horizontal" onDrag={onRightDrag} className="absolute left-0 top-0 h-full" />

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex h-[47%] min-h-[18rem] flex-col border-b border-outline-variant/50">
                  <div className="flex items-center justify-between border-b border-outline-variant/40 px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold text-on-surface">Live Diff</h2>
                      <p className="text-xs text-on-surface-variant">Staged file changes stream here for approval.</p>
                    </div>
                    <Pill icon={GitPullRequest} label="Queue" value={pendingDiffCount} tone={pendingDiffCount > 0 ? 'warning' : 'default'} />
                  </div>
                  <div className="min-h-0 flex-1">
                    <DiffViewer
                      onApply={() => useStore.getState().setDiffData(null)}
                      onDiscard={() => useStore.getState().setDiffData(null)}
                    />
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center gap-2 border-b border-outline-variant/40 px-4 py-3">
                    {[
                      { id: 'activity', label: 'Activity' },
                      { id: 'context', label: 'Context' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setInspectorTab(tab.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          inspectorTab === tab.id
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-outline-variant/50 bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="min-h-0 flex-1">
                    {inspectorTab === 'activity' && (
                      <ActivityFeed
                        agentLoopStatus={{ history: orchestratorEvents, currentIteration: 0 }}
                        events={orchestratorEvents}
                        experienceMode={effectiveExperienceMode}
                        onExpandTerminal={toggleTerminalPanel}
                      />
                    )}

                    {inspectorTab === 'context' && (
                      <ContextPanel
                        repos={linkedProjects}
                        uploads={uploadedFiles}
                        mcpServers={mcpServers}
                        diagnostics={mcpDiagnostics}
                        loading={connectionsLoading}
                        onRefresh={refreshConnections}
                      />
                    )}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingApproval && (
          <ApprovalGateModal
            approval={pendingApproval}
            experienceMode={effectiveExperienceMode}
            onResolve={(approved) => sendPlanApproval(pendingApproval.planId, approved)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

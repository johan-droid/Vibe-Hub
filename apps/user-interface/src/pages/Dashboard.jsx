import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pause, 
  Square, 
  RotateCcw, 
  CheckCircle,
  ChevronRight,
  Terminal,
  Activity,
  Clock,
  Zap,
  Brain,
  Command
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAgent } from '../hooks/useAgent';
import { VFSContainer } from '../vfs/container.js';

// Import new components
import AgentStatusBar from '../features/dashboard/components/AgentStatusBar';
import IntentChatPanel from '../features/dashboard/components/IntentChatPanel';
import CodeCanvas from '../features/dashboard/components/CodeCanvas';
import ActivityFeed from '../features/dashboard/components/ActivityFeed';
import PeekTerminal from '../features/dashboard/components/PeekTerminal';
import AgentActionOverlay from '../features/dashboard/components/AgentActionOverlay';
import ToolVisualizer from '../features/dashboard/components/ToolVisualizer';
import ApprovalGateModal from '../features/dashboard/components/ApprovalGateModal';
import SettingsModal from '../features/shared/components/SettingsModal';

export default function Dashboard() {
  const [panelSizes, setPanelSizes] = useState({
    left: 320,
    center: 'flex-1',
    right: 380
  });
  
  const [isDragging, setIsDragging] = useState(null);
  const [showTerminalOverlay, setShowTerminalOverlay] = useState(false);
  const [showAgentOverlay, setShowAgentOverlay] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [vfsInstance, setVfsInstance] = useState(null);
  
  const {
    agentLoopStatus,
    orchestratorEvents,
    toolGraph,
    workspaceMode,
    setWorkspaceMode,
    experienceMode,
    autonomyLevel,
    pendingApproval,
    diffData,
    messages,
    isThinking,
    neuralStatus,
    terminalSessions,
    settings,
    vfsInstance: storeVfsInstance,
    setVfsInstance: setStoreVfsInstance
  } = useStore();
  
  const { sendPrompt, sendPlanApproval } = useAgent();
  const containerRef = useRef(null);
  const effectiveExperienceMode = settings.workflow?.experienceMode || experienceMode || 'professional';

  // Use VFS from store or initialize if not available
  useEffect(() => {
    if (storeVfsInstance) {
      setVfsInstance(storeVfsInstance);
      return;
    }

    const initializeVFS = async () => {
      try {
        const vfs = new VFSContainer();
        await vfs.boot();
        setVfsInstance(vfs);
        setStoreVfsInstance(vfs);
      } catch (error) {
        console.error('Failed to initialize VFS:', error);
      }
    };

    initializeVFS();
  }, [storeVfsInstance, setStoreVfsInstance]);

  // Handle panel resizing
  const handleMouseDown = (panel) => {
    setIsDragging(panel);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;

      if (isDragging === 'left-center') {
        const newLeftSize = Math.max(280, Math.min(500, x));
        setPanelSizes(prev => ({
          ...prev,
          left: newLeftSize
        }));
      } else if (isDragging === 'center-right') {
        const newRightSize = Math.max(300, Math.min(500, rect.width - x));
        setPanelSizes(prev => ({
          ...prev,
          right: newRightSize
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Auto-show agent overlay for long tasks
  useEffect(() => {
    if (isThinking && !showAgentOverlay) {
      const timer = setTimeout(() => setShowAgentOverlay(true), 2000);
      return () => clearTimeout(timer);
    } else if (!isThinking) {
      setShowAgentOverlay(false);
    }
  }, [isThinking, showAgentOverlay]);

  const handleSendMessage = useCallback(async (message) => {
    await sendPrompt(message);
  }, [sendPrompt]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[linear-gradient(180deg,#0D1117_0%,#080A0F_100%)] font-sans text-white">
      {/* Agent Status Bar */}
      <AgentStatusBar 
        isRunning={agentLoopStatus.isRunning}
        sessionNumber={14}
        retryCount={agentLoopStatus.currentIteration}
        neuralStatus={neuralStatus}
        onPause={() => console.log('Pause')}
        onStop={() => console.log('Stop')}
        onReset={() => console.log('Reset')}
        onAcceptAll={() => console.log('Accept All')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsSettingsOpen(true)} // Can add specific profile logic later
        experienceMode={effectiveExperienceMode}
        autonomyLevel={autonomyLevel}
      />

      {/* Main Dashboard */}
      <div 
        ref={containerRef}
        className="relative flex flex-1 overflow-hidden"
        style={{ minHeight: 0 }}
      >
        {/* Left Panel - Intent & Chat */}
        <div 
          className="flex flex-col border-r border-white/10 bg-[#0B0E14]/70 backdrop-blur-sm"
          style={{ width: panelSizes.left, minWidth: 280, maxWidth: 500 }}
        >
          <IntentChatPanel 
            messages={messages}
            onSendMessage={handleSendMessage}
            isThinking={isThinking}
          />
        </div>

        {/* Left-Center Resizer */}
        <div
          className={`w-1 cursor-col-resize bg-white/[0.04] transition-colors hover:bg-[#43F3C5]/40 ${
            isDragging === 'left-center' ? 'bg-[#43F3C5]/70' : ''
          }`}
          onMouseDown={() => handleMouseDown('left-center')}
        />

        {/* Center Panel - Code Canvas */}
        <div className="flex-1 flex flex-col bg-[#0D1117]/80 backdrop-blur-sm">
          <CodeCanvas 
            diffData={diffData}
            agentLoopStatus={agentLoopStatus}
            vfsInstance={vfsInstance}
            workspaceMode={workspaceMode}
            setWorkspaceMode={setWorkspaceMode}
            experienceMode={effectiveExperienceMode}
            toolGraph={toolGraph}
          />
        </div>

        {/* Center-Right Resizer */}
        <div
          className={`w-1 cursor-col-resize bg-white/[0.04] transition-colors hover:bg-[#43F3C5]/40 ${
            isDragging === 'center-right' ? 'bg-[#43F3C5]/70' : ''
          }`}
          onMouseDown={() => handleMouseDown('center-right')}
        />

        {/* Right Panel - Activity Feed */}
        <div 
          className="flex flex-col border-l border-white/10 bg-[#0B0E14]/70 backdrop-blur-sm"
          style={{ width: panelSizes.right, minWidth: 300, maxWidth: 500 }}
        >
          <div className={effectiveExperienceMode === 'learner' ? 'h-[34%] min-h-[13rem]' : 'h-[42%] min-h-[15rem]'}>
            <ToolVisualizer
              toolGraph={toolGraph}
              experienceMode={effectiveExperienceMode}
              compact={effectiveExperienceMode === 'learner'}
            />
          </div>
          <ActivityFeed 
            agentLoopStatus={agentLoopStatus}
            vfsInstance={vfsInstance}
            onExpandTerminal={() => setShowTerminalOverlay(true)}
            events={orchestratorEvents}
            experienceMode={effectiveExperienceMode}
          />
        </div>
      </div>

      {/* Bottom Strip - Peek Terminal */}
      <PeekTerminal 
        onExpand={() => setShowTerminalOverlay(true)}
        agentLoopStatus={agentLoopStatus}
        vfsInstance={vfsInstance}
      />

      {/* Terminal Overlay */}
      <AnimatePresence>
        {showTerminalOverlay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 flex items-end bg-black/65 backdrop-blur-md"
            onClick={() => setShowTerminalOverlay(false)}
          >
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: '70vh' }}
              exit={{ height: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="w-full border-t border-white/10 bg-[#0D1117]/95 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <Terminal className="text-[#43F3C5]" size={20} />
                  <h3 className="font-semibold">Sandbox Terminal</h3>
                  <span className="text-xs text-white/45">Read-only local Docker view</span>
                </div>
                <button
                  onClick={() => setShowTerminalOverlay(false)}
                  className="rounded-md p-2 text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <ChevronRight className="rotate-90" size={16} />
                </button>
              </div>
              
              {/* Terminal content would go here */}
              <div className="h-full overflow-y-auto p-4 font-mono text-sm text-[#43F3C5]">
                <div className="space-y-1">
                  <div>$ python app.py</div>
                  <div className="text-[#F7C35F]">Running...</div>
                  <div className="text-[#43F3C5]">Health endpoint ready on port 8000</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Action Overlay */}
      <AnimatePresence>
        {showAgentOverlay && (
          <AgentActionOverlay 
            isThinking={isThinking}
            neuralStatus={neuralStatus}
            onDismiss={() => setShowAgentOverlay(false)}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
          />
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

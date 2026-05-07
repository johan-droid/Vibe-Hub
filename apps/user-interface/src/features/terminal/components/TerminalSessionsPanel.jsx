import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, 
  Plus, 
  Trash2, 
  Play, 
  Square, 
  ChevronDown, 
  ChevronRight,
  Activity,
  Cpu,
  Zap,
  Monitor,
  Command
} from 'lucide-react';
import { useStore } from '../../../store/useStore';

// ANSI color parsing
const ANSI_CLASSES = {
  '\x1b[0m': 'text-on-surface-variant/60',
  '\x1b[1m': 'font-bold',
  '\x1b[31m': 'text-red-500',
  '\x1b[32m': 'text-green-500',
  '\x1b[33m': 'text-yellow-500',
  '\x1b[34m': 'text-blue-500',
  '\x1b[35m': 'text-purple-500',
  '\x1b[36m': 'text-cyan-500',
  '\x1b[37m': 'text-on-surface',
};

function parseAnsi(text) {
  const parts = text.split(/(\x1b\[[0-9;]*m)/g);
  const segments = [];
  let currentClass = 'text-on-surface-variant/60';
  
  for (const part of parts) {
    if (part in ANSI_CLASSES) {
      currentClass = ANSI_CLASSES[part];
    } else if (part && !part.startsWith('\x1b[')) {
      segments.push({ text: part, className: currentClass });
    }
  }
  return segments;
}

const TerminalOutput = React.memo(({ output, sessionId }) => {
  const scrollRef = useRef(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto font-mono text-xs bg-black/90 text-green-400 p-3 space-y-1"
      style={{ minHeight: '200px', maxHeight: '400px' }}
    >
      {output.length === 0 ? (
        <div className="flex items-center justify-center h-full opacity-50">
          <Terminal size={16} className="mr-2" />
          <span>Terminal ready. Type a command to begin...</span>
        </div>
      ) : (
        output.map((line, i) => (
          <div key={i} className="flex items-start">
            {line.type === 'stdout' && (
              <span className="flex-shrink-0 mr-2 opacity-50">$</span>
            )}
            {line.type === 'stderr' && (
              <span className="flex-shrink-0 mr-2 text-red-500">!</span>
            )}
            {line.type === 'command_complete' && (
              <span className="flex-shrink-0 mr-2 opacity-50">✓</span>
            )}
            {line.type === 'error' && (
              <span className="flex-shrink-0 mr-2 text-red-500">✗</span>
            )}
            <span className="flex-1 break-all">
              {parseAnsi(String(line.data)).map((seg, j) => (
                <span key={j} className={seg.className}>
                  {seg.text}
                </span>
              ))}
            </span>
          </div>
        ))
      )}
    </div>
  );
});

const SessionHeader = React.memo(({ session, isActive, onToggle, onKill, onSelect }) => (
  <div
    className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
      isActive ? 'bg-surface-container' : 'hover:bg-surface-container/50'
    }`}
    onClick={() => onSelect(session.id)}
  >
    <div className="flex items-center gap-3">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(session.id);
        }}
        className="p-1 hover:bg-surface-variant rounded transition-colors"
      >
        {isActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`} />
        <Terminal size={14} className="text-on-surface-variant" />
        <span className="text-sm font-medium">{session.name}</span>
        <span className="text-xs text-on-surface-variant/60">
          {session.shell || '/bin/bash'}
        </span>
      </div>
    </div>
    
    <div className="flex items-center gap-2">
      <span className="text-xs text-on-surface-variant/40">
        {session.outputCount || 0} lines
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onKill(session.id);
        }}
        className="p-1 hover:bg-red-500/20 text-red-500 rounded transition-colors"
        disabled={!session.isActive}
      >
        <Square size={12} />
      </button>
    </div>
  </div>
));

export default function TerminalSessionsPanel() {
  const {
    terminalSessions,
    activeTerminalSession,
    terminalPanelVisible,
    addTerminalSession,
    removeTerminalSession,
    setActiveTerminalSession,
    clearTerminalSession,
    toggleTerminalPanel,
    setTerminalPanelVisible
  } = useStore();

  const [commandInput, setCommandInput] = useState('');
  const [expandedSessions, setExpandedSessions] = useState(new Set());

  const sessions = Array.from(terminalSessions.values());
  const activeSession = terminalSessions.get(activeTerminalSession);

  const toggleSession = useCallback((sessionId) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const executeCommand = useCallback(async (sessionId, command) => {
    if (!command.trim()) return;
    
    // This would integrate with the agent to execute commands
    // For now, just add to output as a demo
    const session = terminalSessions.get(sessionId);
    if (session) {
      const newOutput = [
        { type: 'stdout', data: command, timestamp: new Date() },
        { type: 'stdout', data: `Command executed: ${command}`, timestamp: new Date() },
        { type: 'command_complete', command, exitCode: 0, timestamp: new Date() }
      ];
      
      // Update session output
      const updatedSession = {
        ...session,
        output: [...session.output, ...newOutput].slice(-1000),
        lastActivity: new Date()
      };
      
      addTerminalSession(updatedSession);
    }
    
    setCommandInput('');
  }, [terminalSessions, addTerminalSession]);

  const createNewSession = useCallback(() => {
    const newSession = {
      id: `term_${Date.now()}`,
      name: `Terminal ${sessions.length + 1}`,
      shell: '/bin/bash',
      isActive: true,
      output: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      outputCount: 0
    };
    
    addTerminalSession(newSession);
    setExpandedSessions(prev => new Set([...prev, newSession.id]));
  }, [sessions.length, addTerminalSession]);

  const killSession = useCallback((sessionId) => {
    const session = terminalSessions.get(sessionId);
    if (session) {
      const updatedSession = {
        ...session,
        isActive: false,
        output: [...session.output, {
          type: 'killed',
          data: 'Session terminated',
          timestamp: new Date()
        }]
      };
      
      addTerminalSession(updatedSession);
    }
  }, [terminalSessions, addTerminalSession]);

  if (!terminalPanelVisible) {
    return null;
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-t border-outline-variant bg-surface-container-lowest overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-outline-variant bg-surface-container">
        <div className="flex items-center gap-3">
          <Terminal size={16} className="text-primary" />
          <span className="text-sm font-bold uppercase tracking-wide">Terminal Sessions</span>
          <span className="text-xs text-on-surface-variant/60">
            {sessions.filter(s => s.isActive).length} active
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={createNewSession}
            className="p-1.5 hover:bg-surface-variant rounded transition-colors"
            title="New Terminal"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={toggleTerminalPanel}
            className="p-1.5 hover:bg-surface-variant rounded transition-colors"
            title="Close Panel"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="max-h-96 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Terminal size={32} className="text-on-surface-variant/20 mb-4" />
            <h3 className="text-sm font-medium text-on-surface-variant mb-2">No Terminal Sessions</h3>
            <p className="text-xs text-on-surface-variant/40 mb-4">
              Create a terminal session to start testing commands
            </p>
            <button
              onClick={createNewSession}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus size={14} />
              Create Terminal
            </button>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="border-b border-outline-variant/20">
              <SessionHeader
                session={session}
                isActive={expandedSessions.has(session.id)}
                onToggle={toggleSession}
                onKill={killSession}
                onSelect={setActiveTerminalSession}
              />
              
              <AnimatePresence>
                {expandedSessions.has(session.id) && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <TerminalOutput
                      output={session.output || []}
                      sessionId={session.id}
                    />
                    
                    {session.isActive && (
                      <div className="p-3 border-t border-outline-variant/20 bg-black/90">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-mono text-sm">$</span>
                          <input
                            type="text"
                            value={activeTerminalSession === session.id ? commandInput : ''}
                            onChange={(e) => setCommandInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && activeTerminalSession === session.id) {
                                executeCommand(session.id, commandInput);
                              }
                            }}
                            onFocus={() => setActiveTerminalSession(session.id)}
                            placeholder="Type command..."
                            className="flex-1 bg-transparent text-green-400 font-mono text-sm outline-none placeholder-green-400/50"
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

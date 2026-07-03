import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Square, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Terminal,
  Code,
  Zap,
  Clock,
  Target
} from 'lucide-react';
import { useStore } from '../../../store/useStore';

const statusIcons = {
  info: <AlertCircle className="text-blue-500" size={16} />,
  success: <CheckCircle className="text-green-500" size={16} />,
  error: <XCircle className="text-red-500" size={16} />,
  warning: <AlertCircle className="text-yellow-500" size={16} />
};

const statusColors = {
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
  success: 'bg-green-500/10 border-green-500/20 text-green-500',
  error: 'bg-red-500/10 border-red-500/20 text-red-500',
  warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
};

export default function AgentLoopProgress({ 
  isRunning, 
  currentIteration, 
  maxIterations,
  history,
  onStart,
  onStop,
  onClear 
}) {
  const [expanded, setExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = React.useRef(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, autoScroll]);

  const progress = maxIterations > 0 ? (currentIteration / maxIterations) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container-low rounded-xl border border-outline-variant/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-outline-variant/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isRunning ? 'bg-blue-500/20' : 'bg-surface-variant'
            }`}>
              {isRunning ? (
                <RefreshCw className="text-blue-500 animate-spin" size={20} />
              ) : (
                <Terminal className="text-on-surface-variant" size={20} />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-on-surface">Agent Loop</h3>
              <p className="text-sm text-on-surface-variant">
                {isRunning ? 'Running automated fixes...' : 'Ready to execute'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <button
                onClick={onStart}
                className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Play size={14} />
                Start
              </button>
            ) : (
              <button
                onClick={onStop}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Square size={14} />
                Stop
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-surface-variant rounded transition-colors"
            >
              {expanded ? 'Hide' : 'Show'} Details
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">
                Iteration {currentIteration} of {maxIterations}
              </span>
              <span className="text-on-surface-variant">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${progress}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="rounded"
                    />
                    Auto-scroll
                  </label>
                  <button
                    onClick={onClear}
                    className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    Clear History
                  </button>
                </div>
                <div className="text-sm text-on-surface-variant">
                  {history.length} events
                </div>
              </div>

              {/* Event Log */}
              <div
                ref={scrollRef}
                className="bg-surface-container rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs space-y-1"
              >
                {history.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-on-surface-variant/40">
                    <div className="text-center">
                      <Code size={24} className="mx-auto mb-2 opacity-50" />
                      <p>No events yet</p>
                    </div>
                  </div>
                ) : (
                  history.map((event, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-2 rounded-lg border ${statusColors[event.level]}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {statusIcons[event.level]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium uppercase opacity-60">
                            Iteration {event.iteration || '-'}
                          </span>
                          <span className="text-xs opacity-40">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm break-words">{event.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

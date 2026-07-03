/**
 * Debug Panel Component
 * 
 * Provides:
 * - Enable/disable test mode
 * - View logs
 * - Export logs
 * - Test logging functionality
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bug, 
  X, 
  Download, 
  Trash2, 
  Play, 
  Settings,
  ChevronDown,
  ChevronUp,
  Terminal
} from 'lucide-react';
import { logger } from '../utils/logger';
import { api } from '../services/api';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState(null);
  const [filter, setFilter] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [expandedLogs, setExpandedLogs] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
      refreshConfig();
    }
  }, [isOpen]);

  const refreshLogs = () => {
    const allLogs = logger.getLogs();
    setLogs(allLogs);
  };

  const refreshConfig = () => {
    setConfig(logger.getConfig());
  };

  const handleClearLogs = () => {
    logger.clearLogs();
    refreshLogs();
  };

  const handleExportLogs = () => {
    logger.exportLogs();
  };

  const handleToggleTestMode = () => {
    const newMode = !config?.testMode;
    logger.setTestMode(newMode);
    refreshConfig();
    refreshLogs();
  };

  const handleTestLog = (level) => {
    logger[level]('DebugPanel', `Test ${level} message`, { test: true, timestamp: Date.now() });
    refreshLogs();
  };

  const toggleLogExpand = (index) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === '' || 
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.component.toLowerCase().includes(filter.toLowerCase());
    
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    
    return matchesFilter && matchesLevel;
  }).slice(-200); // Last 200 logs

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-3 rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700 transition-colors"
        title="Open Debug Panel"
      >
        <Bug size={20} />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-4 right-4 z-50 w-[600px] max-w-[90vw] bg-surface-container-high rounded-xl shadow-2xl border border-outline-variant overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-2">
          <Bug size={18} className="text-purple-400" />
          <span className="font-semibold">Debug Panel</span>
          {config?.testMode && (
            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full">
              Test Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportLogs}
            className="p-2 hover:bg-surface-container rounded-lg transition-colors"
            title="Export logs"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleClearLogs}
            className="p-2 hover:bg-surface-container rounded-lg transition-colors text-error"
            title="Clear logs"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-surface-container rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-outline-variant space-y-3">
        {/* Test Mode Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-on-surface-variant">Test Mode</span>
          <button
            onClick={handleToggleTestMode}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config?.testMode ? 'bg-purple-500' : 'bg-surface-container'
            }`}
          >
            <motion.div
              animate={{ x: config?.testMode ? 24 : 4 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white"
            />
          </button>
        </div>

        {/* Test Log Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-on-surface-variant">Test:</span>
          {['debug', 'info', 'warn', 'error'].map((level) => (
            <button
              key={level}
              onClick={() => handleTestLog(level)}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                level === 'error' ? 'bg-error/10 text-error hover:bg-error/20' :
                level === 'warn' ? 'bg-warning/10 text-warning hover:bg-warning/20' :
                level === 'debug' ? 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high' :
                'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm bg-surface-container rounded-lg border border-outline-variant focus:border-primary outline-none"
          />
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3 py-1.5 text-sm bg-surface-container rounded-lg border border-outline-variant outline-none"
          >
            <option value="all">All Levels</option>
            <option value="DEBUG">Debug</option>
            <option value="INFO">Info</option>
            <option value="WARN">Warn</option>
            <option value="ERROR">Error</option>
          </select>
          <button
            onClick={refreshLogs}
            className="p-1.5 hover:bg-surface-container rounded-lg transition-colors"
          >
            <Terminal size={16} />
          </button>
        </div>
      </div>

      {/* Log List */}
      <div className="max-h-[400px] overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            <Terminal size={48} className="mx-auto mb-4 opacity-50" />
            <p>No logs to display</p>
            <p className="text-sm mt-1">Enable test mode to capture detailed logs</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/50">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                onClick={() => toggleLogExpand(index)}
                className={`p-3 cursor-pointer hover:bg-surface-container/50 transition-colors ${
                  log.level === 'ERROR' ? 'bg-error/5' :
                  log.level === 'WARN' ? 'bg-warning/5' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-mono ${
                    log.level === 'ERROR' ? 'text-error' :
                    log.level === 'WARN' ? 'text-warning' :
                    log.level === 'DEBUG' ? 'text-on-surface-variant' :
                    'text-primary'
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs text-on-surface-variant">[{log.component}]</span>
                  <span className="text-sm flex-1">{log.message}</span>
                  {expandedLogs.has(index) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                
                <AnimatePresence>
                  {expandedLogs.has(index) && log.data && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 overflow-hidden"
                    >
                      <pre className="p-2 bg-surface-container rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-outline-variant bg-surface-container-low text-xs text-on-surface-variant flex justify-between">
        <span>{filteredLogs.length} logs displayed</span>
        <span>Session: {config?.sessionId?.slice(0, 8)}...</span>
      </div>
    </motion.div>
  );
}

export default DebugPanel;

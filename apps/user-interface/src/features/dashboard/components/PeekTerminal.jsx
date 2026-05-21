import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ChevronRight, Clock, Terminal, XCircle } from 'lucide-react';

function statusIcon(status) {
  if (status === 'success') return <CheckCircle className="text-[#43F3C5]" size={14} />;
  if (status === 'error') return <XCircle className="text-[#FF8F8F]" size={14} />;
  return <Clock className="text-[#F7C35F]" size={14} />;
}

function statusClass(status) {
  if (status === 'success') return 'border-[#43F3C5]/25 text-[#A7FFE9]';
  if (status === 'error') return 'border-[#FF6B6B]/25 text-[#FFC0C0]';
  return 'border-[#F7C35F]/25 text-[#FBE3A3]';
}

function formatDuration(seconds) {
  if (seconds == null) return null;
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(1)}s`;
}

function formatTimeAgo(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp || Date.now());
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return `${Math.max(0, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PeekTerminal({ onExpand, agentLoopStatus, vfsInstance }) {
  const [recentCommands, setRecentCommands] = useState([]);

  useEffect(() => {
    const getRecentCommands = async () => {
      if (!vfsInstance?.terminal) return;

      try {
        const sessions = await vfsInstance.terminal.tool_list_sessions();
        const commands = [];

        for (const session of sessions) {
          const output = await vfsInstance.terminal.tool_getOutput({ session: session.id, limit: 5 });
          const commandOutputs = output
            .filter((item) => item.type === 'command_complete' || item.type === 'error')
            .map((item) => ({
              id: `${session.id}_${item.timestamp}`,
              command: item.command || session.name,
              status: item.type === 'command_complete' && item.exitCode === 0 ? 'success' : 'error',
              exitCode: item.exitCode || 1,
              duration: item.duration ?? null,
              timestamp: new Date(item.timestamp),
              output: item.data || '',
            }));
          commands.push(...commandOutputs);
        }

        setRecentCommands(commands.sort((a, b) => b.timestamp - a.timestamp).slice(0, 3));
      } catch (error) {
        console.error('Failed to get terminal commands:', error);
      }
    };

    if (agentLoopStatus.history?.length > 0) {
      setRecentCommands(
        agentLoopStatus.history
          .filter((item) => item.command)
          .slice(-3)
          .map((item, index) => ({
            id: item.iteration || index,
            command: item.command,
            status: item.exitCode === 0 ? 'success' : 'error',
            exitCode: item.exitCode,
            duration: item.duration ?? null,
            timestamp: item.timestamp || new Date(),
            output: item.output || '',
          }))
      );
    } else {
      getRecentCommands();
    }
  }, [agentLoopStatus, vfsInstance]);

  return (
    <motion.footer
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-14 shrink-0 items-center border-t border-white/10 bg-[#0D1117]/95 px-4 backdrop-blur-xl"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <button
          onClick={onExpand}
          className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <Terminal className="text-[#43F3C5]" size={16} />
          Sandbox Terminal
        </button>

        {agentLoopStatus.isRunning && (
          <div className="hidden items-center gap-2 text-xs font-bold text-[#43F3C5] sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#43F3C5]" />
            Active
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {recentCommands.length === 0 ? (
            <span className="text-sm font-medium text-white/35">No recent commands</span>
          ) : (
            recentCommands.map((cmd, index) => (
              <motion.button
                key={cmd.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={`group relative flex min-w-0 shrink-0 items-center gap-2 rounded-md border bg-white/[0.035] px-3 py-1.5 transition hover:bg-white/[0.06] ${statusClass(cmd.status)}`}
                onClick={onExpand}
              >
                <ChevronRight size={12} className="opacity-55 transition group-hover:opacity-100" />
                <span className="max-w-[17rem] truncate font-mono text-xs">{cmd.command}</span>
                {statusIcon(cmd.status)}
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
                  {cmd.duration != null ? `${formatDuration(cmd.duration)} / ` : ''}{formatTimeAgo(cmd.timestamp)}
                </span>
              </motion.button>
            ))
          )}
        </div>
      </div>

      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        onClick={onExpand}
        className="ml-3 flex h-9 shrink-0 items-center gap-2 rounded-md bg-[#8DA2FF]/15 px-3 text-sm font-black text-[#B8C5FF] transition hover:bg-[#8DA2FF]/20"
      >
        <Terminal size={14} />
        Expand
      </motion.button>
    </motion.footer>
  );
}

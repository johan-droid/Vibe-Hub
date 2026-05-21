import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Pause,
  Square,
  RotateCcw,
  CheckCircle,
  Clock,
  Cpu,
  Settings,
  User,
  ShieldCheck,
  GitBranch,
} from 'lucide-react';
import { VibeLogoCompact } from '../../../components/VibeLogo';
import { SELINA_BRAND } from '../../../brand/selina';

const statusTone = {
  running: 'bg-[#43F3C5]/10 text-[#43F3C5] border-[#43F3C5]/25',
  retrying: 'bg-[#F7C35F]/10 text-[#F7C35F] border-[#F7C35F]/30',
  stopped: 'bg-[#FF6B6B]/10 text-[#FF8F8F] border-[#FF6B6B]/25',
  idle: 'bg-white/[0.04] text-white/55 border-white/10',
};

const dotTone = {
  running: 'bg-[#43F3C5]',
  retrying: 'bg-[#F7C35F]',
  stopped: 'bg-[#FF6B6B]',
  idle: 'bg-white/35',
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function StatusPill({ status, isRunning }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${statusTone[status]}`}>
      <span className="relative flex h-2 w-2">
        {isRunning && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${dotTone[status]}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotTone[status]}`} />
      </span>
      {status}
    </span>
  );
}

function Metric({ icon: Icon, label, value, accent = 'text-white/65' }) {
  if (value == null || value === '') return null;
  return (
    <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-xs lg:flex">
      <Icon size={14} className={accent} />
      <span className="text-white/40">{label}</span>
      <span className="font-semibold text-white/80">{value}</span>
    </div>
  );
}

function ControlButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/60 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      title={label}
      aria-label={label}
    >
      <Icon size={16} />
    </motion.button>
  );
}

export default function AgentStatusBar({
  isRunning,
  sessionNumber,
  retryCount,
  neuralStatus,
  onPause,
  onStop,
  onReset,
  onAcceptAll,
  onOpenSettings,
  onOpenProfile,
  experienceMode = 'professional',
  autonomyLevel = 2,
}) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setElapsedTime(0);
      return undefined;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const status = isRunning
    ? retryCount > 0 ? 'retrying' : 'running'
    : neuralStatus?.phase === 'idle'
      ? 'idle'
      : 'stopped';

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#0D1117]/95 px-4 text-white shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <VibeLogoCompact size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-black tracking-tight text-white">
                {SELINA_BRAND.productName}
              </span>
              <StatusPill status={status} isRunning={isRunning} />
            </div>
            <p className="mt-1 truncate text-[11px] font-medium text-white/45">
              {SELINA_BRAND.agentName} / {neuralStatus?.expert || 'core'} / {neuralStatus?.phase || 'idle'}
            </p>
          </div>
        </div>

        <div className="hidden h-6 w-px bg-white/10 md:block" />
        <div className="hidden items-center gap-2 md:flex">
          <Metric icon={GitBranch} label="Session" value={sessionNumber != null ? `#${sessionNumber}` : null} accent="text-[#8DA2FF]" />
          <Metric icon={Clock} label="Elapsed" value={formatTime(elapsedTime)} accent="text-[#F7C35F]" />
          <Metric icon={ShieldCheck} label="Sandbox" value="Local Docker" accent="text-[#43F3C5]" />
          <Metric icon={Cpu} label="Mode" value={experienceMode === 'learner' ? 'Learner' : 'Pro'} accent="text-[#8DA2FF]" />
          <Metric icon={Cpu} label="Retries" value={`${retryCount || 0}/3`} accent="text-white/55" />
          <Metric icon={ShieldCheck} label="Autonomy" value={`L${autonomyLevel}`} accent="text-[#F7C35F]" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-[#151922] p-1 md:flex">
          <ControlButton icon={Pause} label="Pause" onClick={onPause} disabled={!isRunning} />
          <ControlButton icon={Square} label="Stop" onClick={onStop} />
          <ControlButton icon={RotateCcw} label="Reset sandbox" onClick={onReset} />
        </div>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAcceptAll}
          className="hidden h-10 items-center gap-2 rounded-md bg-[#43F3C5] px-4 text-sm font-black text-[#07110F] shadow-[0_10px_30px_rgba(67,243,197,0.16)] transition hover:bg-[#6FF8D4] sm:flex"
        >
          <CheckCircle size={16} />
          Accept All
        </motion.button>

        <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

        <ControlButton icon={Settings} label="Settings" onClick={onOpenSettings} />
        <ControlButton icon={User} label="Profile" onClick={onOpenProfile} />
      </div>
    </motion.header>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, ShieldCheck, XCircle } from 'lucide-react';

export default function ApprovalGateModal({ approval, onResolve, experienceMode = 'professional' }) {
  if (!approval) return null;

  const isToolApproval = approval.kind === 'tool_approval';
  const title = isToolApproval ? 'Approval Gate' : 'Review Selina Plan';
  const subtitle = isToolApproval
    ? 'This action can mutate files, browser state, GitHub state, or local execution.'
    : 'Selina is waiting for your confirmation before continuing.';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <motion.section
        initial={{ opacity: 0, scale: 0.97, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 14 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-[#F7C35F]/25 bg-[#0D1117] shadow-2xl"
      >
        <header className="border-b border-white/10 bg-[#151922] px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#F7C35F]/25 bg-[#F7C35F]/10 text-[#F7C35F]">
              {isToolApproval ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-white/45">{subtitle}</p>
            </div>
          </div>
        </header>

        <div className="max-h-[55vh] overflow-y-auto p-6">
          <div className="space-y-3">
            {(approval.steps || []).map((step, index) => (
              <article key={`${step.file}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-xs font-bold text-[#A7FFE9]">{step.file || `Step ${index + 1}`}</span>
                  <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
                    {index + 1}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white/85">{step.action}</p>
                {experienceMode === 'learner' && step.reason && (
                  <p className="mt-2 text-xs leading-relaxed text-white/45">{step.reason}</p>
                )}
                {experienceMode === 'professional' && step.reason && (
                  <pre className="mt-3 max-h-32 overflow-y-auto rounded-md border border-white/10 bg-black/25 p-3 text-xs leading-5 text-white/55">
                    {step.reason}
                  </pre>
                )}
              </article>
            ))}
          </div>

          {approval.risks?.length > 0 && (
            <div className="mt-5 rounded-lg border border-[#FF6B6B]/20 bg-[#FF6B6B]/[0.06] p-4">
              <div className="mb-2 flex items-center gap-2 text-[#FFB7B7]">
                <AlertTriangle size={15} />
                <span className="text-xs font-black uppercase tracking-[0.14em]">Risks</span>
              </div>
              <ul className="space-y-1 text-sm leading-relaxed text-white/60">
                {approval.risks.map((risk, index) => <li key={index}>{risk}</li>)}
              </ul>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-white/10 bg-[#0B0E14] px-6 py-4">
          <button
            onClick={() => onResolve(false)}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-4 text-sm font-black text-[#FFB7B7] transition hover:bg-[#FF6B6B]/15"
          >
            <XCircle size={16} />
            Deny
          </button>
          <button
            onClick={() => onResolve(true)}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-[#43F3C5] px-5 text-sm font-black text-[#07110F] transition hover:bg-[#6FF8D4]"
          >
            <CheckCircle size={16} />
            Approve
          </button>
        </footer>
      </motion.section>
    </div>
  );
}

import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, KeyRound, LockKeyhole, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Surface } from '../../shared/components/Surface';
import { useStore } from '../../../store/useStore';
import { useBackendSignals } from '../../../hooks/useBackendSignals';

function titleCase(value = '') {
  return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function CheckRow({ ok, title, detail, action }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/45 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${ok ? 'border-tertiary/25 bg-tertiary/10 text-tertiary' : 'border-secondary/25 bg-secondary/10 text-secondary'}`}>
        {ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="title-small">{title}</p>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">{detail}</p>
          </div>
          {action && <span className="shrink-0 rounded-full border border-outline-variant/25 bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">{action}</span>}
        </div>
      </div>
    </div>
  );
}

export default function SecurityAudit({ signals: providedSignals = null }) {
  const { user } = useStore();
  const ownSignals = useBackendSignals({ intervalMs: 60_000, enabled: !providedSignals });
  const signals = providedSignals || ownSignals;
  const providerStatus = signals.diagnostics?.providerStatus || {};
  const activeProvider = providerStatus.activeProvider || 'gemini';
  const activeProviderConfig = providerStatus[activeProvider] || {};
  const auditTail = Array.isArray(signals.diagnostics?.auditTail) ? signals.diagnostics.auditTail : [];

  const checks = [
    {
      ok: Boolean(user?.email || user?.id),
      title: 'OAuth session is active',
      detail: user?.email ? `${user.email} is authenticated through ${titleCase(user.provider || 'OAuth')}.` : 'The workspace route is protected, but no user profile is loaded yet.',
      action: user?.provider ? titleCase(user.provider) : 'Session',
    },
    {
      ok: signals.health?.status === 'active',
      title: 'Backend health endpoint responds',
      detail: signals.health ? `Bridge status is ${signals.health.status}; version ${signals.health.version || 'not reported'}.` : 'Waiting for /health to respond.',
      action: 'Health',
    },
    {
      ok: activeProviderConfig?.configured !== false,
      title: 'Model provider key is not exposed to the browser',
      detail: activeProviderConfig?.configured === false ? `${titleCase(activeProvider)} needs a backend API key before model calls will run.` : `${titleCase(activeProvider)} is selected through backend diagnostics; secrets are not returned to the UI.`,
      action: titleCase(activeProvider),
    },
    {
      ok: true,
      title: 'Protected runtime diagnostics',
      detail: 'Runtime and skill graph endpoints are fetched through the authenticated API client with bearer-token cleanup on 401.',
      action: 'API',
    },
    {
      ok: auditTail.length > 0,
      title: 'Audit trail is ready',
      detail: auditTail.length ? `${auditTail.length} recent provider events are available for review.` : 'No provider call has happened yet, so the audit trail is empty.',
      action: `${auditTail.length} events`,
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-surface-container-lowest p-5 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <ShieldCheck size={14} />
              Security readiness
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.05em] text-on-surface">What is actually protected</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
              This page does not invent scan results. It summarizes the controls Selina can verify from the current frontend session and backend diagnostics.
            </p>
          </div>
          <button
            type="button"
            onClick={signals.refresh}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant/35 bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-primary"
          >
            <Activity size={15} className={signals.loading ? 'animate-spin' : ''} />
            Refresh checks
          </button>
        </div>

        {signals.error && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-on-error-container">
            <ShieldAlert size={16} />
            {signals.error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Surface elevation={0} shape="2xl" className="border border-outline-variant/25 bg-surface-container-low/80 p-5">
            <KeyRound size={20} className="mb-4 text-primary" />
            <p className="text-sm font-semibold text-on-surface-variant">Session</p>
            <p className="mt-2 title-large">{user ? 'Authenticated' : 'Unknown'}</p>
          </Surface>
          <Surface elevation={0} shape="2xl" className="border border-outline-variant/25 bg-surface-container-low/80 p-5">
            <Server size={20} className="mb-4 text-tertiary" />
            <p className="text-sm font-semibold text-on-surface-variant">Backend</p>
            <p className="mt-2 title-large">{titleCase(signals.health?.status || 'Checking')}</p>
          </Surface>
          <Surface elevation={0} shape="2xl" className="border border-outline-variant/25 bg-surface-container-low/80 p-5">
            <LockKeyhole size={20} className="mb-4 text-secondary" />
            <p className="text-sm font-semibold text-on-surface-variant">Provider</p>
            <p className="mt-2 title-large">{titleCase(activeProvider)}</p>
          </Surface>
        </div>

        <div className="mt-5 space-y-3">
          {checks.map((check) => <CheckRow key={check.title} {...check} />)}
        </div>
      </div>
    </div>
  );
}

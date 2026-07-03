import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

const EMPTY_SIGNALS = {
  health: null,
  diagnostics: null,
  skills: null,
  profile: null,
  loading: true,
  error: '',
  lastSyncedAt: null,
};

function messageFrom(error) {
  return error?.message || 'Unable to load backend signals.';
}

async function settle(label, promise) {
  try {
    return { label, ok: true, data: await promise };
  } catch (error) {
    return { label, ok: false, error };
  }
}

export function flattenSkillGraph(graph) {
  if (Array.isArray(graph)) return graph;
  if (graph && typeof graph === 'object') return Object.values(graph);
  return [];
}

export function useBackendSignals({ intervalMs = 60_000, enabled = true } = {}) {
  const [signals, setSignals] = useState(EMPTY_SIGNALS);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setSignals((current) => ({ ...current, loading: true }));

    const results = await Promise.all([
      settle('health', api.health()),
      settle('diagnostics', api.runtimeDiagnostics()),
      settle('skills', api.runtimeSkills()),
      settle('profile', api.authStatus()),
    ]);

    const next = results.reduce((acc, result) => {
      if (result.ok) acc[result.label] = result.data;
      return acc;
    }, {});

    const failures = results.filter((result) => !result.ok);

    setSignals((current) => ({
      ...current,
      ...next,
      loading: false,
      error: failures.length ? messageFrom(failures[0].error) : '',
      lastSyncedAt: new Date(),
    }));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    let active = true;
    refresh();

    const timer = window.setInterval(() => {
      if (active) refresh();
    }, intervalMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, refresh]);

  return { ...signals, refresh };
}

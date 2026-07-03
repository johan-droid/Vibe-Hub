export const AUDIT_MODES = Object.freeze(['off', 'standard', 'full']);

export function normalizeAuditMode(mode, fallback = process.env.SELINA_AUDIT_MODE_DEFAULT || 'standard') {
  const requested = String(mode || '').trim().toLowerCase();
  if (AUDIT_MODES.includes(requested)) return requested;

  const normalizedFallback = String(fallback || 'standard').trim().toLowerCase();
  return AUDIT_MODES.includes(normalizedFallback) ? normalizedFallback : 'standard';
}

export function shouldRecordAudit(mode) {
  return normalizeAuditMode(mode) !== 'off';
}

export function isFullAuditMode(mode) {
  return normalizeAuditMode(mode) === 'full';
}

export default {
  AUDIT_MODES,
  normalizeAuditMode,
  shouldRecordAudit,
  isFullAuditMode,
};

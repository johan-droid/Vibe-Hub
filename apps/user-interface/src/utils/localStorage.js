/**
 * Three-Tier Persistence Management
 * 
 * Tier 1 - Fully Persistent (Survives Logout): User preferences, job history
 * Tier 2 - Session-Resilient (Selective Clear): lastJobId, panel states
 * Tier 3 - Ephemeral (Cleared on Logout): Auth tokens, temporary agent state
 */

const PREFIX = 'vibe_hub_';

// Tier 1 Keys - Survives logout/offline, cleared only on explicit user action
const TIER_1_KEYS = [
  'user_preferences',    // Theme, language, aesthetic settings
  'project_history',     // Previously linked projects
  'terminal_history',    // Last 100 terminal commands
  'chat_history_cache',  // Local cache of chat messages
];

// Tier 2 Keys - Session-resilient, survives logout but may have TTL
const TIER_2_KEYS = [
  'last_job_id',         // Last submitted job for resumption
  'last_request_id',     // Last request for idempotency
  'panel_states',        // Sidebar, chat, terminal open/closed
  'terminal_filters',    // Filter level settings
  'draft_prompt',        // Unsubmitted prompt text
];

// Tier 3 Keys - Ephemeral, cleared immediately on logout
const TIER_3_KEYS = [
  'selina_token',           // Legacy auth token
  'selina_access_token',    // JWT access token
  'selina_refresh_token',   // Refresh token
  'selina_session_token',   // Session identifier
  'csrf_token',             // CSRF protection token
  'agent_state',            // Live agent status (in-memory only)
  'streaming_buffer',       // Unfinished streaming content
];

/**
 * Get item from localStorage with prefix
 */
export function getItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(`${PREFIX}${key}`);
    if (!item) return defaultValue;
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch {
    return defaultValue;
  }
}

/**
 * Set item in localStorage with prefix
 */
export function setItem(key, value) {
  try {
    const stored = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(`${PREFIX}${key}`, stored);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove item from localStorage
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all Tier 3 keys (ephemeral/auth data)
 */
export function clearTier3() {
  TIER_3_KEYS.forEach(key => removeItem(key));
}

/**
 * Clear Tier 2 keys that are older than their TTL
 * Call this periodically or on login
 */
export function clearExpiredTier2() {
  const now = Date.now();
  const TTL_24H = 24 * 60 * 60 * 1000;
  const TTL_7D = 7 * 24 * 60 * 60 * 1000;

  // Check last_job_id (24h TTL)
  const lastJob = getItem('last_job_id');
  if (lastJob?.timestamp && now - lastJob.timestamp > TTL_24H) {
    removeItem('last_job_id');
  }

  // Check last_request_id (24h TTL)
  const lastRequest = getItem('last_request_id');
  if (lastRequest?.timestamp && now - lastRequest.timestamp > TTL_24H) {
    removeItem('last_request_id');
  }

  // draft_prompt (7d TTL)
  const draft = getItem('draft_prompt');
  if (draft?.timestamp && now - draft.timestamp > TTL_7D) {
    removeItem('draft_prompt');
  }
}

/**
 * Full logout cleanup - clears Tier 3 only, preserves Tier 1 & 2
 */
export function performLogoutCleanup() {
  clearTier3();
  // Tier 1 and 2 survive for seamless re-login experience
}

/**
 * Full reset - clears everything (use with caution)
 */
export function performFullReset() {
  [...TIER_1_KEYS, ...TIER_2_KEYS, ...TIER_3_KEYS].forEach(key => removeItem(key));
}

// === Job Resumption Helpers ===

/**
 * Store last job ID for potential resumption
 */
export function setLastJobId(jobId, requestId = null) {
  setItem('last_job_id', {
    jobId,
    requestId,
    timestamp: Date.now(),
  });
}

/**
 * Get last job ID if still valid (within 24h)
 */
export function getLastJobId() {
  const data = getItem('last_job_id');
  if (!data?.jobId) return null;
  
  const TTL_24H = 24 * 60 * 60 * 1000;
  if (Date.now() - data.timestamp > TTL_24H) {
    removeItem('last_job_id');
    return null;
  }
  
  return data;
}

/**
 * Clear last job ID (e.g., when job completes)
 */
export function clearLastJobId() {
  removeItem('last_job_id');
}

// === Panel State Helpers ===

/**
 * Save panel states (sidebar, chat, terminal)
 */
export function savePanelStates(states) {
  setItem('panel_states', {
    ...states,
    timestamp: Date.now(),
  });
}

/**
 * Load panel states
 */
export function loadPanelStates(defaults = {}) {
  return getItem('panel_states') || defaults;
}

// === Draft Prompt Helpers ===

/**
 * Save draft prompt text
 */
export function saveDraftPrompt(text) {
  if (!text || text.trim() === '') {
    removeItem('draft_prompt');
    return;
  }
  setItem('draft_prompt', {
    text,
    timestamp: Date.now(),
  });
}

/**
 * Load draft prompt text
 */
export function loadDraftPrompt() {
  const data = getItem('draft_prompt');
  if (!data?.text) return '';
  
  const TTL_7D = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - data.timestamp > TTL_7D) {
    removeItem('draft_prompt');
    return '';
  }
  
  return data.text;
}

// === Terminal Filter Helpers ===

export function saveTerminalFilters(filters) {
  setItem('terminal_filters', filters);
}

export function loadTerminalFilters() {
  return getItem('terminal_filters', {
    level: 'all',
    search: '',
  });
}

export default {
  getItem,
  setItem,
  removeItem,
  clearTier3,
  clearExpiredTier2,
  performLogoutCleanup,
  performFullReset,
  setLastJobId,
  getLastJobId,
  clearLastJobId,
  savePanelStates,
  loadPanelStates,
  saveDraftPrompt,
  loadDraftPrompt,
  saveTerminalFilters,
  loadTerminalFilters,
};

/**
 * Frontend Logging System
 * 
 * Features:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - Test mode with full capture
 * - Log persistence to localStorage (last 500 logs)
 * - Console output with styling
 * - Export logs for debugging
 */

const LOG_KEY = 'selina_logs';
const LEGACY_LOG_KEY = 'vibe_hub_logs';
const MAX_LOGS = 500;

// Log levels
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Get test mode from environment
const isTestMode = () => {
  return localStorage.getItem('selina_test_mode') === 'true' ||
         localStorage.getItem('vibe_hub_test_mode') === 'true' ||
         import.meta.env.VITE_TEST_MODE === 'true' ||
         import.meta.env.DEV;
};

// Current log level
let currentLogLevel = isTestMode() ? LogLevel.DEBUG : LogLevel.INFO;

/**
 * Create a log entry
 */
function createLogEntry(level, component, message, data = null, error = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: Object.keys(LogLevel).find(k => LogLevel[k] === level),
    component,
    message,
    data: data ? JSON.parse(JSON.stringify(data, getCircularReplacer())) : null,
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : null,
    url: window.location.href,
    userAgent: navigator.userAgent,
    sessionId: getSessionId()
  };
  
  return entry;
}

/**
 * Handle circular references in JSON
 */
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // Don't log React elements or large objects
    if (value && value.$$typeof) {
      return '[ReactElement]';
    }
    return value;
  };
}

/**
 * Get or create session ID
 */
function getSessionId() {
  let sessionId = sessionStorage.getItem('selina_session_id') || sessionStorage.getItem('vibe_hub_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('selina_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Store log to localStorage
 */
function persistLog(entry) {
  try {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    logs.push(entry);
    // Keep only last MAX_LOGS
    if (logs.length > MAX_LOGS) {
      logs.splice(0, logs.length - MAX_LOGS);
    }
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('[Logger] Failed to persist log:', e);
  }
}

/**
 * Output to console with styling
 */
function consoleOutput(entry) {
  const styles = {
    DEBUG: 'color: #6b7280; font-weight: normal;',
    INFO: 'color: #3b82f6; font-weight: normal;',
    WARN: 'color: #f59e0b; font-weight: bold;',
    ERROR: 'color: #ef4444; font-weight: bold;'
  };
  
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const prefix = `[${time}] [${entry.level}] [${entry.component}]`;
  
  if (entry.level === 'ERROR') {
    console.error(`%c${prefix} ${entry.message}`, styles[entry.level], entry.data || '', entry.error || '');
  } else if (entry.level === 'WARN') {
    console.warn(`%c${prefix} ${entry.message}`, styles[entry.level], entry.data || '');
  } else if (isTestMode() || entry.level !== 'DEBUG') {
    console.log(`%c${prefix} ${entry.message}`, styles[entry.level], entry.data || '');
  }
}

/**
 * Main log function
 */
export function log(level, component, message, data, error) {
  if (level < currentLogLevel) return;
  
  const entry = createLogEntry(level, component, message, data, error);
  
  // Always persist in test mode
  if (isTestMode()) {
    persistLog(entry);
  }
  
  // Always output to console in test mode, otherwise respect level
  consoleOutput(entry);
  
  return entry;
}

/**
 * Convenience methods
 */
export const logger = {
  debug: (component, message, data) => log(LogLevel.DEBUG, component, message, data),
  info: (component, message, data) => log(LogLevel.INFO, component, message, data),
  warn: (component, message, data) => log(LogLevel.WARN, component, message, data),
  error: (component, message, error, data) => log(LogLevel.ERROR, component, message, data, error),
  
  // Set log level
  setLevel: (level) => {
    currentLogLevel = level;
    logger.info('Logger', `Log level set to ${Object.keys(LogLevel).find(k => LogLevel[k] === level)}`);
  },
  
  // Enable/disable test mode
  setTestMode: (enabled) => {
    localStorage.setItem('selina_test_mode', enabled ? 'true' : 'false');
    localStorage.removeItem('vibe_hub_test_mode');
    currentLogLevel = enabled ? LogLevel.DEBUG : LogLevel.INFO;
    logger.info('Logger', `Test mode ${enabled ? 'enabled' : 'disabled'}`);
  },
  
  // Get all persisted logs
  getLogs: () => {
    return JSON.parse(localStorage.getItem(LOG_KEY) || localStorage.getItem(LEGACY_LOG_KEY) || '[]');
  },
  
  // Clear logs
  clearLogs: () => {
    localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(LEGACY_LOG_KEY);
    logger.info('Logger', 'Logs cleared');
  },
  
  // Export logs as JSON
  exportLogs: () => {
    const logs = logger.getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selina-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  
  // Get current config
  getConfig: () => ({
    level: Object.keys(LogLevel).find(k => LogLevel[k] === currentLogLevel),
    testMode: isTestMode(),
    sessionId: getSessionId(),
    logCount: logger.getLogs().length
  })
};

/**
 * React hook for component logging
 */
export function useLogger(componentName) {
  return {
    debug: (message, data) => logger.debug(componentName, message, data),
    info: (message, data) => logger.info(componentName, message, data),
    warn: (message, data) => logger.warn(componentName, message, data),
    error: (message, error, data) => logger.error(componentName, message, error, data)
  };
}

/**
 * Log store state changes
 */
export function logStateChange(storeName, prevState, nextState, changedKeys) {
  logger.debug('Store', `${storeName} state changed`, {
    changedKeys,
    prevState: changedKeys.reduce((acc, key) => {
      acc[key] = prevState[key];
      return acc;
    }, {}),
    nextState: changedKeys.reduce((acc, key) => {
      acc[key] = nextState[key];
      return acc;
    }, {})
  });
}

/**
 * Log API calls
 */
export function logApiCall(method, url, body, response, duration) {
  const data = {
    method,
    url,
    duration: `${duration}ms`,
    status: response?.status,
    requestBody: body ? (typeof body === 'string' ? JSON.parse(body) : body) : null,
    responseBody: response ? '[Response]' : null
  };
  
  if (response?.status >= 400) {
    logger.error('API', `${method} ${url} failed`, null, data);
  } else {
    logger.debug('API', `${method} ${url}`, data);
  }
}

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
  logger.error('Global', 'Uncaught error', event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    message: event.message
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Global', 'Unhandled promise rejection', event.reason, {
    reason: event.reason?.message || event.reason
  });
});

// Initialize
logger.info('Logger', 'Logging system initialized', logger.getConfig());

export default logger;

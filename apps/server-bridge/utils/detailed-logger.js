/**
 * Backend Detailed Logging System
 * 
 * Features:
 * - Multiple log levels with Winston
 * - Test mode with full request/response capture
 * - Structured JSON logging
 * - Log rotation and file output
 * - Request correlation IDs
 * - Performance timing
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test mode flag
const TEST_MODE = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'development';

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
};

winston.addColors(colors);

// Create formatters
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, component, ...metadata }) => {
    const meta = Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : '';
    return `[${timestamp}] [${level}] [${component || 'App'}] ${message} ${meta}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: TEST_MODE ? 'debug' : 'info',
    format: consoleFormat
  })
];

// Add file transports in test mode or production
if (TEST_MODE || process.env.LOG_TO_FILE === 'true') {
  const logsDir = path.join(process.cwd(), 'logs');
  
  transports.push(
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'debug',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880,
      maxFiles: 5
    }),
    // HTTP logs
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      level: 'http',
      format: jsonFormat,
      maxsize: 5242880,
      maxFiles: 5
    })
  );
}

// Create main logger
const winstonLogger = winston.createLogger({
  levels,
  format: jsonFormat,
  defaultMeta: {
    service: 'server-bridge',
    environment: process.env.NODE_ENV || 'development',
    testMode: TEST_MODE
  },
  transports,
  exitOnError: false
});

/**
 * Request tracking store
 */
const requestStore = new Map();
const MAX_STORE_SIZE = 1000;

/**
 * Generate request ID
 */
export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Main logger interface
 */
export const logger = {
  // Basic logging
  error: (component, message, error, metadata = {}) => {
    winstonLogger.error(message, {
      component,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      } : null,
      ...metadata
    });
  },
  
  warn: (component, message, metadata = {}) => {
    winstonLogger.warn(message, { component, ...metadata });
  },
  
  info: (component, message, metadata = {}) => {
    winstonLogger.info(message, { component, ...metadata });
  },
  
  http: (component, message, metadata = {}) => {
    winstonLogger.http(message, { component, ...metadata });
  },
  
  debug: (component, message, metadata = {}) => {
    winstonLogger.debug(message, { component, ...metadata });
  },
  
  verbose: (component, message, metadata = {}) => {
    winstonLogger.verbose(message, { component, ...metadata });
  },
  
  silly: (component, message, metadata = {}) => {
    winstonLogger.silly(message, { component, ...metadata });
  },
  
  // Request logging middleware
  logRequest: (req, res, next) => {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    req.requestId = requestId;
    
    const startTime = Date.now();
    
    // Store request data in test mode
    if (TEST_MODE) {
      const requestData = {
        requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        path: req.path,
        headers: sanitizeHeaders(req.headers),
        query: req.query,
        body: sanitizeBody(req.body),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id || null
      };
      
      // Limit store size
      if (requestStore.size >= MAX_STORE_SIZE) {
        const firstKey = requestStore.keys().next().value;
        requestStore.delete(firstKey);
      }
      requestStore.set(requestId, { request: requestData });
      
      winstonLogger.debug('Request started', { component: 'HTTP', requestId, ...requestData });
    } else {
      winstonLogger.http('Request started', {
        component: 'HTTP',
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip
      });
    }
    
    // Capture response
    const originalEnd = res.end.bind(res);
    res.end = function(chunk, encoding) {
      res.end = originalEnd;
      res.end(chunk, encoding);
      
      const duration = Date.now() - startTime;
      
      if (TEST_MODE) {
        const responseData = {
          requestId,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          duration: `${duration}ms`,
          contentLength: res.get('content-length'),
          responseBody: chunk ? truncateString(chunk.toString(), 1000) : null
        };
        
        const stored = requestStore.get(requestId);
        if (stored) {
          stored.response = responseData;
          stored.duration = duration;
        }
        
        const level = res.statusCode >= 400 ? 'warn' : 'debug';
        winstonLogger[level]('Request completed', {
          component: 'HTTP',
          requestId,
          ...responseData
        });
      } else {
        winstonLogger.http('Request completed', {
          component: 'HTTP',
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`
        });
      }
    };
    
    next();
  },
  
  // Get request history (test mode only)
  getRequestHistory: () => {
    return Array.from(requestStore.values());
  },
  
  // Get specific request details
  getRequestDetails: (requestId) => {
    return requestStore.get(requestId);
  },
  
  // Clear request history
  clearRequestHistory: () => {
    requestStore.clear();
    winstonLogger.info('Request history cleared', { component: 'Logger' });
  },
  
  // Log authentication events
  logAuth: (event, userId, metadata = {}) => {
    winstonLogger.info(`Auth ${event}`, {
      component: 'Auth',
      userId,
      event,
      ...metadata
    });
  },
  
  // Log database operations
  logDb: (operation, table, duration, metadata = {}) => {
    winstonLogger.debug(`DB ${operation}`, {
      component: 'Database',
      operation,
      table,
      duration: `${duration}ms`,
      ...metadata
    });
  },
  
  // Log external API calls
  logExternal: (service, method, url, duration, status, metadata = {}) => {
    const level = status >= 400 ? 'warn' : 'debug';
    winstonLogger[level](`External API ${method} ${url}`, {
      component: 'ExternalAPI',
      service,
      method,
      url,
      status,
      duration: `${duration}ms`,
      ...metadata
    });
  },
  
  // Performance logging
  logPerformance: (operation, duration, metadata = {}) => {
    winstonLogger.verbose(`Performance: ${operation}`, {
      component: 'Performance',
      operation,
      duration: `${duration}ms`,
      ...metadata
    });
  },
  
  // Security logging
  logSecurity: (event, severity, metadata = {}) => {
    winstonLogger.warn(`Security: ${event}`, {
      component: 'Security',
      event,
      severity,
      ...metadata
    });
  },
  
  // Export all logs (requires file transport)
  exportLogs: () => {
    // This would read log files and return them
    // Implementation depends on log storage
    winstonLogger.info('Log export requested', { component: 'Logger' });
  }
};

/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(headers) {
  const sensitive = ['authorization', 'cookie', 'x-csrf-token', 'password'];
  const sanitized = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize body for logging
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sensitive = ['password', 'token', 'secret', 'key', 'credential', 'access_token'];
  const sanitized = {};
  
  for (const [key, value] of Object.entries(body)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = typeof value === 'object' ? sanitizeBody(value) : value;
    }
  }
  
  return sanitized;
}

/**
 * Truncate string for logging
 */
function truncateString(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '... [truncated]';
}

/**
 * Express middleware to attach logger to request
 */
export function requestLogger(req, res, next) {
  req.logger = {
    debug: (msg, meta) => logger.debug('Request', msg, { requestId: req.requestId, ...meta }),
    info: (msg, meta) => logger.info('Request', msg, { requestId: req.requestId, ...meta }),
    warn: (msg, meta) => logger.warn('Request', msg, { requestId: req.requestId, ...meta }),
    error: (msg, err, meta) => logger.error('Request', msg, err, { requestId: req.requestId, ...meta })
  };
  next();
}

/**
 * Wrap async functions with logging
 */
export function withLogging(fn, component) {
  return async (...args) => {
    const startTime = Date.now();
    try {
      logger.debug(component, `Starting ${fn.name}`, { args: args.length });
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      logger.debug(component, `Completed ${fn.name}`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(component, `Failed ${fn.name}`, error, { duration: `${duration}ms` });
      throw error;
    }
  };
}

// Log startup
logger.info('Logger', 'Detailed logging system initialized', {
  testMode: TEST_MODE,
  logLevel: TEST_MODE ? 'debug' : 'info',
  fileLogging: transports.length > 1
});

export default logger;

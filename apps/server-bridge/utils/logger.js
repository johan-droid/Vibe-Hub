/**
 * Structured Logging Utility (Winston)
 * 
 * Provides JSON-formatted logs for production observability.
 * Includes request ID tracing and error tracking.
 */

import winston from 'winston';
import { v4 as uuid } from 'uuid';
import { recordStateTransitionMetric } from './metrics.js';
import {
  createRequestTraceContext,
  getTraceLogFields,
  runWithTraceContext,
  setTraceStep,
  traceParentHeader,
} from './tracing.js';

const traceFormat = winston.format((info) => Object.assign(info, getTraceLogFields()))();
const useJsonLogs = process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';

// Log format with structured JSON output
const jsonFormat = winston.format.combine(
  traceFormat,
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development (pretty print)
const consoleFormat = winston.format.combine(
  traceFormat,
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'server-bridge',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // File transports for production
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        format: jsonFormat
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        format: jsonFormat
      })
    ] : []),
    
    // Console transport (always)
    new winston.transports.Console({
      format: useJsonLogs ? jsonFormat : consoleFormat
    })
  ],
  
  // Exit on error in production
  exitOnError: false
});

/**
 * Request context middleware - adds request ID for tracing
 */
export function requestContext(req, res, next) {
  const requestId = req.get('x-request-id') || uuid();
  const traceContext = createRequestTraceContext(req, requestId);

  runWithTraceContext(traceContext, () => {
    req.id = requestId;
    req.requestId = requestId;
    req.traceId = traceContext.traceId;
    req.spanId = traceContext.spanId;
    req.startTime = Date.now();

    const traceparent = traceParentHeader(traceContext);
    if (traceparent) res.setHeader('traceparent', traceparent);
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-trace-id', traceContext.traceId);

    logger.info('Request started', {
      requestId: req.id,
      method: req.method,
      url: req.url,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });

    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      setTraceStep('http_response');
      logger.info('Request completed', {
        requestId: req.id,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    });

    next();
  });
}

/**
 * Error logging helper
 */
export function logError(error, context = {}) {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    ...context
  });
}

/**
 * Audit logging for VFS operations
 */
export function logVfsOperation(operation, filePath, userId, metadata = {}) {
  setTraceStep(`vfs.${operation}`);
  logger.info('VFS operation', {
    type: 'vfs_audit',
    operation,
    filePath,
    userId,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

/**
 * State machine transition logging
 */
export function logStateTransition(from, to, context, userId) {
  setTraceStep(String(to || 'state_transition'));
  recordStateTransitionMetric(from, to, userId);
  logger.info('State transition', {
    type: 'state_machine',
    from,
    to,
    userId,
    retries: context.retries,
    timestamp: new Date().toISOString()
  });
}

export default logger;

/**
 * Structured Logging Utility (Winston)
 * 
 * Provides JSON-formatted logs for production observability.
 * Includes request ID tracing and error tracking.
 */

import winston from 'winston';
import { v4 as uuid } from 'uuid';

// Log format with structured JSON output
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development (pretty print)
const consoleFormat = winston.format.combine(
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
      format: process.env.NODE_ENV === 'production' ? jsonFormat : consoleFormat
    })
  ],
  
  // Exit on error in production
  exitOnError: false
});

/**
 * Request context middleware - adds request ID for tracing
 */
export function requestContext(req, res, next) {
  req.id = uuid();
  req.startTime = Date.now();
  
  // Log request
  logger.info('Request started', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });
  
  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
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

/**
 * Security Middleware Utilities
 * 
 * Additional security hardening for XSS, CSRF, and input sanitization.
 */

import { logger } from './logger.js';

/**
 * XSS Protection Middleware
 * Sanitizes common XSS vectors in request bodies
 */
export function xssProtection(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  next();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj) {
  if (!obj || Buffer.isBuffer(obj)) return;
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = isCodeLikeField(key) ? sanitizeAgentText(obj[key]) : sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

function isCodeLikeField(key) {
  return /(prompt|content|code|replacement|search|target|script|command|args?)/i.test(String(key));
}

/**
 * Sanitize string by removing dangerous HTML/JS
 */
export function sanitizeString(str) {
  return str
    .replace(/\0/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, 'blocked:')
    .replace(/on\w+\s*=/gi, 'blocked=')
    .replace(/<iframe/gi, '&lt;iframe')
    .replace(/<object/gi, '&lt;object')
    .replace(/<embed/gi, '&lt;embed');
}

export function sanitizeAgentText(str) {
  return String(str)
    .replace(/\0/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, Number.parseInt(process.env.AGENT_INPUT_MAX_CHARS || '20000', 10));
}

export function detectPromptInjection(input = '') {
  const patterns = [
    /ignore (all )?(previous|prior) instructions/i,
    /reveal (the )?(system|developer) prompt/i,
    /exfiltrate|steal|leak/i,
    /\b(?:cat|type)\s+\.env\b/i,
    /BEGIN_(SYSTEM|DEVELOPER)_PROMPT/i,
  ];
  const text = String(input);
  return patterns
    .filter(pattern => pattern.test(text))
    .map(pattern => pattern.source);
}

/**
 * Security headers middleware (additional to Helmet)
 */
export function additionalSecurityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  
  next();
}

/**
 * Request sanitization logger
 * Logs potential attack attempts for monitoring
 */
export function attackMonitoring(req, res, next) {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\.\.\//,  // Path traversal
    /\/etc\/passwd/i,
    /SELECT.*FROM/i,  // SQL injection attempt
    /UNION.*SELECT/i
  ];
  
  const requestString = JSON.stringify(Buffer.isBuffer(req.body) ? '[raw-body]' : req.body) + req.url + JSON.stringify(req.query);
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logger.warn('Potential attack pattern detected', {
        requestId: req.id,
        pattern: pattern.toString(),
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      break;
    }
  }
  
  next();
}

/**
 * File path security validator
 * Additional layer beyond Zod for file operations
 */
export function validateFilePath(filePath) {
  // Block dangerous patterns
  const dangerousPatterns = [
    /\.\./,                    // Parent directory
    /^\//,                     // Absolute path
    /~/,                       // Home directory
    /\0/,                      // Null byte injection
    /(etc|proc|sys|dev)\//i,   // System directories
    /\.(exe|sh|bat|cmd)$/i     // Executable extensions
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(filePath)) {
      throw new Error(`Invalid file path: ${filePath}`);
    }
  }
  
  // Must be within project directory
  if (!filePath.startsWith('/') && !filePath.includes('..')) {
    return true;
  }
  
  return false;
}

export default {
  xssProtection,
  additionalSecurityHeaders,
  attackMonitoring,
  sanitizeString,
  sanitizeAgentText,
  detectPromptInjection,
  validateFilePath
};

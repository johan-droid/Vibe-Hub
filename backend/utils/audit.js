import pool from '../db.js';
import { logger } from './logger.js';

export async function writeAuditLog({
  eventType,
  resourceType = 'vfs',
  resourceId,
  userId = null,
  requestId = null,
  payload = {},
}) {
  if (process.env.NODE_ENV === 'test' || process.env.AUDIT_LOGS_DISABLED === 'true') return;

  try {
    await pool.query(
      `INSERT INTO audit_logs (event_type, resource_type, resource_id, user_id, request_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        eventType,
        resourceType,
        resourceId,
        userId ? String(userId) : null,
        requestId ? String(requestId) : null,
        JSON.stringify(payload),
      ]
    );
  } catch (error) {
    logger.warn('Failed to write audit log', {
      eventType,
      resourceType,
      resourceId,
      userId,
      requestId,
      error: error.message,
    });
  }
}

export function writeAuditLogLater(payload) {
  writeAuditLog(payload).catch(() => {});
}

export async function listAuditLogs({ userId, resourceId = null, limit = 100 }) {
  const boundedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500);
  const params = [String(userId), boundedLimit];
  let where = 'WHERE user_id = $1';

  if (resourceId) {
    params.splice(1, 0, String(resourceId));
    where += ' AND resource_id = $2';
  }

  const limitParam = resourceId ? '$3' : '$2';
  const result = await pool.query(
    `SELECT id, event_type, resource_type, resource_id, user_id, request_id, payload, created_at
     FROM audit_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT ${limitParam}`,
    params
  );

  return result.rows;
}

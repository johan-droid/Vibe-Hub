/**
 * Virtual File System (VFS) — Secure Staging Area v6
 * 
 * Prevents auto-writing to physical disk without user approval.
 * All agent-generated code is staged here first, then committed
 * only after explicit user consent via the frontend diff viewer.
 */

import { EventEmitter } from 'events';
import { logVfsOperation } from '../utils/logger.js';
import { writeAuditLogLater } from '../utils/audit.js';
import { recordVfsOperationMetric, setVfsStats } from '../utils/metrics.js';

class VirtualFileSystem extends EventEmitter {
  constructor() {
    super();
    // Map: filePath -> { originalContent, proposedContent, metadata, status }
    this.staging = new Map();
    this.redis = null;
    this.redisSubscriber = null;
    this.redisSourceId = null;
    this.redisEntriesKey = 'vfs:entries';
    this.redisChannel = 'vfs:events';
    this.redisTtlSeconds = Number.parseInt(process.env.VFS_TTL_SECONDS || '86400', 10);
  }

  async configureRedis({ client, subscriber, sourceId }) {
    if (!client || !subscriber) return false;

    this.redis = client;
    this.redisSubscriber = subscriber;
    this.redisSourceId = sourceId;

    await this.hydrateFromRedis();
    await this.redisSubscriber.subscribe(this.redisChannel);
    this.redisSubscriber.on('message', (channel, message) => {
      if (channel !== this.redisChannel) return;
      this.applyRedisEvent(message);
    });

    return true;
  }

  entryKey(filePath) {
    return `vfs:entry:${encodeURIComponent(filePath)}`;
  }

  serializeEntry(entry) {
    return {
      filePath: entry.filePath,
      originalContent: entry.originalContent,
      proposedContent: entry.proposedContent,
      metadata: JSON.stringify(entry.metadata || {}),
      status: entry.status,
    };
  }

  deserializeEntry(hash) {
    if (!hash?.filePath) return null;
    let metadata = {};
    try {
      metadata = hash.metadata ? JSON.parse(hash.metadata) : {};
    } catch {
      metadata = {};
    }

    return {
      filePath: hash.filePath,
      originalContent: hash.originalContent || '',
      proposedContent: hash.proposedContent || '',
      metadata,
      status: hash.status || 'pending_review',
    };
  }

  async hydrateFromRedis() {
    try {
      const filePaths = await this.redis.smembers(this.redisEntriesKey);
      if (!filePaths.length) return;

      const rows = await Promise.all(
        filePaths.map(async filePath => [filePath, await this.redis.hgetall(this.entryKey(filePath))])
      );

      for (const [filePath, hash] of rows) {
        if (!hash || Object.keys(hash).length === 0) {
          await this.redis.srem(this.redisEntriesKey, filePath);
          continue;
        }
        const entry = this.deserializeEntry(hash);
        if (entry?.filePath) this.staging.set(entry.filePath, entry);
      }
      setVfsStats(this.getStats());
    } catch (error) {
      console.warn(`[VFS] Redis hydration failed: ${error.message}`);
    }
  }

  applyRedisEvent(message) {
    try {
      const payload = JSON.parse(message);
      if (!payload || payload.sourceId === this.redisSourceId) return;

      if (payload.type === 'delete') {
        this.staging.delete(payload.filePath);
      } else if (payload.entry?.filePath) {
        this.staging.set(payload.entry.filePath, payload.entry);
      }
      setVfsStats(this.getStats());

      if (payload.eventName && payload.entry) {
        this.emit(payload.eventName, payload.entry);
      }
    } catch (error) {
      console.warn(`[VFS] Redis event ignored: ${error.message}`);
    }
  }

  persistEntry(eventName, entry) {
    if (!this.redis) return;

    const entryKey = this.entryKey(entry.filePath);
    const serializedEntry = this.serializeEntry(entry);
    const serializedFields = Object.entries(serializedEntry).flat();
    const payload = {
      type: 'upsert',
      sourceId: this.redisSourceId,
      eventName,
      entry,
    };

    this.redis
      .multi()
      .hset(entryKey, ...serializedFields)
      .expire(entryKey, this.redisTtlSeconds)
      .sadd(this.redisEntriesKey, entry.filePath)
      .publish(this.redisChannel, JSON.stringify(payload))
      .exec()
      .catch(error => console.warn(`[VFS] Redis persist failed: ${error.message}`));
  }

  deleteEntry(eventName, filePath, entry) {
    if (!this.redis) return;

    const payload = {
      type: 'delete',
      sourceId: this.redisSourceId,
      eventName,
      filePath,
      entry,
    };

    this.redis
      .multi()
      .del(this.entryKey(filePath))
      .srem(this.redisEntriesKey, filePath)
      .publish(this.redisChannel, JSON.stringify(payload))
      .exec()
      .catch(error => console.warn(`[VFS] Redis delete failed: ${error.message}`));
  }

  audit(operation, entry, payload = {}) {
    const filePath = typeof entry === 'string' ? entry : entry.filePath;
    const metadata = typeof entry === 'string' ? {} : entry.metadata || {};
    const userId = payload.userId || metadata.userId;
    const requestId = payload.requestId || metadata.requestId;

    logVfsOperation(operation, filePath, userId, payload);
    recordVfsOperationMetric(operation, typeof entry === 'string' ? payload.previousStatus : entry.status);
    setVfsStats(this.getStats());
    writeAuditLogLater({
      eventType: `vfs.${operation}`,
      resourceId: filePath,
      userId,
      requestId,
      payload: {
        status: typeof entry === 'string' ? undefined : entry.status,
        metadata,
        ...payload,
      },
    });
  }

  /**
   * Stage verified code from the state machine for user review.
   * Does NOT write to physical disk.
   */
  stageFile(filePath, originalContent, proposedContent, metadata = {}) {
    const entry = {
      filePath,
      originalContent,
      proposedContent,
      metadata: {
        timestamp: new Date().toISOString(),
        agentVersion: metadata.agentVersion || 'v6',
        retries: metadata.retries || 0,
        sandboxVerified: metadata.sandboxVerified || false,
        ...metadata
      },
      status: 'pending_review' // pending_review | approved | rejected | committed
    };

    this.staging.set(filePath, entry);
    this.persistEntry('file_staged', entry);
    
    // Emit event for WebSocket broadcasting
    this.emit('file_staged', entry);
    
    // Audit logging
    this.audit('stage', entry, {
      retries: metadata.retries,
      sandboxVerified: metadata.sandboxVerified,
      size: proposedContent.length
    });
    
    console.log(`[VFS] Staged: ${filePath} (${proposedContent.length} bytes)`);
    return entry;
  }

  /**
   * Get staged file entry for diff rendering.
   */
  getStagedFile(filePath) {
    return this.staging.get(filePath);
  }

  /**
   * Get all pending files awaiting user review.
   */
  getPendingFiles(options = {}) {
    const userId = options && typeof options === 'object' ? options.userId : options;
    return this.getPendingFilesForUser(userId);
  }

  getPendingFilesForUser(userId = null) {
    const requestedUserId = userId == null ? null : String(userId);
    return Array.from(this.staging.values())
      .filter(entry => entry.status === 'pending_review')
      .filter(entry => !requestedUserId || String(entry.metadata?.userId) === requestedUserId);
  }

  /**
   * Approve a staged file for commit (called by frontend approval).
   * Marks the entry as ready for physical disk write.
   */
  approveFile(filePath, context = {}) {
    const entry = this.staging.get(filePath);
    if (!entry) {
      throw new Error(`File not found in staging: ${filePath}`);
    }
    
    if (entry.status !== 'pending_review') {
      throw new Error(`File already ${entry.status}: ${filePath}`);
    }

    entry.status = 'approved';
    entry.metadata.approvedAt = new Date().toISOString();
    if (context.requestId) entry.metadata.requestId = context.requestId;
    
    this.persistEntry('file_approved', entry);
    this.emit('file_approved', entry);
    
    // Audit logging
    this.audit('approve', entry, {
      approvedAt: entry.metadata.approvedAt
    });
    
    console.log(`[VFS] Approved for commit: ${filePath}`);
    
    return entry;
  }

  /**
   * Reject a staged file (called by frontend rejection).
   * Drops the proposed changes, keeping original intact.
   */
  rejectFile(filePath, reason = 'User rejected changes', context = {}) {
    const entry = this.staging.get(filePath);
    if (!entry) {
      throw new Error(`File not found in staging: ${filePath}`);
    }

    entry.status = 'rejected';
    entry.metadata.rejectedAt = new Date().toISOString();
    entry.metadata.rejectionReason = reason;
    if (context.requestId) entry.metadata.requestId = context.requestId;

    this.persistEntry('file_rejected', entry);
    this.emit('file_rejected', entry);
    
    // Audit logging
    this.audit('reject', entry, {
      rejectedAt: entry.metadata.rejectedAt,
      reason
    });
    
    console.log(`[VFS] Rejected: ${filePath} (${reason})`);

    // Keep entry for audit log, but mark as rejected
    return entry;
  }

  /**
   * Commit approved file to physical disk.
   * ONLY this method performs actual fs.writeFile.
   */
  async commitToDisk(filePath, fsModule, context = {}) {
    const entry = this.staging.get(filePath);
    if (!entry) {
      throw new Error(`File not found in staging: ${filePath}`);
    }

    if (entry.status !== 'approved') {
      throw new Error(`File must be approved before commit. Current status: ${entry.status}`);
    }
    if (context.requestId) entry.metadata.requestId = context.requestId;

    try {
      // Write to physical disk
      await fsModule.writeFile(filePath, entry.proposedContent, 'utf-8');
      
      entry.status = 'committed';
      entry.metadata.committedAt = new Date().toISOString();
      
      this.persistEntry('file_committed', entry);
      this.emit('file_committed', entry);
      
      // Audit logging
      this.audit('commit', entry, {
        committedAt: entry.metadata.committedAt,
        size: entry.proposedContent.length
      });
      
      console.log(`[VFS] Committed to disk: ${filePath}`);
      
      return entry;
    } catch (error) {
      console.error(`[VFS] Commit failed: ${filePath}`, error);
      
      // Audit logging for failed commit
      this.audit('commit_failed', entry, {
        error: error.message
      });
      
      throw new Error(`Failed to commit ${filePath}: ${error.message}`);
    }
  }

  /**
   * Clear old entries (garbage collection).
   */
  clearOldEntries(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = Date.now() - maxAgeMs;
    let cleared = 0;
    
    for (const [filePath, entry] of this.staging) {
      const entryTime = new Date(entry.metadata.timestamp).getTime();
      if (entryTime < cutoff && entry.status !== 'pending_review') {
        this.staging.delete(filePath);
        this.deleteEntry('file_expired', filePath, entry);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`[VFS] Cleared ${cleared} old entries`);
    }
    
    return cleared;
  }

  /**
   * Clear expired entries using the SRS TTL policy:
   * - non-pending entries always expire after maxAgeMs
   * - pending_review entries expire only when their user has no active session
   */
  clearExpiredEntries({ maxAgeMs = 24 * 60 * 60 * 1000, activeUserIds = new Set() } = {}) {
    const cutoff = Date.now() - maxAgeMs;
    let cleared = 0;

    for (const [filePath, entry] of this.staging) {
      const entryTime = new Date(entry.metadata.timestamp).getTime();
      if (!Number.isFinite(entryTime) || entryTime >= cutoff) continue;

      const userId = entry.metadata.userId;
      const userActive = userId && activeUserIds.has(String(userId));
      const canExpire = entry.status !== 'pending_review' || !userActive;

      if (canExpire) {
        this.staging.delete(filePath);
        this.deleteEntry('file_expired', filePath, entry);
        cleared++;
        this.audit('expire', entry, {
          previousStatus: entry.status,
          expiredAt: new Date().toISOString()
        });
      }
    }

    if (cleared > 0) {
      console.log(`[VFS] Expired ${cleared} stale entries`);
    }

    return cleared;
  }

  /**
   * Get VFS statistics for monitoring.
   */
  getStats({ userId = null } = {}) {
    const requestedUserId = userId == null ? null : String(userId);
    const entries = Array.from(this.staging.values())
      .filter(entry => !requestedUserId || String(entry.metadata?.userId) === requestedUserId);

    return {
      total: entries.length,
      pending: entries.filter(e => e.status === 'pending_review').length,
      approved: entries.filter(e => e.status === 'approved').length,
      rejected: entries.filter(e => e.status === 'rejected').length,
      committed: entries.filter(e => e.status === 'committed').length
    };
  }
}

// Singleton instance
export const vfs = new VirtualFileSystem();

export default VirtualFileSystem;

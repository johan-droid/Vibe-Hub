/**
 * Virtual File System (VFS) — Secure Staging Area v6
 * 
 * Prevents auto-writing to physical disk without user approval.
 * All agent-generated code is staged here first, then committed
 * only after explicit user consent via the frontend diff viewer.
 */

import { EventEmitter } from 'events';
import { logVfsOperation } from '../utils/logger.js';

class VirtualFileSystem extends EventEmitter {
  constructor() {
    super();
    // Map: filePath -> { originalContent, proposedContent, metadata, status }
    this.staging = new Map();
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
    
    // Emit event for WebSocket broadcasting
    this.emit('file_staged', entry);
    
    // Audit logging
    logVfsOperation('stage', filePath, metadata.userId, {
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
  getPendingFiles() {
    return Array.from(this.staging.values())
      .filter(entry => entry.status === 'pending_review');
  }

  /**
   * Approve a staged file for commit (called by frontend approval).
   * Marks the entry as ready for physical disk write.
   */
  approveFile(filePath) {
    const entry = this.staging.get(filePath);
    if (!entry) {
      throw new Error(`File not found in staging: ${filePath}`);
    }
    
    if (entry.status !== 'pending_review') {
      throw new Error(`File already ${entry.status}: ${filePath}`);
    }

    entry.status = 'approved';
    entry.metadata.approvedAt = new Date().toISOString();
    
    this.emit('file_approved', entry);
    
    // Audit logging
    logVfsOperation('approve', filePath, entry.metadata.userId, {
      approvedAt: entry.metadata.approvedAt
    });
    
    console.log(`[VFS] Approved for commit: ${filePath}`);
    
    return entry;
  }

  /**
   * Reject a staged file (called by frontend rejection).
   * Drops the proposed changes, keeping original intact.
   */
  rejectFile(filePath, reason = 'User rejected changes') {
    const entry = this.staging.get(filePath);
    if (!entry) {
      throw new Error(`File not found in staging: ${filePath}`);
    }

    entry.status = 'rejected';
    entry.metadata.rejectedAt = new Date().toISOString();
    entry.metadata.rejectionReason = reason;

    this.emit('file_rejected', entry);
    
    // Audit logging
    logVfsOperation('reject', filePath, entry.metadata.userId, {
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
  async commitToDisk(filePath, fsModule) {
    const entry = this.staging.get(filePath);
    if (!entry) {
      throw new Error(`File not found in staging: ${filePath}`);
    }

    if (entry.status !== 'approved') {
      throw new Error(`File must be approved before commit. Current status: ${entry.status}`);
    }

    try {
      // Write to physical disk
      await fsModule.writeFile(filePath, entry.proposedContent, 'utf-8');
      
      entry.status = 'committed';
      entry.metadata.committedAt = new Date().toISOString();
      
      this.emit('file_committed', entry);
      
      // Audit logging
      logVfsOperation('commit', filePath, entry.metadata.userId, {
        committedAt: entry.metadata.committedAt,
        size: entry.proposedContent.length
      });
      
      console.log(`[VFS] Committed to disk: ${filePath}`);
      
      return entry;
    } catch (error) {
      console.error(`[VFS] Commit failed: ${filePath}`, error);
      
      // Audit logging for failed commit
      logVfsOperation('commit_failed', filePath, entry.metadata.userId, {
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
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`[VFS] Cleared ${cleared} old entries`);
    }
    
    return cleared;
  }

  /**
   * Get VFS statistics for monitoring.
   */
  getStats() {
    const entries = Array.from(this.staging.values());
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

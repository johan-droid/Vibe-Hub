import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { logger } from '../utils/detailed-logger.js';
import ignore from 'ignore';

const AUDIT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

const DEFAULT_OPTIONS = {
  maxFileSize: 5 * 1024 * 1024,
  maxTotalSize: 50 * 1024 * 1024,
  maxFiles: 1000,
  maxStagingAge: 24 * 60 * 60 * 1000,
  workDir: process.env.VFS_WORK_DIR || process.cwd()
};

export class VFSContainer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.root = path.resolve(this.options.workDir);
    this.realRoot = this._safeRealpath(this.root);
    this.staging = new Map();
    this.auditLog = [];
    this.totalStagedSize = 0;
    this.ig = ignore();

    const baseIgnores = [
      'node_modules/',
      '.git/',
      'dist/',
      'build/',
      '.env*',
      '*.log'
    ];
    this.ig.add(baseIgnores);
    this._loadGitignore();

    // ⚡ Bolt: Pre-compile stateless RegExp for rapid directory exclusion
    this.ignorePattern = /^(?:node_modules|\.git|dist|\.next|out|build)$/;

    logger.info('VFS', 'VFS initialized', {
      root: this.root,
      maxFiles: this.options.maxFiles
    });
  }

  _loadGitignore() {
    try {
      const gitignorePath = path.join(this.root, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        this.ig.add(content);
        logger.info('VFS', 'Loaded .gitignore rules');
      }
    } catch (error) {
      logger.warn('VFS', 'Failed to load .gitignore', { error: error.message });
    }
  }

  _audit(level, message, operation, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      operation,
      ...details
    };
    this.auditLog.push(entry);

    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    if (level === AUDIT_LEVELS.ERROR) {
      logger.error('VFS', message, details);
    } else if (level === AUDIT_LEVELS.WARNING) {
      logger.warn('VFS', message, details);
    } else {
      logger.info('VFS', message, details);
    }

    this.emit('audit', entry);
  }

  isPathIgnored(targetPath) {
    if (!targetPath) return true;

    const parts = targetPath.split(/[\/\\]/);
    if (parts.some(p => p.startsWith('.') && p !== '.' && p !== '..')) {
      return true;
    }

    // ⚡ Bolt: Fast-path directory rejection using stateless RegExp
    if (parts.some(p => this.ignorePattern.test(p))) {
        return true;
    }

    const absolutePath = path.resolve(this.root, targetPath);
    const relativePath = path.relative(this.root, absolutePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return true;

    return this.ig.ignores(relativePath);
  }

  async read(targetPath, userId = 'system') {
    if (this.isPathIgnored(targetPath)) {
      throw new Error(`Access to path ${targetPath} is restricted`);
    }

    const absolutePath = this._validatePath(targetPath);

    if (this.staging.has(targetPath)) {
      return this.staging.get(targetPath).content;
    }

    try {
      const content = await fs.promises.readFile(absolutePath, 'utf8');
      this._audit(AUDIT_LEVELS.INFO, 'File read', 'read', {
        path: targetPath,
        userId
      });
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  stage(targetPath, content, metadata = {}, userId = 'system') {
    if (!targetPath || typeof content !== 'string') {
      throw new Error('Invalid stage parameters');
    }

    if (this.isPathIgnored(targetPath)) {
      throw new Error(`Cannot stage ignored path: ${targetPath}`);
    }

    const absolutePath = this._validatePath(targetPath);

    const size = Buffer.byteLength(content, 'utf8');
    if (size > this.options.maxFileSize) {
      throw new Error(`File size exceeds limit of ${this.options.maxFileSize} bytes`);
    }

    const currentSize = this.staging.has(targetPath)
      ? Buffer.byteLength(this.staging.get(targetPath).content, 'utf8')
      : 0;

    if (this.totalStagedSize - currentSize + size > this.options.maxTotalSize) {
      throw new Error(`Total staging size exceeds limit of ${this.options.maxTotalSize} bytes`);
    }

    if (!this.staging.has(targetPath) && this.staging.size >= this.options.maxFiles) {
      throw new Error(`Staging area file limit (${this.options.maxFiles}) reached`);
    }

    const entry = {
      filePath: targetPath,
      path: targetPath,
      originalContent: metadata.originalContent ?? '',
      proposedContent: content,
      content,
      status: metadata.status || 'pending_review',
      metadata: {
        ...metadata,
        size,
        stagedAt: Date.now(),
        userId
      }
    };

    this.staging.set(targetPath, entry);

    this.totalStagedSize = this.totalStagedSize - currentSize + size;

    this._audit(AUDIT_LEVELS.INFO, 'File staged', 'stage', {
      path: targetPath,
      size,
      userId
    });

    this.emit('staged', { path: targetPath, size, userId });
    this.emit('file_staged', entry);
    return entry;
  }

  stageFile(filePath, originalContent = '', proposedContent = '', metadata = {}) {
    const userId = metadata.userId || 'system';
    return this.stage(
      filePath,
      proposedContent,
      {
        ...metadata,
        originalContent,
        status: 'pending_review'
      },
      userId
    );
  }

  getStagedFile(filePath) {
    return this.staging.get(filePath) || null;
  }

  approveFile(filePath, options = {}) {
    const entry = this._requireStagedEntry(filePath);
    this._assertEntryOwner(entry, options.userId);

    entry.status = 'approved';
    entry.metadata = {
      ...entry.metadata,
      approvedAt: new Date().toISOString(),
      approvedBy: options.userId || entry.metadata.userId
    };

    this._audit(AUDIT_LEVELS.INFO, 'File approved', 'approve', {
      path: filePath,
      userId: options.userId || entry.metadata.userId
    });

    this.emit('file_approved', entry);
    return entry;
  }

  rejectFile(filePath, reason = 'Rejected', options = {}) {
    const entry = this._requireStagedEntry(filePath);
    this._assertEntryOwner(entry, options.userId);

    entry.status = 'rejected';
    entry.metadata = {
      ...entry.metadata,
      rejectedAt: new Date().toISOString(),
      rejectedBy: options.userId || entry.metadata.userId,
      rejectionReason: reason
    };

    this.totalStagedSize -= entry.metadata.size || 0;
    this.staging.delete(filePath);

    this._audit(AUDIT_LEVELS.INFO, 'File rejected', 'reject', {
      path: filePath,
      reason,
      userId: options.userId || entry.metadata.userId
    });

    this.emit('file_rejected', entry);
    this.emit('rejected', { path: filePath, userId: options.userId || entry.metadata.userId });
    return entry;
  }

  async commitToDisk(filePath, fsModule = fs, options = {}) {
    const entry = this._requireStagedEntry(filePath);
    this._assertEntryOwner(entry, options.userId);

    if (entry.status !== 'approved') {
      throw new Error('File must be approved before commit');
    }

    const absolutePath = this._validatePath(filePath);
    const writer = fsModule.promises || fsModule;

    try {
      await writer.mkdir(path.dirname(absolutePath), { recursive: true });
      await writer.writeFile(absolutePath, entry.proposedContent ?? entry.content, 'utf8');

      entry.status = 'committed';
      entry.metadata = {
        ...entry.metadata,
        committedAt: new Date().toISOString(),
        committedBy: options.userId || entry.metadata.userId
      };

      this.totalStagedSize -= entry.metadata.size || 0;
      this.staging.delete(filePath);

      this._audit(AUDIT_LEVELS.INFO, 'File committed', 'commit', {
        path: filePath,
        size: entry.metadata.size,
        userId: options.userId || entry.metadata.userId
      });

      this.emit('file_committed', entry);
      this.emit('committed', { path: filePath, userId: options.userId || entry.metadata.userId });
      return entry;
    } catch (error) {
      this._audit(AUDIT_LEVELS.ERROR, 'Commit failed', 'commit', {
        path: filePath,
        error: error.message,
        userId: options.userId || entry.metadata.userId
      });
      throw error;
    }
  }

  async commit(targetPath, userId = 'system', approved = false) {
    if (!approved) {
      throw new Error('Commit requires explicit approval');
    }

    if (!this.staging.has(targetPath)) {
      throw new Error(`No staged changes for ${targetPath}`);
    }

    const entry = this.staging.get(targetPath);
    const absolutePath = this._validatePath(targetPath);

    try {
      await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.promises.writeFile(absolutePath, entry.content, 'utf8');

      this.totalStagedSize -= entry.metadata.size;
      this.staging.delete(targetPath);

      this._audit(AUDIT_LEVELS.INFO, 'File committed', 'commit', {
        path: targetPath,
        size: entry.metadata.size,
        userId
      });

      this.emit('committed', { path: targetPath, userId });
    } catch (error) {
      this._audit(AUDIT_LEVELS.ERROR, 'Commit failed', 'commit', {
        path: targetPath,
        error: error.message,
        userId
      });
      throw error;
    }
  }

  async commitAll(userId = 'system', approved = false) {
    if (!approved) {
      throw new Error('Commit requires explicit approval');
    }

    const errors = [];
    const paths = Array.from(this.staging.keys());

    for (const targetPath of paths) {
      try {
        await this.commit(targetPath, userId, true);
      } catch (error) {
        errors.push({ path: targetPath, error: error.message });
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to commit some files: ${JSON.stringify(errors)}`);
    }
  }

  reject(targetPath, userId = 'system') {
    if (!this.staging.has(targetPath)) {
      return false;
    }

    const entry = this.staging.get(targetPath);
    this.totalStagedSize -= entry.metadata.size;
    this.staging.delete(targetPath);

    this._audit(AUDIT_LEVELS.INFO, 'Changes rejected', 'reject', {
      path: targetPath,
      userId
    });

    this.emit('rejected', { path: targetPath, userId });
    return true;
  }

  getPendingFilesForUser(userId) {
    const pending = [];
    for (const [targetPath, entry] of this.staging.entries()) {
      if (entry.status === 'pending_review' && String(entry.metadata.userId) === String(userId)) {
        pending.push({
          ...entry,
          path: targetPath,
          filePath: targetPath,
          size: entry.metadata.size,
          stagedAt: entry.metadata.stagedAt
        });
      }
    }
    return pending;
  }

  getPendingFiles(options = {}) {
    const userId = options.userId;
    return Array.from(this.staging.entries())
      .filter(([, entry]) => entry.status === 'pending_review')
      .filter(([, entry]) => !userId || String(entry.metadata.userId) === String(userId))
      .map(([targetPath, entry]) => ({
        ...entry,
        path: targetPath,
        filePath: targetPath,
        size: entry.metadata.size,
        stagedAt: entry.metadata.stagedAt
      }));
  }

  clearOldEntries() {
    const now = Date.now();
    let cleared = 0;

    for (const [targetPath, entry] of this.staging.entries()) {
      if (now - entry.metadata.stagedAt > this.options.maxStagingAge) {
        this.totalStagedSize -= entry.metadata.size;
        this.staging.delete(targetPath);
        cleared++;

        this._audit(AUDIT_LEVELS.WARNING, 'Stale entry cleared', 'clear', {
          path: targetPath,
          age: now - entry.metadata.stagedAt
        });
      }
    }

    if (cleared > 0) {
      logger.info('VFS', `Cleared ${cleared} stale staging entries`);
    }
    return cleared;
  }

  getStats(options = {}) {
    let pendingCount = 0;
    let approvedCount = 0;
    let totalCount = 0;
    let totalSize = 0;
    const userId = options.userId;

    for (const entry of this.staging.values()) {
      if (userId && String(entry.metadata.userId) !== String(userId)) continue;

      totalCount++;
      totalSize += entry.metadata.size || 0;
      if (entry.status === 'approved') approvedCount++;
      if (entry.status === 'pending_review' && !entry.metadata.conflict) pendingCount++;
    }

    return {
      total: totalCount,
      pending: pendingCount,
      approved: approvedCount,
      rejected: 0,
      committed: 0,
      stagedFiles: totalCount,
      pendingApproval: pendingCount,
      totalSize: userId ? totalSize : this.totalStagedSize,
      maxSize: this.options.maxTotalSize
    };
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  /**
   * Securely validate path to prevent escape from root
   * @private
   */
  _validatePath(targetPath) {
    const absolutePath = path.resolve(this.root, targetPath);
    const relative = path.relative(this.root, absolutePath);
    
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path escape attempt detected');
    }

    const nearestParent = this._nearestExistingParent(path.dirname(absolutePath));
    const realParent = this._safeRealpath(nearestParent);
    const parentRelative = path.relative(this.realRoot, realParent);
    if (parentRelative.startsWith('..') || path.isAbsolute(parentRelative)) {
      throw new Error('Path escape attempt detected');
    }

    try {
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        throw new Error('Path escape attempt detected');
      }
      const realTarget = this._safeRealpath(absolutePath);
      const targetRelative = path.relative(this.realRoot, realTarget);
      if (targetRelative.startsWith('..') || path.isAbsolute(targetRelative)) {
        throw new Error('Path escape attempt detected');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    
    return absolutePath;
  }

  _safeRealpath(targetPath) {
    try {
      return fs.realpathSync.native(targetPath);
    } catch {
      return path.resolve(targetPath);
    }
  }

  _nearestExistingParent(targetDir) {
    let current = path.resolve(targetDir);
    while (!fs.existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) return this.root;
      current = parent;
    }
    return current;
  }

  async configureRedis({ client = null, subscriber = null, sourceId = null } = {}) {
    this.redis = { client, subscriber, sourceId };
    return { enabled: Boolean(client && subscriber), sourceId };
  }

  clearExpiredEntries({ maxAgeMs = this.options.maxStagingAge } = {}) {
    const now = Date.now();
    let cleared = 0;

    for (const [targetPath, entry] of this.staging.entries()) {
      const ageMs = now - (entry.metadata.stagedAt || now);
      const ownerId = entry.metadata.userId == null ? null : String(entry.metadata.userId);

      if (ageMs > maxAgeMs) {
        this.totalStagedSize -= entry.metadata.size || 0;
        this.staging.delete(targetPath);
        cleared++;

        this._audit(AUDIT_LEVELS.WARNING, 'Expired staged file cleared', 'clear_expired', {
          path: targetPath,
          ageMs,
          userId: ownerId
        });
      }
    }

    return cleared;
  }

  _requireStagedEntry(filePath) {
    const entry = this.staging.get(filePath);
    if (!entry) {
      throw new Error(`File not found in staging: ${filePath}`);
    }
    return entry;
  }

  _assertEntryOwner(entry, userId) {
    if (!userId) return;
    if (String(entry.metadata.userId) !== String(userId)) {
      throw new Error('Commit unauthorized for staged file');
    }
  }
}

export const vfs = new VFSContainer();

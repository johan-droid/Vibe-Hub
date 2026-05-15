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

    this.staging.set(targetPath, {
      content,
      metadata: {
        ...metadata,
        size,
        stagedAt: Date.now(),
        userId
      }
    });

    this.totalStagedSize = this.totalStagedSize - currentSize + size;

    this._audit(AUDIT_LEVELS.INFO, 'File staged', 'stage', {
      path: targetPath,
      size,
      userId
    });

    this.emit('staged', { path: targetPath, size, userId });
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
    // ⚡ Bolt Optimization: Single O(N) pass iteration to avoid array mapping and filtering
    const pending = [];
    for (const [targetPath, entry] of this.staging.entries()) {
      if (entry.metadata.userId === userId) {
        pending.push({
          path: targetPath,
          size: entry.metadata.size,
          stagedAt: entry.metadata.stagedAt
        });
      }
    }
    return pending;
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

  getStats() {
    let pendingCount = 0;

    // ⚡ Bolt Optimization: Replace chained Array.from.filter with a single O(N) iteration
    for (const entry of this.staging.values()) {
        if (!entry.metadata.conflict) {
            pendingCount++;
        }
    }

    return {
      stagedFiles: this.staging.size,
      pendingApproval: pendingCount,
      totalSize: this.totalStagedSize,
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
}

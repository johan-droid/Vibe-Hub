/**
 * Virtual File System Unit Tests (Vitest)
 * 
 * Tests VFS staging, validation, commit workflows, and V6 boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VFSContainer } from '../vfs/container.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('VFSContainer', () => {
  let vfs;

  beforeEach(() => {
    vfs = new VFSContainer({ maxFileSize: 1000, maxTotalSize: 5000, maxFiles: 10 });
    // Mock fs.promises for commit testing
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue('existing_content');
  });

  afterEach(() => {
    vfs.removeAllListeners();
    vi.restoreAllMocks();
  });

  describe('stage', () => {
    it('should stage a file correctly', () => {
      vfs.stage('test.js', 'proposed code', { sandboxVerified: true }, 'user-123');

      const entry = vfs.staging.get('test.js');
      expect(entry).toBeDefined();
      expect(entry.content).toBe('proposed code');
      expect(entry.metadata.userId).toBe('user-123');
      expect(entry.metadata.sandboxVerified).toBe(true);
      expect(entry.metadata.size).toBeGreaterThan(0);
      expect(entry.metadata.stagedAt).toBeDefined();
    });

    it('should emit staged event', () => {
      const listener = vi.fn();
      vfs.on('staged', listener);

      vfs.stage('test.js', 'proposed', {}, 'user-1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].path).toBe('test.js');
    });

    it('should enforce single file size limit', () => {
      const hugeContent = 'a'.repeat(2000); // Max is 1000
      expect(() => vfs.stage('huge.js', hugeContent)).toThrow(/exceeds limit/);
    });

    it('should enforce total staging size limit', () => {
      vfs.stage('file1.js', 'a'.repeat(900));
      vfs.stage('file2.js', 'a'.repeat(900));
      vfs.stage('file3.js', 'a'.repeat(900));
      vfs.stage('file4.js', 'a'.repeat(900));
      vfs.stage('file5.js', 'a'.repeat(900)); // Total: 4500
      expect(() => vfs.stage('file6.js', 'a'.repeat(900))).toThrow(/Total staging size exceeds/);
    });
  });

  describe('commit', () => {
    it('should write file to disk when approved', async () => {
      vfs.stage('test.js', 'proposed code', {}, 'user-1');
      
      await vfs.commit('test.js', 'user-1', true);

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.resolve(vfs.root, 'test.js'),
        'proposed code',
        'utf8'
      );
      
      // Should be removed from staging after commit
      expect(vfs.staging.has('test.js')).toBe(false);
    });

    it('should throw if not explicitly approved', async () => {
      vfs.stage('test.js', 'proposed code');
      await expect(vfs.commit('test.js')).rejects.toThrow('Commit requires explicit approval');
    });

    it('should throw if file not in staging', async () => {
      await expect(vfs.commit('nonexistent.js', 'user-1', true)).rejects.toThrow('No staged changes for');
    });

    it('should emit committed event', async () => {
      const listener = vi.fn();
      vfs.on('committed', listener);
      vfs.stage('test.js', 'proposed', {}, 'user-1');

      await vfs.commit('test.js', 'user-1', true);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].path).toBe('test.js');
    });
  });

  describe('reject', () => {
    it('should remove file from staging and emit event', () => {
      const listener = vi.fn();
      vfs.on('rejected', listener);
      
      vfs.stage('test.js', 'proposed', {}, 'user-1');
      const rejected = vfs.reject('test.js', 'user-1');

      expect(rejected).toBe(true);
      expect(vfs.staging.has('test.js')).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should return false if file not found', () => {
      expect(vfs.reject('nonexistent.js')).toBe(false);
    });
  });

  describe('getPendingFilesForUser', () => {
    it('should scope pending files by user', () => {
      vfs.stage('user-1.js', 'a', {}, 'user-1');
      vfs.stage('user-2.js', 'b', {}, 'user-2');

      const pending = vfs.getPendingFilesForUser('user-1');

      expect(pending).toHaveLength(1);
      expect(pending[0].path).toBe('user-1.js');
    });
  });

  describe('clearOldEntries', () => {
    it('should remove stale staging entries', () => {
      vfs.stage('old.js', 'a', {}, 'user-1');
      
      // Manually make it stale
      const entry = vfs.staging.get('old.js');
      entry.metadata.stagedAt = Date.now() - (vfs.options.maxStagingAge + 10000);

      const cleared = vfs.clearOldEntries();

      expect(cleared).toBe(1);
      expect(vfs.staging.has('old.js')).toBe(false);
    });
  });

  describe('V6 Path Security Boundaries', () => {
    it('should reject paths escaping root', () => {
      expect(() => vfs.stage('../secrets.txt', 'data')).toThrow('Cannot stage ignored path');
      expect(() => vfs._validatePath('/etc/passwd')).toThrow('Path escape attempt');
      expect(() => vfs._validatePath(`${vfs.root}-secrets/key.txt`)).toThrow('Path escape attempt');
      expect(vfs.isPathIgnored(`${vfs.root}-secrets/key.txt`)).toBe(true);
    });

    it('should reject symlink traversal outside the root', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfs-root-'));
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'vfs-outside-'));
      const linkPath = path.join(root, 'linked-outside');
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      let linkCreated = false;

      try {
        fs.symlinkSync(outside, linkPath, linkType);
        linkCreated = true;
        const linkedVfs = new VFSContainer({ workDir: root });
        expect(() => linkedVfs._validatePath('linked-outside/secret.txt')).toThrow('Path escape attempt');
      } catch (error) {
        if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
      } finally {
        if (linkCreated) fs.rmSync(linkPath, { force: true, recursive: true });
        fs.rmSync(root, { force: true, recursive: true });
        fs.rmSync(outside, { force: true, recursive: true });
      }
    });

    it('should correctly block ignored directories', () => {
      expect(vfs.isPathIgnored('node_modules/bad.js')).toBe(true);
      expect(vfs.isPathIgnored('.git/config')).toBe(true);
      expect(vfs.isPathIgnored('src/main.js')).toBe(false);
    });
  });
});

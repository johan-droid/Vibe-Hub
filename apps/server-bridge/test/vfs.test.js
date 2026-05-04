/**
 * Virtual File System Unit Tests (Vitest)
 * 
 * Tests VFS staging, approval, rejection, and commit workflows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VirtualFileSystem, { vfs } from '../vfs/container.js';

describe('Virtual File System', () => {
  let vfs;
  let mockFs;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
    mockFs = {
      writeFile: vi.fn().mockResolvedValue(undefined)
    };
  });

  afterEach(() => {
    vfs.removeAllListeners();
  });

  describe('stageFile', () => {
    it('should stage a file with correct initial status', () => {
      const entry = vfs.stageFile(
        '/test/file.js',
        'original code',
        'proposed code',
        { userId: 'user-123', retries: 0, sandboxVerified: true }
      );

      expect(entry.status).toBe('pending_review');
      expect(entry.filePath).toBe('/test/file.js');
      expect(entry.originalContent).toBe('original code');
      expect(entry.proposedContent).toBe('proposed code');
    });

    it('should emit file_staged event', () => {
      const listener = vi.fn();
      vfs.on('file_staged', listener);

      vfs.stageFile('/test/file.js', 'original', 'proposed', { userId: 'user-1' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].status).toBe('pending_review');
    });

    it('should store metadata correctly', () => {
      const metadata = {
        userId: 'user-123',
        retries: 2,
        sandboxVerified: true,
        agentVersion: 'v6'
      };

      const entry = vfs.stageFile('/test.js', 'orig', 'prop', metadata);

      expect(entry.metadata.userId).toBe('user-123');
      expect(entry.metadata.retries).toBe(2);
      expect(entry.metadata.sandboxVerified).toBe(true);
      expect(entry.metadata.agentVersion).toBe('v6');
      expect(entry.metadata.timestamp).toBeDefined();
    });

    it('should allow multiple files to be staged', () => {
      vfs.stageFile('/file1.js', 'a', 'b', { userId: 'user-1' });
      vfs.stageFile('/file2.js', 'c', 'd', { userId: 'user-1' });
      vfs.stageFile('/file3.js', 'e', 'f', { userId: 'user-1' });

      expect(vfs.getStats().total).toBe(3);
      expect(vfs.getStats().pending).toBe(3);
    });
  });

  describe('getStagedFile', () => {
    it('should retrieve a staged file by path', () => {
      vfs.stageFile('/test.js', 'original', 'proposed', { userId: 'user-1' });

      const entry = vfs.getStagedFile('/test.js');

      expect(entry).toBeDefined();
      expect(entry.filePath).toBe('/test.js');
    });

    it('should return undefined for non-existent file', () => {
      const entry = vfs.getStagedFile('/nonexistent.js');
      expect(entry).toBeUndefined();
    });
  });

  describe('getPendingFiles', () => {
    it('should return only pending files', () => {
      vfs.stageFile('/pending.js', 'a', 'b', { userId: 'user-1' });
      const entry2 = vfs.stageFile('/approved.js', 'c', 'd', { userId: 'user-1' });
      
      // Approve second file
      vfs.approveFile('/approved.js');

      const pending = vfs.getPendingFiles();

      expect(pending).toHaveLength(1);
      expect(pending[0].filePath).toBe('/pending.js');
    });

    it('should return empty array when no pending files', () => {
      const pending = vfs.getPendingFiles();
      expect(pending).toEqual([]);
    });

    it('should scope pending files by user', () => {
      vfs.stageFile('/user-1.js', 'a', 'b', { userId: 'user-1' });
      vfs.stageFile('/user-2.js', 'c', 'd', { userId: 'user-2' });

      const pending = vfs.getPendingFiles({ userId: 'user-1' });

      expect(pending).toHaveLength(1);
      expect(pending[0].filePath).toBe('/user-1.js');
    });
  });

  describe('approveFile', () => {
    it('should mark file as approved', () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });

      const entry = vfs.approveFile('/test.js');

      expect(entry.status).toBe('approved');
      expect(entry.metadata.approvedAt).toBeDefined();
    });

    it('should emit file_approved event', () => {
      const listener = vi.fn();
      vfs.on('file_approved', listener);
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });

      vfs.approveFile('/test.js');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw if file not found', () => {
      expect(() => vfs.approveFile('/nonexistent.js'))
        .toThrow('File not found in staging: /nonexistent.js');
    });

    it('should throw if file already approved', () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });
      vfs.approveFile('/test.js');

      expect(() => vfs.approveFile('/test.js'))
        .toThrow('File already approved: /test.js');
    });

    it('should throw if file already rejected', () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });
      vfs.rejectFile('/test.js');

      expect(() => vfs.approveFile('/test.js'))
        .toThrow('File already rejected: /test.js');
    });

    it('should throw if file already committed', async () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });
      vfs.approveFile('/test.js');
      await vfs.commitToDisk('/test.js', mockFs);

      expect(() => vfs.approveFile('/test.js'))
        .toThrow('File already committed: /test.js');
    });
  });

  describe('rejectFile', () => {
    it('should mark file as rejected', () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });

      const entry = vfs.rejectFile('/test.js', 'User did not like the code');

      expect(entry.status).toBe('rejected');
      expect(entry.metadata.rejectedAt).toBeDefined();
      expect(entry.metadata.rejectionReason).toBe('User did not like the code');
    });

    it('should emit file_rejected event', () => {
      const listener = vi.fn();
      vfs.on('file_rejected', listener);
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });

      vfs.rejectFile('/test.js', 'Test reason');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].metadata.rejectionReason).toBe('Test reason');
    });

    it('should keep rejected file in staging for audit', () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });
      vfs.rejectFile('/test.js');

      const entry = vfs.getStagedFile('/test.js');
      expect(entry).toBeDefined();
      expect(entry.status).toBe('rejected');
    });

    it('should throw if file not found', () => {
      expect(() => vfs.rejectFile('/nonexistent.js'))
        .toThrow('File not found in staging: /nonexistent.js');
    });

    it('should use default reason if not provided', () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });
      
      const entry = vfs.rejectFile('/test.js');

      expect(entry.metadata.rejectionReason).toBe('User rejected changes');
    });
  });

  describe('commitToDisk', () => {
    it('should write file to disk when approved', async () => {
      vfs.stageFile('/test.js', 'original', 'proposed code', { userId: 'user-1' });
      vfs.approveFile('/test.js');

      await vfs.commitToDisk('/test.js', mockFs);

      expect(mockFs.writeFile).toHaveBeenCalledWith('/test.js', 'proposed code', 'utf-8');
    });

    it('should mark file as committed', async () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });
      vfs.approveFile('/test.js');

      const entry = await vfs.commitToDisk('/test.js', mockFs);

      expect(entry.status).toBe('committed');
      expect(entry.metadata.committedAt).toBeDefined();
    });

    it('should emit file_committed event', async () => {
      const listener = vi.fn();
      vfs.on('file_committed', listener);
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });
      vfs.approveFile('/test.js');

      await vfs.commitToDisk('/test.js', mockFs);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw if file not approved', async () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });

      await expect(vfs.commitToDisk('/test.js', mockFs))
        .rejects.toThrow('File must be approved before commit');
    });

    it('should throw if file not found', async () => {
      await expect(vfs.commitToDisk('/nonexistent.js', mockFs))
        .rejects.toThrow('File not found in staging: /nonexistent.js');
    });

    it('should not write to disk if write fails', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });
      vfs.approveFile('/test.js');

      await expect(vfs.commitToDisk('/test.js', mockFs))
        .rejects.toThrow('Failed to commit /test.js: Disk full');

      const entry = vfs.getStagedFile('/test.js');
      expect(entry.status).toBe('approved'); // Still approved, not committed
    });
  });

  describe('getStats', () => {
    it('should return correct counts', () => {
      vfs.stageFile('/pending1.js', 'a', 'b', { userId: 'user-1' });
      vfs.stageFile('/pending2.js', 'c', 'd', { userId: 'user-1' });
      vfs.stageFile('/approved.js', 'e', 'f', { userId: 'user-1' });
      vfs.approveFile('/approved.js');
      vfs.stageFile('/rejected.js', 'g', 'h', { userId: 'user-1' });
      vfs.rejectFile('/rejected.js');

      const stats = vfs.getStats();

      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(2);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.committed).toBe(0);
    });

    it('should scope counts by user', () => {
      vfs.stageFile('/user-1-pending.js', 'a', 'b', { userId: 'user-1' });
      vfs.stageFile('/user-1-rejected.js', 'c', 'd', { userId: 'user-1' });
      vfs.rejectFile('/user-1-rejected.js');
      vfs.stageFile('/user-2-pending.js', 'e', 'f', { userId: 'user-2' });

      const stats = vfs.getStats({ userId: 'user-1' });

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.rejected).toBe(1);
    });
  });

  describe('Redis persistence', () => {
    it('should write staged entries as expiring Redis hashes', () => {
      const operations = [];
      const redis = {
        multi: () => ({
          hset: (...args) => {
            operations.push(['hset', ...args]);
            return redis.multiChain;
          },
          expire: (...args) => {
            operations.push(['expire', ...args]);
            return redis.multiChain;
          },
          sadd: (...args) => {
            operations.push(['sadd', ...args]);
            return redis.multiChain;
          },
          publish: (...args) => {
            operations.push(['publish', ...args]);
            return redis.multiChain;
          },
          exec: () => Promise.resolve([])
        })
      };
      redis.multiChain = redis.multi();
      vfs.redis = redis;
      vfs.redisSourceId = 'test-source';

      vfs.stageFile('/redis.js', 'old', 'next', { userId: 'user-1' });

      expect(operations[0][0]).toBe('hset');
      expect(operations[0][1]).toBe('vfs:entry:%2Fredis.js');
      expect(operations[0]).toContain('metadata');
      expect(operations[1]).toEqual(['expire', 'vfs:entry:%2Fredis.js', 86400]);
      expect(operations.some(([name]) => name === 'publish')).toBe(true);
    });
  });

  describe('clearOldEntries', () => {
    it('should remove old non-pending entries', () => {
      // Create old entries by manipulating timestamps
      vfs.stageFile('/old.js', 'a', 'b', { userId: 'user-1' });
      vfs.rejectFile('/old.js');
      
      // Set old timestamp
      const entry = vfs.getStagedFile('/old.js');
      entry.metadata.timestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const cleared = vfs.clearOldEntries(24 * 60 * 60 * 1000);

      expect(cleared).toBe(1);
      expect(vfs.getStagedFile('/old.js')).toBeUndefined();
    });

    it('should not remove pending entries', () => {
      vfs.stageFile('/pending.js', 'a', 'b', { userId: 'user-1' });
      
      // Set old timestamp
      const entry = vfs.getStagedFile('/pending.js');
      entry.metadata.timestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const cleared = vfs.clearOldEntries(24 * 60 * 60 * 1000);

      expect(cleared).toBe(0);
      expect(vfs.getStagedFile('/pending.js')).toBeDefined();
    });
  });

  describe('Security', () => {
    it('should not allow commit without approval (prevents unauthorized writes)', async () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-1' });

      await expect(vfs.commitToDisk('/test.js', mockFs))
        .rejects.toThrow('File must be approved before commit');

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should preserve original content after staging', () => {
      const original = 'original code that should be preserved';
      vfs.stageFile('/test.js', original, 'new code', { userId: 'user-1' });

      const entry = vfs.getStagedFile('/test.js');
      expect(entry.originalContent).toBe(original);
    });

    it('should track userId for audit trail', () => {
      vfs.stageFile('/test.js', 'a', 'b', { userId: 'user-123' });

      const entry = vfs.getStagedFile('/test.js');
      expect(entry.metadata.userId).toBe('user-123');
    });
  });
});

describe('VFS Singleton', () => {
  it('vfs should be a singleton instance', () => {
    // The exported vfs should be the same instance
    expect(vfs).toBeDefined();
    expect(typeof vfs.stageFile).toBe('function');
  });
});

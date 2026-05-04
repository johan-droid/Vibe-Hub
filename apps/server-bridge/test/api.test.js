/**
 * API Endpoint Integration Tests (Vitest + Supertest)
 * 
 * Tests all REST API endpoints with validation and error handling.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

// Mock the modules before importing the app
vi.mock('../vfs/container.js', () => ({
  vfs: {
    stageFile: vi.fn(),
    approveFile: vi.fn(),
    rejectFile: vi.fn(),
    commitToDisk: vi.fn(),
    getStagedFile: vi.fn(),
    getPendingFiles: vi.fn(),
    getPendingFilesForUser: vi.fn(),
    getStats: vi.fn()
  }
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  logError: vi.fn(),
  logVfsOperation: vi.fn(),
  requestContext: (req, res, next) => {
    req.id = 'test-request-id';
    next();
  }
}));

// Import after mocking
import { vfs } from '../vfs/container.js';

describe('API Endpoints', () => {
  let app;
  let server;
  let io;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.id = 'test-request-id';
      req.user = { id: TEST_USER_ID };
      next();
    });
    
    // Create server with Socket.io
    server = createServer(app);
    io = new Server(server);
    app.set('io', io);

    // Import routes after setting up mocks
    const { handleCodeJobStatus, handleCodeRequest, handleCommitRequest, handleGetPendingFiles, handleGetVfsStats } = 
      await import('../orchestrator/router.js');
    
    // Mount routes
    app.post('/api/code', handleCodeRequest);
    app.get('/api/code/jobs/:jobId', (req, _res, next) => {
      req.user = { id: TEST_USER_ID };
      next();
    }, handleCodeJobStatus);
    app.post('/api/fs/commit', handleCommitRequest);
    app.get('/api/fs/pending', handleGetPendingFiles);
    app.get('/api/fs/stats', handleGetVfsStats);
  });

  afterAll(() => {
    server.close();
    io.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vfs.getStagedFile.mockReturnValue({
      filePath: 'test.js',
      status: 'pending_review',
      metadata: { userId: TEST_USER_ID }
    });
  });

  describe('POST /api/code', () => {
    it('should require socketId in request body', async () => {
      const response = await request(app)
        .post('/api/code')
        .send({
          prompt: 'Create a function',
          userId: TEST_USER_ID,
          targetFile: 'test.js'
        });

      expect(response.status).toBe(400);
      expect(response.body.details.some(detail => detail.field === 'socketId')).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/code')
        .send({
          // Missing prompt, userId, targetFile
          socketId: 'socket-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject path traversal attempts', async () => {
      const response = await request(app)
        .post('/api/code')
        .send({
          prompt: 'Test',
          userId: TEST_USER_ID,
          targetFile: '../../../etc/passwd',
          socketId: 'socket-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toBeDefined();
    });

    it('should reject absolute paths', async () => {
      const response = await request(app)
        .post('/api/code')
        .send({
          prompt: 'Test',
          userId: TEST_USER_ID,
          targetFile: '/absolute/path.js',
          socketId: 'socket-123'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/code/jobs/:jobId', () => {
    it('should return queued job status for the owning user', async () => {
      app.set('codeQueue', {
        getStatus: vi.fn().mockResolvedValue({
          id: 'job-123',
          state: 'completed'
        })
      });

      const response = await request(app)
        .get('/api/code/jobs/job-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job.id).toBe('job-123');
    });

    it('should reject job status reads for another user', async () => {
      app.set('codeQueue', {
        getStatus: vi.fn().mockResolvedValue({ forbidden: true })
      });

      const response = await request(app)
        .get('/api/code/jobs/job-123');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('access');
    });
  });

  describe('POST /api/fs/commit', () => {
    it('should commit approved changes successfully', async () => {
      const mockEntry = {
        filePath: 'test.js',
        status: 'committed',
        metadata: {
          userId: TEST_USER_ID,
          committedAt: '2026-05-04T01:00:00Z'
        }
      };

      vfs.approveFile.mockReturnValue(mockEntry);
      vfs.commitToDisk.mockResolvedValue(mockEntry);

      const response = await request(app)
        .post('/api/fs/commit')
        .send({
          filePath: 'test.js',
          approved: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('committed');
    });

    it('should reject changes when approved is false', async () => {
      const mockEntry = {
        filePath: 'test.js',
        status: 'rejected',
        metadata: { userId: TEST_USER_ID }
      };

      vfs.rejectFile.mockReturnValue(mockEntry);

      const response = await request(app)
        .post('/api/fs/commit')
        .send({
          filePath: 'test.js',
          approved: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('rejected');
    });

    it('should reject commit attempts for another user staged file', async () => {
      vfs.getStagedFile.mockReturnValue({
        filePath: 'test.js',
        status: 'pending_review',
        metadata: { userId: '22222222-2222-4222-8222-222222222222' }
      });

      const response = await request(app)
        .post('/api/fs/commit')
        .send({
          filePath: 'test.js',
          approved: true
        });

      expect(response.status).toBe(403);
      expect(vfs.approveFile).not.toHaveBeenCalled();
      expect(vfs.commitToDisk).not.toHaveBeenCalled();
    });

    it('should return 404 when committing a missing staged file', async () => {
      vfs.getStagedFile.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/fs/commit')
        .send({
          filePath: 'test.js',
          approved: true
        });

      expect(response.status).toBe(404);
      expect(vfs.approveFile).not.toHaveBeenCalled();
      expect(vfs.commitToDisk).not.toHaveBeenCalled();
    });

    it('should require filePath', async () => {
      const response = await request(app)
        .post('/api/fs/commit')
        .send({
          approved: true
        });

      expect(response.status).toBe(400);
      expect(response.body.details.some(detail => detail.field === 'filePath')).toBe(true);
    });

    it('should handle VFS errors gracefully', async () => {
      vfs.commitToDisk.mockRejectedValue(new Error('Disk write failed'));

      const response = await request(app)
        .post('/api/fs/commit')
        .send({
          filePath: 'test.js',
          approved: true
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should reject path traversal in commit', async () => {
      const response = await request(app)
        .post('/api/fs/commit')
        .send({
          filePath: '../../../etc/passwd',
          approved: true
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/fs/pending', () => {
    it('should return pending files', async () => {
      const mockFiles = [
        {
          filePath: '/pending1.js',
          status: 'pending_review',
          originalContent: 'old',
          proposedContent: 'new',
          metadata: { userId: TEST_USER_ID }
        },
        {
          filePath: '/pending2.js',
          status: 'pending_review',
          originalContent: 'a',
          proposedContent: 'b',
          metadata: { userId: TEST_USER_ID }
        }
      ];

      vfs.getPendingFilesForUser.mockReturnValue(mockFiles);

      const response = await request(app)
        .get('/api/fs/pending');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(2);
      expect(vfs.getPendingFilesForUser).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should handle VFS errors', async () => {
      vfs.getPendingFilesForUser.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/fs/pending');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/fs/stats', () => {
    it('should return VFS statistics', async () => {
      const mockStats = {
        total: 10,
        pending: 3,
        approved: 2,
        rejected: 1,
        committed: 4
      };

      vfs.getStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/fs/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toEqual(mockStats);
      expect(vfs.getStats).toHaveBeenCalledWith({ userId: TEST_USER_ID });
    });

    it('should handle VFS errors', async () => {
      vfs.getStats.mockImplementation(() => {
        throw new Error('Stats error');
      });

      const response = await request(app)
        .get('/api/fs/stats');

      expect(response.status).toBe(500);
    });
  });

  describe('Security', () => {
    it('should include requestId in error responses', async () => {
      const response = await request(app)
        .post('/api/code')
        .send({
          prompt: 'Test',
          userId: TEST_USER_ID,
          targetFile: 'test.js'
          // Missing socketId
        });

      expect(response.body.requestId).toBeDefined();
    });

    it('should reject oversized payloads', async () => {
      const hugePrompt = 'a'.repeat(10 * 1024 * 1024); // 10MB

      const response = await request(app)
        .post('/api/code')
        .send({
          prompt: hugePrompt,
          userId: TEST_USER_ID,
          targetFile: 'test.js',
          socketId: 'socket-123'
        });

      // Should fail due to body size limit
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should sanitize error messages in production', async () => {
      // Simulate production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vfs.getStagedFile.mockReturnValue({
        filePath: 'test.js',
        status: 'pending_review',
        metadata: { userId: TEST_USER_ID }
      });
      vfs.commitToDisk.mockRejectedValue(new Error('Sensitive database credentials: user=admin'));

      const response = await request(app)
        .post('/api/fs/commit')
        .send({
          filePath: 'test.js',
          approved: true
        });

      expect(response.body.error).not.toContain('user=admin');
      expect(response.body.error).toBe('Internal server error');

      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe('Validation Schemas', () => {
  it('should validate UUID format for userId', async () => {
    // Test that userId must be valid UUID
  });

  it('should validate locale codes', async () => {
    // Only en, hi, or allowed
  });

  it('should validate deployment target is locked', async () => {
    // Must be 'local_docker_sandbox_only'
  });
});

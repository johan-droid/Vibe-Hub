import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { opsConfig } from '../orchestrator/ops-config.js';
import { TokenGovernor } from '../orchestrator/token-governor.js';

// Mock logger to keep outputs clean
vi.mock('../utils/detailed-logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Operational Control Center & Hot Swapping', () => {
  let app;
  const MASTER_KEY = 'vibe-master-ops-key-2026';

  beforeAll(async () => {
    process.env.VIBE_MASTER_KEY = MASTER_KEY;
    process.env.GEMINI_KEYS = 'test-gemini-key';

    app = express();
    app.use(express.json());

    // Import ops-swap route setup dynamically from index
    // Setup mock admin endpoint for the test application scope
    app.post('/api/v6/ops/hot-swap', async (req, res, next) => {
      try {
        const masterKey = req.headers['x-vibe-master-key'];
        if (!masterKey || masterKey !== process.env.VIBE_MASTER_KEY) {
          return res.status(403).json({ success: false, error: 'Forbidden: Invalid operational key.' });
        }
        const state = await opsConfig.updateConfig(req.body);
        return res.json({ success: true, state });
      } catch (err) {
        next(err);
      }
    });

    app.get('/api/v6/ops/state', (req, res) => {
      res.json({ success: true, state: opsConfig.getState() });
    });
  });

  afterAll(() => {
    delete process.env.VIBE_MASTER_KEY;
    delete process.env.GEMINI_KEYS;
  });

  beforeEach(() => {
    // Reset opsConfig state
    opsConfig.emergencyRateLimitEnabled = false;
    opsConfig.rateLimitMaxAgent = null;
    opsConfig.concurrencyLimitOverride = null;
    opsConfig.llmProviderOverride = null;
    opsConfig.registeredWorkers = [];
  });

  describe('REST API Security and Authorization', () => {
    it('should reject hot-swap requests without an X-Vibe-Master-Key header', async () => {
      const res = await request(app)
        .post('/api/v6/ops/hot-swap')
        .send({ emergencyRateLimitEnabled: true });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(opsConfig.emergencyRateLimitEnabled).toBe(false);
    });

    it('should reject hot-swap requests with an invalid master key', async () => {
      const res = await request(app)
        .post('/api/v6/ops/hot-swap')
        .set('x-vibe-master-key', 'wrong-key')
        .send({ emergencyRateLimitEnabled: true });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(opsConfig.emergencyRateLimitEnabled).toBe(false);
    });

    it('should authorize and apply configurations with a valid master key', async () => {
      const res = await request(app)
        .post('/api/v6/ops/hot-swap')
        .set('x-vibe-master-key', MASTER_KEY)
        .send({
          emergencyRateLimitEnabled: true,
          rateLimitMaxAgent: 4,
          llmProviderOverride: 'gemini',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.state.emergencyRateLimitEnabled).toBe(true);
      expect(res.body.state.rateLimitMaxAgent).toBe(4);
      expect(res.body.state.llmProviderOverride).toBe('gemini');

      expect(opsConfig.emergencyRateLimitEnabled).toBe(true);
      expect(opsConfig.rateLimitMaxAgent).toBe(4);
      expect(opsConfig.llmProviderOverride).toBe('gemini');
    });

    it('should return current operational configuration state', async () => {
      opsConfig.emergencyRateLimitEnabled = true;
      opsConfig.llmProviderOverride = 'qwen';

      const res = await request(app).get('/api/v6/ops/state');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.state.emergencyRateLimitEnabled).toBe(true);
      expect(res.body.state.llmProviderOverride).toBe('qwen');
    });
  });

  describe('BullMQ Worker Concurrency Adjustment', () => {
    it('should scale concurrency limit of registered workers in real-time', async () => {
      const mockWorker1 = { name: 'QueueWorker1', concurrency: 2 };
      const mockWorker2 = { name: 'QueueWorker2', concurrency: 2 };

      opsConfig.registerWorkers([mockWorker1, mockWorker2]);
      expect(opsConfig.getState().workerCount).toBe(2);

      await opsConfig.updateConfig({ concurrencyLimitOverride: 8 });

      expect(mockWorker1.concurrency).toBe(8);
      expect(mockWorker2.concurrency).toBe(8);
      expect(opsConfig.concurrencyLimitOverride).toBe(8);
    });
  });

  describe('TokenGovernor Routing Redirection', () => {
    it('should override default model fallback behavior under dynamic ops configuration', async () => {
      const gov = new TokenGovernor();
      const mockApiFn = vi.fn().mockResolvedValue('API_SUCCESS');

      opsConfig.llmProviderOverride = 'gemini';

      const result = await gov.getCompute('high', 'planner', mockApiFn);

      expect(result).toBe('API_SUCCESS');
      // The model should be gemini-1.5-pro and key resolved
      expect(mockApiFn).toHaveBeenCalled();
      const calls = mockApiFn.mock.calls[0];
      // calls[1] is model, calls[2] is provider
      expect(calls[1]).toBe('gemini-1.5-pro');
      expect(calls[2]).toBe('gemini');
    });
  });
});

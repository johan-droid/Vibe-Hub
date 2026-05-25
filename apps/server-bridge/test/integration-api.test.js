import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../orchestrator/router.js', () => ({
  handleCodeRequest: (req, res) => res.json({
    success: true,
    authMode: req.authMode,
    userId: req.user?.id || null,
    headless: req.allowHeadlessExecution === true,
    body: req.validatedBody,
  }),
  handleCodeJobStatus: (_req, res) => res.json({ success: true, job: { id: 'job-123', state: 'queued' } }),
  handleCommitRequest: (_req, res) => res.json({ success: true, message: 'committed' }),
  handleHarnessContent: (_req, res) => res.json({ success: true, harnessed: { itemsStored: 1 } }),
  handleGetPendingFiles: (_req, res) => res.json({ success: true, files: [] }),
  handleGetVfsStats: (_req, res) => res.json({ success: true, stats: { total: 0 } }),
  handleLinkRepo: (_req, res) => res.json({ success: true, project: { id: 'repo-1' } }),
  handleListRepos: (_req, res) => res.json({ success: true, repos: [] }),
  handleListTools: (_req, res) => res.json({ success: true, tools: [] }),
  handleListServers: (_req, res) => res.json({ success: true, servers: [] }),
  handleMcpDiagnostics: (_req, res) => res.json({ success: true, diagnostics: {} }),
  handleCallTool: (_req, res) => res.json({ success: true, result: {} }),
}));

vi.mock('../orchestrator/chat_routes.js', async () => {
  const expressModule = await import('express');
  const router = expressModule.Router();
  router.get('/sessions', (_req, res) => res.json({ success: true, sessions: [] }));
  router.post('/sessions', (_req, res) => res.json({ success: true, session: { id: 'chat-1' } }));
  return { chatRouter: router };
});

vi.mock('../orchestrator/preferences_routes.js', async () => {
  const expressModule = await import('express');
  const router = expressModule.Router();
  router.get('/', (_req, res) => res.json({ success: true, preferences: {} }));
  router.post('/', (_req, res) => res.json({ success: true, preference: {} }));
  router.post('/bulk', (_req, res) => res.json({ success: true, count: 0 }));
  return { preferencesRouter: router };
});

vi.mock('../orchestrator/models.js', () => ({
  modelService: {
    diagnostics: () => ({ ok: true }),
  },
}));

vi.mock('../orchestrator/expert-routing.js', () => ({
  buildExpertDiagnostics: () => ({ experts: [] }),
}));

vi.mock('../orchestrator/skill-graph.js', () => ({
  listSkillGraph: () => ({ nodes: [], edges: [] }),
}));

vi.mock('../utils/audit.js', () => ({
  listAuditLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock('../config/brand.js', () => ({
  SELINA_BRAND: {
    productName: 'Vibe Hub',
    serviceName: 'Server Bridge',
    agentName: 'Selina',
  },
}));

vi.mock('../orchestrator/run_store.js', () => ({
  fetchRunForUser: vi.fn().mockResolvedValue(null),
  fetchRunEventsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock('../auth/action-grants.js', () => ({
  createActionGrant: vi.fn(),
  hashToolParams: vi.fn(() => 'hash'),
}));

vi.mock('../db.js', () => ({
  insertAgentActionGrant: vi.fn(),
}));

describe('Integration API facade', () => {
  let app;

  beforeEach(async () => {
    process.env.SELINA_SERVICE_API_KEY = 'integration-secret';
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.id = 'integration-test-request';
      next();
    });

    const { integrationRouter } = await import('../integration/router.js');
    app.use('/api/v6/integration', integrationRouter);
  });

  it('returns the integration manifest without authentication', async () => {
    const response = await request(app).get('/api/v6/integration');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.basePath).toBe('/api/v6/integration');
    expect(response.body.auth.serviceTokenHeader).toBe('X-API-Key');
  });

  it('allows headless code runs with service auth and acting user id', async () => {
    const response = await request(app)
      .post('/api/v6/integration/code/run')
      .set('X-API-Key', 'integration-secret')
      .set('X-Acting-User-Id', '11111111-1111-4111-8111-111111111111')
      .send({
        prompt: 'Add a helper',
        targetFile: 'apps/server-bridge/index.js',
        effortLevel: 'standard',
        auditMode: 'full',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      authMode: 'service',
      userId: '11111111-1111-4111-8111-111111111111',
      headless: true,
    });
    expect(response.body.body.auditMode).toBe('full');
  });

  it('rejects service-authenticated user-scoped calls without an acting user id', async () => {
    const response = await request(app)
      .post('/api/v6/integration/code/run')
      .set('X-API-Key', 'integration-secret')
      .send({
        prompt: 'Add a helper',
        targetFile: 'apps/server-bridge/index.js',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('ACTING_USER_REQUIRED');
  });
});

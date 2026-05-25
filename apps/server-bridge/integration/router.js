import express from 'express';
import { z } from 'zod';
import { requireIntegrationAuth, requireScopedIntegrationUser, integrationAuthSummary } from '../auth/service-auth.js';
import { createActionGrant, hashToolParams } from '../auth/action-grants.js';
import { insertAgentActionGrant } from '../db.js';
import { INTEGRATION_BASE_PATH, INTEGRATION_OPERATIONS } from './manifest.js';
import {
  handleCallTool,
  handleCodeJobStatus,
  handleCodeRequest,
  handleCommitRequest,
  handleHarnessContent,
  handleGetPendingFiles,
  handleGetVfsStats,
  handleLinkRepo,
  handleListRepos,
  handleListServers,
  handleListTools,
  handleMcpDiagnostics,
} from '../orchestrator/router.js';
import { buildExpertDiagnostics } from '../orchestrator/expert-routing.js';
import { fetchRunEventsForUser, fetchRunForUser } from '../orchestrator/run_store.js';
import { modelService } from '../orchestrator/models.js';
import { listSkillGraph } from '../orchestrator/skill-graph.js';
import { listAuditLogs } from '../utils/audit.js';
import { SELINA_BRAND } from '../config/brand.js';
import { auditModeSchema, contentHarnessSchema, safePathSchema, validateRequest } from '../utils/validation.js';
import { chatRouter } from '../orchestrator/chat_routes.js';
import { preferencesRouter } from '../orchestrator/preferences_routes.js';

const integrationRouter = express.Router();

const integrationCodeRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  targetFile: safePathSchema,
  effortLevel: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
  queueLane: z.enum(['interactive', 'background']).optional().default('interactive'),
  auditMode: auditModeSchema,
  socketId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

const repoLinkSchema = z.object({
  url: z.string().url(),
  userId: z.string().min(1).optional(),
});

const mcpCallSchema = z.object({
  toolId: z.string().min(1),
  arguments: z.record(z.any()).optional(),
  actionGrant: z.string().optional(),
  runId: z.string().optional(),
  userId: z.string().min(1).optional(),
});

const approvalGrantSchema = z.object({
  runId: z.string().min(1),
  toolName: z.string().min(1),
  decision: z.enum(['approve', 'deny']),
  reason: z.string().max(2000).optional(),
  params: z.record(z.any()).optional(),
  paramsHash: z.string().optional(),
  userId: z.string().min(1).optional(),
});

function markHeadlessCodeExecution(req, _res, next) {
  req.allowHeadlessExecution = true;
  next();
}

integrationRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    name: 'Vibe Hub Integration API',
    version: '6.0.0',
    basePath: INTEGRATION_BASE_PATH,
    docs: {
      openapi: '/swagger.json',
      swaggerUi: '/api-docs',
    },
    auth: integrationAuthSummary(),
    operationsUrl: `${INTEGRATION_BASE_PATH}/operations`,
  });
});

integrationRouter.get('/operations', (_req, res) => {
  res.json({
    success: true,
    basePath: INTEGRATION_BASE_PATH,
    operations: INTEGRATION_OPERATIONS,
  });
});

integrationRouter.get('/runtime/brand', (_req, res) => {
  res.json({
    success: true,
    brand: SELINA_BRAND,
  });
});

integrationRouter.get('/runtime/diagnostics', requireIntegrationAuth, (req, res) => {
  res.json(modelService.diagnostics());
});

integrationRouter.get('/runtime/experts', requireIntegrationAuth, (_req, res) => {
  res.json({
    success: true,
    diagnostics: buildExpertDiagnostics(modelService),
  });
});

integrationRouter.get('/runtime/skills', requireIntegrationAuth, (_req, res) => {
  res.json({
    mode: 'mixture-of-experts',
    graph: listSkillGraph(),
  });
});

integrationRouter.get('/audit-logs', requireIntegrationAuth, requireScopedIntegrationUser, async (req, res, next) => {
  try {
    const logs = await listAuditLogs({
      userId: req.user.id,
      resourceId: req.query.resourceId,
      limit: req.query.limit,
    });
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
});

integrationRouter.post(
  '/code/run',
  requireIntegrationAuth,
  requireScopedIntegrationUser,
  markHeadlessCodeExecution,
  validateRequest(integrationCodeRequestSchema),
  handleCodeRequest,
);
integrationRouter.get('/code/jobs/:jobId', requireIntegrationAuth, requireScopedIntegrationUser, handleCodeJobStatus);

integrationRouter.get('/vfs/pending', requireIntegrationAuth, requireScopedIntegrationUser, handleGetPendingFiles);
integrationRouter.get('/vfs/stats', requireIntegrationAuth, requireScopedIntegrationUser, handleGetVfsStats);
integrationRouter.post(
  '/vfs/commit',
  requireIntegrationAuth,
  requireScopedIntegrationUser,
  handleCommitRequest,
);

integrationRouter.post(
  '/content/harness',
  requireIntegrationAuth,
  requireScopedIntegrationUser,
  validateRequest(contentHarnessSchema),
  handleHarnessContent,
);

integrationRouter.post(
  '/repos/link',
  requireIntegrationAuth,
  requireScopedIntegrationUser,
  validateRequest(repoLinkSchema),
  handleLinkRepo,
);
integrationRouter.get('/repos', requireIntegrationAuth, requireScopedIntegrationUser, handleListRepos);

integrationRouter.get('/mcp/tools', requireIntegrationAuth, requireScopedIntegrationUser, handleListTools);
integrationRouter.get('/mcp/servers', requireIntegrationAuth, requireScopedIntegrationUser, handleListServers);
integrationRouter.get('/mcp/diagnostics', requireIntegrationAuth, requireScopedIntegrationUser, handleMcpDiagnostics);
integrationRouter.post(
  '/mcp/call',
  requireIntegrationAuth,
  requireScopedIntegrationUser,
  validateRequest(mcpCallSchema),
  handleCallTool,
);

integrationRouter.use('/chat', requireIntegrationAuth, requireScopedIntegrationUser, chatRouter);
integrationRouter.use('/preferences', requireIntegrationAuth, requireScopedIntegrationUser, preferencesRouter);

integrationRouter.get('/runs/:runId', requireIntegrationAuth, requireScopedIntegrationUser, async (req, res, next) => {
  try {
    const run = await fetchRunForUser(req.params.runId, req.user.id, req.tenantId || req.user.tenantId);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    return res.json({ success: true, run });
  } catch (error) {
    return next(error);
  }
});

integrationRouter.get('/runs/:runId/events', requireIntegrationAuth, requireScopedIntegrationUser, async (req, res, next) => {
  try {
    const events = await fetchRunEventsForUser(req.params.runId, req.user.id, req.tenantId || req.user.tenantId);
    return res.json({ success: true, events });
  } catch (error) {
    return next(error);
  }
});

integrationRouter.get('/runs/:runId/artifacts', requireIntegrationAuth, requireScopedIntegrationUser, async (req, res, next) => {
  try {
    const run = await fetchRunForUser(req.params.runId, req.user.id, req.tenantId || req.user.tenantId);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    return res.json({
      success: true,
      artifacts: run.metadata?.artifacts || [],
      rolloutPaths: run.metadata?.rolloutPaths || null,
    });
  } catch (error) {
    return next(error);
  }
});

integrationRouter.post(
  '/approvals/grants',
  requireIntegrationAuth,
  requireScopedIntegrationUser,
  validateRequest(approvalGrantSchema),
  async (req, res, next) => {
    try {
      const { runId, toolName, decision, reason = '', params, paramsHash: providedParamsHash } = req.validatedBody;
      const run = await fetchRunForUser(runId, req.user.id, req.tenantId || req.user.tenantId);
      if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

      const paramsHash = providedParamsHash || hashToolParams(params || {});
      const grant = createActionGrant({
        userId: req.user.id,
        tenantId: req.tenantId || req.user.tenantId,
        runId,
        toolName,
        paramsHash,
        decision,
        reason,
        approvalSource: 'integration-api',
      });
      await insertAgentActionGrant(grant);
      return res.json({
        success: true,
        grant: {
          grantId: grant.grantId,
          token: decision === 'approve' ? grant.token : null,
          expiresAt: grant.expiresAt,
          paramsHash,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

export { integrationRouter };

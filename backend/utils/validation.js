/**
 * Input Validation Schemas (Zod)
 * 
 * Validates all API inputs to prevent injection attacks and ensure data integrity.
 */

import { z } from 'zod';

function formatZodIssues(error) {
  const issues = error?.issues || error?.errors || [];
  return issues.map(e => ({
    field: Array.isArray(e.path) ? e.path.join('.') : '',
    message: e.message
  }));
}

// Helper for path validation (prevents directory traversal)
export const safePathSchema = z.string()
  .min(1, 'Path is required')
  .max(500, 'Path too long')
  .refine(
    (path) => !path.includes('..'), 
    'Path cannot contain parent directory references'
  )
  .refine(
    (path) => !path.startsWith('/'), 
    'Path must be relative'
  )
  .refine(
    (path) => /^[a-zA-Z0-9_\-\/.]+$/.test(path),
    'Path contains invalid characters'
  );

// Code generation request
export const auditModeSchema = z.enum(['off', 'standard', 'full']).optional().default('standard');

export const codeRequestSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(1000, 'Prompt too long (max 1000 chars)'),
  userId: z.string()
    .min(1, 'User ID is required')
    .uuid('Invalid user ID format'),
  targetFile: safePathSchema,
  effortLevel: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
  queueLane: z.enum(['interactive', 'background']).optional().default('interactive'),
  auditMode: auditModeSchema,
  socketId: z.string()
    .min(1, 'Socket ID is required for real-time updates')
});

// VFS commit request
export const vfsCommitSchema = z.object({
  filePath: safePathSchema,
  approved: z.boolean()
});

// VFS file path query
export const vfsFilePathSchema = z.object({
  filePath: safePathSchema
});

// User preferences update
export const userPreferencesSchema = z.object({
  aesthetics: z.string().max(500).optional(),
  supported_locales: z.array(
    z.enum(['en', 'hi', 'or'])
  ).max(3).optional(),
  offline_mode: z.boolean().optional()
});

// Org constraints update (admin only)
export const orgConstraintsSchema = z.object({
  deployment_target: z.literal('local_docker_sandbox_only'),
  ci_cd: z.string().max(10000).optional(),
  linting: z.record(z.any()).optional()
});

// GitHub webhook payload (simplified)
export const githubWebhookSchema = z.object({
  action: z.string().optional(),
  workflow_run: z.object({
    name: z.string(),
    conclusion: z.enum(['success', 'failure', 'cancelled', 'neutral']).optional()
  }).optional()
}).passthrough(); // Allow additional fields

// LLM configuration (for admin updates)
export const llmConfigSchema = z.object({
  apiKey: z.string().min(10).max(100).optional(),
  endpoint: z.string().url().max(500).optional(),
  model: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional()
});

const safeLabelSchema = z.string()
  .min(1)
  .max(500)
  .refine(value => !/[\u0000-\u001F\u007F]/.test(value), 'Value contains invalid control characters');

export const contentHarnessSchema = z.object({
  sourceName: z.string()
    .min(1, 'sourceName is required')
    .max(255, 'sourceName too long'),
  sourcePath: safeLabelSchema.optional(),
  projectName: z.string()
    .min(1, 'projectName is required')
    .max(120, 'projectName too long')
    .refine(value => !value.includes('..'), 'projectName cannot contain parent directory references')
    .optional(),
  content: z.string()
    .min(1, 'content is required')
    .max(200000, 'content too long (max 200000 chars)'),
  mimeType: z.string()
    .max(120, 'mimeType too long')
    .optional(),
  kind: z.enum(['upload', 'note', 'document', 'dataset', 'repo_doc']).optional().default('upload'),
  tags: z.array(
    z.string().min(1).max(40).regex(/^[a-zA-Z0-9_.-]+$/, 'tag contains invalid characters')
  ).max(10).optional().default([]),
});

// Middleware factory for request validation
export function validateRequest(schema) {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.validatedBody = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formatZodIssues(error),
          requestId: req.id
        });
      }
      next(error);
    }
  };
}

// Middleware for query param validation
export function validateQuery(schema) {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.validatedQuery = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Query validation failed',
          details: formatZodIssues(error),
          requestId: req.id
        });
      }
      next(error);
    }
  };
}

export default {
  codeRequestSchema,
  auditModeSchema,
  safePathSchema,
  vfsCommitSchema,
  vfsFilePathSchema,
  userPreferencesSchema,
  orgConstraintsSchema,
  githubWebhookSchema,
  llmConfigSchema,
  contentHarnessSchema,
  validateRequest,
  validateQuery
};

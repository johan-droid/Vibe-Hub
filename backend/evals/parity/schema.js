import { z } from 'zod';

export const PARITY_DIMENSION_IDS = Object.freeze([
  'outcome_correctness',
  'tool_choice_and_sequencing',
  'context_and_harnessing_accuracy',
  'safety_and_policy_compliance',
  'verification_discipline',
]);

const thresholdSchema = z.object({
  overallScoreToMeetParity: z.number().min(0).max(100),
  overallScoreForNearParity: z.number().min(0).max(100),
  criticalCategoryFloor: z.number().min(0).max(100),
  nearCategoryFloor: z.number().min(0).max(100),
  liveBaselineDeltaPct: z.number().min(0).max(100),
});

const categorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0).max(100),
});

const rubricDimensionSchema = z.object({
  id: z.enum(PARITY_DIMENSION_IDS),
  label: z.string().min(1),
  min: z.number().min(0).max(5),
  max: z.number().min(0).max(5),
  guidance: z.string().min(1),
});

const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  workflow: z.string().min(1),
  description: z.string().min(1),
  localEvaluator: z.string().min(1),
  categoryTargets: z.array(z.string().min(1)).min(1),
  liveBaselineEligible: z.boolean().default(false),
  setup: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  expectedOutcomes: z.array(z.string()).min(1),
  livePrompt: z.string().min(1),
});

export const parityManifestSchema = z.object({
  schemaVersion: z.literal(1),
  suiteId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  thresholds: thresholdSchema,
  categoryWeights: z.array(categorySchema).min(1),
  rubric: z.object({
    dimensions: z.array(rubricDimensionSchema).length(PARITY_DIMENSION_IDS.length),
    passScale: z.record(z.string(), z.string()).default({}),
  }),
  criticalFailureRules: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
  })).min(1),
  tasks: z.array(taskSchema).min(12),
}).superRefine((value, ctx) => {
  const totalWeight = value.categoryWeights.reduce((sum, category) => sum + category.weight, 0);
  if (totalWeight !== 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['categoryWeights'],
      message: `Category weights must sum to 100, received ${totalWeight}.`,
    });
  }

  const categoryIds = new Set(value.categoryWeights.map(category => category.id));
  for (const task of value.tasks) {
    for (const target of task.categoryTargets) {
      if (!categoryIds.has(target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tasks', task.id, 'categoryTargets'],
          message: `Unknown category target "${target}".`,
        });
      }
    }
  }
});

const evidenceSchema = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(['passed', 'failed', 'warning', 'info', 'disabled']),
  summary: z.string().min(1),
  details: z.any().optional(),
});

const dimensionScoresSchema = z.object({
  outcome_correctness: z.number().min(0).max(5),
  tool_choice_and_sequencing: z.number().min(0).max(5),
  context_and_harnessing_accuracy: z.number().min(0).max(5),
  safety_and_policy_compliance: z.number().min(0).max(5),
  verification_discipline: z.number().min(0).max(5),
});

const criticalFindingSchema = z.object({
  ruleId: z.string().min(1),
  taskId: z.string().min(1),
  message: z.string().min(1),
});

const baselineTaskResultSchema = z.object({
  adapterId: z.string().min(1),
  status: z.enum(['completed', 'disabled', 'failed']),
  scorePct: z.number().min(0).max(100).nullable(),
  summary: z.string().min(1),
  output: z.any().optional(),
  error: z.string().nullable().optional(),
});

const transcriptEntrySchema = z.object({
  at: z.string().min(1),
  source: z.string().min(1),
  message: z.string().min(1),
  details: z.any().optional(),
});

const taskResultSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1),
  workflow: z.string().min(1),
  categoryTargets: z.array(z.string()).min(1),
  status: z.enum(['passed', 'failed']),
  durationMs: z.number().min(0),
  startedAt: z.string().min(1),
  completedAt: z.string().min(1),
  dimensions: dimensionScoresSchema,
  scorePct: z.number().min(0).max(100),
  evidence: z.array(evidenceSchema),
  summary: z.string().min(1),
  criticalFailures: z.array(criticalFindingSchema).default([]),
  baselines: z.record(z.string(), baselineTaskResultSchema).default({}),
  transcript: z.array(transcriptEntrySchema).default([]),
});

const categoryScoreSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0).max(100),
  rawScore: z.number().min(0).max(100),
  weightedScore: z.number().min(0).max(100),
  status: z.enum(['meets', 'near', 'below']),
  taskIds: z.array(z.string()).default([]),
});

const liveBaselineSchema = z.object({
  adapterId: z.string().min(1),
  status: z.enum(['completed', 'disabled', 'failed', 'not_applicable']),
  deltaPct: z.number().min(0).max(100).nullable(),
  thresholdPct: z.number().min(0).max(100),
  sharedTaskCount: z.number().min(0),
  summary: z.string().min(1),
});

export const parityReportSchema = z.object({
  schemaVersion: z.literal(1),
  suiteId: z.string().min(1),
  runId: z.string().min(1),
  runMode: z.enum(['full', 'degraded-provider', 'degraded-mcp']).default('full'),
  title: z.string().min(1),
  generatedAt: z.string().min(1),
  startedAt: z.string().min(1),
  completedAt: z.string().min(1),
  thresholds: thresholdSchema,
  overallScore: z.number().min(0).max(100),
  status: z.enum(['meets parity', 'near parity', 'below parity']),
  criticalFailures: z.array(criticalFindingSchema),
  categoryScores: z.array(categoryScoreSchema),
  taskResults: z.array(taskResultSchema),
  liveBaselines: z.array(liveBaselineSchema),
  summary: z.string().min(1),
  artifactPaths: z.object({
    directory: z.string().min(1),
    report: z.string().min(1),
    summary: z.string().min(1),
    taskResults: z.string().min(1),
  }),
});

export function validateParityManifest(value) {
  return parityManifestSchema.parse(value);
}

export function validateParityReport(value) {
  return parityReportSchema.parse(value);
}

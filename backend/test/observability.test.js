import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestContext } from '../utils/logger.js';
import { metricsMiddleware, recordLlmTokenUsage, recordOrchestrationStepDuration, renderMetrics } from '../utils/metrics.js';
import { getTraceLogFields, runWithTraceContext, setTraceAgentRun, setTraceUser } from '../utils/tracing.js';

describe('observability instrumentation', () => {
  it('emits request trace headers and RED metrics', async () => {
    const app = express();
    app.use(requestContext);
    app.use(metricsMiddleware);
    app.get('/probe', (_req, res) => res.json({ ok: true }));

    const response = await request(app)
      .get('/probe')
      .set('traceparent', '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.headers['x-trace-id']).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(response.headers.traceparent).toMatch(/^00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-[a-f0-9]{16}-01$/u);

    const metrics = await renderMetrics();
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('http_request_duration_seconds');
  });

  it('keeps user and agent run IDs in log trace context', () => {
    runWithTraceContext({
      traceId: 'cccccccccccccccccccccccccccccccc',
      spanId: 'dddddddddddddddd',
      requestId: 'req-test',
    }, () => {
      setTraceUser('user-1');
      setTraceAgentRun('run-1');
      const fields = getTraceLogFields({ step: 'test.step' });

      expect(fields).toMatchObject({
        traceId: 'cccccccccccccccccccccccccccccccc',
        requestId: 'req-test',
        userId: 'user-1',
        agentRunId: 'run-1',
        step: 'test.step',
      });
    });
  });

  it('records custom LLM and orchestration SLO metrics', async () => {
    recordLlmTokenUsage({
      provider: 'test-provider',
      model: 'test-model',
      inputTokens: 12,
      outputTokens: 8,
      durationSeconds: 2,
    });
    recordOrchestrationStepDuration(2.5, { step: 'sandboxing' });

    const metrics = await renderMetrics();
    expect(metrics).toContain('llm_tokens_total');
    expect(metrics).toContain('llm_token_throughput_tokens_per_second');
    expect(metrics).toContain('orchestration_step_slo_events_total');
  });
});

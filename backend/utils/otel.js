import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { resourceFromAttributes } from '@opentelemetry/resources';

let sdk = null;

const enabled = process.env.OTEL_SDK_DISABLED !== 'true'
  && Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_TRACES_EXPORTER);

if (enabled) {
  const endpoint = normalizeOtlpTraceEndpoint(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME || 'server-bridge',
      'service.version': process.env.npm_package_version || '3.0.0',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    traceExporter: endpoint ? new OTLPTraceExporter({ url: endpoint }) : undefined,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
    ],
  });

  try {
    sdk.start();
    process.once('SIGTERM', () => {
      shutdownOpenTelemetry().catch(() => {});
    });
    process.once('SIGINT', () => {
      shutdownOpenTelemetry().catch(() => {});
    });
  } catch (error) {
    console.warn('[OpenTelemetry] Failed to start SDK:', error.message);
  }
}

export async function shutdownOpenTelemetry() {
  if (!sdk) return;
  await sdk.shutdown();
}

function normalizeOtlpTraceEndpoint(endpoint) {
  if (!endpoint) return null;
  const trimmed = String(endpoint).replace(/\/$/, '');
  return trimmed.endsWith('/v1/traces') ? trimmed : `${trimmed}/v1/traces`;
}

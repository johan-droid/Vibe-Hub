# Observability

Server Bridge emits three operational surfaces:

- JSON logs for Loki or ELK, including `traceId`, `spanId`, `requestId`, `userId`, `agentRunId`, and `step`.
- Prometheus metrics at `/metrics`, including endpoint RED metrics, queue depth, RAG recall latency, LLM token usage, and orchestration SLO events.
- Optional OpenTelemetry traces exported through OTLP HTTP.

## OpenTelemetry

Tracing is disabled by default for local development. Enable it by setting:

```env
OTEL_SDK_DISABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=server-bridge
```

The OTLP endpoint is normalized to `/v1/traces` automatically. Incoming `traceparent` headers are preserved, and every response includes `traceparent`, `x-trace-id`, and `x-request-id`.

## Prometheus

Scrape:

```yaml
scrape_configs:
  - job_name: server-bridge
    metrics_path: /metrics
    static_configs:
      - targets: ["server-bridge:3001"]
```

Load alert rules from:

```text
ops/prometheus/selina-alerts.yml
```

The default orchestration SLO is `99% of orchestration steps complete under 2 seconds`. Burn-rate alerts use the `orchestration_step_slo_events_total` counter instead of raw transient spikes.

## Grafana

Import the starter dashboard from:

```text
ops/grafana/server-bridge-observability.json
```

It includes panels for HTTP rate and duration, queue depth, RAG recall p95, LLM token throughput, and orchestration SLO burn.

# Vibe Hub Deployment Track

This ops track supports immutable, Kubernetes-based deployments while preserving the current local and Render workflows.

## Immutable Images

Build images from the repository root:

```bash
npm run docker:build
```

CI builds both images, scans them with Trivy, and pushes SHA-tagged images to GHCR on `main`.

## Kubernetes

Base manifests live in `ops/kubernetes/base`.

```bash
kubectl apply -k ops/kubernetes/base
```

Set real image tags before applying:

```bash
kustomize edit set image ghcr.io/OWNER/vibe-hub/server-bridge=ghcr.io/OWNER/vibe-hub/server-bridge:<sha>
kustomize edit set image ghcr.io/OWNER/vibe-hub/user-interface=ghcr.io/OWNER/vibe-hub/user-interface:<sha>
```

## Blue-Green And Canary

- `ops/kubernetes/blue-green` creates a preview deployment and service for blue-green validation.
- `ops/kubernetes/canary` contains an Istio `DestinationRule` and `VirtualService` that shift 5% of backend traffic to canary.

Promotion should be metric-driven:

- Watch HTTP RED metrics and SLO burn rate in Grafana.
- Promote only if error rate and latency remain within budget.
- Roll back by setting canary weight to `0` or switching the active service selector back to the stable track.

## IaC

`ops/terraform/aws` provisions ECR, EKS, PostgreSQL, Redis, and baseline networking.

Use immutable image tags from CI as deployment inputs. Do not deploy `latest`.

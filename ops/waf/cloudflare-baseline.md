# Cloudflare WAF Baseline

Use this as the minimum edge policy when Vibe Hub is exposed outside a private network.

## Managed Rules

- Enable Cloudflare Managed Ruleset.
- Enable OWASP Core Ruleset with paranoia level 1 to start, then tune false positives.
- Enable Bot Management or Super Bot Fight Mode for unauthenticated routes, especially `/api/auth/*`, `/api/code`, and WebSocket upgrade paths.
- Enable credential-stuffing protections and leaked-credential checks on login and registration endpoints.

## Custom Rules

- Block requests with path traversal markers: `../`, `%2e%2e`, `/etc/passwd`, `/proc/`.
- Challenge requests with SQLi/XSS indicators: `UNION SELECT`, `<script`, `javascript:`, `onerror=`.
- Block request bodies over the API gateway body limit before they reach `server-bridge`.
- Rate limit `/api/auth/*` by IP and `/api/code`, `/api/v6/code`, `/api/v6/integration/code` by user and IP.
- Block IPs from the active threat-intelligence feed before origin routing; keep the same CIDRs in `ops/terraform/aws` via `threat_intel_cidrs` when running on AWS.
- Require TLS and reject direct origin access except from trusted Cloudflare IP ranges.

## Edge Cache Policy

- Cache `/`, `/swagger.json`, `/api-docs`, `/api/runtime/brand`, `/api/v6/runtime/brand`, and authenticated but non-personalized capability metadata for 2-5 minutes.
- Do not cache WebSocket traffic, auth callbacks, CSRF tokens, `/api/me`, tool results, run events, audit logs, or any endpoint with user/session content.
- Honor `CDN-Cache-Control` and `s-maxage` emitted by `server-bridge`; bypass cache when `Authorization` or session cookies are present unless the route is explicitly safe-listed.

## Network Shielding

- Use Anycast CDN/WAF in front of all public origins; on AWS, associate `aws_wafv2_web_acl.api_edge` with the API ALB.
- Enable Shield Advanced for public ALBs/NLBs/EIPs/CloudFront distributions by passing their ARNs to `shield_protected_resource_arns`.
- Keep load-balancer SYN flood protections enabled; AWS Shield and Cloudflare absorb SYN floods before pods receive traffic.
- Keep orchestration event bus, Redis, Postgres, admin, and metrics endpoints private inside the VPC. Public access should return 404 unless `CONTROL_PLANE_INTERNAL_TOKEN` or an allowed private CIDR is present.

## Origin Assumptions

- `TRUST_PROXY_HOPS` must match the number of trusted proxies in front of the Node server.
- The app still enforces internal token-bucket limits, JWT validation, tenant checks, CSRF, and tool RBAC after WAF inspection.

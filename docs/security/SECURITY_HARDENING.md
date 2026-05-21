# Security Hardening Runbook

This deployment profile keeps Selina local-first while making production auth, tenant, secrets, and edge protections explicit.

## Identity Provider

- Configure `AUTH_JWKS_URI`, `AUTH_ISSUER`, and `AUTH_AUDIENCE` for Auth0, Cognito, or another OIDC issuer.
- Access tokens must include `exp` and `iat`; `AUTH_JWT_MAX_TTL_SECONDS` defaults to `900`.
- Role, permission, and tenant claims are mapped by `AUTH_ROLES_CLAIM`, `AUTH_PERMISSIONS_CLAIM`, and `AUTH_TENANT_CLAIM`.
- Every protected API request resolves a tenant context from the token or `X-Tenant-Id`; mismatched tenants require `tenant:*` or admin/owner role.

## Agent Action Permissions

Tool execution is approval-gated and capability-gated:

- `tool:read` reads local context and diagnostics.
- `tool:write` stages file and state changes.
- `tool:execute` runs sandboxed commands.
- `tool:github` uses GitHub tools.
- `tool:browser` drives browser automation.
- `tool:mcp` calls generic MCP tools.
- `tool:sql` is required for SQL/database-flavored MCP tools.

Production IdP tokens should issue the narrowest permissions needed for the user's role. Local session auth can be constrained with `AUTH_DEFAULT_USER_PERMISSIONS`.

## Input And Tool Injection Guard

- Request bodies and query params are sanitized after JSON parsing.
- Agent prompts preserve code-like text but remove null/control characters and emit prompt-injection warnings.
- `run_command` and MCP server processes use executable + argument arrays, reject shell metacharacters, and refuse `shell -c`.
- Repository cloning uses `execFile` argument arrays and constrains clone paths to the repository storage root.

## Secrets

- Prefer `SELINA_SECRET_PROVIDER=vault,env` in production.
- Store provider API keys under `VAULT_SECRET_PREFIX` using the same names as environment variables, for example `OPENAI_API_KEY`.
- Store prompt-hardening directives and orchestration prompts in the same secret provider. Set `SELINA_REQUIRE_PROMPT_SECRETS=true` in production and inject `SELINA_PROMPT_HARDENING_DIRECTIVE` at runtime.
- Vault KV v2 is expected at `VAULT_KV_MOUNT`; dynamic database credentials should be injected through the same provider chain or platform-native secret mounts.
- Do not store LLM, JWT, action-grant, prompt, GitHub, database, or service keys in Git. Model audit and billing events redact prompt-like fields before logging.

## Retrieval, Memory, And DLP

- Vector store drivers fail closed unless every search has a `tenant_id` filter.
- PostgreSQL semantic memory tables enable RLS and require `SET LOCAL app.current_tenant_id` through the database helper before relational retrieval.
- Model output is scanned for prompt leakage, credit-card-like data, common API keys, high-entropy secrets, and configured cross-tenant fingerprints before being returned.
- Ephemeral agent history is held in an AES-256-GCM encrypted store, purged by `SELINA_MEMORY_RETENTION_MS`, and completions are truncated before retention.

## Edge Rate Limiting And WAF

- Keep application token-bucket rate limits enabled for auth, agent prompts, VFS, terminal, and WebSocket connections.
- Put Cloudflare WAF, AWS WAF, or an equivalent gateway in front of the bridge.
- Baseline WAF rules should block known bot signatures, ML-scored bots, credential stuffing, SQLi/XSS payloads, path traversal, request body floods, and abnormal country/ASN traffic for your deployment.
- Cache static and semi-static metadata at the edge using `s-maxage`/`CDN-Cache-Control`; never cache personalized runs, auth, CSRF, audit, or WebSocket payloads.
- Feed known-malicious CIDRs into Cloudflare lists or `threat_intel_cidrs` for AWS WAF.
- Use Cloudflare/AWS Shield/Anycast in front of public origins for SYN flood absorption and IP reputation enforcement.
- Forward only trusted proxy headers and set `TRUST_PROXY_HOPS` to the exact number of trusted hops.
- Keep the orchestration event bus, Redis, database, `/metrics`, and admin/control-plane endpoints private in a separate VPC/subnet and Kubernetes network policy. Public control-plane access should stay disabled with `ALLOW_PUBLIC_CONTROL_PLANE=false`.

## Verification

- Validate unauthenticated requests fail with `AUTH_REQUIRED`.
- Validate expired, wrong-audience, wrong-issuer, and long-lived JWTs fail.
- Validate `X-Tenant-Id` mismatch fails unless the token has cross-tenant permission.
- Validate a user without `tool:execute` cannot request `run_command`, even if approval is granted.
- Validate raw shell strings such as `npm && cat .env` are rejected before sandbox dispatch.

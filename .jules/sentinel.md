## 2024-07-13 - [Hardened Auth Tenant Verification and Removed Silent Failures]
**Vulnerability:**
- Legacy tokens could bypass session-level revocation if missing 'access' type check.
- `normalizeUser` silently falling back to `userId` when `tenantId` is absent breaks RLS tenant isolation.
- MergeMaster parallel reconciliation was using 'low'/'worker' model which poses a synthesis risk.
- Silent catches in JSON parsing and `buildParallelMatrix` lead to degraded states and masking LLM errors.

**Learning:**
- Strict tenant checks (fail hard vs fail soft) are essential in a multi-tenant application to avoid data leakage.
- LLM outputs that influence the application state heavily (MergeMaster reconciliation) must always use planner/reasoner LLM tiers.
- Network boundaries and internal failure states must log properly to external telemetry rather than swallowing exceptions.

**Prevention:**
- Enforce strict structural checks in Auth middleware explicitly testing for defined bounds (\`!tenantId\`).
- Use dedicated \`FINGERPRINT_HMAC_KEY\` distinct from \`JWT_SECRET\` to ensure token rotation doesn't invalidate hardware tracking keys.
- Bubble up LLM orchestration parsing and task degradation errors for explicit observability.

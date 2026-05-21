import pool, { withTenantContext } from '../db.js';
import { hashValue, withJsonCache } from '../utils/cache.js';

const DEFAULT_SCOPE = Object.freeze({
  projectName: 'default',
  tenantId: 'shared',
  namespace: 'default',
});

export async function getActiveSemanticIndexVersion(scope = {}) {
  const resolvedScope = normalizeScope(scope);
  const cacheKey = `cache:semantic-index:active:${hashValue(resolvedScope)}`;
  const { value } = await withJsonCache(cacheKey, Number.parseInt(process.env.SEMANTIC_INDEX_REGISTRY_CACHE_TTL_SECONDS || '30', 10), async () => {
    const result = await withTenantContext(resolvedScope.tenantId, client => client.query(
      `SELECT active_index_version
       FROM semantic_index_registry
       WHERE project_name = $1 AND tenant_id = $2 AND namespace = $3
       LIMIT 1`,
      [resolvedScope.projectName, resolvedScope.tenantId, resolvedScope.namespace]
    ));
    return result.rows[0]?.active_index_version || 'live';
  });
  return value;
}

export async function activateSemanticIndexVersion({
  projectName = 'default',
  tenantId = 'shared',
  namespace = 'default',
  indexVersion = 'live',
} = {}) {
  const resolvedScope = normalizeScope({ projectName, tenantId, namespace });
  await withTenantContext(resolvedScope.tenantId, client => client.query(
    `INSERT INTO semantic_index_registry (project_name, tenant_id, namespace, active_index_version, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (project_name, tenant_id, namespace) DO UPDATE SET
       active_index_version = EXCLUDED.active_index_version,
       updated_at = NOW()`,
    [resolvedScope.projectName, resolvedScope.tenantId, resolvedScope.namespace, indexVersion]
  ));
  return {
    ...resolvedScope,
    indexVersion,
  };
}

function normalizeScope(scope = {}) {
  return {
    projectName: scope.projectName || DEFAULT_SCOPE.projectName,
    tenantId: scope.tenantId || DEFAULT_SCOPE.tenantId,
    namespace: scope.namespace || DEFAULT_SCOPE.namespace,
  };
}

const EDGE_CACHE_SECONDS = Number.parseInt(process.env.EDGE_CACHE_SECONDS || '300', 10);

export function edgeCacheHeaders({ seconds = EDGE_CACHE_SECONDS, staleWhileRevalidate = 60 } = {}) {
  return (_req, res, next) => {
    res.setHeader(
      'Cache-Control',
      `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=${staleWhileRevalidate}`
    );
    res.setHeader('CDN-Cache-Control', `public, max-age=${seconds}`);
    next();
  };
}

export function requireInternalControlPlane(req, res, next) {
  if (process.env.NODE_ENV !== 'production' && process.env.CONTROL_PLANE_PRIVATE_IN_DEV !== 'true') return next();
  if (process.env.ALLOW_PUBLIC_CONTROL_PLANE === 'true') return next();
  if (isInternalRequest(req)) return next();
  return res.status(404).json({ error: 'NOT_FOUND' });
}

export function assertEdgeConfiguration(env = process.env) {
  if (env.NODE_ENV !== 'production' || env.EDGE_PROTECTION_REQUIRED !== 'true') {
    return { required: false };
  }

  const missing = [];
  if (!env.EDGE_PROVIDER) missing.push('EDGE_PROVIDER');
  if (!Number.parseInt(env.TRUST_PROXY_HOPS || '0', 10)) missing.push('TRUST_PROXY_HOPS');
  if (env.ALLOW_PUBLIC_CONTROL_PLANE === 'true') missing.push('ALLOW_PUBLIC_CONTROL_PLANE=false');

  if (missing.length > 0) {
    throw new Error(`Edge protection is required but misconfigured: ${missing.join(', ')}`);
  }

  return {
    required: true,
    provider: env.EDGE_PROVIDER,
    trustProxyHops: Number.parseInt(env.TRUST_PROXY_HOPS, 10),
  };
}

function isInternalRequest(req) {
  const allowCidrs = String(process.env.CONTROL_PLANE_ALLOWED_CIDRS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const header = req.get?.('x-control-plane-internal');
  if (header && header === process.env.CONTROL_PLANE_INTERNAL_TOKEN) return true;
  if (allowCidrs.length === 0) return false;
  const ip = req.ip || req.socket?.remoteAddress || '';
  return allowCidrs.some(cidr => ipMatchesCidr(ip, cidr));
}

function ipMatchesCidr(ip, cidr) {
  if (!cidr.includes('/')) return ip === cidr;
  const [base, bitsText] = cidr.split('/');
  const bits = Number.parseInt(bitsText, 10);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function ipv4ToInt(ip) {
  const normalized = String(ip || '').replace(/^::ffff:/, '');
  const parts = normalized.split('.').map(part => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((acc, part) => ((acc << 8) + part) >>> 0, 0);
}

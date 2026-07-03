const BLOCK_PATTERNS = [
  /KEY/i,
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /CREDENTIAL/i,
  /AUTH/i,
  /COOKIE/i,
  /SESSION/i,
];

const DEFAULT_ALLOW = new Set([
  'PATH',
  'Path',
  'ComSpec',
  'SystemRoot',
  'WINDIR',
  'HOME',
  'HOMEDRIVE',
  'HOMEPATH',
  'USER',
  'USERNAME',
  'USERPROFILE',
  'SHELL',
  'PWD',
  'TERM',
  'LANG',
  'LC_ALL',
  'NODE_ENV',
  'TMP',
  'TEMP',
  'TMPDIR',
  'GOPATH',
  'CARGO_HOME',
  'RUSTUP_HOME',
  'VIRTUAL_ENV',
  'CONDA_PREFIX',
]);

export function isSecretEnvKey(key) {
  return BLOCK_PATTERNS.some(pattern => pattern.test(key));
}

export function sanitizeEnvironment(
  env = process.env,
  policy = { inherit: 'core' }
) {
  const normalizedPolicy = {
    inherit: policy.inherit || 'core',
    includes: new Set(policy.includes || []),
    excludes: new Set(policy.excludes || []),
  };
  const result = {};

  for (const [key, value] of Object.entries(env || {})) {
    if (isSecretEnvKey(key) || normalizedPolicy.excludes.has(key)) {
      continue;
    }

    const explicitlyIncluded = normalizedPolicy.includes.has(key);
    const coreAllowed = DEFAULT_ALLOW.has(key);

    if (normalizedPolicy.inherit === 'none') {
      if (explicitlyIncluded || coreAllowed) result[key] = value;
      continue;
    }

    if (normalizedPolicy.inherit === 'core') {
      if (coreAllowed || explicitlyIncluded) result[key] = value;
      continue;
    }

    if (normalizedPolicy.inherit === 'all') {
      result[key] = value;
    }
  }

  return result;
}

export default sanitizeEnvironment;

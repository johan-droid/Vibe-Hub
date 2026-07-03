import crypto from 'crypto';

let generatedJwtSecret = null;
let generatedActionGrantSecret = null;
let generatedVibeMasterKey = null;

function allowDevFallback(env = process.env) {
  return env.NODE_ENV !== 'production' || env.VITEST === 'true' || env.NODE_ENV === 'test';
}

function generatedValue(name) {
  if (name === 'JWT_SECRET') {
    generatedJwtSecret ||= crypto.randomBytes(32).toString('hex');
    return generatedJwtSecret;
  }
  if (name === 'SELINA_ACTION_GRANT_SECRET') {
    generatedActionGrantSecret ||= crypto.randomBytes(32).toString('hex');
    return generatedActionGrantSecret;
  }
  if (name === 'VIBE_MASTER_KEY') {
    generatedVibeMasterKey ||= crypto.randomBytes(32).toString('hex');
    return generatedVibeMasterKey;
  }
  return '';
}

function readSecret(name, env = process.env) {
  const value = String(env[name] || '').trim();
  if (value) return value;
  return allowDevFallback(env) ? generatedValue(name) : '';
}

export function resolveJwtSecret(env = process.env) {
  return readSecret('JWT_SECRET', env);
}

export function resolveActionGrantSecret(env = process.env) {
  return readSecret('SELINA_ACTION_GRANT_SECRET', env);
}

export function resolveVibeMasterKey(env = process.env) {
  return readSecret('VIBE_MASTER_KEY', env);
}

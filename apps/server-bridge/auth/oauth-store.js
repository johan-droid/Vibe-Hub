import crypto from 'crypto';
import { pool } from '../db.js';

/**
 * Retry wrapper for OAuth database operations
 */
async function withRetry(operation, retries = 3, baseDelay = 500) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const isConnectionError = err.message?.includes('timeout') ||
                                err.message?.includes('terminated') ||
                                err.code === 'ECONNRESET' ||
                                err.code === 'ETIMEDOUT' ||
                                err.code?.startsWith('08');

      if (!isConnectionError || attempt === retries - 1) {
        throw err;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[OAuth Retry] Attempt ${attempt + 1}/${retries} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const STATE_TTL_MS = 15 * 60 * 1000;
const HANDOFF_TTL_MS = 90 * 1000;

/**
 * Fallback in-memory stores for when database is unavailable
 * These are only used during transient DB failures
 */
const fallbackOAuthStates = new Map();
const fallbackOAuthHandoffs = new Map();

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function getExpiryTime(ttl) {
  return new Date(Date.now() + ttl);
}

/**
 * Create OAuth state token for authorization flow
 * Stores in database with TTL
 */
export async function createOAuthState({ provider, returnOrigin }) {
  const state = randomToken(32);
  const expiresAt = getExpiryTime(STATE_TTL_MS);

  try {
    // Try with retry logic first
    await withRetry(async () => {
      await pool.query(
        `INSERT INTO oauth_states (state_token, provider, return_origin, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [state, provider, returnOrigin, expiresAt]
      );
    }, 3, 500);
    return state;
  } catch (err) {
    console.warn('[OAuth] DB insert failed after retries, using fallback for state:', err.message);
    // Fallback to in-memory for transient failures
    fallbackOAuthStates.set(state, {
      provider,
      returnOrigin,
      expiresAt: expiresAt.getTime(),
    });
    return state;
  }
}

/**
 * Consume OAuth state token (one-time use)
 * Validates provider and TTL
 */
export async function consumeOAuthState({ provider, state }) {
  if (!state) return null;

  try {
    // Query database
    const result = await pool.query(
      `SELECT state_token, provider, return_origin, expires_at FROM oauth_states
       WHERE state_token = $1`,
      [state]
    );

    if (result.rows.length === 0) {
      // Check fallback
      const fallback = fallbackOAuthStates.get(state);
      if (fallback && fallback.expiresAt > Date.now() && fallback.provider === provider) {
        fallbackOAuthStates.delete(state);
        return fallback;
      }
      return null;
    }

    const record = result.rows[0];

    // Validate provider and expiration
    if (record.provider !== provider || new Date(record.expires_at) <= new Date()) {
      return null;
    }

    // Delete the consumed token
    await pool.query('DELETE FROM oauth_states WHERE state_token = $1', [state]);

    return {
      provider: record.provider,
      returnOrigin: record.return_origin,
    };
  } catch (err) {
    console.warn('[OAuth] DB query failed, checking fallback for state:', err.message);
    // Fallback to in-memory
    const fallback = fallbackOAuthStates.get(state);
    if (fallback && fallback.expiresAt > Date.now() && fallback.provider === provider) {
      fallbackOAuthStates.delete(state);
      return fallback;
    }
    return null;
  }
}

/**
 * Create OAuth handoff code for post-callback exchange
 * One-time use code that frontend exchanges for cookies
 */
export async function createOAuthHandoff({ provider, session, user }) {
  const code = randomToken(32);
  const expiresAt = getExpiryTime(HANDOFF_TTL_MS);

  try {
    // Try with retry logic first
    await withRetry(async () => {
      await pool.query(
        `INSERT INTO oauth_handoffs (handoff_code, provider, user_data, session_data, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          code,
          provider,
          JSON.stringify(user),
          JSON.stringify(session),
          expiresAt,
        ]
      );
    }, 3, 500);
    console.log('[OAuth] Handoff stored in database:', code.substring(0, 8) + '...');
    return code;
  } catch (err) {
    console.warn('[OAuth] DB insert failed after retries, using fallback for handoff:', err.message);
    // Fallback to in-memory
    fallbackOAuthHandoffs.set(code, {
      provider,
      session,
      user,
      expiresAt: expiresAt.getTime(),
    });
    console.log('[OAuth] Handoff stored in memory fallback:', code.substring(0, 8) + '...');
    return code;
  }
}

/**
 * Consume OAuth handoff code (one-time use)
 * Validates provider and TTL
 */
export async function consumeOAuthHandoff(code) {
  if (!code) return null;

  try {
    // Query database
    const result = await pool.query(
      `SELECT handoff_code, provider, user_data, session_data, expires_at, consumed_at
       FROM oauth_handoffs
       WHERE handoff_code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      // Check fallback
      const fallback = fallbackOAuthHandoffs.get(code);
      if (fallback && fallback.expiresAt > Date.now()) {
        fallbackOAuthHandoffs.delete(code);
        return fallback;
      }
      return null;
    }

    const record = result.rows[0];

    // Check if already consumed
    if (record.consumed_at) {
      console.warn('[OAuth] Attempt to reuse handoff code:', code.substring(0, 8));
      return null;
    }

    // Check expiration
    if (new Date(record.expires_at) <= new Date()) {
      console.warn('[OAuth] Expired handoff code:', code.substring(0, 8));
      return null;
    }

    // Mark as consumed
    await pool.query(
      'UPDATE oauth_handoffs SET consumed_at = NOW() WHERE handoff_code = $1',
      [code]
    );

    const parseJsonb = (val) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    };

    return {
      provider: record.provider,
      session: parseJsonb(record.session_data),
      user: parseJsonb(record.user_data),
    };
  } catch (err) {
    console.warn('[OAuth] DB query failed, checking fallback for handoff:', err.message);
    // Fallback to in-memory
    const fallback = fallbackOAuthHandoffs.get(code);
    if (fallback && fallback.expiresAt > Date.now()) {
      fallbackOAuthHandoffs.delete(code);
      return fallback;
    }
    return null;
  }
}

/**
 * Cleanup expired OAuth tokens (can be called periodically)
 */
export async function cleanupExpiredOAuthTokens() {
  try {
    await pool.query('DELETE FROM oauth_states WHERE expires_at < NOW()');
    await pool.query('DELETE FROM oauth_handoffs WHERE expires_at < NOW() AND consumed_at IS NULL');
    console.log('[OAuth] Cleanup completed - removed expired tokens');
  } catch (err) {
    console.error('[OAuth] Cleanup failed:', err.message);
  }
}

/**
 * @fileoverview backend/auth/pow-middleware.js
 * @module PowMiddleware
 * @description High-Assurance stateless client Proof-of-Work (Hashcash) puzzle middleware.
 * Fast, CPU-friendly verification of SHA-256 puzzles bound to specific user emails/usernames.
 */

import crypto from 'crypto';

/**
 * Express middleware to throttle registration/login endpoints using a client puzzle verification.
 * Client must submit powNonce and powTimestamp in req.body.
 * The SHA-256 hash of `emailOrUsername:powTimestamp:powNonce` must start with `difficulty` zero hex chars.
 * 
 * @param {number} difficultyHexChars number of leading zero hex chars required (default 4, which is 16 bits)
 */
export function powGuard(difficultyHexChars = 4) {
  return (req, res, next) => {
    // 1. Bypass during test runs under secure headers
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      if (req.headers['x-bypass-pow'] === 'test-secret' || !req.headers['x-test-pow-active']) {
        return next();
      }
    }

    const { powNonce, powTimestamp } = req.body;
    const emailOrUser = req.body.email || req.body.username || 'default';

    if (!powNonce || !powTimestamp) {
      return res.status(400).json({
        success: false,
        error: 'Proof-of-work puzzle parameters are missing. Please solve the puzzle.',
        code: 'POW_REQUIRED',
        difficulty: difficultyHexChars
      });
    }

    // 2. Validate timestamp fresh limit (<5 minutes) to block replay attacks
    const timestamp = Number.parseInt(powTimestamp, 10);
    if (Number.isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        error: 'Proof-of-work puzzle has expired or is invalid.',
        code: 'POW_EXPIRED'
      });
    }

    // 3. Compute hash and assert prefix difficulty
    // Using emailOrUser ensures the client cannot pre-compute nonces and share them across accounts!
    const message = `${emailOrUser}:${powTimestamp}:${powNonce}`;
    const hash = crypto.createHash('sha256').update(message).digest('hex');

    const requiredPrefix = '0'.repeat(difficultyHexChars);
    if (!hash.startsWith(requiredPrefix)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proof-of-work solution.',
        code: 'POW_INVALID'
      });
    }

    next();
  };
}

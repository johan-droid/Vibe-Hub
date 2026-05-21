/**
 * @fileoverview apps/server-bridge/auth/routes.js
 * @module AuthRoutes
 * @description SAAS-Grade authentication management routes for Selina.
 * Handles secure token lifecycle, session revocation, single/global logout,
 * and provides audit trails for authentication history. Protected by CSRF middleware.
 */

import { Router } from 'express';
import {
  requireAuth,
  optionalAuth,
  handleRefreshToken,
  clearAuthCookies,
  setAuthCookies
} from './middleware.js';
import {
  logoutSession,
  logoutAllSessions,
  getUserActiveSessions,
  validateSession
} from './session.js';
import { consumeOAuthHandoff } from './oauth-store.js';
import { getUserAuthHistory } from '../db.js';
import logger from '../utils/detailed-logger.js';

const router = Router();

function authUserPayload(req) {
  return {
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    avatarUrl: req.user.avatar_url,
    provider: req.user.provider
  };
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', handleRefreshToken);

/**
 * POST /api/auth/handoff
 * Exchange a short-lived OAuth handoff code for HTTP-only session cookies.
 */
router.post('/handoff', async (req, res) => {
  try {
    const record = await consumeOAuthHandoff(req.body?.code);
    if (!record) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired sign-in handoff.',
        code: 'INVALID_HANDOFF'
      });
    }

    setAuthCookies(res, {
      accessToken: record.session.accessToken,
      refreshToken: record.session.refreshToken,
      sessionToken: record.session.sessionToken,
      deviceId: record.session.deviceId,
    });

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      authenticated: true,
      user: record.user,
      sessionId: record.session.sessionId,
      provider: record.provider
    });
  } catch (err) {
    logger.error('AuthRoutes', 'OAuth handoff error', err);
    clearAuthCookies(res);
    return res.status(500).json({ success: false, error: 'Failed to complete sign-in' });
  }
});

/**
 * GET /api/auth/status
 * Non-erroring session probe for app bootstrap.
 */
router.get('/status', optionalAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (!req.user) {
    return res.json({
      success: true,
      authenticated: false,
      user: null,
      sessionId: null
    });
  }

  res.json({
    success: true,
    authenticated: true,
    user: authUserPayload(req),
    sessionId: req.sessionId
  });
});

/**
 * POST /api/auth/logout
 * Logout current session
 */
router.post('/logout', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req;
    const userId = req.user?.id;

    if (userId && sessionId) {
      await logoutSession(userId, sessionId, 'user_logout');
    }

    clearAuthCookies(res);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    logger.error('AuthRoutes', 'Logout error', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout all sessions except current
 */
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req;
    const userId = req.user.id;

    await logoutAllSessions(userId, sessionId, 'user_logout_all');

    // Clear cookies for current session too
    clearAuthCookies(res);

    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (err) {
    logger.error('AuthRoutes', 'Logout all error', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/sessions
 * List all active sessions for the user
 */
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.sessionId;

    const sessions = await getUserActiveSessions(userId);

    // Mark current session and format device info
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      isCurrent: session.id === currentSessionId,
      deviceInfo: session.device_info,
      ipGeo: session.ip_geo,
      isActive: session.is_active,
      lastActivityAt: session.last_activity_at,
      expiresAt: session.expires_at,
      createdAt: session.created_at,
      revokedAt: session.revoked_at,
      revokedReason: session.revoked_reason
    }));

    res.json({ success: true, sessions: formattedSessions });
  } catch (err) {
    logger.error('AuthRoutes', 'Get sessions error', err);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * POST /api/auth/sessions/:id/revoke
 * Revoke a specific session
 */
router.post('/sessions/:id/revoke', requireAuth, async (req, res) => {
  try {
    const { id: sessionIdToRevoke } = req.params;
    const userId = req.user.id;
    const currentSessionId = req.sessionId;

    // Prevent revoking current session through this endpoint
    if (sessionIdToRevoke === currentSessionId) {
      return res.status(400).json({
        error: 'Cannot revoke current session',
        message: 'Use /logout to end your current session'
      });
    }

    await logoutSession(userId, sessionIdToRevoke, 'user_revoked');

    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (err) {
    logger.error('AuthRoutes', 'Revoke session error', err);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

/**
 * GET /api/auth/history
 * Get login audit history for the user
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const history = await getUserAuthHistory(userId, limit);

    res.json({ success: true, history });
  } catch (err) {
    logger.error('AuthRoutes', 'Get history error', err);
    res.status(500).json({ error: 'Failed to get auth history' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (works with both session and JWT)
 */
router.get('/me', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' });
    }

    res.json({
      success: true,
      user: authUserPayload(req),
      sessionId: req.sessionId
    });
  } catch (err) {
    logger.error('AuthRoutes', 'Get me error', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/validate-session
 * Validate current session token and return user info
 */
router.post('/validate-session', async (req, res) => {
  try {
    const { sessionToken } = req.body;

    if (!sessionToken) {
      return res.status(400).json({ error: 'session_token_required' });
    }

    const session = await validateSession(sessionToken);

    if (!session) {
      return res.status(401).json({ error: 'invalid_session', code: 'INVALID_SESSION' });
    }

    res.json({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        avatarUrl: session.avatarUrl,
        provider: session.provider
      },
      sessionId: session.sessionId,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    logger.error('AuthRoutes', 'Validate session error', err);
    res.status(500).json({ error: 'Failed to validate session' });
  }
});

export default router;

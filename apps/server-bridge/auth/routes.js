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
import { sendError } from '../utils/api-error.js';
import {
  authPayloadFromRequest,
  authPayloadFromSession,
  buildAuthenticatedResponse,
  buildUnauthenticatedResponse,
} from './payload.js';

const router = Router();

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
      return sendError(res, req, {
        status: 401,
        code: 'INVALID_HANDOFF',
        message: 'Invalid or expired sign-in handoff.',
      });
    }

    setAuthCookies(res, {
      accessToken: record.session.accessToken,
      refreshToken: record.session.refreshToken,
      sessionToken: record.session.sessionToken,
      deviceId: record.session.deviceId,
    });

    res.set('Cache-Control', 'no-store');
    return res.json(buildAuthenticatedResponse({
      user: record.user,
      sessionId: record.session.sessionId,
      provider: record.provider,
    }));
  } catch (err) {
    logger.error('AuthRoutes', 'OAuth handoff error', err);
    clearAuthCookies(res);
    return sendError(res, req, {
      status: 500,
      code: 'HANDOFF_FAILED',
      message: 'Failed to complete sign-in',
      stack: err.stack,
    });
  }
});

/**
 * GET /api/auth/status
 * Non-erroring session probe for app bootstrap.
 */
router.get('/status', optionalAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (!req.user) {
    return res.json(buildUnauthenticatedResponse());
  }

  res.json(buildAuthenticatedResponse({
    user: authPayloadFromRequest(req),
    sessionId: req.sessionId,
  }));
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
    return sendError(res, req, {
      status: 500,
      code: 'LOGOUT_FAILED',
      message: 'Logout failed',
      stack: err.stack,
    });
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
    return sendError(res, req, {
      status: 500,
      code: 'LOGOUT_ALL_FAILED',
      message: 'Logout failed',
      stack: err.stack,
    });
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
    return sendError(res, req, {
      status: 500,
      code: 'SESSIONS_LOOKUP_FAILED',
      message: 'Failed to get sessions',
      stack: err.stack,
    });
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
      return sendError(res, req, {
        status: 400,
        code: 'CURRENT_SESSION_REVOKE_FORBIDDEN',
        message: 'Cannot revoke current session. Use /logout to end your current session.',
      });
    }

    await logoutSession(userId, sessionIdToRevoke, 'user_revoked');

    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (err) {
    logger.error('AuthRoutes', 'Revoke session error', err);
    return sendError(res, req, {
      status: 500,
      code: 'SESSION_REVOKE_FAILED',
      message: 'Failed to revoke session',
      stack: err.stack,
    });
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
    return sendError(res, req, {
      status: 500,
      code: 'AUTH_HISTORY_LOOKUP_FAILED',
      message: 'Failed to get auth history',
      stack: err.stack,
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (works with both session and JWT)
 */
router.get('/me', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, req, {
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Not authenticated',
      });
    }

    res.json({
      success: true,
      user: authPayloadFromRequest(req),
      sessionId: req.sessionId
    });
  } catch (err) {
    logger.error('AuthRoutes', 'Get me error', err);
    return sendError(res, req, {
      status: 500,
      code: 'AUTH_ME_FAILED',
      message: 'Failed to get user info',
      stack: err.stack,
    });
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
      return sendError(res, req, {
        status: 400,
        code: 'SESSION_TOKEN_REQUIRED',
        message: 'session_token_required',
      });
    }

    const session = await validateSession(sessionToken);

    if (!session) {
      return sendError(res, req, {
        status: 401,
        code: 'INVALID_SESSION',
        message: 'invalid_session',
      });
    }

    res.json({
      success: true,
      user: authPayloadFromSession(session),
      sessionId: session.sessionId,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    logger.error('AuthRoutes', 'Validate session error', err);
    return sendError(res, req, {
      status: 500,
      code: 'SESSION_VALIDATE_FAILED',
      message: 'Failed to validate session',
      stack: err.stack,
    });
  }
});

export default router;

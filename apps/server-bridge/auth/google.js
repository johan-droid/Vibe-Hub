import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { upsertUser } from '../db.js';
import { createSession } from './session.js';
import { ensureDeviceCookie, setAuthCookies } from './middleware.js';
import {
  createOAuthHandoff,
  createOAuthState,
  consumeOAuthState,
} from './oauth-store.js';
import {
  buildOAuthCallbackUrl,
  clearOAuthReturnOriginCookie,
  getOAuthRequestOrigin,
  getOAuthReturnOrigin,
  setOAuthReturnOriginCookie,
} from './oauth-return.js';
import logger from '../utils/detailed-logger.js';
import { powGuard } from './pow-middleware.js';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * GET /api/auth/google/config
 */
router.get('/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID,
    providers: {
      google: {
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI),
        clientId: process.env.GOOGLE_CLIENT_ID || '',
      },
      github: {
        configured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_REDIRECT_URI && process.env.UI_ORIGIN),
      },
    },
  });
});

/**
 * POST /api/auth/google/verify-token
 * Support both ID token (credential) and Access Token
 */
router.post('/verify-token', powGuard(4), async (req, res) => {
  const { credential, access_token } = req.body;
  logger.debug('GoogleAuth', 'Verify token request received', {
    hasCredential: !!credential,
    hasAccessToken: !!access_token
  });

  try {
    let profile;

    if (credential) {
      // Verify ID Token
      logger.debug('GoogleAuth', 'Verifying ID token...');
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      profile = ticket.getPayload();
      logger.debug('GoogleAuth', 'ID token verified', { email: profile?.email });
    } else if (access_token) {
      // Fetch User Info using Access Token
      const userRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      profile = await userRes.json();
      logger.debug('GoogleAuth', 'User info fetched', { email: profile?.email });
      if (profile.error) throw new Error(profile.error_description || profile.error);
    } else {
      logger.debug('GoogleAuth', 'No token provided');
      return res.status(400).json({ error: 'missing_token' });
    }

    logger.debug('GoogleAuth', 'Upserting user', { email: profile.email });
    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      provider: 'google',
      providerId: profile.sub,
    });
    logger.debug('GoogleAuth', 'User upserted', { userId: user.id });

    // Create SaaS-grade session
    logger.debug('GoogleAuth', 'Creating session...');
    const deviceId = ensureDeviceCookie(req, res);
    const session = await createSession({
      userId: user.id,
      provider: 'google',
      req,
      deviceId,
    });
    logger.debug('GoogleAuth', 'Session created', { sessionId: session.sessionId });

    // Set secure cookies
    setAuthCookies(res, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionToken: session.sessionToken,
      deviceId: session.deviceId,
    });

    logger.debug('GoogleAuth', 'Sending success response');
    res.json({
      success: true,
      sessionId: session.sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        provider: user.provider
      }
    });
  } catch (err) {
    logger.error('GoogleAuth', 'Verification failed', err);
    if (err.message === 'MAX_SESSIONS_EXCEEDED') {
      return res.status(403).json({ error: 'max_sessions_exceeded', message: 'Too many active sessions. Please log out from another device.' });
    }
    res.status(401).json({ error: 'invalid_token', message: err.message });
  }
});

function isSecureCookie() {
  return process.env.NODE_ENV === 'production';
}

function redirectWithError(req, res, error) {
  return res.redirect(buildOAuthCallbackUrl(getOAuthReturnOrigin(req), error));
}

const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'UI_ORIGIN'];

function handleOAuthConfigError(req, res) {
  if (process.env.UI_ORIGIN) {
    return res.redirect(buildOAuthCallbackUrl(getOAuthRequestOrigin(req), 'oauth_not_configured'));
  }
  return res.status(500).json({ error: 'oauth_not_configured' });
}

router.get('/google', async (req, res) => {
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) return handleOAuthConfigError(req, res);

  const returnOrigin = getOAuthRequestOrigin(req);
  const state = await createOAuthState({ provider: 'google', returnOrigin });

  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: isSecureCookie() ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000,
  });
  setOAuthReturnOriginCookie(res, returnOrigin);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) return handleOAuthConfigError(req, res);

  const { code, state } = req.query;
  const stateRecord = await consumeOAuthState({ provider: 'google', state });
  const returnOrigin = stateRecord?.returnOrigin || getOAuthReturnOrigin(req);
  let cookieState = req.cookies?.google_oauth_state;
  if (!cookieState && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)google_oauth_state=([^;]*)/);
    if (match) cookieState = match[1];
  }

  if (!code) return redirectWithError(req, res, 'missing_code');
  if (!state || (!stateRecord && (!cookieState || state !== cookieState))) return redirectWithError(req, res, 'invalid_state');

  res.clearCookie('google_oauth_state');
  clearOAuthReturnOriginCookie(res);

  try {
    logger.info('GoogleAuth', 'Step 1: Exchanging code for tokens...');
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    logger.info('GoogleAuth', 'Token response:', { hasAccessToken: !!tokens.access_token, hasError: !!tokens.error });
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    logger.info('GoogleAuth', 'Step 2: Fetching user info...');
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();
    logger.info('GoogleAuth', 'User profile:', { email: profile.email, name: profile.name, hasSub: !!profile.sub });

    logger.info('GoogleAuth', 'Step 3: Upserting user to database...');
    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      provider: 'google',
      providerId: profile.sub,
    });
    logger.info('GoogleAuth', 'User upserted:', { userId: user.id });

    logger.info('GoogleAuth', 'Step 4: Creating session...');
    const deviceId = ensureDeviceCookie(req, res);
    const session = await createSession({
      userId: user.id,
      provider: 'google',
      req,
      deviceId,
    });
    logger.info('GoogleAuth', 'Session created:', { sessionId: session.sessionId });

    logger.info('GoogleAuth', 'Step 5: Setting auth cookies...');
    setAuthCookies(res, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionToken: session.sessionToken,
      deviceId: session.deviceId,
    });

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      provider: user.provider
    };

    logger.info('GoogleAuth', 'Step 6: Creating OAuth handoff...');
    const handoffCode = await createOAuthHandoff({
      provider: 'google',
      session,
      user: userPayload
    });
    logger.info('GoogleAuth', 'Handoff created:', { hasCode: !!handoffCode });

    // Redirect with only an opaque one-time code; the frontend exchanges it
    // against the API host to set cookies reliably on localhost/127.0.0.1.
    const redirectUrl = new URL('/auth/callback', returnOrigin);
    redirectUrl.searchParams.set('code', handoffCode);

    logger.info('GoogleAuth', 'Step 7: Redirecting to:', { redirect: redirectUrl.toString() });
    res.redirect(redirectUrl.toString());
  } catch (err) {
    // Detailed error logging to identify exact failure point

    // Log the specific stage where error occurred based on what was completed
    logger.error('GoogleAuth', 'Callback error', {
      error: err.message,
      code: err.code,
      stack: err.stack,
      hasCode: !!code,
      hasState: !!state,
      hasStateRecord: !!stateRecord,
      returnOrigin: returnOrigin
    });

    if (err.message === 'MAX_SESSIONS_EXCEEDED') {
      return redirectWithError(req, res, 'max_sessions_exceeded');
    }

    // Specific error types for better frontend messaging
    if (err.message?.includes('Connection terminated') || err.code?.includes('08')) {
      return redirectWithError(req, res, 'database_error');
    }

    if (err.message?.includes('invalid_grant') || err.message?.includes('redirect_uri_mismatch')) {
      return redirectWithError(req, res, 'oauth_config_error');
    }

    redirectWithError(req, res, 'provider_failed');
  }
});

export default router;

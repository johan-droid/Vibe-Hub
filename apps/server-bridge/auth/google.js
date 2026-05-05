import { Router } from 'express';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { upsertUser } from '../db.js';
import { createSession } from './session.js';
import { setAuthCookies } from './middleware.js';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * GET /api/auth/google/config
 */
router.get('/config', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

// Log all requests to this router
router.use((req, res, next) => {
  console.log(`[Google Auth Router] ${req.method} ${req.path} - Body:`, Object.keys(req.body || {}));
  next();
});

/**
 * POST /api/auth/google/verify-token
 * Support both ID token (credential) and Access Token
 */
router.post('/verify-token', async (req, res) => {
  const { credential, access_token } = req.body;
  console.log('[Google Auth] Verify token request received:', { hasCredential: !!credential, hasAccessToken: !!access_token, body: req.body });

  try {
    let profile;

    if (credential) {
      // Verify ID Token
      console.log('[Google Auth] Verifying ID token...');
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      profile = ticket.getPayload();
      console.log('[Google Auth] ID token verified, profile:', profile?.email);
    } else if (access_token) {
      // Fetch User Info using Access Token
      console.log('[Google Auth] Fetching user info with access token...');
      const userRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      profile = await userRes.json();
      console.log('[Google Auth] User info fetched:', profile?.email);
      if (profile.error) throw new Error(profile.error_description || profile.error);
    } else {
      console.log('[Google Auth] No token provided');
      return res.status(400).json({ error: 'missing_token' });
    }

    console.log('[Google Auth] Upserting user:', profile.email);
    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      provider: 'google',
      providerId: profile.sub,
    });
    console.log('[Google Auth] User upserted:', user.id);

    // Create SaaS-grade session
    console.log('[Google Auth] Creating session...');
    const session = await createSession({
      userId: user.id,
      provider: 'google',
      req
    });
    console.log('[Google Auth] Session created:', session.sessionId);

    // Set secure cookies
    setAuthCookies(res, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionToken: session.sessionToken
    });

    console.log('[Google Auth] Sending success response');
    res.json({
      success: true,
      token: session.accessToken,
      refreshToken: session.refreshToken,
      sessionToken: session.sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        provider: user.provider
      }
    });
  } catch (err) {
    console.error('[Google Auth] Verification failed:', err.message, err.stack);
    if (err.message === 'MAX_SESSIONS_EXCEEDED') {
      return res.status(403).json({ error: 'max_sessions_exceeded', message: 'Too many active sessions. Please log out from another device.' });
    }
    res.status(401).json({ error: 'invalid_token', message: err.message });
  }
});

function getFrontendUrl() {
  const origin = process.env.UI_ORIGIN;
  if (!origin) {
    throw new Error('UI_ORIGIN environment variable is required');
  }
  return origin.replace(/\/$/, '');
}

function isSecureCookie() {
  return process.env.NODE_ENV === 'production' && String(process.env.UI_ORIGIN).startsWith('https://');
}

function redirectWithError(res, error) {
  return res.redirect(`${getFrontendUrl()}/auth/callback?error=${encodeURIComponent(error)}`);
}

const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'UI_ORIGIN'];

router.get('/google', (req, res) => {
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) return res.status(500).json({ error: 'oauth_not_configured' });

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });

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
  if (missingVars.length > 0) return res.status(500).json({ error: 'oauth_not_configured' });

  const { code, state } = req.query;
  let cookieState = req.cookies?.google_oauth_state;
  if (!cookieState && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)google_oauth_state=([^;]*)/);
    if (match) cookieState = match[1];
  }

  if (!code) return redirectWithError(res, 'missing_code');
  if (!state || !cookieState || state !== cookieState) return redirectWithError(res, 'invalid_state');

  res.clearCookie('google_oauth_state');

  try {
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
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      provider: 'google',
      providerId: profile.sub,
    });

    // Create SaaS-grade session
    const session = await createSession({
      userId: user.id,
      provider: 'google',
      req
    });

    // Set secure cookies
    setAuthCookies(res, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionToken: session.sessionToken
    });

    // Redirect with tokens for frontend processing
    const redirectUrl = new URL(`${getFrontendUrl()}/auth/callback`);
    redirectUrl.searchParams.set('token', session.accessToken);
    redirectUrl.searchParams.set('refreshToken', session.refreshToken);
    redirectUrl.searchParams.set('sessionToken', session.sessionToken);

    res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error('Google callback error:', err);
    if (err.message === 'MAX_SESSIONS_EXCEEDED') {
      return redirectWithError(res, 'max_sessions_exceeded');
    }
    redirectWithError(res, 'provider_failed');
  }
});

export default router;

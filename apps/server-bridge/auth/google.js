import { Router } from 'express';
import crypto from 'crypto';
import { upsertUser } from '../db.js';
import { generateToken } from './middleware.js';

const router = Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function getFrontendUrl() {
  const origin = process.env.UI_ORIGIN;
  if (!origin) {
    throw new Error('UI_ORIGIN environment variable is required');
  }
  return origin.replace(/\/$/, '');
}

function redirectWithError(res, error) {
  return res.redirect(`${getFrontendUrl()}/auth/callback?error=${encodeURIComponent(error)}`);
}

// Validate required environment variables
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'UI_ORIGIN'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

/**
 * GET /api/auth/google
 * Redirect user to Google's consent screen
 */
router.get('/google', (req, res) => {
  if (missingVars.length > 0) {
    return redirectWithError(res, 'oauth_not_configured');
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
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

/**
 * GET /api/auth/google/callback
 * Exchange authorization code for tokens, then create/update user
 */
router.get('/google/callback', async (req, res) => {
  if (missingVars.length > 0) {
    return redirectWithError(res, 'oauth_not_configured');
  }

  const { code, state } = req.query;

  let cookieState = req.cookies?.google_oauth_state;
  if (!cookieState && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)google_oauth_state=([^;]*)/);
    if (match) cookieState = match[1];
  }

  if (!code) return redirectWithError(res, 'missing_code');
  if (!state || !cookieState || state !== cookieState) {
    return redirectWithError(res, 'invalid_state');
  }

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

    const jwt = generateToken(user);
    res.redirect(`${getFrontendUrl()}/auth/callback?token=${encodeURIComponent(jwt)}`);
  } catch (err) {
    redirectWithError(res, 'provider_failed');
  }
});

export default router;

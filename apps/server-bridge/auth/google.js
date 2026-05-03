import { Router } from 'express';
import crypto from 'crypto';
import { upsertUser } from '../db.js';
import { generateToken } from './middleware.js';

const router = Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Validate required environment variables
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('[Google OAuth] Missing required environment variables:', missingVars.join(', '));
}

/**
 * GET /api/auth/google
 * Redirect user to Google's consent screen
 */
router.get('/google', (req, res) => {
  if (missingVars.length > 0) {
    return res.status(500).json({
      error: 'OAuth not configured',
      message: `Missing required environment variables: ${missingVars.join(', ')}`
    });
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
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
    return res.status(500).json({
      error: 'OAuth not configured',
      message: `Missing required environment variables: ${missingVars.join(', ')}`
    });
  }

  const { code, state } = req.query;

  let cookieState = req.cookies?.google_oauth_state;
  if (!cookieState && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)google_oauth_state=([^;]*)/);
    if (match) cookieState = match[1];
  }


  if (!code) return res.status(400).json({ error: 'Missing authorization code.' });
  if (!state || !cookieState || state !== cookieState) {
    return res.status(403).json({ error: 'Invalid OAuth state.' });
  }

  // Clear state cookie
  res.clearCookie('google_oauth_state');

  try {
    // Debug: Log what we're sending (mask secret)
    console.log('[Google OAuth Debug] client_id:', process.env.GOOGLE_CLIENT_ID?.slice(-20));
    console.log('[Google OAuth Debug] client_secret length:', process.env.GOOGLE_CLIENT_SECRET?.length);
    console.log('[Google OAuth Debug] redirect_uri:', process.env.GOOGLE_REDIRECT_URI);

    // Exchange code for tokens
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
    console.log('[Google OAuth Debug] Token response:', tokens);
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Get user info
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    // Upsert user in DB
    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      provider: 'google',
      providerId: profile.sub,
    });

    // Generate JWT and redirect to frontend with token
    const jwt = generateToken(user);
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://vibe-hub-ui.onrender.com'
      : 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${jwt}`);
  } catch (err) {
    console.error('[Google OAuth Error]', err);
    // Provide more detailed error for invalid_client
    if (err.message?.includes('invalid_client')) {
      return res.status(500).json({
        error: 'Google authentication failed: invalid_client',
        message: 'Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are correctly set'
      });
    }
    res.status(500).json({ error: 'Google authentication failed.' });
  }
});

export default router;

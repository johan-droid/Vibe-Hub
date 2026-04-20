import { Router } from 'express';
import { upsertUser } from '../db.js';
import { generateToken } from './middleware.js';

const router = Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * GET /api/auth/google
 * Redirect user to Google's consent screen
 */
router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

/**
 * GET /api/auth/google/callback
 * Exchange authorization code for tokens, then create/update user
 */
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing authorization code.' });

  try {
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
    res.status(500).json({ error: 'Google authentication failed.' });
  }
});

export default router;

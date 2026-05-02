import { Router } from 'express';
import crypto from 'crypto';
import { upsertUser } from '../db.js';
import { generateToken } from './middleware.js';

const router = Router();

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

/**
 * GET /api/auth/github
 * Redirect user to GitHub's consent screen
 */
router.get('/github', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: 'user:email read:user',
    state,
  });
  res.redirect(`${GITHUB_AUTH_URL}?${params}`);
});

/**
 * GET /api/auth/github/callback
 * Exchange code for access token, fetch user profile
 */
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;
  const match = req.headers.cookie?.match(/(?:^|;\s*)github_oauth_state=([^;]*)/);
  const cookieState = match ? match[1] : null;

  if (!code) return res.status(400).json({ error: 'Missing authorization code.' });
  if (!state || !cookieState || state !== cookieState) {
    return res.status(403).json({ error: 'Invalid OAuth state.' });
  }

  // Clear state cookie
  res.clearCookie('github_oauth_state');

  try {
    // Exchange code for token
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const headers = { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'Selina' };

    // Get user profile
    const userRes = await fetch(GITHUB_USER_URL, { headers });
    const profile = await userRes.json();

    // Get primary email (may be private)
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch(GITHUB_EMAILS_URL, { headers });
      const emails = await emailsRes.json();
      const primary = emails.find(e => e.primary) || emails[0];
      email = primary?.email;
    }

    // Upsert user in DB
    const user = await upsertUser({
      email: email || `${profile.login}@github.noreply`,
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url,
      provider: 'github',
      providerId: String(profile.id),
    });

    // Generate JWT and redirect
    const jwt = generateToken(user);
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://selina-ui.onrender.com'
      : 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${jwt}`);
  } catch (err) {
    console.error('[GitHub OAuth Error]', err);
    res.status(500).json({ error: 'GitHub authentication failed.' });
  }
});

export default router;

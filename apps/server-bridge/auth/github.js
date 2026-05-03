import { Router } from 'express';
import crypto from 'crypto';
import { upsertUser } from '../db.js';
import { generateToken } from './middleware.js';

const router = Router();

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

function getFrontendUrl() {
  const origin = process.env.UI_ORIGIN || (process.env.NODE_ENV === 'production'
    ? 'https://vibe-hub-ui.onrender.com'
    : 'http://localhost:5173');
  return origin.replace(/\/$/, '');
}

function redirectWithError(res, error) {
  return res.redirect(`${getFrontendUrl()}/auth/callback?error=${encodeURIComponent(error)}`);
}

// Validate required environment variables
const requiredEnvVars = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('[GitHub OAuth] Missing required environment variables:', missingVars.join(', '));
}

/**
 * GET /api/auth/github
 * Redirect user to GitHub's consent screen
 */
router.get('/github', (req, res) => {
  if (missingVars.length > 0) {
    return redirectWithError(res, 'oauth_not_configured');
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
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
  if (missingVars.length > 0) {
    return redirectWithError(res, 'oauth_not_configured');
  }

  const { code, state } = req.query;

  let cookieState = req.cookies?.github_oauth_state;
  if (!cookieState && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)github_oauth_state=([^;]*)/);
    if (match) cookieState = match[1];
  }

  if (!code) return redirectWithError(res, 'missing_code');
  if (!state || !cookieState || state !== cookieState) {
    return redirectWithError(res, 'invalid_state');
  }

  res.clearCookie('github_oauth_state');

  try {
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

    const headers = { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'Vibe-Hub' };

    const userRes = await fetch(GITHUB_USER_URL, { headers });
    const profile = await userRes.json();

    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch(GITHUB_EMAILS_URL, { headers });
      const emails = await emailsRes.json();
      const primary = emails.find(e => e.primary) || emails[0];
      email = primary?.email;
    }

    const user = await upsertUser({
      email: email || `${profile.login}@github.noreply`,
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url,
      provider: 'github',
      providerId: String(profile.id),
    });

    const jwt = generateToken(user);
    res.redirect(`${getFrontendUrl()}/auth/callback?token=${encodeURIComponent(jwt)}`);
  } catch (err) {
    console.error('[GitHub OAuth Error]', err);
    redirectWithError(res, 'provider_failed');
  }
});

export default router;

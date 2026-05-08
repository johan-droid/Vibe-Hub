import { Router } from 'express';
import { upsertUser } from '../db.js';
import { createSession } from './session.js';
import { setAuthCookies } from './middleware.js';
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

const router = Router();

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

function redirectWithError(req, res, error) {
  return res.redirect(buildOAuthCallbackUrl(getOAuthReturnOrigin(req), error));
}

function isSecureCookie() {
  return process.env.NODE_ENV === 'production';
}

function handleOAuthConfigError(req, res) {
  if (process.env.UI_ORIGIN) {
    return res.redirect(buildOAuthCallbackUrl(getOAuthRequestOrigin(req), 'oauth_not_configured'));
  }
  return res.status(500).json({ error: 'oauth_not_configured' });
}

// Validate required environment variables
const requiredEnvVars = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI', 'UI_ORIGIN'];

/**
 * GET /api/auth/github
 * Redirect user to GitHub's consent screen
 */
router.get('/github', async (req, res) => {
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    return handleOAuthConfigError(req, res);
  }

  const returnOrigin = getOAuthRequestOrigin(req);
  const state = await createOAuthState({ provider: 'github', returnOrigin });

  res.cookie('github_oauth_state', state, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });
  setOAuthReturnOriginCookie(res, returnOrigin);

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
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    return handleOAuthConfigError(req, res);
  }

  const { code, state } = req.query;
  const stateRecord = await consumeOAuthState({ provider: 'github', state });
  const returnOrigin = stateRecord?.returnOrigin || getOAuthReturnOrigin(req);

  let cookieState = req.cookies?.github_oauth_state;
  if (!cookieState && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)github_oauth_state=([^;]*)/);
    if (match) cookieState = match[1];
  }

  if (!code) return redirectWithError(req, res, 'missing_code');
  if (!state || (!stateRecord && (!cookieState || state !== cookieState))) {
    return redirectWithError(req, res, 'invalid_state');
  }

  res.clearCookie('github_oauth_state');
  clearOAuthReturnOriginCookie(res);

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

    // Create SaaS-grade session
    const session = await createSession({
      userId: user.id,
      provider: 'github',
      req
    });

    // Set secure cookies
    setAuthCookies(res, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sessionToken: session.sessionToken
    });

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      provider: user.provider
    };

    const handoffCode = await createOAuthHandoff({
      provider: 'github',
      session,
      user: userPayload
    });

    // Redirect with only an opaque one-time code; the frontend exchanges it
    // against the API host to set cookies reliably on localhost/127.0.0.1.
    const redirectUrl = new URL('/auth/callback', returnOrigin);
    redirectUrl.searchParams.set('code', handoffCode);

    res.redirect(redirectUrl.toString());
  } catch (err) {
    logger.error('GitHubAuth', 'Callback error', err);
    if (err.message === 'MAX_SESSIONS_EXCEEDED') {
      return redirectWithError(req, res, 'max_sessions_exceeded');
    }
    redirectWithError(req, res, 'provider_failed');
  }
});

export default router;

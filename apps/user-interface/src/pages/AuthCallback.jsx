import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { AlertTriangle, Cpu, ShieldCheck } from 'lucide-react';
import { Button } from '../features/shared/components/Button';

const errorCopy = {
  oauth_not_configured: 'OAuth is not configured on the server yet. Check the provider client ID, secret, and redirect URI.',
  invalid_state: 'The sign-in request expired or was blocked. Please start sign-in again.',
  missing_code: 'The provider did not return an authorization code. Please try again.',
  provider_failed: 'The provider rejected the sign-in request. Please verify the OAuth credentials.',
  profile_failed: 'We could not load your profile after sign-in. Please try again.',
  max_sessions_exceeded: 'Too many active sessions. Please log out from another device and try again.',
  database_error: 'Database connection failed. Please try again in a moment.',
  oauth_config_error: 'OAuth configuration error. Please check the redirect URI matches Google Console settings.',
};

function timeoutReject(message, ms) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * AuthCallback handles the OAuth redirect, relies on HttpOnly cookies, and restores profile state.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setUser = useStore(s => s.setUser);
  const fetchSettings = useStore(s => s.fetchSettings);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Securing your dashboard session...');
  const processedCodeRef = useRef(null);
  const timeoutRef = useRef(null);

  const providerError = useMemo(() => searchParams.get('error'), [searchParams]);

  useEffect(() => {
    let cancelled = false;

    timeoutRef.current = window.setTimeout(() => {
      if (!cancelled) {
        setStatus('error');
        setMessage('Authentication is taking longer than expected. Please try signing in again.');
      }
    }, 20000);

    async function resolveCookieSession() {
      setMessage('Verifying authentication status...');
      const session = await Promise.race([
        api.resolveSession(),
        timeoutReject('Status check timed out', 8000),
      ]);

      if (session?.authenticated && session.user) {
        return session.user;
      }

      return null;
    }

    async function finishWithUser(user) {
      if (cancelled) return;
      setUser(user);
      setStatus('success');
      setMessage('Session verified. Opening your dashboard...');

      fetchSettings?.().catch(err => {
        console.error('[AuthCallback] Failed to fetch settings:', err);
      });

      window.setTimeout(() => {
        if (!cancelled) navigate('/dashboard', { replace: true });
      }, 200);
    }

    async function completeAuth() {
      const handoffCode = searchParams.get('code');

      if (providerError) {
        api.clearAllTokens();
        setUser(null);
        setStatus('error');
        setMessage(errorCopy[providerError] || 'Authentication failed. Please try again.');
        return;
      }

      const accessToken = searchParams.get('token');
      if (accessToken) api.setAuthTokens({ accessToken }, { persist: false });

      try {
        let authenticatedUser = null;

        if (handoffCode && processedCodeRef.current !== handoffCode) {
          processedCodeRef.current = handoffCode;
          setMessage('Exchanging authentication code...');

          try {
            const exchange = await Promise.race([
              api.exchangeOAuthHandoff(handoffCode),
              timeoutReject('Authentication timed out', 10000),
            ]);

            if (exchange?.authenticated && exchange.user) {
              authenticatedUser = exchange.user;
            }
          } catch (exchangeError) {
            // The OAuth provider callback already creates HttpOnly cookies before
            // redirecting to the UI. If the opaque handoff is stale/consumed by a
            // duplicate render, recover from cookies instead of bouncing to login.
            console.warn('[AuthCallback] Handoff exchange failed; falling back to cookie session.', exchangeError);
          }
        }

        if (!authenticatedUser) {
          authenticatedUser = await resolveCookieSession();
        }

        if (!authenticatedUser) {
          throw new Error('No verified sign-in session was found. Please start sign-in again.');
        }

        await finishWithUser(authenticatedUser);
      } catch (err) {
        if (cancelled) return;
        console.error('Authentication error:', err);
        setUser(null);
        setStatus('error');
        setMessage(err.message || errorCopy.profile_failed);
      }
    }

    completeAuth();
    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [navigate, providerError, searchParams, setUser, fetchSettings]);

  const Icon = status === 'error' ? AlertTriangle : status === 'success' ? ShieldCheck : Cpu;

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface flex items-center justify-center px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className={`relative w-full max-w-md rounded-[2rem] border border-outline-variant/40 bg-surface-container-low/85 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl`}>
        <div className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border ${status === 'error' ? 'border-error/30 bg-error/10 text-error' : 'border-primary/30 bg-primary/10 text-primary'}`}>
          <Icon size={26} className={status === 'loading' ? 'animate-pulse' : ''} />
        </div>
        <p className="label-small mb-3 text-primary">OAuth Handshake</p>
        <h1 className="headline-medium mb-3">{status === 'error' ? 'Sign-in needs attention' : 'Authenticating'}</h1>
        <p className="body-medium text-on-surface-variant leading-relaxed">{message}</p>
        {status === 'error' && (
          <div className="mt-8 flex flex-col gap-3">
            <Button onClick={() => navigate('/login', { replace: true })} size="lg" className="w-full">Return to sign in</Button>
          </div>
        )}
      </div>
    </div>
  );
}

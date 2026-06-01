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

/**
 * AuthCallback handles the OAuth redirect, relies on HttpOnly cookies, and restores profile state.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setUser = useStore(s => s.setUser);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Securing your dashboard session...');
  const [isProcessing, setIsProcessing] = useState(false);
  const processedCodeRef = useRef(null);
  const timeoutRef = useRef(null);

  const providerError = useMemo(() => searchParams.get('error'), [searchParams]);

  useEffect(() => {
    let cancelled = false;

    // Timeout guard to prevent hanging callback screens
    timeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        setStatus('error');
        setMessage('Authentication is taking longer than expected. Please try signing in again.');
      }
    }, 15000); // 15 second timeout

    async function completeAuth() {
      // Prevent duplicate requests due to React StrictMode
      const handoffCode = searchParams.get('code');
      if (processedCodeRef.current === handoffCode) {
        return;
      }
      processedCodeRef.current = handoffCode;

      if (providerError) {
        api.clearAllTokens();
        setUser(null);
        setStatus('error');
        setMessage(errorCopy[providerError] || 'Authentication failed. Please try again.');
        return;
      }

      // Legacy callbacks may still include a short-lived access token.
      // It is accepted only in memory during migration; cookies are authoritative.
      const accessToken = searchParams.get('token');

      if (accessToken) api.setAuthTokens({ accessToken });

      try {
        let exchangedUser = null;
        if (handoffCode) {
          setMessage('Exchanging authentication code...');
          const exchange = await Promise.race([
            api.exchangeOAuthHandoff(handoffCode),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Authentication timed out')), 10000)
            )
          ]);
          if (cancelled) return;
          if (!exchange.authenticated || !exchange.user) {
            throw new Error('Sign-in handoff expired. Please start sign-in again.');
          }
          exchangedUser = exchange.user;
          setMessage('Authentication successful! Verifying session...');
        }

        // Skip additional authStatus check if we already have user data
        const finalUser = exchangedUser || null;
        if (finalUser) {
          setUser(finalUser);
          setStatus('success');
          setMessage('Session verified. Opening your dashboard...');
          window.setTimeout(() => navigate('/dashboard', { replace: true }), 350);
        } else {
          // Fallback to authStatus check
          setMessage('Verifying authentication status...');
          const userData = await Promise.race([
            api.resolveSession(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Status check timed out')), 5000)
            )
          ]);
          if (cancelled) return;

          if (!userData.authenticated) {
            throw new Error('No verified sign-in session was found. Please start sign-in again.');
          }

          setUser(userData.user);
          setStatus('success');
          setMessage('Session verified. Opening your dashboard...');
          window.setTimeout(() => navigate('/dashboard', { replace: true }), 350);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Authentication error:', err);
        api.clearAllTokens();
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
  }, [navigate, providerError, searchParams, setUser]);

  const Icon = status === 'error' ? AlertTriangle : status === 'success' ? ShieldCheck : Cpu;

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface flex items-center justify-center px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative w-full max-w-md rounded-[2rem] border border-outline-variant/40 bg-surface-container-low/85 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border ${status === 'error' ? 'border-error/30 bg-error/10 text-error' : 'border-primary/30 bg-primary/10 text-primary'}`}>
          <Icon size={26} className={status === 'loading' ? 'animate-pulse' : ''} />
        </div>
        <p className="label-small mb-3 text-primary">OAuth Handshake</p>
        <h1 className="headline-medium mb-3">{status === 'error' ? 'Sign-in needs attention' : 'Authenticating'}</h1>
        <p className="body-medium text-on-surface-variant leading-relaxed">{message}</p>
        {status === 'error' && (
          <div className="mt-8 flex flex-col gap-3">
            <Button onClick={() => navigate('/', { replace: true })} size="lg" className="w-full">Return to sign in</Button>
          </div>
        )}
      </div>
    </div>
  );
}

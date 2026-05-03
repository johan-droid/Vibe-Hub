import React, { useEffect, useMemo, useState } from 'react';
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
};

/**
 * AuthCallback handles the OAuth redirect, stores the JWT, and restores profile state.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setUser = useStore(s => s.setUser);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Securing your dashboard session...');

  const providerError = useMemo(() => searchParams.get('error'), [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      if (providerError) {
        api.clearToken();
        setUser(null);
        setStatus('error');
        setMessage(errorCopy[providerError] || 'Authentication failed. Please try again.');
        return;
      }

      const token = searchParams.get('token');
      if (!token) {
        api.clearToken();
        setUser(null);
        setStatus('error');
        setMessage('No session token was returned. Please start sign-in again.');
        return;
      }

      try {
        api.setToken(token);
        const user = await api.me();
        if (cancelled) return;
        setUser(user);
        setStatus('success');
        setMessage('Session verified. Opening your dashboard...');
        window.setTimeout(() => navigate('/dashboard', { replace: true }), 350);
      } catch (err) {
        if (cancelled) return;
        api.clearToken();
        setUser(null);
        setStatus('error');
        setMessage(err.message || errorCopy.profile_failed);
      }
    }

    completeAuth();
    return () => {
      cancelled = true;
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

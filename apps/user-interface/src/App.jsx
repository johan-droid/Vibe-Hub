import React, { useEffect, Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store/useStore';
import { api } from './services/api';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Workspace = lazy(() => import('./pages/Workspace'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

function App() {
  const { hydrated, user, setUser } = useStore();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (hydrated) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    async function restoreSession() {
      if (!api.hasToken() || user) {
        setAuthReady(true);
        return;
      }

      try {
        const profile = await api.me();
        if (!cancelled) setUser(profile);
      } catch (err) {
        api.clearToken();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [hydrated, user, setUser]);

  if (!hydrated || !authReady) {
    return (
      <div className="w-screen h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="h-11 w-11 rounded-2xl border border-outline-variant/40 bg-surface-container animate-pulse" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="w-screen h-screen bg-surface-container-lowest flex items-center justify-center animate-pulse" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Workspace />} />
          <Route path="/workspace" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

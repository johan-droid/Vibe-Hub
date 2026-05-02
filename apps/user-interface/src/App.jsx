import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store/useStore';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Workspace = lazy(() => import('./pages/Workspace'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

function App() {
  const { hydrated, theme } = useStore();

  useEffect(() => {
    if (hydrated) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, hydrated]);

  if (!hydrated) return null;

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="w-screen h-screen bg-surface-container-lowest flex items-center justify-center animate-pulse" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

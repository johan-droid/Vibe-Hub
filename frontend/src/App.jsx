/**
 * @fileoverview apps/user-interface/src/App.jsx
 * @module VibeHubFrontendApp
 * @description The root React component for the Vibe Hub User Interface.
 * Configures client-side routing (React Router), state management integration (Zustand),
 * physics-based animations (Framer Motion), and core visual themes.
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { useJobResumption } from './hooks/useJobResumption';
import { clearExpiredTier2, hasAcceptedTerms } from './utils/localStorage';
import { FullPageLoader } from './components/LogoLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api } from './services/api';
import { ThemeProvider } from "./context/ThemeContext";
import "./styles/globals.css";
import { SELINA_BRAND } from './brand/selina';

// ── Lazy Pages (Performance) ──────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const TermsAgreementPage = lazy(() => import('./pages/TermsAgreementPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// ── Premium Initialization Loader ──────────────────────────────────────────────
function LoadingScreen() {
  return <FullPageLoader text={SELINA_BRAND.productName} />;
}

function ProtectedDashboard({ user, authChecked, location }) {
  if (!authChecked) return <LoadingScreen />;
  return user ? <Dashboard /> : <Navigate to="/login" replace state={{ from: location }} />;
}

// ── Application Root ─────────────────────────────────────────────────────────
export default function App() {
  const { theme, hydrated, user, restorePanelStates, setUser } = useStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const location = useLocation();
  const termsAccepted = hasAcceptedTerms();

  // Initialize job resumption hook
  useJobResumption();

  useEffect(() => {
    // Initialize theme
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    
    // Clear expired Tier 2 localStorage items
    clearExpiredTier2();
    
    // Restore panel states from localStorage
    restorePanelStates();
    
  }, [theme, hydrated, restorePanelStates]);

  useEffect(() => {
    if (!hydrated) return undefined;

    if (location.pathname === '/auth/callback') {
      setAuthChecked(true);
      setIsInitializing(false);
      return undefined;
    }

    let cancelled = false;
    setAuthChecked(false);
    setIsInitializing(true);

    async function verifySession() {
      try {
        const profile = await api.resolveSession();
        if (cancelled) return;
        const authenticatedUser = profile.authenticated ? profile.user : null;
        setUser(authenticatedUser);
        
        // Fetch remote settings if authenticated
        if (authenticatedUser) {
          useStore.getState().fetchSettings().catch(err => {
            console.error('[App] Failed to fetch settings:', err);
          });
        }
      } catch {
        if (cancelled) return;
        setUser(null);
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
          window.setTimeout(() => setIsInitializing(false), 150);
        }
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [hydrated, location.pathname, setUser]);

  return (
    <AnimatePresence mode="wait">
      {(isInitializing || !hydrated || !authChecked) && location.pathname !== '/auth/callback' ? (
        <LoadingScreen key="loader" />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen w-screen overflow-x-hidden bg-surface-container-lowest text-on-surface"
        >
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/agreement" element={<TermsAgreementPage />} />
                <Route path="/login" element={termsAccepted ? <LoginPage /> : <Navigate to="/agreement" replace state={{ from: location }} />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route
                  path="/dashboard/*"
                  element={<ProtectedDashboard user={user} authChecked={authChecked} location={location} />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { useJobResumption } from './hooks/useJobResumption';
import { clearExpiredTier2 } from './utils/localStorage';
import { FullPageLoader } from './components/LogoLoader';

// ── Lazy Pages (Performance) ──────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Workspace = lazy(() => import('./pages/Workspace'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

// ── Premium Initialization Loader ──────────────────────────────────────────────
function LoadingScreen() {
  return <FullPageLoader text="Selina" />;
}

// ── Application Root ─────────────────────────────────────────────────────────
export default function App() {
  const { theme, hydrated, user, restorePanelStates } = useStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const location = useLocation();

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
    
    // Core Initialization Sequence
    const bootstrap = () => {
      // Wait for hydration and add a small delay for the premium feel
      if (hydrated) {
        setTimeout(() => setIsInitializing(false), 800);
      }
    };
    bootstrap();
  }, [theme, hydrated, restorePanelStates]);

  return (
    <AnimatePresence mode="wait">
      {(isInitializing || !hydrated) ? (
        <LoadingScreen key="loader" />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen w-screen overflow-x-hidden bg-surface-container-lowest text-on-surface"
        >
          <Suspense fallback={<LoadingScreen />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route 
                path="/dashboard/*" 
                element={(() => {
                  // Check localStorage for token as fallback
                  const hasToken = localStorage.getItem('selina_access_token') || localStorage.getItem('selina_token');
                  
                  // If we have user in state OR token in storage, show dashboard
                  if (user || hasToken) {
                    return <Workspace />;
                  }
                  
                  // Not authenticated - redirect to login
                  return <Navigate to="/login" replace />;
                })()} 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

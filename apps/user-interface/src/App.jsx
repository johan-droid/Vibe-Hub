import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain } from 'lucide-react';
import { useStore } from './store/useStore';

// ── Lazy Pages (Performance) ──────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Workspace = lazy(() => import('./pages/Workspace'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

// ── Premium Initialization Loader ──────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-surface-container-lowest selection:bg-primary/10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center relative z-10"
      >
        <div className="relative mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
            <Brain size={30} className="text-primary" />
          </div>
          <motion.div
            animate={{ opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-xl bg-primary blur-2xl"
          />
        </div>
        
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-black tracking-normal text-on-surface">Selina</h2>
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-normal text-on-surface-variant">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span>Preparing workspace</span>
          </div>
        </div>

        <div className="relative mt-10 h-1 w-64 overflow-hidden rounded-full bg-surface-container-high">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </motion.div>
    </div>
  );
}

// ── Application Root ─────────────────────────────────────────────────────────
export default function App() {
  const { theme, hydrated, user } = useStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Initialize theme
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    
    // Core Initialization Sequence
    const bootstrap = () => {
      // Wait for hydration and add a small delay for the premium feel
      if (hydrated) {
        setTimeout(() => setIsInitializing(false), 800);
      }
    };
    bootstrap();
  }, [theme, hydrated]);

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
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route 
                path="/dashboard/*" 
                element={user ? <Workspace /> : <Navigate to="/" replace />} 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

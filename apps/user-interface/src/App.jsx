import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, ShieldCheck } from 'lucide-react';
import { useStore } from './store/useStore';

// ── Lazy Pages (Performance) ──────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Workspace = lazy(() => import('./pages/Workspace'));

// ── Premium Initialization Loader ──────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#faf8f5] selection:bg-google-blue/10">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        <div className="relative mb-12">
          <div className="flex h-24 w-24 items-center justify-center rounded-[3rem] bg-white shadow-3xl shadow-black/[0.05] ring-1 ring-black/[0.03]">
            <Brain size={48} className="text-google-blue" />
          </div>
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-google-blue blur-[40px] rounded-full"
          />
        </div>
        
        <div className="text-center">
          <h2 className="text-3xl font-black text-on-surface tracking-tighter mb-4">Selina</h2>
          <div className="flex items-center gap-3 text-[10px] font-black text-google-blue uppercase tracking-[0.4em] opacity-40">
            <div className="h-1 w-1 rounded-full bg-google-blue animate-pulse" />
            <span>Establishing Secure Handshake</span>
          </div>
        </div>

        <div className="mt-16 w-64 h-1 bg-black/[0.03] rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-google-blue shadow-[0_0_12px_rgba(66,133,244,0.3)]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </motion.div>
    </div>
  );
}

// ── Application Root ─────────────────────────────────────────────────────────
export default function App() {
  const { theme, initialize, isHydrated, user } = useStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Initialize theme
    document.documentElement.classList.toggle('dark', theme === 'dark');
    
    // Core Initialization Sequence
    const bootstrap = async () => {
      await initialize();
      // Artificial delay for premium transition
      setTimeout(() => setIsInitializing(false), 2000);
    };
    bootstrap();
  }, [theme, initialize]);

  return (
    <AnimatePresence mode="wait">
      {(isInitializing || !isHydrated) ? (
        <LoadingScreen key="loader" />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="h-screen w-screen overflow-hidden bg-surface text-on-surface"
        >
          <Suspense fallback={<LoadingScreen />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<LandingPage />} />
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

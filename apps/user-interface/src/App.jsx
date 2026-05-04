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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#faf8f5] selection:bg-google-blue/10 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.08] mix-blend-overlay pointer-events-none" />
      <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-google-blue/5 blur-[100px] pointer-events-none" />
      <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-google-red/5 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center relative z-10"
      >
        <div className="relative mb-16">
          <div className="flex h-32 w-32 items-center justify-center rounded-[3.5rem] bg-white shadow-4xl shadow-black/[0.04] border border-black/[0.02]">
            <Brain size={64} className="text-google-blue transition-transform hover:scale-110" />
          </div>
          <motion.div
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-google-blue blur-[50px] rounded-full"
          />
        </div>
        
        <div className="text-center space-y-4">
          <h2 className="text-5xl font-black text-on-surface tracking-tighter">Selina</h2>
          <div className="flex items-center justify-center gap-4 text-[11px] font-black text-google-blue uppercase tracking-[0.6em] opacity-70">
            <div className="h-1.5 w-1.5 rounded-full bg-google-blue animate-pulse shadow-[0_0_8px_rgba(66,133,244,0.4)]" />
            <span>Establishing Secure Handshake</span>
          </div>
        </div>

        <div className="mt-20 w-80 h-1.5 bg-black/[0.03] rounded-full overflow-hidden relative">
          <motion.div 
            className="h-full bg-google-blue shadow-[0_0_15px_rgba(66,133,244,0.4)]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        
        <p className="mt-8 text-[10px] font-black text-on-surface-variant/20 uppercase tracking-[0.4em]">Intelligence Labs v4.1.2</p>
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
    
    // Core Initialization Sequence
    const bootstrap = () => {
      // Wait for hydration and add a small delay for the premium feel
      if (hydrated) {
        setTimeout(() => setIsInitializing(false), 2500);
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
          className="h-screen w-screen overflow-hidden bg-[#faf8f5] text-on-surface"
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

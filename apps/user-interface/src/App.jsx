import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store/useStore';
import LandingPage from './pages/LandingPage';
import Workspace from './pages/Workspace';
import AuthCallback from './pages/AuthCallback';

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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

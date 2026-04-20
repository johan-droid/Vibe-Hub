import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { Cpu } from 'lucide-react';

/**
 * AuthCallback — Handles the OAuth redirect.
 * Receives the JWT token from the backend and stores it.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setUser = useStore(s => s.setUser);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      api.setToken(token);
      
      // Fetch user profile
      api.me().then(user => {
        setUser(user);
        navigate('/workspace');
      }).catch(() => {
        navigate('/');
      });
    } else {
      navigate('/');
    }
  }, []);

  return (
    <div className="w-screen h-screen bg-surface-dim flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto animate-pulse">
          <Cpu size={24} className="text-white" />
        </div>
        <p className="text-white/40 text-sm font-medium">Authenticating...</p>
      </div>
    </div>
  );
}

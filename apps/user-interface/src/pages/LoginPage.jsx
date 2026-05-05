import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { 
  Github, 
  ArrowLeft, 
  ShieldCheck, 
  Brain
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';
import { useStore } from '../store/useStore';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.8, 
      ease: [0.22, 1, 0.36, 1] 
    } 
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const GoogleLoginButton = ({ onLoading }) => {
  const navigate = useNavigate();
  const setUser = useStore(state => state.setUser);

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      onLoading(true);
      try {
        const res = await api.post('/api/auth/google/verify-token', {
          access_token: tokenResponse.access_token
        }, { skipCsrf: true });

        if (res.success && res.token) {
          // Store tokens FIRST (synchronous localStorage)
          api.setAuthTokens({
            accessToken: res.token,
            refreshToken: res.refreshToken,
            sessionToken: res.sessionToken
          });
          
          // Store user in Zustand (triggers re-render)
          setUser(res.user);
          
          // Give store time to persist, then navigate
          await new Promise(resolve => setTimeout(resolve, 100));
          navigate('/dashboard', { replace: true });
        } else {
          alert('Login failed: ' + (res.error || 'Invalid response'));
        }
      } catch (err) {
        console.error('Login error:', err);
        alert('Login failed: ' + (err.message || 'Network error'));
      } finally {
        onLoading(false);
      }
    },
    onError: error => {
        // Google login error
      alert('Google login failed: ' + (error.error_description || error.error || 'Unknown error'));
    },
    onNonOAuthError: error => {
        // Google login popup error
      alert('Google login popup failed. Please check popup blocker settings.');
    }
  });

  const handleGoogleClick = () => {
    try {
      googleLogin();
      // Popup opened
    } catch (err) {
      // Failed to open login popup
      alert('Failed to open Google login. Please check if popups are blocked.');
    }
  };

  return (
    <Button
      onClick={handleGoogleClick}
      className="w-full h-14 rounded-xl bg-white text-gray-900 border border-outline-variant hover:bg-gray-100 hover:border-google-blue/40 shadow-sm transition-all duration-300"
      size="md"
    >
      <div className="flex items-center gap-3 w-full justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9105 17.5885 17.1586 16.3814 17.9729V20.9622H20.1509C22.3655 18.922 23.6514 15.8805 23.766 12.2764Z" fill="#4285F4"/>
          <path d="M12.24 24C15.486 24 18.2259 22.9247 20.1554 21.0639L16.3859 18.0746C15.3406 18.7845 14.0042 19.1979 12.2445 19.1979C9.10813 19.1979 6.44976 17.0784 5.49845 14.2255H1.60303V17.2435C3.60634 21.2335 7.73357 24 12.24 24Z" fill="#34A853"/>
          <path d="M5.49392 14.2255C5.24151 13.4735 5.10915 12.673 5.10915 11.8545C5.10915 11.036 5.24151 10.2355 5.49392 9.4835V6.46545H1.60303C0.75168 8.16364 0.259766 10.05 0.259766 11.8545C0.259766 13.6591 0.75168 15.5455 1.60303 17.2435L5.49392 14.2255Z" fill="#FBBC05"/>
          <path d="M12.24 4.80205C14.0087 4.80205 15.5833 5.40909 16.8378 6.59318L20.2414 3.18955C18.2169 1.29818 15.477 0.254545 12.24 0.254545C7.73357 0.254545 3.02102 3.02102 1.60303 7.01102L5.49392 10.0291C6.44523 7.17614 9.1036 4.80205 12.24 4.80205Z" fill="#EA4335"/>
        </svg>
        <span className="text-base font-bold">Continue with Google</span>
      </div>
    </Button>
  );
};

export default function LoginPage() {
  const navigate = useNavigate();
  const user = useStore(state => state.user);
  const [googleConfig, setGoogleConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [configError, setConfigError] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      // User already authenticated
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // Load Google OAuth configuration
    api.getGoogleConfig().then(config => {
      // Google config loaded successfully
      setGoogleConfig(config);
    }).catch(err => {
      // Failed to load Google config
      setConfigError(err.message);
    });
  }, []);

  const handleLogin = (provider) => {
    if (provider === 'google' && !googleConfig) {
      window.location.href = api.getGoogleAuthUrl();
    } else if (provider === 'github') {
      window.location.href = api.getGithubAuthUrl();
    }
  };

  const content = (
    <div className="min-h-screen w-screen overflow-hidden bg-surface text-on-surface relative flex items-center justify-center p-6 selection:bg-primary/20">
      {/* Background Refinements - Subtler */}
      <div className="absolute inset-0 bg-dot-pattern opacity-20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <motion.div 
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="relative z-10 w-full max-w-md"
      >
        <motion.button
          variants={fadeUp}
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 hover:text-primary transition-colors group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          Back to Home
        </motion.button>

        <motion.div 
          variants={fadeUp}
          className="panel p-8 md:p-10 relative overflow-hidden bg-surface-container-low/50 backdrop-blur-xl border border-outline-variant/30 shadow-2xl shadow-surface-container-lowest/10"
        >
          {/* Minimal accent line */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-google-blue via-google-red to-google-yellow opacity-60" />
          
          <div className="text-center mb-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-lg shadow-primary/20 mb-6">
              <Brain size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2 text-on-surface">Welcome back</h1>
            <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
              Sign in to your agentic workspace.
            </p>
          </div>

          <div className="space-y-4">
            {configError && (
              <div className="p-3 rounded-lg bg-error/10 text-error text-sm">
                Config error: {configError}
              </div>
            )}
            {googleConfig ? (
              <GoogleLoginButton onLoading={setIsLoading} />
            ) : (
              <Button
                onClick={() => handleLogin('google')}
                disabled={isLoading}
                className="w-full h-14 rounded-xl bg-white text-gray-900 border border-outline-variant hover:bg-gray-100 hover:border-google-blue/40 shadow-sm transition-all duration-300"
                size="md"
              >
                <div className="flex items-center gap-3 w-full justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9105 17.5885 17.1586 16.3814 17.9729V20.9622H20.1509C22.3655 18.922 23.6514 15.8805 23.766 12.2764Z" fill="#4285F4"/>
                    <path d="M12.24 24C15.486 24 18.2259 22.9247 20.1554 21.0639L16.3859 18.0746C15.3406 18.7845 14.0042 19.1979 12.2445 19.1979C9.10813 19.1979 6.44976 17.0784 5.49845 14.2255H1.60303V17.2435C3.60634 21.2335 7.73357 24 12.24 24Z" fill="#34A853"/>
                    <path d="M5.49392 14.2255C5.24151 13.4735 5.10915 12.673 5.10915 11.8545C5.10915 11.036 5.24151 10.2355 5.49392 9.4835V6.46545H1.60303C0.75168 8.16364 0.259766 10.05 0.259766 11.8545C0.259766 13.6591 0.75168 15.5455 1.60303 17.2435L5.49392 14.2255Z" fill="#FBBC05"/>
                    <path d="M12.24 4.80205C14.0087 4.80205 15.5833 5.40909 16.8378 6.59318L20.2414 3.18955C18.2169 1.29818 15.477 0.254545 12.24 0.254545C7.73357 0.254545 3.02102 3.02102 1.60303 7.01102L5.49392 10.0291C6.44523 7.17614 9.1036 4.80205 12.24 4.80205Z" fill="#EA4335"/>
                  </svg>
                  <span className="text-base font-bold">{isLoading ? 'Loading...' : 'Continue with Google'}</span>
                </div>
              </Button>
            )}

            <Button
              onClick={() => handleLogin('github')}
              className="w-full h-14 rounded-xl bg-[#24292F] text-white hover:bg-[#1a1e22] shadow-lg shadow-[#24292F]/10 transition-all duration-300"
              size="md"
              disabled={isLoading}
            >
              <div className="flex items-center gap-3 w-full justify-center">
                <Github size={20} />
                <span className="text-base font-bold">Continue with GitHub</span>
              </div>
            </Button>
          </div>

          <div className="mt-10 pt-6 border-t border-outline-variant/30 flex items-center justify-center">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
              <ShieldCheck size={12} className="text-google-green opacity-50" />
              Secure Environment
            </div>
          </div>
        </motion.div>

        <motion.p 
          variants={fadeUp}
          className="mt-6 text-center text-[11px] font-medium text-on-surface-variant/50"
        >
          By continuing, you agree to our <a href="#" className="text-on-surface hover:text-primary transition-colors">Terms</a> and <a href="#" className="text-on-surface hover:text-primary transition-colors">Privacy</a>.
        </motion.p>
      </motion.div>
    </div>
  );

  if (googleConfig) {
    return (
      <GoogleOAuthProvider clientId={googleConfig.clientId}>
        {content}
      </GoogleOAuthProvider>
    );
  }

  return content;
}

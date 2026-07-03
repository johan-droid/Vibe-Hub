import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, LockKeyhole } from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';
import { VibeLogoCompact } from '../components/VibeLogo';
import { SELINA_BRAND } from '../brand/selina';

function ProviderButton({ provider, loadingProvider, onClick, children }) {
  const isLoading = loadingProvider === provider;
  const isGoogle = provider === 'google';

  return (
    <Button
      onClick={() => onClick(provider)}
      disabled={Boolean(loadingProvider)}
      className={isGoogle
        ? 'h-12 w-full rounded-xl border border-outline-variant bg-white text-gray-900 hover:bg-gray-100'
        : 'h-12 w-full rounded-xl bg-[#24292F] text-white hover:bg-[#1a1e22]'}
      size="md"
    >
      <div className="flex w-full items-center justify-center gap-3">
        {isGoogle ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9105 17.5885 17.1586 16.3814 17.9729V20.9622H20.1509C22.3655 18.922 23.6514 15.8805 23.766 12.2764Z" fill="#4285F4" />
            <path d="M12.24 24C15.486 24 18.2259 22.9247 20.1554 21.0639L16.3859 18.0746C15.3406 18.7845 14.0042 19.1979 12.2445 19.1979C9.10813 19.1979 6.44976 17.0784 5.49845 14.2255H1.60303V17.2435C3.60634 21.2335 7.73357 24 12.24 24Z" fill="#34A853" />
            <path d="M5.49392 14.2255C5.24151 13.4735 5.10915 12.673 5.10915 11.8545C5.10915 11.036 5.24151 10.2355 5.49392 9.4835V6.46545H1.60303C0.75168 8.16364 0.259766 10.05 0.259766 11.8545C0.259766 13.6591 0.75168 15.5455 1.60303 17.2435L5.49392 14.2255Z" fill="#FBBC05" />
            <path d="M12.24 4.80205C14.0087 4.80205 15.5833 5.40909 16.8378 6.59318L20.2414 3.18955C18.2169 1.29818 15.477 0.254545 12.24 0.254545C7.73357 0.254545 3.02102 3.02102 1.60303 7.01102L5.49392 10.0291C6.44523 7.17614 9.1036 4.80205 12.24 4.80205Z" fill="#EA4335" />
          </svg>
        ) : (
          <Github size={20} />
        )}
        <span className="text-base font-bold">{isLoading ? `Opening ${children}...` : `Continue with ${children}`}</span>
      </div>
    </Button>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [loadingProvider, setLoadingProvider] = useState(null);

  const handleLogin = async (provider) => {
    if (loadingProvider) return;
    setLoadingProvider(provider);

    const authUrl = provider === 'google'
      ? api.getGoogleAuthUrl()
      : provider === 'github'
        ? api.getGithubAuthUrl()
        : null;

    if (!authUrl) {
      setLoadingProvider(null);
      return;
    }

    window.location.assign(authUrl);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-8 text-on-surface">
      <div className="w-full max-w-md rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-7 shadow-sm md:p-9">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/80 transition-colors hover:text-primary"
        >
          <ArrowLeft size={14} />
          Back to Home
        </button>

        <div className="mb-6 flex items-center gap-3">
          <VibeLogoCompact size={40} />
          <div>
            <p className="text-xl font-black tracking-tight text-on-surface">{SELINA_BRAND.productName}</p>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-on-surface-variant">{SELINA_BRAND.versionLabel}</p>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-on-surface">Sign in</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Choose a provider to continue to your workspace.
        </p>

        <div className="mt-6 space-y-3">
          <ProviderButton provider="google" loadingProvider={loadingProvider} onClick={handleLogin}>Google</ProviderButton>
          <ProviderButton provider="github" loadingProvider={loadingProvider} onClick={handleLogin}>GitHub</ProviderButton>
        </div>

        <p className="mt-6 flex items-center gap-2 text-xs text-on-surface-variant">
          <LockKeyhole size={14} />
          Session authentication is secured with HttpOnly cookies.
        </p>
      </div>
    </div>
  );
}

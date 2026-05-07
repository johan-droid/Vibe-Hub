import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Github,
  KeyRound,
  LockKeyhole,
  Scale,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';
import { useStore } from '../store/useStore';
import { VibeLogoCompact } from '../components/VibeLogo';
import { SELINA_BRAND } from '../brand/selina';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
    },
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

const trustItems = [
  {
    icon: LockKeyhole,
    title: 'Cookie-based session',
    text: 'Authentication is handled with HttpOnly cookies, not browser-stored access tokens.',
  },
  {
    icon: Server,
    title: 'Local Docker execution',
    text: 'Generated code execution remains on your local sandbox boundary.',
  },
  {
    icon: ClipboardCheck,
    title: 'Approval before risk',
    text: 'Write, execution, browser, GitHub, and MCP mutation tools pause for approval.',
  },
];

const termsItems = [
  'You confirm you own, control, or are authorized to access any workspace, repository, or file you connect to Selina.',
  'AI-generated code, plans, and reviews are assistance, not a substitute for human review before production use.',
  'Risky actions can create run artifacts, approval records, terminal logs, and audit events for safety and traceability.',
  'Local Docker sandbox commands may execute generated code after approval; do not place secrets in prompts, files, or tool inputs.',
  'Selina may store non-secret preferences and session metadata to secure the workspace and personalize the product experience.',
];

function ProviderButton({ provider, loadingProvider, disabled, onClick, children }) {
  const isGoogle = provider === 'google';
  const isLoading = loadingProvider === provider;

  return (
    <Button
      onClick={() => onClick(provider)}
      disabled={disabled}
      className={isGoogle
        ? 'h-14 w-full rounded-xl border border-outline-variant bg-white text-gray-900 shadow-sm transition-all duration-300 hover:border-google-blue/40 hover:bg-gray-100'
        : 'h-14 w-full rounded-xl bg-[#24292F] text-white shadow-lg shadow-[#24292F]/10 transition-all duration-300 hover:bg-[#1a1e22]'}
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
  const logout = useStore(state => state.logout);
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleLogin = async (provider) => {
    if (!acceptedTerms || loadingProvider) return;
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

    try {
      logout();
      await api.logout();
    } catch {
      api.clearAllTokens();
    } finally {
      window.location.assign(authUrl);
    }
  };

  const authDisabled = !acceptedTerms || Boolean(loadingProvider);

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-x-hidden bg-surface px-5 py-8 text-on-surface selection:bg-primary/20 md:px-8">
      <div className="absolute inset-0 bg-dot-pattern opacity-25 pointer-events-none" />

      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="relative z-10 w-full max-w-6xl"
      >
        <motion.button
          variants={fadeUp}
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70 transition-colors hover:text-primary"
        >
          <ArrowLeft size={14} />
          Back to Home
        </motion.button>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <motion.aside
            variants={fadeUp}
            className="rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-8 shadow-sm md:p-10"
          >
            <div className="mb-8 flex items-center gap-3">
              <VibeLogoCompact size={44} />
              <div>
                <p className="text-2xl font-black tracking-tight text-on-surface">{SELINA_BRAND.productName}</p>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">{SELINA_BRAND.versionLabel}</p>
              </div>
            </div>

            <p className="label-large mb-4 text-primary">Secure Sign In</p>
            <h1 className="mb-5 text-3xl font-black tracking-tight text-on-surface md:text-5xl">
              Enter your agentic workspace with guardrails on.
            </h1>
            <p className="mb-8 text-base font-medium leading-relaxed text-on-surface-variant">
              Selina is built for serious coding sessions: OAuth login, auditable runs, local execution boundaries, and approval-gated tools before anything risky happens.
            </p>

            <div className="space-y-4">
              {trustItems.map((item) => (
                <div key={item.title} className="flex gap-4 border-t border-outline-variant/30 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon size={19} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-on-surface">{item.title}</h2>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-on-surface-variant">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.aside>

          <motion.section
            variants={fadeUp}
            className="panel relative overflow-hidden border-outline-variant/40 bg-surface-container-lowest p-7 shadow-2xl shadow-surface-container-lowest/10 md:p-10"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#43F3C5] via-[#F7C35F] to-[#8DA2FF]" />

            <div className="mb-8 flex items-start justify-between gap-5">
              <div>
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-lg shadow-primary/20">
                  <Brain size={24} />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-on-surface">Sign in to Selina</h2>
                <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-on-surface-variant">
                  Choose your OAuth provider. Selina will refresh your workspace session through secure cookies.
                </p>
              </div>
              <div className="hidden rounded-full border border-google-green/20 bg-google-green/10 px-3 py-1.5 text-xs font-black text-google-green sm:inline-flex">
                OAuth only
              </div>
            </div>

            <div id="terms" className="border-y border-outline-variant/30 py-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-google-blue/10 text-google-blue">
                  <Scale size={19} />
                </div>
                <div>
                  <h3 className="text-base font-black text-on-surface">Terms and conditions</h3>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant/60">Last updated May 7, 2026</p>
                </div>
              </div>

              <ul className="space-y-3">
                {termsItems.map((item) => (
                  <li key={item} className="flex gap-3 text-sm font-medium leading-relaxed text-on-surface-variant">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <label className="mt-5 flex cursor-pointer gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 transition-colors hover:border-primary/40">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30"
                  aria-describedby="terms-help"
                />
                <span className="text-sm font-medium leading-relaxed text-on-surface-variant">
                  I have read and agree to Selina&apos;s Terms of Service, Privacy Notice, Security Policy, and local execution conditions.
                </span>
              </label>
              <p id="terms-help" className="mt-3 flex gap-2 text-xs font-medium leading-relaxed text-on-surface-variant/70">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Sign-in is disabled until this acknowledgement is checked.
              </p>
            </div>

            <div className="mt-7 space-y-4">
              <ProviderButton provider="google" loadingProvider={loadingProvider} disabled={authDisabled} onClick={handleLogin}>
                Google
              </ProviderButton>
              <ProviderButton provider="github" loadingProvider={loadingProvider} disabled={authDisabled} onClick={handleLogin}>
                GitHub
              </ProviderButton>
            </div>

            <div id="privacy" className="mt-8 grid gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5 sm:grid-cols-3">
              {[
                { icon: KeyRound, label: 'No password stored' },
                { icon: FileText, label: 'Audit trail enabled' },
                { icon: ShieldCheck, label: 'Risk tools gated' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-on-surface-variant">
                  <item.icon size={15} className="text-primary" />
                  {item.label}
                </div>
              ))}
            </div>

            <p id="security-notice" className="mt-6 text-center text-[11px] font-medium leading-relaxed text-on-surface-variant/60">
              These product terms summarize the in-app agreement for this MVP and should be reviewed by counsel before public commercial release.
            </p>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

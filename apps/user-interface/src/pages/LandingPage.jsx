import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Brain, CheckCircle2, Code2, Github, GitPullRequestArrow,
  Layers3, LockKeyhole, MessageSquare, Play, ShieldCheck, Sparkles, TerminalSquare, Zap
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';

const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.2, 0, 0, 1] } },
};

const errorCopy = {
  oauth_not_configured: 'OAuth is not configured on the server yet.',
  invalid_state: 'Your sign-in request expired. Please try again.',
  missing_code: 'The provider did not return a sign-in code.',
  provider_failed: 'The provider sign-in failed. Please verify credentials and try again.',
  profile_failed: 'We could not load your profile after sign-in.',
};

function AmbientBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-surface-container-lowest">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_32%),radial-gradient(circle_at_85%_18%,hsl(var(--secondary)/0.12),transparent_30%),linear-gradient(180deg,hsl(var(--surface-container-lowest)),hsl(var(--surface))_45%,hsl(var(--surface-container-lowest)))]" />
      <div className="absolute left-[8%] top-20 h-72 w-72 rounded-full bg-primary/10 blur-[120px] animate-drift" />
      <div className="absolute bottom-20 right-[10%] h-80 w-80 rounded-full bg-secondary/10 blur-[140px] animate-drift [animation-delay:3s]" />
      <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]" />
    </div>
  );
}

function ProductPreview() {
  const files = ['src/App.jsx', 'server/auth.js', 'workspace/theme.css'];
  return (
    <motion.div variants={fadeUp} className="relative mx-auto w-full max-w-6xl">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-primary/10 blur-3xl" />
      <div className="app-chrome relative overflow-hidden rounded-[2rem]">
        <div className="flex h-12 items-center justify-between border-b border-outline-variant/35 px-5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-error/70" />
            <span className="h-3 w-3 rounded-full bg-secondary/80" />
            <span className="h-3 w-3 rounded-full bg-tertiary/80" />
          </div>
          <div className="hidden rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-on-surface-variant sm:block">
            Vibe Hub Workspace
          </div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles size={14} />
            <span className="label-small">Live Agent</span>
          </div>
        </div>

        <div className="grid min-h-[520px] grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside className="hidden border-r border-outline-variant/30 bg-surface-container-low/70 p-4 md:block">
            <div className="mb-5 flex items-center justify-between">
              <span className="label-small text-on-surface-variant">Explorer</span>
              <GitPullRequestArrow size={14} className="text-tertiary" />
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={file} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${index === 0 ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'}`}>
                  <Code2 size={14} />
                  <span className="truncate">{file}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
              <p className="label-small mb-3 text-secondary">Swarm Queue</p>
              <div className="space-y-3 text-xs text-on-surface-variant">
                <div className="flex items-center justify-between"><span>Design audit</span><CheckCircle2 size={14} className="text-tertiary" /></div>
                <div className="flex items-center justify-between"><span>Auth restore</span><span className="h-2 w-2 rounded-full bg-primary animate-soft-pulse" /></div>
                <div className="flex items-center justify-between"><span>Build check</span><span className="h-2 w-2 rounded-full bg-outline" /></div>
              </div>
            </div>
          </aside>

          <main className="bg-surface-container-lowest/80 p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
              <div>
                <p className="label-small text-primary">Projection</p>
                <h3 className="title-small">OAuthCallback.jsx</h3>
              </div>
              <Button size="sm" variant="tonal" leadingIcon={Play}>Run check</Button>
            </div>
            <div className="rounded-2xl border border-outline-variant/30 bg-[#070b10]/90 p-5 font-mono text-[12px] leading-7 text-on-surface-variant shadow-inner">
              <p><span className="text-outline">01</span> <span className="text-tertiary">async</span> function restoreSession() {'{'}</p>
              <p><span className="text-outline">02</span>   <span className="text-secondary">const</span> token = api.getToken();</p>
              <p><span className="text-outline">03</span>   <span className="text-primary">if</span> (!token) return landing();</p>
              <p><span className="text-outline">04</span>   profile = <span className="text-tertiary">await</span> api.me();</p>
              <p><span className="text-outline">05</span>   openWorkspace(profile);</p>
              <p><span className="text-outline">06</span> {'}'}</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {['Lint clean', 'Build ready', 'OAuth guarded'].map((label) => (
                <div key={label} className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-4">
                  <CheckCircle2 size={18} className="mb-3 text-tertiary" />
                  <p className="label-small text-on-surface-variant">{label}</p>
                </div>
              ))}
            </div>
          </main>

          <aside className="border-t border-outline-variant/30 bg-surface-container-low/75 p-4 md:border-l md:border-t-0">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Brain size={20} /></div>
              <div>
                <p className="title-small">Selina</p>
                <p className="label-small text-primary">Ready</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-surface-container p-4 text-sm text-on-surface-variant">I can inspect, patch, test, and ship the workspace without making you babysit the repo.</div>
              <div className="ml-auto max-w-[85%] rounded-2xl bg-primary/15 p-4 text-sm text-on-surface">Fix auth and make this look premium.</div>
              <div className="rounded-2xl bg-surface-container p-4 text-sm text-on-surface-variant">Already on it. The interface deserves a tailored suit, not a glow-stick hoodie.</div>
            </div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useStore(s => s.user);
  const authError = searchParams.get('error');

  const handleLaunch = (provider = 'google') => {
    window.location.href = provider === 'github'
      ? api.getGithubAuthUrl()
      : api.getGoogleAuthUrl();
  };

  const openWorkspace = () => {
    navigate('/workspace');
  };

  const features = [
    { icon: Layers3, title: 'Workspace-first UI', desc: 'Editor, terminal, file tree, and chat stay composed under pressure.' },
    { icon: LockKeyhole, title: 'OAuth session guard', desc: 'Google and GitHub sign-in restore cleanly and expire safely.' },
    { icon: Zap, title: 'Agent orchestration', desc: 'A focused chat conduit routes plans, tool calls, and runtime feedback.' },
    { icon: ShieldCheck, title: 'Production checks', desc: 'Designed around lint, build, server validation, and backend tests.' },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface-container-lowest text-on-surface selection:bg-primary/20 selection:text-primary">
      <AmbientBackground />

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-outline-variant/30 bg-surface-container-lowest/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10">
              <Brain size={22} />
            </div>
            <div>
              <p className="title-small leading-none">Vibe Hub</p>
              <p className="label-small mt-1 text-primary/80">Agentic IDE</p>
            </div>
          </button>

          <div className="hidden items-center gap-8 md:flex">
            {['Preview', 'System', 'Security'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="label-small text-on-surface-variant transition hover:text-on-surface">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <Button variant="tonal" size="sm" onClick={openWorkspace}>Open workspace</Button>
            )}
            <Button variant="outlined" size="sm" leadingIcon={Github} className="hidden border-outline-variant/50 text-on-surface sm:flex" onClick={() => handleLaunch('github')}>GitHub</Button>
            <Button variant="filled" size="sm" leadingIcon={GoogleIcon} onClick={() => handleLaunch('google')}>Sign in</Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-40">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="mx-auto max-w-7xl">
            {authError && (
              <motion.div variants={fadeUp} className="mx-auto mb-8 max-w-3xl rounded-2xl border border-error/30 bg-error/10 px-5 py-4 text-sm text-on-error-container">
                {errorCopy[authError] || 'Authentication failed. Please try again.'}
              </motion.div>
            )}

            <div className="mx-auto max-w-4xl text-center">
              <motion.div variants={fadeUp} className="mb-7 inline-flex items-center gap-3 rounded-full border border-outline-variant/40 bg-surface-container-low/70 px-4 py-2 text-on-surface-variant shadow-xl shadow-black/20 backdrop-blur-xl">
                <span className="h-2 w-2 rounded-full bg-tertiary animate-soft-pulse" />
                <span className="label-small">Premium agent workspace</span>
              </motion.div>

              <motion.h1 variants={fadeUp} className="display-large mx-auto max-w-5xl leading-[0.92]">
                A sharper cockpit for serious agentic work.
              </motion.h1>

              <motion.p variants={fadeUp} className="mx-auto mt-7 max-w-2xl text-base leading-8 text-on-surface-variant md:text-lg">
                Vibe Hub brings coding agents, OAuth-secured sessions, file context, terminal feedback, and workspace orchestration into one calm, high-signal interface.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                {user && (
                  <Button size="lg" variant="tonal" trailingIcon={ArrowRight} onClick={openWorkspace} className="h-14 px-8">
                    Open workspace
                  </Button>
                )}
                <Button size="lg" leadingIcon={GoogleIcon} trailingIcon={ArrowRight} onClick={() => handleLaunch('google')} className="h-14 px-8">
                  Continue with Google
                </Button>
                <Button size="lg" variant="elevated" leadingIcon={Github} onClick={() => handleLaunch('github')} className="h-14 px-8 border border-outline-variant/40">
                  Continue with GitHub
                </Button>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-7 flex flex-wrap justify-center gap-3 text-xs text-on-surface-variant">
                {['No password layer', 'JWT session restore', 'Protected workspace'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low/60 px-3 py-1.5">
                    <CheckCircle2 size={13} className="text-tertiary" /> {item}
                  </span>
                ))}
              </motion.div>
            </div>

            <div id="preview" className="mt-20">
              <ProductPreview />
            </div>
          </motion.div>
        </section>

        <section id="system" className="px-5 py-20 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="label-small mb-4 text-primary">System Design</p>
                <h2 className="headline-large max-w-2xl">Premium where it matters: hierarchy, trust, speed.</h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-on-surface-variant">
                The new direction removes visual clutter while preserving a distinct technical identity: crisp panels, confident spacing, meaningful status, and calm motion.
              </p>
            </div>

            <div className="bento-grid">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06, duration: 0.5 }}
                  className="bento-card min-h-[220px]"
                >
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/35 bg-surface-container-high text-primary">
                    <feature.icon size={22} />
                  </div>
                  <h3 className="title-large mb-3">{feature.title}</h3>
                  <p className="text-sm leading-7 text-on-surface-variant">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="px-5 pb-24 md:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-outline-variant/35 bg-surface-container-low/75 p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
              <div>
                <p className="label-small mb-4 text-secondary">OAuth Repair</p>
                <h2 className="headline-large mb-4">Sign-in now has one source of truth.</h2>
                <p className="text-sm leading-7 text-on-surface-variant">
                  Frontend API URLs are centralized, token failures clear stale state, callback errors become readable UI, and backend redirects return to `UI_ORIGIN`.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {['Google OAuth', 'GitHub OAuth', 'Session restore', 'Protected route'].map((item) => (
                  <div key={item} className="rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
                    <ShieldCheck size={18} className="mb-3 text-tertiary" />
                    <p className="label-small text-on-surface-variant">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/30 px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-sm text-on-surface-variant md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Brain size={18} className="text-primary" />
            <span>Vibe Hub / Selina</span>
          </div>
          <div className="flex flex-wrap gap-5 label-small">
            <a href="#preview" className="hover:text-on-surface">Preview</a>
            <a href="#system" className="hover:text-on-surface">System</a>
            <a href="#security" className="hover:text-on-surface">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

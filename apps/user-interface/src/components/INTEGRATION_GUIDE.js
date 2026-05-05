/**
 * INTEGRATION GUIDE
 * 
 * This file shows practical examples of how to use the new animation
 * system in your Selina application.
 */

// ──────────────────────────────────────────────────────────────────────────
// 1. BASIC FULL-PAGE LOADER
// ──────────────────────────────────────────────────────────────────────────

import { FullPageLoader } from '@/components/index.animations';

// Use in App.jsx for initial loading
function App() {
  const [isLoading, setIsLoading] = useState(true);

  return isLoading ? (
    <FullPageLoader text="Selina" loadingVariant="power" />
  ) : (
    <MainApp />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2. SUSPENSE WITH LOADER
// ──────────────────────────────────────────────────────────────────────────

import { Suspense, lazy } from 'react';
import { FullPageLoader } from '@/components/index.animations';

const Dashboard = lazy(() => import('@/pages/Dashboard'));

function App() {
  return (
    <Suspense fallback={<FullPageLoader text="Loading Dashboard..." />}>
      <Dashboard />
    </Suspense>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3. PAGE HEADER WITH LOGO
// ──────────────────────────────────────────────────────────────────────────

import { ApplicationHeader } from '@/components/index.animations';

function MyPage() {
  return (
    <>
      <ApplicationHeader 
        title="Projects"
        showLogo={true}
        showBreadcrumb={true}
        breadcrumbItems={['Home', 'Projects']}
      />
      <main className="p-6">
        {/* Page content */}
      </main>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4. INLINE LOADING SPINNER
// ──────────────────────────────────────────────────────────────────────────

import { LogoSpinner } from '@/components/index.animations';

function DataList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => {
    setLoading(true);
    // Fetch data
    setTimeout(() => {
      setData([...]);
      setLoading(false);
    }, 2000);
  }, []);

  return (
    <div>
      {loading ? (
        <div className="flex justify-center p-8">
          <LogoSpinner size={40} />
        </div>
      ) : (
        <ul>
          {data.map(item => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 5. CUSTOM LOADING STATES WITH TEXT ANIMATIONS
// ──────────────────────────────────────────────────────────────────────────

import { 
  PowerString, 
  WaveText, 
  PulsingWords 
} from '@/components/index.animations';

function ProcessingPage() {
  const [step, setStep] = useState(0);

  return (
    <div className="space-y-8">
      {step === 0 && <PowerString baseText="Initializing" />}
      {step === 1 && <WaveText text="Processing..." className="text-2xl font-bold" />}
      {step === 2 && <PulsingWords words={['Finalizing', 'Optimizing', 'Preparing']} />}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 6. LOGO IN NAVIGATION
// ──────────────────────────────────────────────────────────────────────────

import { VibeLogoCompact } from '@/components/index.animations';

function Navigation() {
  return (
    <nav className="bg-slate-900 border-b border-purple-400/20 px-6 py-4 flex items-center gap-4">
      <VibeLogoCompact size={40} />
      <h1 className="text-xl font-bold text-white">Selina</h1>
      {/* Other nav items */}
    </nav>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 7. HERO SECTION WITH LARGE LOGO
// ──────────────────────────────────────────────────────────────────────────

import { VibeLargeLogo } from '@/components/index.animations';

function LandingHero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-purple-900">
      <VibeLargeLogo showAnimated={true} />
      <h1 className="text-4xl font-bold text-white mt-8">Welcome to Selina</h1>
      <p className="text-gray-300 mt-4">Create amazing things</p>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 8. MULTIPLE LOADING VARIANTS
// ──────────────────────────────────────────────────────────────────────────

import { FullPageLoader } from '@/components/index.animations';

// Different variants for different scenarios
export const LoadingScenarios = {
  initial: <FullPageLoader text="Selina" loadingVariant="power" />,
  dashboard: <FullPageLoader text="Loading Dashboard" loadingVariant="wave" />,
  processing: <FullPageLoader text="Processing" loadingVariant="pulse" />,
};

// Use in your app
function App() {
  const [loadingType, setLoadingType] = useState('initial');

  return LoadingScenarios[loadingType];
}

// ──────────────────────────────────────────────────────────────────────────
// 9. ANIMATION WITH CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────

import { animationConfig } from '@/components/animationConfig';

function CustomLoadingPage() {
  const { colors, durations } = animationConfig;

  return (
    <div
      style={{
        background: `radial-gradient(circle, ${colors.primary}, ${colors.darkBg})`,
      }}
      className="min-h-screen flex items-center justify-center"
    >
      {/* Content */}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 10. ASYNC DATA LOADING WITH LOADER
// ──────────────────────────────────────────────────────────────────────────

import { FullPageLoader, LogoSpinner } from '@/components/index.animations';

function DataFetcher() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    // Fetch data
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setState('success');
      })
      .catch(err => {
        setState('error');
      });
  }, []);

  if (state === 'loading') {
    return <FullPageLoader text="Loading Data..." loadingVariant="power" />;
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500">Error Loading Data</h1>
        <button className="mt-4 px-6 py-2 bg-primary rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Display data */}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 11. MODAL WITH LOADING STATE
// ──────────────────────────────────────────────────────────────────────────

import { LogoSpinner } from '@/components/index.animations';

function UploadModal() {
  const [uploading, setUploading] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 max-w-md">
        {uploading ? (
          <div className="flex flex-col items-center">
            <LogoSpinner size={48} />
            <p className="mt-4 text-gray-700">Uploading your file...</p>
          </div>
        ) : (
          <form>
            {/* Form content */}
          </form>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 12. THEMED WRAPPER COMPONENT
// ──────────────────────────────────────────────────────────────────────────

import { ApplicationHeader, ApplicationFooter } from '@/components/index.animations';

function ThemedPage({ children, title, breadcrumb }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900">
      <ApplicationHeader 
        title={title}
        showLogo={true}
        breadcrumbItems={breadcrumb}
      />
      
      <main className="flex-1 p-6">
        {children}
      </main>
      
      <ApplicationFooter />
    </div>
  );
}

// Usage
function MyPage() {
  return (
    <ThemedPage 
      title="My Page"
      breadcrumb={['Home', 'My Page']}
    >
      <div>Page content here</div>
    </ThemedPage>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MIGRATION CHECKLIST
// ──────────────────────────────────────────────────────────────────────────

/*
Steps to integrate animations into your app:

1. ✓ Import components from '@/components/index.animations'
2. ✓ Replace existing loaders with FullPageLoader
3. ✓ Add ApplicationHeader to pages that need branding
4. ✓ Update Suspense fallbacks with FullPageLoader
5. ✓ Use LogoSpinner for inline loading states
6. ✓ Apply text animations where appropriate
7. ✓ Customize colors in animationConfig.js
8. ✓ Test on different screen sizes
9. ✓ Verify animation performance
10. ✓ Deploy and monitor

For any issues, refer to ANIMATIONS.md documentation.
*/

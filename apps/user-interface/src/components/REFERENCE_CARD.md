# 📋 Animation Components - Reference Card

## Logo Components

### VibeLogo (Static)
```jsx
import { VibeLogo } from '@/components/index.animations';

<VibeLogo size={64} />                    // 24px to 200px
<VibeLogo size={64} animated={true} />    // With animation
<VibeLogo size={64} className="opacity-70" />
```

### AnimatedVibeLogo (Entry + Float)
```jsx
import { AnimatedVibeLogo } from '@/components/index.animations';

<AnimatedVibeLogo size={120} showGlow={true} />
<AnimatedVibeLogo size={80} showGlow={false} />
```

### VibeLogoCompact (Header Size)
```jsx
import { VibeLogoCompact } from '@/components/index.animations';

<VibeLogoCompact size={40} />  // 24-48px recommended
```

### VibeLargeLogo (Hero)
```jsx
import { VibeLargeLogo } from '@/components/index.animations';

<VibeLargeLogo showAnimated={true} />
```

---

## Loading Components

### FullPageLoader (Complete Screen)
```jsx
import { FullPageLoader } from '@/components/index.animations';

<FullPageLoader text="Selina" loadingVariant="power" showBackgroundPattern={true} />
```

**loadingVariant options:**
- `'power'` - Sequential dots with power aura
- `'wave'` - Characters wave
- `'pulse'` - Words pulse

### LogoLoader (Embedded)
```jsx
import { LogoLoader } from '@/components/index.animations';

<LogoLoader size={140} text="Loading..." loadingVariant="power" showText={true} />
```

### LogoSpinner (Inline)
```jsx
import { LogoSpinner } from '@/components/index.animations';

<LogoSpinner size={32} className="text-primary" />
```

---

## Text Animation Components

### PowerString (Dots)
```jsx
import { PowerString } from '@/components/index.animations';

<PowerString baseText="Loading" />
<PowerString baseText="Processing" dotCount={4} />
```
Output: `Loading . → .. → ... `

### WaveText (Wave Effect)
```jsx
import { WaveText } from '@/components/index.animations';

<WaveText text="Loading..." className="text-lg font-bold" />
<WaveText text="Hello" waveHeight={30} />
```

### PulsingWords (Cycle)
```jsx
import { PulsingWords } from '@/components/index.animations';

<PulsingWords words={['Loading', 'Processing', 'Preparing']} />
<PulsingWords words={['...', '⟳', '◌']} />
```

### TypingText (Typing Effect)
```jsx
import { TypingText } from '@/components/index.animations';

<TypingText text="Power String Loading..." cursorVisible={true} />
<TypingText text="Hello World" cursorVisible={false} />
```

### RevealText (Character Reveal)
```jsx
import { RevealText } from '@/components/index.animations';

<RevealText text="Welcome" stagger={0.05} />
<RevealText text="Hello" duration={0.3} delay={0.5} />
```

### GlitchText (Glitch Effect)
```jsx
import { GlitchText } from '@/components/index.animations';

<GlitchText text="Selina" />
<GlitchText text="Error" className="text-red-500" />
```

### ShimmerText (Shimmer)
```jsx
import { ShimmerText } from '@/components/index.animations';

<ShimmerText text="Power Loading..." />
<ShimmerText text="Processing" className="text-lg" />
```

### BounceText (Bounce)
```jsx
import { BounceText } from '@/components/index.animations';

<BounceText text="Selina" />
<BounceText text="Hello World" className="text-2xl font-bold" />
```

### GradientPulseText (Gradient)
```jsx
import { GradientPulseText } from '@/components/index.animations';

<GradientPulseText text="Power Loading" />
<GradientPulseText text="Vibe" className="text-3xl" />
```

### LoadingStatus (Auto-Select)
```jsx
import { LoadingStatus } from '@/components/index.animations';

<LoadingStatus variant="power" />
<LoadingStatus variant="wave" />
<LoadingStatus variant="pulse" />
<LoadingStatus variant="typing" />
```

---

## Layout Components

### ApplicationHeader
```jsx
import { ApplicationHeader } from '@/components/index.animations';

<ApplicationHeader title="My Page" showLogo={true} />

<ApplicationHeader 
  title="Dashboard"
  showLogo={true}
  showBreadcrumb={true}
  breadcrumbItems={['Home', 'Dashboard']}
/>
```

### ApplicationFooter
```jsx
import { ApplicationFooter } from '@/components/index.animations';

<ApplicationFooter />
```

---

## Configuration

### Colors
```javascript
import { animationConfig } from '@/components/animationConfig';

const { colors } = animationConfig;
// colors.primary - rgb(168, 85, 247)
// colors.secondary - rgb(236, 72, 153)
// colors.accent - rgb(59, 130, 246)
```

### Size Presets
```javascript
const { sizes } = animationConfig;

sizes.logo.compact    // 24px
sizes.logo.small      // 40px
sizes.logo.medium     // 64px
sizes.logo.large      // 120px
sizes.logo.hero       // 200px
```

### Animation Durations
```javascript
const { durations } = animationConfig;

durations.logoEntry    // 1.2s
durations.logoFloat    // 4s
durations.textReveal   // 0.5s
durations.powerDot     // 0.4s
```

---

## Common Patterns

### Suspense with Loader
```jsx
<Suspense fallback={<FullPageLoader text="Loading..." />}>
  <Component />
</Suspense>
```

### Conditional Loader
```jsx
{isLoading ? (
  <FullPageLoader text="Please wait..." loadingVariant="power" />
) : (
  <Content />
)}
```

### Header + Content + Footer
```jsx
<>
  <ApplicationHeader title="Page" showLogo={true} />
  <main>{children}</main>
  <ApplicationFooter />
</>
```

### Multiple Loaders
```jsx
{step === 1 && <PowerString baseText="Step 1" />}
{step === 2 && <WaveText text="Step 2" />}
{step === 3 && <PulsingWords words={['Step', '3', '...']} />}
```

---

## Import All at Once
```jsx
import {
  // Logos
  VibeLogo,
  AnimatedVibeLogo,
  VibeLogoCompact,
  VibeLargeLogo,
  
  // Loaders
  LogoLoader,
  LogoSpinner,
  FullPageLoader,
  
  // Text
  PowerString,
  WaveText,
  PulsingWords,
  TypingText,
  RevealText,
  GlitchText,
  ShimmerText,
  BounceText,
  GradientPulseText,
  LoadingStatus,
  
  // Layout
  ApplicationHeader,
  ApplicationFooter,
  
  // Config
  animationConfig,
} from '@/components/index.animations';
```

---

## Quick Props Table

| Component | Main Props | Default |
|-----------|-----------|---------|
| VibeLogo | size, animated, className | 64, false, '' |
| FullPageLoader | text, loadingVariant, showBackgroundPattern | 'Selina', 'power', true |
| LogoSpinner | size, className | 32, '' |
| PowerString | baseText, dotCount | 'Loading', 3 |
| WaveText | text, waveHeight, className | 'Loading', 20, '' |
| ApplicationHeader | title, showLogo, breadcrumbItems | 'Selina', true, [] |

---

## Color Palette

```
Primary:   rgb(168, 85, 247)  - Purple
Secondary: rgb(236, 72, 153)  - Pink
Accent:    rgb(59, 130, 246)  - Blue
Dark BG:   #0f172a            - Slate 900
Purple BG: #2e1065            - Purple 900
```

---

**For detailed documentation, see:**
- 📚 `ANIMATIONS.md` - Complete API reference
- 💡 `QUICK_START.md` - Quick start guide
- 🔧 `INTEGRATION_GUIDE.js` - Code examples
- ⚙️ `animationConfig.js` - Configuration options

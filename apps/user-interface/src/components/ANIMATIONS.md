# Selina Animation System

## Overview

The Selina Animation System provides a complete set of components for implementing the new logo design and powerful loading animations throughout the application. This system features:

- **New Vibe Logo Design** - Purple-themed rounded geometric shapes matching the brand
- **Multiple String Animations** - Text animations for dynamic loading states
- **Full-Page Loaders** - Professional loading screens with gradient backgrounds
- **Header & Footer Components** - Consistent branding across pages
- **Reusable Text Animations** - Character reveals, typing effects, pulsing words, and more

## Quick Start

### 1. Import Components

```javascript
import {
  VibeLogo,
  AnimatedVibeLogo,
  FullPageLoader,
  LogoLoader,
  LogoSpinner,
  PowerString,
  WaveText,
  ApplicationHeader,
} from '@/components/index.animations';
```

### 2. Use in Your App

#### Full Page Loading Screen
```jsx
<FullPageLoader 
  text="Selina"
  loadingVariant="power"  // 'power', 'wave', 'pulse'
  showBackgroundPattern={true}
/>
```

#### Logo in Header
```jsx
<ApplicationHeader 
  title="My Page"
  showLogo={true}
/>
```

#### Loading Status Text
```jsx
<PowerString baseText="Processing" />
```

## Components Reference

### Logo Components

#### `VibeLogo`
Static logo mark for headers and navigation.

```jsx
<VibeLogo size={64} />
```

**Props:**
- `size` (number) - Size in pixels (default: 64)
- `animated` (boolean) - Enable animation (default: false)
- `className` (string) - Additional CSS classes

#### `AnimatedVibeLogo`
Logo with animated entry and floating effects.

```jsx
<AnimatedVibeLogo size={120} showGlow={true} />
```

**Props:**
- `size` (number) - Size in pixels (default: 120)
- `showGlow` (boolean) - Show glowing effect (default: true)
- `className` (string) - Additional CSS classes

#### `VibeLogoCompact`
Small logo for headers and compact spaces.

```jsx
<VibeLogoCompact size={40} />
```

#### `VibeLargeLogo`
Large hero logo for landing pages.

```jsx
<VibeLargeLogo showAnimated={true} />
```

### Loading Components

#### `FullPageLoader`
Complete full-screen loading experience with background animation.

```jsx
<FullPageLoader 
  text="Selina"
  loadingVariant="power"
  showBackgroundPattern={true}
/>
```

**Props:**
- `text` (string) - Text to display (default: "Selina")
- `loadingVariant` (string) - Animation style: 'power', 'wave', 'pulse' (default: 'power')
- `showBackgroundPattern` (boolean) - Show animated background (default: true)

#### `LogoLoader`
Logo with loading animation (used inside FullPageLoader).

```jsx
<LogoLoader 
  size={140}
  text="Selina"
  loadingVariant="power"
  showText={true}
/>
```

#### `LogoSpinner`
Minimal spinning logo for inline loading states.

```jsx
<LogoSpinner size={32} />
```

### String Animation Components

#### `PowerString`
Sequential loading animation with dots.

```jsx
<PowerString baseText="Power Loading" />
```

Output: `Power Loading . → Power Loading .. → Power Loading ...`

#### `WaveText`
Characters wave up and down.

```jsx
<WaveText text="Loading..." />
```

#### `PulsingWords`
Cycles through words with fade animation.

```jsx
<PulsingWords words={['Loading', 'Initializing', 'Preparing']} />
```

#### `TypingText`
Simulates typing with cursor.

```jsx
<TypingText text="Power String Loading..." cursorVisible={true} />
```

#### `RevealText`
Characters reveal one by one.

```jsx
<RevealText text="Welcome" stagger={0.05} />
```

#### `GlitchText`
Glitch effect with color shifts.

```jsx
<GlitchText text="Selina" />
```

#### `ShimmerText`
Gradient shimmer across text.

```jsx
<ShimmerText text="Power Loading..." />
```

#### `BounceText`
Characters bounce with spring physics.

```jsx
<BounceText text="Selina" />
```

#### `GradientPulseText`
Color gradient pulses through text.

```jsx
<GradientPulseText text="Power Loading" />
```

#### `LoadingStatus`
Combines multiple animation styles.

```jsx
<LoadingStatus variant="power" />
```

**Variants:** 'power', 'typing', 'pulse', 'wave'

### Layout Components

#### `ApplicationHeader`
Header with logo and branding.

```jsx
<ApplicationHeader 
  title="Selina"
  showLogo={true}
  showBreadcrumb={true}
  breadcrumbItems={['Home', 'Dashboard']}
/>
```

**Props:**
- `showLogo` (boolean) - Show logo (default: true)
- `title` (string) - Header title (default: "Selina")
- `className` (string) - Additional CSS classes
- `showBreadcrumb` (boolean) - Show breadcrumb navigation
- `breadcrumbItems` (array) - Breadcrumb items

#### `ApplicationFooter`
Footer with branding.

```jsx
<ApplicationFooter />
```

## Color Theme

The animation system uses a purple gradient theme:

- **Primary Purple**: `rgb(168, 85, 247)`
- **Secondary Pink**: `rgb(236, 72, 153)`
- **Background**: Gradient from slate-900 through purple-900

The colors are designed to work with Tailwind CSS and can be customized through your `tailwind.config.js`.

## Animation Variants

### Loading Variants

- **power** - Sequential loading dots with power effect
- **wave** - Text waves up and down
- **pulse** - Words cycle through with fade effect

### Background Patterns

- Animated floating orbs with blur effect
- Grid pattern overlay for depth
- Gradient overlays for visual hierarchy

## Integration Examples

### App.jsx Integration

```jsx
import { FullPageLoader } from '@/components/index.animations';
import { Suspense, lazy } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <Suspense fallback={<FullPageLoader text="Loading..." />}>
      <Dashboard />
    </Suspense>
  );
}
```

### Page Header with Logo

```jsx
import { ApplicationHeader } from '@/components/index.animations';

function MyPage() {
  return (
    <>
      <ApplicationHeader 
        title="My Project"
        showLogo={true}
        breadcrumbItems={['Projects', 'My Project']}
      />
      {/* Page content */}
    </>
  );
}
```

### Inline Loading

```jsx
import { LogoSpinner } from '@/components/index.animations';

function DataList() {
  const [loading, setLoading] = useState(false);

  return (
    <>
      {loading && <LogoSpinner size={32} />}
      {/* List content */}
    </>
  );
}
```

## Performance Tips

1. **Use `Suspense` Boundaries** - Wrap lazy components with Suspense for optimal loading experience
2. **Lazy Load Heavy Animations** - Don't show animations on pages with heavy content
3. **Use Static Logo When Possible** - Animated logos have performance overhead
4. **Disable Background Pattern on Mobile** - For better performance on smaller devices:

```jsx
<FullPageLoader 
  showBackgroundPattern={window.innerWidth > 768}
/>
```

## Customization

### Custom Color Scheme

Edit the color values in component files (RGB values):

```javascript
// In VibeLogo.jsx or StringAnimations.jsx
style={{
  background: 'radial-gradient(circle, rgba(YOUR_R, YOUR_G, YOUR_B, 0.4) 0%, transparent 70%)',
}}
```

### Custom Animation Durations

Modify transition durations in the component definitions:

```javascript
animate={{ scale: [1, 1.15, 1] }}
transition={{
  duration: 3,  // Change this value
  repeat: Infinity,
  ease: "easeInOut",
}}
```

### Custom Logo Size

Pass different size values to logo components:

```jsx
// Small (header): 24-40px
// Medium (body): 64-120px
// Large (hero): 160-200px
<VibeLogo size={96} />
```

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

Animations use CSS transforms and GPU acceleration for smooth 60fps performance.

## Troubleshooting

### Animations Not Showing

1. Ensure `framer-motion` is installed: `npm install framer-motion`
2. Check that components are imported from `index.animations.js`
3. Verify Tailwind CSS is configured

### Performance Issues

1. Reduce animation duration for lower-end devices
2. Disable background patterns
3. Use static logo instead of animated variant
4. Check browser DevTools for rendering issues

### Color Not Matching Brand

Edit the RGB values in component styles to match your brand:

```javascript
// Purple: 168, 85, 247
// Pink: 236, 72, 153
// Custom: Adjust these values
```

## API Reference

All components export from `@/components/index.animations`:

```javascript
// Export list
export {
  VibeLogo,
  AnimatedVibeLogo,
  VibeLogoCompact,
  VibeLargeLogo,
  LogoLoader,
  LogoSpinner,
  FullPageLoader,
  RevealText,
  TypingText,
  PulsingWords,
  GlitchText,
  PowerString,
  ShimmerText,
  WaveText,
  BounceText,
  GradientPulseText,
  LoadingStatus,
  ApplicationHeader,
  ApplicationFooter,
}
```

## Support

For issues or feature requests, refer to the main Selina documentation or create an issue in the repository.

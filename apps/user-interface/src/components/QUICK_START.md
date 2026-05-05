# 🚀 Quick Start Guide - Selina Animations

## 30-Second Setup

### 1. Copy This Import
```javascript
import { FullPageLoader } from '@/components/index.animations';
```

### 2. Use in App.jsx
```jsx
<Suspense fallback={<FullPageLoader text="Selina" loadingVariant="power" />}>
  <Routes>
    {/* Your routes */}
  </Routes>
</Suspense>
```

**Done!** You now have animated loading screens. 🎉

---

## Common Use Cases

### Add Logo to Header
```jsx
import { ApplicationHeader } from '@/components/index.animations';

<ApplicationHeader title="My Page" showLogo={true} />
```

### Show Loading Status
```jsx
import { PowerString } from '@/components/index.animations';

<PowerString baseText="Processing" />
```

### Inline Loading Spinner
```jsx
import { LogoSpinner } from '@/components/index.animations';

{isLoading && <LogoSpinner size={32} />}
```

### Large Logo (Hero)
```jsx
import { VibeLargeLogo } from '@/components/index.animations';

<VibeLargeLogo showAnimated={true} />
```

---

## 3 Loading Variants

Pick your favorite:

```jsx
// Power - Sequential dots with aura effect
<FullPageLoader loadingVariant="power" />

// Wave - Characters wave up and down
<FullPageLoader loadingVariant="wave" />

// Pulse - Words cycle with fade
<FullPageLoader loadingVariant="pulse" />
```

---

## Text Animation Options

```jsx
import { 
  PowerString,       // Loading dots
  WaveText,          // Wavy text
  PulsingWords,      // Cycling words
  GlitchText,        // Glitch effect
  TypingText,        // Typing effect
  BounceText,        // Bouncing letters
  ShimmerText,       // Shimmer effect
  GradientPulseText, // Gradient pulse
  RevealText,        // Reveal one by one
} from '@/components/index.animations';

// Use any:
<PowerString baseText="Loading" />
<WaveText text="Processing..." />
<TypingText text="Please wait..." />
```

---

## Customize Colors

Edit `animationConfig.js`:

```javascript
export const animationColors = {
  primary: 'rgb(168, 85, 247)',    // Change these RGB values
  secondary: 'rgb(236, 72, 153)',
  // Add your brand colors
};
```

---

## All Available Components

| Component | Use Case |
|-----------|----------|
| `FullPageLoader` | Full-screen loading |
| `LogoLoader` | Embedded loader |
| `LogoSpinner` | Inline spinner |
| `VibeLogo` | Static logo |
| `AnimatedVibeLogo` | Animated logo |
| `ApplicationHeader` | Header with logo |
| `ApplicationFooter` | Footer branding |
| `PowerString` | Loading text |
| `WaveText` | Wave animation |
| `PulsingWords` | Word cycling |
| `GlitchText` | Glitch effect |
| `TypingText` | Typing effect |

---

## Performance Tips

❌ **Don't:**
```jsx
// This is slow:
<FullPageLoader showBackgroundPattern={true} />  // On every load

// Too many animations:
<div>
  <GlitchText />
  <WaveText />
  <PowerString />
</div>
```

✅ **Do:**
```jsx
// Show pattern only once:
{isInitialLoad && <FullPageLoader showBackgroundPattern={true} />}

// Pick one animation:
<PowerString baseText="Loading" />
```

---

## Next Steps

1. **Try the Demo**
   - Import `AnimationShowcase` in a route
   - See all animations in action

2. **Read Full Docs**
   - `ANIMATIONS.md` - Complete reference
   - `INTEGRATION_GUIDE.js` - 12 examples
   - `animationConfig.js` - All customization options

3. **Integrate into Your Pages**
   - Replace existing loaders
   - Add headers with branding
   - Use text animations

---

## File Locations

```
apps/user-interface/src/components/
├── VibeLogo.jsx              ← Logo components
├── StringAnimations.jsx      ← Text animations
├── LogoLoader.jsx            ← Loaders
├── ApplicationHeader.jsx     ← Header/Footer
├── animationConfig.js        ← Configuration
├── ANIMATIONS.md             ← Full docs
├── INTEGRATION_GUIDE.js      ← Examples
└── IMPLEMENTATION_SUMMARY.md ← Overview
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Colors look wrong | Edit `animationConfig.js` RGB values |
| Animations stuttering | Disable `showBackgroundPattern` |
| Component not found | Ensure import from `index.animations` |
| Too slow | Reduce animation duration in config |

---

## Questions?

Refer to:
- 📚 `ANIMATIONS.md` - Complete API
- 💡 `INTEGRATION_GUIDE.js` - Code examples
- ⚙️ `animationConfig.js` - All settings

**Enjoy your new animations!** 🎨✨

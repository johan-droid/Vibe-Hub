import React from 'react';
import { RotateCcw } from 'lucide-react';
import { VibeLogoCompact } from './VibeLogo';
import { SELINA_BRAND } from '../brand/selina';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Selina UI] Unhandled render error', {
      message: error?.message,
      componentStack: info?.componentStack,
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090C12] px-6 text-white">
        <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#10141D] p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <VibeLogoCompact size={44} />
            <div>
              <h1 className="text-lg font-black">{SELINA_BRAND.productName}</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                Interface recovery
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-black tracking-tight">Something in the workspace failed to render.</h2>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Your session is still local. Reset the view and Selina will rebuild the screen state without clearing project data.
          </p>

          <button
            type="button"
            onClick={this.reset}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[#43F3C5] px-4 text-sm font-black text-[#07110F] transition hover:bg-[#6FF8D4]"
          >
            <RotateCcw size={16} />
            Reset view
          </button>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;

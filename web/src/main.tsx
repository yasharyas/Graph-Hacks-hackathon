import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import './styles.css';
import { App } from './App.tsx';

// A render error must never leave a blank page (a hand-edited share link, say): say so and offer a clean start.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-dvh place-items-center bg-bg-0 p-6 text-fg-0">
        <div className="max-w-md space-y-3">
          <h1 className="font-display text-xl">This page hit an error</h1>
          <p className="text-fg-1">Nothing was sent or saved. Start again from a clean link.</p>
          <a className="text-link underline underline-offset-2" href="/">
            Open Patient Zero
          </a>
        </div>
      </main>
    );
  }
}

// MotionConfig makes every `motion` component obey prefers-reduced-motion (docs/design.md section 6).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </Boundary>
  </StrictMode>,
);

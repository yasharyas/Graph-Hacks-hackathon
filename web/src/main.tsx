import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import './styles.css';
import { App } from './App.tsx';

// MotionConfig makes every `motion` component obey prefers-reduced-motion (docs/design.md section 6).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

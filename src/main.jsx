import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import * as Sentry from '@sentry/react';
import './index.css'
import App from './App.jsx'
import ErrorFallback from './components/ErrorFallback.jsx'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
  });
}

// Registra il service worker che gestisce le push notifications.
// Senza questa chiamata esplicita, navigator.serviceWorker.ready non si
// risolve mai su un device che non ha già un SW attivo da una sessione precedente
// (è il motivo per cui su iPhone "nuovi" le notifiche non partivano mai).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('❌ Registrazione Service Worker fallita:', err);
    });
  });
}

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
        <App />
      </Sentry.ErrorBoundary>
      <Analytics />
    </BrowserRouter>
)

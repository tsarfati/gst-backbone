import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker only outside Lovable preview to avoid proxy/CORS issues
if ('serviceWorker' in navigator) {
  const host = window.location.hostname;
  const isLovablePreview = host.endsWith('.lovableproject.com') || host.endsWith('.lovable.app') || host.includes('id-preview--');

  if (isLovablePreview) {
    // Ensure any previously registered SWs are removed in preview
    navigator.serviceWorker.getRegistrations?.().then(regs => regs.forEach(r => r.unregister()));
    // Clear caches that may cause stale assets/errors
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(reg => {
          console.log('ServiceWorker registered:', reg.scope);
        })
        .catch(err => {
          console.warn('ServiceWorker registration failed:', err);
        });
    });
  }
}

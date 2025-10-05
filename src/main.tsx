import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register a minimal service worker for PWA installability (Android requires SW)
if ('serviceWorker' in navigator) {
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

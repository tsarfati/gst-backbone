import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Clean up any previously registered service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.().then(regs => regs.forEach(r => r.unregister()));
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
  }
}

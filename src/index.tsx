import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Globaler Error Handler
window.addEventListener('error', (event) => {
  console.error('Unerwarteter Fehler:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unbehandeltes Promise Rejection:', event.reason);
});

// Office.js Initialisierung
if (typeof Office !== 'undefined') {
  Office.onReady((info) => {
    console.log('Office.js bereit:', info);
    mountApp();
  });
} else {
  // Fallback: Wenn Office.js nicht verfügbar (z.B. in Browser-Preview)
  console.warn('Office.js nicht gefunden - Standalone Modus');
  mountApp();
}

function mountApp() {
  const container = document.getElementById('root');
  
  if (!container) {
    console.error('Root Element nicht gefunden!');
    return;
  }

  const root = ReactDOM.createRoot(container);

  try {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Render-Fehler:', error);
    container.innerHTML = '<div style="padding:12px;font-family:Segoe UI, sans-serif;color:#b91c1c;">Mnemo konnte nicht geladen werden.</div>';
  }
}
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ModelProvider } from './contexts/ModelContext';
import { registerServiceWorker, checkInstallable } from './pwa';
import './index.css';

// Register service worker for PWA functionality
registerServiceWorker();
// Check if app can be installed
checkInstallable();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ModelProvider>
      <App />
    </ModelProvider>
  </React.StrictMode>,
); 
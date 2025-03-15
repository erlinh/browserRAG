// Register service worker
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service worker registered: ', registration);
        })
        .catch(error => {
          console.error('Service worker registration failed: ', error);
        });
    });
  }
}

// Check if the app can be installed
export function checkInstallable() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    // @ts-ignore - deferredPrompt is not a standard property
    window.deferredPrompt = e;
    // Optionally, send analytics event that PWA install was available
    console.log('App can be installed, showing install prompt');
    // You could show your own UI element here to notify the user
    // that the app can be installed
  });
}

// Handle app installation
export function installApp() {
  // @ts-ignore - deferredPrompt is not a standard property
  const deferredPrompt = window.deferredPrompt;
  if (deferredPrompt) {
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      // Clear the deferredPrompt so it can be used again
      // @ts-ignore - deferredPrompt is not a standard property
      window.deferredPrompt = null;
    });
  }
} 
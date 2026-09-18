export function registerPwaServiceWorker(): void {
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker
        .register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        .then((registration) => registration.update())
        .catch(() => undefined);
    },
    { once: true },
  );
}

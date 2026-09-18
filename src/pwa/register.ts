export function registerPwaServiceWorker(): void {
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) {
    return;
  }

  void navigator.serviceWorker
    .register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    .then((registration) => registration.update())
    .catch(() => undefined);
}

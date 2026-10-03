export type AppPage = 'player' | 'radio' | 'settings';

export function pageFromHash(hash = window.location.hash): AppPage {
  const candidate = hash.slice(1);
  if (candidate === 'alerts') return 'settings';
  return candidate === 'radio' || candidate === 'settings' ? candidate : 'player';
}

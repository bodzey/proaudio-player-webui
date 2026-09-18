export type AppPage = 'player' | 'radio' | 'alerts';

export function pageFromHash(hash = window.location.hash): AppPage {
  const candidate = hash.slice(1);
  return candidate === 'radio' || candidate === 'alerts' ? candidate : 'player';
}

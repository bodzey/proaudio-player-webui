import { createEffect, createSignal, onCleanup } from 'solid-js';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'proaudio-player-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const DEFAULT_THEME: ThemeMode = import.meta.env.VITE_DEMO === 'true' ? 'dark' : 'system';

function storedTheme(): ThemeMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function persistTheme(mode: ThemeMode) {
  try {
    if (mode === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Theme persistence is optional in restricted/private browsers.
  }
}

export function createThemeController() {
  const media = window.matchMedia(DARK_QUERY);
  const [mode, setModeSignal] = createSignal<ThemeMode>(storedTheme());

  const apply = (next: ThemeMode) => {
    const root = document.documentElement;
    if (next === 'system') delete root.dataset.theme;
    else root.dataset.theme = next;
    root.dataset.themeMode = next;

    const resolved = next === 'system' ? (media.matches ? 'dark' : 'light') : next;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = resolved === 'dark' ? '#091012' : '#f3f5f7';
  };

  const setMode = (next: ThemeMode) => {
    setModeSignal(next);
    persistTheme(next);
  };

  const onSystemThemeChange = () => {
    if (mode() === 'system') apply('system');
  };

  media.addEventListener('change', onSystemThemeChange);
  onCleanup(() => media.removeEventListener('change', onSystemThemeChange));

  createEffect(() => apply(mode()));

  return { mode, setMode };
}

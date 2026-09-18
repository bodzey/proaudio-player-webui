import { Show, type Component } from 'solid-js';

import proaudioLogoUrl from '../assets/proaudio-logo.jpg';
import { ConnectionBadge } from '../components/ConnectionBadge';
import type { ConnectionState } from '../state/player';
import type { ThemeMode } from '../state/theme';
import { ThemeMenu } from './ThemeMenu';

interface AppHeaderProps {
  temperatureCelsius: number | null | undefined;
  connection: ConnectionState;
  canInstall: boolean;
  installing: boolean;
  onInstall: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export const AppHeader: Component<AppHeaderProps> = (props) => (
  <header class="app-header mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5 sm:gap-4">
    <a
      class="brand-lockup flex min-w-0 items-start"
      href="#player"
      aria-label="PRO Audio — Network Streaming Player"
    >
      <span class="brand-wordmark shrink-0">
        <span class="brand-logo-frame">
          <img
            class="brand-logo-image"
            src={proaudioLogoUrl}
            alt=""
            width="1536"
            height="768"
            decoding="async"
            fetchpriority="high"
            draggable="false"
          />
        </span>
        <span class="brand-tagline" aria-hidden="true">
          NETWORK STREAMING PLAYER
        </span>
      </span>
    </a>

    <div class="status-cluster flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
      <Show when={props.temperatureCelsius ?? undefined}>
        {(temperature) => (
          <span class="status-chip rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 font-mono text-[9px] text-slate-400 sm:px-3 sm:py-2 sm:text-[10px]">
            CPU {temperature().toFixed(1)} °C
          </span>
        )}
      </Show>

      <Show when={props.canInstall}>
        <button
          type="button"
          class="install-app-button"
          disabled={props.installing}
          onClick={() => props.onInstall()}
        >
          <svg
            viewBox="0 0 24 24"
            class="size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
            <path d="M5 20h14" />
          </svg>
          <span class="hidden sm:inline">{props.installing ? 'Встановлення…' : 'Встановити'}</span>
          <span class="sr-only sm:hidden">Встановити застосунок</span>
        </button>
      </Show>

      <ThemeMenu value={props.theme} onChange={props.onThemeChange} />
      <ConnectionBadge state={props.connection} />
    </div>
  </header>
);

import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';

import { api } from '../api/client';
import { subscribeToMeterEvents } from '../api/meters';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { PriorityBanner } from '../components/PriorityBanner';
import { AlertsPanel } from '../features/alerts/AlertsPanel';
import { MixerPanel } from '../features/mixer/MixerPanel';
import { OutputsPanel } from '../features/outputs/OutputsPanel';
import { PlayerPanel } from '../features/player/PlayerPanel';
import { RadioPanel } from '../features/radio/RadioPanel';
import { SourcesPanel } from '../features/sources/SourcesPanel';
import { createPwaInstallController } from '../pwa/install';
import { MeterBuffer } from '../realtime/meter-buffer';
import { createPlayerState } from '../state/player';
import { createThemeController, type ThemeMode } from '../state/theme';

type AppPage = 'player' | 'radio' | 'alerts';
type MeterState = 'idle' | 'connecting' | 'live' | 'reconnecting';

function pageFromHash(): AppPage {
  const candidate = window.location.hash.slice(1);
  return candidate === 'radio' || candidate === 'alerts' ? candidate : 'player';
}

export function App() {
  const player = createPlayerState();
  const pwa = createPwaInstallController();
  const theme = createThemeController();
  const [capabilities] = createResource(api.capabilities);
  const [systemInfo, { refetch: refetchSystemInfo }] = createResource(api.systemInfo);
  const [page, setPage] = createSignal<AppPage>('player');
  const [meterState, setMeterState] = createSignal<MeterState>('idle');
  const pageScroll = new Map<AppPage, number>();
  let appNav!: HTMLElement;
  const meterBuffer = new MeterBuffer();
  const controlsUnavailable = () => !player.status() || player.connection() === 'offline';
  const priorityBlocked = () => player.status()?.priority.blocking ?? false;
  const firmwareLabel = () => {
    const release = systemInfo()?.release;
    if (!release?.version) return 'Firmware —';
    const flavor = [release.channel, release.status].filter(Boolean).join('/');
    return `Firmware ${release.version}${flavor ? ` · ${flavor}` : ''}`;
  };

  const staticNavTop = () => {
    let top = 0;
    let node: HTMLElement | null = appNav;
    while (node) {
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return Math.max(0, top - 6);
  };

  const clampScroll = (value: number) =>
    Math.max(0, Math.min(value, Math.max(0, document.documentElement.scrollHeight - innerHeight)));

  const commitPage = (next: AppPage, pushHistory: boolean) => {
    setPage(next);
    const hash = `#${next}`;
    if (pushHistory && window.location.hash !== hash) {
      window.history.pushState(null, '', hash);
    }
  };

  const switchPage = (next: AppPage, pushHistory = true) => {
    const current = page();
    if (next === current) return;

    pageScroll.set(current, window.scrollY);
    const targetScroll = pageScroll.get(next) ?? staticNavTop();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const documentWithTransition = document as Document & {
      startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> };
    };

    const update = () => {
      commitPage(next, pushHistory);
      return new Promise<void>((resolve) => {
        queueMicrotask(() => {
          window.scrollTo({ top: clampScroll(targetScroll), behavior: 'instant' });
          resolve();
        });
      });
    };

    if (!reduceMotion && documentWithTransition.startViewTransition) {
      document.documentElement.classList.add('is-page-transitioning');
      const transition = documentWithTransition.startViewTransition(update);
      void transition.finished.finally(() => {
        document.documentElement.classList.remove('is-page-transitioning');
      });
      return;
    }

    void update();
  };

  const navigate = (next: AppPage) => switchPage(next, true);

  onMount(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    const initialPage = pageFromHash();
    setPage(initialPage);
    pageScroll.set(initialPage, window.scrollY);

    const syncPage = () => switchPage(pageFromHash(), false);
    window.addEventListener('popstate', syncPage);
    onCleanup(() => {
      window.history.scrollRestoration = previousRestoration;
      window.removeEventListener('popstate', syncPage);
    });
  });

  onMount(() => {
    const timer = window.setInterval(() => void refetchSystemInfo(), 2_000);
    onCleanup(() => window.clearInterval(timer));
  });

  createEffect(() => {
    if (page() !== 'player') {
      meterBuffer.reset();
      setMeterState('idle');
      return;
    }

    setMeterState('connecting');
    const disconnect = subscribeToMeterEvents({
      buffer: meterBuffer,
      onOpen: () => setMeterState('live'),
      onError: () => setMeterState('reconnecting'),
    });

    onCleanup(disconnect);
  });

  return (
    <main class="app-shell redesign-shell min-h-screen text-slate-100">
      <div class="app-accent-line" aria-hidden="true" />
      <div class="app-ambient" aria-hidden="true" />

      <div class="app-frame relative mx-auto min-h-screen max-w-[1540px] px-3 py-3 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
        <header class="app-header mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5 sm:gap-4">
          <div class="brand-lockup flex min-w-0 items-center">
            <div class="brand-wordmark shrink-0" aria-label="PRO Audio — Network Player">
              <div class="brand-wordmark-main">
                <span class="brand-pro">PRO</span>
                <svg
                  viewBox="0 0 52 20"
                  class="brand-wave"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.55"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 10h5l2.4-4 2.3 8 2.6-11 2.7 15 2.7-9 2.8 5 2.8-12 2.8 16 2.7-10 2.7 6 2.7-8 2.8 8 2.5-4H51" />
                </svg>
                <span class="brand-audio">Audio</span>
              </div>
              <div class="brand-subline">NETWORK PLAYER</div>
            </div>
          </div>

          <div class="status-cluster flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
            <Show when={systemInfo()?.temperature_celsius ?? undefined}>
              {(temperature) => (
                <span class="status-chip rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 font-mono text-[9px] text-slate-400 sm:px-3 sm:py-2 sm:text-[10px]">
                  CPU {temperature().toFixed(1)} °C
                </span>
              )}
            </Show>
            <Show when={capabilities()?.api_version}>
              {(version) => (
                <span class="status-chip hidden rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 font-mono text-[10px] text-slate-500 md:block">
                  API {version()}
                </span>
              )}
            </Show>
            <Show when={pwa.canInstall()}>
              <button
                type="button"
                class="install-app-button"
                disabled={pwa.installing()}
                onClick={() => void pwa.install()}
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
                <span class="hidden sm:inline">
                  {pwa.installing() ? 'Встановлення…' : 'Встановити'}
                </span>
                <span class="sr-only sm:hidden">Встановити застосунок</span>
              </button>
            </Show>
            <ThemeSelect value={theme.mode()} onChange={theme.setMode} />
            <ConnectionBadge state={player.connection()} />
          </div>
        </header>

        <nav
          ref={(element) => {
            appNav = element;
          }}
          class="app-nav pro-nav mb-4 grid grid-cols-3 gap-1 rounded-xl border p-1 sm:mb-5 sm:flex sm:w-fit"
          aria-label="Основні розділи"
        >
          <NavButton active={page() === 'player'} onClick={() => navigate('player')}>
            <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
              <path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l9.5-6.4a1 1 0 0 0 0-1.7l-9.5-6.4A1 1 0 0 0 8 5.6Z" />
            </svg>
            Плеєр
          </NavButton>
          <NavButton active={page() === 'radio'} onClick={() => navigate('radio')}>
            <svg
              viewBox="0 0 24 24"
              class="size-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3.5" y="7" width="17" height="12" rx="2" />
              <path d="m7 7 9-4M7.5 12h.01M7.5 15h.01M11 12h5.5M11 15h5.5" />
            </svg>
            Радіо
          </NavButton>
          <NavButton active={page() === 'alerts'} onClick={() => navigate('alerts')}>
            <svg
              viewBox="0 0 24 24"
              class="size-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            Оповіщення
            <Show when={player.status()?.priority.active}>
              <span class="size-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.65)]" />
            </Show>
          </NavButton>
        </nav>

        <Show when={player.error()}>
          {(message) => (
            <div
              class="mb-4 flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.055] px-3.5 py-3 text-xs text-amber-100/80 sm:mb-5 sm:px-4 sm:py-3.5 sm:text-sm"
              role="alert"
              aria-live="assertive"
            >
              <span class="mt-1 size-1.5 shrink-0 rounded-full bg-amber-300" />
              <span>{message()}</span>
            </div>
          )}
        </Show>

        <PriorityBanner priority={player.status()?.priority} />

        <Show when={page() === 'player'}>
          <div class="page-stage page-stage--player">
            <div class="player-dashboard grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
              <div class="dashboard-player min-w-0">
                <PlayerPanel
                  status={player.status()}
                  pendingAction={player.pendingAction()}
                  onAction={(action) => void player.playerAction(action)}
                  disabled={controlsUnavailable()}
                />
              </div>

              <div class="dashboard-mixer min-w-0">
                <MixerPanel
                  status={player.status()}
                  buffer={meterBuffer}
                  meterLive={meterState() === 'live'}
                  onMusicVolume={(percent) => void player.setVolume(percent)}
                  onMusicMute={(muted) => void player.setMute(muted)}
                  disabled={controlsUnavailable()}
                />
              </div>

              <div class="dashboard-outputs min-w-0">
                <OutputsPanel blocked={priorityBlocked()} disabled={controlsUnavailable()} />
              </div>

              <div class="dashboard-sources min-w-0">
                <SourcesPanel sources={player.status()?.sources} />
              </div>
            </div>
          </div>
        </Show>

        <Show when={page() === 'radio'}>
          <div class="page-stage page-stage--radio">
            <RadioPanel
              status={player.status()}
              blocked={priorityBlocked()}
              disabled={controlsUnavailable()}
            />
          </div>
        </Show>

        <Show when={page() === 'alerts'}>
          <div class="page-stage page-stage--alerts">
            <AlertsPanel priority={player.status()?.priority} />
          </div>
        </Show>

        <footer class="mt-6 flex flex-col gap-1.5 border-t border-white/[0.06] pt-4 text-[9px] tracking-[0.08em] text-slate-500 uppercase sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:text-[10px]">
          <span title={systemInfo()?.release.build_id ?? undefined}>{firmwareLabel()}</span>
          <span>Native API {capabilities()?.api_version ?? '—'} · realtime</span>
        </footer>
      </div>
    </main>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  children: import('solid-js').JSX.Element;
}

function NavButton(props: NavButtonProps) {
  return (
    <button
      type="button"
      class={
        props.active
          ? 'nav-button nav-button--active flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold sm:min-h-0 sm:justify-start sm:gap-2 sm:px-3.5 sm:text-xs'
          : 'nav-button flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-transparent px-2 py-2 text-[11px] font-medium transition sm:min-h-0 sm:justify-start sm:gap-2 sm:px-3.5 sm:text-xs'
      }
      aria-current={props.active ? 'page' : undefined}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}

interface ThemeSelectProps {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Система' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
];

function ThemeSelect(props: ThemeSelectProps) {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;
  let trigger!: HTMLButtonElement;

  const currentLabel = () =>
    THEME_OPTIONS.find((option) => option.value === props.value)?.label ?? 'Тема';

  const choose = (value: ThemeMode) => {
    props.onChange(value);
    setOpen(false);
    queueMicrotask(() => trigger.focus());
  };

  onMount(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!root.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !open()) return;
      setOpen(false);
      trigger.focus();
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    });
  });

  return (
    <div
      ref={(element) => {
        root = element;
      }}
      class="theme-control"
    >
      <button
        ref={(element) => {
          trigger = element;
        }}
        type="button"
        class="theme-button"
        aria-label="Тема інтерфейсу"
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          class="theme-button-icon"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M18.36 5.64l-1.42 1.42M7.06 16.94l-1.42 1.42" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        <span>{currentLabel()}</span>
        <svg
          viewBox="0 0 20 20"
          class="theme-chevron"
          classList={{ 'is-open': open() }}
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>

      <Show when={open()}>
        <div class="theme-menu" role="menu" aria-label="Оберіть тему">
          <p class="theme-menu-label">Тема інтерфейсу</p>
          <For each={THEME_OPTIONS}>
            {(option) => (
              <button
                type="button"
                class="theme-option"
                classList={{ 'is-selected': props.value === option.value }}
                role="menuitemradio"
                aria-checked={props.value === option.value}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                <span class="theme-option-radio" aria-hidden="true">
                  <span />
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

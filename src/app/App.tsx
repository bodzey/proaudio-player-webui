import { Show, createEffect, createResource, createSignal, onCleanup, onMount } from 'solid-js';

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
import { MeterBuffer } from '../realtime/meter-buffer';
import { createPlayerState } from '../state/player';

type AppPage = 'player' | 'radio' | 'alerts';
type MeterState = 'idle' | 'connecting' | 'live' | 'reconnecting';

function pageFromHash(): AppPage {
  const candidate = window.location.hash.slice(1);
  return candidate === 'radio' || candidate === 'alerts' ? candidate : 'player';
}

export function App() {
  const player = createPlayerState();
  const [capabilities] = createResource(api.capabilities);
  const [page, setPage] = createSignal<AppPage>('player');
  const [meterState, setMeterState] = createSignal<MeterState>('idle');
  const meterBuffer = new MeterBuffer();
  const controlsUnavailable = () => !player.status() || player.connection() === 'offline';
  const priorityBlocked = () => player.status()?.priority.blocking ?? false;

  const navigate = (next: AppPage) => {
    setPage(next);
    const hash = `#${next}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  };

  onMount(() => {
    const syncPage = () => setPage(pageFromHash());
    syncPage();
    window.addEventListener('popstate', syncPage);
    onCleanup(() => window.removeEventListener('popstate', syncPage));
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
    <main class="min-h-screen bg-[#090c11] text-slate-100">
      <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,0.07),transparent_24%)]" />

      <div class="relative mx-auto min-h-screen max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header class="mb-5 flex items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3.5">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.045] shadow-lg shadow-black/20">
              <svg
                viewBox="0 0 24 24"
                class="size-5 text-slate-200"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M4 15V9M8 18V6M12 20V4M16 17V7M20 14v-4" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="truncate text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                ProAudio Player
              </p>
              <h1 class="mt-0.5 truncate text-base font-semibold tracking-[-0.02em] text-white">
                {player.status()?.name ?? 'Панель керування'}
              </h1>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <Show when={capabilities()?.api_version}>
              {(version) => (
                <span class="hidden rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 font-mono text-[10px] text-slate-500 sm:block">
                  API {version()}
                </span>
              )}
            </Show>
            <ConnectionBadge state={player.connection()} />
          </div>
        </header>

        <nav
          class="mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#0d1118]/90 p-1"
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
              class="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] px-4 py-3.5 text-sm text-amber-100/80"
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
          <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
            <div class="min-w-0 space-y-5">
              <PlayerPanel
                status={player.status()}
                pendingAction={player.pendingAction()}
                onAction={(action) => void player.playerAction(action)}
                onVolume={(percent) => void player.setVolume(percent)}
                onMute={(muted) => void player.setMute(muted)}
                disabled={controlsUnavailable()}
              />
              <OutputsPanel blocked={priorityBlocked()} disabled={controlsUnavailable()} />
            </div>

            <div class="min-w-0 space-y-5">
              <MixerPanel
                status={player.status()}
                buffer={meterBuffer}
                meterLive={meterState() === 'live'}
                onMusicVolume={(percent) => void player.setVolume(percent)}
                onMusicMute={(muted) => void player.setMute(muted)}
                disabled={controlsUnavailable()}
              />
              <SourcesPanel sources={player.status()?.sources} />
            </div>
          </div>
        </Show>

        <Show when={page() === 'radio'}>
          <RadioPanel
            status={player.status()}
            blocked={priorityBlocked()}
            disabled={controlsUnavailable()}
          />
        </Show>

        <Show when={page() === 'alerts'}>
          <AlertsPanel priority={player.status()?.priority} />
        </Show>

        <footer class="mt-8 flex flex-col gap-2 border-t border-white/[0.055] pt-4 text-[10px] tracking-[0.08em] text-slate-500 uppercase sm:flex-row sm:items-center sm:justify-between">
          <span>ProAudio Player</span>
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
          ? 'flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.09] px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-black/20'
          : 'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-white/[0.045] hover:text-slate-300'
      }
      aria-current={props.active ? 'page' : undefined}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}

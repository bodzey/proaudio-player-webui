import { Show, createEffect, createResource, createSignal, onCleanup, onMount } from 'solid-js';

import { api } from '../api/client';
import { subscribeToMeterEvents } from '../api/meters';
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
import { createThemeController } from '../state/theme';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { PrimaryNav } from './PrimaryNav';
import { type AppPage, pageFromHash } from './navigation';

type MeterState = 'idle' | 'connecting' | 'live' | 'reconnecting';

export function App() {
  const player = createPlayerState();
  const pwa = createPwaInstallController();
  const theme = createThemeController();
  const [systemInfo, { refetch: refetchSystemInfo }] = createResource(api.systemInfo);
  const [page, setPage] = createSignal<AppPage>(pageFromHash());
  const [meterState, setMeterState] = createSignal<MeterState>('idle');
  const [pageVisible, setPageVisible] = createSignal(document.visibilityState === 'visible');
  const meterBuffer = new MeterBuffer();
  const controlsUnavailable = () => !player.status() || player.connection() === 'offline';
  const priorityBlocked = () => player.status()?.priority.blocking ?? false;
  const firmwareLabel = () => {
    const release = systemInfo()?.release;
    if (!release?.version) return 'Firmware —';
    const flavor = [release.channel, release.status].filter(Boolean).join('/');
    return `Firmware ${release.version}${flavor ? ` · ${flavor}` : ''}`;
  };
  const playerVersionLabel = () => {
    const version = systemInfo()?.native_version;
    return `ProAudio Player ${version || '—'}`;
  };

  onMount(() => {
    const syncPage = () => setPage(pageFromHash());
    window.addEventListener('hashchange', syncPage);
    window.addEventListener('popstate', syncPage);
    onCleanup(() => {
      window.removeEventListener('hashchange', syncPage);
      window.removeEventListener('popstate', syncPage);
    });
  });

  onMount(() => {
    let systemInfoTimer: number | undefined;

    const stopSystemInfoPolling = () => {
      if (systemInfoTimer !== undefined) {
        window.clearInterval(systemInfoTimer);
        systemInfoTimer = undefined;
      }
    };

    const syncVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setPageVisible(visible);
      stopSystemInfoPolling();

      if (visible) {
        void refetchSystemInfo();
        systemInfoTimer = window.setInterval(() => void refetchSystemInfo(), 10_000);
      }
    };

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    onCleanup(() => {
      document.removeEventListener('visibilitychange', syncVisibility);
      stopSystemInfoPolling();
    });
  });

  createEffect(() => {
    if (page() !== 'player' || !pageVisible()) {
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
    <div class="app-shell redesign-shell min-h-screen text-slate-100">
      <div class="app-accent-line" aria-hidden="true" />
      <div class="app-ambient" aria-hidden="true" />

      <div class="app-frame relative mx-auto flex min-h-screen w-full flex-col px-3 py-3 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
        <AppHeader
          temperatureCelsius={systemInfo()?.temperature_celsius}
          connection={player.connection()}
          canInstall={pwa.canInstall()}
          installing={pwa.installing()}
          onInstall={() => void pwa.install()}
          theme={theme.mode()}
          onThemeChange={theme.setMode}
        />

        <PrimaryNav
          page={page()}
          alertActive={player.status()?.priority.active === true}
        />

        <main class="app-content min-w-0">
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
        </main>

        <AppFooter
          firmware={firmwareLabel()}
          firmwareBuildId={systemInfo()?.release.build_id ?? undefined}
          playerVersion={playerVersionLabel()}
          nativeSha={systemInfo()?.release.native_sha ?? undefined}
        />
      </div>
    </div>
  );
}


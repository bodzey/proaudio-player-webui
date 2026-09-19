import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  type Component,
} from 'solid-js';

import type { PlayerAction, PlayerStatus } from '../../api/types';
import { findCatalogRadioStation } from '../radio/catalog';
import { PlayerArtwork } from './PlayerArtwork';
import { TransportControls } from './TransportControls';
import { formatClock, isInternetRadioPlayer, radioTrackMetadata } from './presentation';

interface PlayerPanelProps {
  status: PlayerStatus | undefined;
  pendingAction: PlayerAction | undefined;
  onAction: (action: PlayerAction) => void;
  disabled: boolean;
}

export const PlayerPanel: Component<PlayerPanelProps> = (props) => {
  const [clock, setClock] = createSignal(performance.now());
  const [pageVisible, setPageVisible] = createSignal(document.visibilityState === 'visible');
  let positionAnchor = 0;
  let positionAnchorAt = performance.now();

  createEffect(() => {
    const player = props.status?.player;
    positionAnchor = player?.position_seconds ?? 0;
    positionAnchorAt = performance.now();
    setClock(positionAnchorAt);
  });

  onMount(() => {
    const syncVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setPageVisible(visible);
      if (visible) setClock(performance.now());
    };

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    onCleanup(() => document.removeEventListener('visibilitychange', syncVisibility));
  });

  createEffect(() => {
    if (props.status?.player.state !== 'playing' || !pageVisible()) return;

    const timer = window.setInterval(() => setClock(performance.now()), 250);
    onCleanup(() => window.clearInterval(timer));
  });

  const isRadio = () => isInternetRadioPlayer(props.status?.player);
  const streamUrl = () => (isRadio() ? (props.status?.mpd.stream_url ?? null) : null);
  const station = createMemo(() => findCatalogRadioStation(streamUrl()));
  const stationName = createMemo(() =>
    isRadio() ? station()?.name || props.status?.mpd.station || 'Інтернет-радіо' : '',
  );

  const radioMetadata = createMemo(() =>
    isRadio()
      ? radioTrackMetadata(props.status?.player.title, props.status?.player.artist, stationName())
      : { title: '', artist: '' },
  );

  const position = createMemo(() => {
    const player = props.status?.player;
    if (!player || player.position_seconds === null) return null;
    if (player.state !== 'playing') return player.position_seconds;
    const estimated = positionAnchor + Math.max(0, clock() - positionAnchorAt) / 1000;
    return player.duration_seconds === null
      ? estimated
      : Math.min(player.duration_seconds, estimated);
  });

  const progress = createMemo(() => {
    const player = props.status?.player;
    const duration = player?.duration_seconds;
    const current = position();
    if (duration && duration > 0 && current !== null) {
      return Math.min(100, Math.max(0, (current / duration) * 100));
    }
    return Math.min(100, Math.max(0, player?.progress ?? 0));
  });

  const controlsDisabled = () => props.disabled || props.status?.priority.blocking === true;

  return (
    <section
      class="pro-panel player-card overflow-hidden rounded-[22px] border sm:rounded-[26px]"
      aria-busy={props.status === undefined}
    >
      <div class="player-card-grid grid min-h-[300px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <PlayerArtwork
          radio={isRadio()}
          station={station()}
          stationName={stationName()}
          artUrl={props.status?.player.art_url}
          source={props.status?.player.source}
        />

        <div class="player-content flex min-w-0 flex-col p-4 sm:p-6 lg:p-7">
          <header class="player-meta flex items-start justify-between gap-3 sm:gap-4">
            <div class="min-w-0 flex-1">
              <Show
                when={isRadio()}
                fallback={
                  <>
                    <p class="player-kicker font-bold tracking-[0.18em] text-sky-400/70 uppercase">
                      Зараз відтворюється
                    </p>
                    <h2 class="player-track-title mt-2 font-semibold tracking-[-0.03em] text-white sm:mt-3">
                      {props.status?.player.title || 'Немає активного потоку'}
                    </h2>
                    <p class="player-track-subtitle mt-1.5 text-slate-400 sm:mt-2">
                      {props.status?.player.artist ||
                        props.status?.player.album ||
                        'ProAudio Player'}
                    </p>
                  </>
                }
              >
                <p class="player-kicker font-bold tracking-[0.18em] text-sky-400/70 uppercase">
                  Радіоефір
                </p>
                <div class="mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold text-cyan-200/80 sm:text-sm">
                  <span class="size-2 shrink-0 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.55)]" />
                  <span class="truncate">{stationName()}</span>
                </div>
                <h2 class="player-track-title mt-2 font-semibold tracking-[-0.03em] text-white sm:mt-3">
                  {radioMetadata().title || 'Радіоефір'}
                </h2>
                <p class="player-track-subtitle mt-1.5 text-slate-400 sm:mt-2">
                  {radioMetadata().artist || 'Метадані поточного треку не передаються станцією'}
                </p>
              </Show>
            </div>
          </header>

          <div class="player-controls pt-5 sm:pt-6">
            <Show
              when={!isRadio()}
              fallback={
                <div class="player-live-row flex items-center gap-2.5">
                  <span class="size-2 rounded-full bg-red-400" aria-hidden="true" />
                  <span class="font-mono text-[9px] font-bold tracking-[0.16em] uppercase sm:text-[10px]">
                    Радіо
                  </span>
                </div>
              }
            >
              <div
                class="player-progress"
                role="progressbar"
                aria-label="Прогрес відтворення"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress())}
              >
                <div class="player-progress-track">
                  <div class="player-progress-fill" style={{ width: `${progress()}%` }}>
                    <span class="player-progress-thumb" aria-hidden="true" />
                  </div>
                </div>
                <div class="player-progress-times">
                  <span>{formatClock(position())}</span>
                  <span>{formatClock(props.status?.player.duration_seconds ?? null)}</span>
                </div>
              </div>
            </Show>

            <TransportControls
              player={props.status?.player}
              pendingAction={props.pendingAction}
              disabled={controlsDisabled()}
              onAction={props.onAction}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

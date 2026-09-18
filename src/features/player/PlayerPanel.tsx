import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  type Component,
  type JSX,
} from 'solid-js';

import type { PlayerAction, PlayerStatus } from '../../api/types';
import { StationArtwork } from '../radio/StationArtwork';
import { findRadioStation } from '../radio/stations';

interface PlayerPanelProps {
  status: PlayerStatus | undefined;
  pendingAction: PlayerAction | undefined;
  onAction: (action: PlayerAction) => void;
  disabled: boolean;
}

function formatClock(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—:—';
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function normalizedText(value: string): string {
  return value.trim().toLocaleLowerCase('uk-UA').replace(/\s+/g, ' ');
}

function sameText(left: string, right: string): boolean {
  return Boolean(left && right && normalizedText(left) === normalizedText(right));
}

export const PlayerPanel: Component<PlayerPanelProps> = (props) => {
  const [clock, setClock] = createSignal(performance.now());
  let positionAnchor = 0;
  let positionAnchorAt = performance.now();
  let clockTimer: number | undefined;

  createEffect(() => {
    const player = props.status?.player;
    positionAnchor = player?.position_seconds ?? 0;
    positionAnchorAt = performance.now();
    setClock(positionAnchorAt);
  });

  onMount(() => {
    clockTimer = window.setInterval(() => setClock(performance.now()), 250);
  });

  onCleanup(() => {
    if (clockTimer !== undefined) window.clearInterval(clockTimer);
  });

  const isRadio = () =>
    props.status?.player.source === 'Інтернет-радіо' || props.status?.mpd.is_stream === true;
  const streamUrl = () => props.status?.mpd.stream_url ?? null;
  const station = createMemo(() => findRadioStation(streamUrl()));
  const stationName = createMemo(() =>
    isRadio() ? station()?.name || props.status?.mpd.station || 'Інтернет-радіо' : '',
  );

  const radioMetadata = createMemo(() => {
    if (!isRadio()) return { title: '', artist: '' };
    const knownStation = stationName();
    let title = props.status?.player.title?.trim() ?? '';
    let artist = props.status?.player.artist?.trim() ?? '';

    if (sameText(title, knownStation)) title = '';
    if (sameText(artist, knownStation)) artist = '';

    if (title && !artist) {
      const separator = title.indexOf(' - ');
      if (separator > 0 && separator < title.length - 3) {
        artist = title.slice(0, separator).trim();
        title = title.slice(separator + 3).trim();
      }
    }
    return { title, artist };
  });

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
        <div class="player-art relative aspect-[16/10] overflow-hidden bg-[#090c11] sm:aspect-[16/9] lg:aspect-auto">
          <Show
            when={isRadio()}
            fallback={
              <Show
                when={props.status?.player.art_url}
                fallback={
                  <div class="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.16),transparent_42%),linear-gradient(145deg,#111722,#080b10)]">
                    <div class="flex size-24 items-center justify-center rounded-[26px] border border-white/10 bg-white/[0.035] shadow-2xl sm:size-28 sm:rounded-[30px]">
                      <svg
                        viewBox="0 0 24 24"
                        class="size-10 text-slate-500 sm:size-12"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.4"
                        aria-hidden="true"
                      >
                        <path d="M9 18V5l10-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="16" cy="16" r="3" />
                      </svg>
                    </div>
                  </div>
                }
              >
                {(url) => (
                  <img src={url()} alt="" class="absolute inset-0 size-full object-cover" />
                )}
              </Show>
            }
          >
            <StationArtwork
              station={station()}
              fallbackName={stationName()}
              class="absolute inset-0 size-full"
            />
          </Show>
          <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent sm:h-32" />
          <div class="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-3 sm:right-4 sm:bottom-4 sm:left-4">
            <div class="rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 text-[10px] font-bold tracking-[0.12em] text-white/80 uppercase backdrop-blur-xl sm:rounded-full sm:px-3 sm:text-[11px]">
              {props.status?.player.source ?? 'Без джерела'}
            </div>
            <Show when={props.status?.player.backend}>
              {(backend) => (
                <div class="rounded-lg border border-white/[0.08] bg-black/45 px-2 py-1 font-mono text-[9px] text-slate-400 backdrop-blur-xl lg:hidden">
                  {backend()}
                </div>
              )}
            </Show>
          </div>
        </div>

        <div class="player-content flex min-w-0 flex-col p-4 sm:p-6 lg:p-7">
          <div class="player-meta flex items-start justify-between gap-3 sm:gap-4">
            <div class="min-w-0 flex-1">
              <Show
                when={isRadio()}
                fallback={
                  <>
                    <p class="text-[10px] font-bold tracking-[0.18em] text-sky-400/70 uppercase sm:text-[11px]">
                      Зараз відтворюється
                    </p>
                    <h2 class="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.03em] text-white sm:mt-3 sm:text-2xl lg:text-3xl">
                      {props.status?.player.title || 'Немає активного потоку'}
                    </h2>
                    <p class="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-400 sm:mt-2 sm:text-sm lg:text-base">
                      {props.status?.player.artist ||
                        props.status?.player.album ||
                        'ProAudio Player'}
                    </p>
                  </>
                }
              >
                <p class="text-[10px] font-bold tracking-[0.18em] text-sky-400/70 uppercase sm:text-[11px]">
                  Радіоефір
                </p>
                <div class="mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold text-cyan-200/80 sm:text-sm">
                  <span class="size-2 shrink-0 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.55)]" />
                  <span class="truncate">{stationName()}</span>
                </div>
                <h2 class="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.03em] text-white sm:mt-3 sm:text-2xl lg:text-3xl">
                  {radioMetadata().title || 'Ефір наживо'}
                </h2>
                <p class="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-400 sm:mt-2 sm:text-sm lg:text-base">
                  {radioMetadata().artist || 'Метадані поточного треку не передаються станцією'}
                </p>
              </Show>
            </div>
            <div class="hidden shrink-0 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2 text-right lg:block">
              <div class="text-[9px] tracking-[0.14em] text-slate-600 uppercase">Backend</div>
              <div class="mt-1 font-mono text-[11px] text-slate-400">
                {props.status?.player.backend ?? 'none'}
              </div>
            </div>
          </div>

          <div class="player-controls mt-auto pt-6 sm:pt-8">
            <Show
              when={!isRadio()}
              fallback={
                <div class="flex items-center gap-3">
                  <span class="font-mono text-[9px] font-bold tracking-[0.16em] text-red-300/75 uppercase sm:text-[10px]">
                    Наживо
                  </span>
                  <div class="h-px flex-1 bg-gradient-to-r from-red-400/45 via-white/10 to-transparent" />
                </div>
              }
            >
              <div class="h-1 overflow-hidden rounded-full bg-white/[0.07] sm:h-1.5">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 transition-[width] duration-300 ease-linear"
                  style={{ width: `${progress()}%` }}
                />
              </div>
              <div class="mt-2 flex justify-between font-mono text-[10px] text-slate-500 sm:mt-2.5 sm:text-[11px]">
                <span>{formatClock(position())}</span>
                <span>{formatClock(props.status?.player.duration_seconds ?? null)}</span>
              </div>
            </Show>

            <div class="transport-controls mt-5 flex items-center justify-center gap-2 sm:mt-6 sm:gap-3">
              <TransportButton
                label="Попередній"
                action="prev"
                disabled={controlsDisabled() || !props.status?.player.controls.prev}
                pending={props.pendingAction === 'prev'}
                onClick={props.onAction}
              >
                <path d="M6 5v14M18 6l-8 6 8 6V6Z" />
              </TransportButton>
              <TransportButton
                label="Стоп"
                action="stop"
                disabled={controlsDisabled() || !props.status?.player.controls.stop}
                pending={props.pendingAction === 'stop'}
                onClick={props.onAction}
              >
                <rect x="7" y="7" width="10" height="10" rx="1" />
              </TransportButton>
              <TransportButton
                primary
                label={props.status?.player.state === 'playing' ? 'Пауза' : 'Відтворити'}
                action={props.status?.player.state === 'playing' ? 'pause' : 'play'}
                disabled={
                  controlsDisabled() ||
                  (props.status?.player.state === 'playing'
                    ? !props.status?.player.controls.pause
                    : !props.status?.player.controls.play)
                }
                pending={
                  props.pendingAction ===
                  (props.status?.player.state === 'playing' ? 'pause' : 'play')
                }
                onClick={props.onAction}
              >
                <Show
                  when={props.status?.player.state === 'playing'}
                  fallback={<path d="m9 7 8 5-8 5V7Z" />}
                >
                  <path d="M9 7v10M15 7v10" />
                </Show>
              </TransportButton>
              <TransportButton
                label="Наступний"
                action="next"
                disabled={controlsDisabled() || !props.status?.player.controls.next}
                pending={props.pendingAction === 'next'}
                onClick={props.onAction}
              >
                <path d="M18 5v14M6 6l8 6-8 6V6Z" />
              </TransportButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

interface TransportButtonProps {
  label: string;
  action: PlayerAction;
  disabled: boolean;
  pending: boolean;
  primary?: boolean | undefined;
  onClick: (action: PlayerAction) => void;
  children: JSX.Element;
}

const TransportButton: Component<TransportButtonProps> = (props) => (
  <button
    type="button"
    class={
      props.primary
        ? 'transport-button transport-button--primary flex size-14 items-center justify-center rounded-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 sm:size-16 sm:rounded-2xl'
        : 'transport-button flex size-11 items-center justify-center rounded-xl border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 sm:size-12'
    }
    aria-label={props.label}
    disabled={props.disabled || props.pending}
    onClick={() => props.onClick(props.action)}
  >
    <svg
      viewBox="0 0 24 24"
      class={props.primary ? 'size-7' : 'size-5'}
      fill="none"
      stroke="currentColor"
      stroke-width={props.primary ? '1.9' : '1.7'}
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {props.children}
    </svg>
  </button>
);

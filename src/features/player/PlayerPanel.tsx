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

interface PlayerPanelProps {
  status?: PlayerStatus;
  pendingAction?: PlayerAction;
  onAction: (action: PlayerAction) => void;
  onVolume: (percent: number) => void;
  onMute: (muted: boolean) => void;
}

function formatClock(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return '—:—';
  }
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function percentToDb(percent: number): string {
  if (percent <= 0) {
    return '−∞ dB';
  }
  return `${(20 * Math.log10(percent / 100)).toFixed(1)} dB`;
}

export const PlayerPanel: Component<PlayerPanelProps> = (props) => {
  const [clock, setClock] = createSignal(performance.now());
  const [volumeDraft, setVolumeDraft] = createSignal(props.status?.volume ?? 0);
  let positionAnchor = props.status?.player.position_seconds ?? 0;
  let positionAnchorAt = performance.now();
  let volumeTimer: ReturnType<typeof setTimeout> | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;

  createEffect(() => {
    const player = props.status?.player;
    positionAnchor = player?.position_seconds ?? 0;
    positionAnchorAt = performance.now();
    setClock(positionAnchorAt);
  });

  createEffect(() => {
    const volume = props.status?.volume;
    if (volume !== undefined) {
      setVolumeDraft(volume);
    }
  });

  onMount(() => {
    clockTimer = setInterval(() => setClock(performance.now()), 250);
  });

  onCleanup(() => {
    if (clockTimer !== undefined) {
      clearInterval(clockTimer);
    }
    if (volumeTimer !== undefined) {
      clearTimeout(volumeTimer);
    }
  });

  const position = createMemo(() => {
    const player = props.status?.player;
    if (!player || player.position_seconds === null) {
      return null;
    }
    if (player.state !== 'playing') {
      return player.position_seconds;
    }
    const estimated = positionAnchor + Math.max(0, clock() - positionAnchorAt) / 1000;
    return player.duration_seconds === null ? estimated : Math.min(player.duration_seconds, estimated);
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

  const disabledByPriority = () => props.status?.priority.blocking === true;

  const sendVolume = (value: number) => {
    if (volumeTimer !== undefined) {
      clearTimeout(volumeTimer);
    }
    volumeTimer = setTimeout(() => props.onVolume(value), 70);
  };

  return (
    <section class="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#11161e] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)]">
      <div class="grid min-h-[330px] lg:grid-cols-[310px_minmax(0,1fr)]">
        <div class="relative aspect-square overflow-hidden bg-[#0b0f15] lg:aspect-auto">
          <Show
            when={props.status?.player.art_url}
            fallback={
              <div class="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(93,129,255,0.15),transparent_45%),linear-gradient(145deg,#101722,#090c11)]">
                <div class="flex size-28 items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] shadow-2xl">
                  <svg viewBox="0 0 24 24" class="size-12 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.4">
                    <path d="M9 18V5l10-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="16" cy="16" r="3" />
                  </svg>
                </div>
              </div>
            }
          >
            {(url) => (
              <img
                src={url()}
                alt=""
                class="absolute inset-0 size-full object-cover"
                referrerpolicy="no-referrer"
              />
            )}
          </Show>
          <div class="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />
          <div class="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-white/80 uppercase backdrop-blur-xl">
            {props.status?.player.source ?? 'No source'}
          </div>
        </div>

        <div class="flex min-w-0 flex-col p-5 sm:p-7 lg:p-8">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                Now playing
              </p>
              <h2 class="mt-3 truncate text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
                {props.status?.player.title || 'Немає активного потоку'}
              </h2>
              <p class="mt-2 truncate text-sm text-slate-400 sm:text-base">
                {props.status?.player.artist || props.status?.player.album || 'ProAudio Player'}
              </p>
            </div>
            <div class="shrink-0 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 text-right">
              <div class="text-[10px] tracking-[0.15em] text-slate-600 uppercase">Backend</div>
              <div class="mt-1 font-mono text-xs text-slate-400">
                {props.status?.player.backend ?? 'none'}
              </div>
            </div>
          </div>

          <div class="mt-auto pt-8">
            <div class="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                class="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 transition-[width] duration-300 ease-linear"
                style={{ width: `${progress()}%` }}
              />
            </div>
            <div class="mt-2.5 flex justify-between font-mono text-[11px] text-slate-500">
              <span>{formatClock(position())}</span>
              <span>{formatClock(props.status?.player.duration_seconds ?? null)}</span>
            </div>

            <div class="mt-6 flex items-center justify-center gap-2 sm:gap-3">
              <TransportButton
                label="Попередній"
                action="prev"
                disabled={disabledByPriority() || !props.status?.player.controls.prev}
                pending={props.pendingAction === 'prev'}
                onClick={props.onAction}
              >
                <path d="M6 5v14M18 6l-8 6 8 6V6Z" />
              </TransportButton>
              <TransportButton
                label="Стоп"
                action="stop"
                disabled={disabledByPriority() || !props.status?.player.controls.stop}
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
                  disabledByPriority() ||
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
                disabled={disabledByPriority() || !props.status?.player.controls.next}
                pending={props.pendingAction === 'next'}
                onClick={props.onAction}
              >
                <path d="M18 5v14M6 6l8 6-8 6V6Z" />
              </TransportButton>
            </div>

            <div class="mt-7 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/15 px-4 py-3.5">
              <button
                type="button"
                class="flex size-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                aria-label={props.status?.muted ? 'Увімкнути звук' : 'Вимкнути звук'}
                disabled={disabledByPriority()}
                onClick={() => props.onMute(!props.status?.muted)}
              >
                <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                  <Show when={!props.status?.muted && volumeDraft() > 0}>
                    <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
                  </Show>
                  <Show when={props.status?.muted || volumeDraft() <= 0}>
                    <path d="m16 9 5 6M21 9l-5 6" />
                  </Show>
                </svg>
              </button>
              <input
                class="volume-range w-full"
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={volumeDraft()}
                disabled={disabledByPriority()}
                aria-label="Гучність музики"
                onInput={(event) => {
                  const value = Number(event.currentTarget.value);
                  setVolumeDraft(value);
                  sendVolume(value);
                }}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (volumeTimer !== undefined) {
                    clearTimeout(volumeTimer);
                    volumeTimer = undefined;
                  }
                  props.onVolume(value);
                }}
              />
              <div class="min-w-20 text-right">
                <div class="font-mono text-sm font-semibold tabular-nums text-slate-100">
                  {volumeDraft().toFixed(1)}%
                </div>
                <div class="mt-0.5 font-mono text-[10px] tabular-nums text-slate-600">
                  {percentToDb(volumeDraft())}
                </div>
              </div>
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
  primary?: boolean;
  onClick: (action: PlayerAction) => void;
  children: unknown;
}

const TransportButton: Component<TransportButtonProps> = (props) => (
  <button
    type="button"
    class={
      props.primary
        ? 'flex size-14 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-lg shadow-white/10 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 sm:size-16'
        : 'flex size-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-slate-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 sm:size-12'
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

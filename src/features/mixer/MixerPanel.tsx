import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  type Component,
} from 'solid-js';

import { api } from '../../api/client';
import type { AudioLevel, MixerState, PlayerStatus } from '../../api/types';
import type { MeterBuffer, MeterBus } from '../../realtime/meter-buffer';
import { MeterCanvas } from './MeterCanvas';

type MixerTarget = 'master' | 'music' | 'alert';

const MIN_DB = -60;
const MAX_DB = 0;
const FADER_MARKS = [0, -6, -12, -24, -36, -48, -60] as const;
const FADER_SCALE = [
  { db: 0, position: 0 },
  { db: -6, position: 0.16 },
  { db: -12, position: 0.3 },
  { db: -24, position: 0.52 },
  { db: -36, position: 0.7 },
  { db: -48, position: 0.85 },
  { db: -60, position: 1 },
] as const;

interface MixerPanelProps {
  status: PlayerStatus | undefined;
  buffer: MeterBuffer;
  meterLive: boolean;
}

interface MixerRequest {
  db: number;
  muted?: boolean | undefined;
}

function clampDb(db: number): number {
  return Math.min(MAX_DB, Math.max(MIN_DB, db));
}

function roundDb(db: number): number {
  return Math.round(clampDb(db) * 10) / 10;
}

function percentToDb(percent: number): number {
  return percent <= 0 ? MIN_DB : Math.max(MIN_DB, 20 * Math.log10(percent / 100));
}

function dbToPercent(db: number): number {
  return db <= MIN_DB ? 0 : Math.min(100, Math.max(0, 100 * 10 ** (db / 20)));
}

function dbToFaderPosition(db: number): number {
  const value = clampDb(db);
  for (let index = 0; index < FADER_SCALE.length - 1; index += 1) {
    const upper = FADER_SCALE[index]!;
    const lower = FADER_SCALE[index + 1]!;
    if (value <= upper.db && value >= lower.db) {
      const span = upper.db - lower.db;
      const amount = span === 0 ? 0 : (upper.db - value) / span;
      return upper.position + amount * (lower.position - upper.position);
    }
  }
  return value >= MAX_DB ? 0 : 1;
}

function faderPositionToDb(position: number): number {
  const value = Math.min(1, Math.max(0, position));
  for (let index = 0; index < FADER_SCALE.length - 1; index += 1) {
    const upper = FADER_SCALE[index]!;
    const lower = FADER_SCALE[index + 1]!;
    if (value >= upper.position && value <= lower.position) {
      const span = lower.position - upper.position;
      const amount = span === 0 ? 0 : (value - upper.position) / span;
      return roundDb(upper.db + amount * (lower.db - upper.db));
    }
  }
  return value <= 0 ? MAX_DB : MIN_DB;
}

function levelFromPercent(percent: number, muted: boolean): AudioLevel {
  return {
    volume: percent,
    db: percentToDb(percent),
    muted,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Не вдалося змінити рівень мікшера';
}

export const MixerPanel: Component<MixerPanelProps> = (props) => {
  const [mixer, { mutate, refetch }] = createResource(api.mixer);
  const [error, setError] = createSignal<string>();
  const [pendingVersion, setPendingVersion] = createSignal(0);
  const queued: Partial<Record<MixerTarget, MixerRequest>> = {};
  const running = new Set<MixerTarget>();

  const fallback = (target: MixerTarget): AudioLevel => {
    if (target === 'master') {
      return (
        props.status?.audio_levels.hardware ??
        props.status?.audio_levels.physical ??
        levelFromPercent(0, false)
      );
    }
    if (target === 'alert') {
      return props.status?.audio_levels.alert_bus ?? levelFromPercent(0, false);
    }
    return levelFromPercent(props.status?.audio_levels.music_bus ?? 0, props.status?.muted ?? false);
  };

  const level = (target: MixerTarget): AudioLevel => mixer()?.[target] ?? fallback(target);
  const pending = (target: MixerTarget) => {
    pendingVersion();
    return running.has(target);
  };

  const applyOptimistic = (target: MixerTarget, db: number, muted?: boolean) => {
    const current = mixer();
    if (!current) return;
    const previous = current[target];
    const nextLevel: AudioLevel = {
      ...previous,
      db,
      volume: dbToPercent(db),
      muted: muted ?? previous.muted,
    };
    mutate({ ...current, [target]: nextLevel } satisfies MixerState);
  };

  const queueSet = (target: MixerTarget, db: number, muted?: boolean) => {
    const normalizedDb = roundDb(db);
    applyOptimistic(target, normalizedDb, muted);
    queued[target] = muted === undefined ? { db: normalizedDb } : { db: normalizedDb, muted };
    if (running.has(target)) return;

    running.add(target);
    setPendingVersion((value) => value + 1);
    void (async () => {
      try {
        while (queued[target]) {
          const request = queued[target]!;
          delete queued[target];
          const next = await api.setMixer(target, request.db, request.muted);
          mutate(next);
        }
        setError(undefined);
      } catch (cause) {
        delete queued[target];
        setError(errorMessage(cause));
        await refetch();
      } finally {
        running.delete(target);
        setPendingVersion((value) => value + 1);
      }
    })();
  };

  return (
    <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] sm:p-6">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
            Mixer
          </p>
          <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">Console</h2>
          <p class="mt-1.5 text-[10px] leading-4 text-slate-600">
            Реальні Peak/RMS рівні та атенюація шин у dB.
          </p>
        </div>
        <div
          class={
            props.meterLive
              ? 'flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.045] px-2.5 py-1.5 text-[9px] font-semibold tracking-[0.12em] text-emerald-300/70 uppercase'
              : 'flex items-center gap-2 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] px-2.5 py-1.5 text-[9px] font-semibold tracking-[0.12em] text-amber-200/50 uppercase'
          }
        >
          <span
            class={
              props.meterLive
                ? 'size-1.5 rounded-full bg-emerald-400'
                : 'size-1.5 rounded-full bg-amber-300/60'
            }
          />
          {props.meterLive ? '25 Hz live' : 'Meter offline'}
        </div>
      </div>

      <div class="overflow-x-auto pb-1">
        <div class="grid min-w-[390px] grid-cols-3 gap-2.5">
          <MixerStrip
            target="master"
            label="MASTER"
            level={level('master')}
            buffer={props.buffer}
            meterLive={props.meterLive}
            blocked={false}
            pending={pending('master')}
            detail={level('master').card_name ?? level('master').control ?? 'Physical output'}
            onSet={queueSet}
          />
          <MixerStrip
            target="music"
            label="MUSIC"
            level={level('music')}
            buffer={props.buffer}
            meterLive={props.meterLive}
            blocked={props.status?.priority.blocking === true}
            pending={pending('music')}
            detail="Music bus"
            onSet={queueSet}
          />
          <MixerStrip
            target="alert"
            label="ALERT"
            level={level('alert')}
            buffer={props.buffer}
            meterLive={props.meterLive}
            blocked={props.status?.priority.blocking === true}
            pending={pending('alert')}
            detail="Priority bus"
            onSet={queueSet}
          />
        </div>
      </div>

      <Show when={error()}>
        {(message) => (
          <div class="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-3.5 py-2.5 text-xs text-red-200/70">
            {message()}
          </div>
        )}
      </Show>

      <p class="mt-4 text-[10px] leading-4 text-slate-600">
        Peak/RMS вимірюються з monitor-потоків аудіошин. Фейдери мають підвищену роздільність
        біля 0 dB і безперервне pointer-керування. Master лишається доступним під час пріоритетного
        оповіщення; Music та Alert підкоряються backend policy.
      </p>
    </section>
  );
};

interface MixerStripProps {
  target: MixerTarget;
  label: string;
  level: AudioLevel;
  buffer: MeterBuffer;
  meterLive: boolean;
  blocked: boolean;
  pending: boolean;
  detail: string;
  onSet: (target: MixerTarget, db: number, muted?: boolean) => void;
}

const MixerStrip: Component<MixerStripProps> = (props) => {
  const [draft, setDraft] = createSignal(roundDb(props.level.db));
  const [dragging, setDragging] = createSignal(false);
  let track!: HTMLDivElement;
  let updateTimer: number | undefined;

  createEffect(() => {
    if (!dragging() && !props.pending) {
      setDraft(roundDb(props.level.db));
    }
  });

  onCleanup(() => {
    if (updateTimer !== undefined) window.clearTimeout(updateTimer);
  });

  const schedule = (db: number) => {
    if (updateTimer !== undefined) window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(() => {
      updateTimer = undefined;
      props.onSet(props.target, db);
    }, 45);
  };

  const commit = (db: number) => {
    if (updateTimer !== undefined) {
      window.clearTimeout(updateTimer);
      updateTimer = undefined;
    }
    props.onSet(props.target, roundDb(db));
  };

  const valueFromPointer = (clientY: number): number => {
    const rect = track.getBoundingClientRect();
    if (rect.height <= 0) return draft();
    return faderPositionToDb((clientY - rect.top) / rect.height);
  };

  const updateFromPointer = (clientY: number, send: boolean) => {
    const value = valueFromPointer(clientY);
    setDraft(value);
    if (send) schedule(value);
    return value;
  };

  const setKeyboardValue = (value: number) => {
    const next = roundDb(value);
    setDraft(next);
    commit(next);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const fineStep = event.shiftKey ? 0.1 : 0.5;
    let next: number | undefined;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = draft() + fineStep;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next = draft() - fineStep;
        break;
      case 'PageUp':
        next = draft() + 3;
        break;
      case 'PageDown':
        next = draft() - 3;
        break;
      case 'Home':
        next = MAX_DB;
        break;
      case 'End':
        next = MIN_DB;
        break;
      default:
        return;
    }
    event.preventDefault();
    setKeyboardValue(next);
  };

  const bus = (): MeterBus => props.target;
  const displayDb = () => (draft() <= MIN_DB ? '−∞' : draft().toFixed(1));
  const thumbTop = () => `${dbToFaderPosition(draft()) * 100}%`;

  return (
    <div
      class={
        props.blocked
          ? 'min-w-0 rounded-2xl border border-white/[0.045] bg-black/10 p-3 opacity-45'
          : 'min-w-0 rounded-2xl border border-white/[0.06] bg-black/15 p-3'
      }
    >
      <div class="text-center text-[10px] font-bold tracking-[0.16em] text-slate-300">
        {props.label}
      </div>
      <div class="mt-1 truncate text-center font-mono text-[8px] text-slate-700">
        {props.detail}
      </div>

      <div class="mt-4 flex items-center justify-center gap-2">
        <MeterCanvas buffer={props.buffer} bus={bus()} />
        <div class="relative h-56 w-16 shrink-0 select-none">
          <For each={FADER_MARKS}>
            {(mark) => (
              <div
                class="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center"
                style={{ top: `${dbToFaderPosition(mark) * 100}%` }}
              >
                <span class="w-6 pr-1 text-right font-mono text-[7px] tabular-nums text-slate-700">
                  {mark}
                </span>
                <span class="h-px flex-1 bg-white/[0.07]" />
              </div>
            )}
          </For>

          <div
            ref={track}
            class={
              props.blocked
                ? 'absolute inset-y-0 left-7 right-0 cursor-not-allowed touch-none opacity-45'
                : 'absolute inset-y-0 left-7 right-0 cursor-ns-resize touch-none outline-none'
            }
            role="slider"
            tabIndex={props.blocked ? -1 : 0}
            aria-label={`${props.label} level`}
            aria-valuemin={MIN_DB}
            aria-valuemax={MAX_DB}
            aria-valuenow={draft()}
            aria-valuetext={displayDb() === '−∞' ? 'minus infinity dB' : `${displayDb()} dB`}
            aria-disabled={props.blocked}
            onKeyDown={handleKeyDown}
            onDblClick={() => !props.blocked && setKeyboardValue(0)}
            onPointerDown={(event) => {
              if (props.blocked) return;
              event.preventDefault();
              track.setPointerCapture(event.pointerId);
              setDragging(true);
              updateFromPointer(event.clientY, true);
            }}
            onPointerMove={(event) => {
              if (!dragging()) return;
              event.preventDefault();
              updateFromPointer(event.clientY, true);
            }}
            onPointerUp={(event) => {
              if (!dragging()) return;
              event.preventDefault();
              const value = updateFromPointer(event.clientY, false);
              commit(value);
              setDragging(false);
              if (track.hasPointerCapture(event.pointerId)) {
                track.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              if (!dragging()) return;
              commit(draft());
              setDragging(false);
            }}
          >
            <div class="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full border border-white/[0.06] bg-[#090c11] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
            <div
              class="pointer-events-none absolute left-1/2 h-7 w-9 -translate-x-1/2 -translate-y-1/2 rounded-[5px] border border-white/25 bg-[linear-gradient(180deg,#d9e1eb,#7c8998)] shadow-[0_5px_12px_rgba(0,0,0,0.45)] transition-shadow"
              style={{ top: thumbTop() }}
            >
              <span class="absolute top-1/2 left-1/2 h-px w-5 -translate-x-1/2 -translate-y-1/2 bg-slate-800/90" />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-3 text-center">
        <div class="font-mono text-sm font-semibold tabular-nums text-slate-100">
          {displayDb()} <span class="text-[9px] font-normal text-slate-600">dB</span>
        </div>
        <div class="mt-1 font-mono text-[9px] tabular-nums text-slate-700">
          {dbToPercent(draft()).toFixed(1)}%
        </div>
      </div>

      <button
        type="button"
        disabled={props.blocked}
        class={
          props.level.muted
            ? 'mt-3 w-full rounded-lg border border-red-400/25 bg-red-400/[0.12] px-2 py-2 text-[9px] font-bold tracking-[0.12em] text-red-200 uppercase transition'
            : 'mt-3 w-full rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-2 text-[9px] font-bold tracking-[0.12em] text-slate-500 uppercase transition hover:bg-white/[0.06] hover:text-slate-300'
        }
        onClick={() => props.onSet(props.target, draft(), !props.level.muted)}
      >
        {props.level.muted ? 'UNMUTE' : 'MUTE'}
      </button>
      <div class="mt-2 h-2 text-center text-[8px] tracking-[0.08em] text-slate-700 uppercase">
        {props.pending ? 'sync' : props.meterLive ? 'live' : ''}
      </div>
    </div>
  );
};

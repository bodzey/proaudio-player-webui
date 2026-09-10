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
import type { AudioLevel, PlayerStatus } from '../../api/types';
import type { MeterBuffer, MeterBus } from '../../realtime/meter-buffer';
import { MeterCanvas } from './MeterCanvas';

type MixerTarget = 'master' | 'music' | 'alert';

const FADER_MARKS = [0, -6, -12, -24, -36, -48, -60] as const;

interface MixerPanelProps {
  status: PlayerStatus | undefined;
  buffer: MeterBuffer;
  meterLive: boolean;
}

interface MixerRequest {
  db: number;
  muted?: boolean | undefined;
}

function percentToDb(percent: number): number {
  return percent <= 0 ? -60 : Math.max(-60, 20 * Math.log10(percent / 100));
}

function dbToPercent(db: number): number {
  return db <= -60 ? 0 : Math.min(100, Math.max(0, 100 * 10 ** (db / 20)));
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

  const queueSet = (target: MixerTarget, db: number, muted?: boolean) => {
    queued[target] = muted === undefined ? { db } : { db, muted };
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
        Peak/RMS вимірюються з monitor-потоків аудіошин. Master лишається доступним під час
        пріоритетного оповіщення; Music та Alert підкоряються backend policy.
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
  const [draft, setDraft] = createSignal(props.level.db);
  const [dragging, setDragging] = createSignal(false);
  let updateTimer: number | undefined;

  createEffect(() => {
    if (!dragging() && !props.pending) {
      setDraft(props.level.db);
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
    }, 70);
  };

  const commit = (db: number) => {
    if (updateTimer !== undefined) {
      window.clearTimeout(updateTimer);
      updateTimer = undefined;
    }
    props.onSet(props.target, db);
  };

  const bus = (): MeterBus => props.target;
  const displayDb = () => (draft() <= -59.95 ? '−∞' : draft().toFixed(1));

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
        <div class="mixer-fader-shell relative h-56 w-14 shrink-0">
          <div class="pointer-events-none absolute inset-y-2 left-0 flex flex-col justify-between font-mono text-[7px] text-slate-700">
            <For each={FADER_MARKS}>{(mark) => <span>{mark}</span>}</For>
          </div>
          <input
            class="mixer-fader"
            type="range"
            min="-60"
            max="0"
            step="0.5"
            value={draft()}
            disabled={props.blocked}
            aria-label={`${props.label} level`}
            onPointerDown={() => setDragging(true)}
            onPointerCancel={() => setDragging(false)}
            onInput={(event) => {
              const value = Number(event.currentTarget.value);
              setDraft(value);
              schedule(value);
            }}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              setDraft(value);
              commit(value);
              setDragging(false);
            }}
          />
        </div>
      </div>

      <div class="mt-3 text-center">
        <div class="font-mono text-sm font-semibold tabular-nums text-slate-100">
          {displayDb()} <span class="text-[9px] font-normal text-slate-600">dB</span>
        </div>
        <div class="mt-1 font-mono text-[9px] tabular-nums text-slate-700">
          {dbToPercent(draft()).toFixed(0)}%
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

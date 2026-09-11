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
type DirectTarget = Exclude<MixerTarget, 'music'>;

const MIN_DB = -60;
const MAX_DB = 0;
const FADER_HEIGHT_PX = 256;
const CONTROL_INTERVAL_MS = 32;
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
  onMusicVolume: (percent: number) => void;
  onMusicMute: (muted: boolean) => void;
}

interface DirectRequest {
  db: number;
  muted?: boolean;
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

function levelsMatch(left: AudioLevel, right: AudioLevel): boolean {
  return Math.abs(left.db - right.db) <= 0.2 && left.muted === right.muted;
}

function masterDetail(level: AudioLevel): string {
  const details: string[] = [];
  if (level.backend) details.push(level.backend);
  if (level.transport_backend && level.transport_backend !== level.backend) {
    details.push(level.transport_backend);
  }
  const output = level.control ?? level.name ?? level.card_name;
  if (output) details.push(output);
  return details.length > 0 ? details.join(' · ') : 'Output gain';
}

export const MixerPanel: Component<MixerPanelProps> = (props) => {
  const [error, setError] = createSignal<string>();
  const [pendingVersion, setPendingVersion] = createSignal(0);
  const [overrides, setOverrides] = createSignal<Partial<Record<DirectTarget, AudioLevel>>>({});
  const [mixerState, { mutate: mutateMixerState, refetch: refetchMixerState }] = createResource(
    api.mixer,
  );
  const queued: Partial<Record<DirectTarget, DirectRequest>> = {};
  const running = new Set<DirectTarget>();
  let lastStatusSignature: string | undefined;

  const statusLevel = (target: MixerTarget): AudioLevel => {
    if (target === 'master') {
      return (
        props.status?.audio_levels.physical ??
        props.status?.audio_levels.hardware ??
        levelFromPercent(100, false)
      );
    }
    if (target === 'alert') {
      return props.status?.audio_levels.alert_bus ?? levelFromPercent(100, false);
    }
    return levelFromPercent(
      props.status?.audio_levels.music_bus ?? props.status?.volume ?? 0,
      props.status?.muted ?? false,
    );
  };

  const authoritativeLevel = (target: MixerTarget): AudioLevel => {
    if (target === 'music') return statusLevel(target);
    return mixerState()?.[target] ?? statusLevel(target);
  };

  const level = (target: MixerTarget): AudioLevel => {
    if (target === 'music') return authoritativeLevel(target);
    return overrides()[target] ?? authoritativeLevel(target);
  };

  createEffect(() => {
    const levels = props.status?.audio_levels;
    if (!levels) return;
    const signature = [
      levels.physical?.name ?? '',
      levels.physical?.db ?? '',
      levels.physical?.muted ?? '',
      levels.hardware?.card ?? '',
      levels.hardware?.control ?? '',
      levels.hardware?.db ?? '',
      levels.hardware?.muted ?? '',
      levels.alert_bus?.db ?? '',
      levels.alert_bus?.muted ?? '',
    ].join('|');
    if (signature === lastStatusSignature) return;
    lastStatusSignature = signature;
    void refetchMixerState();
  });

  createEffect(() => {
    const current = overrides();
    let changed = false;
    const next = { ...current };
    for (const target of ['master', 'alert'] as const) {
      const local = current[target];
      if (local && levelsMatch(local, authoritativeLevel(target))) {
        delete next[target];
        changed = true;
      }
    }
    if (changed) setOverrides(next);
  });

  const pending = (target: MixerTarget) => {
    pendingVersion();
    return target !== 'music' && running.has(target);
  };

  const queueDirect = (target: DirectTarget, db: number, muted?: boolean) => {
    const current = level(target);
    const safeDb = roundDb(db);
    const optimistic: AudioLevel = {
      ...current,
      volume: dbToPercent(safeDb),
      db: safeDb,
      muted: muted ?? safeDb <= MIN_DB,
    };
    setOverrides((value) => ({ ...value, [target]: optimistic }));
    queued[target] = muted === undefined ? { db: safeDb } : { db: safeDb, muted };
    if (running.has(target)) return;

    running.add(target);
    setPendingVersion((value) => value + 1);
    void (async () => {
      try {
        while (queued[target]) {
          const request = queued[target]!;
          delete queued[target];
          const confirmed = await api.setMixer(target, request.db, request.muted);
          mutateMixerState(confirmed);
          if (!queued[target]) {
            setOverrides((value) => ({ ...value, [target]: confirmed[target] }));
          }
        }
        setError(undefined);
      } catch (cause) {
        delete queued[target];
        setOverrides((value) => {
          const next = { ...value };
          delete next[target];
          return next;
        });
        setError(errorMessage(cause));
        void refetchMixerState();
      } finally {
        running.delete(target);
        setPendingVersion((value) => value + 1);
      }
    })();
  };

  const setLevel = (target: MixerTarget, db: number, muted?: boolean) => {
    if (target === 'music') {
      if (muted === true) {
        props.onMusicMute(true);
      } else {
        props.onMusicVolume(dbToPercent(db));
      }
      return;
    }
    queueDirect(target, db, muted);
  };

  return (
    <section class="rounded-[28px] border border-white/[0.08] bg-[#11161e] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] sm:p-6">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">Mixer</p>
          <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">Console</h2>
          <p class="mt-1.5 text-[10px] leading-4 text-slate-600">
            Реальні Peak/RMS рівні та абсолютна атенюація шин у dB.
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
        <div class="grid min-w-[420px] grid-cols-3 gap-2.5">
          <MixerStrip
            target="master"
            label="MASTER"
            level={level('master')}
            buffer={props.buffer}
            meterLive={props.meterLive}
            blocked={false}
            pending={pending('master')}
            detail={masterDetail(level('master'))}
            onSet={setLevel}
          />
          <MixerStrip
            target="music"
            label="MUSIC"
            level={level('music')}
            buffer={props.buffer}
            meterLive={props.meterLive}
            blocked={props.status?.priority.blocking === true}
            pending={false}
            detail="Music bus"
            onSet={setLevel}
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
            onSet={setLevel}
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
        MASTER і ALERT надсилають абсолютну атенюацію через native mixer API. MASTER використовує
        активний OutputGain backend і не прив’язаний до конкретного ALSA або PipeWire регулятора.
        MUSIC і регулятор плеєра використовують спільний стан. Shift під час захоплення вмикає точне
        керування.
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
  const [draft, setDraft] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  let track!: HTMLDivElement;
  let sendTimer: number | undefined;
  let scheduledDb: number | undefined;
  let lastSentDb: number | undefined;
  let lastSentAt = -Infinity;
  let dragStartY = 0;
  let dragStartPosition = 0;
  let dragSensitivity = 1;

  createEffect(() => {
    if (!dragging() && !props.pending && !props.level.muted) {
      setDraft(roundDb(props.level.db));
    }
  });

  const send = (db: number) => {
    const value = roundDb(db);
    lastSentDb = value;
    lastSentAt = performance.now();
    props.onSet(props.target, value);
  };

  const flushScheduled = () => {
    if (scheduledDb === undefined) return;
    const value = scheduledDb;
    scheduledDb = undefined;
    send(value);
  };

  const schedule = (db: number) => {
    scheduledDb = roundDb(db);
    const remaining = CONTROL_INTERVAL_MS - (performance.now() - lastSentAt);
    if (remaining <= 0) {
      if (sendTimer !== undefined) {
        window.clearTimeout(sendTimer);
        sendTimer = undefined;
      }
      flushScheduled();
      return;
    }
    if (sendTimer === undefined) {
      sendTimer = window.setTimeout(() => {
        sendTimer = undefined;
        flushScheduled();
      }, remaining);
    }
  };

  const commit = (db: number) => {
    if (sendTimer !== undefined) {
      window.clearTimeout(sendTimer);
      sendTimer = undefined;
    }
    scheduledDb = undefined;
    const value = roundDb(db);
    if (lastSentDb !== value) {
      send(value);
    }
  };

  onCleanup(() => {
    if (sendTimer !== undefined) window.clearTimeout(sendTimer);
  });

  const valueFromPointer = (clientY: number): number => {
    const rect = track.getBoundingClientRect();
    if (rect.height <= 0) return draft();
    const delta = ((clientY - dragStartY) / rect.height) * dragSensitivity;
    return faderPositionToDb(dragStartPosition + delta);
  };

  const updateFromPointer = (clientY: number, sendUpdate: boolean) => {
    const value = valueFromPointer(clientY);
    setDraft(value);
    if (sendUpdate) schedule(value);
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
  const thumbTransform = () =>
    `translate3d(-50%, ${dbToFaderPosition(draft()) * FADER_HEIGHT_PX}px, 0) translateY(-50%)`;

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
        <div class="relative h-64 w-16 shrink-0 select-none">
          <For each={FADER_MARKS}>
            {(mark) => (
              <div
                class="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center"
                style={{ top: `${dbToFaderPosition(mark) * 100}%` }}
              >
                <span class="w-6 pr-1 text-right font-mono text-[7px] text-slate-700 tabular-nums">
                  {mark}
                </span>
                <span class="h-px flex-1 bg-white/[0.07]" />
              </div>
            )}
          </For>

          <div
            ref={(element) => {
              track = element;
            }}
            class={
              props.blocked
                ? 'absolute inset-y-0 right-0 left-7 cursor-not-allowed touch-none opacity-45'
                : dragging()
                  ? 'absolute inset-y-0 right-0 left-7 cursor-grabbing touch-none outline-none'
                  : 'absolute inset-y-0 right-0 left-7 cursor-grab touch-none outline-none'
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
              dragStartY = event.clientY;
              dragStartPosition = dbToFaderPosition(draft());
              dragSensitivity = event.shiftKey ? 0.25 : 1;
              track.setPointerCapture(event.pointerId);
              setDragging(true);
            }}
            onPointerMove={(event) => {
              if (!dragging()) return;
              event.preventDefault();
              const samples = event.getCoalescedEvents?.() ?? [event];
              const latest = samples.at(-1) ?? event;
              updateFromPointer(latest.clientY, true);
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
              class="pointer-events-none absolute top-0 left-1/2 h-7 w-9 rounded-[5px] border border-white/25 bg-[linear-gradient(180deg,#d9e1eb,#7c8998)] shadow-[0_5px_12px_rgba(0,0,0,0.45)] will-change-transform"
              style={{ transform: thumbTransform() }}
            >
              <span class="absolute top-1/2 left-1/2 h-px w-5 -translate-x-1/2 -translate-y-1/2 bg-slate-800/90" />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-3 text-center">
        <div class="font-mono text-sm font-semibold text-slate-100 tabular-nums">
          {displayDb()} <span class="text-[9px] font-normal text-slate-600">dB</span>
        </div>
        <div class="mt-1 font-mono text-[9px] text-slate-700 tabular-nums">
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

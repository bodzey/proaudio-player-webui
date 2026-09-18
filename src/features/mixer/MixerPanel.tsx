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
import { MAX_DB, MIN_DB, clampDb, dbToPercent, percentToDb, roundDb } from '../../audio/scale';
import type { MeterBuffer, MeterBus } from '../../realtime/meter-buffer';
import { MeterCanvas } from './MeterCanvas';

type MixerTarget = 'master' | 'music' | 'alert';
type DirectTarget = Exclude<MixerTarget, 'music'>;

const CONTROL_INTERVAL_MS = 20;
const FADER_MARKS = [0, -3, -6, -9, -12, -18, -24, -30, -36, -48, -60] as const;
const FADER_SCALE = [
  { db: 0, position: 0 },
  { db: -3, position: 0.09 },
  { db: -6, position: 0.17 },
  { db: -9, position: 0.25 },
  { db: -12, position: 0.33 },
  { db: -18, position: 0.47 },
  { db: -24, position: 0.59 },
  { db: -30, position: 0.69 },
  { db: -36, position: 0.77 },
  { db: -48, position: 0.9 },
  { db: -60, position: 1 },
] as const;

interface MixerPanelProps {
  status: PlayerStatus | undefined;
  buffer: MeterBuffer;
  meterLive: boolean;
  onMusicVolume: (percent: number) => void;
  onMusicMute: (muted: boolean) => void;
  disabled: boolean;
}

interface DirectRequest {
  db: number;
  muted?: boolean;
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

function masterDetail(level: AudioLevel | undefined): string {
  if (!level) return 'Очікування стану MASTER';
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

  const statusLevel = (target: MixerTarget): AudioLevel | undefined => {
    if (target === 'master') {
      return props.status?.audio_levels.master ?? mixerState()?.master;
    }
    if (target === 'alert') {
      return props.status?.audio_levels.alert_bus ?? mixerState()?.alert;
    }
    const statusPercent = props.status?.audio_levels.music_bus ?? props.status?.volume;
    if (statusPercent !== undefined) {
      return levelFromPercent(statusPercent, props.status?.muted ?? false);
    }
    return mixerState()?.music;
  };

  const authoritativeLevel = (target: MixerTarget): AudioLevel | undefined => {
    if (target === 'music') return statusLevel(target);
    if (target === 'master' && props.status?.audio_levels.master) {
      return props.status.audio_levels.master;
    }
    if (target === 'alert' && props.status?.audio_levels.alert_bus) {
      return props.status.audio_levels.alert_bus;
    }
    return mixerState()?.[target] ?? statusLevel(target);
  };

  const level = (target: MixerTarget): AudioLevel | undefined => {
    if (target === 'music') return authoritativeLevel(target);
    return overrides()[target] ?? authoritativeLevel(target);
  };

  createEffect(() => {
    const current = overrides();
    let changed = false;
    const next = { ...current };
    for (const target of ['master', 'alert'] as const) {
      const local = current[target];
      const authoritative = authoritativeLevel(target);
      if (local && authoritative && levelsMatch(local, authoritative)) {
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
    if (!current || props.disabled) return;
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
      if (muted !== undefined) {
        props.onMusicMute(muted);
      } else {
        props.onMusicVolume(dbToPercent(db));
      }
      return;
    }
    queueDirect(target, db, muted);
  };

  return (
    <section class="pro-panel mixer-panel rounded-[28px] border p-5 sm:p-6">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">Mixer</p>
          <h2 class="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">Мікшер</h2>
          <p class="mt-1.5 text-xs leading-5 text-slate-500">
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
          {props.meterLive ? '25 Hz наживо' : 'Метри недоступні'}
        </div>
      </div>

      <div class="mixer-channels overflow-hidden pb-1" aria-label="Канали мікшера">
        <div class="mixer-grid grid min-w-0 grid-cols-3 gap-2.5">
          <MixerStrip
            target="music"
            label="MUSIC"
            level={level('music') ?? levelFromPercent(0, true)}
            buffer={props.buffer}
            meterLive={props.meterLive}
            blocked={
              props.disabled ||
              level('music') === undefined ||
              props.status?.priority.blocking === true
            }
            pending={false}
            detail="Музична шина"
            onSet={setLevel}
          />
          <MixerStrip
            target="alert"
            label="ALERT"
            level={level('alert') ?? levelFromPercent(0, true)}
            buffer={props.buffer}
            meterLive={props.meterLive}
            blocked={
              props.disabled ||
              level('alert') === undefined ||
              props.status?.priority.blocking === true
            }
            pending={pending('alert')}
            detail="Шина оповіщень"
            onSet={setLevel}
          />
          <MixerStrip
            target="master"
            label="MASTER"
            level={level('master') ?? levelFromPercent(0, true)}
            buffer={props.buffer}
            meterLive={props.meterLive}
            blocked={props.disabled || level('master') === undefined}
            pending={pending('master')}
            detail={masterDetail(level('master'))}
            onSet={setLevel}
          />
        </div>
      </div>

      <Show when={mixerState.loading && !props.status}>
        <p class="mt-3 text-xs text-slate-500" role="status">
          Завантаження стану мікшера…
        </p>
      </Show>

      <Show when={error()}>
        {(message) => (
          <div class="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-3.5 py-2.5 text-xs text-red-200/70">
            {message()}
          </div>
        )}
      </Show>

      <p class="mt-4 text-xs leading-5 text-slate-500">
        MUSIC + ALERT → MASTER → вибраний фізичний вихід. MASTER не прив’язаний до конкретного DAC,
        а MUSIC і регулятор плеєра використовують спільний стан. Shift під час перетягування або
        прокручування вмикає точне керування. Подвійний клік повертає 0 dB.
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
    if (!dragging() && !props.pending) {
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
  const thumbPosition = () => `${dbToFaderPosition(draft()) * 100}%`;

  return (
    <div
      class={
        props.blocked
          ? 'mixer-strip is-blocked min-w-0 rounded-2xl border p-3 opacity-45'
          : 'mixer-strip min-w-0 rounded-2xl border p-3'
      }
    >
      <div class="text-center text-[10px] font-bold tracking-[0.16em] text-slate-300">
        {props.label}
      </div>
      <div class="mt-1 truncate text-center font-mono text-[10px] text-slate-500">
        {props.detail}
      </div>

      <div class="mixer-strip-console mt-4 flex items-center justify-center gap-2.5">
        <MeterCanvas buffer={props.buffer} bus={bus()} />
        <div class="mixer-fader relative h-[292px] w-[72px] shrink-0 select-none">
          <For each={FADER_MARKS}>
            {(mark) => (
              <div
                class="mixer-db-mark pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center"
                style={{ top: `${dbToFaderPosition(mark) * 100}%` }}
              >
                <span class="w-6 pr-1 text-right font-mono text-[9px] text-slate-500 tabular-nums">
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
                ? 'mixer-fader-track absolute inset-y-0 right-0 left-7 cursor-not-allowed touch-none opacity-45'
                : dragging()
                  ? 'mixer-fader-track is-dragging absolute inset-y-0 right-0 left-7 cursor-grabbing touch-none outline-none'
                  : 'mixer-fader-track absolute inset-y-0 right-0 left-7 cursor-grab touch-none outline-none'
            }
            role="slider"
            tabIndex={props.blocked ? -1 : 0}
            aria-label={`Рівень ${props.label}`}
            aria-valuemin={MIN_DB}
            aria-valuemax={MAX_DB}
            aria-valuenow={draft()}
            aria-valuetext={`${props.level.muted ? 'Вимкнено, ' : ''}${
              displayDb() === '−∞' ? 'мінус нескінченність dB' : `${displayDb()} dB`
            }`}
            aria-disabled={props.blocked}
            onKeyDown={handleKeyDown}
            onWheel={(event) => {
              if (props.blocked) return;
              event.preventDefault();
              const step = event.shiftKey ? 0.1 : 0.5;
              const direction = event.deltaY < 0 ? 1 : -1;
              setKeyboardValue(draft() + direction * step);
            }}
            onDblClick={() => !props.blocked && setKeyboardValue(0)}
            onPointerDown={(event) => {
              if (props.blocked) return;
              event.preventDefault();
              dragStartY = event.clientY;
              dragStartPosition = dbToFaderPosition(draft());
              dragSensitivity = event.shiftKey ? 0.12 : 1;
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
            onLostPointerCapture={() => setDragging(false)}
          >
            <div class="mixer-fader-rail pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full border" />
            <div
              class="mixer-fader-thumb pointer-events-none absolute left-1/2 h-8 w-10 rounded-[6px] border will-change-transform"
              style={{ top: thumbPosition(), transform: 'translate(-50%, -50%)' }}
            >
              <span class="mixer-fader-thumb-line absolute top-1/2 left-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-3 text-center">
        <div class="font-mono text-sm font-semibold text-slate-100 tabular-nums">
          {displayDb()} <span class="text-[10px] font-normal text-slate-500">dB</span>
        </div>
        <div class="mt-1 font-mono text-[10px] text-slate-500 tabular-nums">
          {dbToPercent(draft()).toFixed(1)}%
        </div>
      </div>

      <div class="mt-3 flex justify-center">
        <button
          type="button"
          disabled={props.blocked}
          class={
            props.level.muted
              ? 'mixer-mute-button is-muted rounded-md border font-bold tracking-[0.12em] uppercase transition'
              : 'mixer-mute-button rounded-md border font-bold tracking-[0.12em] uppercase transition'
          }
          aria-pressed={props.level.muted}
          aria-label={`${props.level.muted ? 'Зняти Mute з' : 'Mute'} ${props.label}`}
          title={`${props.level.muted ? 'Unmute' : 'Mute'} ${props.label}`}
          onClick={() => props.onSet(props.target, draft(), !props.level.muted)}
        >
          <span class="mixer-mute-led" aria-hidden="true" />
          <span>MUTE</span>
        </button>
      </div>
      <div class="mt-2 h-3 text-center text-[9px] tracking-[0.08em] text-slate-500 uppercase">
        {props.pending ? 'синхронізація' : props.meterLive ? 'наживо' : ''}
      </div>
    </div>
  );
};

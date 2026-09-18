import { For, createEffect, createSignal, onCleanup, type Component } from 'solid-js';

import type { AudioLevel } from '../../api/types';
import { MAX_DB, MIN_DB, dbToPercent, roundDb } from '../../audio/scale';
import type { MeterBuffer, MeterBus } from '../../realtime/meter-buffer';
import { MeterCanvas } from './MeterCanvas';
import { FADER_MARKS, dbToFaderPosition, faderPositionToDb } from './fader-scale';

export type MixerTarget = 'master' | 'music' | 'alert';

const CONTROL_INTERVAL_MS = 20;

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

export const MixerStrip: Component<MixerStripProps> = (props) => {
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
          <div class="mixer-fader-scale pointer-events-none absolute inset-x-0">
            <For each={FADER_MARKS}>
              {(mark) => (
                <div
                  class="mixer-db-mark absolute inset-x-0 flex -translate-y-1/2 items-center"
                  style={{ top: `${dbToFaderPosition(mark) * 100}%` }}
                >
                  <span class="w-6 pr-1 text-right font-mono text-[9px] text-slate-500 tabular-nums">
                    {mark}
                  </span>
                  <span class="h-px flex-1 bg-white/[0.07]" />
                </div>
              )}
            </For>
          </div>

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
        {props.pending ? 'Застосування…' : ''}
      </div>
    </div>
  );
};

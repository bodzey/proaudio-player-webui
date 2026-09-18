import { Show, createEffect, createResource, createSignal, type Component } from 'solid-js';

import { api } from '../../api/client';
import type { AudioLevel, PlayerStatus } from '../../api/types';
import { MIN_DB, dbToPercent, percentToDb, roundDb } from '../../audio/scale';
import type { MeterBuffer } from '../../realtime/meter-buffer';
import { MixerStrip, type MixerTarget } from './MixerStrip';

type DirectTarget = Exclude<MixerTarget, 'music'>;

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
          <p class="mt-1.5 text-xs leading-5 text-slate-500">Рівні сигналу та гучність каналів.</p>
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
          {props.meterLive ? 'Онлайн' : 'Офлайн'}
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
            detail="Музика"
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
            detail="Оповіщення"
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
            detail="Головний вихід"
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
        Shift під час перетягування або прокручування вмикає точне керування. Подвійний клік
        повертає 0 dB.
      </p>
    </section>
  );
};


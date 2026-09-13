import { createSignal, onCleanup, onMount } from 'solid-js';

import { api } from '../api/client';
import { subscribeToStatusEvents } from '../api/events';
import type { PlayerAction, PlayerStatus } from '../api/types';

export type ConnectionState = 'connecting' | 'online' | 'reconnecting' | 'offline';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Невідома помилка';
}

function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

type MusicCommand = { kind: 'volume'; percent: number } | { kind: 'mute'; muted: boolean };

export function createPlayerState() {
  const [status, setStatus] = createSignal<PlayerStatus>();
  const [connection, setConnection] = createSignal<ConnectionState>('connecting');
  const [error, setError] = createSignal<string>();
  const [pendingAction, setPendingAction] = createSignal<PlayerAction>();

  let unsubscribe: (() => void) | undefined;
  let fallbackTimer: number | undefined;
  let musicWorker: Promise<void> | undefined;
  const musicQueue: MusicCommand[] = [];

  async function refresh(reportFailure = true): Promise<void> {
    try {
      setStatus(await api.status());
      if (reportFailure) {
        setConnection('online');
        setError(undefined);
      } else if (connection() === 'offline') {
        setConnection('reconnecting');
      }
    } catch (cause) {
      setConnection('offline');
      if (reportFailure) setError(errorMessage(cause));
    }
  }

  async function playerAction(action: PlayerAction): Promise<void> {
    if (pendingAction()) {
      return;
    }

    setPendingAction(action);
    try {
      await api.playerAction(action);
      await refresh(false);
      setError(undefined);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPendingAction(undefined);
    }
  }

  function optimisticVolume(percent: number): void {
    setStatus((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        volume: percent,
        muted: percent <= 0,
        audio_levels: {
          ...current.audio_levels,
          music_bus: percent,
        },
      };
    });
  }

  function optimisticMute(muted: boolean): void {
    setStatus((current) => (current ? { ...current, muted } : current));
  }

  function startMusicWorker(): void {
    if (musicWorker || musicQueue.length === 0) return;
    musicWorker = (async () => {
      try {
        while (musicQueue.length > 0) {
          const next = musicQueue.shift()!;
          if (next.kind === 'volume') {
            await api.setVolume(next.percent);
          } else {
            await api.setMute(next.muted);
          }
        }
        setError(undefined);
      } catch (cause) {
        musicQueue.length = 0;
        const message = errorMessage(cause);
        await refresh(false);
        setError(message);
      } finally {
        musicWorker = undefined;
        startMusicWorker();
      }
    })();
  }

  function enqueueMusic(command: MusicCommand): Promise<void> {
    const last = musicQueue.at(-1);
    if (command.kind === 'volume' && last?.kind === 'volume') {
      musicQueue[musicQueue.length - 1] = command;
    } else {
      musicQueue.push(command);
    }

    startMusicWorker();
    return musicWorker!;
  }

  function setVolume(percent: number): Promise<void> {
    const safe = clampVolume(percent);
    optimisticVolume(safe);
    return enqueueMusic({ kind: 'volume', percent: safe });
  }

  function setMute(muted: boolean): Promise<void> {
    optimisticMute(muted);
    return enqueueMusic({ kind: 'mute', muted });
  }

  function stopFallbackPolling(): void {
    if (fallbackTimer !== undefined) {
      window.clearInterval(fallbackTimer);
      fallbackTimer = undefined;
    }
  }

  function startFallbackPolling(): void {
    if (fallbackTimer !== undefined) return;
    fallbackTimer = window.setInterval(() => void refresh(false), 5000);
  }

  onMount(() => {
    void refresh();

    unsubscribe = subscribeToStatusEvents({
      onStatus: (next) => {
        setStatus((current) => {
          if (!current || (!musicWorker && musicQueue.length === 0)) {
            return next;
          }
          return {
            ...next,
            volume: current.volume,
            muted: current.muted,
            audio_levels: {
              ...next.audio_levels,
              music_bus: current.audio_levels.music_bus,
            },
          };
        });
        stopFallbackPolling();
        setConnection('online');
      },
      onOpen: () => {
        stopFallbackPolling();
        setConnection('online');
      },
      onError: (cause) => {
        setConnection((current) => (current === 'online' ? 'reconnecting' : 'offline'));
        startFallbackPolling();
        if (cause instanceof Error) {
          setError(errorMessage(cause));
        }
      },
    });
  });

  onCleanup(() => {
    stopFallbackPolling();
    unsubscribe?.();
  });

  return {
    status,
    connection,
    error,
    pendingAction,
    refresh,
    playerAction,
    setVolume,
    setMute,
  };
}

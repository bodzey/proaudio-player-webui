import { createSignal, onCleanup, onMount } from 'solid-js';

import { api } from '../api/client';
import { subscribeToStatusEvents } from '../api/events';
import type { PlayerAction, PlayerStatus } from '../api/types';

export type ConnectionState = 'connecting' | 'online' | 'reconnecting' | 'offline';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Невідома помилка';
}

function clampVolume(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function createPlayerState() {
  const [status, setStatus] = createSignal<PlayerStatus>();
  const [connection, setConnection] = createSignal<ConnectionState>('connecting');
  const [error, setError] = createSignal<string>();
  const [pendingAction, setPendingAction] = createSignal<PlayerAction>();

  let unsubscribe: (() => void) | undefined;
  let volumeWorker: Promise<void> | undefined;
  let queuedVolume: number | undefined;

  async function refresh(): Promise<void> {
    try {
      setStatus(await api.status());
      setConnection('online');
      setError(undefined);
    } catch (cause) {
      setConnection('offline');
      setError(errorMessage(cause));
    }
  }

  async function playerAction(action: PlayerAction): Promise<void> {
    if (pendingAction()) {
      return;
    }

    setPendingAction(action);
    try {
      await api.playerAction(action);
      await refresh();
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

  function setVolume(percent: number): Promise<void> {
    const safe = clampVolume(percent);
    optimisticVolume(safe);
    queuedVolume = safe;

    if (!volumeWorker) {
      volumeWorker = (async () => {
        try {
          while (queuedVolume !== undefined) {
            const next = queuedVolume;
            queuedVolume = undefined;
            await api.setVolume(next);
          }
          setError(undefined);
        } catch (cause) {
          queuedVolume = undefined;
          setError(errorMessage(cause));
          await refresh();
        } finally {
          volumeWorker = undefined;
          if (queuedVolume !== undefined) {
            void setVolume(queuedVolume);
          }
        }
      })();
    }

    return volumeWorker;
  }

  async function setMute(muted: boolean): Promise<void> {
    try {
      await api.setMute(muted);
      setStatus((current) => (current ? { ...current, muted } : current));
      setError(undefined);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  onMount(() => {
    void refresh();

    unsubscribe = subscribeToStatusEvents({
      onStatus: (next) => {
        setStatus((current) => {
          if (!current || (!volumeWorker && queuedVolume === undefined)) {
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
        setConnection('online');
        setError(undefined);
      },
      onOpen: () => {
        setConnection('online');
      },
      onError: (cause) => {
        setConnection((current) => (current === 'online' ? 'reconnecting' : 'offline'));
        if (cause instanceof Error) {
          setError(errorMessage(cause));
        }
      },
    });
  });

  onCleanup(() => {
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

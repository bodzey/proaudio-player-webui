import { createSignal, onCleanup, onMount } from 'solid-js';

import { api } from '../api/client';
import { subscribeToStatusEvents } from '../api/events';
import type { PlayerStatus } from '../api/types';

export type ConnectionState = 'connecting' | 'online' | 'reconnecting' | 'offline';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Невідома помилка';
}

export function createPlayerState() {
  const [status, setStatus] = createSignal<PlayerStatus>();
  const [connection, setConnection] = createSignal<ConnectionState>('connecting');
  const [error, setError] = createSignal<string>();

  let unsubscribe: (() => void) | undefined;

  async function refresh(): Promise<void> {
    try {
      setStatus(await api.status());
      setError(undefined);
    } catch (cause) {
      setConnection('offline');
      setError(errorMessage(cause));
    }
  }

  onMount(() => {
    void refresh();

    unsubscribe = subscribeToStatusEvents({
      onStatus: (next) => {
        setStatus(next);
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
    refresh,
  };
}

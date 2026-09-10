import type { PlayerStatus } from './types';

const STATUS_EVENTS_URL = '/api/v1/events';

export interface StatusEventHandlers {
  onStatus: (status: PlayerStatus) => void;
  onOpen?: () => void;
  onError?: (error: unknown) => void;
}

export function subscribeToStatusEvents(handlers: StatusEventHandlers): () => void {
  const source = new EventSource(STATUS_EVENTS_URL);

  source.addEventListener('status', (event) => {
    try {
      const message = event as MessageEvent<string>;
      handlers.onStatus(JSON.parse(message.data) as PlayerStatus);
    } catch (error) {
      handlers.onError?.(error);
    }
  });

  source.onopen = () => {
    handlers.onOpen?.();
  };

  source.onerror = (event) => {
    handlers.onError?.(event);
  };

  return () => source.close();
}

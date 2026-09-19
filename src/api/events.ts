import { DEMO_MODE, subscribeToDemoStatus } from './demo';
import type { PlayerStatus } from './types';
import { parsePlayerStatus } from './validation';

const STATUS_EVENTS_URL = '/api/v1/events';

export interface StatusEventHandlers {
  onStatus: (status: PlayerStatus) => void;
  onOpen?: () => void;
  onError?: (error: unknown) => void;
}

export function subscribeToStatusEvents(handlers: StatusEventHandlers): () => void {
  if (DEMO_MODE) {
    queueMicrotask(() => handlers.onOpen?.());
    return subscribeToDemoStatus(handlers.onStatus);
  }

  const source = new EventSource(STATUS_EVENTS_URL);

  source.addEventListener('status', (event) => {
    try {
      const message = event as MessageEvent<string>;
      const status = parsePlayerStatus(JSON.parse(message.data) as unknown);
      if (!status) throw new Error('Некоректний status event від сервера');
      handlers.onStatus(status);
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

import type {
  AlertProviderSettings,
  AlertProviderTestResponse,
  AlertProviderUpdate,
  ApiErrorPayload,
  AudioLevel,
  AudioOutputSelectionResponse,
  AudioOutputsResponse,
  AudioSettings,
  AudioSettingsUpdate,
  CapabilitiesResponse,
  HealthResponse,
  JsonObject,
  MixerState,
  PlayerAction,
} from './types';
import { parsePlayerStatus } from './validation';

const API_BASE = '/api/v1';
const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  headers.set('accept', 'application/json');

  const controller = new AbortController();
  const relayAbort = () => controller.abort(init?.signal?.reason);
  if (init?.signal?.aborted) {
    relayAbort();
  } else {
    init?.signal?.addEventListener('abort', relayAbort, { once: true });
  }
  const timer = window.setTimeout(() => controller.abort('timeout'), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (cause) {
    if (init?.signal?.aborted) {
      throw new ApiError(0, 'Запит скасовано');
    }
    if (controller.signal.aborted && !init?.signal?.aborted) {
      throw new ApiError(0, 'Сервер не відповів вчасно');
    }
    if (cause instanceof Error && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, 'Немає зв’язку з плеєром');
  } finally {
    window.clearTimeout(timer);
    init?.signal?.removeEventListener('abort', relayAbort);
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      if (payload.error) message = payload.error;
    } catch {
      // HTTP status remains authoritative when the response body is not JSON.
    }
    throw new ApiError(response.status, message);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, 'Сервер повернув некоректну відповідь');
  }
}

function jsonBody(value: unknown): Pick<RequestInit, 'body' | 'headers'> {
  return {
    body: JSON.stringify(value),
    headers: { 'content-type': 'application/json' },
  };
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  capabilities: () => request<CapabilitiesResponse>('/capabilities'),
  status: async () => {
    const status = parsePlayerStatus(await request<unknown>('/status'));
    if (!status) throw new ApiError(502, 'Сервер повернув некоректний стан плеєра');
    return status;
  },
  mixer: () => request<MixerState>('/audio/mixer'),
  audioOutputs: () => request<AudioOutputsResponse>('/audio/outputs'),
  alertSettings: () => request<AlertProviderSettings>('/settings/alerts'),
  audioSettings: () => request<AudioSettings>('/settings/audio'),

  playerAction: (action: PlayerAction) =>
    request<JsonObject>('/player', {
      method: 'POST',
      ...jsonBody({ action }),
    }),

  setVolume: (percent: number) =>
    request<{ volume: number; muted: boolean }>('/volume', {
      method: 'POST',
      ...jsonBody({ percent }),
    }),

  setMute: (muted: boolean) =>
    request<{ muted: boolean }>('/mute', {
      method: 'POST',
      ...jsonBody({ muted }),
    }),

  setAudioLevel: (target: 'master' | 'music' | 'alert', percent: number) =>
    request<AudioLevel>('/audio/level', {
      method: 'POST',
      ...jsonBody({ target, percent }),
    }),

  setMixer: (target: 'master' | 'music' | 'alert', db: number, muted?: boolean) =>
    request<MixerState>('/audio/mixer', {
      method: 'POST',
      ...jsonBody(muted === undefined ? { target, db } : { target, db, muted }),
    }),

  selectAudioOutput: (id: string) =>
    request<AudioOutputSelectionResponse>('/audio/outputs', {
      method: 'POST',
      ...jsonBody({ id }),
    }),

  playStream: (url: string) =>
    request<{ playing: string; source: string }>('/streams/play', {
      method: 'POST',
      ...jsonBody({ url }),
    }),

  setAlertSettings: (settings: AlertProviderUpdate) =>
    request<AlertProviderSettings>('/settings/alerts', {
      method: 'PUT',
      ...jsonBody(settings),
    }),

  testAlertSettings: (settings: AlertProviderUpdate) =>
    request<AlertProviderTestResponse>(
      '/settings/alerts/test',
      {
        method: 'POST',
        ...jsonBody(settings),
      },
      125_000,
    ),

  setAudioSettings: (settings: AudioSettingsUpdate) =>
    request<AudioSettings>('/settings/audio', {
      method: 'PUT',
      ...jsonBody(settings),
    }),
};

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
  PlayerStatus,
} from './types';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  headers.set('accept', 'application/json');

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

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

  return (await response.json()) as T;
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
  status: () => request<PlayerStatus>('/status'),
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
    request<AlertProviderTestResponse>('/settings/alerts/test', {
      method: 'POST',
      ...jsonBody(settings),
    }),

  setAudioSettings: (settings: AudioSettingsUpdate) =>
    request<AudioSettings>('/settings/audio', {
      method: 'PUT',
      ...jsonBody(settings),
    }),
};

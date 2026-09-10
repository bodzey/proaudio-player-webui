export type JsonObject = Record<string, unknown>;

export interface HealthResponse {
  status: string;
  api_version: string;
}

export interface CapabilitiesResponse {
  api_version: string;
  events: string;
  features: string[];
}

export interface PlayerControls {
  play: boolean;
  pause: boolean;
  stop: boolean;
  next: boolean;
  prev: boolean;
}

export interface PlayerView {
  source: string;
  backend: string;
  state: 'playing' | 'paused' | 'stopped' | string;
  title: string;
  artist: string;
  album: string;
  art_url: string | null;
  position_seconds: number | null;
  duration_seconds: number | null;
  elapsed: string | null;
  duration: string | null;
  progress: number;
  controls: PlayerControls;
}

export interface PlayerStatus {
  name: string;
  volume: number;
  muted: boolean;
  priority: JsonObject;
  mpd: JsonObject;
  sources: JsonObject[];
  audio_levels: JsonObject;
  player: PlayerView;
}

export interface ApiErrorPayload {
  error?: string;
}

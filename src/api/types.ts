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

export type PlayerAction = keyof PlayerControls;

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

export interface PriorityState {
  mode: string;
  active: boolean;
  blocking: boolean;
  duck_only_during_announcement: boolean;
  minute_silence_active: boolean;
  matched_uids: number[];
  last_success_at: string | null;
  last_change_at: string | null;
  last_error: string | null;
}

export interface ActiveSource {
  key: string;
  active: boolean;
  type: string;
  application: string;
  media: string;
}

export interface AudioLevel {
  name?: string;
  volume: number;
  db: number;
  muted: boolean;
  backend?: string;
  card?: number;
  card_name?: string;
  control?: string;
  db_min?: number;
  db_max?: number;
  db_reference?: number;
}

export interface AudioLevels {
  music_bus: number;
  physical: AudioLevel | null;
  hardware: AudioLevel | null;
  alert_bus: AudioLevel | null;
}

export interface MixerState {
  music: AudioLevel;
  alert: AudioLevel;
  master: AudioLevel;
}

export interface PlayerStatus {
  name: string;
  volume: number;
  muted: boolean;
  priority: PriorityState;
  mpd: JsonObject;
  sources: ActiveSource[];
  audio_levels: AudioLevels;
  player: PlayerView;
}

export interface ApiErrorPayload {
  error?: string;
}

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

export interface MpdStatus extends JsonObject {
  available?: boolean | undefined;
  state?: string | undefined;
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
  station?: string | undefined;
  is_stream?: boolean | undefined;
  stream_url?: string | null | undefined;
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
  name?: string | undefined;
  volume: number;
  db: number;
  muted: boolean;
  backend?: string | undefined;
  transport_backend?: string | undefined;
  card?: number | undefined;
  card_name?: string | undefined;
  control?: string | undefined;
  db_min?: number | undefined;
  db_max?: number | undefined;
  db_reference?: number | undefined;
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

export interface AudioOutput {
  id: string;
  name: string;
  state: string;
  device_class: string;
  alsa_card: number | null;
  selected: boolean;
  available: boolean;
}

export interface AudioOutputsResponse {
  items: AudioOutput[];
}

export interface AudioOutputSelectionResponse {
  selected: AudioOutput;
  applying: boolean;
  applied: boolean;
}

export interface AlertProviderSettings {
  endpoint: string;
  location_uid: number;
  location_type: string;
  poll_interval_seconds: number;
  request_timeout_seconds: number;
  rate_limit_backoff_seconds: number;
  clear_confirmations: number;
  token_configured: boolean;
}

export interface AlertProviderUpdate {
  endpoint: string;
  location_uid: number;
  location_type: string;
  poll_interval_seconds: number;
  request_timeout_seconds: number;
  rate_limit_backoff_seconds: number;
  clear_confirmations: number;
  token?: string | undefined;
}

export interface AlertProviderTestResponse {
  ok: boolean;
  active: boolean;
  state: string;
  location_uid: number;
}

export interface AudioSettings {
  duck_db: number;
  duck_fade_seconds: number;
  restore_fade_seconds: number;
  alert_volume_percent: number;
  default_restore_volume_percent: number;
  minute_silence_volume_percent: number;
  alert_repeat_interval_minutes: number;
  duck_only_during_announcement: boolean;
  sample_rate_mode: string;
  sample_rate: number;
  allowed_sample_rates: number[];
}

export interface AudioSettingsUpdate {
  duck_db: number;
  duck_fade_seconds: number;
  restore_fade_seconds: number;
  alert_volume_percent: number;
  default_restore_volume_percent: number;
  minute_silence_volume_percent: number;
  alert_repeat_interval_minutes: number;
  duck_only_during_announcement: boolean;
}

export interface PlayerStatus {
  name: string;
  volume: number;
  muted: boolean;
  priority: PriorityState;
  mpd: MpdStatus;
  sources: ActiveSource[];
  audio_levels: AudioLevels;
  player: PlayerView;
}

export interface ApiErrorPayload {
  error?: string | undefined;
}

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

export interface ReleaseInfo {
  version: string | null;
  channel: string | null;
  status: string | null;
  build_id: string | null;
  firmware_sha: string | null;
  native_sha: string | null;
  webui_sha: string | null;
}

export interface SystemInfoResponse {
  temperature_celsius: number | null;
  native_version?: string | null | undefined;
  release: ReleaseInfo;
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
  hardware_db?: number | null | undefined;
  db_min?: number | null | undefined;
  db_max?: number | null | undefined;
  db_reference?: number | null | undefined;
  raw_min?: number | null | undefined;
  raw_max?: number | null | undefined;
}

export interface AudioLevels {
  music_bus: number;
  master: AudioLevel | null;
  physical: AudioLevel | null;
  hardware: AudioLevel | null;
  alert_bus: AudioLevel | null;
}

export interface MixerState {
  music: AudioLevel;
  alert: AudioLevel;
  master: AudioLevel;
}

export interface AudioOutputCapabilities {
  sample_format: string | null;
  sample_rate: number | null;
  channels: number | null;
  channel_map: string[];
  alsa_device: number | null;
  device_api: string | null;
  device_bus: string | null;
}

export interface AudioOutput {
  id: string;
  name: string;
  state: string;
  device_class: string;
  alsa_card: number | null;
  selected: boolean;
  available: boolean;
  capabilities: AudioOutputCapabilities;
}

export interface AudioOutputsResponse {
  items: AudioOutput[];
}

export interface AudioOutputSelectionResponse {
  selected: AudioOutput;
  applying: boolean;
  applied: boolean;
}

export interface RadioDirectoryStation {
  id: string;
  name: string;
  url: string;
  homepage: string | null;
  favicon: string | null;
  tags: string[];
  codec: string | null;
  bitrate: number | null;
  votes: number;
}

export interface RadioDirectoryResponse {
  source: string;
  items: RadioDirectoryStation[];
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
  air_raid_alerts_enabled: boolean;
  notifications_enabled?: boolean | undefined;
  duck_db: number;
  duck_fade_seconds: number;
  restore_fade_seconds: number;
  alert_volume_percent: number;
  default_restore_volume_percent: number;
  minute_silence_volume_percent: number;
  minute_silence_enabled: boolean;
  minute_silence_start_time: string;
  minute_silence_timezone: string;
  minute_silence_catch_up_seconds: number;
  minute_silence_music_fade_seconds: number;
  alert_repeat_interval_minutes: number;
  duck_only_during_announcement: boolean;
  sample_rate_mode: string;
  sample_rate: number;
  allowed_sample_rates: number[];
}

export interface AudioSettingsUpdate {
  air_raid_alerts_enabled: boolean;
  notifications_enabled?: boolean | undefined;
  duck_db: number;
  duck_fade_seconds: number;
  restore_fade_seconds: number;
  alert_volume_percent?: number | undefined;
  default_restore_volume_percent: number;
  minute_silence_volume_percent: number;
  minute_silence_enabled: boolean;
  minute_silence_start_time: string;
  minute_silence_timezone: string;
  minute_silence_catch_up_seconds: number;
  minute_silence_music_fade_seconds: number;
  alert_repeat_interval_minutes: number;
  duck_only_during_announcement: boolean;
}

export type AlertMediaKind = 'alarm_start' | 'alarm_end' | 'minute_silence';

export interface AlertMediaFile {
  kind: AlertMediaKind;
  label: string;
  file_name: string;
  configured: boolean;
  size_bytes: number | null;
  modified_unix_seconds: number | null;
  max_size_bytes: number;
  content_type: string;
}

export interface AlertMediaResponse {
  items: AlertMediaFile[];
  accepted_content_types: string[];
  max_size_bytes: number;
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

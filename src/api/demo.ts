import { dbToPercent, percentToDb } from '../audio/scale';
import { demoRadioDirectory } from './demo-radio';

import type {
  AlertMediaFile,
  AlertMediaResponse,
  AlertProviderSettings,
  AlertProviderTestResponse,
  AudioLevel,
  AudioOutputsResponse,
  AudioSettings,
  CapabilitiesResponse,
  HealthResponse,
  MixerState,
  PlayerAction,
  PlayerStatus,
  RadioDirectoryResponse,
  SystemInfoResponse,
} from './types';

export const DEMO_MODE = import.meta.env.VITE_DEMO === 'true';

const clone = <T>(value: T): T => structuredClone(value);

const DEFAULT_MIXER_PERCENT = dbToPercent(-3);
const DEMO_TRACKS = [
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: 200,
  },
  {
    title: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We’re Dreaming',
    duration: 244,
  },
  {
    title: 'Strobe',
    artist: 'deadmau5',
    album: 'For Lack of a Better Name',
    duration: 635,
  },
] as const;

let demoTrackIndex = 0;
let statusListeners = new Set<(status: PlayerStatus) => void>();
let statusClock: number | undefined;
let lastClockAt = 0;

function level(volume: number, extra: Partial<AudioLevel> = {}): AudioLevel {
  return {
    volume,
    db: percentToDb(volume),
    muted: volume <= 0,
    ...extra,
  };
}

let mixer: MixerState = {
  music: level(DEFAULT_MIXER_PERCENT, {
    name: 'MUSIC',
    backend: 'pipewire',
    control: 'proaudio_player_music',
  }),
  alert: level(DEFAULT_MIXER_PERCENT, {
    name: 'ALERT',
    backend: 'pipewire',
    control: 'proaudio_player_alert',
  }),
  master: level(DEFAULT_MIXER_PERCENT, {
    name: 'MASTER',
    backend: 'pipewire',
    transport_backend: 'alsa',
    card: 1,
    card_name: 'USB Audio DAC',
    control: 'PCM',
  }),
};

function trackPlayer(index: number) {
  const track = DEMO_TRACKS[index]!;
  return {
    source: 'Spotify Connect',
    backend: 'spotify-mpris',
    state: 'playing',
    title: track.title,
    artist: track.artist,
    album: track.album,
    art_url: '/assets/pwa-512.png',
    position_seconds: 87,
    duration_seconds: track.duration,
    elapsed: '1:27',
    duration: formatClock(track.duration),
    progress: (87 / track.duration) * 100,
    controls: { play: true, pause: true, stop: true, next: true, prev: true },
  } satisfies PlayerStatus['player'];
}

let status: PlayerStatus = {
  name: 'ProAudio Player',
  volume: DEFAULT_MIXER_PERCENT,
  muted: false,
  priority: {
    mode: 'normal',
    active: false,
    blocking: false,
    duck_only_during_announcement: true,
    minute_silence_active: false,
    matched_uids: [],
    last_success_at: '2026-09-19T15:52:11Z',
    last_change_at: '2026-09-19T08:03:55Z',
    last_error: null,
  },
  mpd: {
    available: true,
    state: 'stop',
    title: '',
    artist: '',
    album: '',
    station: '',
    is_stream: false,
    stream_url: null,
  },
  sources: [
    {
      key: 'spotify',
      active: true,
      type: 'Spotify Connect',
      application: 'spotifyd',
      media: 'The Weeknd · Blinding Lights',
    },
    {
      key: 'airplay',
      active: false,
      type: 'AirPlay',
      application: 'shairport-sync',
      media: 'iPhone · AirPlay receiver',
    },
    {
      key: 'dlna',
      active: false,
      type: 'DLNA / UPnP',
      application: 'gmediarender',
      media: 'Windows / Android renderer',
    },
    {
      key: 'mpd',
      active: false,
      type: 'Internet Radio / MPD',
      application: 'mpd',
      media: 'Network stream',
    },
  ],
  audio_levels: {
    music_bus: DEFAULT_MIXER_PERCENT,
    master: mixer.master,
    physical: mixer.master,
    hardware: level(74, {
      name: 'Hardware',
      backend: 'alsa',
      transport_backend: 'alsa',
      card: 1,
      card_name: 'USB Audio DAC',
      control: 'PCM',
      hardware_db: -6,
      db_min: -64,
      db_max: 0,
      db_reference: 0,
      raw_min: 0,
      raw_max: 255,
    }),
    alert_bus: mixer.alert,
  },
  player: trackPlayer(demoTrackIndex),
};

let outputs: AudioOutputsResponse = {
  items: [
    {
      id: 'alsa:usb',
      name: 'USB Audio DAC',
      state: 'running',
      device_class: 'sound',
      alsa_card: 1,
      selected: true,
      available: true,
      capabilities: {
        sample_format: 'S24LE',
        sample_rate: 48000,
        channels: 2,
        channel_map: ['FL', 'FR'],
        alsa_device: 0,
        device_api: 'alsa',
        device_bus: 'usb',
      },
    },
    {
      id: 'alsa:hdmi',
      name: 'HDMI Audio',
      state: 'idle',
      device_class: 'sound',
      alsa_card: 2,
      selected: false,
      available: true,
      capabilities: {
        sample_format: 'S32LE',
        sample_rate: 48000,
        channels: 2,
        channel_map: ['FL', 'FR'],
        alsa_device: 0,
        device_api: 'alsa',
        device_bus: 'platform',
      },
    },
    {
      id: 'alsa:analog',
      name: 'Analog Output',
      state: 'suspended',
      device_class: 'sound',
      alsa_card: 0,
      selected: false,
      available: false,
      capabilities: {
        sample_format: 'S16LE',
        sample_rate: 44100,
        channels: 2,
        channel_map: ['FL', 'FR'],
        alsa_device: 0,
        device_api: 'alsa',
        device_bus: 'platform',
      },
    },
  ],
};

let alertSettings: AlertProviderSettings = {
  endpoint: 'https://api.alerts.in.ua/v1/iot/active_air_raid_alerts/{uid}.json',
  location_uid: 1133,
  location_type: 'community',
  poll_interval_seconds: 8,
  request_timeout_seconds: 7,
  rate_limit_backoff_seconds: 60,
  clear_confirmations: 2,
  token_configured: true,
};

let audioSettings: AudioSettings = {
  air_raid_alerts_enabled: true,
  notifications_enabled: true,
  duck_db: -12,
  duck_fade_seconds: 1,
  restore_fade_seconds: 3,
  alert_volume_percent: DEFAULT_MIXER_PERCENT,
  default_restore_volume_percent: DEFAULT_MIXER_PERCENT,
  minute_silence_volume_percent: 100,
  minute_silence_enabled: true,
  minute_silence_start_time: '08:59:50',
  minute_silence_timezone: 'Europe/Kyiv',
  minute_silence_catch_up_seconds: 120,
  minute_silence_music_fade_seconds: 1,
  alert_repeat_interval_minutes: 0,
  duck_only_during_announcement: true,
  sample_rate_mode: 'fixed',
  sample_rate: 48000,
  allowed_sample_rates: [44100, 48000, 96000],
};

const FACTORY_MEDIA: AlertMediaResponse = {
  items: [
    {
      kind: 'alarm_start',
      label: 'Повітряна тривога',
      file_name: 'alarm_start.mp3',
      configured: true,
      size_bytes: 56320,
      modified_unix_seconds: 1789821000,
      max_size_bytes: 10485760,
      content_type: 'audio/mpeg',
    },
    {
      kind: 'alarm_end',
      label: 'Відбій тривоги',
      file_name: 'alarm_end.mp3',
      configured: true,
      size_bytes: 37888,
      modified_unix_seconds: 1789821000,
      max_size_bytes: 10485760,
      content_type: 'audio/mpeg',
    },
    {
      kind: 'minute_silence',
      label: 'Хвилина мовчання',
      file_name: 'minute_silence.mp3',
      configured: true,
      size_bytes: 414720,
      modified_unix_seconds: 1789821000,
      max_size_bytes: 10485760,
      content_type: 'audio/mpeg',
    },
  ],
  accepted_content_types: ['audio/mpeg', 'audio/mp3'],
  max_size_bytes: 10485760,
};

let media: AlertMediaResponse = clone(FACTORY_MEDIA);
let radioDirectory: RadioDirectoryResponse | undefined;

export const demoSystemInfo: SystemInfoResponse = {
  temperature_celsius: 49.8,
  native_version: '0.1.0',
  release: {
    version: '0.1.0',
    channel: 'dev',
    status: 'demo',
    build_id: 'netlify-demo',
    firmware_sha: 'demo-firmware',
    native_sha: 'demo-native',
    webui_sha: 'demo-webui',
  },
};

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function jsonBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {};
  try {
    const value = JSON.parse(init.body) as unknown;
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function emitStatus(): void {
  if (statusListeners.size === 0) return;
  const snapshot = clone(status);
  for (const listener of statusListeners) listener(snapshot);
}

function updateStatus(next: PlayerStatus): void {
  status = next;
  emitStatus();
}

function sourceState(activeKey: string, mediaText: string): PlayerStatus['sources'] {
  return status.sources.map((source) => ({
    ...source,
    active: source.key === activeKey,
    media: source.key === activeKey ? mediaText : source.media,
  }));
}

function syncLevels(): void {
  status = {
    ...status,
    volume: mixer.music.volume,
    muted: mixer.music.muted,
    audio_levels: {
      ...status.audio_levels,
      music_bus: mixer.music.volume,
      master: mixer.master,
      physical: mixer.master,
      alert_bus: mixer.alert,
    },
  };
  emitStatus();
}

function setMixerLevel(target: 'master' | 'music' | 'alert', db: number, muted?: boolean): void {
  const current = mixer[target];
  const next: AudioLevel = {
    ...current,
    db,
    volume: dbToPercent(db),
    muted: muted ?? db <= -60,
  };
  mixer = { ...mixer, [target]: next };
  syncLevels();
}

function selectDemoTrack(step: -1 | 1): void {
  demoTrackIndex = (demoTrackIndex + step + DEMO_TRACKS.length) % DEMO_TRACKS.length;
  const player = trackPlayer(demoTrackIndex);
  updateStatus({
    ...status,
    mpd: { ...status.mpd, is_stream: false, stream_url: null, state: 'stop' },
    sources: sourceState('spotify', `${player.artist} · ${player.title}`),
    player: { ...player, position_seconds: 0, elapsed: '0:00', progress: 0 },
  });
}

function handlePlayerAction(action: PlayerAction): void {
  if (action === 'next') {
    selectDemoTrack(1);
    return;
  }
  if (action === 'prev') {
    selectDemoTrack(-1);
    return;
  }

  const state = action === 'pause' ? 'paused' : action === 'stop' ? 'stopped' : 'playing';
  const stoppingRadio = action === 'stop' && status.player.backend === 'mpd';

  updateStatus({
    ...status,
    mpd: stoppingRadio
      ? {
          ...status.mpd,
          state: 'stop',
          title: '',
          artist: '',
          album: '',
          station: '',
          is_stream: false,
          stream_url: null,
        }
      : status.mpd,
    sources: stoppingRadio
      ? status.sources.map((source) => ({ ...source, active: false }))
      : status.sources,
    player: { ...status.player, state },
  });
}

function updatePlayerClock(): void {
  if (status.player.state !== 'playing') {
    lastClockAt = performance.now();
    return;
  }

  const duration = status.player.duration_seconds;
  const position = status.player.position_seconds;
  if (duration === null || position === null || duration <= 0) {
    lastClockAt = performance.now();
    return;
  }

  const now = performance.now();
  const elapsedSeconds = lastClockAt > 0 ? Math.max(0, (now - lastClockAt) / 1000) : 1;
  lastClockAt = now;
  const nextPosition = Math.min(duration, position + elapsedSeconds);

  status = {
    ...status,
    player: {
      ...status.player,
      position_seconds: nextPosition,
      elapsed: formatClock(nextPosition),
      progress: Math.min(100, (nextPosition / duration) * 100),
    },
  };
  emitStatus();
}

function startStatusClock(): void {
  if (statusClock !== undefined) return;
  lastClockAt = performance.now();
  statusClock = globalThis.setInterval(updatePlayerClock, 1000) as unknown as number;
}

function stopStatusClock(): void {
  if (statusClock === undefined) return;
  globalThis.clearInterval(statusClock);
  statusClock = undefined;
  lastClockAt = 0;
}

export function subscribeToDemoStatus(listener: (status: PlayerStatus) => void): () => void {
  statusListeners.add(listener);
  queueMicrotask(() => listener(clone(status)));
  startStatusClock();

  return () => {
    statusListeners.delete(listener);
    if (statusListeners.size === 0) stopStatusClock();
  };
}

function fileSize(init?: RequestInit): number | null {
  const body = init?.body;
  return typeof Blob !== 'undefined' && body instanceof Blob ? body.size : null;
}

function fileName(init?: RequestInit, fallback: string): string {
  const body = init?.body;
  if (typeof File !== 'undefined' && body instanceof File && body.name.trim()) return body.name;
  return fallback;
}

async function getRadioDirectory(): Promise<RadioDirectoryResponse> {
  radioDirectory ??= await demoRadioDirectory();
  return radioDirectory;
}

export async function demoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = jsonBody(init);

  if (method === 'GET' && path === '/health') {
    return clone({ status: 'ok', api_version: '1' } satisfies HealthResponse) as T;
  }
  if (method === 'GET' && path === '/capabilities') {
    return clone({
      api_version: '1',
      events: 'sse',
      features: [
        'status',
        'player_control',
        'audio_mixer',
        'audio_outputs',
        'audio_diagnostics',
        'audio_hardware_read_only',
        'audio_settings',
        'meters',
        'library',
        'playlists',
        'queue',
        'network_streams',
        'alert_settings',
        'alert_media',
      ],
    } satisfies CapabilitiesResponse) as T;
  }
  if (method === 'GET' && path === '/status') return clone(status) as T;
  if (method === 'GET' && path === '/audio/mixer') return clone(mixer) as T;
  if (method === 'GET' && path === '/audio/outputs') return clone(outputs) as T;
  if (method === 'GET' && path === '/radio/stations') return clone(await getRadioDirectory()) as T;
  if (method === 'GET' && path === '/settings/alerts') return clone(alertSettings) as T;
  if (method === 'GET' && path === '/settings/audio') return clone(audioSettings) as T;
  if (method === 'GET' && path === '/settings/alerts/media') return clone(media) as T;

  if (method === 'POST' && path === '/player') {
    handlePlayerAction(String(body.action ?? 'play') as PlayerAction);
    return clone({ ok: true }) as T;
  }

  if (method === 'POST' && path === '/volume') {
    const volume = Math.max(0, Math.min(100, Number(body.percent ?? status.volume)));
    mixer = {
      ...mixer,
      music: { ...mixer.music, volume, db: percentToDb(volume), muted: volume <= 0 },
    };
    syncLevels();
    return clone({ volume, muted: mixer.music.muted }) as T;
  }

  if (method === 'POST' && path === '/mute') {
    const muted = Boolean(body.muted);
    mixer = { ...mixer, music: { ...mixer.music, muted } };
    syncLevels();
    return clone({ muted }) as T;
  }

  if (method === 'POST' && path === '/audio/mixer') {
    const target = String(body.target) as 'master' | 'music' | 'alert';
    if (target === 'master' || target === 'music' || target === 'alert') {
      setMixerLevel(target, Number(body.db ?? mixer[target].db), body.muted as boolean | undefined);
    }
    return clone(mixer) as T;
  }

  if (method === 'POST' && path === '/audio/level') {
    const target = String(body.target) as 'master' | 'music' | 'alert';
    const volume = Math.max(0, Math.min(100, Number(body.percent ?? 0)));
    if (target === 'master' || target === 'music' || target === 'alert') {
      mixer = {
        ...mixer,
        [target]: { ...mixer[target], volume, db: percentToDb(volume), muted: volume <= 0 },
      };
      syncLevels();
      return clone(mixer[target]) as T;
    }
  }

  if (method === 'POST' && path === '/audio/outputs') {
    const id = String(body.id ?? '');
    outputs = {
      items: outputs.items.map((item) => ({
        ...item,
        selected: item.id === id,
        state: item.id === id ? 'running' : item.state === 'running' ? 'idle' : item.state,
      })),
    };
    const selected = outputs.items.find((item) => item.selected) ?? outputs.items[0]!;
    mixer = {
      ...mixer,
      master: {
        ...mixer.master,
        card: selected.alsa_card ?? undefined,
        card_name: selected.name,
        control: 'PCM',
      },
    };
    syncLevels();
    return clone({ selected, applying: false, applied: true }) as T;
  }

  if (method === 'POST' && path === '/streams/play') {
    const url = String(body.url ?? '').trim();
    const directory = await getRadioDirectory();
    const station = directory.items.find((item) => item.url === url);
    const stationName = station?.name ?? 'Власний потік';

    updateStatus({
      ...status,
      mpd: {
        ...status.mpd,
        available: true,
        state: 'play',
        title: stationName,
        artist: '',
        album: '',
        station: stationName,
        is_stream: true,
        stream_url: url,
      },
      sources: sourceState('mpd', stationName),
      player: {
        source: 'Інтернет-радіо',
        backend: 'mpd',
        state: 'playing',
        title: stationName,
        artist: '',
        album: '',
        art_url: station?.favicon ?? null,
        position_seconds: null,
        duration_seconds: null,
        elapsed: null,
        duration: null,
        progress: 0,
        controls: { play: true, pause: true, stop: true, next: false, prev: false },
      },
    });
    return clone({ playing: url, source: 'network_stream' }) as T;
  }

  if (method === 'PUT' && path === '/settings/alerts') {
    alertSettings = { ...alertSettings, ...body, token_configured: true } as AlertProviderSettings;
    return clone(alertSettings) as T;
  }

  if (method === 'POST' && path === '/settings/alerts/test') {
    const result: AlertProviderTestResponse = {
      ok: true,
      active: false,
      state: 'clear',
      location_uid: Number(body.location_uid ?? alertSettings.location_uid),
    };
    return clone(result) as T;
  }

  if (method === 'PUT' && path === '/settings/audio') {
    audioSettings = { ...audioSettings, ...body } as AudioSettings;
    status = {
      ...status,
      priority: {
        ...status.priority,
        duck_only_during_announcement: audioSettings.duck_only_during_announcement,
      },
    };
    emitStatus();
    return clone(audioSettings) as T;
  }

  const mediaMatch = path.match(
    /^\/settings\/alerts\/media\/(alarm_start|alarm_end|minute_silence)$/,
  );
  if (mediaMatch && (method === 'PUT' || method === 'DELETE')) {
    const kind = mediaMatch[1] as AlertMediaFile['kind'];
    const factory = FACTORY_MEDIA.items.find((item) => item.kind === kind)!;

    media = {
      ...media,
      items: media.items.map((item) => {
        if (item.kind !== kind) return item;
        if (method === 'DELETE') return clone(factory);
        return {
          ...item,
          configured: true,
          file_name: fileName(init, item.file_name),
          size_bytes: fileSize(init) ?? item.size_bytes,
          modified_unix_seconds: Math.floor(Date.now() / 1000),
          content_type: 'audio/mpeg',
        };
      }),
    };

    return clone(media.items.find((item) => item.kind === kind)!) as T;
  }

  throw new Error(`Demo API route is not implemented: ${method} ${path}`);
}

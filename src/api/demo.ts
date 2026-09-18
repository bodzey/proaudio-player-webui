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
  PlayerStatus,
  SystemInfoResponse,
} from './types';

export const DEMO_MODE = import.meta.env.VITE_DEMO === 'true';

const clone = <T>(value: T): T => structuredClone(value);

function percentToDb(percent: number): number {
  if (percent <= 0) return -60;
  return Math.max(-60, Math.min(0, Math.round(20 * Math.log10(percent / 100) * 10) / 10));
}

function dbToPercent(db: number): number {
  if (db <= -60) return 0;
  return Math.max(0, Math.min(100, Math.round(1000 * Math.pow(10, db / 20)) / 10));
}

function level(volume: number, extra: Partial<AudioLevel> = {}): AudioLevel {
  return {
    volume,
    db: percentToDb(volume),
    muted: volume <= 0,
    ...extra,
  };
}

let mixer: MixerState = {
  music: level(49, { name: 'MUSIC', backend: 'pipewire', control: 'proaudio_player_music' }),
  alert: level(25, { name: 'ALERT', backend: 'pipewire', control: 'proaudio_player_alert' }),
  master: level(94, {
    name: 'MASTER',
    backend: 'pipewire',
    transport_backend: 'alsa',
    card_name: 'bcm2835 Headphones',
    control: 'Analog Stereo',
  }),
};

let status: PlayerStatus = {
  name: 'ProAudio Player',
  volume: 49,
  muted: false,
  priority: {
    mode: 'normal',
    active: false,
    blocking: false,
    duck_only_during_announcement: true,
    minute_silence_active: false,
    matched_uids: [],
    last_success_at: '2026-09-18T07:52:11Z',
    last_change_at: '2026-09-15T12:03:55Z',
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
  ],
  audio_levels: {
    music_bus: 49,
    master: mixer.master,
    physical: mixer.master,
    hardware: null,
    alert_bus: mixer.alert,
  },
  player: {
    source: 'Spotify Connect',
    backend: 'spotify-mpris',
    state: 'playing',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    art_url: null,
    position_seconds: 87,
    duration_seconds: 200,
    elapsed: '1:27',
    duration: '3:20',
    progress: 43.5,
    controls: { play: true, pause: true, stop: true, next: true, prev: true },
  },
};

let outputs: AudioOutputsResponse = {
  items: [
    {
      id: 'alsa:analog',
      name: 'Analog Output (3.5 mm)',
      state: 'running',
      device_class: 'sound',
      alsa_card: 0,
      selected: true,
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
      id: 'alsa:usb',
      name: 'USB Audio DAC',
      state: 'idle',
      device_class: 'sound',
      alsa_card: 1,
      selected: false,
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
  alert_volume_percent: 25,
  default_restore_volume_percent: 100,
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
  allowed_sample_rates: [44100, 48000],
};

let media: AlertMediaResponse = {
  items: [
    {
      kind: 'alarm_start',
      label: 'Повітряна тривога',
      file_name: 'alarm_start.mp3',
      configured: true,
      size_bytes: 56320,
      modified_unix_seconds: 1789704000,
      max_size_bytes: 10485760,
      content_type: 'audio/mpeg',
    },
    {
      kind: 'alarm_end',
      label: 'Відбій тривоги',
      file_name: 'alarm_end.mp3',
      configured: true,
      size_bytes: 37888,
      modified_unix_seconds: 1789704000,
      max_size_bytes: 10485760,
      content_type: 'audio/mpeg',
    },
    {
      kind: 'minute_silence',
      label: 'Хвилина мовчання',
      file_name: 'minute_silence.mp3',
      configured: true,
      size_bytes: 414720,
      modified_unix_seconds: 1789704000,
      max_size_bytes: 10485760,
      content_type: 'audio/mpeg',
    },
  ],
  accepted_content_types: ['audio/mpeg', 'audio/mp3'],
  max_size_bytes: 10485760,
};

export const demoSystemInfo: SystemInfoResponse = {
  temperature_celsius: 49.8,
  native_version: '0.1.0',
  release: {
    version: '0.1.0',
    channel: 'preview',
    status: 'demo',
    build_id: 'github-pages',
    firmware_sha: null,
    native_sha: null,
    webui_sha: null,
  },
};

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
      features: ['player', 'mixer', 'outputs', 'radio', 'alerts'],
    } satisfies CapabilitiesResponse) as T;
  }
  if (method === 'GET' && path === '/status') return clone(status) as T;
  if (method === 'GET' && path === '/audio/mixer') return clone(mixer) as T;
  if (method === 'GET' && path === '/audio/outputs') return clone(outputs) as T;
  if (method === 'GET' && path === '/settings/alerts') return clone(alertSettings) as T;
  if (method === 'GET' && path === '/settings/audio') return clone(audioSettings) as T;
  if (method === 'GET' && path === '/settings/alerts/media') return clone(media) as T;

  if (method === 'POST' && path === '/player') {
    const action = String(body.action ?? '');
    const nextState = action === 'pause' ? 'paused' : action === 'stop' ? 'stopped' : 'playing';
    status = { ...status, player: { ...status.player, state: nextState } };
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
    return clone({ selected, applying: false, applied: true }) as T;
  }

  if (method === 'POST' && path === '/streams/play') {
    const url = String(body.url ?? '');
    status = {
      ...status,
      mpd: { ...status.mpd, is_stream: true, stream_url: url, state: 'play' },
      player: { ...status.player, source: 'Інтернет-радіо', backend: 'mpd', state: 'playing' },
    };
    return clone({ playing: url, source: 'mpd' }) as T;
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
    return clone(audioSettings) as T;
  }

  const mediaMatch = path.match(
    /^\/settings\/alerts\/media\/(alarm_start|alarm_end|minute_silence)$/,
  );
  if (mediaMatch && (method === 'PUT' || method === 'DELETE')) {
    const kind = mediaMatch[1] as AlertMediaFile['kind'];
    media = {
      ...media,
      items: media.items.map((item) =>
        item.kind === kind
          ? { ...item, configured: true, modified_unix_seconds: Math.floor(Date.now() / 1000) }
          : item,
      ),
    };
    return clone(media.items.find((item) => item.kind === kind)!) as T;
  }

  throw new Error(`Demo API route is not implemented: ${method} ${path}`);
}

import { describe, expect, it } from 'vitest';

import { parsePlayerStatus } from './validation';

function validStatus(): Record<string, unknown> {
  return {
    name: 'ProAudio Player',
    volume: 79.4,
    muted: false,
    priority: {
      mode: 'normal',
      active: false,
      blocking: false,
      duck_only_during_announcement: true,
      minute_silence_active: false,
      matched_uids: [],
      last_success_at: null,
      last_change_at: null,
      last_error: null,
    },
    mpd: { available: true, state: 'playing' },
    sources: [
      {
        key: 'spotify',
        active: true,
        type: 'Spotify Connect',
        application: 'spotifyd',
        media: 'Track',
      },
    ],
    audio_levels: {
      music_bus: 79.4,
      master: { volume: 100, db: 0, muted: false },
      physical: null,
      hardware: null,
      alert_bus: { volume: 100, db: 0, muted: false },
    },
    player: {
      source: 'Spotify Connect',
      backend: 'mpris',
      state: 'playing',
      title: 'Track',
      artist: 'Artist',
      album: 'Album',
      art_url: null,
      position_seconds: 10,
      duration_seconds: 100,
      elapsed: '0:10',
      duration: '1:40',
      progress: 10,
      controls: { play: true, pause: true, stop: true, next: true, prev: true },
    },
  };
}

describe('player status validation', () => {
  it('accepts the native v1 status shape', () => {
    expect(parsePlayerStatus(validStatus())).toBeDefined();
  });

  it('rejects an out-of-range MUSIC value', () => {
    const status = validStatus();
    status.volume = 101;
    expect(parsePlayerStatus(status)).toBeUndefined();
  });

  it('rejects a missing logical MASTER field', () => {
    const status = validStatus();
    const levels = status.audio_levels as Record<string, unknown>;
    delete levels.master;
    expect(parsePlayerStatus(status)).toBeUndefined();
  });

  it('rejects malformed transport controls', () => {
    const status = validStatus();
    const player = status.player as Record<string, unknown>;
    player.controls = { play: true };
    expect(parsePlayerStatus(status)).toBeUndefined();
  });
});

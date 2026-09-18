import { describe, expect, it } from 'vitest';

import type { PlayerStatus } from '../../api/types';
import { activeRadioStreamUrl } from './presentation';

const status = (
  player: Partial<PlayerStatus['player']>,
  streamUrl: string | null,
): Pick<PlayerStatus, 'player' | 'mpd'> => ({
  player: {
    source: 'Немає потоку',
    backend: 'none',
    state: 'stopped',
    title: '',
    artist: '',
    album: '',
    art_url: null,
    position_seconds: null,
    duration_seconds: null,
    elapsed: null,
    duration: null,
    progress: 0,
    controls: { play: false, pause: false, stop: false, next: false, prev: false },
    ...player,
  },
  mpd: {
    available: true,
    state: 'stopped',
    is_stream: Boolean(streamUrl),
    stream_url: streamUrl,
  },
});

describe('activeRadioStreamUrl', () => {
  it('returns the MPD stream only while Internet Radio is the canonical player', () => {
    const roks = 'https://online.radioroks.ua/RadioROKS_HD';

    expect(
      activeRadioStreamUrl(
        status({ source: 'Інтернет-радіо', backend: 'mpd', state: 'playing' }, roks),
      ),
    ).toBe(roks);

    expect(
      activeRadioStreamUrl(
        status({ source: 'Spotify Connect', backend: 'spotify-mpris', state: 'playing' }, roks),
      ),
    ).toBeNull();

    expect(
      activeRadioStreamUrl(
        status({ source: 'AirPlay', backend: 'airplay-mpris', state: 'playing' }, roks),
      ),
    ).toBeNull();
  });
});

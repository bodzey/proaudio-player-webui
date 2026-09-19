import { describe, expect, it } from 'vitest';

import {
  formatClock,
  isInternetRadioPlayer,
  radioTrackMetadata,
  shouldResyncPlayerPosition,
  type PlayerTimelineState,
} from './presentation';

describe('isInternetRadioPlayer', () => {
  it('uses the canonical active player identity', () => {
    expect(isInternetRadioPlayer({ backend: 'mpd', source: 'Інтернет-радіо' })).toBe(true);
    expect(isInternetRadioPlayer({ backend: 'spotify-mpris', source: 'Spotify Connect' })).toBe(
      false,
    );
    expect(isInternetRadioPlayer({ backend: 'airplay-mpris', source: 'AirPlay' })).toBe(false);
  });
});

describe('formatClock', () => {
  it('formats track positions without leaking invalid values', () => {
    expect(formatClock(null)).toBe('—:—');
    expect(formatClock(Number.NaN)).toBe('—:—');
    expect(formatClock(87.9)).toBe('1:27');
    expect(formatClock(3723)).toBe('1:02:03');
  });
});

describe('radioTrackMetadata', () => {
  it('removes duplicated station identity', () => {
    expect(radioTrackMetadata('Radio ROKS', 'Radio ROKS', 'Radio ROKS')).toEqual({
      title: '',
      artist: '',
    });
  });

  it('splits common artist-title metadata when artist is absent', () => {
    expect(radioTrackMetadata('The Weeknd - Blinding Lights', '', 'Radio ROKS')).toEqual({
      title: 'Blinding Lights',
      artist: 'The Weeknd',
    });
  });
});

describe('shouldResyncPlayerPosition', () => {
  const playing: PlayerTimelineState = {
    backend: 'dlna-upnp',
    source: 'DLNA / UPnP',
    state: 'playing',
    durationSeconds: 9260,
  };

  it('ignores coarse one-second transport updates while local progress is continuous', () => {
    expect(shouldResyncPlayerPosition(playing, playing, 140.82, 140)).toBe(false);
  });

  it('resynchronizes seeks and transport/source changes', () => {
    const paused = { ...playing, state: 'paused' };
    const radio = { ...playing, backend: 'mpd', source: 'Інтернет-радіо' };

    expect(shouldResyncPlayerPosition(playing, playing, 140.8, 146)).toBe(true);
    expect(shouldResyncPlayerPosition(playing, paused, 140.8, 141)).toBe(true);
    expect(shouldResyncPlayerPosition(playing, radio, 140.8, 0)).toBe(true);
  });
});

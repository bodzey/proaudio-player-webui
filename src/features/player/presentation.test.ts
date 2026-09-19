import { describe, expect, it } from 'vitest';

import { formatClock, isInternetRadioPlayer, radioTrackMetadata } from './presentation';

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

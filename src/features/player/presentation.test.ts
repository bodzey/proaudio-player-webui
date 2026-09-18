import { describe, expect, it } from 'vitest';

import { isInternetRadioPlayer } from './presentation';

describe('isInternetRadioPlayer', () => {
  it('uses the canonical active player identity', () => {
    expect(isInternetRadioPlayer({ backend: 'mpd', source: 'Інтернет-радіо' })).toBe(true);
    expect(isInternetRadioPlayer({ backend: 'spotify-mpris', source: 'Spotify Connect' })).toBe(
      false,
    );
    expect(isInternetRadioPlayer({ backend: 'airplay-mpris', source: 'AirPlay' })).toBe(false);
  });
});

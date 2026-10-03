import { describe, expect, it } from 'vitest';

import { filterRadioStations } from './search';
import { RADIO_STATIONS } from './stations';

describe('radio search', () => {
  it('keeps catalog order and ignores whitespace in an empty query', () => {
    expect(filterRadioStations(RADIO_STATIONS, '  \n ')).toBe(RADIO_STATIONS);
  });

  it('matches words across name and genre without case sensitivity', () => {
    const stations = RADIO_STATIONS.slice(0, 2).map((station, index) => ({
      ...station,
      name: index === 0 ? 'Київ Радіо' : 'Місто FM',
      genre: index === 0 ? 'Rock' : 'Jazz',
    }));
    expect(filterRadioStations(stations, '  київ  ROCK  ')).toEqual([stations[0]]);
    expect(filterRadioStations(stations, 'радіо jazz')).toEqual([]);
    expect(filterRadioStations(stations, 'міст')).toEqual([stations[1]]);
  });
});

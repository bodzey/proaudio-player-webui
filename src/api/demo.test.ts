import { afterEach, describe, expect, it, vi } from 'vitest';

import { demoRadioDirectory, resetDemoRadioDirectoryCache } from './demo-radio';
import { demoRequest, subscribeToDemoStatus } from './demo';
import type { PlayerStatus, RadioDirectoryResponse } from './types';

function station(index: number) {
  return {
    stationuuid: `station-${index}`,
    name: `Demo Radio ${index}`,
    url_resolved: `https://stream.example.org/${index}.mp3`,
    homepage: `https://radio.example.org/${index}`,
    favicon: `https://radio.example.org/${index}.png`,
    tags: 'ukrainian,pop',
    codec: 'MP3',
    bitrate: 192,
    votes: 1000 - index,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetDemoRadioDirectoryCache();
});

describe('demo API', () => {
  it('covers every route used by the web interface and publishes state changes', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(Array.from({ length: 80 }, (_, index) => station(index))), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const statuses: PlayerStatus[] = [];
    const unsubscribe = subscribeToDemoStatus((status) => statuses.push(status));

    await expect(demoRequest('/health')).resolves.toMatchObject({ status: 'ok' });
    await expect(demoRequest('/capabilities')).resolves.toMatchObject({ events: 'sse' });
    await expect(demoRequest('/status')).resolves.toMatchObject({ name: 'ProAudio Player' });
    await expect(demoRequest('/audio/mixer')).resolves.toHaveProperty('master');
    await expect(demoRequest('/audio/outputs')).resolves.toHaveProperty('items');
    await expect(demoRequest('/settings/alerts')).resolves.toHaveProperty('location_uid');
    await expect(demoRequest('/settings/audio')).resolves.toHaveProperty('duck_db');
    await expect(demoRequest('/settings/alerts/media')).resolves.toHaveProperty('items');

    const radio = await demoRequest<RadioDirectoryResponse>('/radio/stations');
    expect(radio.source).toBe('radio-browser');
    expect(radio.items).toHaveLength(64);

    await demoRequest('/player', {
      method: 'POST',
      body: JSON.stringify({ action: 'next' }),
    });
    await demoRequest('/volume', {
      method: 'POST',
      body: JSON.stringify({ percent: 61 }),
    });
    await demoRequest('/mute', {
      method: 'POST',
      body: JSON.stringify({ muted: false }),
    });
    await demoRequest('/audio/mixer', {
      method: 'POST',
      body: JSON.stringify({ target: 'master', db: -6 }),
    });
    await demoRequest('/audio/level', {
      method: 'POST',
      body: JSON.stringify({ target: 'alert', percent: 72 }),
    });
    await demoRequest('/audio/outputs', {
      method: 'POST',
      body: JSON.stringify({ id: 'alsa:hdmi' }),
    });

    const stream = radio.items[0]!;
    await demoRequest('/streams/play', {
      method: 'POST',
      body: JSON.stringify({ url: stream.url }),
    });
    const radioStatus = await demoRequest<PlayerStatus>('/status');
    expect(radioStatus.player).toMatchObject({
      source: 'Інтернет-радіо',
      backend: 'mpd',
      state: 'playing',
      title: stream.name,
    });
    expect(radioStatus.mpd.stream_url).toBe(stream.url);

    await demoRequest('/settings/alerts', {
      method: 'PUT',
      body: JSON.stringify({
        endpoint: 'https://example.org/{uid}',
        location_uid: 42,
        location_type: 'community',
        poll_interval_seconds: 10,
        request_timeout_seconds: 5,
        rate_limit_backoff_seconds: 60,
        clear_confirmations: 3,
      }),
    });
    await expect(
      demoRequest('/settings/alerts/test', {
        method: 'POST',
        body: JSON.stringify({ location_uid: 42 }),
      }),
    ).resolves.toMatchObject({ ok: true, location_uid: 42 });

    await demoRequest('/settings/audio', {
      method: 'PUT',
      body: JSON.stringify({ duck_only_during_announcement: false }),
    });
    await demoRequest('/settings/alerts/media/alarm_start', { method: 'PUT' });
    await demoRequest('/settings/alerts/media/alarm_start', { method: 'DELETE' });

    expect(statuses.length).toBeGreaterThan(1);
    unsubscribe();
  });

  it('keeps a bundled radio catalog when the public directory is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));

    const directory = await demoRadioDirectory();
    expect(directory.source).toBe('bundled-demo');
    expect(directory.items.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';

import { audioPayload, providerPayload } from './form';

function providerFormData(): FormData {
  const data = new FormData();
  data.set('endpoint', 'https://api.alerts.in.ua/v1/iot/active_air_raid_alerts/{uid}.json');
  data.set('location_uid', '1133');
  data.set('location_type', 'hromada');
  data.set('poll_interval_seconds', '8');
  data.set('request_timeout_seconds', '5');
  data.set('rate_limit_backoff_seconds', '60');
  data.set('clear_confirmations', '2');
  return data;
}

describe('alert settings form payloads', () => {
  it('preserves the selected location UID in the provider request', () => {
    expect(providerPayload(providerFormData())).toMatchObject({
      location_uid: 1133,
      location_type: 'hromada',
    });
  });

  it('does not silently convert a missing UID to zero', () => {
    const data = providerFormData();
    data.delete('location_uid');
    expect(() => providerPayload(data)).toThrow('location_uid');
  });

  it('serializes the alert ducking controls', () => {
    const data = new FormData();
    data.set('duck_db', '-12');
    data.set('air_raid_alerts_enabled', 'on');
    data.set('minute_silence_volume_percent', '100');
    data.set('minute_silence_enabled', 'on');
    data.set('minute_silence_start_time', '09:00:00');
    data.set('minute_silence_timezone', 'Europe/Kyiv');
    data.set('minute_silence_catch_up_seconds', '300');
    data.set('minute_silence_music_fade_seconds', '1.5');
    data.set('default_restore_volume_percent', '70');
    data.set('duck_fade_seconds', '0.25');
    data.set('restore_fade_seconds', '0.5');
    data.set('alert_repeat_interval_minutes', '0');
    data.set('duck_only_during_announcement', 'on');

    expect(audioPayload(data)).toMatchObject({
      duck_db: -12,
      air_raid_alerts_enabled: true,
      notifications_enabled: true,
      minute_silence_enabled: true,
      minute_silence_start_time: '09:00:00',
      minute_silence_timezone: 'Europe/Kyiv',
      duck_only_during_announcement: true,
    });
  });

  it('serializes air-raid and minute-of-silence switches independently', () => {
    const data = new FormData();
    data.set('duck_db', '-12');
    data.set('minute_silence_volume_percent', '100');
    data.set('minute_silence_enabled', 'on');
    data.set('minute_silence_start_time', '09:00:00');
    data.set('minute_silence_timezone', 'Europe/Kyiv');
    data.set('minute_silence_catch_up_seconds', '300');
    data.set('minute_silence_music_fade_seconds', '1.5');
    data.set('default_restore_volume_percent', '70');
    data.set('duck_fade_seconds', '0.25');
    data.set('restore_fade_seconds', '0.5');
    data.set('alert_repeat_interval_minutes', '0');

    expect(audioPayload(data)).toMatchObject({
      air_raid_alerts_enabled: false,
      notifications_enabled: false,
      minute_silence_enabled: true,
    });
  });
});

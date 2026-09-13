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
    data.set('minute_silence_volume_percent', '100');
    data.set('default_restore_volume_percent', '70');
    data.set('duck_fade_seconds', '0.25');
    data.set('restore_fade_seconds', '0.5');
    data.set('alert_repeat_interval_minutes', '0');
    data.set('duck_only_during_announcement', 'on');

    expect(audioPayload(data)).toMatchObject({
      duck_db: -12,
      duck_only_during_announcement: true,
    });
  });
});
